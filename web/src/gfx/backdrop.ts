import { glow } from './fx';
import { bayer, type Ctx, ctx2d, hash01, makeCanvas, mix, VH, VW } from './pixel';

/**
 * Shared backdrop toolkit: posterised dithered skies, procedural parallax
 * silhouettes, fog bands, god rays and a pixel vignette. Each game picks its
 * own palette so the art direction stays unified but every world feels distinct.
 */

const skyCache = new Map<string, HTMLCanvasElement>();

/** Vertical gradient posterised into bands with ordered dithering between them. */
export function sky(g: Ctx, stops: readonly string[], y0 = 0, h = VH, bands = 10): void {
  const key = `${stops.join(',')}|${h}|${bands}`;
  let c = skyCache.get(key);
  if (!c) {
    c = makeCanvas(VW, h);
    const sg = ctx2d(c);
    const n = stops.length - 1;
    for (let y = 0; y < h; y += 1) {
      const t = y / Math.max(1, h - 1);
      const band = t * bands;
      const lo = Math.floor(band);
      const frac = band - lo;
      for (let x = 0; x < VW; x += 1) {
        const b = Math.min(bands, lo + (bayer(x, y) < frac ? 1 : 0)) / bands;
        const seg = Math.min(n - 1, Math.floor(b * n));
        const local = b * n - seg;
        sg.fillStyle = mix(stops[seg]!, stops[seg + 1]!, local);
        sg.fillRect(x, y, 1, 1);
      }
    }
    skyCache.set(key, c);
  }
  g.drawImage(c, 0, y0);
}

export interface RidgeOptions {
  seed: number;
  base: number;
  amp: number;
  color: string;
  /** Feature width in pixels. */
  scale?: number;
  /** 'hills' | 'city' | 'reef' | 'spikes' | 'trees' */
  kind?: 'hills' | 'city' | 'reef' | 'spikes' | 'trees';
  /** Optional lit-edge colour along the top silhouette. */
  edge?: string;
  /** Lit windows for city kind. */
  windows?: string;
}

const ridgeCache = new Map<string, HTMLCanvasElement>();

function ridgeCanvas(o: RidgeOptions): HTMLCanvasElement {
  const key = JSON.stringify(o);
  const hit = ridgeCache.get(key);
  if (hit) return hit;
  const W = VW * 2;
  const c = makeCanvas(W, VH);
  const g = ctx2d(c);
  const scale = o.scale ?? 24;
  const heights: number[] = [];
  const kind = o.kind ?? 'hills';
  for (let x = 0; x < W; x += 1) {
    let h = 0;
    if (kind === 'city') {
      const cell = Math.floor(x / scale);
      const r = hash01(cell, o.seed);
      h = r < 0.15 ? o.amp * 0.2 : o.amp * (0.35 + r * 0.65);
      if (hash01(cell, o.seed + 9) > 0.8 && x % scale > scale * 0.4 && x % scale < scale * 0.6)
        h += o.amp * 0.25;
    } else if (kind === 'spikes') {
      const cell = Math.floor(x / scale);
      const r = hash01(cell, o.seed);
      const local = (x % scale) / scale;
      h = o.amp * r * (1 - Math.abs(local - 0.5) * 2);
    } else if (kind === 'trees') {
      const cell = Math.floor(x / scale);
      const r = hash01(cell, o.seed);
      const local = Math.abs((x % scale) / scale - 0.5) * 2;
      h = o.amp * (0.4 + 0.6 * r) * (1 - local ** 1.5) + o.amp * 0.15;
    } else {
      // hills / reef: sum of wrapped sines (period divides W so it tiles).
      const p = (k: number) => (2 * Math.PI * k * x) / W;
      h =
        o.amp *
        (0.5 +
          0.28 * Math.sin(p(2) + o.seed) +
          0.14 * Math.sin(p(5) + o.seed * 1.7) +
          0.08 * Math.sin(p(11) + o.seed * 2.3));
      if (kind === 'reef') h += (hash01(Math.floor(x / 3), o.seed) - 0.5) * o.amp * 0.18;
    }
    heights.push(Math.round(h));
  }
  g.fillStyle = o.color;
  for (let x = 0; x < W; x += 1) {
    const top = o.base - heights[x]!;
    g.fillRect(x, top, 1, VH - top);
  }
  if (o.edge) {
    g.fillStyle = o.edge;
    for (let x = 0; x < W; x += 1) {
      const top = o.base - heights[x]!;
      g.fillRect(x, top, 1, 1);
    }
  }
  if (kind === 'city' && o.windows) {
    g.fillStyle = o.windows;
    for (let x = 2; x < W - 2; x += 4) {
      const top = o.base - heights[x]! + 4;
      for (let y = top; y < o.base; y += 5)
        if (hash01(x * 13 + y, o.seed) > 0.72) g.fillRect(x, y, 2, 2);
    }
  }
  ridgeCache.set(key, c);
  return c;
}

/** Draws a tiling parallax silhouette offset by `scroll` pixels. */
export function ridge(g: Ctx, o: RidgeOptions, scroll = 0): void {
  const c = ridgeCanvas(o);
  const W = c.width;
  const off = ((Math.round(scroll) % W) + W) % W;
  g.drawImage(c, -off, 0);
  if (W - off < VW) g.drawImage(c, W - off, 0);
}

const fogCache = new Map<string, HTMLCanvasElement>();

/** Horizontal dithered fog band drifting over time (cached, tiles horizontally). */
export function fog(
  g: Ctx,
  t: number,
  y: number,
  h: number,
  color: string,
  density = 0.35,
  speed = 6,
): void {
  const key = `${color}|${h}|${density}`;
  let c = fogCache.get(key);
  if (!c) {
    const W = VW * 2;
    c = makeCanvas(W, h);
    const fg = ctx2d(c);
    fg.fillStyle = color;
    for (let j = 0; j < h; j += 1) {
      const fall = 1 - Math.abs(j - h / 2) / (h / 2);
      for (let x = 0; x < W; x += 1) {
        const p = (2 * Math.PI * x) / W;
        const wave = 0.5 + 0.3 * Math.sin(p * 6 + j * 0.3) + 0.2 * Math.sin(p * 13);
        if (bayer(x, j) < density * fall * wave) fg.fillRect(x, j, 1, 1);
      }
    }
    fogCache.set(key, c);
  }
  const W = c.width;
  const off = ((Math.floor(t * speed) % W) + W) % W;
  g.drawImage(c, -off, Math.round(y));
  g.drawImage(c, W - off, Math.round(y));
}

/** Slanted additive light shafts. */
export function godRays(g: Ctx, t: number, color: string, count = 4, alpha = 0.07): void {
  const prevOp = g.globalCompositeOperation;
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = color;
  for (let i = 0; i < count; i += 1) {
    const x0 = ((i * 97 + t * 4) % (VW + 120)) - 60;
    const w = 10 + (i % 3) * 8;
    g.globalAlpha = alpha * (0.6 + 0.4 * Math.sin(t * 0.7 + i));
    g.beginPath();
    g.moveTo(x0, 0);
    g.lineTo(x0 + w, 0);
    g.lineTo(x0 + w + 70, VH);
    g.lineTo(x0 + 70, VH);
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = prevOp;
}

let vignetteCanvas: HTMLCanvasElement | null = null;

/** Soft, posterised edge darkening (cached). Never dithers over UI. */
export function vignette(g: Ctx, strength = 1): void {
  if (!vignetteCanvas) {
    vignetteCanvas = makeCanvas(VW, VH);
    const vg = ctx2d(vignetteCanvas);
    for (let y = 0; y < VH; y += 2)
      for (let x = 0; x < VW; x += 2) {
        const dx = (x - VW / 2) / (VW / 2);
        const dy = (y - VH / 2) / (VH / 2);
        const d = Math.sqrt(dx * dx * 0.7 + dy * dy * 0.9);
        const a = Math.max(0, d - 0.7) * 1.1;
        if (a <= 0) continue;
        vg.fillStyle = `rgba(4,2,10,${(Math.round(Math.min(0.42, a) * 12) / 12).toFixed(3)})`;
        vg.fillRect(x, y, 2, 2);
      }
  }
  g.globalAlpha = strength;
  g.drawImage(vignetteCanvas, 0, 0);
  g.globalAlpha = 1;
}

/** Twinkling starfield. */
export function stars(
  g: Ctx,
  t: number,
  seed: number,
  count = 60,
  maxY = VH * 0.6,
  color = '#ffffff',
): void {
  for (let i = 0; i < count; i += 1) {
    const x = Math.floor(hash01(i, seed) * VW);
    const y = Math.floor(hash01(i, seed + 1) * maxY);
    const tw = Math.sin(t * (1 + hash01(i, seed + 2) * 3) + i);
    if (tw < -0.3) continue;
    g.fillStyle = tw > 0.8 ? color : mix(color, '#000000', 0.5);
    g.fillRect(x, y, 1, 1);
    if (tw > 0.95 && i % 5 === 0) glow(g, x, y, 4, color, 0.5);
  }
}

/** Big glowing moon/sun disc with halo. */
export function moon(g: Ctx, x: number, y: number, r: number, color: string, halo: string): void {
  glow(g, x, y, r * 4, halo, 0.35);
  glow(g, x, y, r * 2, halo, 0.4);
  g.fillStyle = color;
  for (let dy = -r; dy <= r; dy += 1) {
    const span = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillRect(x - span, y + dy, span * 2 + 1, 1);
  }
  g.fillStyle = mix(color, '#000000', 0.12);
  g.fillRect(x - Math.floor(r / 3), y - Math.floor(r / 4), 2, 2);
  g.fillRect(x + Math.floor(r / 4), y + Math.floor(r / 3), 3, 2);
}

const groundCache = new Map<string, HTMLCanvasElement>();

/** Ground strip with top highlight and dithered shading (cached). */
export function ground(g: Ctx, y: number, top: string, body: string, deep: string, seed = 1): void {
  const key = `${y}|${top}|${body}|${deep}|${seed}`;
  let c = groundCache.get(key);
  if (!c) {
    const h = Math.max(1, VH - y);
    c = makeCanvas(VW, h);
    const gg = ctx2d(c);
    gg.fillStyle = body;
    gg.fillRect(0, 0, VW, h);
    gg.fillStyle = top;
    gg.fillRect(0, 0, VW, 2);
    gg.fillStyle = deep;
    for (let j = 4; j < h; j += 1)
      for (let x = 0; x < VW; x += 1) if (bayer(x, j) < (j / h) * 0.8) gg.fillRect(x, j, 1, 1);
    gg.fillStyle = mix(top, body, 0.5);
    for (let x = 0; x < VW; x += 7)
      if (hash01(x, seed) > 0.55) gg.fillRect(x, 3 + Math.floor(hash01(x, seed + 3) * 6), 2, 1);
    groundCache.set(key, c);
  }
  g.drawImage(c, 0, Math.round(y));
}
