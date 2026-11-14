import { bayer, type Ctx, ctx2d, hexToRgb, makeCanvas, VH, VW } from './pixel';
import { drawText } from './text';

/**
 * Juice layer shared by every scene: pooled particles, floating text, screen
 * shake, flashes and hit-stop. All integer-snapped so it stays pixel-crisp.
 */
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
  shape: 'sq' | 'spark';
}

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
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
  shape?: 'sq' | 'spark';
}

const MAX_PARTICLES = 700;

export class Fx {
  particles: Particle[] = [];
  floats: Floater[] = [];
  shakeAmp = 0;
  shakeTime = 0;
  flashColor = '#ffffff';
  flashAlpha = 0;
  hitstop = 0;
  rand = Math.random;

  burst(x: number, y: number, o: BurstOptions = {}): void {
    const count = o.count ?? 14;
    const colors = o.colors ?? ['#ffffff', '#ffe066', '#ff8a5c'];
    for (let i = 0; i < count; i += 1) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = (o.angle ?? -Math.PI / 2) + (this.rand() - 0.5) * (o.spread ?? Math.PI * 2);
      const s = (o.speed ?? 60) * (0.35 + this.rand() * 0.9);
      const life = (o.life ?? 0.7) * (0.6 + this.rand() * 0.7);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        max: life,
        size: o.size ?? (this.rand() < 0.3 ? 2 : 1),
        color: colors[Math.floor(this.rand() * colors.length)]!,
        gravity: o.gravity ?? 120,
        drag: o.drag ?? 1.8,
        glow: o.glow ?? true,
        shape: o.shape ?? 'sq',
      });
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
  ): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({
      x,
      y,
      vx,
      vy,
      life,
      max: life,
      size,
      color,
      gravity: 0,
      drag: 0,
      glow,
      shape: 'sq',
    });
  }

  float(x: number, y: number, text: string, color = '#ffe066', life = 1.1): void {
    this.floats.push({ x, y, text, color, life, max: life });
    if (this.floats.length > 24) this.floats.shift();
  }

  shake(amp: number, time = 0.25): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeTime = Math.max(this.shakeTime, time);
  }

  flash(color: string, alpha = 0.6): void {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  freeze(seconds: number): void {
    this.hitstop = Math.max(this.hitstop, seconds);
  }

  /** Returns the scaled dt for the world (0 during hit-stop). */
  update(dt: number): number {
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return 0;
    }
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.floats.length - 1; i >= 0; i -= 1) {
      const f = this.floats[i]!;
      f.life -= dt;
      f.y -= 14 * dt;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    if (this.shakeTime === 0) this.shakeAmp = 0;
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.4);
    return dt;
  }

  shakeOffset(): [number, number] {
    if (this.shakeAmp <= 0) return [0, 0];
    const a = this.shakeAmp * Math.min(1, this.shakeTime * 4);
    return [Math.round((this.rand() - 0.5) * 2 * a), Math.round((this.rand() - 0.5) * 2 * a)];
  }

  drawParticles(g: Ctx): void {
    const prev = g.globalCompositeOperation;
    for (const p of this.particles) {
      const t = p.life / p.max;
      g.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
      g.globalAlpha = Math.min(1, t * 1.6);
      g.fillStyle = p.color;
      const s = t < 0.35 && p.size > 1 ? p.size - 1 : p.size;
      if (p.shape === 'spark') {
        const len = Math.min(4, Math.hypot(p.vx, p.vy) / 30);
        const nx = p.vx / (Math.hypot(p.vx, p.vy) || 1);
        const ny = p.vy / (Math.hypot(p.vx, p.vy) || 1);
        for (let k = 0; k <= len; k += 1)
          g.fillRect(Math.round(p.x - nx * k), Math.round(p.y - ny * k), 1, 1);
      } else g.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = prev;
  }

  drawFloats(g: Ctx): void {
    for (const f of this.floats) {
      const t = f.life / f.max;
      const pop = t > 0.85 ? 1 + (t - 0.85) * 4 : 1;
      drawText(g, f.text, f.x, f.y - (pop - 1) * 4, {
        color: f.color,
        align: 'center',
        alpha: Math.min(1, t * 2.5),
      });
    }
  }

  drawFlash(g: Ctx): void {
    if (this.flashAlpha <= 0.01) return;
    g.globalAlpha = this.flashAlpha;
    g.fillStyle = this.flashColor;
    g.fillRect(0, 0, VW, VH);
    g.globalAlpha = 1;
  }
}

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
  if (alpha <= 0) return;
  const s = glowSprite(color, radius);
  const prevOp = g.globalCompositeOperation;
  const prevA = g.globalAlpha;
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = prevA * Math.min(1, alpha);
  g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2));
  g.globalAlpha = prevA;
  g.globalCompositeOperation = prevOp;
}
