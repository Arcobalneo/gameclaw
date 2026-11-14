import type { ActionView, GameDefinition, MemoryActOutcome, StatusView } from '@gameclaw/gamekit';
import type { Grade } from './art';
import type { Fx } from './fx';
import type { Ctx } from './pixel';

/** Everything a scene needs to paint one frame. */
export interface Frame<S> {
  g: Ctx;
  /** Seconds since the stage started (monotonic, pauses with hit-stop). */
  t: number;
  dt: number;
  fx: Fx;
  state: S;
  status: StatusView;
  actions: readonly ActionView[];
  /** Action currently highlighted by keyboard / hover, if any. */
  focus: ActionView | null;
  /** Seconds since the last act / new game. Handy for tween timing. */
  since: number;
  turn: number;
  /** UI language; in-canvas copy must follow it. */
  lang: 'zh' | 'en';
  /** Translate a short engine string (names, labels) into `lang`. */
  term(text: string): string;
  /** Play a sound cue in sync with an impact. */
  cue(name: 'hit' | 'heavy' | 'whoosh' | 'coin' | 'splash' | 'land' | 'good' | 'bad'): void;
}

/** Clickable region inside the 384×216 buffer that triggers an action. */
export interface HitRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  actionId: string;
}

export interface GameScene<S> {
  /** Colour grade + bloom for this frame (art bible post pass). */
  grade?(state: S): Grade;
  /** Paint the world (backdrop, actors, in-world HUD). Called every frame. */
  draw(f: Frame<S>): void;
  /** In-world HUD text drawn after the vignette so it stays readable. */
  hud?(f: Frame<S>): void;
  /** React to a resolved action with tweens / particles / shake. */
  react?(f: Frame<S>, outcome: MemoryActOutcome<S>): void;
  /** Called when a fresh run starts. */
  reset?(f: Frame<S>): void;
  /** Optional click targets for direct manipulation. */
  hits?(state: S, actions: readonly ActionView[]): HitRegion[];
  /** Buffer-space point where generic feedback (metric deltas) should pop. */
  anchor?(state: S): { x: number; y: number };
}

/** A lazily loaded game chunk: the deterministic engine plus its renderer. */
export interface GameModule<S = unknown> {
  definition: GameDefinition<S>;
  createScene(): GameScene<S>;
}

/** Erases the state type at the registry boundary. */
// biome-ignore lint/suspicious/noExplicitAny: registry stores heterogeneous game modules
export type AnyGameModule = GameModule<any>;

const CJK_RE = /[\u3400-\u9fff]/;
/** Engine text in the UI language, or '' when it cannot be shown without mixing languages. */
export function say(f: { lang: 'zh' | 'en'; term(text: string): string }, text: string): string {
  const out = f.term(text);
  return f.lang === 'zh' || !CJK_RE.test(out) ? out : '';
}
