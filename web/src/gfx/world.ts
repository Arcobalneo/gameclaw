import { glow } from './fx';
import { type Ctx, ellipse, mix, rect, VW, withAlpha } from './pixel';
import { drawText, fitText, textWidth } from './text';

/** Shared actor helpers used by the per-game scenes. */
export interface BlitOptions {
  scale?: number;
  alpha?: number;
  /** Squash (>1 wide/short) or stretch (<1 tall/thin). */
  squash?: number;
  flipY?: boolean;
  /** Anchor at bottom-centre instead of top-left. */
  anchor?: 'tl' | 'bc' | 'c';
  tint?: string;
  tintAlpha?: number;
}

const tintCache = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();

function tinted(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  let m = tintCache.get(src);
  if (!m) {
    m = new Map();
    tintCache.set(src, m);
  }
  let c = m.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d')!;
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    m.set(color, c);
  }
  return c;
}

export function blit(
  g: Ctx,
  s: HTMLCanvasElement,
  x: number,
  y: number,
  o: BlitOptions = {},
): void {
  const scale = o.scale ?? 1;
  const sq = o.squash ?? 1;
  const w = Math.round(s.width * scale * sq);
  const h = Math.round((s.height * scale) / sq);
  let dx = x;
  let dy = y;
  if (o.anchor === 'bc') {
    dx = x - w / 2;
    dy = y - h;
  } else if (o.anchor === 'c') {
    dx = x - w / 2;
    dy = y - h / 2;
  }
  const prev = g.globalAlpha;
  if (o.alpha !== undefined) g.globalAlpha = prev * o.alpha;
  if (o.flipY) {
    g.save();
    g.translate(Math.round(dx), Math.round(dy + h));
    g.scale(1, -1);
    g.drawImage(s, 0, 0, w, h);
    g.restore();
  } else g.drawImage(s, Math.round(dx), Math.round(dy), w, h);
  if (o.tint && (o.tintAlpha ?? 1) > 0) {
    g.globalAlpha = prev * (o.tintAlpha ?? 1);
    g.drawImage(tinted(s, o.tint), Math.round(dx), Math.round(dy), w, h);
  }
  g.globalAlpha = prev;
}

export function shadow(g: Ctx, x: number, y: number, w: number): void {
  ellipse(g, x, y, Math.max(2, w / 2), Math.max(1, w / 8), withAlpha('#000000', 0.45));
}

/** Small floating name plate. */
export function plate(
  g: Ctx,
  text: string,
  x: number,
  y: number,
  color = '#fff4d6',
  max = 120,
): void {
  const t = fitText(text, max);
  const w = textWidth(t) + 8;
  x = Math.max(w / 2 + 3, Math.min(VW - w / 2 - 3, x));
  rect(g, Math.round(x - w / 2), y - 1, w, 14, withAlpha('#05030c', 0.78));
  rect(g, Math.round(x - w / 2), y + 13, w, 1, withAlpha(color, 0.5));
  drawText(g, t, x, y, { color, align: 'center', outline: null });
}

/** Swaying kelp strand. */
export function kelp(g: Ctx, x: number, base: number, h: number, t: number, color: string): void {
  for (let i = 0; i < h; i += 1) {
    const k = i / h;
    const sway = Math.round(Math.sin(t * 1.6 + x * 0.1 + k * 3) * k * 4);
    g.fillStyle = i % 5 === 0 ? mix(color, '#ffffff', 0.2) : color;
    g.fillRect(x + sway, base - i, 2, 1);
    if (i % 6 === 3) g.fillRect(x + sway + (i % 12 === 3 ? 2 : -2), base - i, 2, 1);
  }
}

/** Glowing orb with pulsing core. */
export function orb(g: Ctx, x: number, y: number, r: number, color: string, t: number): void {
  glow(g, x, y, r * 3, color, 0.35 + 0.1 * Math.sin(t * 3));
  ellipse(g, x, y, r, r, mix(color, '#000000', 0.25));
  ellipse(g, x - 1, y - 1, r - 1, r - 1, color);
  rect(g, x - Math.round(r / 2), y - Math.round(r / 2), 2, 2, '#ffffff');
}

/** Row of progress pips. */
export function pips(
  g: Ctx,
  x: number,
  y: number,
  total: number,
  filled: number,
  color: string,
  current = -1,
  t = 0,
): void {
  for (let i = 0; i < total; i += 1) {
    const cx = x + i * 9;
    rect(g, cx - 1, y - 1, 8, 8, '#05030c');
    rect(g, cx, y, 6, 6, i < filled ? color : '#241a4a');
    if (i < filled) rect(g, cx, y, 6, 1, mix(color, '#ffffff', 0.5));
    if (i === current) {
      glow(g, cx + 3, y + 3, 8, color, 0.4 + 0.2 * Math.sin(t * 6));
      rect(g, cx + 2, y + 2, 2, 2, '#ffffff');
    }
  }
}

/** Short label of the n-th action, used for choice pedestals. */
export function actionLabel(actions: readonly { id: string; label: string }[], id: string): string {
  return actions.find((a) => a.id === id)?.label ?? id;
}
