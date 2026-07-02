import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createGagSignTexture, createSkyTexture, createTextSprite, hashFloat } from './scene/canvasArt';
import { companiesByLotDevelopment, createBuildingModel } from './scene/buildings';
import { createEnvironment } from './scene/environment';
import { createBlimp, createBoat, createCar, createDeliveryBot, createHotAirBalloon, createStreetLamp, createTree, createWorldSign, } from './scene/props';
const MAP_CENTER = { x: 43, y: 45 };
const MAP_SCALE = 0.55;
const ROAD_Y = 0.09;
const LOT_Y = 0.2;
const zoneColors = {
    residential: 0xf0a94d,
    commercial: 0x27b9e8,
    industrial: 0x7468d8,
    civic: 0xf46aa3,
    park: 0x35b85d,
    mixed: 0x54cbd2,
};
const moodColors = {
    happy: 0x20d39b,
    content: 0x47a8ff,
    sad: 0x6d7fa8,
    upset: 0xff7b54,
    rioting: 0xff304f,
    celebrating: 0xffd166,
};
export function ThreeCityScene({ world, highlightEvent }) {
    const hostRef = useRef(null);
    const rendererRef = useRef(null);
    useEffect(() => {
        const host = hostRef.current;
        if (!host)
            return undefined;
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
    return _jsx("div", { className: "threeViewport", ref: hostRef, "aria-label": "GPU-rendered 3D Cerebral Valley city" });
}
class CityRenderer {
    container;
    renderer;
    scene;
    camera;
    clock = new THREE.Clock();
    atmosphereGroup = new THREE.Group();
    cityGroup = new THREE.Group();
    trafficGroup = new THREE.Group();
    peopleGroup = new THREE.Group();
    fxGroup = new THREE.Group();
    cars = [];
    bots = [];
    boats = [];
    skyTraffic = [];
    people = new Map();
    env;
    resizeObserver;
    animationFrame = 0;
    activeFxKey = '';
    visualWorld = createPreviewWorld();
    // Animated set pieces harvested from the latest city build
    spinners = [];
    tumbleweeds = [];
    fanBlades = [];
    orbitRings = [];
    transitPods = [];
    beacons = [];
    flags = [];
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.scene.background = createSkyTexture();
        this.scene.fog = new THREE.FogExp2(0x9fd9f0, 0.0065);
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
        this.camera.position.set(46, 40, 46);
        this.camera.lookAt(new THREE.Vector3(3, 1.5, -3));
        this.camera.zoom = 1.04;
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.02;
        this.renderer.domElement.className = 'threeCanvas';
        this.container.appendChild(this.renderer.domElement);
        this.scene.add(this.atmosphereGroup, this.cityGroup, this.trafficGroup, this.peopleGroup, this.fxGroup);
        this.setupLights();
        this.env = createEnvironment(this.atmosphereGroup);
        this.setupTraffic();
        this.setWorld(undefined);
        this.resizeObserver = new ResizeObserver(this.resize);
        this.resizeObserver.observe(this.container);
        window.addEventListener('resize', this.resize);
        this.resize();
        this.animate();
    }
    setWorld(world) {
        this.visualWorld = world ?? createPreviewWorld();
        const pollution = this.visualWorld.metrics.pollution;
        this.scene.fog = new THREE.FogExp2(pollution > 42 ? 0x9eb0ba : 0x9fd9f0, 0.006 + Math.min(0.008, pollution * 0.00009));
        this.rebuildCity(this.visualWorld);
        this.syncPeople(this.visualWorld.npcs);
    }
    setHighlight(event) {
        const nextKey = event?.id ?? '';
        if (nextKey === this.activeFxKey)
            return;
        this.activeFxKey = nextKey;
        clearGroup(this.fxGroup, true);
        if (!event)
            return;
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
    resize = () => {
        const rect = this.container.getBoundingClientRect();
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));
        this.renderer.setSize(width, height, false);
        const aspect = width / height;
        const frustum = 66;
        this.camera.left = (-frustum * aspect) / 2;
        this.camera.right = (frustum * aspect) / 2;
        this.camera.top = frustum / 2;
        this.camera.bottom = -frustum / 2;
        this.camera.updateProjectionMatrix();
    };
    animate = () => {
        const elapsed = this.clock.getElapsedTime();
        const uTime = this.env.waterMaterial.uniforms.uTime;
        if (uTime)
            uTime.value = elapsed;
        for (const actor of this.people.values()) {
            actor.current.lerp(actor.target, 0.045);
            actor.group.position.copy(actor.current);
            actor.group.position.y += Math.sin(elapsed * 4.2 + actor.bobSeed) * 0.09;
            actor.group.rotation.y = Math.sin(elapsed * 1.6 + actor.bobSeed) * 0.22;
            if (actor.icon)
                actor.icon.position.y = 1.85 + Math.sin(elapsed * 3.1 + actor.bobSeed) * 0.12;
        }
        for (const car of this.cars)
            updateTrafficActor(car, elapsed, 0.16);
        for (const bot of this.bots)
            updateTrafficActor(bot, elapsed, 0.16);
        for (const boat of this.boats) {
            boat.group.position.x = boat.baseX + Math.sin(elapsed * boat.speed + boat.phase) * boat.radiusX;
            boat.group.position.z = boat.baseZ + Math.cos(elapsed * boat.speed * 0.7 + boat.phase) * boat.radiusZ;
            boat.group.position.y = 0.1 + Math.sin(elapsed * 1.7 + boat.phase) * 0.07;
            boat.group.rotation.y = -0.55 + Math.sin(elapsed * boat.speed + boat.phase) * 0.2;
            boat.group.rotation.z = Math.sin(elapsed * 1.3 + boat.phase) * 0.03;
        }
        for (const flyer of this.skyTraffic) {
            const t = elapsed * flyer.speed + flyer.phase;
            flyer.group.position.set(flyer.centerX + Math.cos(t) * flyer.radius, flyer.y + Math.sin(elapsed * 0.5 + flyer.phase) * 0.8, flyer.centerZ + Math.sin(t) * flyer.radius * 0.55);
            flyer.group.rotation.y = -t + Math.PI / 2;
        }
        for (const drift of [...this.env.clouds, ...this.env.fogBanks]) {
            const [minX, maxX] = drift.rangeX;
            drift.sprite.position.x = minX + ((elapsed * drift.speed + drift.phase) % 1) * (maxX - minX);
            drift.sprite.position.y = drift.baseY + Math.sin(elapsed * 0.34 + drift.phase * 9) * 0.7;
        }
        for (const spinner of this.spinners) {
            spinner.rotation.y = elapsed * 0.9;
            spinner.position.y += Math.sin(elapsed * 2) * 0.002;
        }
        for (const weed of this.tumbleweeds) {
            weed.position.x = weed.userData.baseX + Math.sin(elapsed * 0.7 + weed.userData.seed) * 1.1;
            weed.rotation.z = -elapsed * 2.4;
        }
        for (const blade of this.fanBlades)
            blade.rotation.y = elapsed * 6;
        for (const ring of this.orbitRings) {
            ring.rotation.z = elapsed * (0.6 + ring.userData.seed * 0.5);
        }
        for (const pod of this.transitPods) {
            pod.position.x = pod.userData.baseX + Math.sin(elapsed * 0.9 + pod.userData.seed) * 1.3;
        }
        for (const beacon of this.beacons) {
            const material = beacon.material;
            material.emissiveIntensity = 1.4 + Math.sin(elapsed * 3 + beacon.id) * 0.9;
        }
        for (const flag of this.flags)
            flag.rotation.y = Math.sin(elapsed * 2.4) * 0.4;
        for (const rotor of this.env.turbineRotors)
            rotor.rotation.x = elapsed * 1.6;
        this.fxGroup.rotation.y = Math.sin(elapsed * 0.45) * 0.018;
        this.renderer.render(this.scene, this.camera);
        this.animationFrame = requestAnimationFrame(this.animate);
    };
    setupLights() {
        const hemi = new THREE.HemisphereLight(0xd6f4ff, 0x54804f, 1.9);
        this.scene.add(hemi);
        const sun = new THREE.DirectionalLight(0xffe3ae, 4.6);
        sun.position.set(-28, 52, -32);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -55;
        sun.shadow.camera.right = 55;
        sun.shadow.camera.top = 55;
        sun.shadow.camera.bottom = -55;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 140;
        sun.shadow.bias = -0.0004;
        this.scene.add(sun);
        const rim = new THREE.DirectionalLight(0x38c4ff, 1.2);
        rim.position.set(34, 26, 26);
        this.scene.add(rim);
        const bounce = new THREE.DirectionalLight(0xffd6f2, 0.5);
        bounce.position.set(10, 8, 40);
        this.scene.add(bounce);
    }
    setupTraffic() {
        const colors = [0xff5b6e, 0xffd166, 0x4cc9f0, 0xf3f6fa, 0x95ff8a, 0xbba7ff, 0x2b3350];
        const horizontalLanes = [-19.8, -9.9, 0, 9.9, 19.8];
        const verticalLanes = [-23.1, -15.4, -7.7, 0, 7.7, 15.4];
        for (let i = 0; i < 18; i += 1) {
            const axis = i % 2 === 0 ? 'x' : 'z';
            const color = colors[i % colors.length] ?? 0xffffff;
            const group = createCar(color, i % 4 === 0);
            this.trafficGroup.add(group);
            if (axis === 'x') {
                const lane = horizontalLanes[i % horizontalLanes.length] ?? 0;
                this.cars.push({ group, axis, fixed: lane, laneOffset: i % 4 < 2 ? -0.36 : 0.36, min: -29, max: 24, speed: 0.027 + i * 0.0018, phase: i * 0.073, direction: i % 4 === 0 ? -1 : 1 });
            }
            else {
                const lane = verticalLanes[i % verticalLanes.length] ?? 0;
                this.cars.push({ group, axis, fixed: lane, laneOffset: i % 4 < 2 ? -0.34 : 0.34, min: -24, max: 24, speed: 0.024 + i * 0.0014, phase: i * 0.061, direction: i % 3 === 0 ? -1 : 1 });
            }
        }
        // Sidewalk delivery bots trundling along their own beat
        for (let i = 0; i < 5; i += 1) {
            const bot = createDeliveryBot(`bot:${i}`);
            this.trafficGroup.add(bot);
            const axis = i % 2 === 0 ? 'x' : 'z';
            const lane = axis === 'x' ? (horizontalLanes[i % horizontalLanes.length] ?? 0) + 1.05 : (verticalLanes[i % verticalLanes.length] ?? 0) + 1.05;
            this.bots.push({ group: bot, axis, fixed: lane, laneOffset: 0, min: -20, max: 18, speed: 0.008 + i * 0.0012, phase: i * 0.21, direction: i % 2 === 0 ? 1 : -1 });
        }
        // Bay traffic: sailboats, a ferry, a show-off speedboat
        const boatSpecs = [
            { kind: 'sail', accent: 0xff9fc6, baseX: 42, baseZ: -8, radiusX: 6, radiusZ: 4, speed: 0.16 },
            { kind: 'sail', accent: 0x4cc9f0, baseX: 50, baseZ: 20, radiusX: 8, radiusZ: 5, speed: 0.12 },
            { kind: 'ferry', accent: 0x2b6cb0, baseX: 56, baseZ: 2, radiusX: 14, radiusZ: 3, speed: 0.07 },
            { kind: 'speed', accent: 0xffd166, baseX: 64, baseZ: -12, radiusX: 10, radiusZ: 7, speed: 0.28 },
        ];
        boatSpecs.forEach((spec, i) => {
            const boat = createBoat(spec.kind, spec.accent);
            boat.position.set(spec.baseX, 0.1, spec.baseZ);
            this.boats.push({ group: boat, baseX: spec.baseX, baseZ: spec.baseZ, radiusX: spec.radiusX, radiusZ: spec.radiusZ, speed: spec.speed, phase: i * 1.7 });
            this.trafficGroup.add(boat);
        });
        // Sky traffic: the MOLT AIR blimp and a hot air balloon
        const blimp = createBlimp(createGagSignTexture(['MOLT AIR', 'now boarding vibes'], 'banner'));
        blimp.scale.setScalar(1.15);
        this.trafficGroup.add(blimp);
        this.skyTraffic.push({ group: blimp, centerX: -2, centerZ: -4, y: 21, radius: 24, speed: 0.05, phase: 0 });
        const balloon = createHotAirBalloon();
        balloon.scale.setScalar(0.9);
        this.trafficGroup.add(balloon);
        this.skyTraffic.push({ group: balloon, centerX: 14, centerZ: 8, y: 16, radius: 9, speed: 0.03, phase: 2.4 });
    }
    rebuildCity(world) {
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
        this.harvestAnimatedProps();
    }
    harvestAnimatedProps() {
        this.spinners = [];
        this.tumbleweeds = [];
        this.fanBlades = [];
        this.orbitRings = [];
        this.transitPods = [];
        this.beacons = [];
        this.flags = [];
        this.cityGroup.traverse((node) => {
            if (node.name === 'logo-spinner')
                this.spinners.push(node);
            else if (node.name === 'tumbleweed') {
                node.userData.baseX = node.position.x;
                node.userData.seed = hashFloat(node.uuid) * 6;
                this.tumbleweeds.push(node);
            }
            else if (node.name.startsWith('fan-blade'))
                this.fanBlades.push(node);
            else if (node.name.startsWith('orbit-ring')) {
                node.userData.seed = hashFloat(node.uuid);
                this.orbitRings.push(node);
            }
            else if (node.name === 'transit-pod') {
                node.userData.baseX = node.position.x;
                node.userData.seed = hashFloat(node.uuid) * 6;
                this.transitPods.push(node);
            }
            else if (node.name === 'beacon' && node instanceof THREE.Mesh)
                this.beacons.push(node);
            else if (node.name === 'civic-flag')
                this.flags.push(node);
        });
    }
    addRoadNetwork(lots) {
        const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x424e59, roughness: 0.85, metalness: 0.03 });
        const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0xb8c2c9, roughness: 0.9 });
        const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xfff0a6, emissive: 0xffd166, emissiveIntensity: 0.3, roughness: 0.5 });
        const crosswalkMaterial = new THREE.MeshStandardMaterial({ color: 0xfafcff, roughness: 0.65 });
        const xs = uniqueSorted(lots.map((lot) => gridToWorld(lot.coordinates).x));
        const zs = uniqueSorted(lots.map((lot) => gridToWorld(lot.coordinates).z));
        if (xs.length === 0 || zs.length === 0)
            return;
        const minX = (xs[0] ?? -20) - 8;
        const maxX = (xs[xs.length - 1] ?? 20) + 6;
        const minZ = (zs[0] ?? -16) - 6;
        const maxZ = (zs[zs.length - 1] ?? 16) + 6;
        const xRoads = betweenAndEdges(xs, 4.2);
        const zRoads = betweenAndEdges(zs, 5.1);
        for (const z of zRoads) {
            const road = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, 0.12, 1.64), roadMaterial);
            road.position.set((minX + maxX) / 2, ROAD_Y, z);
            road.receiveShadow = true;
            this.cityGroup.add(road);
            for (const side of [-1.06, 1.06]) {
                const walk = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, 0.13, 0.42), sidewalkMaterial);
                walk.position.set((minX + maxX) / 2, ROAD_Y, z + side);
                walk.receiveShadow = true;
                this.cityGroup.add(walk);
            }
            addDashes(this.cityGroup, 'x', z, minX, maxX, lineMaterial);
        }
        for (const x of xRoads) {
            const road = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.13, maxZ - minZ), roadMaterial);
            road.position.set(x, ROAD_Y + 0.005, (minZ + maxZ) / 2);
            road.receiveShadow = true;
            this.cityGroup.add(road);
            addDashes(this.cityGroup, 'z', x, minZ, maxZ, lineMaterial);
        }
        let lampToggle = 0;
        for (const x of xRoads) {
            for (const z of zRoads) {
                if (Math.abs(x) > 27 || Math.abs(z) > 24)
                    continue;
                for (let stripe = -1; stripe <= 1; stripe += 1) {
                    const walk = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 1.32), crosswalkMaterial);
                    walk.position.set(x + stripe * 0.36, ROAD_Y + 0.095, z);
                    this.cityGroup.add(walk);
                }
                lampToggle += 1;
                if (lampToggle % 3 === 0) {
                    const lamp = createStreetLamp();
                    lamp.position.set(x + 1.1, ROAD_Y, z + 1.1);
                    this.cityGroup.add(lamp);
                }
            }
        }
    }
    addLot(lot, building, company, tick) {
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
        const bevel = new THREE.LineSegments(new THREE.EdgesGeometry(tile.geometry), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42 }));
        bevel.position.copy(tile.position);
        group.add(bevel);
        addLotSurfaceDetails(group, lot, width, depth);
        if (building) {
            const model = createBuildingModel(building, lot, company, tick, width, depth);
            model.position.y = LOT_Y + 0.19;
            group.add(model);
        }
        else {
            addEmptyLotModel(group, lot, width, depth);
        }
        if (lot.ownerId && lot.ownerId !== 'city') {
            group.add(createOwnershipGlow(width, depth));
        }
        this.cityGroup.add(group);
    }
    addDistrictLabels(lots) {
        const byDistrict = new Map();
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
    addMetricBadges(world) {
        if (world.metrics.compute > 35) {
            const glow = createSparkleCloud(new THREE.Vector3(5, 8, -2), 0x40ffe0, Math.min(160, 55 + world.metrics.compute), 24);
            this.cityGroup.add(glow);
        }
        if (world.metrics.culture > 40) {
            const rainbow = createRainbowBurst(new THREE.Vector3(-13, 4.2, 8), 0.55);
            this.cityGroup.add(rainbow);
        }
    }
    syncPeople(npcs) {
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
            }
            else {
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
            }
            else {
                actor.icon = undefined;
            }
        }
    }
}
function gridToWorld(point, lift = 0) {
    return new THREE.Vector3((point.x - MAP_CENTER.x) * MAP_SCALE, lift, (point.y - MAP_CENTER.y) * MAP_SCALE);
}
function lotWidth(lot) {
    return 5.3 + lot.size * 0.78;
}
function lotDepth(lot) {
    return 5.6 + lot.size * 0.82;
}
function uniqueSorted(values) {
    return [...new Set(values.map((value) => Number(value.toFixed(3))))].sort((a, b) => a - b);
}
function betweenAndEdges(values, edgePadding) {
    if (values.length === 0)
        return [];
    const roads = [(values[0] ?? 0) - edgePadding];
    for (let index = 0; index < values.length - 1; index += 1) {
        const current = values[index] ?? 0;
        const next = values[index + 1] ?? current;
        roads.push((current + next) / 2);
    }
    roads.push((values[values.length - 1] ?? 0) + edgePadding);
    return roads;
}
function addDashes(group, axis, fixed, min, max, material) {
    const length = max - min;
    const count = Math.max(4, Math.floor(length / 4));
    for (let index = 0; index < count; index += 1) {
        const t = (index + 0.5) / count;
        const dash = axis === 'x'
            ? new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.04, 0.08), material)
            : new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 1.38), material);
        if (axis === 'x')
            dash.position.set(min + length * t, ROAD_Y + 0.1, fixed);
        else
            dash.position.set(fixed, ROAD_Y + 0.1, min + length * t);
        group.add(dash);
    }
}
function addLotSurfaceDetails(group, lot, width, depth) {
    if (lot.zone === 'park' || lot.zone === 'residential') {
        const treeCount = lot.zone === 'park' ? 6 + lot.size : 2;
        for (let index = 0; index < treeCount; index += 1) {
            const kind = lot.zone === 'park' ? (index % 3 === 0 ? 'redwood' : 'oak') : 'oak';
            const tree = createTree(kind, 0.62 + (index % 3) * 0.12, `${lot.id}:tree:${index}`);
            tree.position.set(-width / 2 + 1.0 + ((index * 1.73) % Math.max(1, width - 2)), LOT_Y + 0.17, -depth / 2 + 0.9 + ((index * 2.31) % Math.max(1, depth - 1.8)));
            group.add(tree);
        }
    }
    if (lot.zone === 'industrial') {
        for (let index = 0; index < 3; index += 1) {
            const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, depth - 1.4, 8), new THREE.MeshStandardMaterial({ color: 0x5c6078, roughness: 0.66, metalness: 0.45 }));
            pipe.rotation.z = Math.PI / 2;
            pipe.position.set(-width / 2 + 1.1 + index * 0.45, LOT_Y + 0.4, depth / 2 - 0.8);
            pipe.castShadow = true;
            group.add(pipe);
        }
    }
    if (lot.zone === 'civic' || lot.zone === 'mixed') {
        const plaza = new THREE.Mesh(new THREE.CircleGeometry(Math.min(width, depth) * 0.22, 32), new THREE.MeshStandardMaterial({ color: 0xf7f3df, roughness: 0.74 }));
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.set(width * 0.27, LOT_Y + 0.18, -depth * 0.25);
        plaza.receiveShadow = true;
        group.add(plaza);
    }
}
function addEmptyLotModel(group, lot, width, depth) {
    const foundation = new THREE.Mesh(new THREE.BoxGeometry(width * 0.58, 0.16, depth * 0.48), new THREE.MeshStandardMaterial({ color: 0xeaf0f5, roughness: 0.8, metalness: 0.05 }));
    foundation.position.set(0, LOT_Y + 0.25, 0);
    foundation.castShadow = true;
    foundation.receiveShadow = true;
    group.add(foundation);
    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x526173, transparent: true, opacity: 0.34 });
    const lines = new THREE.Group();
    for (let index = -2; index <= 2; index += 1) {
        const lineA = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-width * 0.26, LOT_Y + 0.35, index * depth * 0.06), new THREE.Vector3(width * 0.26, LOT_Y + 0.35, index * depth * 0.06)]), gridMaterial);
        const lineB = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(index * width * 0.065, LOT_Y + 0.36, -depth * 0.22), new THREE.Vector3(index * width * 0.065, LOT_Y + 0.36, depth * 0.22)]), gridMaterial);
        lines.add(lineA, lineB);
    }
    group.add(lines);
    const sign = createWorldSign(lot.zone === 'park' ? ['PUBLIC PARK'] : ['API LOT', 'your startup here?'], lot.zone === 'park' ? 'banner' : 'cardboard', 1.35, 0.62, 0.42);
    sign.position.set(-width * 0.25, LOT_Y + 0.2, depth * 0.28);
    sign.rotation.y = 0.3;
    group.add(sign);
}
function createOwnershipGlow(width, depth) {
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(width + 0.7, depth + 0.7), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = LOT_Y + 0.185;
    return ring;
}
function createNpcModel(npc) {
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
function findNpcBodyMaterial(group) {
    const object = group.getObjectByName('npc-body');
    const material = object?.material;
    return material instanceof THREE.MeshStandardMaterial ? material : undefined;
}
function activityIcon(npc) {
    if (npc.activity === 'concert')
        return '♪';
    if (npc.activity === 'rally')
        return '★';
    if (npc.activity === 'protesting' || npc.activity === 'striking')
        return '!';
    if (npc.activity === 'shopping')
        return '$';
    if (npc.activity === 'working')
        return '•';
    if (npc.activity === 'commuting')
        return '→';
    return '';
}
function updateTrafficActor(actor, elapsed, y) {
    const u = (elapsed * actor.speed + actor.phase) % 1;
    const t = actor.direction === 1 ? u : 1 - u;
    if (actor.axis === 'x') {
        actor.group.position.set(actor.min + (actor.max - actor.min) * t, y, actor.fixed + actor.laneOffset);
        actor.group.rotation.y = actor.direction === 1 ? 0 : Math.PI;
    }
    else {
        actor.group.position.set(actor.fixed + actor.laneOffset, y, actor.min + (actor.max - actor.min) * t);
        actor.group.rotation.y = actor.direction === 1 ? -Math.PI / 2 : Math.PI / 2;
    }
}
function createSparkleCloud(center, color, count = 90, radius = 8) {
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
function createRainbowBurst(center, scale = 1) {
    const group = new THREE.Group();
    group.position.copy(center);
    const colors = [0xff4d80, 0xffd166, 0x66e084, 0x4cc9f0, 0x9b5cff];
    for (let index = 0; index < colors.length; index += 1) {
        const arc = new THREE.Mesh(new THREE.TorusGeometry((2.2 + index * 0.17) * scale, 0.055 * scale, 8, 56, Math.PI), new THREE.MeshStandardMaterial({ color: colors[index] ?? 0xffffff, emissive: colors[index] ?? 0xffffff, emissiveIntensity: 0.62, transparent: true, opacity: 0.86 }));
        arc.position.y = index * 0.08 * scale;
        group.add(arc);
    }
    group.add(createSparkleCloud(new THREE.Vector3(0, 0.2, 0), 0xffffff, 90, 3.6 * scale));
    return group;
}
function createWarningBeacon(center) {
    const group = new THREE.Group();
    group.position.copy(center);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5.8, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xff304f, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.y = 1.8;
    group.add(cone);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.06, 8, 42), new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xff304f, emissiveIntensity: 0.9 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    group.add(ring);
    return group;
}
function clearGroup(group, dispose = false) {
    for (const child of [...group.children]) {
        group.remove(child);
        if (dispose)
            disposeObject(child);
    }
}
function disposeObject(object) {
    object.traverse((node) => {
        const mesh = node;
        if (mesh.geometry instanceof THREE.BufferGeometry)
            mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material))
            material.forEach(disposeMaterial);
        else if (material instanceof THREE.Material)
            disposeMaterial(material);
    });
}
function disposeMaterial(material) {
    for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture && !value.userData.persistent)
            value.dispose();
    }
    material.dispose();
}
// ---------------------------------------------------------------------------
// Cinematic preview world shown before the API wakes up
// ---------------------------------------------------------------------------
function createPreviewWorld() {
    const districts = ['Marina', 'Garage Hills', 'Prompt Park', 'Downtown Token Exchange', 'Research Row', 'Bayfront'];
    const zones = ['commercial', 'residential', 'park', 'mixed', 'industrial', 'civic'];
    const lots = [];
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
    const presets = [
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
    const buildings = presets.flatMap((preset, index) => {
        const lot = lots[preset.lotIndex];
        if (!lot)
            return [];
        const building = {
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
    // Showcase companies so billboards + evolution stages render out of the box
    const companyPresets = [
        { lotIndex: 3, name: 'Froogle', archetype: 'search', stage: 'public-ish', valuation: 860_000, marketShare: 46, research: 5_200, cash: 240_000 },
        { lotIndex: 10, name: 'ClosedAI', archetype: 'frontier_ai', stage: 'growth', valuation: 320_000, marketShare: 22, research: 8_400, cash: 90_000 },
        { lotIndex: 8, name: 'Faceplant', archetype: 'social', stage: 'failed', valuation: 1_200, marketShare: 1, research: 120, cash: 14 },
        { lotIndex: 22, name: 'Salesfarce', archetype: 'enterprise', stage: 'series_a', valuation: 64_000, marketShare: 9, research: 900, cash: 22_000 },
        { lotIndex: 7, name: 'DoorDashund', archetype: 'local_services', stage: 'seed', valuation: 9_000, marketShare: 3, research: 80, cash: 3_200 },
        { lotIndex: 1, name: 'Coinbasement', archetype: 'finance', stage: 'garage', valuation: 1_500, marketShare: 0, research: 10, cash: 800 },
        { lotIndex: 16, name: 'Nvidiyikes', archetype: 'robotics', stage: 'growth', valuation: 280_000, marketShare: 31, research: 4_800, cash: 130_000 },
    ];
    const companies = companyPresets.flatMap((preset, index) => {
        const lot = lots[preset.lotIndex];
        const building = buildings.find((candidate) => candidate.lotId === lot?.id);
        if (!lot || !building)
            return [];
        const company = {
            id: `preview_company_${index + 1}`,
            name: preset.name,
            archetype: preset.archetype,
            ownerId: 'city',
            lotId: lot.id,
            buildingId: building.id,
            stage: preset.stage,
            valuation: preset.valuation,
            revenue: preset.valuation / 12,
            cash: preset.cash,
            employees: Math.max(1, Math.round(preset.valuation / 8_000)),
            sentiment: preset.stage === 'failed' ? 8 : 68,
            risk: preset.stage === 'failed' ? 96 : 34,
            foundedAtTick: 4,
            investors: {},
            wage: 62,
            price: 20,
            productQuality: preset.stage === 'failed' ? 12 : 70,
            marketShare: preset.marketShare,
            employeeHappiness: preset.stage === 'failed' ? 5 : 72,
            customerSatisfaction: preset.stage === 'failed' ? 10 : 66,
            computeUsage: 12,
            environmentalImpact: 8,
            legalRisk: 12,
            research: preset.research,
        };
        return [company];
    });
    const npcNames = ['Ada', 'Grace', 'Linus', 'Katherine', 'Alan', 'Radia', 'Timnit', 'Yukihiro', 'Barbara', 'Donald', 'Margaret', 'Edsger', 'Frances', 'Ken', 'Adele', 'Claude', 'Mary', 'Guido'];
    const activities = ['commuting', 'working', 'shopping', 'concert', 'home', 'rally'];
    const npcs = npcNames.map((name, index) => {
        const lot = lots[index % lots.length];
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
        companies,
        policies: [],
        policyProposals: [],
        election: { cycle: 1, nextTick: 48, candidates: [] },
        events: [],
        leaderboard: [],
        availableActions: [],
    };
}
