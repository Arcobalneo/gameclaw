import { bayer, type Ctx, ctx2d, hexToRgb, makeCanvas, VH, VW } from './pixel';
import { drawText } from './text';
import { tiny, tinyWidth } from './tiny';

/**
 * Juice layer shared by every scene: a fixed-size particle pool (no per-frame
 * allocation), floating callouts, trauma-based screen shake with directional
 * kick, colour flashes, impact frames and hit-stop. Everything snaps to the
 * pixel grid so it stays crisp.
 */
export type ParticleKind = 'sq' | 'spark' | 'dust' | 'ring' | 'drop' | 'ink' | 'steam' | 'ember';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
  glow: boolean;
  kind: ParticleKind;
  seed: number;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  big: boolean;
  active: boolean;
}

export interface BurstOptions {
  count?: number;
  colors?: readonly string[];
  speed?: number;
  life?: number;
  gravity?: number;
  size?: number;
  glow?: boolean;
  angle?: number;
  spread?: number;
  drag?: number;
  shape?: ParticleKind;
}

const MAX_PARTICLES = 900;
const MAX_FLOATS = 24;
/** Floats never rise into the top strip where scenes print titles. */
const FLOAT_MIN_Y = 22;

function blank(): Particle {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 1,
    size: 1,
    color: '#fff',
    gravity: 0,
    drag: 0,
    glow: false,
    kind: 'sq',
    seed: 0,
  };
}

export class Fx {
  readonly #pool: Particle[] = Array.from({ length: MAX_PARTICLES }, blank);
  #count = 0;
  readonly #floats: Floater[] = Array.from({ length: MAX_FLOATS }, () => ({
    x: 0,
    y: 0,
    text: '',
    color: '#fff',
    life: 0,
    max: 1,
    big: false,
    active: false,
  }));
  #floatCursor = 0;
  /** 0..1, decays linearly; shake amplitude is trauma². */
  trauma = 0;
  #shakeMax = 6;
  #kickX = 0;
  #kickY = 0;
  #kickVX = 0;
  #kickVY = 0;
  #time = 0;
  flashColor = '#ffffff';
  flashAlpha = 0;
  impactFrames = 0;
  hitstop = 0;
  /** Set to 0 under prefers-reduced-motion. */
  motion = 1;
  rand = Math.random;

  get particleCount(): number {
    return this.#count;
  }

  clear(): void {
    this.#count = 0;
    for (const f of this.#floats) f.active = false;
    this.trauma = 0;
    this.#kickX = this.#kickY = this.#kickVX = this.#kickVY = 0;
    this.impactFrames = 0;
  }

  #spawn(): Particle {
    if (this.#count < MAX_PARTICLES) return this.#pool[this.#count++]!;
    // Pool full: recycle a random live particle instead of allocating.
    return this.#pool[Math.floor(this.rand() * MAX_PARTICLES)]!;
  }

  burst(x: number, y: number, o: BurstOptions = {}): void {
    const count = Math.round((o.count ?? 14) * (this.motion ? 1 : 0.3));
    const colors = o.colors ?? ['#ffffff', '#ffe066', '#ff8a5c'];
    const kind = o.shape ?? 'sq';
    for (let i = 0; i < count; i += 1) {
      const a = (o.angle ?? -Math.PI / 2) + (this.rand() - 0.5) * (o.spread ?? Math.PI * 2);
      const s = (o.speed ?? 60) * (0.35 + this.rand() * 0.9);
      const life = (o.life ?? 0.7) * (0.6 + this.rand() * 0.7);
      const p = this.#spawn();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.life = life;
      p.max = life;
      p.size = o.size ?? (this.rand() < 0.3 ? 2 : 1);
      p.color = colors[Math.floor(this.rand() * colors.length)]!;
      p.gravity = o.gravity ?? 120;
      p.drag = o.drag ?? 1.8;
      p.glow = o.glow ?? (kind !== 'dust' && kind !== 'ink');
      p.kind = kind;
      p.seed = this.rand() * 100;
    }
  }

  /** Single drifting mote, for ambient emitters. */
  mote(
    x: number,
    y: number,
    vx: number,
    vy: number,
    color: string,
    life = 3,
    size = 1,
    glow = true,
    kind: ParticleKind = 'sq',
  ): void {
    if (this.#count >= MAX_PARTICLES * 0.8) return;
    const p = this.#spawn();
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.max = life;
    p.size = size;
    p.color = color;
    p.gravity = 0;
    p.drag = 0;
    p.glow = glow;
    p.kind = kind;
    p.seed = this.rand() * 100;
  }

  // ---- presets (one place to tune the look of every game) ----

  /** Bright directional sparks for hits. `dir` in radians. */
  sparks(x: number, y: number, dir = -Math.PI / 2, colors?: readonly string[], count = 18): void {
    this.burst(x, y, {
      count,
      colors: colors ?? ['#ffffff', '#fff2a8', '#ffb347'],
      speed: 170,
      spread: 1.6,
      angle: dir,
      gravity: 160,
      drag: 3,
      life: 0.45,
      shape: 'spark',
    });
  }

  /** Soft ground puffs (landings, footsteps). */
  dust(x: number, y: number, color = '#c8b8a0', count = 10): void {
    this.burst(x, y, {
      count,
      colors: [color],
      speed: 40,
      spread: 1.2,
      angle: -Math.PI / 2,
      gravity: -6,
      drag: 4,
      life: 0.7,
      size: 3,
      shape: 'dust',
      glow: false,
    });
  }

  /** Expanding shockwave ring. */
  ring(x: number, y: number, color = '#ffffff', radius = 24, life = 0.35): void {
    const p = this.#spawn();
    p.x = x;
    p.y = y;
    p.vx = radius;
    p.vy = 0;
    p.life = life;
    p.max = life;
    p.size = 1;
    p.color = color;
    p.gravity = 0;
    p.drag = 0;
    p.glow = true;
    p.kind = 'ring';
    p.seed = 0;
  }

  splash(x: number, y: number, color = '#9fe4ff', count = 16): void {
    this.burst(x, y, {
      count,
      colors: [color, '#ffffff'],
      speed: 110,
      spread: 1.4,
      angle: -Math.PI / 2,
      gravity: 320,
      drag: 0.6,
      life: 0.7,
      shape: 'drop',
    });
  }

  ink(x: number, y: number, color = '#1a1030', count = 10): void {
    this.burst(x, y, {
      count,
      colors: [color],
      speed: 50,
      gravity: 10,
      drag: 3,
      life: 1.1,
      size: 3,
      shape: 'ink',
      glow: false,
    });
  }

  steam(x: number, y: number, color = '#e8e8f0', count = 6): void {
    this.burst(x, y, {
      count,
      colors: [color],
      speed: 16,
      spread: 0.8,
      angle: -Math.PI / 2,
      gravity: -30,
      drag: 1,
      life: 1.4,
      size: 2,
      shape: 'steam',
      glow: false,
    });
  }

  embers(
    x: number,
    y: number,
    colors: readonly string[] = ['#ffb347', '#ff6b4a'],
    count = 8,
  ): void {
    this.burst(x, y, {
      count,
      colors,
      speed: 40,
      spread: 1.4,
      angle: -Math.PI / 2,
      gravity: -40,
      drag: 1.2,
      life: 1.4,
      shape: 'ember',
    });
  }

  float(x: number, y: number, text: string, color = '#ffe066', life = 1.1, big = false): void {
    const f = this.#floats[this.#floatCursor]!;
    this.#floatCursor = (this.#floatCursor + 1) % MAX_FLOATS;
    f.x = x;
    f.y = Math.max(FLOAT_MIN_Y, y);
    f.text = text;
    f.color = color;
    f.life = life;
    f.max = life;
    f.big = big;
    f.active = true;
  }

  /** Back-compat: amplitude in pixels → trauma. */
  shake(amp: number, _time = 0.25): void {
    this.addTrauma(Math.min(1, amp / 8));
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount * this.motion);
  }

  /** Directional camera punch (pixels) that springs back. */
  kick(dx: number, dy: number): void {
    this.#kickVX += dx * 40 * this.motion;
    this.#kickVY += dy * 40 * this.motion;
  }

  flash(color: string, alpha = 0.6): void {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha * (this.motion ? 1 : 0.35));
  }

  /** One- or two-frame inverted "impact frame" for the heaviest hits. */
  impact(frames = 2): void {
    if (this.motion) this.impactFrames = Math.max(this.impactFrames, frames);
  }

  freeze(seconds: number): void {
    this.hitstop = Math.max(this.hitstop, seconds * this.motion);
  }

  /** Tuned hit packages: light / medium / heavy. */
  hit(
    x: number,
    y: number,
    weight: 'light' | 'medium' | 'heavy',
    dir = 0,
    colors?: readonly string[],
  ): void {
    const w = weight === 'light' ? 0 : weight === 'medium' ? 1 : 2;
    this.freeze([0.035, 0.06, 0.11][w]!);
    this.addTrauma([0.18, 0.32, 0.55][w]!);
    this.kick(Math.cos(dir) * [1.5, 2.5, 4][w]!, Math.sin(dir) * [1.5, 2.5, 4][w]!);
    this.sparks(x, y, dir, colors, [10, 18, 28][w]);
    this.ring(x, y, colors?.[0] ?? '#ffffff', [14, 22, 34][w]!);
    if (w === 2) this.impact(2);
  }

  /** Returns the scaled dt for the world (0 during hit-stop). */
  update(dt: number): number {
    this.#time += dt;
    // Camera spring always runs so kicks settle even during hit-stop.
    const k = 220;
    const d = 18;
    this.#kickVX += (-k * this.#kickX - d * this.#kickVX) * dt;
    this.#kickVY += (-k * this.#kickY - d * this.#kickVY) * dt;
    this.#kickX += this.#kickVX * dt;
    this.#kickY += this.#kickVY * dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 3);
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return 0;
    }
    const pool = this.#pool;
    for (let i = this.#count - 1; i >= 0; i -= 1) {
      const p = pool[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        // Swap-remove: O(1), no allocation.
        this.#count -= 1;
        pool[i] = pool[this.#count]!;
        pool[this.#count] = p;
        continue;
      }
      if (p.kind === 'ring') continue;
      const kd = Math.max(0, 1 - p.drag * dt);
      p.vx *= kd;
      p.vy = p.vy * kd + p.gravity * dt;
      if (p.kind === 'steam') p.vx += Math.sin(this.#time * 3 + p.seed) * 8 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (const f of this.#floats) {
      if (!f.active) continue;
      f.life -= dt;
      const t = 1 - f.life / f.max;
      f.y = Math.max(FLOAT_MIN_Y, f.y - (22 * (1 - t) + 2) * dt);
      if (f.life <= 0) f.active = false;
    }
    return dt;
  }

  shakeOffset(): [number, number] {
    const a = this.trauma * this.trauma * this.#shakeMax * this.motion;
    const t = this.#time * 38;
    const nx = Math.sin(t) * 0.6 + Math.sin(t * 2.3 + 1.7) * 0.4;
    const ny = Math.sin(t * 1.3 + 4.1) * 0.6 + Math.sin(t * 2.9 + 0.3) * 0.4;
    return [Math.round(nx * a + this.#kickX), Math.round(ny * a + this.#kickY)];
  }

  drawParticles(g: Ctx): void {
    const prev = g.globalCompositeOperation;
    const pool = this.#pool;
    for (let i = 0; i < this.#count; i += 1) {
      const p = pool[i]!;
      const t = p.life / p.max;
      g.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
      g.fillStyle = p.color;
      const px = Math.round(p.x);
      const py = Math.round(p.y);
      switch (p.kind) {
        case 'spark': {
          g.globalAlpha = Math.min(1, t * 2);
          const sp = Math.hypot(p.vx, p.vy) || 1;
          const len = Math.min(6, sp / 26);
          const nx = p.vx / sp;
          const ny = p.vy / sp;
          for (let k = 0; k <= len; k += 1)
            g.fillRect(Math.round(p.x - nx * k), Math.round(p.y - ny * k), 1, 1);
          break;
        }
        case 'ring': {
          const e = 1 - t;
          const r = Math.round(p.vx * (1 - (1 - e) ** 3));
          g.globalAlpha = t * 0.9;
          // Pixel circle outline (8-way symmetric plot).
          let x = r;
          let y = 0;
          let err = 1 - r;
          while (x >= y) {
            g.fillRect(px + x, py + y, 1, 1);
            g.fillRect(px - x, py + y, 1, 1);
            g.fillRect(px + x, py - y, 1, 1);
            g.fillRect(px - x, py - y, 1, 1);
            g.fillRect(px + y, py + x, 1, 1);
            g.fillRect(px - y, py + x, 1, 1);
            g.fillRect(px + y, py - x, 1, 1);
            g.fillRect(px - y, py - x, 1, 1);
            y += 1;
            if (err < 0) err += 2 * y + 1;
            else {
              x -= 1;
              err += 2 * (y - x) + 1;
            }
          }
          break;
        }
        case 'dust':
        case 'steam':
        case 'ink': {
          const grow = p.kind === 'ink' ? 1 + (1 - t) * 2 : 1 + (1 - t) * 1.5;
          const s = Math.max(1, Math.round(p.size * grow));
          // Dither-out instead of alpha so it reads as pixel smoke.
          g.globalAlpha = p.kind === 'ink' ? 0.9 : 0.75;
          const density = t;
          for (let yy = 0; yy < s; yy += 1)
            for (let xx = 0; xx < s; xx += 1) {
              const cx = xx - (s - 1) / 2;
              const cy = yy - (s - 1) / 2;
              if (cx * cx + cy * cy > (s / 2) * (s / 2) + 0.5) continue;
              if (bayer(px + xx, py + yy) < density)
                g.fillRect(px + xx - (s >> 1), py + yy - (s >> 1), 1, 1);
            }
          break;
        }
        case 'drop': {
          g.globalAlpha = Math.min(1, t * 2);
          g.fillRect(px, py, 1, 1);
          if (Math.abs(p.vy) > 40) g.fillRect(px, py - Math.sign(p.vy), 1, 1);
          break;
        }
        case 'ember': {
          const flicker = Math.sin(this.#time * 20 + p.seed) > -0.3;
          g.globalAlpha = flicker ? Math.min(1, t * 1.8) : 0.3;
          g.fillRect(px, py, 1, 1);
          break;
        }
        default: {
          g.globalAlpha = Math.min(1, t * 1.6);
          const s = t < 0.35 && p.size > 1 ? p.size - 1 : p.size;
          g.fillRect(px, py, s, s);
        }
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = prev;
  }

  drawFloats(g: Ctx): void {
    for (const f of this.#floats) {
      if (!f.active) continue;
      const t = 1 - f.life / f.max;
      // Pop in big, settle with overshoot, fade out at the end.
      const scaleIn = t < 0.12 ? 2 : 1;
      const alpha = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
      const ascii = /^[\x20-\x7e×★♥·]*$/.test(f.text);
      if (ascii) {
        const s = (f.big ? 2 : 1) * scaleIn;
        tiny(g, f.text, f.x, f.y - (s > 1 ? 2 : 0), {
          color: f.color,
          align: 'center',
          scale: s,
          alpha,
        });
      } else {
        drawText(g, f.text, f.x, f.y - 6, { color: f.color, align: 'center', alpha });
      }
    }
  }

  drawFlash(g: Ctx): void {
    if (this.impactFrames > 0) {
      this.impactFrames -= 1;
      const prev = g.globalCompositeOperation;
      g.globalCompositeOperation = 'difference';
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, VW, VH);
      g.globalCompositeOperation = prev;
    }
    if (this.flashAlpha <= 0.01) return;
    const prev = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = this.flashAlpha;
    g.fillStyle = this.flashColor;
    g.fillRect(0, 0, VW, VH);
    g.globalAlpha = 1;
    g.globalCompositeOperation = prev;
  }
}

export { tinyWidth };

// ---------- pixel glow sprites ----------

const glowCache = new Map<string, HTMLCanvasElement>();

/** Dithered, stepped radial glow — reads as pixel-art light, not a smooth blur. */
export function glowSprite(color: string, radius: number): HTMLCanvasElement {
  const r = Math.max(2, Math.round(radius));
  const key = `${color}|${r}`;
  const hit = glowCache.get(key);
  if (hit) return hit;
  const size = r * 2 + 1;
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const img = g.createImageData(size, size);
  const [cr, cg, cb] = hexToRgb(color);
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x - r, y - r) / r;
      if (d >= 1) continue;
      const a = (1 - d) ** 1.8;
      const level = Math.floor(a * 5 + bayer(x, y) * 0.999) / 5;
      if (level <= 0) continue;
      const i = (y * size + x) * 4;
      img.data[i] = cr;
      img.data[i + 1] = cg;
      img.data[i + 2] = cb;
      img.data[i + 3] = Math.round(level * 255);
    }
  g.putImageData(img, 0, 0);
  if (glowCache.size > 200) glowCache.clear();
  glowCache.set(key, c);
  return c;
}

/** Additive pixel glow centred at x,y. */
export function glow(
  g: Ctx,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha = 0.5,
): void {
  if (alpha <= 0 || radius < 1) return;
  const s = glowSprite(color, radius);
  const prevOp = g.globalCompositeOperation;
  const prevA = g.globalAlpha;
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = prevA * Math.min(1, alpha);
  g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2));
  g.globalAlpha = prevA;
  g.globalCompositeOperation = prevOp;
}
