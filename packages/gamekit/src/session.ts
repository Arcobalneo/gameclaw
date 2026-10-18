import { GameError, illegalAction } from './errors';
import { appendJournal } from './journal';
import type { GamePaths } from './paths';
import { gamePaths } from './paths';
import { ensureDirs, readSave, removeSave, saveExists, writeSave } from './store';
import type {
  ActionResult,
  ActionView,
  CreateOptions,
  GameDefinition,
  Outcome,
  SaveFile,
  StatusView,
} from './types';

export interface ActOutcome<S = unknown> {
  save: SaveFile<S>;
  result: ActionResult;
  status: StatusView;
  actions: ActionView[];
}

const ABORT_ACTION: ActionView = {
  id: 'abort',
  label: 'Abort this run and settle honestly',
  detail: 'Ends the run as aborted without pretending it was a win or a death.',
  risk: 'low',
};

export class Session<S = unknown> {
  readonly game: GameDefinition<S>;
  readonly paths: GamePaths;
  readonly slot: number;

  constructor(game: GameDefinition<S>, root: string, slot: number) {
    this.game = game;
    this.paths = gamePaths(root, game.meta.id);
    this.slot = slot;
  }

  hasSave(): boolean {
    return saveExists(this.paths, this.slot);
  }

  load(): SaveFile<S> {
    return readSave(this.paths, this.slot);
  }

  create(options: {
    seed: number;
    content?: string;
    difficulty?: string;
    force?: boolean;
  }): SaveFile<S> {
    ensureDirs(this.paths);
    if (this.hasSave() && !options.force) {
      throw new GameError(
        'SLOT_IN_USE',
        `Slot ${this.slot} already contains a run.`,
        `Use --force to overwrite it, or --slot <n> to start elsewhere.`,
      );
    }
    if (options.force) removeSave(this.paths, this.slot);
    const now = new Date().toISOString();
    const createOptions: CreateOptions = {
      seed: options.seed,
      now,
      ...(options.content !== undefined ? { content: options.content } : {}),
      ...(options.difficulty !== undefined ? { difficulty: options.difficulty } : {}),
    };
    const state = this.game.create(createOptions);
    const status = this.game.status(state);
    const save: SaveFile<S> = {
      schema: 1,
      game: this.game.meta.id,
      gameVersion: this.game.meta.version,
      slot: this.slot,
      runId: `${this.game.meta.id}-${options.seed}-${Date.now().toString(36)}`,
      seed: options.seed,
      turn: 0,
      outcome: status.outcome,
      createdAt: now,
      updatedAt: now,
      state,
    };
    writeSave(this.paths, save);
    return save;
  }

  status(save: SaveFile<S>): StatusView {
    // The save owns the authoritative turn counter: it advances even when a
    // game's abort hook skips its normal act path.
    return { ...this.game.status(save.state), turn: save.turn };
  }

  actions(save: SaveFile<S>): ActionView[] {
    const status = this.status(save);
    const actions = status.outcome === 'ongoing' ? this.game.actions(save.state) : [];
    if (status.outcome === 'ongoing' && this.game.abort) return [...actions, ABORT_ACTION];
    return actions;
  }

  resolveAction(save: SaveFile<S>, rawId: string): ActionView {
    const actions = this.actions(save);
    const id = rawId.trim();
    const exact = actions.find((action) => action.id === id);
    if (exact) return exact;
    const prefixMatches = actions.filter((action) => action.id.startsWith(id));
    if (prefixMatches.length === 1) return prefixMatches[0]!;
    if (prefixMatches.length > 1) {
      throw illegalAction(
        `Ambiguous action id "${id}".`,
        `Candidates: ${prefixMatches.map((action) => action.id).join(', ')}`,
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

  act(rawId: string): ActOutcome<S> {
    const save = this.load();
    const statusBefore = this.status(save);
    if (statusBefore.outcome !== 'ongoing') {
      throw new GameError(
        'GAME_OVER',
        `This run already ended with outcome=${statusBefore.outcome}.`,
        'Run `recap` for the settlement, or `new --force` to start a new run.',
      );
    }
    const action = this.resolveAction(save, rawId);

    // Clone so a throwing action cannot corrupt the persisted run.
    const nextState = structuredClone(save.state);
    const result: ActionResult =
      action.id === 'abort'
        ? (() => {
            this.game.abort?.(nextState);
            return { log: ['Run aborted. The settlement records what was true at this point.'] };
          })()
        : this.game.act(nextState, action.id);

    save.state = nextState;
    save.turn += 1;
    const status = this.status(save);
    save.outcome = status.outcome;
    writeSave(this.paths, save);
    appendJournal(this.paths, save, {
      turn: save.turn,
      action: action.id,
      outcome: status.outcome,
      log: result.log,
      events: result.events ?? [],
    });
    return { save, result, status, actions: this.actions(save) };
  }

  recap(save: SaveFile<S> = this.load()) {
    return this.game.recap(save.state);
  }
}

export function outcomeOf(status: StatusView): Outcome {
  return status.outcome;
}
