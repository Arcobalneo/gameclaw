import { glowSprite } from './fx';
import { type Ctx, ctx2d, hexToRgb, makeCanvas, rgbToHex, VH, VW } from './pixel';

/**
 * GameClaw art bible, in code.
 *
 * - One light: key light from the upper left, cool ambient from below.
 * - Hue-shifted ramps: shadows lean violet-blue, highlights lean warm gold.
 * - Selective outlines (selout): outlines take a darkened tint of the colour
 *   they wrap; only the bottom/right silhouette edge goes to full ink.
 * - Depth: far layers desaturate toward the game's fog colour; foreground
 *   layers are darkest and highest contrast.
 * - Every game owns a small palette built from the shared master ramps plus a
 *   grade (soft-light tint + bloom) so the whole arcade reads as one family.
 */
export const INK = '#0b0618';
export const KEY_LIGHT = '#fff1d0';
export const AMBIENT = '#2a1f5c';

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function hueToward(h: number, target: number, amount: number): number {
  let d = target - h;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return h + d * amount;
}

const shiftCache = new Map<string, string>();

/**
 * Hue-shifted tone step. `step` < 0 darkens toward violet, > 0 lightens toward
 * warm gold; |step| = 1 is one ramp step.
 */
export function shift(hex: string, step: number): string {
  const key = `${hex}|${step}`;
  const hit = shiftCache.get(key);
  if (hit) return hit;
  const [r, g, b] = hexToRgb(hex);
  let [h, s, l] = rgbToHsl(r, g, b);
  if (step < 0) {
    const k = Math.min(1, -step * 0.16);
    h = hueToward(h, 255, k * 0.9);
    l = Math.max(0.03, l * (1 - k * 1.1));
    s = Math.min(1, s * (1 + k * 0.3));
  } else if (step > 0) {
    const k = Math.min(1, step * 0.16);
    h = hueToward(h, 50, k * 0.6);
    l = Math.min(0.97, l + (1 - l) * k * 1.2);
    s = Math.max(0, s * (1 - k * 0.15));
  }
  const out = hslToHex(h, s, l);
  if (shiftCache.size > 4000) shiftCache.clear();
  shiftCache.set(key, out);
  return out;
}

/** Five-step ramp: [deep shadow, shadow, base, light, highlight]. */
export function ramp(base: string): [string, string, string, string, string] {
  return [shift(base, -3), shift(base, -1.5), base, shift(base, 1.2), shift(base, 2.6)];
}

/** Master ramps shared across games (bases; use `ramp()` for steps). */
export const MASTER = {
  coral: '#ff6b4a',
  gold: '#ffc94a',
  leaf: '#5cc96a',
  sea: '#2f8fd0',
  aqua: '#4fe0d0',
  violet: '#8a5ad8',
  rose: '#ff5d8a',
  stone: '#7a7f9a',
  wood: '#a8683a',
  skin: '#f0b890',
  bone: '#efe4cf',
  night: '#1a1440',
} as const;

// ---------- grade + bloom (post) ----------

export interface Grade {
  /** Soft-light tint at the top / bottom of the frame. */
  top: string;
  bottom: string;
  strength?: number;
  /** Bloom intensity 0..1 (default 0.55). */
  bloom?: number;
  /** Edge darkening 0..1 (default 0.9). */
  vignette?: number;
}

const gradeCache = new Map<string, HTMLCanvasElement>();

export function applyGrade(g: Ctx, grade: Grade): void {
  const key = `${grade.top}|${grade.bottom}`;
  let c = gradeCache.get(key);
  if (!c) {
    c = makeCanvas(VW, VH);
    const cg = ctx2d(c);
    const lg = cg.createLinearGradient(0, 0, 0, VH);
    lg.addColorStop(0, grade.top);
    lg.addColorStop(1, grade.bottom);
    cg.fillStyle = lg;
    cg.fillRect(0, 0, VW, VH);
    gradeCache.set(key, c);
  }
  const prevOp = g.globalCompositeOperation;
  g.globalCompositeOperation = 'soft-light';
  g.globalAlpha = grade.strength ?? 0.35;
  g.drawImage(c, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = prevOp;
}

/**
 * Cheap bloom: downsample → square twice via multiply (a soft threshold that
 * keeps only bright pixels) → upscale additively with smoothing. Buffers are
 * allocated once.
 */
export class Bloom {
  readonly #small = makeCanvas(VW / 4, VH / 4);
  readonly #sg = ctx2d(this.#small);
  readonly #tmp = makeCanvas(VW / 4, VH / 4);
  readonly #tg = ctx2d(this.#tmp);

  apply(g: Ctx, source: HTMLCanvasElement, intensity = 0.55): void {
    if (intensity <= 0) return;
    const w = this.#small.width;
    const h = this.#small.height;
    const sg = this.#sg;
    sg.imageSmoothingEnabled = true;
    sg.globalCompositeOperation = 'copy';
    sg.drawImage(source, 0, 0, w, h);
    sg.globalCompositeOperation = 'multiply';
    sg.drawImage(this.#small, 0, 0);
    sg.drawImage(this.#small, 0, 0);
    sg.globalCompositeOperation = 'source-over';
    // Blur by re-sampling down and up once more.
    const tg = this.#tg;
    tg.imageSmoothingEnabled = true;
    tg.globalCompositeOperation = 'copy';
    tg.drawImage(this.#small, 0, 0, w / 2, h / 2);
    tg.drawImage(this.#tmp, 0, 0, w / 2, h / 2, 0, 0, w, h);
    tg.globalCompositeOperation = 'source-over';
    const prevSmooth = g.imageSmoothingEnabled;
    const prevOp = g.globalCompositeOperation;
    g.imageSmoothingEnabled = true;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = intensity;
    g.drawImage(this.#tmp, 0, 0, VW, VH);
    g.globalAlpha = intensity * 0.6;
    g.drawImage(this.#small, 0, 0, VW, VH);
    g.globalAlpha = 1;
    g.globalCompositeOperation = prevOp;
    g.imageSmoothingEnabled = prevSmooth;
  }
}

// ---------- darkness + light pools ----------

/**
 * Night lighting: fills the frame with ambient darkness, then punches dithered
 * light pools out of it. One canvas reused every frame.
 */
export class LightMask {
  readonly #c = makeCanvas(VW, VH);
  readonly #g = ctx2d(this.#c);

  begin(color: string, alpha: number): void {
    const g = this.#g;
    g.globalCompositeOperation = 'copy';
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(0, 0, VW, VH);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-out';
  }

  light(x: number, y: number, radius: number, strength = 1): void {
    const s = glowSprite('#ffffff', radius);
    this.#g.globalAlpha = Math.min(1, strength);
    this.#g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2));
    this.#g.globalAlpha = 1;
  }

  /** Cone of light (e.g. a camera or a lamp shade). */
  cone(x: number, y: number, angle: number, spread: number, length: number, strength = 1): void {
    const g = this.#g;
    g.globalAlpha = Math.min(1, strength);
    const lg = g.createRadialGradient(x, y, 0, x, y, length);
    lg.addColorStop(0, 'rgba(255,255,255,1)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(x, y);
    g.arc(x, y, length, angle - spread / 2, angle + spread / 2);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
  }

  end(target: Ctx): void {
    this.#g.globalCompositeOperation = 'source-over';
    target.drawImage(this.#c, 0, 0);
  }
}

// ---------- animation helpers ----------

/** Critically-damped-ish spring for squash/stretch and follow-through. */
export class Spring {
  value: number;
  velocity = 0;
  target: number;
  constructor(
    initial = 0,
    readonly stiffness = 260,
    readonly damping = 14,
  ) {
    this.value = initial;
    this.target = initial;
  }
  step(dt: number): number {
    const a = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
    this.velocity += a * dt;
    this.value += this.velocity * dt;
    return this.value;
  }
  impulse(v: number): void {
    this.velocity += v;
  }
}

/** Idle breathing scale (vertical) — subtle, per-actor phase. */
export function breathe(t: number, phase = 0, amount = 0.05): number {
  return 1 + Math.sin(t * 2.4 + phase) * amount;
}

/** Anticipation → action → recovery curve over `dur` seconds. Returns -0.25..1..0. */
export function anticipate(since: number, dur = 0.45): number {
  const x = since / dur;
  if (x <= 0 || x >= 1) return 0;
  if (x < 0.25) return -Math.sin((x / 0.25) * Math.PI) * 0.25;
  if (x < 0.5) return Math.sin(((x - 0.25) / 0.25) * (Math.PI / 2));
  return 1 - (x - 0.5) / 0.5;
}
