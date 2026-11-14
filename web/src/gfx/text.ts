import { type Ctx, ctx2d, makeCanvas } from './pixel';

/**
 * Crisp pixel text. Strings are rasterised once with Fusion Pixel 12px, the
 * alpha channel is thresholded to 1-bit (no blurry antialiasing), optionally
 * outlined, and cached as a tiny canvas.
 */
export const FONT_FAMILY = 'FusionPixel';
const FONT = `12px ${FONT_FAMILY}, monospace`;
const LINE = 13;

let fontReady = false;
let fontPromise: Promise<void> | null = null;

/** Waits for the CSS-declared pixel font (see styles.css) so canvas text is crisp. */
export function loadPixelFont(): Promise<void> {
  if (fontPromise) return fontPromise;
  fontPromise = (async () => {
    try {
      await document.fonts.load(FONT, '虾A1');
    } catch (error) {
      console.warn('[gameclaw] pixel font failed to load; using fallback', error);
    }
    fontReady = true;
    cache.clear();
  })();
  return fontPromise;
}

export function isFontReady(): boolean {
  return fontReady;
}

interface TextOptions {
  color?: string;
  outline?: string | null;
  shadow?: string | null;
  align?: 'left' | 'center' | 'right';
  scale?: number;
  alpha?: number;
}

const cache = new Map<string, HTMLCanvasElement>();
let measureCtx: Ctx | null = null;

function measurer(): Ctx {
  if (!measureCtx) {
    measureCtx = ctx2d(makeCanvas(4, 4));
    measureCtx.font = FONT;
  }
  return measureCtx;
}

export function textWidth(text: string): number {
  const m = measurer();
  m.font = FONT;
  return Math.ceil(m.measureText(text).width);
}

function rasterise(
  text: string,
  color: string,
  outline: string | null,
  shadow: string | null,
): HTMLCanvasElement {
  const key = `${text}\u0000${color}\u0000${outline ?? ''}\u0000${shadow ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const w = textWidth(text) + 4;
  const h = LINE + 4;
  const base = makeCanvas(w, h);
  const bg = ctx2d(base);
  bg.font = FONT;
  bg.textBaseline = 'top';
  bg.fillStyle = '#fff';
  bg.fillText(text, 2, 2);
  const img = bg.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i]! >= 110 ? 255 : 0;
  bg.putImageData(img, 0, 0);
  const tint = (c: string): HTMLCanvasElement => {
    const t = makeCanvas(w, h);
    const tg = ctx2d(t);
    tg.drawImage(base, 0, 0);
    tg.globalCompositeOperation = 'source-in';
    tg.fillStyle = c;
    tg.fillRect(0, 0, w, h);
    return t;
  };
  const out = makeCanvas(w, h);
  const og = ctx2d(out);
  if (shadow) og.drawImage(tint(shadow), 1, 1);
  if (outline) {
    const o = tint(outline);
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const)
      og.drawImage(o, dx, dy);
  }
  og.drawImage(tint(color), 0, 0);
  if (cache.size > 900) cache.clear();
  cache.set(key, out);
  return out;
}

/** Draws text with its top-left (or anchor per `align`) at x,y in buffer pixels. Returns width. */
export function drawText(
  g: Ctx,
  text: string,
  x: number,
  y: number,
  opts: TextOptions = {},
): number {
  if (!text) return 0;
  const scale = opts.scale ?? 1;
  const img = rasterise(
    text,
    opts.color ?? '#f4ecff',
    opts.outline === undefined ? '#07040f' : opts.outline,
    opts.shadow ?? null,
  );
  const w = (img.width - 4) * scale;
  let dx = x;
  if (opts.align === 'center') dx = x - w / 2;
  else if (opts.align === 'right') dx = x - w;
  const prev = g.globalAlpha;
  if (opts.alpha !== undefined) g.globalAlpha = prev * opts.alpha;
  g.drawImage(
    img,
    Math.round(dx - 2 * scale),
    Math.round(y - 2 * scale),
    img.width * scale,
    img.height * scale,
  );
  g.globalAlpha = prev;
  return w;
}

/** Truncate text to fit `maxWidth` pixels with an ellipsis. */
export function fitText(text: string, maxWidth: number): string {
  if (textWidth(text) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (textWidth(`${text.slice(0, mid)}…`) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo)}…`;
}

/**
 * Wrap to `maxWidth`. Prefers spaces and hyphens so English labels stay whole
 * words. CJK still breaks per character. The last line ellipsizes only if a
 * single token cannot fit.
 */
export function wrapPixelText(text: string, maxWidth: number, maxLines = 4): string[] {
  const units = text.split(/(\s+|(?<=-))/u).filter((unit) => unit.length > 0);
  const lines: string[] = [];
  let current = '';
  const commit = (): boolean => {
    const full = lines.length + 1 >= maxLines;
    if (full && textWidth(current) > maxWidth) current = fitText(current.trimEnd(), maxWidth);
    lines.push(current.trimEnd());
    current = '';
    return lines.length >= maxLines;
  };
  for (const unit of units) {
    if (/^\s+$/.test(unit)) {
      if (current && textWidth(`${current} `) <= maxWidth) current += ' ';
      continue;
    }
    const chunks = textWidth(unit) <= maxWidth ? [unit] : [...unit];
    for (const chunk of chunks) {
      const next = current + chunk;
      if (current && textWidth(next) > maxWidth) {
        if (commit()) return lines;
      }
      current += chunk;
    }
  }
  if (current.trim()) {
    if (lines.length >= maxLines) lines[maxLines - 1] = fitText(lines[maxLines - 1]!, maxWidth);
    else commit();
  }
  return lines.filter((line) => line.length > 0);
}

/** Draws up to `maxLines` wrapped lines. Returns the block height in pixels. */
export function drawBlock(
  g: Ctx,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  opts: TextOptions & { maxLines?: number } = {},
): number {
  const lines = wrapPixelText(text, maxWidth, opts.maxLines ?? 2);
  lines.forEach((line, i) => {
    drawText(g, line, x, y + i * LINE, opts);
  });
  return lines.length * LINE;
}

export const TEXT_LINE = LINE;
