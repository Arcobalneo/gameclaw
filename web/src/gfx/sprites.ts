import { ctx2d, hash01, makeCanvas, mix } from './pixel';

/**
 * Hand-authored pixel sprites. Each sprite is a list of rows where every char
 * is a palette key ('.' = transparent). Sprites are rasterised once per
 * palette variant and get an automatic 1px dark outline plus a top-left rim
 * light so they pop against the dark, glowing backdrops.
 */
export type Palette = Record<string, string>;

export interface SpriteDef {
  rows: readonly string[];
  pal: Palette;
}

export interface BuildOptions {
  outline?: string | null;
  rim?: string | null;
  flip?: boolean;
}

const cache = new Map<string, HTMLCanvasElement>();

export function buildSprite(
  def: SpriteDef,
  pal: Palette = {},
  opts: BuildOptions = {},
): HTMLCanvasElement {
  const palette = { ...def.pal, ...pal };
  const outline = opts.outline === undefined ? '#07040f' : opts.outline;
  const key = `${def.rows.join('/')}|${JSON.stringify(palette)}|${outline}|${opts.rim ?? ''}|${opts.flip ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const h = def.rows.length;
  const w = Math.max(...def.rows.map((r) => r.length));
  const c = makeCanvas(w + 2, h + 2);
  const g = ctx2d(c);
  const at = (x: number, y: number): string | undefined => {
    const ch = def.rows[y]?.[opts.flip ? w - 1 - x : x];
    return ch && ch !== '.' && ch !== ' ' ? palette[ch] : undefined;
  };
  if (outline) {
    g.fillStyle = outline;
    for (let y = -1; y <= h; y += 1)
      for (let x = -1; x <= w; x += 1) {
        if (at(x, y)) continue;
        if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))
          g.fillRect(x + 1, y + 1, 1, 1);
      }
  }
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const color = at(x, y);
      if (!color) continue;
      const rim = opts.rim && (!at(x, y - 1) || !at(x - 1, y)) ? mix(color, opts.rim, 0.45) : color;
      g.fillStyle = rim;
      g.fillRect(x + 1, y + 1, 1, 1);
    }
  if (cache.size > 400) cache.clear();
  cache.set(key, c);
  return c;
}

/** Procedural mirrored creature (space-invader style) from a seed. */
export function creatureSprite(
  seed: number,
  body: string,
  accent: string,
  size = 12,
): HTMLCanvasElement {
  const key = `creature|${seed}|${body}|${accent}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const half = Math.ceil(size / 2);
  const rows: string[] = [];
  for (let y = 0; y < size; y += 1) {
    let row = '';
    for (let x = 0; x < half; x += 1) {
      const cx = (half - x) / half;
      const cy = Math.abs(y - size * 0.55) / (size * 0.55);
      const p = 1 - (cx * 0.55 + cy * 0.75);
      const r = hash01(seed + x * 31 + y * 97, 7);
      let ch = '.';
      if (r < p + 0.25) ch = r < 0.18 ? 'a' : 'b';
      if (y > size * 0.65 && r < 0.3 && x % 2 === 0) ch = 'b';
      row += ch;
    }
    const mirror = row.split('').reverse().join('');
    rows.push(row + (size % 2 ? mirror.slice(1) : mirror));
  }
  const eyeY = Math.floor(size * 0.4);
  const eyeX = Math.max(1, Math.floor(half * 0.45));
  const setCh = (y: number, x: number, ch: string) => {
    const r = rows[y];
    if (!r) return;
    rows[y] = r.slice(0, x) + ch + r.slice(x + 1);
  };
  for (const ex of [half - 1 - eyeX, size - half + eyeX]) {
    setCh(eyeY, ex, 'w');
    setCh(eyeY + 1, ex, 'e');
  }
  const sprite = buildSprite(
    { rows, pal: { b: body, a: accent, w: '#ffffff', e: '#0b0718' } },
    {},
    { rim: '#ffffff' },
  );
  cache.set(key, sprite);
  return sprite;
}

export const SHRIMP: SpriteDef = {
  rows: [
    '..............w.w...',
    '............ww...w..',
    '......hhhh.w.....w..',
    '....hhbbbbhh..cc....',
    '..thbbbbbbbbhcccc...',
    '.ttbbbbbbbbbbecc....',
    'tttbdbdbdbbbbbb.....',
    '.tt.bbbbbbbbbb......',
    '..t..l.l.l.l........',
  ],
  pal: {
    b: '#ff6b4a',
    h: '#ffb08a',
    d: '#c23a2e',
    t: '#e8503a',
    c: '#ff8a5c',
    e: '#14081a',
    w: '#ffd6b0',
    l: '#a8302a',
  },
};

export const SHRIMP_WALK: SpriteDef = {
  rows: [
    '..............w.w...',
    '............ww...w..',
    '......hhhh.w.....w..',
    '....hhbbbbhh..cc....',
    '..thbbbbbbbbhcccc...',
    '.ttbbbbbbbbbbecc....',
    'tttbdbdbdbbbbbb.....',
    '.tt.bbbbbbbbbb......',
    '..t.l.l.l.l.........',
  ],
  pal: SHRIMP.pal,
};

export const SLIME: SpriteDef = {
  rows: [
    '....bbbbbb....',
    '..bbhhbbbbbb..',
    '.bbhhbbbbbbbb.',
    '.bhbbwebbwebb.',
    'bbbbbeebbeebbb',
    'bbbbbbbmmbbbbb',
    'bbbbbbbbbbbbbb',
    '.dbbbbbbbbbbd.',
    '..dddddddddd..',
  ],
  pal: { b: '#7cf0a0', h: '#d8ffe4', d: '#2f9a6a', w: '#ffffff', e: '#0b1a14', m: '#16402c' },
};

export const CRAB: SpriteDef = {
  rows: [
    '.cc..........cc.',
    'cccc...ee...cccc',
    '.ccc..eeee..ccc.',
    '...cbbbbbbbbc...',
    '..bbbhbbbbhbbb..',
    '.bbbbbbbbbbbbbb.',
    '..dbbbbbbbbbbd..',
    '.l.l.l....l.l.l.',
  ],
  pal: { b: '#e0453a', h: '#ff9b7a', d: '#8f2229', c: '#ff6a4a', e: '#14081a', l: '#b33232' },
};

export const GHOST: SpriteDef = {
  rows: [
    '....wwwww....',
    '..wwwwwwwww..',
    '.wwwwwwwwwww.',
    '.wwweewweeww.',
    'wwwweewweewww',
    'wwwwwwwwwwwww',
    'wwwwwwoowwwww',
    'wwwwwwoowwwww',
    'wwwwwwwwwwwww',
    'wwwwwwwwwwwww',
    'ww.www.www.ww',
    'w...w...w...w',
  ],
  pal: { w: '#cfe8ff', e: '#0b0718', o: '#2a1a40' },
};

export const PUMPKIN: SpriteDef = {
  rows: [
    '......gg......',
    '.....gg.......',
    '..oohoooohoo..',
    '.oohoooooohoo.',
    'oohooeooeoohoo',
    'oohoeeooeeohoo',
    'oohoooooooohoo',
    'oohoemmmmeohoo',
    '.oohoemmeohoo.',
    '..oohoooohoo..',
  ],
  pal: { o: '#ff8a1e', h: '#c4520f', g: '#5fae3a', e: '#ffe066', m: '#ffe066' },
};

export const PUMPKIN_PLAIN: SpriteDef = {
  rows: [
    '....gg....',
    '...gg.....',
    '.oohoohoo.',
    'oohoooohoo',
    'oohoooohoo',
    'oohoooohoo',
    '.oohoohoo.',
  ],
  pal: { o: '#ff9a2e', h: '#c4520f', g: '#5fae3a' },
};

export const SPROUT: SpriteDef = {
  rows: ['.g..g.', 'gg..gg', '.gggg.', '..gg..', '..gg..'],
  pal: { g: '#7ad94f' },
};

export const GUARD: SpriteDef = {
  rows: [
    '...hhhh...',
    '..hhhhhh..',
    '..sseess..',
    '..ssssss..',
    '...ssss...',
    '.uuuuuuuu.',
    'uuuubbuuuu',
    'su.uuuu.us',
    's..uuuu..s',
    '...pp.pp..',
    '...pp.pp..',
    '..kkk.kkk.',
  ],
  pal: {
    h: '#2b3a6b',
    s: '#f2c39a',
    e: '#14081a',
    u: '#3d5aa8',
    b: '#ffd166',
    p: '#1e2448',
    k: '#0d0f22',
  },
};

export const HERO: SpriteDef = {
  rows: [
    '...rrrr...',
    '..rrrrrr..',
    '..sseess..',
    '..ssssss..',
    '...ssss...',
    '..cccccc..',
    '.cccbbccc.',
    'sc.cccc.cs',
    '...cccc...',
    '...ll.ll..',
    '..kk..kk..',
  ],
  pal: {
    r: '#ff5d73',
    s: '#f6c9a0',
    e: '#14081a',
    c: '#5ad1c8',
    b: '#ffe066',
    l: '#33415e',
    k: '#14102a',
  },
};

export const COIN: SpriteDef = {
  rows: ['.yyy.', 'yhyyy', 'yhyoy', 'yyyoy', '.yyy.'],
  pal: { y: '#ffd23f', h: '#fff4b0', o: '#c9871b' },
};

export const HEART: SpriteDef = {
  rows: ['.rr.rr.', 'rhrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
  pal: { r: '#ff4d6d', h: '#ffc2cf' },
};

export const STAR: SpriteDef = {
  rows: ['...y...', '...y...', '.yyyyy.', '..yyy..', '.yy.yy.', 'y.....y'],
  pal: { y: '#ffe066' },
};

export const CHEST: SpriteDef = {
  rows: [
    '.wwwwwwwwww.',
    'wbbbbbbbbbbw',
    'wbhhhhhhhhbw',
    'yyyyyggyyyyy',
    'wbbbbggbbbbw',
    'wbbbbbbbbbbw',
    'wbbbbbbbbbbw',
    '.wwwwwwwwww.',
  ],
  pal: { w: '#6b3a1f', b: '#a85b2a', h: '#d98a4a', y: '#ffd23f', g: '#fff4b0' },
};

export const SCROLL: SpriteDef = {
  rows: ['dpppppppd', 'dpaaaaapd', 'dpppppppd', 'dpaaaapd.', 'dpppppppd'],
  pal: { d: '#8a5a2b', p: '#f3e2b3', a: '#3a2a1a' },
};

export const RACCOON: SpriteDef = {
  rows: ['g.....g.', 'gggggg..', 'gkwkwgg.', 'gggggggg', '.gggggg.', '.g.g.g.g'],
  pal: { g: '#8d8aa8', k: '#2a2440', w: '#ffffff' },
};

export const PIGEON: SpriteDef = {
  rows: ['..gg...', '.gkgg..', 'oggggg.', '..wgggg', '...gggg', '...y.y.'],
  pal: { g: '#9aa6c8', k: '#14081a', o: '#ffb347', w: '#d8e4ff', y: '#ffb347' },
};

export const CAT: SpriteDef = {
  rows: ['o...o...', 'oo.oo...', 'oooooo..', 'okook...', 'oooooooo', '.oooooo.', '.o.o.o.o'],
  pal: { o: '#ff9f43', k: '#14081a' },
};

export const CARROT: SpriteDef = {
  rows: ['.g.g', '..gg', '.oo.', 'ooo.', 'oo..', 'o...'],
  pal: { g: '#5fd35f', o: '#ff8c2a' },
};

export const BROCCOLI: SpriteDef = {
  rows: ['.gg.g.', 'gggggg', 'ghgggg', '.gggg.', '..ss..', '..ss..'],
  pal: { g: '#3fbf5f', h: '#9dff9d', s: '#a7d98a' },
};

export const TOMATO: SpriteDef = {
  rows: ['..gg..', '.rrrr.', 'rhrrrr', 'rrrrrr', '.rrrr.'],
  pal: { g: '#5fd35f', r: '#ff4848', h: '#ffb0a0' },
};

export const BOWL: SpriteDef = {
  rows: ['wwwwwwwwww', '.wbbbbbbw.', '..wbbbbw..', '...wwww...'],
  pal: { w: '#e8e4f8', b: '#a8b4e0' },
};

export const PERSON: SpriteDef = {
  rows: [
    '..hhhh..',
    '.hhhhhh.',
    '.ssssss.',
    '.sesses.',
    '..ssss..',
    '.cccccc.',
    'cccccccc',
    'cccccccc',
  ],
  pal: { h: '#3a2a4a', s: '#f2c39a', e: '#14081a', c: '#7a6af0' },
};

export const EEL: SpriteDef = {
  rows: [
    '..........yyyy....',
    '...ggggggggggggg..',
    '.ggggggggggggggeg.',
    'gg..yy...yy..ggggm',
    'g............ggg..',
  ],
  pal: { g: '#3fd0c0', y: '#fff36b', e: '#14081a', m: '#ff6b8a' },
};

export const JELLY: SpriteDef = {
  rows: ['..pppp..', '.pphhpp.', 'pphppppp', 'pppppppp', '.t.t.t.t', 't.t.t.t.', '.t...t..'],
  pal: { p: '#ff7ad9', h: '#ffd0f2', t: '#c25ab0' },
};

export const OCTOPUS: SpriteDef = {
  rows: [
    '...pppppp...',
    '..pphppppp..',
    '.ppppppppppp',
    '.ppweppwepp.',
    '.pppppppppp.',
    'p.pp.pp.pp.p',
    'p..p..p..p..',
  ],
  pal: { p: '#b06ad9', h: '#e8c0ff', w: '#ffffff', e: '#14081a' },
};

export const ANVIL: SpriteDef = {
  rows: [
    'dddddddddd..',
    '.ddhhhhhdddd',
    '..dddddddd..',
    '....dddd....',
    '...dddddd...',
    '..dddddddd..',
  ],
  pal: { d: '#4a5272', h: '#9aa6c8' },
};

export const FLAG: SpriteDef = {
  rows: ['prrrr', 'prrrr', 'prrr.', 'p....', 'p....', 'p....'],
  pal: { p: '#c8c8d8', r: '#ff4d6d' },
};

export const CAMERA_EYE: SpriteDef = {
  rows: ['kkkkk.', 'kgrgkk', 'kkkkk.', '..k...'],
  pal: { k: '#2a2f4a', g: '#5a6a9a', r: '#ff3b5c' },
};

export const BUN_TOP: SpriteDef = {
  rows: ['...bbbbbbbb...', '.bbbsbbbbsbbb.', 'bbhbbbbsbbbbbb', 'bbbbbbbbbbbbbb', 'dddddddddddddd'],
  pal: { b: '#f0a24a', h: '#ffd08a', s: '#fff4d0', d: '#b8672a' },
};

/** Generic recolourable ingredient slab for burgers etc. */
export function slab(w: number, h: number, color: string, wavy = false): SpriteDef {
  const rows: string[] = [];
  for (let y = 0; y < h; y += 1) {
    let row = '';
    for (let x = 0; x < w; x += 1) {
      const edge = (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
      if (edge) row += '.';
      else if (wavy && y === h - 1 && x % 3 === 1) row += 'd';
      else row += y === 0 ? 'h' : y === h - 1 ? 'd' : 'b';
    }
    rows.push(row);
  }
  return {
    rows,
    pal: { b: color, h: mix(color, '#ffffff', 0.35), d: mix(color, '#000000', 0.35) },
  };
}
