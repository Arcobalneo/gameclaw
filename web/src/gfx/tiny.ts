import { type Ctx, ctx2d, makeCanvas } from './pixel';

/**
 * Hand-drawn 5px bitmap font for in-world numbers and short Latin callouts
 * (damage pops, "PERFECT", "x3"). Readable at 1× and far crisper than
 * rasterising the 12px CJK face at sprite scale.
 */
const GLYPHS: Record<string, readonly string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#', '##', '.#', '.#', '.#'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '-': ['...', '...', '###', '...', '...'],
  '×': ['...', '#.#', '.#.', '#.#', '...'],
  x: ['...', '#.#', '.#.', '#.#', '...'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  '!': ['#', '#', '#', '.', '#'],
  '?': ['###', '..#', '.##', '...', '.#.'],
  '.': ['.', '.', '.', '.', '#'],
  ':': ['.', '#', '.', '#', '.'],
  "'": ['#', '#', '.', '.', '.'],
  ' ': ['..', '..', '..', '..', '..'],
  '★': ['..#..', '.###.', '#####', '.###.', '#...#'],
  '♥': ['##.##', '#####', '#####', '.###.', '..#..'],
  '·': ['.', '.', '#', '.', '.'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '#.#', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
};

const TINY_H = 5;
const cache = new Map<string, HTMLCanvasElement>();

export function tinyWidth(text: string): number {
  let w = 0;
  for (const ch of text.toUpperCase()) w += (GLYPHS[ch]?.[0]?.length ?? 3) + 1;
  return Math.max(0, w - 1);
}

function render(text: string, color: string, outline: string | null): HTMLCanvasElement {
  const key = `${text}|${color}|${outline ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const w = tinyWidth(text);
  const c = makeCanvas(w + 2, TINY_H + 3);
  const g = ctx2d(c);
  const paint = (dx: number, dy: number, col: string) => {
    g.fillStyle = col;
    let x = 0;
    for (const ch of text.toUpperCase()) {
      const glyph = GLYPHS[ch] ?? GLYPHS['?']!;
      for (let y = 0; y < glyph.length; y += 1)
        for (let i = 0; i < glyph[y]!.length; i += 1)
          if (glyph[y]![i] === '#') g.fillRect(1 + x + i + dx, 1 + y + dy, 1, 1);
      x += glyph[0]!.length + 1;
    }
  };
  if (outline) {
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [1, 1],
      [0, 2],
      [1, 2],
      [-1, 1],
    ] as const)
      paint(dx, dy, outline);
  }
  paint(0, 0, color);
  if (cache.size > 600) cache.clear();
  cache.set(key, c);
  return c;
}

export interface TinyOptions {
  color?: string;
  outline?: string | null;
  align?: 'left' | 'center' | 'right';
  scale?: number;
  alpha?: number;
}

/** Draw tiny text; (x, y) is the top-left (or anchor by `align`) of the glyph box. */
export function tiny(g: Ctx, text: string, x: number, y: number, o: TinyOptions = {}): number {
  if (!text) return 0;
  const s = o.scale ?? 1;
  const img = render(text, o.color ?? '#fff4d6', o.outline === undefined ? '#07040f' : o.outline);
  const w = tinyWidth(text) * s;
  let dx = x;
  if (o.align === 'center') dx = x - w / 2;
  else if (o.align === 'right') dx = x - w;
  const prev = g.globalAlpha;
  if (o.alpha !== undefined) g.globalAlpha = prev * o.alpha;
  g.drawImage(img, Math.round(dx - s), Math.round(y - s), img.width * s, img.height * s);
  g.globalAlpha = prev;
  return w;
}
