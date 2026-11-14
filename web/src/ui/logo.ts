import { INK } from '../gfx/art';
import { ctx2d, makeCanvas } from '../gfx/pixel';

/**
 * Chunky hand-built GAMECLAW wordmark: banded warm gradient face, extruded
 * depth, selout outline, and a periodic glint sweep.
 */
const G: Record<string, string[]> = {
  G: ['.#####.', '##.....', '##.....', '##..###', '##...##', '##...##', '.#####.'],
  A: ['..###..', '.##.##.', '##...##', '##...##', '#######', '##...##', '##...##'],
  M: ['##...##', '###.###', '#######', '##.#.##', '##...##', '##...##', '##...##'],
  E: ['#######', '##.....', '##.....', '######.', '##.....', '##.....', '#######'],
  C: ['.######', '##.....', '##.....', '##.....', '##.....', '##.....', '.######'],
  L: ['##.....', '##.....', '##.....', '##.....', '##.....', '##.....', '#######'],
  W: ['##...##', '##...##', '##...##', '##.#.##', '#######', '###.###', '##...##'],
};
const WORD = 'GAMECLAW';
const S = 3;
const DEPTH = 4;
const BANDS = ['#fff4d0', '#ffd27a', '#ffa25a', '#ff6f5a', '#e2486a'];

let base: HTMLCanvasElement | null = null;
let mask: HTMLCanvasElement | null = null;
const out = makeCanvas(1, 1);
const glint = makeCanvas(1, 1);

function build(): void {
  const gw = 7 * S;
  const gap = 2 * S;
  const w = WORD.length * gw + (WORD.length - 1) * gap;
  const h = 7 * S;
  mask = makeCanvas(w, h);
  const mg = ctx2d(mask);
  mg.fillStyle = '#fff';
  [...WORD].forEach((ch, i) => {
    const glyph = G[ch]!;
    glyph.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1)
        if (row[x] === '#') mg.fillRect(i * (gw + gap) + x * S, y * S, S, S);
    });
  });
  const pad = 3;
  base = makeCanvas(w + pad * 2, h + DEPTH + pad * 2);
  const bg = ctx2d(base);
  const tint = (color: string): HTMLCanvasElement => {
    const c = makeCanvas(w, h);
    const g = ctx2d(c);
    g.drawImage(mask!, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    return c;
  };
  // Outline (2px ink) around face + extrusion.
  const ink = tint(INK);
  for (let dy = -2; dy <= DEPTH + 2; dy += 1)
    for (let dx = -2; dx <= 2; dx += 1)
      if (Math.abs(dx) + Math.max(0, -dy) <= 3) bg.drawImage(ink, pad + dx, pad + dy);
  // Extruded depth: dark rose → violet.
  for (let d = DEPTH; d >= 1; d -= 1)
    bg.drawImage(tint(d > 2 ? '#3a1240' : '#7a2450'), pad, pad + d);
  // Face: posterised vertical bands.
  const face = makeCanvas(w, h);
  const fg = ctx2d(face);
  fg.drawImage(mask, 0, 0);
  fg.globalCompositeOperation = 'source-atop';
  BANDS.forEach((c, i) => {
    fg.fillStyle = c;
    const y0 = Math.floor((i / BANDS.length) * h);
    fg.fillRect(0, y0, w, Math.ceil(h / BANDS.length) + 1);
  });
  // 1px top highlight on each glyph row-top.
  fg.globalCompositeOperation = 'source-atop';
  fg.fillStyle = '#ffffff';
  fg.fillRect(0, 0, w, 1);
  bg.drawImage(face, pad, pad);
  out.width = glint.width = base.width;
  out.height = glint.height = base.height;
}

/** Returns the logo canvas for time `t` (seconds). */
export function logo(t: number): HTMLCanvasElement {
  if (!base || !mask) build();
  const g = ctx2d(out);
  g.clearRect(0, 0, out.width, out.height);
  g.drawImage(base!, 0, 0);
  // Glint: a 6px diagonal band sweeps across every 4.5 s, clipped to the face.
  const period = 4.5;
  const p = (t % period) / period;
  if (p < 0.35) {
    const x = -20 + (p / 0.35) * (out.width + 40);
    const gg = ctx2d(glint);
    gg.globalCompositeOperation = 'copy';
    gg.fillStyle = '#ffffff';
    gg.beginPath();
    gg.moveTo(x, 0);
    gg.lineTo(x + 6, 0);
    gg.lineTo(x - 8, out.height);
    gg.lineTo(x - 14, out.height);
    gg.closePath();
    gg.fill();
    gg.globalCompositeOperation = 'destination-in';
    gg.drawImage(mask!, 3, 3);
    g.globalAlpha = 0.8;
    g.drawImage(glint, 0, 0);
    g.globalAlpha = 1;
  }
  return out;
}
