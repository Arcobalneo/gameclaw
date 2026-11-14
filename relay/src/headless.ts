import {
  type GameDefinition,
  GameError,
  MemorySession,
  type MemorySnapshot,
  normalizePlayerName,
} from '@gameclaw/gamekit';
import { definition as shrimpBurger } from '../../games/shrimp-burger/src/definition';
import { definition as shrimpCatch } from '../../games/shrimp-catch/src/definition';
import { definition as shrimpConquest } from '../../games/shrimp-conquest/src/definition';
import { definition as shrimpGreens } from '../../games/shrimp-greens/src/definition';
import { definition as shrimpGuard } from '../../games/shrimp-guard/src/definition';
import { definition as shrimpHeist } from '../../games/shrimp-heist/src/definition';
import { definition as shrimpInk } from '../../games/shrimp-ink/src/definition';
import { definition as shrimpLeap } from '../../games/shrimp-leap/src/definition';
import { definition as shrimpLook } from '../../games/shrimp-look/src/definition';
import { definition as shrimpRampage } from '../../games/shrimp-rampage/src/definition';
import { definition as shrimpTrek } from '../../games/shrimp-trek/src/definition';
import { GAMES } from '../../web/src/catalog';
import type { Lang } from '../../web/src/i18n';
import {
  localizeActions,
  localizeLines,
  localizeRecap,
  localizeStatus,
} from '../../web/src/i18n/localize';
import type { SubmitInput } from './leaderboard';
import type { Json, StoredDesk, StoredSlot, ToolName } from './protocol';

interface RunLog {
  turn: number;
  source: 'human' | 'agent' | 'system';
  action?: string;
  lines: string[];
}

interface Slot {
  session: MemorySession<unknown>;
  log: RunLog[];
}

type Ready = Slot & { id: string };

interface Failure {
  ok: false;
  error: string;
  hint?: string;
}

function isReady(value: Ready | Failure): value is Ready {
  return !('ok' in value);
}

const MAX_LOG = 60;

// biome-ignore lint/suspicious/noExplicitAny: each game has its own state type
const DEFINITIONS = new Map<string, GameDefinition<any>>(
  [
    shrimpTrek,
    shrimpGuard,
    shrimpHeist,
    shrimpCatch,
    shrimpLook,
    shrimpRampage,
    shrimpInk,
    shrimpGreens,
    shrimpConquest,
    shrimpLeap,
    shrimpBurger,
  ].map((definition) => [definition.meta.id, definition]),
);

function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] || 1) % 1_000_000_000;
}

function gameIdOf(args: Json, focused: string | null): string | null {
  if (typeof args.game_id === 'string' && args.game_id.trim()) return args.game_id.trim();
  return focused;
}

function compactStatus(gameId: string, session: MemorySession<unknown>, lang: Lang): Json {
  const view = localizeStatus(gameId, session.status(), lang);
  return {
    headline: view.headline,
    outcome: view.outcome,
    turn: view.turn,
    ...(view.phase ? { phase: view.phase } : {}),
    metrics: view.metrics.map((metric) => ({
      label: metric.label,
      value: metric.value,
      ...(metric.hint ? { hint: metric.hint } : {}),
    })),
    sections: view.sections,
  };
}

function compactActions(gameId: string, session: MemorySession<unknown>, lang: Lang): Json[] {
  return localizeActions(gameId, session.actions(), lang).map((action, index) => ({
    index: index + 1,
    id: action.id,
    label: action.label,
    ...(action.detail ? { detail: action.detail } : {}),
    ...(action.risk ? { risk: action.risk } : {}),
    ...(action.cost ? { cost: action.cost } : {}),
  }));
}

function viewOf(gameId: string, session: MemorySession<unknown>, lang: Lang): Json {
  return {
    ok: true,
    game_id: gameId,
    seed: session.snapshot.seed,
    state: compactStatus(gameId, session, lang),
    actions: compactActions(gameId, session, lang),
  };
}

/**
 * One session's games, played inside the relay when no browser tab is attached.
 * The same definitions the page uses. Snapshots are what a later watch page restores.
 */
export class HeadlessDesk {
  focused: string | null = null;
  lang: Lang | null = null;
  readonly #slots = new Map<string, Slot>();

  get empty(): boolean {
    return this.focused === null && this.lang === null && this.#slots.size === 0;
  }

  exportDesk(): StoredDesk {
    const games: Record<string, StoredSlot> = {};
    for (const [id, slot] of this.#slots) {
      games[id] = { snapshot: slot.session.snapshot, log: slot.log };
    }
    return { focused: this.focused, lang: this.lang, games };
  }

  load(desk: StoredDesk): void {
    this.focused = desk.focused;
    this.lang = desk.lang;
    this.#slots.clear();
    for (const [id, slot] of Object.entries(desk.games)) {
      const definition = DEFINITIONS.get(id);
      if (!definition || !slot) continue;
      const session = MemorySession.restore(definition, slot.snapshot);
      if (!session) continue;
      this.#slots.set(id, { session, log: normalizeLog(slot.log) });
    }
  }

  merge(desk: StoredDesk): void {
    if (desk.focused) this.focused = desk.focused;
    if (desk.lang) this.lang = desk.lang;
    for (const [id, slot] of Object.entries(desk.games)) {
      const definition = DEFINITIONS.get(id);
      if (!definition || !slot) continue;
      const session = MemorySession.restore(definition, slot.snapshot);
      if (!session) continue;
      const current = this.#slots.get(id);
      if (current && !newer(session.snapshot, current.session.snapshot)) continue;
      this.#slots.set(id, { session, log: normalizeLog(slot.log) });
    }
  }

  call(tool: ToolName, args: Json): Json | Failure {
    const lang: Lang = this.lang ?? 'zh';
    switch (tool) {
      case 'list_games':
        return {
          ok: true,
          focused: this.focused,
          games: GAMES.map((game) => ({
            id: game.id,
            name: lang === 'zh' ? game.name : game.englishName,
            english_name: game.englishName,
            tagline: lang === 'zh' ? game.tagZh : game.tagEn,
            goal: lang === 'zh' ? game.goal : game.goalEn,
          })),
        };
      case 'set_language': {
        if (args.lang !== 'zh' && args.lang !== 'en')
          return { ok: false, error: 'lang must be zh or en.' };
        this.lang = args.lang;
        return { ok: true, lang: args.lang };
      }
      case 'get_leaderboard':
        return { ok: false, error: 'Leaderboard is answered by the relay.' };
      default:
        return this.#play(tool, args, lang);
    }
  }

  #play(tool: ToolName, args: Json, lang: Lang): Json | Failure {
    if (tool === 'open_game') {
      const id = typeof args.game_id === 'string' ? args.game_id.trim() : '';
      const slot = this.#ensure(id, true);
      if (!isReady(slot)) return slot;
      this.focused = slot.id;
      return viewOf(slot.id, slot.session, lang);
    }
    const id = gameIdOf(args, this.focused);
    if (!id) {
      return {
        ok: false,
        error: 'No game is open.',
        hint: 'Call open_game or new_game with a game_id from list_games.',
      };
    }
    if (tool === 'new_game') {
      const created = this.#create(id, args);
      if (!isReady(created)) return created;
      this.focused = created.id;
      const meta = created.session.game.meta;
      return {
        ...viewOf(created.id, created.session, lang),
        guide: localizeLines(created.id, meta.guide, lang),
      };
    }
    const slot = this.#ensure(id, false);
    if (!isReady(slot)) return slot;
    this.focused = slot.id;
    if (tool === 'get_state') return viewOf(slot.id, slot.session, lang);
    if (tool === 'list_actions') {
      const status = slot.session.status();
      return {
        ok: true,
        game_id: slot.id,
        outcome: status.outcome,
        turn: status.turn,
        actions: compactActions(slot.id, slot.session, lang),
      };
    }
    if (tool === 'recap') {
      return {
        ok: true,
        game_id: slot.id,
        seed: slot.session.snapshot.seed,
        recap: localizeRecap(slot.id, slot.session.recap(), lang),
      };
    }
    if (tool === 'act') {
      if (typeof args.action_id !== 'string' || !args.action_id.trim()) {
        return {
          ok: false,
          error: 'action_id is required.',
          hint: 'Pass an id (or 1-based index) from list_actions.',
        };
      }
      try {
        const outcome = slot.session.act(args.action_id);
        slot.log.push({
          turn: outcome.status.turn,
          source: 'agent',
          action: outcome.action.id,
          lines: outcome.result.log,
        });
        if (outcome.status.outcome !== 'ongoing') {
          slot.log.push({
            turn: outcome.status.turn,
            source: 'system',
            lines: [`— ${outcomeName(outcome.status.outcome)} —`],
          });
        }
        while (slot.log.length > MAX_LOG) slot.log.shift();
        return {
          ok: true,
          game_id: slot.id,
          action: outcome.action.id,
          log: localizeLines(slot.id, outcome.result.log, lang),
          events: outcome.events,
          state: compactStatus(slot.id, slot.session, lang),
          actions: compactActions(slot.id, slot.session, lang),
          ...(outcome.status.outcome !== 'ongoing'
            ? { next: 'Run ended. Call recap for the settlement.' }
            : {}),
        };
      } catch (error) {
        return actError(error, slot);
      }
    }
    if (tool === 'submit_score') return this.#submit(slot, args);
    return { ok: false, error: `Unknown tool ${tool}` };
  }

  #submit(slot: Ready, args: Json): Json {
    const name = normalizePlayerName(typeof args.name === 'string' ? args.name : '');
    if (!name) {
      return {
        ok: false,
        error: 'Name is not allowed.',
        hint: 'Use 1–16 letters, numbers, spaces, or _ - . ·',
      };
    }
    const recap = slot.session.recap();
    const turn = slot.session.status().turn;
    if ((recap.outcome !== 'won' && recap.outcome !== 'lost') || recap.score < 1) {
      return {
        ok: false,
        error: 'This run cannot be submitted.',
        hint: 'Finish a win or a loss with a score above 0. Aborted runs are not scored.',
      };
    }
    const submit: SubmitInput = {
      name,
      game: slot.id,
      score: recap.score,
      outcome: recap.outcome,
      turn,
      run: `${slot.id}:${slot.session.snapshot.seed}:${slot.session.snapshot.createdAt}:${turn}:${recap.score}`,
    };
    return { leaderboardSubmit: submit };
  }

  /** Resume a stored run, or start one when `create` is set (open_game). */
  #ensure(id: string, create: boolean): Ready | Failure {
    const definition = DEFINITIONS.get(id);
    if (!definition) {
      return {
        ok: false,
        error: `Unknown game_id: ${id}`,
        hint: `Valid ids: ${[...DEFINITIONS.keys()].join(', ')}`,
      };
    }
    const existing = this.#slots.get(id);
    if (existing) return { id, ...existing };
    if (!create) {
      return {
        ok: false,
        error: 'No game is open.',
        hint: 'Call open_game or new_game with a game_id from list_games.',
      };
    }
    return this.#create(id, {});
  }

  #create(id: string, args: Json): Ready | Failure {
    const definition = DEFINITIONS.get(id);
    if (!definition) {
      return {
        ok: false,
        error: `Unknown game_id: ${id}`,
        hint: `Valid ids: ${[...DEFINITIONS.keys()].join(', ')}`,
      };
    }
    const seed = Number.isFinite(Number(args.seed))
      ? Math.abs(Math.trunc(Number(args.seed)))
      : randomSeed();
    const difficulty =
      typeof args.difficulty === 'string' && args.difficulty !== 'normal'
        ? args.difficulty
        : undefined;
    try {
      const session = MemorySession.create(definition, {
        seed,
        ...(difficulty ? { difficulty } : {}),
      });
      const meta = definition.meta;
      const slot: Slot = {
        session,
        log: [
          {
            turn: 0,
            source: 'system',
            lines: [`${meta.name} · seed ${session.snapshot.seed}`, ...meta.guide.slice(0, 3)],
          },
        ],
      };
      this.#slots.set(id, slot);
      return { id, ...slot };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        hint: 'Use easy, normal or hard.',
      };
    }
  }
}

function outcomeName(outcome: string): string {
  return (
    (
      {
        ongoing: '进行中',
        won: '胜利',
        lost: '失败',
        aborted: '已中止',
      } as Record<string, string>
    )[outcome] ?? outcome
  );
}

function newer(next: MemorySnapshot, current: MemorySnapshot): boolean {
  if (next.createdAt !== current.createdAt || next.seed !== current.seed) return true;
  return next.turn > current.turn;
}

function normalizeLog(log: StoredSlot['log']): RunLog[] {
  return log
    .filter((entry) => entry && typeof entry.turn === 'number' && Array.isArray(entry.lines))
    .map((entry) => ({
      turn: entry.turn,
      source: entry.source === 'human' || entry.source === 'system' ? entry.source : 'agent',
      ...(entry.action ? { action: entry.action } : {}),
      lines: entry.lines.filter((line) => typeof line === 'string'),
    }));
}

function actError(error: unknown, slot: Ready): Json {
  const legal = slot.session.actions().map((action) => action.id);
  if (error instanceof GameError) {
    return {
      ok: false,
      game_id: slot.id,
      code: error.code,
      error: error.message,
      ...(error.hint ? { hint: error.hint } : {}),
      legal_actions: legal,
    };
  }
  return {
    ok: false,
    game_id: slot.id,
    code: 'INTERNAL',
    error: error instanceof Error ? error.message : String(error),
    legal_actions: legal,
  };
}
