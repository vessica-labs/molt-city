import * as THREE from 'three';
import { createCloudSprite, createFogSprite, createTerrainTexture, hashFloat } from './canvasArt';
import { createTree } from './props';
// ---------------------------------------------------------------------------
// Water shader: depth gradient, moving swell, shore foam, sun glints
// ---------------------------------------------------------------------------
function createWaterMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uShallow: { value: new THREE.Color(0x3fc3d4) },
            uDeep: { value: new THREE.Color(0x0a4f9e) },
            uSky: { value: new THREE.Color(0xbfe8ff) },
        },
        vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        vUv = uv;
        vec3 p = position;
        float wave = sin(p.x * 0.24 + uTime * 1.1) * 0.14
                   + sin(p.y * 0.37 - uTime * 1.4) * 0.09
                   + sin((p.x + p.y) * 0.55 + uTime * 0.7) * 0.05;
        p.z += wave;
        vWave = wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
        fragmentShader: `
      uniform vec3 uShallow;
      uniform vec3 uDeep;
      uniform vec3 uSky;
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        // Shore sits at vUv.x = 0 (west edge against the seawall)
        float depth = smoothstep(0.0, 0.55, vUv.x);
        vec3 color = mix(uShallow, uDeep, depth);
        // Sky reflection band
        color = mix(color, uSky, (1.0 - depth) * 0.12 + vWave * 0.3);
        // Rolling swell stripes
        float stripes = smoothstep(0.955, 1.0, sin((vUv.y * 2.0 + vUv.x * 0.4) * 60.0 - uTime * 2.2 + vWave * 4.0));
        color += vec3(0.30, 0.55, 0.68) * stripes * 0.22;
        // Sun glitter
        float glint = smoothstep(0.78, 1.0, sin(vUv.x * 90.0 + uTime * 1.4) * sin(vUv.y * 140.0 - uTime * 0.9));
        color += vec3(1.0, 0.88, 0.55) * glint * 0.16 * depth;
        // Shore foam: bright, animated lapping bands near the seawall
        float foamZone = 1.0 - smoothstep(0.0, 0.075, vUv.x);
        float lap = sin(vUv.y * 160.0 + uTime * 2.4) * 0.5 + 0.5;
        float foam = foamZone * (0.5 + 0.5 * sin(vUv.x * 300.0 - uTime * 3.0 + lap * 3.0));
        color = mix(color, vec3(0.94, 0.99, 1.0), clamp(foam, 0.0, 1.0) * 0.75);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
        side: THREE.DoubleSide,
    });
}
// ---------------------------------------------------------------------------
// Rolling hills: displaced ribbon of terrain instead of party-hat cones
// ---------------------------------------------------------------------------
function createHillRange(width, depth, amplitude, seed) {
    const geometry = new THREE.PlaneGeometry(width, depth, 72, 14);
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i);
        const y = positions.getY(i); // plane-local: becomes -z after rotation
        const ridge = Math.sin(x * 0.11 + hashFloat(seed) * 9) * 0.55
            + Math.sin(x * 0.31 + 2.4) * 0.3
            + Math.sin(x * 0.71 + hashFloat(`${seed}:b`) * 5) * 0.15;
        const profile = Math.pow(Math.max(0, Math.cos((y / depth) * Math.PI)), 0.8);
        positions.setZ(i, Math.max(0, (0.62 + ridge) * amplitude * profile));
    }
    geometry.computeVertexNormals();
    // Vertex-color altitude bands: golden grass low, deep green high
    const colors = new Float32Array(positions.count * 3);
    const low = new THREE.Color(0x9fc25e);
    const mid = new THREE.Color(0x4f9e58);
    const high = new THREE.Color(0x2c6e48);
    for (let i = 0; i < positions.count; i += 1) {
        const h = positions.getZ(i) / amplitude;
        const color = h < 0.35 ? low.clone().lerp(mid, h / 0.35) : mid.clone().lerp(high, (h - 0.35) / 0.65);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    return mesh;
}
function createHillsideSign(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.clearRect(0, 0, 1024, 160);
        ctx.font = `900 118px 'Arial Black', system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fdfdf6';
        ctx.strokeStyle = 'rgba(30,50,40,.45)';
        ctx.lineWidth = 8;
        ctx.strokeText(text, 512, 84);
        ctx.fillText(text, 512, 84);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(17, 2.65), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }));
    return sign;
}
// ---------------------------------------------------------------------------
// Suspension bridge in international orange, obviously
// ---------------------------------------------------------------------------
function createSuspensionBridge(length) {
    const group = new THREE.Group();
    const orange = new THREE.MeshStandardMaterial({ color: 0xea5b2f, roughness: 0.5, metalness: 0.25 });
    const deckHeight = 3.2;
    const towerHeight = 9.5;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(length, 0.26, 1.7), orange);
    deck.position.y = deckHeight;
    deck.castShadow = true;
    group.add(deck);
    const roadway = new THREE.Mesh(new THREE.BoxGeometry(length, 0.06, 1.3), new THREE.MeshStandardMaterial({ color: 0x4c5560, roughness: 0.8 }));
    roadway.position.y = deckHeight + 0.16;
    group.add(roadway);
    const towerXs = [-length * 0.22, length * 0.22];
    for (const tx of towerXs) {
        for (const tz of [-0.72, 0.72]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.45, towerHeight, 0.45), orange);
            leg.position.set(tx, towerHeight / 2, tz);
            leg.castShadow = true;
            group.add(leg);
        }
        for (const beamY of [towerHeight * 0.55, towerHeight * 0.82, towerHeight]) {
            const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 1.9), orange);
            beam.position.set(tx, beamY, 0);
            group.add(beam);
        }
    }
    // Catenary main cables (sampled curve as tube)
    for (const cz of [-0.78, 0.78]) {
        const points = [];
        const anchorY = deckHeight + 0.4;
        for (let i = 0; i <= 40; i += 1) {
            const t = i / 40;
            const x = -length / 2 + t * length;
            let y;
            const t1 = towerXs[0] ?? 0;
            const t2 = towerXs[1] ?? 0;
            if (x < t1) {
                const u = (x - -length / 2) / (t1 - -length / 2);
                y = anchorY + (towerHeight - anchorY) * u * u;
            }
            else if (x < t2) {
                const u = (x - t1) / (t2 - t1);
                y = towerHeight - Math.sin(u * Math.PI) * (towerHeight - anchorY - 0.8);
            }
            else {
                const u = (x - t2) / (length / 2 - t2);
                y = towerHeight - (towerHeight - anchorY) * (1 - (1 - u) * (1 - u));
            }
            points.push(new THREE.Vector3(x, y, cz));
        }
        const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 60, 0.06, 6, false), orange.clone());
        group.add(cable);
        // Vertical hangers
        for (let i = 2; i < 39; i += 3) {
            const p = points[i];
            if (!p || p.y - deckHeight < 0.4)
                continue;
            const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, p.y - deckHeight, 4), orange.clone());
            hanger.position.set(p.x, deckHeight + (p.y - deckHeight) / 2, cz);
            group.add(hanger);
        }
    }
    return group;
}
function createWindTurbine() {
    const group = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.45 });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 4.4, 8), white);
    tower.position.y = 2.2;
    tower.castShadow = true;
    group.add(tower);
    const nacelle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.24), white.clone());
    nacelle.position.set(0.08, 4.45, 0);
    group.add(nacelle);
    const rotor = new THREE.Group();
    rotor.position.set(0.36, 4.45, 0);
    for (let i = 0; i < 3; i += 1) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.7, 0.14), white.clone());
        blade.position.y = 0.85;
        const arm = new THREE.Group();
        arm.rotation.x = (i / 3) * Math.PI * 2;
        arm.add(blade);
        rotor.add(arm);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), white.clone());
    rotor.add(hub);
    group.add(rotor);
    return { group, rotor };
}
function createBayIsland() {
    const group = new THREE.Group();
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 1), new THREE.MeshStandardMaterial({ color: 0x8f9a8a, roughness: 0.95, flatShading: true }));
    rock.scale.set(1.6, 0.5, 1);
    rock.position.y = -0.2;
    rock.castShadow = true;
    group.add(rock);
    const fortress = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.8, 0.9), new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.8 }));
    fortress.position.y = 1.1;
    fortress.castShadow = true;
    group.add(fortress);
    const lighthouse = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.3, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
    lighthouse.position.set(-1.1, 1.4, 0);
    group.add(lighthouse);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff3a3, emissive: 0xffe98a, emissiveIntensity: 2.4 }));
    beacon.name = 'beacon';
    beacon.position.set(-1.1, 2.12, 0);
    group.add(beacon);
    for (let i = 0; i < 3; i += 1) {
        const cypress = createTree('cypress', 0.8, `island:${i}`);
        cypress.position.set(0.4 + i * 0.6, 0.7, 0.5 - i * 0.3);
        group.add(cypress);
    }
    return group;
}
// ---------------------------------------------------------------------------
// Assemble the whole landscape
// ---------------------------------------------------------------------------
export function createEnvironment(group) {
    const waterMaterial = createWaterMaterial();
    const clouds = [];
    const fogBanks = [];
    const turbineRotors = [];
    // Sun with layered glow
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(5.4, 48, 24), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 }));
    sunDisc.position.set(-40, 12, -26);
    group.add(sunDisc);
    const halo = createCloudSprite(2.4);
    halo.material = halo.material.clone();
    halo.material.color = new THREE.Color(0xffedb8);
    halo.material.opacity = 0.5;
    halo.scale.set(26, 26, 1);
    halo.position.copy(sunDisc.position);
    group.add(halo);
    // City plateau
    const groundTexture = createTerrainTexture();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 57, 1, 1), new THREE.MeshStandardMaterial({ map: groundTexture, color: 0xf4ffef, roughness: 0.9, metalness: 0.02 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(-5, 0, 0);
    ground.receiveShadow = true;
    group.add(ground);
    // Layered cliff base with strata
    const base = new THREE.Mesh(new THREE.BoxGeometry(70, 1.2, 57), new THREE.MeshStandardMaterial({ color: 0x5c4a38, roughness: 0.95 }));
    base.position.set(-5, -0.76, 0);
    base.receiveShadow = true;
    group.add(base);
    const strata = new THREE.Mesh(new THREE.BoxGeometry(70.05, 0.3, 57.05), new THREE.MeshStandardMaterial({ color: 0x8a6f52, roughness: 0.9 }));
    strata.position.set(-5, -0.32, 0);
    group.add(strata);
    // Water
    const water = new THREE.Mesh(new THREE.PlaneGeometry(48, 96, 140, 140), waterMaterial);
    water.rotation.x = -Math.PI / 2; // uv.x runs west→east so foam hugs the shore
    water.position.set(55.5, -0.16, 0);
    group.add(water);
    // Sand beach strip + seawall
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 57, 1, 8), new THREE.MeshStandardMaterial({ color: 0xf0dfb0, roughness: 0.95 }));
    beach.rotation.x = -Math.PI / 2;
    beach.position.set(31.4, -0.05, 0);
    group.add(beach);
    const seawall = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.48, 58), new THREE.MeshStandardMaterial({ color: 0xb5c2c8, roughness: 0.72, metalness: 0.08 }));
    seawall.position.set(30.2, 0.12, 0);
    seawall.castShadow = true;
    seawall.receiveShadow = true;
    group.add(seawall);
    // Palm-lined waterfront promenade
    for (let i = 0; i < 9; i += 1) {
        const palm = createTree('palm', 1.15 + hashFloat(`palm:${i}`) * 0.3, `palm:${i}`);
        palm.position.set(29.2, 0.02, -24 + i * 6);
        palm.rotation.y = hashFloat(`palmrot:${i}`) * Math.PI * 2;
        group.add(palm);
    }
    // Rolling hill ranges behind the city
    const backHills = createHillRange(105, 24, 8.5, 'back');
    backHills.position.set(-12, 0, -40);
    group.add(backHills);
    const farHills = createHillRange(130, 26, 12, 'far');
    const farMaterial = farHills.material;
    farMaterial.vertexColors = false;
    farMaterial.color = new THREE.Color(0x6f9c86);
    farHills.position.set(0, -0.4, -52);
    group.add(farHills);
    const westHills = createHillRange(60, 18, 6, 'west');
    westHills.rotation.z = Math.PI / 2;
    westHills.position.set(-44, 0, -6);
    group.add(westHills);
    // Redwood groves scattered on the near hills
    for (let i = 0; i < 34; i += 1) {
        const t = hashFloat(`grove:${i}`);
        const x = -54 + t * 84;
        const z = -33 - hashFloat(`grovez:${i}`) * 9;
        const y = 0.4 + hashFloat(`grovey:${i}`) * 3.4;
        const redwood = createTree('redwood', 0.9 + hashFloat(`groves:${i}`) * 0.8, `grove:${i}`);
        redwood.position.set(x, y, z);
        group.add(redwood);
    }
    // The obligatory hillside sign
    const sign = createHillsideSign('CEREBRAL VALLEY');
    sign.position.set(-29.5, 2.6, -16.5);
    sign.rotation.y = 0.55;
    sign.scale.setScalar(0.78);
    group.add(sign);
    // Suspension bridge across the bay
    const bridge = createSuspensionBridge(46);
    bridge.rotation.y = Math.PI / 2;
    bridge.position.set(46, 0, 6);
    group.add(bridge);
    // Demo Day Island (maximum security pitch environment)
    const island = createBayIsland();
    island.position.set(53, 0.1, 24);
    group.add(island);
    // Karl the Fog Jr., rolling over the bridge on schedule
    for (let i = 0; i < 3; i += 1) {
        const fog = createFogSprite(1.1 + i * 0.35);
        fog.position.set(40 + i * 8, 5 + i * 1.4, 2 + i * 7);
        fogBanks.push({ sprite: fog, baseY: fog.position.y, speed: 0.008 + i * 0.004, phase: i * 0.37, rangeX: [36, 64] });
        group.add(fog);
    }
    // Wind farm on the western flats (the compute has to come from somewhere)
    for (let i = 0; i < 4; i += 1) {
        const { group: turbine, rotor } = createWindTurbine();
        turbine.position.set(-36 + hashFloat(`turb:${i}`) * 5, 0, -12 + i * 6.5);
        turbine.rotation.y = 0.7;
        turbine.scale.setScalar(0.9 + hashFloat(`turbs:${i}`) * 0.3);
        turbineRotors.push(rotor);
        group.add(turbine);
    }
    // Heritage orchard rows between the turbines and town
    for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 6; col += 1) {
            const orchardTree = createTree('oak', 0.5 + hashFloat(`orch:${row}:${col}`) * 0.2, `orch:${row}:${col}`);
            orchardTree.position.set(-33.5 + row * 2.3, 0.02, 2 + col * 2.1 + (row % 2) * 0.9);
            group.add(orchardTree);
        }
    }
    // Clouds
    for (let i = 0; i < 8; i += 1) {
        const cloud = createCloudSprite(0.55 + (i % 3) * 0.16);
        cloud.position.set(-30 + i * 11, 23 + (i % 3) * 4, -20 - i * 2.2);
        clouds.push({ sprite: cloud, baseY: cloud.position.y, speed: 0.005 + i * 0.0014, phase: i * 0.19, rangeX: [-38, 46] });
        group.add(cloud);
    }
    return { waterMaterial, clouds, fogBanks, turbineRotors };
}
