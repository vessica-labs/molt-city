import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Building, BuildingType, CityEvent, Company, Coordinates, Lot, Npc, WorldState } from '@molt-city/shared';

const MAP_CENTER = { x: 43, y: 45 };
const MAP_SCALE = 0.55;
const ROAD_Y = 0.09;
const LOT_Y = 0.2;

type ThreeCitySceneProps = {
  world?: WorldState;
  highlightEvent?: CityEvent;
};

type NpcActor = {
  group: THREE.Group;
  current: THREE.Vector3;
  target: THREE.Vector3;
  bobSeed: number;
  material: THREE.MeshStandardMaterial;
  icon?: THREE.Sprite;
};

type TrafficActor = {
  group: THREE.Group;
  axis: 'x' | 'z';
  fixed: number;
  laneOffset: number;
  min: number;
  max: number;
  speed: number;
  phase: number;
  direction: 1 | -1;
};

type BoatActor = {
  group: THREE.Group;
  baseZ: number;
  speed: number;
  phase: number;
};

type CloudActor = {
  sprite: THREE.Sprite;
  baseY: number;
  speed: number;
  phase: number;
};

const zoneColors: Record<Lot['zone'], number> = {
  residential: 0xf0a94d,
  commercial: 0x27b9e8,
  industrial: 0x7468d8,
  civic: 0xf46aa3,
  park: 0x35b85d,
  mixed: 0x54cbd2,
};

const moodColors: Record<Npc['mood'], number> = {
  happy: 0x20d39b,
  content: 0x47a8ff,
  sad: 0x6d7fa8,
  upset: 0xff7b54,
  rioting: 0xff304f,
  celebrating: 0xffd166,
};

export function ThreeCityScene({ world, highlightEvent }: ThreeCitySceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<CityRenderer | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const cityRenderer = new CityRenderer(host);
    rendererRef.current = cityRenderer;
    return () => {
      rendererRef.current = null;
      cityRenderer.destroy();
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setWorld(world);
  }, [world]);

  useEffect(() => {
    rendererRef.current?.setHighlight(highlightEvent);
  }, [highlightEvent]);

  return <div className="threeViewport" ref={hostRef} aria-label="GPU-rendered 3D Cerebral Valley city" />;
}

class CityRenderer {
  private readonly container: HTMLDivElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly clock = new THREE.Clock();
  private readonly atmosphereGroup = new THREE.Group();
  private readonly cityGroup = new THREE.Group();
  private readonly trafficGroup = new THREE.Group();
  private readonly peopleGroup = new THREE.Group();
  private readonly fxGroup = new THREE.Group();
  private readonly cars: TrafficActor[] = [];
  private readonly boats: BoatActor[] = [];
  private readonly clouds: CloudActor[] = [];
  private readonly people = new Map<string, NpcActor>();
  private readonly waterMaterial: THREE.ShaderMaterial;
  private readonly resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private activeFxKey = '';
  private visualWorld: WorldState = createPreviewWorld();

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x89ddf5);
    this.scene.fog = new THREE.FogExp2(0x89ddf5, 0.008);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    this.camera.position.set(43, 38, 43);
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));
    this.camera.zoom = 1.04;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.domElement.className = 'threeCanvas';
    this.container.appendChild(this.renderer.domElement);

    this.waterMaterial = createWaterMaterial();

    this.scene.add(this.atmosphereGroup, this.cityGroup, this.trafficGroup, this.peopleGroup, this.fxGroup);
    this.setupLights();
    this.setupEnvironment();
    this.setupTraffic();
    this.setWorld(undefined);

    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.container);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.animate();
  }

  setWorld(world?: WorldState) {
    this.visualWorld = world ?? createPreviewWorld();
    const pollution = this.visualWorld.metrics.pollution;
    this.scene.fog = new THREE.FogExp2(pollution > 42 ? 0x9eb0ba : 0x89ddf5, 0.007 + Math.min(0.008, pollution * 0.00009));
    this.rebuildCity(this.visualWorld);
    this.syncPeople(this.visualWorld.npcs);
  }

  setHighlight(event?: CityEvent) {
    const nextKey = event?.id ?? '';
    if (nextKey === this.activeFxKey) return;
    this.activeFxKey = nextKey;
    clearGroup(this.fxGroup, true);
    if (!event) return;

    const eventLot = event.lotId ? this.visualWorld.lots.find((lot) => lot.id === event.lotId) : undefined;
    const target = eventLot ? gridToWorld(eventLot.coordinates, 3.2) : new THREE.Vector3(-2, 5.2, -1);

    if (event.type === 'concert' || event.type === 'sponsored_event' || event.severity === 'whimsy') {
      this.fxGroup.add(createRainbowBurst(target));
      const label = createTextSprite('LIVE CIVIC SPECTACLE', { background: 'rgba(255,255,255,.82)', color: '#301565', accent: '#ff66c4' });
      label.position.copy(target).add(new THREE.Vector3(0, 4.4, 0));
      label.scale.multiplyScalar(0.82);
      this.fxGroup.add(label);
      return;
    }

    if (event.type === 'riot' || event.type === 'protest' || event.type === 'strike' || event.severity === 'danger' || event.severity === 'warning') {
      this.fxGroup.add(createWarningBeacon(target));
      const label = createTextSprite(event.type.toUpperCase(), { background: 'rgba(255,242,191,.9)', color: '#5e1f2c', accent: '#ff304f' });
      label.position.copy(target).add(new THREE.Vector3(0, 3.7, 0));
      label.scale.multiplyScalar(0.68);
      this.fxGroup.add(label);
      return;
    }

    this.fxGroup.add(createSparkleCloud(target, 0x82fff1, 80));
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.resize);
    clearGroup(this.cityGroup, true);
    clearGroup(this.trafficGroup, true);
    clearGroup(this.peopleGroup, true);
    clearGroup(this.atmosphereGroup, true);
    clearGroup(this.fxGroup, true);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private readonly resize = () => {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    const frustum = 58;
    this.camera.left = (-frustum * aspect) / 2;
    this.camera.right = (frustum * aspect) / 2;
    this.camera.top = frustum / 2;
    this.camera.bottom = -frustum / 2;
    this.camera.updateProjectionMatrix();
  };

  private readonly animate = () => {
    const elapsed = this.clock.getElapsedTime();
    const uTime = this.waterMaterial.uniforms.uTime;
    if (uTime) uTime.value = elapsed;

    for (const actor of this.people.values()) {
      actor.current.lerp(actor.target, 0.045);
      actor.group.position.copy(actor.current);
      actor.group.position.y += Math.sin(elapsed * 4.2 + actor.bobSeed) * 0.09;
      actor.group.rotation.y = Math.sin(elapsed * 1.6 + actor.bobSeed) * 0.22;
      if (actor.icon) actor.icon.position.y = 1.85 + Math.sin(elapsed * 3.1 + actor.bobSeed) * 0.12;
    }

    for (const car of this.cars) updateTrafficActor(car, elapsed);
    for (const boat of this.boats) {
      boat.group.position.x = 38 + Math.sin(elapsed * boat.speed + boat.phase) * 12;
      boat.group.position.z = boat.baseZ + Math.cos(elapsed * boat.speed * 0.7 + boat.phase) * 2.4;
      boat.group.position.y = 0.18 + Math.sin(elapsed * 1.7 + boat.phase) * 0.08;
      boat.group.rotation.y = -0.55 + Math.sin(elapsed * boat.speed + boat.phase) * 0.18;
    }

    for (const cloud of this.clouds) {
      cloud.sprite.position.x = -32 + ((elapsed * cloud.speed + cloud.phase) % 1) * 80;
      cloud.sprite.position.y = cloud.baseY + Math.sin(elapsed * 0.34 + cloud.phase * 9) * 0.7;
    }

    this.fxGroup.rotation.y = Math.sin(elapsed * 0.45) * 0.018;
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private setupLights() {
    const hemi = new THREE.HemisphereLight(0xd6f8ff, 0x4c8d4d, 2.25);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffdf9f, 5.1);
    sun.position.set(-28, 52, -32);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -55;
    sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 55;
    sun.shadow.camera.bottom = -55;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 140;
    this.scene.add(sun);

    const rim = new THREE.DirectionalLight(0x27c7ff, 1.45);
    rim.position.set(34, 26, 26);
    this.scene.add(rim);

    const glow = new THREE.PointLight(0xff76c7, 65, 45, 2.2);
    glow.position.set(-9, 9, 4);
    this.scene.add(glow);
  }

  private setupEnvironment() {
    const sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(5.8, 48, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd269, transparent: true, opacity: 0.9 }),
    );
    sunDisc.position.set(-42, 42, -44);
    this.atmosphereGroup.add(sunDisc);

    const groundTexture = createTerrainTexture();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 57, 1, 1),
      new THREE.MeshStandardMaterial({ map: groundTexture, color: 0xe6ffe3, roughness: 0.9, metalness: 0.02 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(-5, 0, 0);
    ground.receiveShadow = true;
    this.atmosphereGroup.add(ground);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(70, 1.2, 57),
      new THREE.MeshStandardMaterial({ color: 0x236747, roughness: 0.98 }),
    );
    base.position.set(-5, -0.76, 0);
    base.receiveShadow = true;
    this.atmosphereGroup.add(base);

    const water = new THREE.Mesh(new THREE.PlaneGeometry(48, 96, 120, 120), this.waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.set(55.5, -0.16, 0);
    water.receiveShadow = true;
    this.atmosphereGroup.add(water);

    const seawall = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.48, 58),
      new THREE.MeshStandardMaterial({ color: 0x9eaeb4, roughness: 0.72, metalness: 0.08 }),
    );
    seawall.position.set(30.55, 0.15, 0);
    seawall.castShadow = true;
    seawall.receiveShadow = true;
    this.atmosphereGroup.add(seawall);

    for (let i = 0; i < 5; i += 1) {
      const foam = new THREE.Mesh(
        new THREE.PlaneGeometry(0.24, 58, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0xf6ffff, transparent: true, opacity: 0.22 - i * 0.025, side: THREE.DoubleSide }),
      );
      foam.rotation.x = -Math.PI / 2;
      foam.position.set(31.55 + i * 0.72, 0.018, 0);
      this.atmosphereGroup.add(foam);
    }

    const hillMaterial = new THREE.MeshStandardMaterial({ color: 0x3ea369, roughness: 0.88, flatShading: true });
    for (let i = 0; i < 7; i += 1) {
      const hill = new THREE.Mesh(new THREE.ConeGeometry(4 + i * 0.28, 6 + (i % 3) * 1.6, 5), hillMaterial.clone());
      hill.position.set(-39 + i * 5.3, 2.15, -34 - (i % 2) * 2.8);
      hill.rotation.y = i * 0.33;
      hill.receiveShadow = true;
      this.atmosphereGroup.add(hill);
    }

    for (let i = 0; i < 7; i += 1) {
      const cloud = createCloudSprite(0.55 + (i % 3) * 0.14);
      cloud.position.set(-30 + i * 12, 24 + (i % 2) * 3.5, -22 - i * 1.8);
      this.clouds.push({ sprite: cloud, baseY: cloud.position.y, speed: 0.006 + i * 0.0015, phase: i * 0.17 });
      this.atmosphereGroup.add(cloud);
    }

    const citySparkles = createSparkleCloud(new THREE.Vector3(-4, 8, 1), 0xffffff, 120, 36);
    citySparkles.name = 'ambient-sparkles';
    this.atmosphereGroup.add(citySparkles);
  }

  private setupTraffic() {
    const colors = [0xff5b6e, 0xffd166, 0x4cc9f0, 0xffffff, 0x95ff8a, 0xbba7ff];
    const horizontalLanes = [-19.8, -9.9, 0, 9.9, 19.8];
    const verticalLanes = [-23.1, -15.4, -7.7, 0, 7.7, 15.4];

    for (let i = 0; i < 16; i += 1) {
      const axis: 'x' | 'z' = i % 2 === 0 ? 'x' : 'z';
      const color = colors[i % colors.length] ?? 0xffffff;
      const group = createCar(color);
      group.visible = i < 14;
      this.trafficGroup.add(group);
      if (axis === 'x') {
        const lane = horizontalLanes[i % horizontalLanes.length] ?? 0;
        this.cars.push({ group, axis, fixed: lane, laneOffset: i % 4 < 2 ? -0.36 : 0.36, min: -29, max: 24, speed: 0.027 + i * 0.0018, phase: i * 0.073, direction: i % 4 === 0 ? -1 : 1 });
      } else {
        const lane = verticalLanes[i % verticalLanes.length] ?? 0;
        this.cars.push({ group, axis, fixed: lane, laneOffset: i % 4 < 2 ? -0.34 : 0.34, min: -24, max: 24, speed: 0.024 + i * 0.0014, phase: i * 0.061, direction: i % 3 === 0 ? -1 : 1 });
      }
    }

    for (let i = 0; i < 3; i += 1) {
      const boat = createBoat(i === 0 ? 0xfff7d6 : i === 1 ? 0x9cecff : 0xff9fc6);
      boat.position.set(45 + i * 7, 0.18, -22 + i * 20);
      this.boats.push({ group: boat, baseZ: boat.position.z, speed: 0.24 + i * 0.07, phase: i * 1.8 });
      this.trafficGroup.add(boat);
    }
  }

  private rebuildCity(world: WorldState) {
    clearGroup(this.cityGroup, true);
    this.addRoadNetwork(world.lots);
    const buildingsByLot = new Map(world.buildings.map((building) => [building.lotId, building]));
    const companiesByLot = companiesByLotDevelopment(world.companies);
    const lots = [...world.lots].sort((a, b) => a.coordinates.y - b.coordinates.y || a.coordinates.x - b.coordinates.x);
    for (const lot of lots) {
      this.addLot(lot, buildingsByLot.get(lot.id), companiesByLot.get(lot.id), world.metrics.tick);
    }
    this.addDistrictLabels(world.lots);
    this.addMetricBadges(world);
  }

  private addRoadNetwork(lots: Lot[]) {
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x4c5c68, roughness: 0.78, metalness: 0.04 });
    const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xfff0a6, emissive: 0xffd166, emissiveIntensity: 0.35, roughness: 0.5 });
    const crosswalkMaterial = new THREE.MeshStandardMaterial({ color: 0xfafcff, roughness: 0.65 });
    const xs = uniqueSorted(lots.map((lot) => gridToWorld(lot.coordinates).x));
    const zs = uniqueSorted(lots.map((lot) => gridToWorld(lot.coordinates).z));
    if (xs.length === 0 || zs.length === 0) return;
    const minX = (xs[0] ?? -20) - 8;
    const maxX = (xs[xs.length - 1] ?? 20) + 6;
    const minZ = (zs[0] ?? -16) - 6;
    const maxZ = (zs[zs.length - 1] ?? 16) + 6;
    const xRoads = betweenAndEdges(xs, 4.2);
    const zRoads = betweenAndEdges(zs, 5.1);

    for (const z of zRoads) {
      const road = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, 0.12, 1.64), roadMaterial.clone());
      road.position.set((minX + maxX) / 2, ROAD_Y, z);
      road.receiveShadow = true;
      this.cityGroup.add(road);
      addDashes(this.cityGroup, 'x', z, minX, maxX, lineMaterial);
    }

    for (const x of xRoads) {
      const road = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.13, maxZ - minZ), roadMaterial.clone());
      road.position.set(x, ROAD_Y + 0.005, (minZ + maxZ) / 2);
      road.receiveShadow = true;
      this.cityGroup.add(road);
      addDashes(this.cityGroup, 'z', x, minZ, maxZ, lineMaterial);
    }

    for (const x of xRoads) {
      for (const z of zRoads) {
        if (Math.abs(x) > 27 || Math.abs(z) > 24) continue;
        for (let stripe = -1; stripe <= 1; stripe += 1) {
          const walk = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 1.32), crosswalkMaterial.clone());
          walk.position.set(x + stripe * 0.36, ROAD_Y + 0.095, z);
          this.cityGroup.add(walk);
        }
      }
    }
  }

  private addLot(lot: Lot, building: Building | undefined, company: Company | undefined, tick: number) {
    const position = gridToWorld(lot.coordinates);
    const group = new THREE.Group();
    group.position.copy(position);
    group.name = lot.name;

    const width = lotWidth(lot);
    const depth = lotDepth(lot);
    const tileMaterial = new THREE.MeshStandardMaterial({ color: zoneColors[lot.zone], roughness: 0.82, metalness: 0.04 });
    const tile = new THREE.Mesh(new THREE.BoxGeometry(width, 0.32, depth), tileMaterial);
    tile.position.y = LOT_Y;
    tile.castShadow = false;
    tile.receiveShadow = true;
    group.add(tile);

    const bevel = new THREE.LineSegments(
      new THREE.EdgesGeometry(tile.geometry),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42 }),
    );
    bevel.position.copy(tile.position);
    group.add(bevel);

    addLotSurfaceDetails(group, lot, width, depth);
    if (building) {
      const model = createBuildingModel(building, lot, company, tick);
      model.position.y = LOT_Y + 0.19;
      group.add(model);
    } else {
      addEmptyLotModel(group, lot, width, depth);
    }

    if (lot.ownerId && lot.ownerId !== 'city') {
      group.add(createOwnershipGlow(width, depth));
    }

    this.cityGroup.add(group);
  }

  private addDistrictLabels(lots: Lot[]) {
    const byDistrict = new Map<Lot['district'], { position: THREE.Vector3; count: number }>();
    for (const lot of lots) {
      const entry = byDistrict.get(lot.district) ?? { position: new THREE.Vector3(), count: 0 };
      entry.position.add(gridToWorld(lot.coordinates));
      entry.count += 1;
      byDistrict.set(lot.district, entry);
    }

    for (const [district, entry] of byDistrict) {
      const label = createTextSprite(district.toUpperCase(), { background: 'rgba(255,255,255,.76)', color: '#19224f', accent: '#6ee7ff' });
      label.position.copy(entry.position.multiplyScalar(1 / entry.count));
      label.position.y = 1.35;
      label.position.x -= 2.1;
      label.scale.multiplyScalar(0.5);
      this.cityGroup.add(label);
    }
  }

  private addMetricBadges(world: WorldState) {
    if (world.metrics.compute > 35) {
      const glow = createSparkleCloud(new THREE.Vector3(5, 8, -2), 0x40ffe0, Math.min(160, 55 + world.metrics.compute), 24);
      this.cityGroup.add(glow);
    }
    if (world.metrics.culture > 40) {
      const rainbow = createRainbowBurst(new THREE.Vector3(-13, 4.2, 8), 0.55);
      this.cityGroup.add(rainbow);
    }
  }

  private syncPeople(npcs: Npc[]) {
    const liveIds = new Set(npcs.map((npc) => npc.id));
    for (const [id, actor] of this.people) {
      if (!liveIds.has(id)) {
        clearGroup(actor.group, true);
        this.peopleGroup.remove(actor.group);
        this.people.delete(id);
      }
    }

    for (const npc of npcs) {
      const target = gridToWorld(npc.position, 0.84);
      let actor = this.people.get(npc.id);
      if (!actor) {
        const group = createNpcModel(npc);
        group.position.copy(target);
        const material = findNpcBodyMaterial(group) ?? new THREE.MeshStandardMaterial({ color: moodColors[npc.mood] });
        actor = { group, current: target.clone(), target, bobSeed: hashFloat(npc.id) * Math.PI * 2, material };
        this.people.set(npc.id, actor);
        this.peopleGroup.add(group);
      } else {
        actor.target = target;
        actor.material.color.setHex(moodColors[npc.mood]);
        actor.material.emissive.setHex(npc.mood === 'celebrating' ? 0xffc1f3 : npc.mood === 'rioting' ? 0xff2034 : 0x000000);
        actor.material.emissiveIntensity = npc.mood === 'celebrating' || npc.mood === 'rioting' ? 0.45 : 0;
        if (actor.icon) {
          actor.group.remove(actor.icon);
          disposeObject(actor.icon);
        }
      }

      const iconText = activityIcon(npc);
      if (iconText) {
        const icon = createTextSprite(iconText, { background: 'rgba(255,255,255,.9)', color: npc.activity === 'protesting' || npc.activity === 'striking' ? '#d7263d' : '#19224f', accent: '#ffd166', square: true });
        icon.scale.set(0.72, 0.72, 0.72);
        icon.position.set(0.42, 1.85, 0);
        actor.icon = icon;
        actor.group.add(icon);
      } else {
        actor.icon = undefined;
      }
    }
  }
}

function gridToWorld(point: Coordinates, lift = 0): THREE.Vector3 {
  return new THREE.Vector3((point.x - MAP_CENTER.x) * MAP_SCALE, lift, (point.y - MAP_CENTER.y) * MAP_SCALE);
}

function lotWidth(lot: Lot) {
  return 5.3 + lot.size * 0.78;
}

function lotDepth(lot: Lot) {
  return 5.6 + lot.size * 0.82;
}

function uniqueSorted(values: number[]) {
  return [...new Set(values.map((value) => Number(value.toFixed(3))))].sort((a, b) => a - b);
}

function betweenAndEdges(values: number[], edgePadding: number) {
  if (values.length === 0) return [];
  const roads: number[] = [(values[0] ?? 0) - edgePadding];
  for (let index = 0; index < values.length - 1; index += 1) {
    const current = values[index] ?? 0;
    const next = values[index + 1] ?? current;
    roads.push((current + next) / 2);
  }
  roads.push((values[values.length - 1] ?? 0) + edgePadding);
  return roads;
}

function addDashes(group: THREE.Group, axis: 'x' | 'z', fixed: number, min: number, max: number, material: THREE.Material) {
  const length = max - min;
  const count = Math.max(4, Math.floor(length / 4));
  for (let index = 0; index < count; index += 1) {
    const t = (index + 0.5) / count;
    const dash = axis === 'x'
      ? new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.04, 0.08), material.clone())
      : new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 1.38), material.clone());
    if (axis === 'x') dash.position.set(min + length * t, ROAD_Y + 0.1, fixed);
    else dash.position.set(fixed, ROAD_Y + 0.1, min + length * t);
    group.add(dash);
  }
}

function addLotSurfaceDetails(group: THREE.Group, lot: Lot, width: number, depth: number) {
  if (lot.zone === 'park' || lot.zone === 'residential') {
    const treeCount = lot.zone === 'park' ? 6 + lot.size : 2;
    for (let index = 0; index < treeCount; index += 1) {
      const tree = createTree(0.62 + (index % 3) * 0.11);
      tree.position.set(
        -width / 2 + 1.0 + ((index * 1.73) % Math.max(1, width - 2)),
        LOT_Y + 0.21,
        -depth / 2 + 0.9 + ((index * 2.31) % Math.max(1, depth - 1.8)),
      );
      group.add(tree);
    }
  }

  if (lot.zone === 'industrial') {
    for (let index = 0; index < 3; index += 1) {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, depth - 1.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x5c6078, roughness: 0.66, metalness: 0.45 }),
      );
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(-width / 2 + 1.1 + index * 0.45, LOT_Y + 0.4, depth / 2 - 0.8);
      pipe.castShadow = true;
      group.add(pipe);
    }
  }

  if (lot.zone === 'civic' || lot.zone === 'mixed') {
    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(Math.min(width, depth) * 0.22, 32),
      new THREE.MeshStandardMaterial({ color: 0xf7f3df, roughness: 0.74 }),
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(width * 0.27, LOT_Y + 0.18, -depth * 0.25);
    plaza.receiveShadow = true;
    group.add(plaza);
  }
}

function addEmptyLotModel(group: THREE.Group, lot: Lot, width: number, depth: number) {
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.58, 0.16, depth * 0.48),
    new THREE.MeshStandardMaterial({ color: 0xeaf0f5, roughness: 0.8, metalness: 0.05 }),
  );
  foundation.position.set(0, LOT_Y + 0.25, 0);
  foundation.castShadow = true;
  foundation.receiveShadow = true;
  group.add(foundation);

  const gridMaterial = new THREE.LineBasicMaterial({ color: 0x526173, transparent: true, opacity: 0.34 });
  const lines = new THREE.Group();
  for (let index = -2; index <= 2; index += 1) {
    const lineA = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-width * 0.26, LOT_Y + 0.35, index * depth * 0.06), new THREE.Vector3(width * 0.26, LOT_Y + 0.35, index * depth * 0.06)]),
      gridMaterial.clone(),
    );
    const lineB = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(index * width * 0.065, LOT_Y + 0.36, -depth * 0.22), new THREE.Vector3(index * width * 0.065, LOT_Y + 0.36, depth * 0.22)]),
      gridMaterial.clone(),
    );
    lines.add(lineA, lineB);
  }
  group.add(lines);

  const sign = createTextSprite(lot.zone === 'park' ? 'PUBLIC PARK' : 'API LOT', { background: 'rgba(255,246,184,.92)', color: '#202858', accent: '#ff66c4' });
  sign.position.set(-width * 0.25, LOT_Y + 1.15, -depth * 0.22);
  sign.scale.multiplyScalar(0.45);
  group.add(sign);
}

function createOwnershipGlow(width: number, depth: number) {
  const ring = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 0.7, depth + 0.7),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = LOT_Y + 0.185;
  return ring;
}

function createBuildingModel(building: Building, lot: Lot, company: Company | undefined, tick: number) {
  const group = new THREE.Group();
  const width = Math.min(lotWidth(lot) * 0.72, 5.8 + lot.size * 0.3);
  const depth = Math.min(lotDepth(lot) * 0.67, 5.6 + lot.size * 0.25);
  const baseHeight = buildingHeight(building);
  const roofline = renderedRoofline(building, baseHeight);
  const height = company ? companyHeight(building, company) : baseHeight;

  switch (building.type) {
    case 'garage':
      createGarage(group, building, width, depth);
      break;
    case 'coffee_shop':
      createCoffeeShop(group, building, width, depth);
      break;
    case 'coworking_loft':
      createCoworking(group, building, width, depth, height);
      break;
    case 'research_lab':
      createResearchLab(group, building, width, depth, height);
      break;
    case 'data_center_greenhouse':
      createDataCenter(group, building, width, depth);
      break;
    case 'model_foundry':
      createModelFoundry(group, building, width, depth);
      break;
    case 'civic_hall':
      createCivicHall(group, building, width, depth);
      break;
    case 'transit_kiosk':
      createTransitKiosk(group, building, width, depth);
      break;
    case 'pony_meadow':
      createPonyMeadow(group, building, width, depth);
      break;
    case 'concert_shell':
      createConcertShell(group, building, width, depth);
      break;
    case 'mixed_use_tower':
      createMixedUseTower(group, building, width, depth, height);
      break;
    default:
      createGenericBuilding(group, building, width, depth, height);
  }

  if (building.underConstructionUntilTick && building.underConstructionUntilTick > tick) {
    addConstructionOverlay(group, width, depth, Math.max(2.6, height));
  }

  if (company) {
    addBusinessGrowth(group, building, company, width, depth, roofline, height);
  }

  const name = createTextSprite(shortLabel(building.name), { background: 'rgba(19,26,58,.72)', color: '#eaffff', accent: '#6ee7ff' });
  name.position.set(0, Math.max(2.7, height + 1.15), -depth * 0.56);
  name.scale.multiplyScalar(0.36);
  group.add(name);

  return group;
}

function buildingHeight(building: Building) {
  const typeBase: Record<BuildingType, number> = {
    garage: 2.3,
    coffee_shop: 2.7,
    coworking_loft: 5.8,
    research_lab: 5.4,
    data_center_greenhouse: 4.5,
    model_foundry: 6.4,
    civic_hall: 5.1,
    transit_kiosk: 2.2,
    pony_meadow: 1.7,
    concert_shell: 3.5,
    mixed_use_tower: 12.4,
  };
  return Math.min(18, typeBase[building.type] + building.level * 0.72 + building.jobs * 0.08 + building.compute * 0.12);
}

function renderedRoofline(building: Building, computedHeight: number) {
  const fixedTypeRoofline: Partial<Record<BuildingType, number>> = {
    garage: 2.65,
    coffee_shop: 2.55,
    data_center_greenhouse: 4.85,
    model_foundry: 7.9,
    civic_hall: 5.05,
    transit_kiosk: 1.7,
    pony_meadow: 2.15,
    concert_shell: 3.15,
  };
  return fixedTypeRoofline[building.type] ?? computedHeight;
}

function companyHeight(building: Building, company: Company) {
  const stageBoost: Record<Company['stage'], number> = {
    garage: 0,
    seed: 1.4,
    series_a: 3.2,
    growth: 5.6,
    'public-ish': 8.4,
    failed: 0,
  };
  const valuationBoost = Math.log10(Math.max(1, company.valuation / 3_000)) * 4.8;
  const researchBoost = Math.min(3.2, company.research / 2_000);
  const marketBoost = company.marketShare / 16;
  const capitalBoost = Math.max(0, Math.log10(Math.max(1, company.cash + 1_200)) - 3) * 1.4;
  return Math.min(30, buildingHeight(building) + (stageBoost[company.stage] ?? 0) + valuationBoost + researchBoost + marketBoost + capitalBoost);
}

function companiesByLotDevelopment(companies: Company[]) {
  const byLot = new Map<string, Company>();
  for (const company of companies) {
    const existing = byLot.get(company.lotId);
    if (!existing || companyDevelopmentScore(company) > companyDevelopmentScore(existing)) {
      byLot.set(company.lotId, company);
    }
  }
  return byLot;
}

function companyDevelopmentScore(company: Company) {
  const stageScore: Record<Company['stage'], number> = {
    garage: 0,
    seed: 8_000,
    series_a: 22_000,
    growth: 46_000,
    'public-ish': 90_000,
    failed: 0,
  };
  return company.valuation + company.research * 4 + company.marketShare * 950 + (stageScore[company.stage] ?? 0);
}

function addBusinessGrowth(group: THREE.Group, building: Building, company: Company, width: number, depth: number, baseHeight: number, height: number) {
  const growth = Math.max(0, height - baseHeight);
  const color = companyColor(company.archetype);
  const isFailed = company.stage === 'failed';
  const glow = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: isFailed ? 0.18 : 0.42, roughness: 0.25, metalness: 0.28, transparent: true, opacity: isFailed ? 0.62 : 0.88 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xeaffff, emissive: color, emissiveIntensity: 0.75, roughness: 0.28, metalness: 0.18 });

  if (growth > 1.1) {
    const towerHeight = Math.max(1.6, growth * 0.72);
    const towerWidth = width * (building.type === 'garage' || building.type === 'coffee_shop' ? 0.5 : 0.38);
    const towerDepth = depth * (building.type === 'garage' || building.type === 'coffee_shop' ? 0.46 : 0.36);
    addBlock(group, towerWidth, towerHeight, towerDepth, width * 0.13, baseHeight + towerHeight / 2, depth * 0.04, glow);
    addWindows(group, towerWidth, towerHeight - 0.2, towerDepth, baseHeight, Math.floor(towerHeight * 1.5), `${company.id}:growth`);
  }

  if (growth > 3.4) {
    const secondHeight = Math.max(1.2, growth * 0.46);
    addBlock(group, width * 0.28, secondHeight, depth * 0.3, -width * 0.2, baseHeight + secondHeight / 2, -depth * 0.1, glow.clone());
    addNeonStrip(group, -width * 0.18, baseHeight + secondHeight + 0.16, -depth * 0.28, width * 0.32, color);
  }

  if (growth > 5.8 || company.stage === 'growth' || company.stage === 'public-ish') {
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(width * 0.2, width * 0.28, 0.52, 6),
      trim,
    );
    crown.position.set(0, height + 0.36, 0);
    crown.rotation.y = Math.PI / 6;
    crown.castShadow = true;
    group.add(crown);
    addAntenna(group, width * 0.2, height + 0.45, -depth * 0.08, color);
  }

  if (height >= 6.4 || companyDevelopmentScore(company) > 18_000) {
    addRooftopCompanySign(group, company, width, depth, height, color);
  }
}

function addRooftopCompanySign(group: THREE.Group, company: Company, width: number, depth: number, height: number, color: number) {
  const isFailed = company.stage === 'failed';
  const signText = isFailed ? `${shortCompanyLabel(company.name)} RIP` : shortCompanyLabel(company.name);
  const sign = createTextSprite(signText, { background: isFailed ? 'rgba(45,45,58,.82)' : 'rgba(15,22,55,.86)', color: '#f5ffff', accent: `#${color.toString(16).padStart(6, '0')}` });
  sign.position.set(0, height + 1.45, -depth * 0.56);
  sign.scale.set(Math.max(8.2, width * 1.55), 2.05, 1);
  sign.renderOrder = 30;
  sign.material.depthTest = false;
  group.add(sign);

  const facade = createTextSprite(signText, { background: isFailed ? 'rgba(235,239,236,.74)' : 'rgba(255,255,255,.86)', color: isFailed ? '#45495a' : '#17204f', accent: `#${color.toString(16).padStart(6, '0')}` });
  facade.position.set(0, Math.max(2.4, height - 0.75), -depth * 0.55);
  facade.scale.set(Math.max(5.8, width * 1.15), 1.35, 1);
  facade.renderOrder = 29;
  facade.material.depthTest = false;
  group.add(facade);

  const posts = new THREE.Group();
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0x1c244a, roughness: 0.42, metalness: 0.55 });
  for (const x of [-width * 0.28, width * 0.28]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.05, 0.08), postMaterial.clone());
    post.position.set(x, height + 0.52, -depth * 0.53);
    posts.add(post);
  }
  const railMaterial = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2, roughness: 0.24 });
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(Math.max(4.6, width * 1.05), 0.07, 0.08), railMaterial);
  topRail.position.set(0, height + 1.72, -depth * 0.54);
  const bottomRail = topRail.clone();
  bottomRail.position.y = height + 0.62;
  posts.add(topRail, bottomRail);
  group.add(posts);
}

function companyColor(archetype: Company['archetype']) {
  const colors: Record<Company['archetype'], number> = {
    search: 0x4cc9f0,
    enterprise: 0x9b8cff,
    frontier_ai: 0x40ffe0,
    social: 0xff66c4,
    robotics: 0xffd166,
    local_services: 0x66e084,
    finance: 0xff8c42,
  };
  return colors[archetype] ?? 0x6ee7ff;
}

function shortCompanyLabel(name: string) {
  const stopwords = new Set(['the', 'and', 'of', 'for']);
  const words = name.split(/\s+/).filter((word) => word && !stopwords.has(word.toLowerCase()));
  if (words.length <= 2) return name.toUpperCase();
  const core = words.slice(0, 3).map((word) => word.replace(/[^a-z0-9]/gi, '')).filter(Boolean);
  return core.join(' ').toUpperCase();
}

function createGarage(group: THREE.Group, building: Building, width: number, depth: number) {
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7161d9, roughness: 0.78, metalness: 0.05 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4d3f9d, roughness: 0.62, metalness: 0.08 });
  addBlock(group, width * 0.68, 1.55, depth * 0.6, 0, 0.78, 0, bodyMat);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(width, depth) * 0.38, 1.15, 4), roofMat);
  roof.position.set(0, 2.05, 0);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);
  addDoor(group, 0, 0.75, depth * -0.31, 1.1, 1.1, 0x222858);
  addNeonStrip(group, width * -0.22, 1.52, depth * -0.33, 0.95, 0x81fff5);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 10, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xeef8ff, roughness: 0.25, metalness: 0.65 }));
  dish.position.set(width * 0.23, 2.38, 0.18);
  dish.rotation.x = -0.8;
  group.add(dish);
  addWindows(group, width * 0.68, 1.25, depth * 0.6, 0.15, 1, building.id);
}

function createCoffeeShop(group: THREE.Group, building: Building, width: number, depth: number) {
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff9fbc, roughness: 0.68, metalness: 0.04 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.6 });
  addBlock(group, width * 0.66, 2.15, depth * 0.58, 0, 1.08, 0, bodyMat);
  addBlock(group, width * 0.72, 0.32, depth * 0.64, 0, 2.34, 0, roofMat);
  addWindows(group, width * 0.66, 1.7, depth * 0.58, 0.28, 2, building.id);
  for (let i = 0; i < 5; i += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(width * 0.12, 0.18, 0.16), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffffff : 0xff4d80, roughness: 0.52 }));
    stripe.position.set(-width * 0.25 + i * width * 0.125, 1.38, -depth * 0.36);
    stripe.castShadow = true;
    group.add(stripe);
  }
  for (let i = 0; i < 2; i += 1) {
    const steam = createSteamPuff(0.34 + i * 0.08);
    steam.position.set(width * (0.1 + i * 0.08), 2.8 + i * 0.4, -depth * 0.08);
    group.add(steam);
  }
  addPatioSet(group, -width * 0.32, -depth * 0.38);
}

function createCoworking(group: THREE.Group, building: Building, width: number, depth: number, height: number) {
  const glass = new THREE.MeshStandardMaterial({ color: 0x58c7ef, emissive: 0x08324d, emissiveIntensity: 0.24, roughness: 0.28, metalness: 0.24, transparent: true, opacity: 0.92 });
  const core = new THREE.MeshStandardMaterial({ color: 0x2d5c87, roughness: 0.58, metalness: 0.12 });
  addBlock(group, width * 0.82, height, depth * 0.82, 0, height / 2, 0, glass);
  addBlock(group, width * 0.18, height + 0.35, depth * 0.9, -width * 0.28, (height + 0.35) / 2, 0, core);
  addWindows(group, width * 0.82, height - 0.35, depth * 0.82, 0.2, Math.floor(height), building.id);
  addRooftopGarden(group, width, depth, height);
}

function createResearchLab(group: THREE.Group, building: Building, width: number, depth: number, height: number) {
  const white = new THREE.MeshStandardMaterial({ color: 0xe9fff9, roughness: 0.5, metalness: 0.08 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x23cdb8, emissive: 0x0e6059, emissiveIntensity: 0.22, roughness: 0.42 });
  addBlock(group, width * 0.7, height * 0.72, depth * 0.76, -width * 0.08, height * 0.36, 0, white);
  addBlock(group, width * 0.38, height * 0.48, depth * 0.5, width * 0.25, height * 0.24, -depth * 0.05, teal);
  addWindows(group, width * 0.7, height * 0.65, depth * 0.76, 0.2, Math.floor(height), building.id);
  const reactor = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, height * 0.82, 28), new THREE.MeshStandardMaterial({ color: 0x9fffee, emissive: 0x40ffe0, emissiveIntensity: 0.9, transparent: true, opacity: 0.58, roughness: 0.18, metalness: 0.06 }));
  reactor.position.set(width * 0.2, height * 0.43, depth * 0.2);
  reactor.castShadow = true;
  group.add(reactor);
  addAntenna(group, -width * 0.25, height * 0.76, -depth * 0.2, 0x40ffe0);
}

function createDataCenter(group: THREE.Group, building: Building, width: number, depth: number) {
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d284f, roughness: 0.42, metalness: 0.28 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x32e0c4, emissive: 0x19d8b8, emissiveIntensity: 0.55, transparent: true, opacity: 0.72, roughness: 0.25 });
  addBlock(group, width * 0.92, 3.8, depth * 0.78, 0, 1.9, 0, dark);
  addBlock(group, width * 0.84, 0.64, depth * 0.58, 0, 4.18, 0, glass);
  for (let i = 0; i < 5; i += 1) addNeonStrip(group, -width * 0.34 + i * width * 0.17, 2.45, -depth * 0.41, 0.88, 0x40ffe0);
  for (let i = 0; i < 3; i += 1) {
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.18, 28), new THREE.MeshStandardMaterial({ color: 0xd7fff8, roughness: 0.3, metalness: 0.55 }));
    fan.position.set(-width * 0.26 + i * width * 0.26, 4.6, depth * 0.1);
    fan.castShadow = true;
    group.add(fan);
  }
  addAntenna(group, width * 0.34, 4.52, -depth * 0.16, 0x40ffe0);
  addWindows(group, width * 0.92, 2.8, depth * 0.78, 0.45, 3, building.id);
}

function createModelFoundry(group: THREE.Group, building: Building, width: number, depth: number) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x36384f, roughness: 0.58, metalness: 0.5 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff9452, emissive: 0xff5d2e, emissiveIntensity: 1.1, roughness: 0.34 });
  addBlock(group, width * 0.88, 4.6, depth * 0.76, 0, 2.3, 0, steel);
  addBlock(group, width * 0.5, 1.2, depth * 0.45, -width * 0.08, 5.2, 0, steel.clone());
  addBlock(group, width * 0.32, 1.8, 0.16, width * 0.22, 1.65, -depth * 0.41, orange);
  for (let i = 0; i < 2; i += 1) {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 3.1, 16), steel.clone());
    stack.position.set(width * (0.22 + i * 0.17), 6.3, depth * 0.16);
    stack.castShadow = true;
    group.add(stack);
    const smoke = createSteamPuff(0.45);
    smoke.position.set(stack.position.x, 8.1 + i * 0.42, stack.position.z);
    group.add(smoke);
  }
  addNeonStrip(group, -width * 0.36, 3.7, -depth * 0.42, 1.4, 0xff9452);
  addWindows(group, width * 0.88, 3.5, depth * 0.76, 0.48, 4, building.id);
}

function createCivicHall(group: THREE.Group, building: Building, width: number, depth: number) {
  const body = new THREE.MeshStandardMaterial({ color: 0xffb8d2, roughness: 0.62, metalness: 0.04 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xfff4fb, roughness: 0.7 });
  addBlock(group, width * 0.78, 3.1, depth * 0.64, 0, 1.55, 0, body);
  addBlock(group, width * 0.88, 0.42, depth * 0.74, 0, 3.35, 0, stone);
  for (let i = 0; i < 5; i += 1) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.4, 14), stone.clone());
    col.position.set(-width * 0.28 + i * width * 0.14, 1.55, -depth * 0.36);
    col.castShadow = true;
    group.add(col);
  }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), stone.clone());
  dome.position.set(0, 3.58, 0);
  dome.castShadow = true;
  group.add(dome);
  addAntenna(group, 0, 4.8, 0, 0xff7db6);
  addWindows(group, width * 0.78, 2.3, depth * 0.64, 0.38, 3, building.id);
}

function createTransitKiosk(group: THREE.Group, _building: Building, width: number, depth: number) {
  const base = new THREE.MeshStandardMaterial({ color: 0x78a7ff, roughness: 0.52, metalness: 0.1 });
  const roof = new THREE.MeshStandardMaterial({ color: 0xfff2a2, roughness: 0.46 });
  addBlock(group, width * 0.5, 1.35, depth * 0.34, 0, 0.68, 0, base);
  addBlock(group, width * 0.78, 0.25, depth * 0.48, 0, 1.52, 0, roof);
  for (let i = -1; i <= 1; i += 2) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0xdbe6ec, roughness: 0.3, metalness: 0.75 }));
    rail.position.set(0, 0.24, depth * 0.31 * i);
    group.add(rail);
  }
  const tram = new THREE.Mesh(new THREE.BoxGeometry(width * 0.55, 0.62, 0.44), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x4cc9f0, emissiveIntensity: 0.12, roughness: 0.36 }));
  tram.position.set(0, 0.66, depth * 0.31);
  tram.castShadow = true;
  group.add(tram);
}

function createPonyMeadow(group: THREE.Group, _building: Building, width: number, depth: number) {
  for (let index = 0; index < 7; index += 1) {
    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 6),
      new THREE.MeshStandardMaterial({ color: index % 2 ? 0xff66c4 : 0xfff06b, emissive: index % 2 ? 0xff66c4 : 0xffd166, emissiveIntensity: 0.22 }),
    );
    flower.position.set(-width * 0.36 + (index % 4) * width * 0.18, 0.52, -depth * 0.22 + Math.floor(index / 4) * depth * 0.22);
    group.add(flower);
  }
  const pony = createPony();
  pony.position.set(-width * 0.08, 0.72, 0.1);
  group.add(pony);
  const rainbowColors = [0xff4d80, 0xffd166, 0x66e084, 0x4cc9f0, 0x9b5cff];
  for (let index = 0; index < rainbowColors.length; index += 1) {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(1.65 + index * 0.13, 0.045, 8, 48, Math.PI),
      new THREE.MeshStandardMaterial({ color: rainbowColors[index] ?? 0xffffff, emissive: rainbowColors[index] ?? 0xffffff, emissiveIntensity: 0.45 }),
    );
    arc.position.set(width * 0.18, 1.15, -depth * 0.16 + index * 0.02);
    group.add(arc);
  }
}

function createConcertShell(group: THREE.Group, building: Building, width: number, depth: number) {
  const stage = new THREE.MeshStandardMaterial({ color: 0x6d51d9, roughness: 0.45, metalness: 0.12 });
  const shell = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xff70bf, emissiveIntensity: 0.28, roughness: 0.48, metalness: 0.08 });
  addBlock(group, width * 0.82, 0.42, depth * 0.48, 0, 0.24, 0.22, stage);
  for (let i = 0; i < 5; i += 1) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(1.55 + i * 0.14, 0.08, 8, 40, Math.PI), shell.clone());
    rib.position.set(0, 1.18, -depth * 0.05 + i * 0.16);
    rib.scale.y = 0.78;
    rib.castShadow = true;
    group.add(rib);
  }
  for (let i = -1; i <= 1; i += 2) {
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 3.4, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff5a3, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.position.set(i * width * 0.28, 1.8, -depth * 0.25);
    beam.rotation.z = i * 0.35;
    group.add(beam);
  }
  const note = createTextSprite('♫', { background: 'rgba(255,255,255,.0)', color: '#ffffff', accent: '#ff66c4', square: true });
  note.position.set(width * 0.28, 2.75, -depth * 0.1);
  group.add(note);
  addWindows(group, width * 0.6, 1.2, depth * 0.3, 0.4, 1, building.id);
}

function createMixedUseTower(group: THREE.Group, building: Building, width: number, depth: number, height: number) {
  const glass = new THREE.MeshStandardMaterial({ color: 0x3db8ff, emissive: 0x071d55, emissiveIntensity: 0.3, roughness: 0.22, metalness: 0.28, transparent: true, opacity: 0.9 });
  const cap = new THREE.MeshStandardMaterial({ color: 0xb2ffda, emissive: 0x35ffc3, emissiveIntensity: 0.32, roughness: 0.36, metalness: 0.14 });
  const lowerH = height * 0.52;
  const midH = height * 0.3;
  const topH = height * 0.18;
  addBlock(group, width * 0.72, lowerH, depth * 0.72, 0, lowerH / 2, 0, glass);
  addBlock(group, width * 0.58, midH, depth * 0.58, width * 0.04, lowerH + midH / 2, -depth * 0.03, glass.clone());
  addBlock(group, width * 0.44, topH, depth * 0.44, -width * 0.02, lowerH + midH + topH / 2, 0.02, cap);
  addWindows(group, width * 0.72, lowerH - 0.2, depth * 0.72, 0.12, Math.floor(lowerH), `${building.id}:a`);
  addWindows(group, width * 0.58, midH - 0.2, depth * 0.58, lowerH, Math.floor(midH), `${building.id}:b`);
  addWindows(group, width * 0.44, topH - 0.1, depth * 0.44, lowerH + midH, Math.floor(topH), `${building.id}:c`);
  const sign = createTextSprite('MOLT', { background: 'rgba(255,255,255,.82)', color: '#19224f', accent: '#35ffc3' });
  sign.position.set(0, lowerH + midH * 0.45, -depth * 0.39);
  sign.scale.multiplyScalar(0.54);
  group.add(sign);
  addAntenna(group, 0, height + 0.18, 0, 0x35ffc3);
}

function createGenericBuilding(group: THREE.Group, building: Building, width: number, depth: number, height: number) {
  const material = new THREE.MeshStandardMaterial({ color: 0x928bff, roughness: 0.52, metalness: 0.12 });
  addBlock(group, width * 0.72, height, depth * 0.72, 0, height / 2, 0, material);
  addWindows(group, width * 0.72, height - 0.2, depth * 0.72, 0.12, Math.floor(height), building.id);
}

function addConstructionOverlay(group: THREE.Group, width: number, depth: number, height: number) {
  const scaffoldMat = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.48, metalness: 0.38 });
  for (const x of [-width * 0.42, width * 0.42]) {
    for (const z of [-depth * 0.42, depth * 0.42]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, height + 0.7, 8), scaffoldMat.clone());
      post.position.set(x, (height + 0.7) / 2, z);
      post.castShadow = true;
      group.add(post);
    }
  }
  const crane = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.18, height + 2.8, 0.18), scaffoldMat.clone());
  mast.position.set(width * 0.58, (height + 2.8) / 2, depth * 0.42);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(width * 1.2, 0.16, 0.16), scaffoldMat.clone());
  arm.position.set(width * 0.14, height + 2.7, depth * 0.42);
  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.2, 0.035), new THREE.MeshStandardMaterial({ color: 0x37384c, roughness: 0.3, metalness: 0.5 }));
  cable.position.set(-width * 0.22, height + 2.05, depth * 0.42);
  crane.add(mast, arm, cable);
  group.add(crane);
}

function addBlock(group: THREE.Group, width: number, height: number, depth: number, x: number, y: number, z: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addWindows(group: THREE.Group, width: number, height: number, depth: number, baseY: number, rowsHint: number, seed: string) {
  const litMaterial = new THREE.MeshStandardMaterial({ color: 0xeaffff, emissive: 0x77ffeb, emissiveIntensity: 1.35, roughness: 0.32 });
  const dimMaterial = new THREE.MeshStandardMaterial({ color: 0x31516f, emissive: 0x274867, emissiveIntensity: 0.22, roughness: 0.42 });
  const rows = Math.max(1, Math.min(16, rowsHint || Math.floor(height / 0.9)));
  const colsFront = Math.max(2, Math.floor(width / 0.72));
  const colsSide = Math.max(2, Math.floor(depth / 0.75));
  const windowGeo = new THREE.PlaneGeometry(0.3, 0.38);

  for (let row = 0; row < rows; row += 1) {
    const y = baseY + 0.52 + (row + 0.5) * Math.max(0.46, (height - 0.66) / rows);
    for (let col = 0; col < colsFront; col += 1) {
      const x = -width * 0.38 + (col / Math.max(1, colsFront - 1)) * width * 0.76;
      const lit = seededChance(seed, row * 31 + col) > 0.34;
      const pane = new THREE.Mesh(windowGeo.clone(), lit ? litMaterial : dimMaterial);
      pane.position.set(x, y, depth / 2 + 0.012);
      group.add(pane);
    }
    for (let col = 0; col < colsSide; col += 1) {
      const z = -depth * 0.33 + (col / Math.max(1, colsSide - 1)) * depth * 0.66;
      const lit = seededChance(`${seed}:side`, row * 37 + col) > 0.42;
      const pane = new THREE.Mesh(windowGeo.clone(), lit ? litMaterial : dimMaterial);
      pane.rotation.y = Math.PI / 2;
      pane.position.set(width / 2 + 0.012, y, z);
      group.add(pane);
    }
  }
}

function addDoor(group: THREE.Group, x: number, y: number, z: number, width: number, height: number, color: number) {
  const door = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.12 }));
  door.position.set(x, y, z - 0.012);
  group.add(door);
}

function addNeonStrip(group: THREE.Group, x: number, y: number, z: number, width: number, color: number) {
  const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.09, 0.06), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 0.28 }));
  strip.position.set(x, y, z);
  group.add(strip);
}

function addAntenna(group: THREE.Group, x: number, y: number, z: number, color: number) {
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.25, 8), new THREE.MeshStandardMaterial({ color: 0x24304f, roughness: 0.42, metalness: 0.6 }));
  mast.position.set(x, y + 0.58, z);
  group.add(mast);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 8), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6 }));
  bulb.position.set(x, y + 1.25, z);
  group.add(bulb);
}

function addRooftopGarden(group: THREE.Group, width: number, depth: number, height: number) {
  const garden = new THREE.Mesh(new THREE.BoxGeometry(width * 0.54, 0.18, depth * 0.46), new THREE.MeshStandardMaterial({ color: 0x58d274, roughness: 0.85 }));
  garden.position.set(width * 0.06, height + 0.14, depth * 0.02);
  garden.receiveShadow = true;
  group.add(garden);
  for (let i = 0; i < 4; i += 1) {
    const tree = createTree(0.3);
    tree.position.set(-width * 0.18 + i * width * 0.11, height + 0.28, depth * 0.12 * (i % 2 ? 1 : -1));
    group.add(tree);
  }
}

function addPatioSet(group: THREE.Group, x: number, z: number) {
  const tableMat = new THREE.MeshStandardMaterial({ color: 0xfff6d6, roughness: 0.5 });
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 20), tableMat);
  table.position.set(x, 0.48, z);
  group.add(table);
  const umbrella = new THREE.Mesh(new THREE.ConeGeometry(0.54, 0.28, 24), new THREE.MeshStandardMaterial({ color: 0xff66a5, roughness: 0.55 }));
  umbrella.position.set(x, 0.86, z);
  group.add(umbrella);
}

function createTree(scale = 1) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.13 * scale, 0.7 * scale, 8), new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.82 }));
  trunk.position.y = 0.35 * scale;
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.56 * scale, 1.12 * scale, 12), new THREE.MeshStandardMaterial({ color: 0x22a861, roughness: 0.86 }));
  crown.position.y = 1.08 * scale;
  trunk.castShadow = true;
  crown.castShadow = true;
  group.add(trunk, crown);
  return group;
}

function createSteamPuff(scale: number) {
  const sprite = createCircleSprite('rgba(255,255,255,.68)');
  sprite.scale.set(scale, scale * 0.76, scale);
  return sprite;
}

function createPony() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
  const maneMat = new THREE.MeshStandardMaterial({ color: 0xff66c4, emissive: 0xff66c4, emissiveIntensity: 0.22, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 12), bodyMat);
  body.scale.set(1.45, 0.74, 0.72);
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 10), bodyMat);
  head.position.set(0.52, 0.27, 0.02);
  head.castShadow = true;
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.32, 12), new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffd166, emissiveIntensity: 0.4 }));
  horn.position.set(0.62, 0.54, 0.02);
  const mane = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), maneMat);
  mane.scale.set(0.5, 1.4, 0.45);
  mane.position.set(0.32, 0.34, 0.05);
  group.add(body, head, horn, mane);
  return group;
}

function createNpcModel(npc: Npc) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: moodColors[npc.mood], roughness: 0.52, metalness: 0.05 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.42, 5, 10), bodyMat);
  body.name = 'npc-body';
  body.position.y = 0.46;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), new THREE.MeshStandardMaterial({ color: 0xffd4a8, roughness: 0.58 }));
  head.position.y = 0.88;
  head.castShadow = true;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.28, 18), new THREE.MeshBasicMaterial({ color: 0x102033, transparent: true, opacity: 0.2, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow, body, head);
  return group;
}

function findNpcBodyMaterial(group: THREE.Group) {
  const object = group.getObjectByName('npc-body') as THREE.Mesh | undefined;
  const material = object?.material;
  return material instanceof THREE.MeshStandardMaterial ? material : undefined;
}

function activityIcon(npc: Npc) {
  if (npc.activity === 'concert') return '♪';
  if (npc.activity === 'rally') return '★';
  if (npc.activity === 'protesting' || npc.activity === 'striking') return '!';
  if (npc.activity === 'shopping') return '$';
  if (npc.activity === 'working') return '•';
  if (npc.activity === 'commuting') return '→';
  return '';
}

function createCar(color: number) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.34, 0.56), new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.22 }));
  body.position.y = 0.28;
  body.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.26, 0.42), new THREE.MeshStandardMaterial({ color: 0xdff9ff, emissive: 0x89e8ff, emissiveIntensity: 0.2, roughness: 0.15, metalness: 0.08 }));
  cabin.position.set(-0.05, 0.56, 0);
  cabin.castShadow = true;
  const lights = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.4), new THREE.MeshStandardMaterial({ color: 0xfff3a3, emissive: 0xfff3a3, emissiveIntensity: 1 }));
  lights.position.set(0.56, 0.3, 0);
  group.add(body, cabin, lights);
  return group;
}

function updateTrafficActor(actor: TrafficActor, elapsed: number) {
  const u = (elapsed * actor.speed + actor.phase) % 1;
  const t = actor.direction === 1 ? u : 1 - u;
  if (actor.axis === 'x') {
    actor.group.position.set(actor.min + (actor.max - actor.min) * t, 0.18, actor.fixed + actor.laneOffset);
    actor.group.rotation.y = actor.direction === 1 ? 0 : Math.PI;
  } else {
    actor.group.position.set(actor.fixed + actor.laneOffset, 0.18, actor.min + (actor.max - actor.min) * t);
    actor.group.rotation.y = actor.direction === 1 ? -Math.PI / 2 : Math.PI / 2;
  }
}

function createBoat(color: number) {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.34, 0.72), new THREE.MeshStandardMaterial({ color, roughness: 0.46, metalness: 0.08 }));
  hull.position.y = 0.18;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.46, 0.52), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32 }));
  cabin.position.set(-0.25, 0.58, 0);
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.38), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide }));
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(-1.4, 0.02, 0);
  group.add(hull, cabin, wake);
  return group;
}

function createCloudSprite(scale: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(96, 58, 8, 96, 58, 94);
    gradient.addColorStop(0, 'rgba(255,255,255,.94)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(84, 72, 58, 28, 0, 0, Math.PI * 2);
    ctx.ellipse(126, 58, 48, 34, 0, 0, Math.PI * 2);
    ctx.ellipse(168, 72, 55, 26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.68, depthWrite: false }));
  sprite.scale.set(13 * scale, 6.5 * scale, 1);
  return sprite;
}

function createCircleSprite(color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(48, 48, 4, 48, 48, 46);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 96, 96);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
}

function createTextSprite(text: string, options: { background: string; color: string; accent: string; square?: boolean }) {
  const canvas = document.createElement('canvas');
  const width = options.square ? 128 : 512;
  const height = options.square ? 128 : 150;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, width, height);
    const radius = options.square ? 58 : 42;
    drawRoundedRect(ctx, 10, 10, width - 20, height - 20, radius, options.background);
    ctx.strokeStyle = options.accent;
    ctx.lineWidth = options.square ? 8 : 6;
    ctx.stroke();
    ctx.fillStyle = options.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = options.square ? '900 70px Inter, system-ui, sans-serif' : '900 46px Inter, system-ui, sans-serif';
    ctx.fillText(text, width / 2, height / 2 + (options.square ? 1 : 3), width - 42);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(options.square ? 1.25 : 5.1, options.square ? 1.25 : 1.5, 1);
  return sprite;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function createTerrainTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#82d56e');
    gradient.addColorStop(0.45, '#44bb68');
    gradient.addColorStop(1, '#27955a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    ctx.globalAlpha = 0.14;
    for (let i = 0; i < 720; i += 1) {
      const x = (i * 37) % 512;
      const y = (i * 91) % 512;
      ctx.fillStyle = i % 3 ? '#e8ffdc' : '#167947';
      ctx.fillRect(x, y, 1 + (i % 2), 1 + (i % 3));
    }
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#eaffdd';
    for (let i = -512; i < 900; i += 52) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 512, 512);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2.5);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createWaterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(0x064fae) },
      uColorB: { value: new THREE.Color(0x17b9d6) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        vUv = uv;
        vec3 p = position;
        float wave = sin(p.x * 0.26 + uTime * 1.15) * 0.16 + sin(p.y * 0.41 - uTime * 1.45) * 0.08;
        p.z += wave;
        vWave = wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        float stripes = smoothstep(0.96, 1.0, sin((vUv.y + vUv.x * 0.22) * 78.0 - uTime * 2.6));
        float glint = smoothstep(0.74, 1.0, sin(vUv.x * 18.0 + uTime) * sin(vUv.y * 26.0 - uTime * 0.7));
        vec3 color = mix(uColorA, uColorB, vUv.x * 0.72 + 0.18 + vWave * 0.4);
        color += vec3(0.28, 0.62, 0.78) * stripes * 0.26;
        color += vec3(0.96, 0.9, 0.54) * glint * 0.09;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}

function createSparkleCloud(center: THREE.Vector3, color: number, count = 90, radius = 8) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const angle = hashFloat(`sparkle:${i}`) * Math.PI * 2;
    const r = Math.sqrt(hashFloat(`sparkle-r:${i}`)) * radius;
    positions[i * 3] = center.x + Math.cos(angle) * r;
    positions[i * 3 + 1] = center.y + hashFloat(`sparkle-y:${i}`) * radius * 0.45;
    positions[i * 3 + 2] = center.z + Math.sin(angle) * r * 0.72;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size: 0.13, transparent: true, opacity: 0.62, depthWrite: false }));
  return points;
}

function createRainbowBurst(center: THREE.Vector3, scale = 1) {
  const group = new THREE.Group();
  group.position.copy(center);
  const colors = [0xff4d80, 0xffd166, 0x66e084, 0x4cc9f0, 0x9b5cff];
  for (let index = 0; index < colors.length; index += 1) {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry((2.2 + index * 0.17) * scale, 0.055 * scale, 8, 56, Math.PI),
      new THREE.MeshStandardMaterial({ color: colors[index] ?? 0xffffff, emissive: colors[index] ?? 0xffffff, emissiveIntensity: 0.62, transparent: true, opacity: 0.86 }),
    );
    arc.position.y = index * 0.08 * scale;
    group.add(arc);
  }
  group.add(createSparkleCloud(new THREE.Vector3(0, 0.2, 0), 0xffffff, 90, 3.6 * scale));
  return group;
}

function createWarningBeacon(center: THREE.Vector3) {
  const group = new THREE.Group();
  group.position.copy(center);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(2.2, 5.8, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff304f, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
  );
  cone.position.y = 1.8;
  group.add(cone);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.06, 8, 42),
    new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xff304f, emissiveIntensity: 0.9 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);
  return group;
}

function clearGroup(group: THREE.Group, dispose = false) {
  for (const child of [...group.children]) {
    group.remove(child);
    if (dispose) disposeObject(child);
  }
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry instanceof THREE.BufferGeometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else if (material instanceof THREE.Material) disposeMaterial(material);
  });
}

function disposeMaterial(material: THREE.Material) {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}

function seededChance(seed: string, index: number) {
  return hashFloat(`${seed}:${index}`);
}

function hashFloat(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function shortLabel(label: string) {
  return label.length > 22 ? `${label.slice(0, 20)}…` : label;
}

function createPreviewWorld(): WorldState {
  const districts: Lot['district'][] = ['Marina', 'Garage Hills', 'Prompt Park', 'Downtown Token Exchange', 'Research Row', 'Bayfront'];
  const zones: Lot['zone'][] = ['commercial', 'residential', 'park', 'mixed', 'industrial', 'civic'];
  const lots: Lot[] = [];
  for (let index = 0; index < 24; index += 1) {
    const district = districts[index % districts.length] ?? 'Marina';
    const zone = zones[(index + (district === 'Prompt Park' ? 2 : 0)) % zones.length] ?? 'mixed';
    lots.push({
      id: `preview_lot_${index + 1}`,
      name: `${district} Lot ${index + 1}`,
      district,
      zone,
      size: 1 + (index % 3),
      price: 650 + (index % 6) * 180,
      coordinates: { x: 8 + (index % 6) * 14, y: 18 + Math.floor(index / 6) * 18 },
      desirability: 60,
    });
  }

  const presets: Array<{ lotIndex: number; type: BuildingType; name: string; jobs: number; culture: number; compute: number; level?: number }> = [
    { lotIndex: 1, type: 'garage', name: 'Grandma GPU Garage', jobs: 3, culture: 1, compute: 1 },
    { lotIndex: 2, type: 'pony_meadow', name: 'Prompt Park Pony Meadow', jobs: 2, culture: 8, compute: 0 },
    { lotIndex: 3, type: 'mixed_use_tower', name: 'Molt Tower One', jobs: 32, culture: 5, compute: 5, level: 3 },
    { lotIndex: 5, type: 'civic_hall', name: 'Cerebral Valley City Hall', jobs: 8, culture: 5, compute: 1 },
    { lotIndex: 7, type: 'coffee_shop', name: 'Fog Latte Corner', jobs: 5, culture: 4, compute: 0 },
    { lotIndex: 8, type: 'coworking_loft', name: 'Token Exchange Lofts', jobs: 14, culture: 3, compute: 2, level: 2 },
    { lotIndex: 10, type: 'research_lab', name: 'Alignment Arcade Labs', jobs: 18, culture: 2, compute: 7, level: 2 },
    { lotIndex: 11, type: 'transit_kiosk', name: 'Bay Ferry Kiosk', jobs: 4, culture: 2, compute: 0 },
    { lotIndex: 14, type: 'concert_shell', name: 'Rainbow Amphitheater', jobs: 10, culture: 12, compute: 1 },
    { lotIndex: 16, type: 'data_center_greenhouse', name: 'Photosynthesis Compute', jobs: 14, culture: -1, compute: 20, level: 2 },
    { lotIndex: 22, type: 'model_foundry', name: 'Molten Model Foundry', jobs: 28, culture: 0, compute: 16, level: 2 },
  ];

  const buildings: Building[] = presets.flatMap((preset, index) => {
    const lot = lots[preset.lotIndex];
    if (!lot) return [];
    const building: Building = {
      id: `preview_building_${index + 1}`,
      lotId: lot.id,
      ownerId: 'city',
      type: preset.type,
      name: preset.name,
      level: preset.level ?? 1,
      jobs: preset.jobs,
      culture: preset.culture,
      compute: preset.compute,
      upkeep: 50,
      createdAt: new Date(0).toISOString(),
    };
    lot.buildingId = building.id;
    lot.ownerId = 'city';
    return [building];
  });

  const npcNames = ['Ada', 'Grace', 'Linus', 'Katherine', 'Alan', 'Radia', 'Timnit', 'Yukihiro', 'Barbara', 'Donald', 'Margaret', 'Edsger', 'Frances', 'Ken', 'Adele', 'Claude', 'Mary', 'Guido'];
  const activities: Npc['activity'][] = ['commuting', 'working', 'shopping', 'concert', 'home', 'rally'];
  const npcs: Npc[] = npcNames.map((name, index) => {
    const lot = lots[index % lots.length]!;
    return {
      id: `preview_npc_${index + 1}`,
      name,
      role: 'resident',
      happiness: 72,
      patience: 60,
      politics: index % 2 ? 'growth' : 'harmony',
      money: 120,
      income: 30,
      savings: 120,
      energy: 76,
      rentBurden: 24,
      commuteMinutes: 14,
      skills: ['research'],
      issuePriorities: ['housing', 'wages', 'culture'],
      loyalty: {},
      protestThreshold: 30,
      homeLotId: lot.id,
      activity: activities[index % activities.length] ?? 'home',
      mood: index % 6 === 0 ? 'celebrating' : index % 5 === 0 ? 'happy' : 'content',
      position: { ...lot.coordinates },
    };
  });

  return {
    cityName: 'Cerebral Valley',
    phase: 'Unicorn Rush',
    metrics: { tick: 128, population: npcs.length, happiness: 74, prosperity: 68, congestion: 21, housingPressure: 28, culture: 52, compute: 64, treasury: 25000, civicTrust: 67, pollution: 12, unemployment: 18 },
    players: [],
    npcs,
    lots,
    buildings,
    companies: [],
    policies: [],
    policyProposals: [],
    election: { cycle: 1, nextTick: 48, candidates: [] },
    events: [],
    leaderboard: [],
    availableActions: [],
  };
}
