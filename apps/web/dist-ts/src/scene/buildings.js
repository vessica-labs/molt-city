import * as THREE from 'three';
import { companyBrand, createBillboardTexture, createFacadeSignTexture, createTextSprite, hashFloat, hashPick, seededChance, } from './canvasArt';
import { createAntennaMast, createBeanBag, createCrane, createCrow, createFoodTruck, createHvacUnit, createIpoBell, createKombuchaKeg, createPingPongTable, createPizzaBoxStack, createPony, createSolarArray, createSteamPuff, createTree, createTumbleweed, createWaterTank, createWorldSign, } from './props';
// ---------------------------------------------------------------------------
// Sizing model (kept compatible with the simulation data)
// ---------------------------------------------------------------------------
export function buildingHeight(building) {
    const typeBase = {
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
export function renderedRoofline(building, computedHeight) {
    const fixedTypeRoofline = {
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
export function companyHeight(building, company) {
    const stageBoost = {
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
export function companyDevelopmentScore(company) {
    const stageScore = {
        garage: 0,
        seed: 8_000,
        series_a: 22_000,
        growth: 46_000,
        'public-ish': 90_000,
        failed: 0,
    };
    return company.valuation + company.research * 4 + company.marketShare * 950 + (stageScore[company.stage] ?? 0);
}
export function companiesByLotDevelopment(companies) {
    const byLot = new Map();
    for (const company of companies) {
        const existing = byLot.get(company.lotId);
        if (!existing || companyDevelopmentScore(company) > companyDevelopmentScore(existing)) {
            byLot.set(company.lotId, company);
        }
    }
    return byLot;
}
export function companyColor(archetype) {
    const colors = {
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
// ---------------------------------------------------------------------------
// Shared construction helpers
// ---------------------------------------------------------------------------
function addBlock(group, width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
}
const windowGeometry = new THREE.PlaneGeometry(0.3, 0.4);
const litWindow = new THREE.Color('#ffe1a0');
const warmWindow = new THREE.Color('#ffc46b');
const dimWindow = new THREE.Color('#27435f');
const glassWindow = new THREE.Color('#4b7ea8');
// One InstancedMesh per building keeps hundreds of panes cheap.
function addWindowGrid(group, width, height, depth, baseY, seed, offsetX = 0, offsetZ = 0) {
    const rows = Math.max(1, Math.min(18, Math.floor(height / 0.78)));
    const colsFront = Math.max(2, Math.min(12, Math.floor(width / 0.62)));
    const colsSide = Math.max(2, Math.min(12, Math.floor(depth / 0.66)));
    const total = rows * (colsFront + colsSide);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const panes = new THREE.InstancedMesh(windowGeometry, material, total);
    const dummy = new THREE.Object3D();
    let index = 0;
    const rowGap = height / rows;
    for (let row = 0; row < rows; row += 1) {
        const y = baseY + (row + 0.55) * rowGap;
        for (let col = 0; col < colsFront; col += 1) {
            const x = offsetX - width * 0.38 + (col / Math.max(1, colsFront - 1)) * width * 0.76;
            dummy.position.set(x, y, offsetZ + depth / 2 + 0.02);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            panes.setMatrixAt(index, dummy.matrix);
            const roll = seededChance(seed, row * 31 + col);
            panes.setColorAt(index, roll > 0.62 ? litWindow : roll > 0.45 ? warmWindow : roll > 0.2 ? dimWindow : glassWindow);
            index += 1;
        }
        for (let col = 0; col < colsSide; col += 1) {
            const z = offsetZ - depth * 0.36 + (col / Math.max(1, colsSide - 1)) * depth * 0.72;
            dummy.position.set(offsetX + width / 2 + 0.02, y, z);
            dummy.rotation.set(0, Math.PI / 2, 0);
            dummy.updateMatrix();
            panes.setMatrixAt(index, dummy.matrix);
            const roll = seededChance(`${seed}:side`, row * 37 + col);
            panes.setColorAt(index, roll > 0.62 ? litWindow : roll > 0.45 ? warmWindow : roll > 0.2 ? dimWindow : glassWindow);
            index += 1;
        }
    }
    panes.instanceMatrix.needsUpdate = true;
    if (panes.instanceColor)
        panes.instanceColor.needsUpdate = true;
    group.add(panes);
}
// Horizontal floor bands give towers real architectural rhythm.
function addFloorBands(group, width, height, depth, baseY, color) {
    const floors = Math.max(2, Math.floor(height / 1.15));
    const bandMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2 });
    const band = new THREE.InstancedMesh(new THREE.BoxGeometry(width + 0.06, 0.07, depth + 0.06), bandMaterial, floors);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < floors; i += 1) {
        dummy.position.set(0, baseY + ((i + 1) / floors) * height - 0.04, 0);
        dummy.updateMatrix();
        band.setMatrixAt(i, dummy.matrix);
    }
    band.instanceMatrix.needsUpdate = true;
    group.add(band);
}
function addEntrance(group, width, depth, accent) {
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(width * 0.34, 0.06, 0.5), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4, metalness: 0.25 }));
    canopy.position.set(0, 1.15, depth / 2 + 0.24);
    canopy.castShadow = true;
    group.add(canopy);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.26, 1.05), new THREE.MeshStandardMaterial({ color: 0x14203c, roughness: 0.3, metalness: 0.4 }));
    door.position.set(0, 0.55, depth / 2 + 0.022);
    group.add(door);
    const doorFrame = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.3, 1.14), new THREE.MeshStandardMaterial({ color: 0xd8e4f0, roughness: 0.5 }));
    doorFrame.position.set(0, 0.58, depth / 2 + 0.012);
    group.add(doorFrame);
    for (const x of [-width * 0.16, width * 0.16]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.12, 6), new THREE.MeshStandardMaterial({ color: 0x3a4560, metalness: 0.5, roughness: 0.4 }));
        post.position.set(x, 0.56, depth / 2 + 0.42);
        group.add(post);
    }
}
function addParapet(group, width, depth, height, color) {
    const parapetMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const rim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.12, 0.16, depth + 0.12), parapetMaterial);
    rim.position.y = height + 0.06;
    rim.castShadow = true;
    group.add(rim);
}
function addRooftopClutter(group, width, depth, height, seed) {
    const roll = hashFloat(`${seed}:roof`);
    if (roll > 0.6) {
        const hvac = createHvacUnit(0.9);
        hvac.position.set(-width * 0.24, height, -depth * 0.18);
        group.add(hvac);
    }
    if (roll > 0.35 && roll < 0.8) {
        const tank = createWaterTank(0.8);
        tank.position.set(width * 0.24, height, depth * 0.12);
        group.add(tank);
    }
    if (roll < 0.45) {
        const solar = createSolarArray(2, 2);
        solar.position.set(-width * 0.28, height, depth * 0.02);
        group.add(solar);
    }
}
function addNeonStrip(group, x, y, z, width, color) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.09, 0.06), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 0.28 }));
    strip.position.set(x, y, z);
    group.add(strip);
}
function addRooftopGarden(group, width, depth, height) {
    const garden = new THREE.Mesh(new THREE.BoxGeometry(width * 0.54, 0.18, depth * 0.46), new THREE.MeshStandardMaterial({ color: 0x58d274, roughness: 0.85 }));
    garden.position.set(width * 0.06, height + 0.09, depth * 0.02);
    garden.receiveShadow = true;
    group.add(garden);
    for (let i = 0; i < 4; i += 1) {
        const tree = createTree('oak', 0.32, `roof:${i}`);
        tree.position.set(-width * 0.14 + i * width * 0.11, height + 0.18, depth * 0.12 * (i % 2 ? 1 : -1));
        group.add(tree);
    }
}
// ---------------------------------------------------------------------------
// Rooftop billboard — the crown jewel: a real 3D sign you can actually read
// ---------------------------------------------------------------------------
const BILLBOARD_ASPECT = 448 / 1024;
export function createRooftopBillboard(company, brand, faceWidth) {
    const group = new THREE.Group();
    const failed = company.stage === 'failed';
    const faceHeight = faceWidth * BILLBOARD_ASPECT;
    const texture = createBillboardTexture(company, brand);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(faceWidth + 0.14, faceHeight + 0.14, 0.12), new THREE.MeshStandardMaterial({ color: failed ? 0x4a4d55 : 0x1b2342, roughness: 0.55, metalness: 0.4 }));
    frame.castShadow = true;
    group.add(frame);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(faceWidth, faceHeight), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    face.position.z = 0.07;
    group.add(face);
    const backPanel = new THREE.Mesh(new THREE.PlaneGeometry(faceWidth, faceHeight), new THREE.MeshStandardMaterial({ color: 0x30364a, roughness: 0.7, metalness: 0.3 }));
    backPanel.rotation.y = Math.PI;
    backPanel.position.z = -0.07;
    group.add(backPanel);
    // Support struts + catwalk
    const strutMaterial = new THREE.MeshStandardMaterial({ color: 0x39415a, roughness: 0.5, metalness: 0.5 });
    for (const x of [-faceWidth * 0.34, 0, faceWidth * 0.34]) {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, faceHeight * 0.9, 6), strutMaterial);
        strut.position.set(x, -faceHeight * 0.72, -0.16);
        strut.rotation.x = 0.28;
        group.add(strut);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, faceHeight * 0.62, 6), strutMaterial);
        post.position.set(x, -faceHeight * 0.78, 0);
        group.add(post);
    }
    const catwalk = new THREE.Mesh(new THREE.BoxGeometry(faceWidth + 0.3, 0.05, 0.3), strutMaterial);
    catwalk.position.set(0, -faceHeight / 2 - 0.1, 0.12);
    group.add(catwalk);
    // Spotlights hanging over the top edge
    if (!failed) {
        for (const x of [-faceWidth * 0.3, faceWidth * 0.3]) {
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 5), strutMaterial);
            arm.position.set(x, faceHeight / 2 + 0.16, 0.12);
            arm.rotation.x = 0.7;
            group.add(arm);
            const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0xfff2c4, emissive: 0xffe9a8, emissiveIntensity: 2 }));
            lamp.position.set(x, faceHeight / 2 + 0.28, 0.24);
            lamp.rotation.x = 2.4;
            group.add(lamp);
        }
    }
    else {
        // A billboard in decline: one crow per corner of shame
        const crow = createCrow();
        crow.position.set(faceWidth * 0.32, faceHeight / 2 + 0.12, 0);
        group.add(crow);
        const crow2 = createCrow();
        crow2.position.set(-faceWidth * 0.24, faceHeight / 2 + 0.12, 0);
        crow2.rotation.y = Math.PI * 0.8;
        group.add(crow2);
        group.rotation.z = 0.09;
    }
    return group;
}
// ---------------------------------------------------------------------------
// Startup life-cycle set dressing (the funny part)
// ---------------------------------------------------------------------------
function addStageProps(group, company, width, depth, roofline, height, brand) {
    const seed = company.id;
    const frontZ = depth / 2 + 0.6;
    switch (company.stage) {
        case 'garage': {
            const pizza = createPizzaBoxStack(3 + Math.floor(hashFloat(seed) * 4), seed);
            pizza.position.set(width * 0.34, 0.2, frontZ - 0.2);
            group.add(pizza);
            const sign = createWorldSign(hashPick([['STEALTH MODE', 'do not leak'], ['DISRUPTING SOON', 'trust us'], ['MVP INSIDE', 'mostly V']], seed), 'cardboard', 1.15, 0.6, 0.4);
            sign.position.set(-width * 0.36, 0.2, frontZ - 0.1);
            sign.rotation.y = 0.4;
            group.add(sign);
            break;
        }
        case 'seed': {
            const banner = createWorldSign(hashPick([['WE’RE HIRING!', '(equity only)'], ['SEED ROUND', 'we bought chairs'], ['NOW: 4 EMPLOYEES', 'and a dog']], seed), 'banner', 1.6, 0.7, 0.5);
            banner.position.set(width * 0.3, 0.2, frontZ - 0.15);
            banner.rotation.y = -0.3;
            group.add(banner);
            const keg = createKombuchaKeg();
            keg.position.set(-width * 0.3, 0.2, frontZ - 0.35);
            group.add(keg);
            const bag = createBeanBag(0xff66c4);
            bag.position.set(-width * 0.44, 0.2, frontZ - 0.7);
            group.add(bag);
            break;
        }
        case 'series_a': {
            const pingPong = createPingPongTable();
            pingPong.position.set(width * 0.1, roofline + 0.02, -depth * 0.1);
            group.add(pingPong);
            for (let i = 0; i < 2; i += 1) {
                const bag = createBeanBag(i ? 0x4cc9f0 : 0xffd166);
                bag.position.set(-width * 0.24 + i * 0.5, roofline + 0.02, depth * 0.2);
                group.add(bag);
            }
            const banner = createWorldSign(hashPick([['SERIES A!', 'we have a CFO now'], ['FUNDED ✓', 'adults hired'], ['10x TEAM', 'same product']], seed), 'banner', 1.7, 0.75, 0.5);
            banner.position.set(-width * 0.32, 0.2, frontZ - 0.15);
            banner.rotation.y = 0.25;
            group.add(banner);
            break;
        }
        case 'growth': {
            const crane = createCrane(Math.max(3.4, height * 0.5));
            crane.position.set(width * 0.62, 0.2, -depth * 0.4);
            crane.rotation.y = -0.6;
            group.add(crane);
            const truck = createFoodTruck(0xff7846, seed);
            truck.position.set(-width * 0.55, 0.2, frontZ + 0.2);
            truck.rotation.y = 0.16;
            group.add(truck);
            const banner = createWorldSign(hashPick([['NOW HIRING', '10x engineers only'], ['UNICORN 🦄', 'valuation is a vibe'], ['SCALING!', 'please clap']], seed), 'banner', 1.9, 0.8, 0.6);
            banner.position.set(width * 0.4, 0.2, frontZ);
            banner.rotation.y = -0.2;
            group.add(banner);
            break;
        }
        case 'public-ish': {
            const bell = createIpoBell();
            bell.position.set(-width * 0.22, roofline + 0.02, depth * 0.16);
            group.add(bell);
            // Spinning brand beacon cube — the "we made it" hood ornament
            const spinner = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), new THREE.MeshStandardMaterial({ color: brand.glow, emissive: brand.glow, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.5 }));
            spinner.name = 'logo-spinner';
            spinner.position.set(0, height + 2.2, 0);
            spinner.castShadow = true;
            group.add(spinner);
            const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0xd9e2ec, roughness: 0.3, metalness: 0.7 }));
            pedestal.position.set(0, height + 0.9, 0);
            group.add(pedestal);
            // Gold parapet trim: subtle, tasteful, extremely not subtle
            const crownTrim = new THREE.Mesh(new THREE.BoxGeometry(width * 0.96, 0.14, depth * 0.96), new THREE.MeshStandardMaterial({ color: 0xffc94d, emissive: 0xa87908, emissiveIntensity: 0.35, roughness: 0.25, metalness: 0.8 }));
            crownTrim.position.y = height + 0.05;
            group.add(crownTrim);
            break;
        }
        case 'failed': {
            const tumbleweed = createTumbleweed(1);
            tumbleweed.name = 'tumbleweed';
            tumbleweed.position.set(-width * 0.2, 0.2, frontZ);
            group.add(tumbleweed);
            const sign = createWorldSign(hashPick([['CLOSED', 'pivoting to AI'], ['AUCTION SAT', 'chairs & GPUs'], ['GONE', 'to the metaverse']], seed), 'caution', 1.5, 0.7, 0.45);
            sign.position.set(width * 0.28, 0.2, frontZ - 0.1);
            sign.rotation.y = -0.34;
            sign.rotation.z = 0.06;
            group.add(sign);
            // Boarded-up entrance
            const plankMaterial = new THREE.MeshStandardMaterial({ color: 0x9a7248, roughness: 0.95 });
            for (const angle of [0.5, -0.5]) {
                const plank = new THREE.Mesh(new THREE.BoxGeometry(width * 0.34, 0.09, 0.04), plankMaterial);
                plank.position.set(0, 0.62, depth / 2 + 0.05);
                plank.rotation.z = angle;
                group.add(plank);
            }
            break;
        }
    }
}
function addCompanyGrowth(group, building, company, width, depth, roofline, height, brand) {
    const growth = Math.max(0, height - roofline);
    const isFailed = company.stage === 'failed';
    const glassTower = new THREE.MeshStandardMaterial({
        color: brand.glow,
        emissive: brand.glow,
        emissiveIntensity: isFailed ? 0.08 : 0.32,
        roughness: 0.22,
        metalness: 0.35,
        transparent: true,
        opacity: isFailed ? 0.55 : 0.9,
    });
    if (growth > 1.1) {
        const towerHeight = Math.max(1.6, growth * 0.72);
        const towerWidth = width * (building.type === 'garage' || building.type === 'coffee_shop' ? 0.52 : 0.4);
        const towerDepth = depth * (building.type === 'garage' || building.type === 'coffee_shop' ? 0.48 : 0.38);
        addBlock(group, towerWidth, towerHeight, towerDepth, width * 0.13, roofline + towerHeight / 2, depth * 0.04, glassTower);
        addFloorBands(group, towerWidth, towerHeight, towerDepth, roofline, 0xffffff);
        addWindowGrid(group, towerWidth, towerHeight - 0.3, towerDepth, roofline, `${company.id}:growth`, width * 0.13, depth * 0.04);
    }
    if (growth > 3.4) {
        const secondHeight = Math.max(1.2, growth * 0.46);
        addBlock(group, width * 0.3, secondHeight, depth * 0.32, -width * 0.2, roofline + secondHeight / 2, -depth * 0.1, glassTower.clone());
        addNeonStrip(group, -width * 0.18, roofline + secondHeight + 0.16, -depth * 0.28, width * 0.32, brand.glow);
    }
    if (growth > 5.8 || company.stage === 'growth' || company.stage === 'public-ish') {
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.18, width * 0.26, 0.52, 6), new THREE.MeshStandardMaterial({ color: 0xeaffff, emissive: brand.glow, emissiveIntensity: 0.75, roughness: 0.28, metalness: 0.18 }));
        crown.position.set(width * 0.13, height + 0.3, depth * 0.04);
        crown.rotation.y = Math.PI / 6;
        crown.castShadow = true;
        group.add(crown);
        const mast = createAntennaMast(1.3, brand.glow);
        mast.position.set(width * 0.3, height + 0.4, -depth * 0.08);
        group.add(mast);
    }
}
function addCompanyBranding(group, company, width, depth, height, brand) {
    // Rooftop billboard, rotated to face the diorama camera. Height, angle and
    // placement jitter per company so neighboring billboards don't stack up.
    const faceWidth = Math.max(4.8, width * 1.25);
    const billboard = createRooftopBillboard(company, brand, faceWidth);
    const boardHeight = faceWidth * BILLBOARD_ASPECT;
    const lift = hashFloat(`${company.name}:lift`) * 1.7;
    billboard.position.set((hashFloat(`${company.name}:bx`) - 0.5) * width * 0.4, height + boardHeight * 0.85 + 0.35 + lift, (hashFloat(`${company.name}:bz`) - 0.5) * depth * 0.4);
    billboard.rotation.y = Math.PI / 4 + (hashFloat(`${company.name}:rot`) - 0.5) * 0.45;
    group.add(billboard);
    // Street-level facade sign above the entrance
    const facade = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.86, width * 0.86 * (192 / 1024)), new THREE.MeshBasicMaterial({ map: createFacadeSignTexture(company.name, brand, company.stage === 'failed'), transparent: true, toneMapped: false }));
    facade.position.set(0, 1.62, depth / 2 + 0.03);
    group.add(facade);
}
// ---------------------------------------------------------------------------
// Building models by type
// ---------------------------------------------------------------------------
export function createBuildingModel(building, lot, company, tick, lotWidth, lotDepth) {
    const group = new THREE.Group();
    const width = Math.min(lotWidth * 0.72, 5.8 + lot.size * 0.3);
    const depth = Math.min(lotDepth * 0.67, 5.6 + lot.size * 0.25);
    const baseHeight = buildingHeight(building);
    const roofline = renderedRoofline(building, baseHeight);
    const height = company ? companyHeight(building, company) : baseHeight;
    const brand = company ? companyBrand(company) : undefined;
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
    if (company && brand) {
        addCompanyGrowth(group, building, company, width, depth, roofline, height, brand);
        addStageProps(group, company, width, depth, roofline, height, brand);
        addCompanyBranding(group, company, width, depth, height, brand);
    }
    else {
        const name = createTextSprite(shortLabel(building.name), { background: 'rgba(19,26,58,.72)', color: '#eaffff', accent: '#6ee7ff' });
        name.position.set(0, Math.max(2.7, height + 1.15), -depth * 0.56);
        name.scale.multiplyScalar(0.36);
        group.add(name);
    }
    return group;
}
function createGarage(group, building, width, depth) {
    const siding = new THREE.MeshStandardMaterial({ color: 0x8fa9e8, roughness: 0.7, metalness: 0.05 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xf6f9ff, roughness: 0.6 });
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4a9e, roughness: 0.65, flatShading: true });
    // Suburban house with attached legendary garage
    addBlock(group, width * 0.46, 1.7, depth * 0.55, -width * 0.16, 0.85, 0, siding);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(width * 0.4, 1.0, 4), roofMaterial);
    roof.position.set(-width * 0.16, 2.2, 0);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = depth * 0.55 / (width * 0.46);
    roof.castShadow = true;
    group.add(roof);
    addBlock(group, width * 0.34, 1.3, depth * 0.45, width * 0.22, 0.65, 0.05, trim);
    const garageRoof = new THREE.Mesh(new THREE.BoxGeometry(width * 0.38, 0.1, depth * 0.5), roofMaterial);
    garageRoof.position.set(width * 0.22, 1.36, 0.05);
    garageRoof.castShadow = true;
    group.add(garageRoof);
    // Panel-lined garage door
    const doorMaterial = new THREE.MeshStandardMaterial({ color: 0xe8eef6, roughness: 0.55 });
    const garageDoor = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.27, 0.95), doorMaterial);
    garageDoor.position.set(width * 0.22, 0.5, 0.05 + depth * 0.225 + 0.015);
    group.add(garageDoor);
    for (let i = 0; i < 4; i += 1) {
        const groove = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.25, 0.02), new THREE.MeshStandardMaterial({ color: 0xa9b6c6 }));
        groove.position.set(width * 0.22, 0.22 + i * 0.22, 0.05 + depth * 0.225 + 0.02);
        group.add(groove);
    }
    // Driveway + basketball hoop, the true startup incubator
    const driveway = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.3, depth * 0.3), new THREE.MeshStandardMaterial({ color: 0x9aa4ae, roughness: 0.9 }));
    driveway.rotation.x = -Math.PI / 2;
    driveway.position.set(width * 0.22, 0.015, depth * 0.4);
    driveway.receiveShadow = true;
    group.add(driveway);
    const hoopPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0x3a4560, metalness: 0.5 }));
    hoopPole.position.set(width * 0.4, 0.75, depth * 0.3);
    group.add(hoopPole);
    const backboard = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.28), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, side: THREE.DoubleSide }));
    backboard.position.set(width * 0.4, 1.5, depth * 0.3);
    backboard.rotation.y = Math.PI / 2;
    group.add(backboard);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xeef8ff, roughness: 0.25, metalness: 0.65 }));
    dish.position.set(-width * 0.28, 2.0, depth * 0.16);
    dish.rotation.x = -0.8;
    group.add(dish);
    addWindowGrid(group, width * 0.46, 1.1, depth * 0.55, 0.3, building.id, -width * 0.16, 0);
}
function createCoffeeShop(group, building, width, depth) {
    const body = new THREE.MeshStandardMaterial({ color: 0xffb1c7, roughness: 0.62 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xfff4e3, roughness: 0.6 });
    addBlock(group, width * 0.66, 2.15, depth * 0.58, 0, 1.08, 0, body);
    addBlock(group, width * 0.72, 0.28, depth * 0.64, 0, 2.32, 0, cream);
    addParapet(group, width * 0.66, depth * 0.58, 2.45, 0xff7ba1);
    // Striped awning built from alternating scalloped stripes
    for (let i = 0; i < 6; i += 1) {
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, width * 0.11, 8, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffffff : 0xff4d80, roughness: 0.6, side: THREE.DoubleSide }));
        stripe.rotation.z = Math.PI / 2;
        stripe.rotation.y = Math.PI / 2;
        stripe.position.set(-width * 0.27 + i * width * 0.11, 1.5, depth * 0.31);
        group.add(stripe);
    }
    const awningTop = new THREE.Mesh(new THREE.BoxGeometry(width * 0.66, 0.03, 0.36), new THREE.MeshStandardMaterial({ color: 0xff4d80, roughness: 0.6 }));
    awningTop.position.set(0, 1.6, depth * 0.29 + 0.12);
    awningTop.rotation.x = 0.32;
    group.add(awningTop);
    // Giant rooftop latte cup with steam
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.5, 18), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    cup.position.set(width * 0.16, 2.75, -depth * 0.05);
    cup.castShadow = true;
    group.add(cup);
    const foam = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.07, 18), new THREE.MeshStandardMaterial({ color: 0xd8a36a, roughness: 0.7 }));
    foam.position.set(width * 0.16, 3.02, -depth * 0.05);
    group.add(foam);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 8, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    handle.position.set(width * 0.16 + 0.36, 2.75, -depth * 0.05);
    group.add(handle);
    for (let i = 0; i < 3; i += 1) {
        const steam = createSteamPuff(0.3 + i * 0.09);
        steam.position.set(width * 0.16, 3.25 + i * 0.34, -depth * 0.05);
        group.add(steam);
    }
    // Sidewalk patio with umbrellas
    for (let i = 0; i < 2; i += 1) {
        const x = -width * 0.28 + i * 0.7;
        const table = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 14), new THREE.MeshStandardMaterial({ color: 0xfff6d6, roughness: 0.5 }));
        table.position.set(x, 0.42, depth * 0.42);
        group.add(table);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x8b8f9a }));
        stem.position.set(x, 0.55, depth * 0.42);
        group.add(stem);
        const umbrella = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.22, 10), new THREE.MeshStandardMaterial({ color: i ? 0xff66a5 : 0xffd166, roughness: 0.55, flatShading: true }));
        umbrella.position.set(x, 0.88, depth * 0.42);
        group.add(umbrella);
    }
    addWindowGrid(group, width * 0.66, 1.5, depth * 0.58, 0.32, building.id);
}
function createCoworking(group, building, width, depth, height) {
    const brick = new THREE.MeshStandardMaterial({ color: 0xc06a4e, roughness: 0.8 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x58c7ef, emissive: 0x0a3a58, emissiveIntensity: 0.25, roughness: 0.24, metalness: 0.28, transparent: true, opacity: 0.92 });
    addBlock(group, width * 0.82, height, depth * 0.82, 0, height / 2, 0, glass);
    addBlock(group, width * 0.2, height + 0.4, depth * 0.9, -width * 0.29, (height + 0.4) / 2, 0, brick);
    addFloorBands(group, width * 0.82, height, depth * 0.82, 0, 0xdff3ff);
    addWindowGrid(group, width * 0.82, height - 0.4, depth * 0.82, 0.24, building.id);
    addParapet(group, width * 0.82, depth * 0.82, height, 0x2d5c87);
    addRooftopGarden(group, width, depth, height);
    addEntrance(group, width, depth * 0.82, 0xff8c42);
    // Fire escape zig-zag on the brick core
    const fireEscape = new THREE.Mesh(new THREE.BoxGeometry(0.05, height * 0.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x2b3040, roughness: 0.6, metalness: 0.5 }));
    fireEscape.position.set(-width * 0.41, height * 0.45, depth * 0.2);
    group.add(fireEscape);
}
function createResearchLab(group, building, width, depth, height) {
    const white = new THREE.MeshStandardMaterial({ color: 0xf2fffb, roughness: 0.45, metalness: 0.08 });
    const teal = new THREE.MeshStandardMaterial({ color: 0x23cdb8, emissive: 0x0e6059, emissiveIntensity: 0.25, roughness: 0.4 });
    addBlock(group, width * 0.7, height * 0.72, depth * 0.76, -width * 0.08, height * 0.36, 0, white);
    addBlock(group, width * 0.38, height * 0.48, depth * 0.5, width * 0.25, height * 0.24, -depth * 0.05, teal);
    addFloorBands(group, width * 0.7, height * 0.72, depth * 0.76, 0, 0xbfe8de);
    addWindowGrid(group, width * 0.7, height * 0.6, depth * 0.76, 0.24, building.id, -width * 0.08, 0);
    // Glowing containment cylinder with orbit rings
    const reactor = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, height * 0.82, 28), new THREE.MeshStandardMaterial({ color: 0x9fffee, emissive: 0x40ffe0, emissiveIntensity: 0.9, transparent: true, opacity: 0.55, roughness: 0.18 }));
    reactor.position.set(width * 0.2, height * 0.43, depth * 0.22);
    reactor.castShadow = true;
    group.add(reactor);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8bfff1, emissiveIntensity: 2 }));
    core.position.set(width * 0.2, height * 0.45, depth * 0.22);
    group.add(core);
    for (let i = 0; i < 2; i += 1) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85 + i * 0.16, 0.03, 8, 40), new THREE.MeshStandardMaterial({ color: 0x40ffe0, emissive: 0x40ffe0, emissiveIntensity: 0.8 }));
        ring.name = `orbit-ring-${i}`;
        ring.position.copy(reactor.position);
        ring.rotation.x = 0.7 + i * 0.5;
        group.add(ring);
    }
    const mast = createAntennaMast(1.4, 0x40ffe0);
    mast.position.set(-width * 0.25, height * 0.72, -depth * 0.2);
    group.add(mast);
    addEntrance(group, width * 0.7, depth * 0.76, 0x23cdb8);
}
function createDataCenter(group, building, width, depth) {
    const dark = new THREE.MeshStandardMaterial({ color: 0x1d284f, roughness: 0.42, metalness: 0.3 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x63f2d7, emissive: 0x19d8b8, emissiveIntensity: 0.5, transparent: true, opacity: 0.55, roughness: 0.2 });
    addBlock(group, width * 0.92, 3.8, depth * 0.78, 0, 1.9, 0, dark);
    // Greenhouse vault on the roof with plants basking in GPU exhaust
    const vault = new THREE.Mesh(new THREE.CylinderGeometry(depth * 0.3, depth * 0.3, width * 0.8, 18, 1, false, 0, Math.PI), glass);
    vault.rotation.z = Math.PI / 2;
    vault.position.set(0, 3.8, 0);
    vault.castShadow = true;
    group.add(vault);
    for (let i = 0; i < 4; i += 1) {
        const plant = createTree('oak', 0.26, `dc:${i}`);
        plant.position.set(-width * 0.3 + i * width * 0.2, 3.82, 0);
        group.add(plant);
    }
    // Server-rack light strips racing along the walls
    for (let i = 0; i < 6; i += 1) {
        addNeonStrip(group, -width * 0.36 + i * width * 0.145, 1.6 + (i % 3) * 0.7, depth * 0.39 + 0.03, 0.8, i % 2 ? 0x40ffe0 : 0x3d8bff);
    }
    for (let i = 0; i < 3; i += 1) {
        const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.24, 18), new THREE.MeshStandardMaterial({ color: 0xd7fff8, roughness: 0.3, metalness: 0.55 }));
        fan.position.set(-width * 0.26 + i * width * 0.26, 4.0, -depth * 0.26);
        fan.castShadow = true;
        group.add(fan);
        const blades = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 3), new THREE.MeshStandardMaterial({ color: 0x2b3040 }));
        blades.name = `fan-blade-${i}`;
        blades.position.set(-width * 0.26 + i * width * 0.26, 4.14, -depth * 0.26);
        group.add(blades);
    }
    const mast = createAntennaMast(1.2, 0x40ffe0);
    mast.position.set(width * 0.34, 3.9, depth * 0.16);
    group.add(mast);
    addWindowGrid(group, width * 0.92, 2.6, depth * 0.78, 0.5, building.id);
}
function createModelFoundry(group, building, width, depth) {
    const steel = new THREE.MeshStandardMaterial({ color: 0x39405c, roughness: 0.55, metalness: 0.5 });
    const rust = new THREE.MeshStandardMaterial({ color: 0x8a4a32, roughness: 0.8 });
    addBlock(group, width * 0.88, 4.6, depth * 0.76, 0, 2.3, 0, steel);
    addBlock(group, width * 0.5, 1.2, depth * 0.45, -width * 0.08, 5.2, 0, steel.clone());
    // Sawtooth factory roofline
    for (let i = 0; i < 3; i += 1) {
        const tooth = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, depth * 0.7, 3), rust);
        tooth.rotation.z = Math.PI / 2;
        tooth.rotation.x = Math.PI / 2;
        tooth.position.set(-width * 0.26 + i * width * 0.26, 4.85, 0);
        tooth.castShadow = true;
        group.add(tooth);
    }
    // Molten crucible pouring glowing "model weights"
    const crucible = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.35, 0.6, 14), new THREE.MeshStandardMaterial({ color: 0x2b3040, roughness: 0.5, metalness: 0.6 }));
    crucible.position.set(width * 0.24, 5.4, depth * 0.1);
    crucible.rotation.z = 0.5;
    crucible.castShadow = true;
    group.add(crucible);
    const pour = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0xffb15c, emissive: 0xff6a1e, emissiveIntensity: 2.2, toneMapped: false }));
    pour.position.set(width * 0.35, 4.6, depth * 0.1);
    group.add(pour);
    const glowPool = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.12, 14), new THREE.MeshStandardMaterial({ color: 0xffd08a, emissive: 0xff7a1e, emissiveIntensity: 1.8 }));
    glowPool.position.set(width * 0.35, 3.8, depth * 0.1);
    group.add(glowPool);
    for (let i = 0; i < 2; i += 1) {
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.35, 3.1, 14), rust.clone());
        stack.position.set(-width * (0.1 + i * 0.2), 6.3, -depth * 0.2);
        stack.castShadow = true;
        group.add(stack);
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 8, 16), steel.clone());
        band.rotation.x = Math.PI / 2;
        band.position.set(-width * (0.1 + i * 0.2), 7.2, -depth * 0.2);
        group.add(band);
        const smoke = createSteamPuff(0.5);
        smoke.position.set(-width * (0.1 + i * 0.2), 8.2 + i * 0.4, -depth * 0.2);
        group.add(smoke);
    }
    addNeonStrip(group, -width * 0.36, 3.7, depth * 0.4, 1.4, 0xff9452);
    addWindowGrid(group, width * 0.88, 3.3, depth * 0.76, 0.55, building.id);
    addEntrance(group, width * 0.88, depth * 0.76, 0xff9452);
}
function createCivicHall(group, building, width, depth) {
    const stone = new THREE.MeshStandardMaterial({ color: 0xfdf6ec, roughness: 0.65 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xffd9e8, roughness: 0.62 });
    addBlock(group, width * 0.78, 3.1, depth * 0.64, 0, 1.55, 0, accent);
    addBlock(group, width * 0.88, 0.42, depth * 0.74, 0, 3.35, 0, stone);
    // Grand steps
    for (let i = 0; i < 3; i += 1) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(width * (0.5 - i * 0.06), 0.12, 0.5 - i * 0.12), stone.clone());
        step.position.set(0, 0.08 + i * 0.12, depth * 0.36 + 0.3 - i * 0.1);
        step.receiveShadow = true;
        group.add(step);
    }
    // Colonnade
    for (let i = 0; i < 5; i += 1) {
        const column = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 2.5, 12), stone.clone());
        column.position.set(-width * 0.28 + i * width * 0.14, 1.5, depth * 0.33);
        column.castShadow = true;
        group.add(column);
        const capital = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.28), stone.clone());
        capital.position.set(-width * 0.28 + i * width * 0.14, 2.72, depth * 0.33);
        group.add(capital);
    }
    const pediment = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.32, width * 0.32, 0.3, 3), stone.clone());
    pediment.rotation.z = Math.PI / 2;
    pediment.rotation.x = Math.PI / 2;
    pediment.scale.y = 0.4;
    pediment.position.set(0, 3.2, depth * 0.33);
    group.add(pediment);
    // Gilded dome + cupola + flag
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.15, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffd982, roughness: 0.3, metalness: 0.65, emissive: 0x7a5a10, emissiveIntensity: 0.2 }));
    dome.position.set(0, 3.56, 0);
    dome.castShadow = true;
    group.add(dome);
    const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.4, 10), stone.clone());
    cupola.position.set(0, 4.85, 0);
    group.add(cupola);
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5), new THREE.MeshStandardMaterial({ color: 0x8b93a2 }));
    flagPole.position.set(0, 5.5, 0);
    group.add(flagPole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.32), new THREE.MeshStandardMaterial({ color: 0xff66c4, roughness: 0.55, side: THREE.DoubleSide }));
    flag.name = 'civic-flag';
    flag.position.set(0.3, 5.75, 0);
    group.add(flag);
    addWindowGrid(group, width * 0.78, 2.2, depth * 0.64, 0.4, building.id);
}
function createTransitKiosk(group, _building, width, depth) {
    const base = new THREE.MeshStandardMaterial({ color: 0x78a7ff, roughness: 0.5, metalness: 0.1 });
    const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0xfff2a2, roughness: 0.42 });
    addBlock(group, width * 0.5, 1.35, depth * 0.34, 0, 0.68, 0, base);
    // Swooping canopy
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.42, width * 0.42, depth * 0.5, 20, 1, false, Math.PI * 0.15, Math.PI * 0.7), canopyMaterial);
    canopy.rotation.z = Math.PI / 2;
    canopy.rotation.x = Math.PI / 2;
    canopy.position.set(0, 1.1, 0);
    canopy.castShadow = true;
    group.add(canopy);
    // Elevated hyperlooop-ish tube with a capsule inside
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, width * 1.15, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.4, roughness: 0.15, side: THREE.DoubleSide }));
    tube.rotation.z = Math.PI / 2;
    tube.position.set(0, 0.9, depth * 0.36);
    group.add(tube);
    const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 4, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x4cc9f0, emissiveIntensity: 0.4, roughness: 0.3 }));
    capsule.name = 'transit-pod';
    capsule.rotation.z = Math.PI / 2;
    capsule.position.set(0, 0.9, depth * 0.36);
    group.add(capsule);
    for (const x of [-width * 0.4, width * 0.4]) {
        const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0x8b93a2, metalness: 0.5 }));
        pylon.position.set(x, 0.45, depth * 0.36);
        group.add(pylon);
    }
}
function createPonyMeadow(group, _building, width, depth) {
    // White picket fence
    const picketMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const picketCount = Math.floor(width / 0.34);
    const pickets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.4, 0.03), picketMaterial, picketCount * 2);
    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let i = 0; i < picketCount; i += 1) {
        const x = -width * 0.42 + (i / (picketCount - 1)) * width * 0.84;
        for (const z of [-depth * 0.4, depth * 0.4]) {
            dummy.position.set(x, 0.2, z);
            dummy.updateMatrix();
            pickets.setMatrixAt(idx, dummy.matrix);
            idx += 1;
        }
    }
    pickets.instanceMatrix.needsUpdate = true;
    group.add(pickets);
    // Pond
    const pond = new THREE.Mesh(new THREE.CircleGeometry(Math.min(width, depth) * 0.18, 20), new THREE.MeshStandardMaterial({ color: 0x4cc9f0, roughness: 0.2, metalness: 0.1 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(-width * 0.24, 0.02, depth * 0.2);
    group.add(pond);
    for (let index = 0; index < 9; index += 1) {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: index % 3 === 0 ? 0xff66c4 : index % 3 === 1 ? 0xfff06b : 0xc99bff, emissive: 0xff66c4, emissiveIntensity: 0.15 }));
        flower.position.set(-width * 0.36 + (index % 4) * width * 0.2, 0.28, -depth * 0.28 + Math.floor(index / 4) * depth * 0.22);
        group.add(flower);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.24, 5), new THREE.MeshStandardMaterial({ color: 0x2f9e52 }));
        stem.position.set(flower.position.x, 0.12, flower.position.z);
        group.add(stem);
    }
    const pony = createPony();
    pony.position.set(-width * 0.06, 0.62, 0.1);
    group.add(pony);
    const foal = createPony();
    foal.scale.setScalar(0.55);
    foal.position.set(width * 0.24, 0.36, -depth * 0.18);
    foal.rotation.y = 0.9;
    group.add(foal);
    const rainbowColors = [0xff4d80, 0xffd166, 0x66e084, 0x4cc9f0, 0x9b5cff];
    for (let index = 0; index < rainbowColors.length; index += 1) {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(1.65 + index * 0.13, 0.045, 8, 48, Math.PI), new THREE.MeshStandardMaterial({ color: rainbowColors[index] ?? 0xffffff, emissive: rainbowColors[index] ?? 0xffffff, emissiveIntensity: 0.45, transparent: true, opacity: 0.9 }));
        arc.position.set(width * 0.18, 1.05, -depth * 0.16 + index * 0.02);
        group.add(arc);
    }
    const oak = createTree('oak', 0.85, 'meadow-oak');
    oak.position.set(width * 0.34, 0.02, depth * 0.28);
    group.add(oak);
}
function createConcertShell(group, building, width, depth) {
    const stage = new THREE.MeshStandardMaterial({ color: 0x6d51d9, roughness: 0.45, metalness: 0.12 });
    const shell = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xff70bf, emissiveIntensity: 0.3, roughness: 0.48 });
    addBlock(group, width * 0.82, 0.42, depth * 0.48, 0, 0.24, 0.22, stage);
    for (let i = 0; i < 6; i += 1) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(1.6 + i * 0.14, 0.07, 8, 44, Math.PI), shell.clone());
        rib.position.set(0, 1.18, -depth * 0.08 + i * 0.15);
        rib.scale.y = 0.8;
        rib.castShadow = true;
        group.add(rib);
    }
    // Speaker stacks
    for (const side of [-1, 1]) {
        for (let s = 0; s < 2; s += 1) {
            const speaker = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x1b1e28, roughness: 0.7 }));
            speaker.position.set(side * width * 0.36, 0.66 + s * 0.42, 0.1);
            speaker.castShadow = true;
            group.add(speaker);
            const coneMesh = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), new THREE.MeshStandardMaterial({ color: 0x5a6070 }));
            coneMesh.position.set(side * width * 0.36, 0.66 + s * 0.42, 0.26);
            group.add(coneMesh);
        }
    }
    // Stage light truss with colored PARs
    const truss = new THREE.Mesh(new THREE.BoxGeometry(width * 0.7, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0x39415a, metalness: 0.6, roughness: 0.4 }));
    truss.position.set(0, 2.3, 0.3);
    group.add(truss);
    const parColors = [0xff4d80, 0x4cc9f0, 0xffd166, 0x66e084];
    for (let i = 0; i < 4; i += 1) {
        const par = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 8), new THREE.MeshStandardMaterial({ color: parColors[i] ?? 0xffffff, emissive: parColors[i] ?? 0xffffff, emissiveIntensity: 1.6 }));
        par.position.set(-width * 0.26 + i * width * 0.175, 2.2, 0.32);
        par.rotation.x = 2.6;
        group.add(par);
        const beam = new THREE.Mesh(new THREE.ConeGeometry(0.3, 2.0, 12, 1, true), new THREE.MeshBasicMaterial({ color: parColors[i] ?? 0xffffff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
        beam.position.set(-width * 0.26 + i * width * 0.175, 1.2, 0.5);
        group.add(beam);
    }
    addWindowGrid(group, width * 0.5, 0.9, depth * 0.3, 0.36, building.id);
}
function createMixedUseTower(group, building, width, depth, height) {
    const glass = new THREE.MeshStandardMaterial({ color: 0x3db8ff, emissive: 0x071d55, emissiveIntensity: 0.3, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.92 });
    const cap = new THREE.MeshStandardMaterial({ color: 0xb2ffda, emissive: 0x35ffc3, emissiveIntensity: 0.32, roughness: 0.34, metalness: 0.16 });
    const lowerH = height * 0.5;
    const midH = height * 0.3;
    const topH = height * 0.2;
    addBlock(group, width * 0.74, lowerH, depth * 0.74, 0, lowerH / 2, 0, glass);
    addBlock(group, width * 0.58, midH, depth * 0.58, width * 0.04, lowerH + midH / 2, -depth * 0.03, glass.clone());
    addBlock(group, width * 0.42, topH, depth * 0.42, -width * 0.02, lowerH + midH + topH / 2, 0.02, cap);
    addFloorBands(group, width * 0.74, lowerH, depth * 0.74, 0, 0xdff3ff);
    addFloorBands(group, width * 0.58, midH, depth * 0.58, lowerH, 0xdff3ff);
    addWindowGrid(group, width * 0.74, lowerH - 0.3, depth * 0.74, 0.2, `${building.id}:a`);
    addWindowGrid(group, width * 0.58, midH - 0.25, depth * 0.58, lowerH, `${building.id}:b`, width * 0.04, -depth * 0.03);
    // Setback terraces with greenery
    for (const [w, y] of [[0.66, lowerH], [0.5, lowerH + midH]]) {
        const terrace = new THREE.Mesh(new THREE.BoxGeometry(width * w, 0.1, depth * w), new THREE.MeshStandardMaterial({ color: 0x58d274, roughness: 0.85 }));
        terrace.position.set(width * 0.02, y + 0.05, 0);
        group.add(terrace);
    }
    // Retail base with awnings
    const podium = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 1.4, depth * 0.9), new THREE.MeshStandardMaterial({ color: 0xf3f7fb, roughness: 0.5 }));
    podium.position.y = 0.7;
    podium.castShadow = true;
    podium.receiveShadow = true;
    group.add(podium);
    for (let i = 0; i < 3; i += 1) {
        const awning = new THREE.Mesh(new THREE.BoxGeometry(width * 0.2, 0.03, 0.3), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xff8c42 : 0x4cc9f0, roughness: 0.6 }));
        awning.position.set(-width * 0.26 + i * width * 0.26, 1.14, depth * 0.45 + 0.1);
        awning.rotation.x = 0.3;
        group.add(awning);
    }
    // Spire
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.07, 2.0, 8), new THREE.MeshStandardMaterial({ color: 0xd9e2ec, metalness: 0.7, roughness: 0.3 }));
    spire.position.set(-width * 0.02, height + 1.0, 0.02);
    group.add(spire);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 2 }));
    beacon.name = 'beacon';
    beacon.position.set(-width * 0.02, height + 2.0, 0.02);
    group.add(beacon);
    addEntrance(group, width, depth * 0.9, 0x35ffc3);
}
function createGenericBuilding(group, building, width, depth, height) {
    const material = new THREE.MeshStandardMaterial({ color: 0x928bff, roughness: 0.52, metalness: 0.12 });
    addBlock(group, width * 0.72, height, depth * 0.72, 0, height / 2, 0, material);
    addFloorBands(group, width * 0.72, height, depth * 0.72, 0, 0xd8d3ff);
    addWindowGrid(group, width * 0.72, height - 0.3, depth * 0.72, 0.2, building.id);
    addParapet(group, width * 0.72, depth * 0.72, height, 0x6f66d8);
    addRooftopClutter(group, width * 0.72, depth * 0.72, height, building.id);
}
function addConstructionOverlay(group, width, depth, height) {
    const scaffoldMaterial = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.48, metalness: 0.38 });
    for (const x of [-width * 0.42, width * 0.42]) {
        for (const z of [-depth * 0.42, depth * 0.42]) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, height + 0.7, 8), scaffoldMaterial);
            post.position.set(x, (height + 0.7) / 2, z);
            post.castShadow = true;
            group.add(post);
        }
    }
    // Cross braces
    for (const z of [-depth * 0.42, depth * 0.42]) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.04, 0.04), scaffoldMaterial);
        brace.position.set(0, height * 0.6, z);
        brace.rotation.z = 0.3;
        group.add(brace);
    }
    const crane = createCrane(height + 2.2);
    crane.position.set(width * 0.58, 0, depth * 0.42);
    group.add(crane);
    const sign = createWorldSign(['PARDON OUR', 'DISRUPTION'], 'caution', 1.3, 0.66, 0.4);
    sign.position.set(0, 0.2, depth / 2 + 0.5);
    group.add(sign);
}
export function shortLabel(label) {
    return label.length > 22 ? `${label.slice(0, 20)}…` : label;
}
