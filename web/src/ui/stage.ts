import type { ActionView, StatusView } from '@gameclaw/gamekit';
import { applyGrade, Bloom, type Grade } from '../gfx/art';
import { vignette } from '../gfx/backdrop';
import { Fx, glow } from '../gfx/fx';
import {
  bayer,
  type Ctx,
  ctx2d,
  easeOutBack,
  makeCanvas,
  rect,
  VH,
  VW,
  withAlpha,
} from '../gfx/pixel';
import type { Frame, GameScene, HitRegion } from '../gfx/scene';
import { drawText, isFontReady } from '../gfx/text';
import { tiny } from '../gfx/tiny';
import { lang, t } from '../i18n';
import { term } from '../i18n/terms';
import type { GameHost, HostEvent } from '../runtime/host';
import { sfx } from './sfx';

const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULT_GRADE: Grade = { top: '#6a5acd', bottom: '#1a0f3a', strength: 0.18, bloom: 0.45 };

/**
 * Renders one game: owns the visible canvas, the 384×216 back buffer, the
 * shared FX layer and the post pass (grade, bloom, vignette). Integer-scales to
 * the container. All HUD text lives in the DOM; the canvas only carries the
 * world, in-world callouts, the end banner and the agent badge.
 */
export class Stage {
  readonly canvas: HTMLCanvasElement;
  readonly #view: Ctx;
  readonly #buffer = makeCanvas(VW, VH);
  readonly #g: Ctx;
  readonly #fx = new Fx();
  readonly #bloom = new Bloom();
  // biome-ignore lint/suspicious/noExplicitAny: per-game state
  readonly #scene: GameScene<any>;
  readonly #host: GameHost;
  readonly #gameId: string;
  #raf = 0;
  #last = 0;
  #t = 0;
  #since = 0;
  #scale = 1;
  #running = false;
  #focus: ActionView | null = null;
  #hover: HitRegion | null = null;
  #agentPulse = 0;
  #banner = 0;
  #wipe = 1;
  #status: StatusView;
  #actions: ActionView[];
  readonly #unsub: () => void;
  readonly #resizeObs: ResizeObserver;
  readonly #termFn = (text: string) => term(this.#gameId, text);
  readonly #cueFn = (name: Parameters<Frame<unknown>['cue']>[0]) => sfx(name);
  onHitAction: ((actionId: string) => void) | null = null;
  /** Rolling frame-time stats for profiling (ms). */
  readonly perf = { avg: 0, worst: 0, frames: 0 };

  constructor(container: HTMLElement, host: GameHost) {
    this.#host = host;
    this.#gameId = host.id;
    this.#scene = host.module.createScene();
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'stage-canvas';
    this.canvas.setAttribute('role', 'img');
    container.appendChild(this.canvas);
    this.#view = ctx2d(this.canvas, false);
    this.#g = ctx2d(this.#buffer, false);
    this.#status = host.status();
    this.#actions = host.actions();
    this.#unsub = host.subscribe((e) => this.#onHost(e));
    this.#resizeObs = new ResizeObserver(() => this.resize());
    this.#resizeObs.observe(container);
    this.canvas.addEventListener('pointermove', (e) => this.#pointer(e, false));
    this.canvas.addEventListener('pointerleave', () => {
      this.#hover = null;
      this.canvas.style.cursor = '';
    });
    this.canvas.addEventListener('click', (e) => this.#pointer(e, true));
    this.#syncMotion();
    this.resize();
    this.#scene.reset?.(this.#frame(0));
    // biome-ignore lint/suspicious/noExplicitAny: dev-only capture hook for cover art
    if (import.meta.env.DEV) (window as any).__gcStage = this;
  }

  /** Dev-only: a clean frame (no focus, HUD, banner or badge) as a PNG data URL. */
  snapshot(): string {
    const focus = this.#focus;
    const pulse = this.#agentPulse;
    this.#focus = null;
    this.#hover = null;
    const g = this.#g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const f = { ...this.#frame(0), quiet: true };
    this.#scene.draw(f);
    const grade = this.#scene.grade?.(f.state) ?? DEFAULT_GRADE;
    applyGrade(g, grade);
    this.#bloom.apply(g, this.#buffer, grade.bloom ?? 0.45);
    vignette(g, grade.vignette ?? 0.9);
    const url = this.#buffer.toDataURL('image/png');
    this.#focus = focus;
    this.#agentPulse = pulse;
    return url;
  }

  set focus(action: ActionView | null) {
    this.#focus = action;
  }

  setLabel(text: string): void {
    this.canvas.setAttribute('aria-label', text);
  }

  #syncMotion(): void {
    const reduced = reducedMotion();
    this.#fx.motion = reduced ? 0 : 1;
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cw = parent.clientWidth;
    const ch = parent.clientHeight || (cw * VH) / VW;
    const fit = Math.max(0.25, Math.min((cw * dpr) / VW, (ch * dpr) / VH));
    const integer = Math.max(1, Math.floor(fit));
    const backing = Math.max(1, Math.ceil(fit));
    this.#scale = backing;
    const w = VW * backing;
    const h = VH * backing;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.#view.imageSmoothingEnabled = false;
    }
    // Integer scale when it fills ≥92% of the box; otherwise downsample the
    // next integer backing store smoothly (uniform look, no uneven pixels).
    const exact = integer / fit >= 0.92;
    const display = exact ? integer : fit;
    this.canvas.classList.toggle('is-smooth', !exact);
    this.canvas.style.width = `${(VW * display) / dpr}px`;
    this.canvas.style.height = `${(VH * display) / dpr}px`;
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#last = performance.now();
    const loop = (now: number) => {
      if (!this.#running) return;
      this.#raf = requestAnimationFrame(loop);
      if (document.hidden) {
        this.#last = now;
        return;
      }
      const dt = Math.min(0.05, (now - this.#last) / 1000);
      this.#last = now;
      const t0 = performance.now();
      this.#tick(dt);
      const ms = performance.now() - t0;
      const p = this.perf;
      p.frames += 1;
      p.avg += (ms - p.avg) * 0.05;
      p.worst = Math.max(p.worst * 0.995, ms);
    };
    this.#raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.#running = false;
    cancelAnimationFrame(this.#raf);
  }

  destroy(): void {
    this.stop();
    this.#unsub();
    this.#resizeObs.disconnect();
    this.canvas.remove();
  }

  /** Renders one frame synchronously (used by tests / screenshots). */
  renderOnce(): void {
    this.#tick(1 / 60);
  }

  // biome-ignore lint/suspicious/noExplicitAny: per-game state
  #frame(dt: number): Frame<any> {
    return {
      g: this.#g,
      t: this.#t,
      dt,
      fx: this.#fx,
      state: this.#host.session.state,
      status: this.#status,
      actions: this.#actions,
      focus: this.#focus,
      since: this.#since,
      turn: this.#status.turn,
      lang: lang(),
      term: this.#termFn,
      cue: this.#cueFn,
    };
  }

  #tick(rawDt: number): void {
    const dt = this.#fx.update(rawDt);
    this.#t += dt;
    this.#since += dt;
    this.#agentPulse = Math.max(0, this.#agentPulse - rawDt);
    this.#banner += rawDt;
    this.#wipe = Math.min(1, this.#wipe + rawDt * 2.4);
    const g = this.#g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    const f = this.#frame(dt);
    try {
      this.#scene.draw(f);
    } catch (error) {
      rect(g, 0, 0, VW, VH, '#12071a');
      drawText(g, 'render error', 8, 8, { color: '#ff6b6b' });
      console.error(error);
      this.stop();
    }
    this.#fx.drawParticles(g);
    this.#drawHover(g);
    const grade = this.#scene.grade?.(f.state) ?? DEFAULT_GRADE;
    applyGrade(g, grade);
    this.#bloom.apply(g, this.#buffer, grade.bloom ?? 0.45);
    vignette(g, grade.vignette ?? 0.9);
    if (isFontReady()) this.#scene.hud?.(f);
    this.#fx.drawFloats(g);
    this.#drawBanner(g);
    this.#drawAgentBadge(g);
    this.#drawWipe(g);
    this.#fx.drawFlash(g);
    const [sx, sy] = this.#fx.shakeOffset();
    const v = this.#view;
    v.imageSmoothingEnabled = false;
    v.fillStyle = '#05030c';
    v.fillRect(0, 0, this.canvas.width, this.canvas.height);
    v.drawImage(
      this.#buffer,
      Math.round(sx * this.#scale),
      Math.round(sy * this.#scale),
      this.canvas.width,
      this.canvas.height,
    );
  }

  #onHost(e: HostEvent): void {
    this.#syncMotion();
    this.#status = this.#host.status();
    this.#actions = this.#host.actions();
    this.#since = 0;
    this.#banner = 0;
    if (e.source === 'agent') this.#agentPulse = 2.4;
    const f = this.#frame(0);
    if (e.kind === 'new') {
      this.#fx.clear();
      this.#scene.reset?.(f);
      this.#wipe = 0;
      return;
    }
    try {
      this.#scene.react?.(f, e.outcome);
    } catch (error) {
      console.error(error);
    }
    if (e.outcome.status.outcome === 'won') {
      this.#fx.flash('#fff6c0', 0.5);
      this.#fx.addTrauma(0.3);
      for (let i = 0; i < 6; i += 1)
        this.#fx.burst(40 + i * 60, 70, {
          count: 22,
          colors: ['#ffe066', '#7cf0a0', '#ff7ad9', '#4fd1ff', '#ffffff'],
          speed: 130,
          gravity: 110,
          life: 1.8,
          size: 2,
        });
    } else if (e.outcome.status.outcome === 'lost') {
      this.#fx.flash('#ff2040', 0.35);
      this.#fx.addTrauma(0.6);
      this.#fx.freeze(0.12);
      this.#fx.impact(2);
    }
  }

  #drawBanner(g: Ctx): void {
    const outcome = this.#status.outcome;
    if (outcome === 'ongoing' || !isFontReady()) return;
    const k = Math.min(1, this.#banner * 3);
    const palette: Record<string, [string, string, string]> = {
      won: ['#2a1d05', '#ffd23f', '#fff4c0'],
      lost: ['#24040b', '#ff4d6d', '#ffd0d8'],
      aborted: ['#141420', '#a8a8c8', '#ffffff'],
    };
    const [bg, fg, hi] = palette[outcome] ?? palette.aborted!;
    const h = 30;
    const y = Math.round(VH / 2 - h / 2);
    // Two bars slide in from opposite sides, then the title pops.
    const slide = Math.round((1 - easeOutBack(k)) * VW);
    rect(g, -slide, y, VW, h, withAlpha(bg, 0.88));
    rect(g, slide, y, VW, 1, fg);
    rect(g, -slide, y + h - 1, VW, 1, fg);
    if (k < 0.6) return;
    const pop = easeOutBack(Math.min(1, (this.#banner - 0.2) * 4));
    glow(g, VW / 2, VH / 2, 80, fg, 0.16 + 0.05 * Math.sin(this.#t * 3));
    const key =
      outcome === 'won' ? 'banner.won' : outcome === 'lost' ? 'banner.lost' : 'banner.aborted';
    const text = t(key);
    if (lang() === 'en') {
      const s = pop > 0.9 ? 3 : 2;
      tiny(g, text, VW / 2, VH / 2 - (5 * s) / 2, {
        color: hi,
        outline: '#05030c',
        align: 'center',
        scale: s,
      });
    } else {
      drawText(g, text, VW / 2, VH / 2 - 12, {
        color: hi,
        align: 'center',
        scale: pop > 0.9 ? 2 : 1,
      });
    }
  }

  #drawAgentBadge(g: Ctx): void {
    if (this.#agentPulse <= 0) return;
    const a = Math.min(1, this.#agentPulse * 2);
    const x = VW - 44;
    const y = 6;
    g.globalAlpha = a;
    rect(g, x, y, 38, 11, '#05030c');
    rect(g, x + 1, y + 1, 36, 9, '#24124a');
    rect(g, x + 1, y + 1, 36, 1, '#5a3aa0');
    const on = Math.sin(this.#t * 8) > 0;
    rect(g, x + 4, y + 4, 3, 3, on ? '#c79bff' : '#6a4ab0');
    tiny(g, 'AGENT', x + 10, y + 3, { color: '#f0e0ff', outline: null });
    g.globalAlpha = 1;
  }

  #drawWipe(g: Ctx): void {
    if (this.#wipe >= 1) return;
    // Dithered fade from black: reads as a pixel transition, not a CSS fade.
    const d = 1 - this.#wipe;
    g.fillStyle = '#05030c';
    for (let y = 0; y < VH; y += 2)
      for (let x = 0; x < VW; x += 2) if (bayer(x >> 1, y >> 1) < d) g.fillRect(x, y, 2, 2);
  }

  #drawHover(g: Ctx): void {
    const regions = this.#scene.hits?.(this.#host.session.state, this.#actions) ?? [];
    const focusId = this.#focus?.id;
    for (const r of regions) {
      const hovered = this.#hover && this.#hover.actionId === r.actionId;
      if (!hovered && r.actionId !== focusId) continue;
      // Animated corner brackets instead of a full box: less noise, same read.
      const pulse = Math.round(1 + Math.sin(this.#t * 7));
      const x0 = Math.round(r.x) - pulse;
      const y0 = Math.round(r.y) - pulse;
      const x1 = Math.round(r.x + r.w) - 1 + pulse;
      const y1 = Math.round(r.y + r.h) - 1 + pulse;
      const c = hovered ? '#ffffff' : '#ffe9a8';
      const L = 4;
      const corners = [
        [x0, y0, 1, 1],
        [x1, y0, -1, 1],
        [x0, y1, 1, -1],
        [x1, y1, -1, -1],
      ] as const;
      for (const [off, col] of [
        [1, '#05030c'],
        [0, c],
      ] as const) {
        g.fillStyle = col;
        for (const [cx, cy, sx, sy] of corners) {
          g.fillRect((sx > 0 ? cx : cx - L + 1) + off, cy + off, L, 1);
          g.fillRect(cx + off, (sy > 0 ? cy : cy - L + 1) + off, 1, L);
        }
      }
    }
  }

  #pointer(e: MouseEvent, click: boolean): void {
    const rectEl = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rectEl.left) / rectEl.width) * VW;
    const y = ((e.clientY - rectEl.top) / rectEl.height) * VH;
    const regions = this.#scene.hits?.(this.#host.session.state, this.#actions) ?? [];
    const hit = regions.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) ?? null;
    if (hit?.actionId !== this.#hover?.actionId && hit) sfx('move');
    this.#hover = hit;
    this.canvas.style.cursor = hit ? 'pointer' : '';
    if (click && hit) this.onHitAction?.(hit.actionId);
  }
}
