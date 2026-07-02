import * as THREE from 'three';
import { createCircleSprite, createGagSignTexture, hashFloat } from './canvasArt';

// ---------------------------------------------------------------------------
// Vegetation
// ---------------------------------------------------------------------------

export type TreeKind = 'oak' | 'redwood' | 'palm' | 'cypress';

const barkMaterial = new THREE.MeshStandardMaterial({ color: 0x7a5236, roughness: 0.9 });
const palmBarkMaterial = new THREE.MeshStandardMaterial({ color: 0xa9825a, roughness: 0.88 });

export function createTree(kind: TreeKind, scale = 1, seed = 'tree'): THREE.Group {
  const group = new THREE.Group();
  const jitter = hashFloat(seed);

  if (kind === 'redwood') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.16 * scale, 1.5 * scale, 7), barkMaterial);
    trunk.position.y = 0.75 * scale;
    trunk.castShadow = true;
    group.add(trunk);
    const tones = [0x1c6b45, 0x25804f, 0x2f9257];
    for (let tier = 0; tier < 4; tier += 1) {
      const radius = (0.72 - tier * 0.14) * scale;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(radius, 0.85 * scale, 8),
        new THREE.MeshStandardMaterial({ color: tones[tier % tones.length] ?? 0x25804f, roughness: 0.85, flatShading: true }),
      );
      cone.position.y = (1.1 + tier * 0.55) * scale;
      cone.rotation.y = jitter * 3 + tier * 0.4;
      cone.castShadow = true;
      group.add(cone);
    }
  } else if (kind === 'palm') {
    const lean = (jitter - 0.5) * 0.4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.1 * scale, 1.5 * scale, 7), palmBarkMaterial);
    trunk.position.y = 0.75 * scale;
    trunk.rotation.z = lean;
    trunk.castShadow = true;
    group.add(trunk);
    const topX = -Math.sin(lean) * 1.5 * scale * 0.5;
    const frondMaterial = new THREE.MeshStandardMaterial({ color: 0x2fae5b, roughness: 0.75, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i += 1) {
      const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.9 * scale, 0.22 * scale, 4, 1), frondMaterial);
      const geo = frond.geometry;
      const positions = geo.getAttribute('position');
      for (let v = 0; v < positions.count; v += 1) {
        const x = positions.getX(v);
        positions.setY(v, -Math.pow(Math.abs(x / (0.45 * scale)), 1.6) * 0.28 * scale);
      }
      geo.computeVertexNormals();
      frond.position.set(topX, 1.52 * scale, 0);
      frond.rotation.y = (i / 6) * Math.PI * 2 + jitter;
      frond.rotation.z = 0.12;
      frond.position.x += Math.cos(frond.rotation.y) * 0.34 * scale;
      frond.position.z -= Math.sin(frond.rotation.y) * 0.34 * scale;
      group.add(frond);
    }
    const coconut = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 8, 6), barkMaterial);
    coconut.position.set(topX, 1.44 * scale, 0.08 * scale);
    group.add(coconut);
  } else if (kind === 'cypress') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.09 * scale, 0.5 * scale, 6), barkMaterial);
    trunk.position.y = 0.25 * scale;
    group.add(trunk);
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.34 * scale, 8, 10),
      new THREE.MeshStandardMaterial({ color: 0x2c7a4b, roughness: 0.85, flatShading: true }),
    );
    body.scale.set(1, 2.6, 1);
    body.position.y = 1.1 * scale;
    body.castShadow = true;
    group.add(body);
  } else {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * scale, 0.14 * scale, 0.72 * scale, 7), barkMaterial);
    trunk.position.y = 0.36 * scale;
    trunk.castShadow = true;
    group.add(trunk);
    const tones = [0x2f9e52, 0x47b45e, 0x63c56a];
    for (let i = 0; i < 3; i += 1) {
      const blob = new THREE.Mesh(
        new THREE.IcosahedronGeometry((0.4 - i * 0.06) * scale, 1),
        new THREE.MeshStandardMaterial({ color: tones[i] ?? 0x47b45e, roughness: 0.86, flatShading: true }),
      );
      const angle = jitter * 6 + i * 2.2;
      blob.position.set(Math.cos(angle) * 0.18 * scale, (0.86 + i * 0.22) * scale, Math.sin(angle) * 0.18 * scale);
      blob.castShadow = true;
      group.add(blob);
    }
  }
  return group;
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

const wheelGeometry = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12);
const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1e28, roughness: 0.85 });
const hubMaterial = new THREE.MeshStandardMaterial({ color: 0xd7dde6, roughness: 0.3, metalness: 0.7 });

function addWheels(group: THREE.Group, length: number, width: number) {
  for (const dx of [-length * 0.32, length * 0.32]) {
    for (const dz of [-width / 2, width / 2]) {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(dx, 0.11, dz);
      group.add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.09, 8), hubMaterial);
      hub.rotation.x = Math.PI / 2;
      hub.position.copy(wheel.position);
      group.add(hub);
    }
  }
}

export function createCar(color: number, robotaxi = false): THREE.Group {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfeaff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.24, 0.56), paint);
  body.position.y = 0.26;
  body.castShadow = true;
  group.add(body);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.5), paint);
  hood.position.set(0.38, 0.4, 0);
  group.add(hood);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.24, 0.48), glassMat);
  cabin.position.set(-0.08, 0.48, 0);
  cabin.castShadow = true;
  group.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.52), paint);
  roof.position.set(-0.08, 0.62, 0);
  group.add(roof);

  addWheels(group, 1.08, 0.6);

  const headlights = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.4), new THREE.MeshStandardMaterial({ color: 0xfff3a3, emissive: 0xfff3a3, emissiveIntensity: 1.2 }));
  headlights.position.set(0.56, 0.28, 0);
  group.add(headlights);
  const taillights = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.4), new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 0.9 }));
  taillights.position.set(-0.55, 0.28, 0);
  group.add(taillights);

  if (robotaxi) {
    const rig = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0x21263a, roughness: 0.4, metalness: 0.5 }));
    rig.position.set(-0.08, 0.7, 0);
    group.add(rig);
    const lidar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.09, 12), new THREE.MeshStandardMaterial({ color: 0x66fff0, emissive: 0x35e8d8, emissiveIntensity: 1.4, roughness: 0.2 }));
    lidar.name = 'lidar';
    lidar.position.set(-0.08, 0.79, 0);
    group.add(lidar);
  }
  return group;
}

export function createDeliveryBot(seed: string): THREE.Group {
  const group = new THREE.Group();
  const shellColor = hashFloat(seed) > 0.5 ? 0xf7f9fc : 0xffd9e8;
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.26, 0.24),
    new THREE.MeshStandardMaterial({ color: shellColor, roughness: 0.4, metalness: 0.1 }),
  );
  shell.position.y = 0.24;
  shell.castShadow = true;
  group.add(shell);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.2), new THREE.MeshStandardMaterial({ color: 0xff7846, roughness: 0.5 }));
  lid.position.y = 0.395;
  group.add(lid);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.14), new THREE.MeshStandardMaterial({ color: 0x1c2140, emissive: 0x53f2ff, emissiveIntensity: 1 }));
  eye.position.set(0.175, 0.27, 0);
  group.add(eye);
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.38, 5), new THREE.MeshStandardMaterial({ color: 0x8a93a6 }));
  flagPole.position.set(-0.14, 0.55, 0);
  group.add(flagPole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), new THREE.MeshBasicMaterial({ color: 0xff5a1f, side: THREE.DoubleSide }));
  flag.position.set(-0.08, 0.68, 0);
  group.add(flag);
  for (const dx of [-0.1, 0.1]) {
    for (const dz of [-0.13, 0.13]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10), wheelMaterial);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(dx, 0.06, dz);
      group.add(wheel);
    }
  }
  return group;
}

export function createBoat(kind: 'sail' | 'ferry' | 'speed', accent: number): THREE.Group {
  const group = new THREE.Group();
  if (kind === 'sail') {
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.2, 1.9, 6), new THREE.MeshStandardMaterial({ color: 0xfffdf4, roughness: 0.5 }));
    hull.rotation.z = Math.PI / 2;
    hull.scale.set(1, 1, 0.42);
    hull.position.y = 0.12;
    hull.castShadow = true;
    group.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.9, 6), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.7 }));
    mast.position.y = 1.05;
    group.add(mast);
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0);
    sailShape.lineTo(0, 1.6);
    sailShape.quadraticCurveTo(0.85, 0.8, 0.95, 0);
    sailShape.lineTo(0, 0);
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide }));
    sail.position.set(0.04, 0.34, 0);
    group.add(sail);
    const jib = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6, side: THREE.DoubleSide }));
    jib.scale.set(-0.6, 0.72, 1);
    jib.position.set(-0.04, 0.34, 0);
    group.add(jib);
  } else if (kind === 'ferry') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.34, 0.9), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }));
    hull.position.y = 0.2;
    hull.castShadow = true;
    group.add(hull);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.32, 0.74), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }));
    deck.position.y = 0.52;
    group.add(deck);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.28, 0.6), new THREE.MeshStandardMaterial({ color: 0xf3f7fb, roughness: 0.4 }));
    cabin.position.y = 0.8;
    group.add(cabin);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x22304f, roughness: 0.5 }));
    stack.position.set(-0.5, 1.06, 0);
    group.add(stack);
  } else {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.5), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.3, metalness: 0.3 }));
    hull.position.y = 0.14;
    group.add(hull);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.44), new THREE.MeshStandardMaterial({ color: 0xbfeaff, roughness: 0.1, transparent: true, opacity: 0.8 }));
    screen.position.set(0.2, 0.32, 0);
    group.add(screen);
  }
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(-1.5, 0.02, 0);
  group.add(wake);
  return group;
}

export function createBlimp(texture: THREE.CanvasTexture): THREE.Group {
  const group = new THREE.Group();
  const envelope = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xf2f6ff, roughness: 0.5, metalness: 0.05 }),
  );
  envelope.scale.set(2.1, 0.85, 0.85);
  envelope.castShadow = true;
  group.add(envelope);
  for (const side of [1, -1]) {
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 1.05),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }),
    );
    banner.position.set(0, -0.1, side * 1.42);
    banner.rotation.y = side > 0 ? 0 : Math.PI;
    group.add(banner);
  }
  const gondola = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.32, 0.4), new THREE.MeshStandardMaterial({ color: 0x2b3350, roughness: 0.5 }));
  gondola.position.y = -1.42;
  group.add(gondola);
  for (const angle of [0.5, -0.5]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.7), new THREE.MeshStandardMaterial({ color: 0xff5b6e, roughness: 0.5 }));
    fin.position.set(-3.1, 0, 0);
    fin.rotation.x = angle * Math.PI * 0.5;
    group.add(fin);
  }
  return group;
}

export function createHotAirBalloon(): THREE.Group {
  const group = new THREE.Group();
  const stripes = [0xff4d80, 0xffd166, 0x4cc9f0, 0x66e084];
  for (let i = 0; i < 4; i += 1) {
    const slice = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 20, 14, (i / 4) * Math.PI * 2, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: stripes[i] ?? 0xff4d80, roughness: 0.6 }),
    );
    slice.scale.y = 1.22;
    group.add(slice);
  }
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.7, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xba3d61, roughness: 0.7, side: THREE.DoubleSide }));
  skirt.position.y = -1.35;
  skirt.rotation.x = Math.PI;
  group.add(skirt);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.9 }));
  basket.position.y = -1.95;
  group.add(basket);
  return group;
}

// ---------------------------------------------------------------------------
// Rooftop clutter — the texture of a real skyline
// ---------------------------------------------------------------------------

const metalMaterial = new THREE.MeshStandardMaterial({ color: 0xb9c2cc, roughness: 0.45, metalness: 0.6 });
const darkMetalMaterial = new THREE.MeshStandardMaterial({ color: 0x4a5264, roughness: 0.5, metalness: 0.45 });

export function createHvacUnit(scale = 1): THREE.Group {
  const group = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.62 * scale, 0.36 * scale, 0.48 * scale), metalMaterial);
  box.position.y = 0.18 * scale;
  box.castShadow = true;
  group.add(box);
  const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.16 * scale, 0.06 * scale, 14), darkMetalMaterial);
  fan.position.y = 0.39 * scale;
  group.add(fan);
  const grill = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.12 * scale, 0.02 * scale, 14), new THREE.MeshStandardMaterial({ color: 0x2b3040, roughness: 0.6 }));
  grill.position.y = 0.43 * scale;
  group.add(grill);
  return group;
}

export function createWaterTank(scale = 1): THREE.Group {
  const group = new THREE.Group();
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * scale, 0.3 * scale, 0.6 * scale, 12), new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.8 }));
  tank.position.y = 0.52 * scale;
  tank.castShadow = true;
  group.add(tank);
  const lid = new THREE.Mesh(new THREE.ConeGeometry(0.34 * scale, 0.2 * scale, 12), new THREE.MeshStandardMaterial({ color: 0x6d5238, roughness: 0.85 }));
  lid.position.y = 0.92 * scale;
  group.add(lid);
  for (let i = 0; i < 4; i += 1) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * scale, 0.025 * scale, 0.24 * scale, 6), darkMetalMaterial);
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    leg.position.set(Math.cos(angle) * 0.22 * scale, 0.12 * scale, Math.sin(angle) * 0.22 * scale);
    group.add(leg);
  }
  return group;
}

export function createSolarArray(cols: number, rows: number): THREE.Group {
  const group = new THREE.Group();
  const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2c66, roughness: 0.2, metalness: 0.55, emissive: 0x0c1c4a, emissiveIntensity: 0.25 });
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.3), panelMaterial);
      panel.position.set(c * 0.48, 0.14, r * 0.36);
      panel.rotation.x = -0.35;
      group.add(panel);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), darkMetalMaterial);
      strut.position.set(c * 0.48, 0.06, r * 0.36 + 0.1);
      group.add(strut);
    }
  }
  return group;
}

export function createAntennaMast(height: number, color: number): THREE.Group {
  const group = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, height, 6), darkMetalMaterial);
  mast.position.y = height / 2;
  group.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.8 }));
  beacon.name = 'beacon';
  beacon.position.y = height + 0.06;
  group.add(beacon);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI), metalMaterial);
  dish.position.y = height * 0.55;
  dish.rotation.x = -0.9;
  group.add(dish);
  return group;
}

// ---------------------------------------------------------------------------
// Gag props for the startup life cycle
// ---------------------------------------------------------------------------

export function createWorldSign(lines: string[], style: 'cardboard' | 'banner' | 'neon' | 'caution', width = 1.4, height = 0.7, postHeight = 0.55): THREE.Group {
  const group = new THREE.Group();
  const texture = createGagSignTexture(lines, style);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }),
  );
  face.position.y = postHeight + height / 2;
  group.add(face);
  const postMaterial = style === 'cardboard'
    ? new THREE.MeshStandardMaterial({ color: 0x9a7248, roughness: 0.9 })
    : darkMetalMaterial;
  for (const x of width > 1 ? [-width * 0.4, width * 0.4] : [0]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, postHeight + height * 0.5, 6), postMaterial);
    post.position.set(x, (postHeight + height * 0.5) / 2, -0.02);
    group.add(post);
  }
  return group;
}

export function createPizzaBoxStack(count: number, seed: string): THREE.Group {
  const group = new THREE.Group();
  const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xd9b98a, roughness: 0.85 });
  for (let i = 0; i < count; i += 1) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), boxMaterial);
    box.position.set((hashFloat(`${seed}:x${i}`) - 0.5) * 0.12, 0.03 + i * 0.055, (hashFloat(`${seed}:z${i}`) - 0.5) * 0.12);
    box.rotation.y = (hashFloat(`${seed}:r${i}`) - 0.5) * 0.7;
    box.castShadow = true;
    group.add(box);
  }
  return group;
}

export function createBeanBag(color: number): THREE.Mesh {
  const bag = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }),
  );
  bag.scale.set(1, 0.62, 1);
  bag.position.y = 0.18;
  bag.castShadow = true;
  return bag;
}

export function createPingPongTable(): THREE.Group {
  const group = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a6ee0, roughness: 0.5 }));
  top.position.y = 0.34;
  top.castShadow = true;
  group.add(top);
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.045, 0.02), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  line.position.y = 0.34;
  group.add(line);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.09), new THREE.MeshStandardMaterial({ color: 0xe8f0f8, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  net.position.y = 0.41;
  net.rotation.y = Math.PI / 2;
  group.add(net);
  for (const dx of [-0.36, 0.36]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 0.4), darkMetalMaterial);
    leg.position.set(dx, 0.16, 0);
    group.add(leg);
  }
  return group;
}

export function createKombuchaKeg(): THREE.Group {
  const group = new THREE.Group();
  const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.32, 12), metalMaterial);
  keg.position.y = 0.16;
  keg.castShadow = true;
  group.add(keg);
  const tap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.05), new THREE.MeshStandardMaterial({ color: 0xff9d2e, roughness: 0.4 }));
  tap.position.set(0.12, 0.32, 0);
  group.add(tap);
  return group;
}

export function createFoodTruck(color: number, seed: string): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.62, 0.66), new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
  body.position.y = 0.5;
  body.castShadow = true;
  group.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.62), new THREE.MeshStandardMaterial({ color: 0xf3f6fa, roughness: 0.4 }));
  cab.position.set(0.9, 0.4, 0);
  group.add(cab);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
  awning.position.set(-0.1, 0.85, 0.5);
  awning.rotation.x = 0.3;
  group.add(awning);
  const menu = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.32),
    new THREE.MeshBasicMaterial({ map: createGagSignTexture([hashFloat(seed) > 0.5 ? 'RAMEN BURRITO $23' : 'AI-POKE BOWL $27'], 'banner'), transparent: true }),
  );
  menu.position.set(-0.1, 0.62, 0.34);
  group.add(menu);
  addWheels(group, 1.6, 0.7);
  return group;
}

export function createIpoBell(): THREE.Group {
  const group = new THREE.Group();
  const goldMaterial = new THREE.MeshStandardMaterial({ color: 0xffc94d, roughness: 0.2, metalness: 0.85, emissive: 0x6b4a00, emissiveIntensity: 0.3 });
  for (const x of [-0.3, 0.3]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.72, 8), goldMaterial);
    post.position.set(x, 0.36, 0);
    group.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.07, 0.07), goldMaterial);
  beam.position.y = 0.74;
  group.add(beam);
  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.24, 14, 1, true), goldMaterial);
  bell.position.y = 0.58;
  bell.castShadow = true;
  group.add(bell);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), goldMaterial);
  clapper.position.y = 0.45;
  group.add(clapper);
  return group;
}

export function createTumbleweed(scale = 1): THREE.Mesh {
  const weed = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.24 * scale, 1),
    new THREE.MeshStandardMaterial({ color: 0xb59a62, roughness: 1, wireframe: true }),
  );
  weed.position.y = 0.24 * scale;
  return weed;
}

export function createCrow(): THREE.Group {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x14161e, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bodyMaterial);
  body.scale.set(1.5, 1, 1);
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), bodyMaterial);
  head.position.set(0.09, 0.05, 0);
  group.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 6), new THREE.MeshStandardMaterial({ color: 0xffa726 }));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.15, 0.05, 0);
  group.add(beak);
  return group;
}

export function createCrane(height: number, color = 0xffb020): THREE.Group {
  const group = new THREE.Group();
  const craneMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.35 });
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.16, height, 0.16), craneMaterial);
  mast.position.y = height / 2;
  mast.castShadow = true;
  group.add(mast);
  // Lattice hints
  for (let y = 0.4; y < height; y += 0.5) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.03), darkMetalMaterial);
    bar.position.set(0, y, 0.09);
    bar.rotation.z = 0.6;
    group.add(bar);
  }
  const jib = new THREE.Mesh(new THREE.BoxGeometry(height * 0.9, 0.12, 0.12), craneMaterial);
  jib.position.set(height * 0.28, height + 0.05, 0);
  jib.castShadow = true;
  group.add(jib);
  const counterweight = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.24), darkMetalMaterial);
  counterweight.position.set(-height * 0.16, height - 0.05, 0);
  group.add(counterweight);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xdff3ff, roughness: 0.3 }));
  cabin.position.set(0.16, height - 0.12, 0);
  group.add(cabin);
  const cableLength = height * 0.45;
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, cableLength, 4), new THREE.MeshStandardMaterial({ color: 0x333846 }));
  cable.position.set(height * 0.55, height - cableLength / 2 + 0.05, 0);
  group.add(cable);
  const load = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.3), new THREE.MeshStandardMaterial({ color: 0x9b8cff, roughness: 0.6 }));
  load.position.set(height * 0.55, height - cableLength - 0.08, 0);
  load.castShadow = true;
  group.add(load);
  return group;
}

export function createStreetLamp(): THREE.Group {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 1.5, 6), darkMetalMaterial);
  pole.position.y = 0.75;
  group.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.04), darkMetalMaterial);
  arm.position.set(0.18, 1.48, 0);
  group.add(arm);
  const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff0b8, emissive: 0xffd980, emissiveIntensity: 1.5 }));
  lampGlow.position.set(0.36, 1.44, 0);
  group.add(lampGlow);
  return group;
}

export function createPony(): THREE.Group {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
  const maneMaterial = new THREE.MeshStandardMaterial({ color: 0xff66c4, emissive: 0xff66c4, emissiveIntensity: 0.25, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 12), bodyMaterial);
  body.scale.set(1.45, 0.74, 0.72);
  body.castShadow = true;
  group.add(body);
  for (const [lx, lz] of [[-0.32, -0.16], [-0.32, 0.16], [0.3, -0.16], [0.3, 0.16]] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.42, 8), bodyMaterial);
    leg.position.set(lx, -0.4, lz);
    group.add(leg);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 10), bodyMaterial);
  head.position.set(0.52, 0.27, 0.02);
  head.castShadow = true;
  group.add(head);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.32, 12), new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffd166, emissiveIntensity: 0.5 }));
  horn.position.set(0.62, 0.54, 0.02);
  group.add(horn);
  const mane = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), maneMaterial);
  mane.scale.set(0.5, 1.4, 0.45);
  mane.position.set(0.32, 0.34, 0.05);
  group.add(mane);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), maneMaterial);
  tail.scale.set(0.5, 1.5, 0.5);
  tail.position.set(-0.55, 0.1, 0);
  tail.rotation.z = 0.5;
  group.add(tail);
  return group;
}

export function createSteamPuff(scale: number): THREE.Sprite {
  const sprite = createCircleSprite('rgba(255,255,255,.68)');
  sprite.scale.set(scale, scale * 0.76, scale);
  return sprite;
}
