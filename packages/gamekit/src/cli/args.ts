import { parseArgs } from 'node:util';

import { GameError, usageError } from '../errors';

export interface CliInput {
  command: string;
  positionals: string[];
  values: {
    slot?: string;
    seed?: string;
    content?: string;
    difficulty?: string;
    stateDir?: string;
    format?: string;
    port?: string;
    token?: string;
    gameId?: string;
    json: boolean;
    color?: boolean;
    force: boolean;
    observer?: boolean;
    report?: boolean;
    quiet: boolean;
    verbose: boolean;
    help: boolean;
    version: boolean;
  };
}

const OPTIONS = {
  slot: { type: 'string' },
  seed: { type: 'string' },
  content: { type: 'string' },
  difficulty: { type: 'string' },
  'state-dir': { type: 'string' },
  format: { type: 'string' },
  port: { type: 'string' },
  token: { type: 'string' },
  'game-id': { type: 'string' },
  json: { type: 'boolean' },
  color: { type: 'boolean' },
  'no-color': { type: 'boolean' },
  observer: { type: 'boolean' },
  'no-observer': { type: 'boolean' },
  report: { type: 'boolean' },
  'no-report': { type: 'boolean' },
  force: { type: 'boolean' },
  quiet: { type: 'boolean' },
  verbose: { type: 'boolean' },
  help: { type: 'boolean' },
  version: { type: 'boolean' },
} as const;

export function parseCliInput(argv: readonly string[]): CliInput {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: [...argv],
      options: OPTIONS,
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw usageError(message, 'Run `help` to see the supported commands and flags.');
  }

  const values = parsed.values as Record<string, string | boolean | undefined>;
  const bool = (key: string): boolean => values[key] === true;
  const str = (key: string): string | undefined =>
    typeof values[key] === 'string' ? (values[key] as string) : undefined;

  const noObserver = bool('no-observer');
  const noReport = bool('no-report');
  const color = bool('no-color') ? false : bool('color') ? true : undefined;

  return {
    command: parsed.positionals[0] ?? 'help',
    positionals: parsed.positionals.slice(1),
    values: {
      slot: str('slot'),
      seed: str('seed'),
      content: str('content'),
      difficulty: str('difficulty'),
      stateDir: str('state-dir'),
      format: str('format'),
      port: str('port'),
      token: str('token'),
      gameId: str('game-id'),
      json: bool('json'),
      color,
      force: bool('force'),
      observer: noObserver ? false : bool('observer') ? true : undefined,
      report: noReport ? false : bool('report') ? true : undefined,
      quiet: bool('quiet'),
      verbose: bool('verbose'),
      help: bool('help'),
      version: bool('version'),
    },
  };
}

export function parseSlot(raw: string | undefined, fallback = 0): number {
  if (raw === undefined) return fallback;
  const slot = Number(raw);
  if (!Number.isInteger(slot) || slot < 0 || slot > 99) {
    throw usageError(
      `Invalid --slot value: ${raw}`,
      'Slots are integers from 0 to 99. Example: --slot 0',
    );
  }
  return slot;
}

export function parseSeed(raw: string | undefined, now = Date.now()): number {
  if (raw === undefined) return now % 1_000_000_007;
  const seed = Number(raw);
  if (!Number.isInteger(seed) || seed < 0 || seed > 2_147_483_647) {
    throw new GameError(
      'USAGE',
      `Invalid --seed value: ${raw}`,
      'Seeds are integers from 0 to 2147483647. Example: --seed 7',
    );
  }
  return seed;
}

export function parsePort(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw usageError(`Invalid --port value: ${raw}`, 'Ports are integers from 1 to 65535.');
  }
  return port;
}
