import { GameError, illegalAction } from './errors';
import type {
  ActionResult,
  ActionView,
  GameDefinition,
  GameEvent,
  Outcome,
  RecapView,
  StatusView,
} from './types';

/** Universal abort, appended whenever a game implements `abort`. */
export const ABORT_ACTION: ActionView = {
  id: 'abort',
  label: 'Abort this run and settle honestly',
  detail: 'Ends the run as aborted without pretending it was a win or a death.',
  risk: 'low',
};

/** Plain-JSON snapshot of an in-memory run; safe to persist in localStorage. */
export interface MemorySnapshot<S = unknown> {
  schema: 1;
  game: string;
  gameVersion: string;
  seed: number;
  turn: number;
  outcome: Outcome;
  createdAt: string;
  state: S;
}

export interface MemoryActOutcome<S = unknown> {
  action: ActionView;
  result: ActionResult;
  events: GameEvent[];
  previous: S;
  state: S;
  status: StatusView;
  actions: ActionView[];
}

/**
 * In-memory session used by the web portal.
 * Clone → act → bump turn, prefix / 1-based index resolution, `abort`.
 */
export class MemorySession<S = unknown> {
  readonly game: GameDefinition<S>;
  #snapshot: MemorySnapshot<S>;

  constructor(game: GameDefinition<S>, snapshot: MemorySnapshot<S>) {
    this.game = game;
    this.#snapshot = snapshot;
  }

  static create<S>(
    game: GameDefinition<S>,
    options: { seed: number; difficulty?: string; content?: string; now?: string },
  ): MemorySession<S> {
    const now = options.now ?? new Date().toISOString();
    const state = game.create({
      seed: options.seed >>> 0,
      now,
      ...(options.content !== undefined ? { content: options.content } : {}),
      ...(options.difficulty !== undefined ? { difficulty: options.difficulty } : {}),
    });
    return new MemorySession(game, {
      schema: 1,
      game: game.meta.id,
      gameVersion: game.meta.version,
      seed: options.seed >>> 0,
      turn: 0,
      outcome: game.status(state).outcome,
      createdAt: now,
      state,
    });
  }

  /** Rehydrates a snapshot; returns `null` when it belongs to another game or is malformed. */
  static restore<S>(game: GameDefinition<S>, raw: unknown): MemorySession<S> | null {
    if (!raw || typeof raw !== 'object') return null;
    const snap = raw as Partial<MemorySnapshot<S>>;
    if (snap.schema !== 1 || snap.game !== game.meta.id || snap.state === undefined) return null;
    if (snap.gameVersion !== game.meta.version) return null;
    try {
      const session = new MemorySession(game, snap as MemorySnapshot<S>);
      session.status();
      return session;
    } catch {
      return null;
    }
  }

  get snapshot(): MemorySnapshot<S> {
    return this.#snapshot;
  }

  get state(): S {
    return this.#snapshot.state;
  }

  status(): StatusView {
    return { ...this.game.status(this.#snapshot.state), turn: this.#snapshot.turn };
  }

  actions(): ActionView[] {
    if (this.status().outcome !== 'ongoing') return [];
    const actions = this.game.actions(this.#snapshot.state);
    return this.game.abort ? [...actions, ABORT_ACTION] : actions;
  }

  resolve(rawId: string): ActionView {
    const actions = this.actions();
    const id = String(rawId).trim();
    const exact = actions.find((action) => action.id === id);
    if (exact) return exact;
    const prefix = actions.filter((action) => action.id.startsWith(id));
    if (id && prefix.length === 1) return prefix[0]!;
    if (id && prefix.length > 1) {
      throw illegalAction(
        `Ambiguous action id "${id}".`,
        `Candidates: ${prefix.map((action) => action.id).join(', ')}`,
      );
    }
    const index = Number(id);
    if (Number.isInteger(index) && index >= 1 && index <= actions.length)
      return actions[index - 1]!;
    throw illegalAction(
      `Illegal action for the current state: ${id}`,
      `Legal ids: ${actions.map((action) => action.id).join(', ') || '(none)'}`,
    );
  }

  act(rawId: string): MemoryActOutcome<S> {
    const before = this.status();
    if (before.outcome !== 'ongoing') {
      throw new GameError(
        'GAME_OVER',
        `This run already ended with outcome=${before.outcome}.`,
        'Call recap for the settlement, or new_game to start again.',
      );
    }
    const action = this.resolve(rawId);
    const previous = this.#snapshot.state;
    const next = structuredClone(previous);
    let result: ActionResult;
    if (action.id === 'abort') {
      this.game.abort?.(next);
      result = { log: ['Run aborted. The settlement records what was true at this point.'] };
    } else {
      result = this.game.act(next, action.id);
    }
    const status = { ...this.game.status(next), turn: this.#snapshot.turn + 1 };
    this.#snapshot = {
      ...this.#snapshot,
      state: next,
      turn: this.#snapshot.turn + 1,
      outcome: status.outcome,
    };
    return {
      action,
      result,
      events: result.events ?? [],
      previous,
      state: next,
      status,
      actions: this.actions(),
    };
  }

  recap(): RecapView {
    return this.game.recap(this.#snapshot.state);
  }
}
