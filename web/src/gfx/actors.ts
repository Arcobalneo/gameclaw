import { shift } from './art';
import type { SpriteDef } from './sprites';

/**
 * Procedural humanoid builder (art-bible compliant): 16×26 figures with
 * hand-tuned proportions, hair styles, two-tone clothing with a shaded right
 * side, blink and talk frames. Used by every game that needs people so the
 * cast reads as one family.
 */
export type HairStyle = 'short' | 'bob' | 'long' | 'bun' | 'spiky' | 'cap' | 'bald';
export type View = 'front' | 'back';

export interface HumanOptions {
  skin?: string;
  hair?: string;
  style?: HairStyle;
  shirt?: string;
  pants?: string;
  shoes?: string;
  accent?: string;
  view?: View;
  /** 0 = eyes open, 1 = blink. */
  blink?: boolean;
  /** Open mouth (talking / shouting). */
  talk?: boolean;
  /** Arm pose: 'down' | 'up' (cheer / reach) | 'eat' (one hand to mouth). */
  arms?: 'down' | 'up' | 'eat';
  /** Walk frame 0/1 alternates legs. */
  step?: 0 | 1;
  /** Upper body only (seated behind a table). */
  bust?: boolean;
  /** Mood mark on the face: frown brows. */
  angry?: boolean;
}

const W = 16;
const H = 26;

export function humanoid(o: HumanOptions = {}): SpriteDef {
  const grid: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => '.'));
  const put = (x: number, y: number, c: string) => {
    if (x >= 0 && x < W && y >= 0 && y < H) grid[y]![x] = c;
  };
  const fill = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) put(x, y, c);
  };
  const back = o.view === 'back';
  const style = o.style ?? 'short';
  // Head (face block x3..12, y2..10) — slightly wider at cheeks.
  fill(4, 2, 11, 10, 'S');
  fill(3, 4, 12, 9, 'S');
  fill(11, 4, 12, 9, 's'); // shaded right cheek
  put(4, 10, 's');
  put(11, 10, 's');
  // Ears.
  put(2, 6, 'S');
  put(13, 6, 's');
  // Hair.
  if (style !== 'bald') {
    fill(4, 0, 11, 1, 'H');
    fill(3, 1, 12, 3, 'H');
    put(2, 2, 'H');
    put(13, 2, 'h');
    fill(11, 1, 12, 3, 'h');
    if (back) {
      fill(3, 1, 12, 10, 'H');
      fill(10, 2, 12, 10, 'h');
      fill(2, 3, 2, 8, 'H');
      fill(13, 3, 13, 8, 'h');
      fill(5, 2, 8, 2, 'L');
      fill(4, 3, 6, 3, 'L');
      fill(4, 9, 11, 10, 'h');
    }
    if (style === 'bob' || style === 'long') {
      fill(2, 3, 3, style === 'long' ? 14 : 9, 'H');
      fill(12, 3, 13, style === 'long' ? 14 : 9, 'h');
      if (style === 'long') fill(3, 11, 12, 13, back ? 'H' : '.');
    }
    if (style === 'short' && !back) {
      put(3, 4, 'H');
      put(12, 4, 'h');
      put(5, 3, 'S');
      put(8, 3, 'S');
    }
    if (style === 'bun') {
      put(5, 1, 'L');
      put(6, 1, 'L');
    }
    if (!back) {
      put(5, 1, 'L');
      put(6, 1, 'L');
      put(7, 1, 'L');
    }
    if (style === 'spiky') {
      for (const x of [3, 6, 9, 12]) put(x, 0, 'H');
      put(5, 0, '.');
      put(8, 0, '.');
      put(11, 0, '.');
    }
    if (style === 'cap') {
      fill(3, 0, 12, 2, 'A');
      fill(10, 0, 12, 2, 'a');
      if (!back) fill(1, 3, 12, 3, 'a');
    }
  }
  // Face.
  if (!back) {
    const ey = 6;
    if (o.blink) {
      put(5, ey + 1, 'E');
      put(6, ey + 1, 'E');
      put(9, ey + 1, 'E');
      put(10, ey + 1, 'E');
    } else {
      put(5, ey, 'E');
      put(5, ey + 1, 'E');
      put(10, ey, 'E');
      put(10, ey + 1, 'E');
      put(6, ey, 'W');
      put(9, ey, 'W');
    }
    if (o.angry) {
      put(5, ey - 1, 'E');
      put(6, ey - 1, 'E');
      put(9, ey - 1, 'E');
      put(10, ey - 1, 'E');
    }
    put(4, ey + 2, 'B');
    put(11, ey + 2, 'B');
    if (o.talk) fill(7, ey + 3, 8, ey + 3, 'M');
    else {
      put(7, ey + 3, 'M');
      put(8, ey + 3, 'M');
    }
  }
  // Neck.
  fill(6, 11, 9, 11, 's');
  // Torso: rounded shoulders, shaded right side, sleeve folds.
  fill(4, 12, 11, 12, 'C');
  fill(2, 13, 13, 19, 'C');
  fill(10, 12, 11, 12, 'c');
  fill(10, 13, 13, 19, 'c');
  fill(3, 15, 3, 19, 'c');
  fill(12, 15, 12, 19, 'p');
  fill(4, 19, 11, 19, 'c');
  if (!back) {
    put(6, 12, 'A');
    put(9, 12, 'A');
    put(7, 13, 'A');
    put(8, 13, 'A');
  }
  // Arms.
  const arms = o.arms ?? 'down';
  if (arms === 'down') {
    fill(1, 13, 1, 19, 'C');
    fill(14, 13, 14, 19, 'c');
    put(1, 20, 'S');
    put(14, 20, 's');
  } else if (arms === 'up') {
    fill(1, 8, 1, 13, 'C');
    fill(14, 8, 14, 13, 'c');
    put(1, 7, 'S');
    put(14, 7, 's');
  } else {
    fill(1, 13, 1, 19, 'C');
    put(1, 20, 'S');
    fill(12, 11, 13, 13, 'c');
    put(11, 10, 's');
  }
  if (!o.bust) {
    // Legs.
    const step = o.step ?? 0;
    fill(4, 20, 7, 24, 'P');
    fill(8, 20, 11, 24, 'p');
    if (step === 1) {
      fill(4, 24, 7, 24, '.');
      fill(4, 23, 7, 23, 'P');
    }
    fill(3, 25, 7, 25, 'K');
    fill(8, 25, 12, 25, 'K');
    if (step === 1) {
      fill(3, 25, 7, 25, '.');
      fill(3, 24, 7, 24, 'K');
    }
  }
  const skin = o.skin ?? '#f0c09a';
  const hair = o.hair ?? '#3a2a4a';
  const shirt = o.shirt ?? '#7a6af0';
  const accent = o.accent ?? shift(shirt, 1.6);
  const pants = o.pants ?? '#2a2f55';
  return {
    rows: (o.bust ? grid.slice(0, 20) : grid).map((r) => r.join('')),
    pal: {
      S: skin,
      s: shift(skin, -1.2),
      H: hair,
      h: shift(hair, -1.2),
      L: shift(hair, 1.4),
      E: '#1a1028',
      W: '#ffffff',
      M: shift(skin, -2.6),
      B: shift('#ff8a8a', 0),
      C: shirt,
      c: shift(shirt, -1.3),
      A: accent,
      a: shift(accent, -1.2),
      P: pants,
      p: shift(pants, -1),
      K: o.shoes ?? '#1a1426',
    },
  };
}

export const SKINS = ['#f6d0b0', '#f0b890', '#d8986a', '#a8704a', '#7a4a32'] as const;
export const HAIRS = ['#2a1e30', '#4a2e22', '#7a4a2a', '#c88a3a', '#e8e0d0', '#5a3a8a'] as const;
