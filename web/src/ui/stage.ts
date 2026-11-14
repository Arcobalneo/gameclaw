import type { ActionView, Metric, StatusView } from '@gameclaw/gamekit';
import { vignette } from '../gfx/backdrop';
import { Fx, glow } from '../gfx/fx';
import {
  type Ctx,
  ctx2d,
  makeCanvas,
  metricNumber,
  panel,
  rect,
  VH,
  VW,
  withAlpha,
} from '../gfx/pixel';
import type { Frame, GameScene, HitRegion } from '../gfx/scene';
import { drawText, fitText, isFontReady, textWidth } from '../gfx/text';
import type { GameHost, HostEvent } from '../runtime/host';

const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Renders one game: owns the visible canvas, the 384×216 back buffer, the
 * shared FX layer and the in-canvas HUD. Integer-scales to the container.
 */
export class Stage {
  readonly canvas: HTMLCanvasElement;
  readonly #view: Ctx;
  readonly #buffer = makeCanvas(VW, VH);
  readonly #g: Ctx;
  readonly #fx = new Fx();
  // biome-ignore lint/suspicious/noExplicitAny: per-game state
  readonly #scene: GameScene<any>;
  readonly #host: GameHost;
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
  #status: StatusView;
  #actions: ActionView[];
  #chipX = new Map<string, number>();
  readonly #unsub: () => void;
  readonly #resizeObs: ResizeObserver;
  onHitAction: ((actionId: string) => void) | null = null;

  constructor(container: HTMLElement, host: GameHost) {
    this.#host = host;
    this.#scene = host.module.createScene();
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'stage-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', `${host.module.definition.meta.name} 游戏画面`);
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
    if (reducedMotion()) this.#fx.rand = () => 0.5;
    this.resize();
    this.#scene.reset?.(this.#frame(0));
  }

  set focus(action: ActionView | null) {
    this.#focus = action;
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cw = parent.clientWidth;
    const ch = parent.clientHeight || (cw * VH) / VW;
    const fit = Math.max(0.25, Math.min((cw * dpr) / VW, (ch * dpr) / VH));
    // Backing store is always an integer multiple of the 384×216 buffer (crisp
    // pixels). CSS size uses the integer scale when it fills ≥85% of the box,
    // otherwise the whole box (nearest-neighbour, still pixelated).
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
    const display = integer / fit >= 0.85 ? integer : fit;
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
      this.#tick(dt);
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
    };
  }

  #tick(rawDt: number): void {
    const dt = this.#fx.update(rawDt);
    this.#t += dt;
    this.#since += dt;
    this.#agentPulse = Math.max(0, this.#agentPulse - rawDt);
    this.#banner += rawDt;
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
    vignette(g, 0.9);
    if (isFontReady()) this.#scene.hud?.(f);
    this.#drawHud(g);
    this.#fx.drawFloats(g);
    this.#drawBanner(g);
    if (!reducedMotion()) this.#fx.drawFlash(g);
    const [sx, sy] = reducedMotion() ? [0, 0] : this.#fx.shakeOffset();
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
    const before = this.#status;
    this.#status = this.#host.status();
    this.#actions = this.#host.actions();
    this.#since = 0;
    this.#banner = 0;
    if (e.source === 'agent') this.#agentPulse = 2.4;
    const f = this.#frame(0);
    if (e.kind === 'new') {
      this.#fx.particles.length = 0;
      this.#fx.floats.length = 0;
      this.#scene.reset?.(f);
      this.#fx.flash('#ffffff', 0.35);
      return;
    }
    this.#metricDeltas(before.metrics, this.#status.metrics);
    try {
      this.#scene.react?.(f, e.outcome);
    } catch (error) {
      console.error(error);
    }
    if (e.outcome.status.outcome === 'won') {
      this.#fx.flash('#fff6c0', 0.7);
      for (let i = 0; i < 6; i += 1)
        this.#fx.burst(40 + i * 60, 60, {
          count: 26,
          colors: ['#ffe066', '#7cf0a0', '#ff7ad9', '#4fd1ff'],
          speed: 120,
          gravity: 90,
          life: 1.6,
        });
    } else if (e.outcome.status.outcome === 'lost') {
      this.#fx.flash('#ff2040', 0.55);
      this.#fx.shake(5, 0.6);
    }
  }

  #metricDeltas(prev: Metric[], next: Metric[]): void {
    for (const m of next) {
      const old = prev.find((p) => p.label === m.label);
      if (!old) continue;
      const a = metricNumber(old.value);
      const b = metricNumber(m.value);
      const d = Math.round((b - a) * 100) / 100;
      if (!d || !Number.isFinite(d)) continue;
      const x = this.#chipX.get(m.label) ?? VW / 2;
      this.#fx.float(
        x,
        28,
        `${d > 0 ? '+' : ''}${d}${m.label.length <= 2 ? m.label : ''}`,
        d > 0 ? '#9dffb0' : '#ff8a8a',
        1.4,
      );
    }
  }

  #drawHud(g: Ctx): void {
    if (!isFontReady()) return;
    // Top bar: metric chips.
    rect(g, 0, 0, VW, 15, withAlpha('#05030c', 0.72));
    rect(g, 0, 15, VW, 1, withAlpha('#ffffff', 0.08));
    let x = 4;
    this.#chipX.clear();
    for (const m of this.#status.metrics) {
      const value = fitText(String(m.value), 70);
      const label = fitText(m.label, 40);
      const w = textWidth(label) + textWidth(value) + 8;
      if (x + w > VW - 4) break;
      drawText(g, label, x, 2, { color: '#9b8cc9', outline: null });
      drawText(g, value, x + textWidth(label) + 3, 2, { color: '#fff4d6', outline: null });
      this.#chipX.set(m.label, x + w / 2);
      x += w + 6;
    }
    // Bottom ticker: headline + focus hint.
    const label = this.#focus ? `▶ ${this.#focus.label}` : this.#status.headline;
    rect(g, 0, VH - 14, VW, 14, withAlpha('#05030c', 0.72));
    drawText(g, fitText(label, VW - 70), 4, VH - 13, {
      color: this.#focus ? '#ffe066' : '#d8ccff',
      outline: null,
    });
    drawText(g, `T${this.#status.turn}`, VW - 4, VH - 13, {
      color: '#7d6fb0',
      outline: null,
      align: 'right',
    });
    if (this.#agentPulse > 0) {
      const a = Math.min(1, this.#agentPulse);
      panel(g, VW - 64, 19, 60, 15, '#2a0f3f', '#b28dff');
      glow(g, VW - 34, 26, 20, '#b28dff', 0.3 * a);
      drawText(g, 'AGENT ▶', VW - 34, 21, { color: '#f0e0ff', align: 'center', alpha: a });
    }
  }

  #drawBanner(g: Ctx): void {
    const outcome = this.#status.outcome;
    if (outcome === 'ongoing' || !isFontReady()) return;
    const t = Math.min(1, this.#banner * 2.5);
    const h = Math.round(34 * t);
    const y = VH / 2 - h / 2;
    const colors: Record<string, [string, string, string]> = {
      won: ['#2a1d05', '#ffd23f', '胜利 · VICTORY'],
      lost: ['#2a050d', '#ff4d6d', '失败 · DEFEAT'],
      aborted: ['#141414', '#a8a8c8', '已中止 · ABORTED'],
    };
    const [bg, fg, text] = colors[outcome] ?? colors.aborted!;
    rect(g, 0, y, VW, h, withAlpha(bg, 0.9));
    rect(g, 0, y, VW, 1, fg);
    rect(g, 0, y + h - 1, VW, 1, fg);
    if (t >= 1) {
      glow(g, VW / 2, VH / 2, 70, fg, 0.18 + 0.06 * Math.sin(this.#t * 3));
      drawText(g, text, VW / 2, VH / 2 - 12, { color: fg, align: 'center', scale: 2 });
    }
  }

  #drawHover(g: Ctx): void {
    const regions = this.#scene.hits?.(this.#host.session.state, this.#actions) ?? [];
    const focusId = this.#focus?.id;
    for (const r of regions) {
      const active = (this.#hover && this.#hover.actionId === r.actionId) || r.actionId === focusId;
      if (!active) continue;
      const pulse = 0.5 + 0.5 * Math.sin(this.#t * 8);
      g.strokeStyle = withAlpha('#ffe066', 0.6 + 0.4 * pulse);
      g.lineWidth = 1;
      g.strokeRect(
        Math.round(r.x) + 0.5,
        Math.round(r.y) + 0.5,
        Math.round(r.w) - 1,
        Math.round(r.h) - 1,
      );
    }
  }

  #pointer(e: MouseEvent, click: boolean): void {
    const rectEl = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rectEl.left) / rectEl.width) * VW;
    const y = ((e.clientY - rectEl.top) / rectEl.height) * VH;
    const regions = this.#scene.hits?.(this.#host.session.state, this.#actions) ?? [];
    const hit = regions.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) ?? null;
    this.#hover = hit;
    this.canvas.style.cursor = hit ? 'pointer' : '';
    if (click && hit) this.onHitAction?.(hit.actionId);
  }
}
