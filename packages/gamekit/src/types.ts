/**
 * Shared types for the GameClaw runtime.
 *
 * A game owns a serialisable state machine. The web portal and the relay own
 * sessions, rendering, and the agent tool surface. `recap.score` is the
 * integer a finished run may publish to the leaderboard.
 */

export type Outcome = 'ongoing' | 'won' | 'lost' | 'aborted';

export type Risk = 'low' | 'medium' | 'high';

export interface GameMeta {
  /** Stable machine id, e.g. `shrimp-heist`. */
  id: string;
  /** Chinese display name (虾×). */
  name: string;
  /** Latin name used in English docs and summaries. */
  englishName: string;
  /** One-line hook. */
  tagline: string;
  /** Two or three sentences of gameplay description. */
  description: string;
  /** Semantic version of this game package. */
  version: string;
  /** Canonical repository URL. */
  repo: string;
  /** SPDX licence id. */
  license: string;
  /** Short agent-facing guide lines. */
  guide: string[];
}

export interface Metric {
  label: string;
  value: string | number;
  hint?: string;
}

export interface StatusSection {
  title: string;
  lines: string[];
}

export interface StatusView {
  /** One-line "where am I" summary. */
  headline: string;
  metrics: Metric[];
  sections: StatusSection[];
  outcome: Outcome;
  turn: number;
  /** Optional phase label such as `battle` or `mutation`. */
  phase?: string;
}

export interface ActionView {
  /** Stable id accepted by `act`. Must remain stable across minor versions. */
  id: string;
  label: string;
  detail?: string;
  risk?: Risk;
  /** Human-readable price, e.g. `2 tide`. */
  cost?: string;
  tags?: string[];
}

export type GameEvent = { type: string } & Record<string, unknown>;

export interface ActionResult {
  /** Human-readable lines describing what just happened. */
  log: string[];
  /** Structured events, included verbatim in `--json` output. */
  events?: GameEvent[];
}

export interface RecapView {
  title: string;
  outcome: Outcome;
  /** Why the run ended, or where it currently stands. */
  cause: string;
  metrics: Metric[];
  timeline: string[];
  /** Honest, single-run observations the agent may write into its own memory. */
  lessons: string[];
  memoryPrompt: string;
  /**
   * Leaderboard points for this run.
   * 0 while the run is ongoing or aborted. A win or a loss may be above 0.
   */
  score: number;
}

export interface CreateOptions {
  seed: number;
  /** Optional scenario / case / lineage preset. */
  content?: string;
  /** Optional difficulty preset. */
  difficulty?: string;
  /** ISO timestamp, injectable for deterministic tests. */
  now: string;
}

export interface GameDefinition<S = unknown> {
  meta: GameMeta;
  create(options: CreateOptions): S;
  status(state: S): StatusView;
  actions(state: S): ActionView[];
  /** Mutates `state` in place. gamekit clones before calling, so a throw is safe. */
  act(state: S, actionId: string): ActionResult;
  recap(state: S): RecapView;
  /**
   * Optional clean-exit hook. gamekit exposes an `abort` action whenever this
   * is present so agents can always stop a run without corrupting the save.
   */
  abort?(state: S): void;
}

export interface SaveFile<S = unknown> {
  schema: 1;
  game: string;
  gameVersion: string;
  slot: number;
  runId: string;
  seed: number;
  turn: number;
  outcome: Outcome;
  createdAt: string;
  updatedAt: string;
  state: S;
}

export interface SaveSummary {
  slot: number;
  exists: boolean;
  game?: string;
  turn?: number;
  outcome?: Outcome;
  headline?: string;
  updatedAt?: string;
}
