import * as THREE from 'three';
import type { Company, CompanyArchetype } from '@molt-city/shared';

// ---------------------------------------------------------------------------
// Deterministic hashing helpers (visuals must be stable across rebuilds)
// ---------------------------------------------------------------------------

export function hashFloat(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

export function hashPick<T>(items: readonly T[], seed: string): T {
  const index = Math.floor(hashFloat(seed) * items.length) % items.length;
  return items[index] as T;
}

export function seededChance(seed: string, index: number): number {
  return hashFloat(`${seed}:${index}`);
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

function toTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Brand system: every company gets a stable palette, tagline, and logo mark
// ---------------------------------------------------------------------------

export type CompanyStage = Company['stage'];

export type BrandKit = {
  primary: string;
  secondary: string;
  glow: number;
  tagline: string;
  stageLabel: string;
};

const archetypePalettes: Record<CompanyArchetype, Array<[string, string]>> = {
  search: [['#4285f4', '#fbbc05'], ['#2fb6ff', '#ff6f61'], ['#3ddcff', '#ffd166']],
  enterprise: [['#00a1e0', '#b6d9f2'], ['#7a5cff', '#c3f0ff'], ['#0f6bff', '#9be8ff']],
  frontier_ai: [['#10a37f', '#d7fff3'], ['#c96442', '#ffe3d1'], ['#8e75ff', '#e6ddff']],
  social: [['#ff2d78', '#ffd1e6'], ['#1da1f2', '#d4f0ff'], ['#a64dff', '#ffd6f7']],
  robotics: [['#76b900', '#e6ffc4'], ['#ff4d2e', '#ffe0d6'], ['#ffb300', '#fff2c4']],
  local_services: [['#ff5a1f', '#ffe8d6'], ['#00c1b2', '#d4fff9'], ['#ff3008', '#ffe0da']],
  finance: [['#635bff', '#e0deff'], ['#00d47e', '#d4ffe9'], ['#f7931a', '#ffe9c9']],
};

const archetypeTaglines: Record<CompanyArchetype, string[]> = {
  search: [
    'We already know what you meant',
    'Now with 40% fewer ads*',
    'Results may include reality',
    'Ask us. We tell your fridge.',
  ],
  enterprise: [
    'Synergizing your synergies',
    'The cloud, but more expensive',
    'B2B2B2B since last quarter',
    'Now with 60% more dashboards',
  ],
  frontier_ai: [
    'AGI by Q4 (of some year)',
    'Definitely aligned. Probably.',
    'Our model dreams of GPUs',
    'Scaling laws, vibes & venture',
  ],
  social: [
    'Doomscroll responsibly',
    'Your data, our yacht',
    'Connecting you to ads',
    'Now serving 3s attention spans',
  ],
  robotics: [
    'It only fell over twice',
    'Robots that mostly obey',
    'Automating your chores & jobs',
    'Legs are just a suggestion',
  ],
  local_services: [
    'A $48 burrito, delivered cold',
    'Gig economy, but whimsical',
    'Everything in 10 min, roughly',
    'Your errands, our margins',
  ],
  finance: [
    'Not financial advice',
    'Number go up™',
    'Banking, minus the bank',
    'Fees so small you need a lens',
  ],
};

const stageLabels: Record<CompanyStage, string> = {
  garage: 'STEALTH',
  seed: 'SEED',
  series_a: 'SERIES A',
  growth: 'UNICORN',
  'public-ish': 'IPO’D',
  failed: 'RIP',
};

export function companyBrand(company: Pick<Company, 'name' | 'archetype' | 'stage'>): BrandKit {
  const palette = hashPick(archetypePalettes[company.archetype], `${company.name}:palette`);
  const tagline = company.stage === 'failed'
    ? hashPick(['We had a good run', 'Pivoted to the afterlife', 'Acqui-hired by the void', 'Sunsetting… everything'], `${company.name}:rip`)
    : hashPick(archetypeTaglines[company.archetype], `${company.name}:tagline`);
  return {
    primary: palette[0],
    secondary: palette[1],
    glow: parseInt(palette[0].slice(1), 16),
    tagline,
    stageLabel: stageLabels[company.stage],
  };
}

// ---------------------------------------------------------------------------
// Procedural logo marks, one visual language per archetype
// ---------------------------------------------------------------------------

export function drawCompanyLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, archetype: CompanyArchetype, seed: string, primary: string, secondary: string) {
  ctx.save();
  ctx.translate(cx, cy);
  const s = size / 2;

  switch (archetype) {
    case 'search': {
      // Rainbow-segmented magnifier ring
      const colors = ['#4285f4', '#ea4335', '#fbbc05', '#34a853'];
      ctx.lineWidth = s * 0.34;
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i += 1) {
        ctx.strokeStyle = colors[i] ?? primary;
        ctx.beginPath();
        ctx.arc(-s * 0.14, -s * 0.14, s * 0.62, (i / 4) * Math.PI * 2 - 0.6, ((i + 1) / 4) * Math.PI * 2 - 0.72);
        ctx.stroke();
      }
      ctx.strokeStyle = primary;
      ctx.lineWidth = s * 0.3;
      ctx.beginPath();
      ctx.moveTo(s * 0.32, s * 0.32);
      ctx.lineTo(s * 0.82, s * 0.82);
      ctx.stroke();
      break;
    }
    case 'enterprise': {
      // Cloud with a tie: business, but floating
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.arc(-s * 0.4, s * 0.1, s * 0.42, 0, Math.PI * 2);
      ctx.arc(0, -s * 0.24, s * 0.55, 0, Math.PI * 2);
      ctx.arc(s * 0.44, s * 0.1, s * 0.44, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-s * 0.8, s * 0.02, s * 1.66, s * 0.5);
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.05);
      ctx.lineTo(s * 0.16, s * 0.3);
      ctx.lineTo(0, s * 0.78);
      ctx.lineTo(-s * 0.16, s * 0.3);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'frontier_ai': {
      // Radiant neural starburst around an all-seeing core
      const rays = 9;
      ctx.strokeStyle = primary;
      ctx.lineWidth = s * 0.13;
      ctx.lineCap = 'round';
      for (let i = 0; i < rays; i += 1) {
        const angle = (i / rays) * Math.PI * 2 + hashFloat(seed) * 0.8;
        const inner = s * 0.42;
        const outer = s * (0.78 + 0.18 * Math.sin(i * 2.1));
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        ctx.stroke();
      }
      const orb = ctx.createRadialGradient(0, 0, s * 0.05, 0, 0, s * 0.36);
      orb.addColorStop(0, '#ffffff');
      orb.addColorStop(1, primary);
      ctx.fillStyle = orb;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.34, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'social': {
      // Chat bubble with a chaotic little wing
      ctx.fillStyle = primary;
      drawRoundedRect(ctx, -s * 0.8, -s * 0.66, s * 1.6, s * 1.1, s * 0.4);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.28, s * 0.4);
      ctx.lineTo(-s * 0.5, s * 0.86);
      ctx.lineTo(0, s * 0.44);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.arc(i * s * 0.36, -s * 0.12, s * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = secondary;
      ctx.lineWidth = s * 0.12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s * 0.55, -s * 0.75);
      ctx.quadraticCurveTo(s * 0.95, -s * 0.95, s * 0.9, -s * 0.5);
      ctx.stroke();
      break;
    }
    case 'robotics': {
      // Friendly robot head, one antenna, unblinking optimism
      ctx.fillStyle = primary;
      drawRoundedRect(ctx, -s * 0.66, -s * 0.5, s * 1.32, s * 1.05, s * 0.24);
      ctx.fill();
      ctx.strokeStyle = primary;
      ctx.lineWidth = s * 0.1;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.lineTo(0, -s * 0.82);
      ctx.stroke();
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.arc(0, -s * 0.9, s * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#10141f';
      drawRoundedRect(ctx, -s * 0.46, -s * 0.26, s * 0.92, s * 0.4, s * 0.16);
      ctx.fill();
      ctx.fillStyle = '#7dfcff';
      ctx.beginPath();
      ctx.arc(-s * 0.2, -s * 0.06, s * 0.09, 0, Math.PI * 2);
      ctx.arc(s * 0.2, -s * 0.06, s * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#10141f';
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.moveTo(-s * 0.24, s * 0.3);
      ctx.quadraticCurveTo(0, s * 0.44, s * 0.24, s * 0.3);
      ctx.stroke();
      break;
    }
    case 'local_services': {
      // Paper bag hurtling forward with speed lines
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, -s * 0.5);
      ctx.lineTo(s * 0.56, -s * 0.5);
      ctx.lineTo(s * 0.66, s * 0.62);
      ctx.lineTo(-s * 0.5, s * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = secondary;
      ctx.lineWidth = s * 0.11;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-s * 0.16, -s * 0.5);
      ctx.quadraticCurveTo(0, -s * 0.86, s * 0.28, -s * 0.5);
      ctx.stroke();
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.66, -s * 0.28 + i * s * 0.34);
        ctx.lineTo(-s * (0.98 + i * 0.06), -s * 0.28 + i * s * 0.34);
        ctx.stroke();
      }
      break;
    }
    case 'finance': {
      // Winged coin, ascending (terms apply)
      ctx.strokeStyle = secondary;
      ctx.lineWidth = s * 0.12;
      ctx.lineCap = 'round';
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(dir * s * 0.5, -s * 0.05);
        ctx.quadraticCurveTo(dir * s * 0.95, -s * 0.4, dir * s * 0.85, s * 0.15);
        ctx.stroke();
      }
      const coin = ctx.createRadialGradient(-s * 0.12, -s * 0.12, s * 0.06, 0, 0, s * 0.55);
      coin.addColorStop(0, '#fff7d1');
      coin.addColorStop(1, primary);
      ctx.fillStyle = coin;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c2140';
      ctx.font = `900 ${Math.round(s * 0.7)}px 'Arial Black', system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, s * 0.04);
      break;
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Rooftop billboard face texture — big, readable, branded
// ---------------------------------------------------------------------------

// The world rebuilds on every poll tick; rasterizing signage is the expensive
// part, so finished textures are cached and flagged to survive scene disposal.
const textureCache = new Map<string, THREE.CanvasTexture>();

function cached(key: string, build: () => THREE.CanvasTexture): THREE.CanvasTexture {
  const existing = textureCache.get(key);
  if (existing) return existing;
  const texture = build();
  texture.userData.persistent = true;
  textureCache.set(key, texture);
  return texture;
}

export function createBillboardTexture(company: Pick<Company, 'name' | 'archetype' | 'stage'>, brand: BrandKit): THREE.CanvasTexture {
  return cached(`billboard|${company.name}|${company.archetype}|${company.stage}`, () => buildBillboardTexture(company, brand));
}

function buildBillboardTexture(company: Pick<Company, 'name' | 'archetype' | 'stage'>, brand: BrandKit): THREE.CanvasTexture {
  const width = 1024;
  const height = 448;
  const { canvas, ctx } = makeCanvas(width, height);
  if (!ctx) return toTexture(canvas);
  const failed = company.stage === 'failed';

  // Backdrop
  const bg = ctx.createLinearGradient(0, 0, width, height);
  if (failed) {
    bg.addColorStop(0, '#3c4048');
    bg.addColorStop(1, '#23262d');
  } else {
    bg.addColorStop(0, '#101733');
    bg.addColorStop(0.55, '#131d42');
    bg.addColorStop(1, '#0c1129');
  }
  ctx.fillStyle = bg;
  drawRoundedRect(ctx, 0, 0, width, height, 26);
  ctx.fill();

  // Diagonal sheen
  ctx.save();
  ctx.globalAlpha = failed ? 0.04 : 0.1;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(width * 0.55, 0);
  ctx.lineTo(width * 0.75, 0);
  ctx.lineTo(width * 0.35, height);
  ctx.lineTo(width * 0.15, height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Frame + marquee bulbs
  ctx.strokeStyle = failed ? '#6a6f79' : brand.primary;
  ctx.lineWidth = 14;
  drawRoundedRect(ctx, 10, 10, width - 20, height - 20, 20);
  ctx.stroke();
  if (!failed) {
    ctx.fillStyle = '#fff6c9';
    for (let i = 0; i < 26; i += 1) {
      const t = i / 25;
      ctx.beginPath();
      ctx.arc(34 + t * (width - 68), 26, 6, 0, Math.PI * 2);
      ctx.arc(34 + t * (width - 68), height - 26, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Logo panel on the left
  const logoBox = 260;
  ctx.save();
  ctx.globalAlpha = failed ? 0.5 : 1;
  ctx.fillStyle = failed ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.1)';
  drawRoundedRect(ctx, 52, height / 2 - logoBox / 2, logoBox, logoBox, 40);
  ctx.fill();
  drawCompanyLogo(ctx, 52 + logoBox / 2, height / 2, logoBox * 0.72, company.archetype, company.name, failed ? '#8b909c' : brand.primary, failed ? '#b8bdc9' : brand.secondary);
  ctx.restore();

  // Company name, auto-fit
  const textLeft = 350;
  const textWidth = width - textLeft - 56;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = failed ? '#a9adb8' : '#ffffff';
  let fontSize = 118;
  const displayName = company.name;
  do {
    ctx.font = `900 ${fontSize}px 'Arial Black', 'Segoe UI', system-ui, sans-serif`;
    fontSize -= 4;
  } while (ctx.measureText(displayName).width > textWidth && fontSize > 34);
  ctx.shadowColor = failed ? 'transparent' : brand.primary;
  ctx.shadowBlur = failed ? 0 : 26;
  ctx.fillText(displayName, textLeft, height / 2 + 8);
  ctx.shadowBlur = 0;

  // Tagline
  ctx.fillStyle = failed ? '#7d818c' : brand.secondary;
  ctx.font = `italic 600 44px Georgia, 'Times New Roman', serif`;
  let tagSize = 44;
  while (ctx.measureText(brand.tagline).width > textWidth && tagSize > 22) {
    tagSize -= 2;
    ctx.font = `italic 600 ${tagSize}px Georgia, 'Times New Roman', serif`;
  }
  ctx.fillText(brand.tagline, textLeft, height / 2 + 82);

  // Stage badge
  const badge = brand.stageLabel;
  ctx.font = `900 40px 'Arial Black', system-ui, sans-serif`;
  const badgeWidth = ctx.measureText(badge).width + 56;
  const badgeX = width - badgeWidth - 44;
  ctx.fillStyle = failed ? '#5a5e68' : brand.primary;
  drawRoundedRect(ctx, badgeX, 42, badgeWidth, 66, 33);
  ctx.fill();
  ctx.fillStyle = failed ? '#c9ccd4' : '#0c1129';
  ctx.textAlign = 'center';
  ctx.fillText(badge, badgeX + badgeWidth / 2, 90);

  if (failed) {
    // Weathering streaks + a slapped-on FOR LEASE stamp
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#14161c';
    for (let i = 0; i < 9; i += 1) {
      const x = hashFloat(`${company.name}:streak:${i}`) * width;
      ctx.fillRect(x, 22, 8 + hashFloat(`${company.name}:sw:${i}`) * 16, height - 44);
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(width * 0.52, height * 0.52);
    ctx.rotate(-0.16);
    ctx.fillStyle = '#fff3cf';
    drawRoundedRect(ctx, -260, -64, 520, 128, 16);
    ctx.fill();
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 10;
    drawRoundedRect(ctx, -248, -52, 496, 104, 12);
    ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.font = `900 76px 'Arial Black', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FOR LEASE', 0, 6);
    ctx.restore();
  }

  return toTexture(canvas);
}

// ---------------------------------------------------------------------------
// Street-level facade sign (horizontal strip above the entrance)
// ---------------------------------------------------------------------------

export function createFacadeSignTexture(name: string, brand: BrandKit, failed: boolean): THREE.CanvasTexture {
  return cached(`facade|${name}|${failed}`, () => buildFacadeSignTexture(name, brand, failed));
}

function buildFacadeSignTexture(name: string, brand: BrandKit, failed: boolean): THREE.CanvasTexture {
  const width = 1024;
  const height = 192;
  const { canvas, ctx } = makeCanvas(width, height);
  if (!ctx) return toTexture(canvas);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, failed ? '#4a4e57' : '#f7fbff');
  bg.addColorStop(1, failed ? '#31343b' : '#dcebf7');
  ctx.fillStyle = bg;
  drawRoundedRect(ctx, 0, 0, width, height, 24);
  ctx.fill();
  ctx.strokeStyle = failed ? '#666b76' : brand.primary;
  ctx.lineWidth = 12;
  drawRoundedRect(ctx, 8, 8, width - 16, height - 16, 18);
  ctx.stroke();

  ctx.fillStyle = failed ? '#9ca0ab' : '#152047';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fontSize = 104;
  do {
    ctx.font = `900 ${fontSize}px 'Arial Black', system-ui, sans-serif`;
    fontSize -= 4;
  } while (ctx.measureText(name).width > width - 96 && fontSize > 30);
  ctx.fillText(name, width / 2, height / 2 + 4);
  return toTexture(canvas);
}

// ---------------------------------------------------------------------------
// Generic label sprite (district names, activity icons, gag signs)
// ---------------------------------------------------------------------------

export function createTextSprite(text: string, options: { background: string; color: string; accent: string; square?: boolean; font?: string }) {
  const width = options.square ? 128 : 512;
  const height = options.square ? 128 : 150;
  const { canvas, ctx } = makeCanvas(width, height);
  if (ctx) {
    ctx.clearRect(0, 0, width, height);
    drawRoundedRect(ctx, 10, 10, width - 20, height - 20, options.square ? 58 : 42);
    ctx.fillStyle = options.background;
    ctx.fill();
    ctx.strokeStyle = options.accent;
    ctx.lineWidth = options.square ? 8 : 6;
    ctx.stroke();
    ctx.fillStyle = options.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = options.font ?? (options.square ? `900 70px 'Arial Black', system-ui, sans-serif` : `900 46px 'Arial Black', system-ui, sans-serif`);
    ctx.fillText(text, width / 2, height / 2 + (options.square ? 1 : 3), width - 42);
  }
  const texture = toTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(options.square ? 1.25 : 5.1, options.square ? 1.25 : 1.5, 1);
  return sprite;
}

// Small wooden/cardboard gag sign that lives in the world (not a sprite)
export function createGagSignTexture(lines: string[], style: 'cardboard' | 'banner' | 'neon' | 'caution'): THREE.CanvasTexture {
  return cached(`gag|${style}|${lines.join('¶')}`, () => buildGagSignTexture(lines, style));
}

function buildGagSignTexture(lines: string[], style: 'cardboard' | 'banner' | 'neon' | 'caution'): THREE.CanvasTexture {
  const width = 512;
  const height = 256;
  const { canvas, ctx } = makeCanvas(width, height);
  if (!ctx) return toTexture(canvas);

  if (style === 'cardboard') {
    ctx.fillStyle = '#c89355';
    drawRoundedRect(ctx, 0, 0, width, height, 14);
    ctx.fill();
    ctx.strokeStyle = '#a5763c';
    ctx.lineWidth = 8;
    ctx.setLineDash([26, 14]);
    drawRoundedRect(ctx, 10, 10, width - 20, height - 20, 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#3c2c16';
  } else if (style === 'banner') {
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, 0, 0, width, height, 30);
    ctx.fill();
    ctx.strokeStyle = '#ff4d80';
    ctx.lineWidth = 12;
    drawRoundedRect(ctx, 8, 8, width - 16, height - 16, 24);
    ctx.stroke();
    ctx.fillStyle = '#1c2140';
  } else if (style === 'caution') {
    ctx.fillStyle = '#ffd23e';
    drawRoundedRect(ctx, 0, 0, width, height, 12);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    for (let i = -2; i < 10; i += 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, 26);
      ctx.clip();
      ctx.translate(i * 72, 0);
      ctx.rotate(0.5);
      ctx.fillRect(0, -40, 30, 120);
      ctx.restore();
    }
    ctx.fillStyle = '#1a1a1a';
  } else {
    ctx.fillStyle = '#0c1129';
    drawRoundedRect(ctx, 0, 0, width, height, 24);
    ctx.fill();
    ctx.strokeStyle = '#66fff0';
    ctx.lineWidth = 10;
    drawRoundedRect(ctx, 8, 8, width - 16, height - 16, 18);
    ctx.stroke();
    ctx.fillStyle = '#9dfff5';
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = lines.length > 1 ? 58 : 72;
  const font = style === 'cardboard' ? `700 ${fontSize}px 'Comic Sans MS', 'Chalkboard SE', cursive` : `900 ${fontSize}px 'Arial Black', system-ui, sans-serif`;
  ctx.font = font;
  lines.forEach((line, index) => {
    const y = height / 2 + (index - (lines.length - 1) / 2) * (fontSize + 12) + (style === 'caution' ? 12 : 0);
    ctx.fillText(line, width / 2, y, width - 48);
  });
  return toTexture(canvas);
}

// ---------------------------------------------------------------------------
// Landscape textures
// ---------------------------------------------------------------------------

export function createTerrainTexture(): THREE.CanvasTexture {
  const size = 1024;
  const { canvas, ctx } = makeCanvas(size, size);
  if (!ctx) return toTexture(canvas);

  // Base grass gradient with big soft meadow blotches
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#7cc861');
  gradient.addColorStop(0.5, '#5cb457');
  gradient.addColorStop(1, '#469a52');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 60; i += 1) {
    const x = hashFloat(`meadow:${i}:x`) * size;
    const y = hashFloat(`meadow:${i}:y`) * size;
    const r = 40 + hashFloat(`meadow:${i}:r`) * 130;
    const blotch = ctx.createRadialGradient(x, y, 4, x, y, r);
    const tone = hashFloat(`meadow:${i}:t`);
    const color = tone > 0.72 ? '#9edB6e' : tone > 0.4 ? '#59ad4f' : '#7ec763';
    blotch.addColorStop(0, color);
    blotch.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = blotch;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Fine grass speckle
  for (let i = 0; i < 5200; i += 1) {
    const x = hashFloat(`grass:${i}:x`) * size;
    const y = hashFloat(`grass:${i}:y`) * size;
    const t = hashFloat(`grass:${i}:t`);
    ctx.fillStyle = t > 0.86 ? 'rgba(240,255,214,.5)' : t > 0.5 ? 'rgba(38,110,52,.4)' : 'rgba(120,200,110,.4)';
    ctx.fillRect(x, y, 1.6, 2.6);
  }

  // Wildflower dust
  for (let i = 0; i < 340; i += 1) {
    const x = hashFloat(`flower:${i}:x`) * size;
    const y = hashFloat(`flower:${i}:y`) * size;
    const t = hashFloat(`flower:${i}:c`);
    ctx.fillStyle = t > 0.66 ? '#ffd166' : t > 0.33 ? '#ff8fb5' : '#c99bff';
    ctx.beginPath();
    ctx.arc(x, y, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Meandering dirt footpaths
  ctx.strokeStyle = 'rgba(190,158,104,.6)';
  ctx.lineCap = 'round';
  for (let p = 0; p < 4; p += 1) {
    ctx.lineWidth = 9 - p;
    ctx.beginPath();
    let px = hashFloat(`path:${p}`) * size;
    let py = 0;
    ctx.moveTo(px, py);
    while (py < size) {
      px += (hashFloat(`path:${p}:${py}`) - 0.5) * 150;
      py += 60 + hashFloat(`path:${p}:step:${py}`) * 60;
      ctx.quadraticCurveTo(px, py - 30, px, py);
    }
    ctx.stroke();
  }

  const texture = toTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.4, 2);
  return texture;
}

export function createSkyTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(64, 512);
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#3d8ede');
    gradient.addColorStop(0.42, '#7cc4ef');
    gradient.addColorStop(0.72, '#c3ecf7');
    gradient.addColorStop(0.88, '#ffe8c9');
    gradient.addColorStop(1, '#ffd7a8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 512);
  }
  return toTexture(canvas);
}

export function createCloudSprite(scale: number): THREE.Sprite {
  const { canvas, ctx } = makeCanvas(256, 128);
  if (ctx) {
    const gradient = ctx.createRadialGradient(96, 58, 8, 96, 58, 94);
    gradient.addColorStop(0, 'rgba(255,255,255,.95)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(84, 74, 58, 26, 0, 0, Math.PI * 2);
    ctx.ellipse(120, 56, 46, 32, 0, 0, Math.PI * 2);
    ctx.ellipse(166, 72, 54, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,236,214,.35)';
    ctx.beginPath();
    ctx.ellipse(120, 88, 84, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: toTexture(canvas), transparent: true, opacity: 0.78, depthWrite: false }));
  sprite.scale.set(13 * scale, 6.5 * scale, 1);
  return sprite;
}

export function createFogSprite(scale: number): THREE.Sprite {
  const { canvas, ctx } = makeCanvas(512, 128);
  if (ctx) {
    for (let i = 0; i < 9; i += 1) {
      const x = 40 + i * 52 + hashFloat(`fog:${i}`) * 26;
      const y = 66 + Math.sin(i * 1.7) * 16;
      const r = 55 + hashFloat(`fogr:${i}`) * 30;
      const puff = ctx.createRadialGradient(x, y, 6, x, y, r);
      puff.addColorStop(0, 'rgba(244,250,255,.6)');
      puff.addColorStop(1, 'rgba(244,250,255,0)');
      ctx.fillStyle = puff;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: toTexture(canvas), transparent: true, opacity: 0.85, depthWrite: false }));
  sprite.scale.set(30 * scale, 7 * scale, 1);
  return sprite;
}

export function createCircleSprite(color: string): THREE.Sprite {
  const { canvas, ctx } = makeCanvas(96, 96);
  if (ctx) {
    const gradient = ctx.createRadialGradient(48, 48, 4, 48, 48, 46);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 96, 96);
  }
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: toTexture(canvas), transparent: true, depthWrite: false }));
}
