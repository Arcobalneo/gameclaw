/**
 * Low-level pixel drawing kit. Every scene renders into a fixed 384×216
 * buffer which is then integer-scaled onto the visible canvas, so pixels stay
 * crisp at any window size.
 */
export const VW = 384;
export const VH = 216;

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function ctx2d(c: HTMLCanvasElement, alpha = true): Ctx {
  const g = c.getContext('2d', { alpha });
  if (!g) throw new Error('Canvas 2D is not available');
  g.imageSmoothingEnabled = false;
  return g;
}

/** 4×4 ordered-dither matrix normalised to [0,1). */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);

export function bayer(x: number, y: number): number {
  return BAYER4[(y & 3) * 4 + (x & 3)]!;
}

export function rect(g: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Rect with 1px bevel: light top-left, dark bottom-right. */
export function bevel(
  g: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  light: string,
  dark: string,
): void {
  rect(g, x, y, w, h, fill);
  rect(g, x, y, w, 1, light);
  rect(g, x, y, 1, h, light);
  rect(g, x, y + h - 1, w, 1, dark);
  rect(g, x + w - 1, y, 1, h, dark);
}

/** Pixel panel: dark outline, inner bevel, rounded 1px corners. */
export function panel(
  g: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = '#141026',
  edge = '#3b2f6b',
  outline = '#05030c',
): void {
  x = Math.round(x);
  y = Math.round(y);
  rect(g, x + 1, y, w - 2, h, outline);
  rect(g, x, y + 1, w, h - 2, outline);
  rect(g, x + 1, y + 1, w - 2, h - 2, edge);
  rect(g, x + 2, y + 2, w - 4, h - 4, fill);
}

/** Ordered-dither fill: density 0..1 of `color` over the area. */
export function dither(
  g: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  density: number,
): void {
  g.fillStyle = color;
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      if (bayer(x0 + i, y0 + j) < density) g.fillRect(x0 + i, y0 + j, 1, 1);
    }
  }
}

/** Filled pixel disc (midpoint-ish, no antialiasing). */
export function disc(g: Ctx, cx: number, cy: number, r: number, color: string): void {
  g.fillStyle = color;
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  const rr = r * r;
  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy += 1) {
    const span = Math.floor(Math.sqrt(Math.max(0, rr - dy * dy)));
    g.fillRect(x0 - span, y0 + dy, span * 2 + 1, 1);
  }
}

export function ellipse(
  g: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
): void {
  g.fillStyle = color;
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy += 1) {
    const k = 1 - (dy * dy) / (ry * ry);
    if (k < 0) continue;
    const span = Math.floor(rx * Math.sqrt(k));
    g.fillRect(x0 - span, y0 + dy, span * 2 + 1, 1);
  }
}

/** Bresenham line. */
export function line(g: Ctx, x0: number, y0: number, x1: number, y1: number, color: string): void {
  g.fillStyle = color;
  let ax = Math.round(x0);
  let ay = Math.round(y0);
  const bx = Math.round(x1);
  const by = Math.round(y1);
  const dx = Math.abs(bx - ax);
  const dy = -Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1;
  const sy = ay < by ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 2048; guard += 1) {
    g.fillRect(ax, ay, 1, 1);
    if (ax === bx && ay === by) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      ax += sx;
    }
    if (e2 <= dx) {
      err += dx;
      ay += sy;
    }
  }
}

/** Horizontal pixel bar with notches, e.g. HP. */
export function bar(
  g: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  fill: string,
  back = '#1b1530',
  hi = '#ffffff55',
): void {
  const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  rect(g, x - 1, y - 1, w + 2, h + 2, '#05030c');
  rect(g, x, y, w, h, back);
  const fw = Math.round(w * r);
  if (fw > 0) {
    rect(g, x, y, fw, h, fill);
    rect(g, x, y, fw, 1, hi);
  }
}

// ---------- colour helpers ----------

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = Number.parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/** Deterministic hash → [0,1). Used for procedural decoration only. */
export function hash01(n: number, salt = 0): number {
  let x = (n * 374761393 + salt * 668265263) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeOutCubic = (t: number): number => 1 - (1 - clamp(t, 0, 1)) ** 3;
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = clamp(t, 0, 1);
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};
export const easeInOut = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
};

/** Numeric value from a metric such as `16/18` or `46（目标 60-78）`. */
export function metricNumber(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const m = /-?\d+(\.\d+)?/.exec(value);
  return m ? Number(m[0]) : 0;
}

/** `[current, max]` from `a/b`, else `[n, fallbackMax]`. */
export function metricRatio(
  value: string | number | undefined,
  fallbackMax = 10,
): [number, number] {
  if (typeof value === 'string') {
    const m = /(-?\d+)\s*\/\s*(\d+)/.exec(value);
    if (m) return [Number(m[1]), Number(m[2])];
  }
  return [metricNumber(value), fallbackMax];
}
