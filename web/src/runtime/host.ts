import {
  type ActionView,
  GameError,
  type MemoryActOutcome,
  MemorySession,
  type RecapView,
  type StatusView,
} from '@gameclaw/gamekit';
import type { AnyGameModule } from '../gfx/scene';
import { loadGame } from './registry';

export type ActSource = 'human' | 'agent';

export interface LogEntry {
  turn: number;
  source: ActSource | 'system';
  action?: string;
  lines: string[];
}

// biome-ignore lint/suspicious/noExplicitAny: outcome state type is game-specific
export type AnyOutcome = MemoryActOutcome<any>;

export type HostEvent =
  | { kind: 'new'; source: ActSource }
  | { kind: 'act'; source: ActSource; outcome: AnyOutcome };

export interface ActError {
  ok: false;
  code: string;
  error: string;
  hint?: string;
  legal_actions?: string[];
}

const STORAGE_PREFIX = 'gameclaw:v3:';
const MAX_LOG = 60;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function randomSeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto?.getRandomValues?.(buf);
  return (buf[0] || Math.floor(Math.random() * 2 ** 31)) % 1_000_000_000;
}

/**
 * One live run per game. Wraps `MemorySession`, persists to localStorage, and broadcasts every change so the
 * window, the renderer and WebMCP all see the exact same state.
 */
export class GameHost {
  readonly module: AnyGameModule;
  // biome-ignore lint/suspicious/noExplicitAny: game-specific state
  session: MemorySession<any>;
  log: LogEntry[] = [];
  readonly #listeners = new Set<(event: HostEvent) => void>();

  // biome-ignore lint/suspicious/noExplicitAny: game-specific state
  private constructor(module: AnyGameModule, session: MemorySession<any>, log: LogEntry[]) {
    this.module = module;
    this.session = session;
    this.log = log;
  }

  static fromModule(module: AnyGameModule, opts: { persist?: boolean } = {}): GameHost {
    const id = module.definition.meta.id;
    const raw = opts.persist === false ? null : storage()?.getItem(STORAGE_PREFIX + id);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { snapshot: unknown; log?: LogEntry[] };
        const session = MemorySession.restore(module.definition, parsed.snapshot);
        if (session)
          return new GameHost(module, session, Array.isArray(parsed.log) ? parsed.log : []);
      } catch {
        /* corrupt save: start fresh */
      }
    }
    const host = new GameHost(
      module,
      MemorySession.create(module.definition, { seed: randomSeed() }),
      [],
    );
    host.#intro();
    host.#persist();
    return host;
  }

  get id(): string {
    return this.module.definition.meta.id;
  }

  get seed(): number {
    return this.session.snapshot.seed;
  }

  status(): StatusView {
    return this.session.status();
  }

  actions(): ActionView[] {
    return this.session.actions();
  }

  recap(): RecapView {
    return this.session.recap();
  }

  subscribe(fn: (event: HostEvent) => void): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  newGame(opts: { seed?: number; difficulty?: string; source?: ActSource } = {}): void {
    const seed = Number.isFinite(opts.seed) ? Math.abs(Math.trunc(opts.seed!)) : randomSeed();
    const difficulty =
      opts.difficulty && opts.difficulty !== 'normal' ? opts.difficulty : undefined;
    try {
      this.session = MemorySession.create(this.module.definition, {
        seed,
        ...(difficulty ? { difficulty } : {}),
      });
    } catch (error) {
      throw new GameError(
        'USAGE',
        error instanceof Error ? error.message : String(error),
        'Use easy, normal or hard.',
      );
    }
    this.log = [];
    this.#intro();
    this.#persist();
    this.#emit({ kind: 'new', source: opts.source ?? 'human' });
  }

  act(actionId: string, source: ActSource): AnyOutcome {
    const outcome = this.session.act(actionId);
    this.log.push({
      turn: outcome.status.turn,
      source,
      action: outcome.action.id,
      lines: outcome.result.log,
    });
    if (outcome.status.outcome !== 'ongoing') {
      this.log.push({
        turn: outcome.status.turn,
        source: 'system',
        lines: [`— ${outcomeLabel(outcome.status.outcome)} —`],
      });
    }
    while (this.log.length > MAX_LOG) this.log.shift();
    this.#persist();
    this.#emit({ kind: 'act', source, outcome });
    return outcome;
  }

  /** Never throws: converts engine errors into an agent-readable payload. */
  tryAct(actionId: string, source: ActSource): { ok: true; outcome: AnyOutcome } | ActError {
    try {
      return { ok: true, outcome: this.act(actionId, source) };
    } catch (error) {
      return toActError(error, this.actions());
    }
  }

  #intro(): void {
    const meta = this.module.definition.meta;
    this.log.push({
      turn: 0,
      source: 'system',
      lines: [`${meta.name} · seed ${this.seed}`, ...meta.guide.slice(0, 3)],
    });
  }

  #persist(): void {
    try {
      storage()?.setItem(
        STORAGE_PREFIX + this.id,
        JSON.stringify({ snapshot: this.session.snapshot, log: this.log }),
      );
    } catch {
      /* quota or private mode: play on without saving */
    }
  }

  #emit(event: HostEvent): void {
    for (const fn of this.#listeners) fn(event);
  }
}

export function toActError(error: unknown, actions: ActionView[]): ActError {
  if (error instanceof GameError) {
    return {
      ok: false,
      code: error.code,
      error: error.message,
      ...(error.hint ? { hint: error.hint } : {}),
      legal_actions: actions.map((a) => a.id),
    };
  }
  return {
    ok: false,
    code: 'INTERNAL',
    error: error instanceof Error ? error.message : String(error),
    legal_actions: actions.map((a) => a.id),
  };
}

export function outcomeLabel(outcome: string): string {
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

const hosts = new Map<string, Promise<GameHost>>();

export function getHost(id: string): Promise<GameHost> {
  let p = hosts.get(id);
  if (!p) {
    p = loadGame(id).then((module) => GameHost.fromModule(module));
    p.catch(() => hosts.delete(id));
    hosts.set(id, p);
  }
  return p;
}
