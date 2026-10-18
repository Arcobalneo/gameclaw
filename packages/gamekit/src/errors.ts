export type ErrorCode =
  | 'USAGE'
  | 'NO_SAVE'
  | 'SLOT_IN_USE'
  | 'ILLEGAL_ACTION'
  | 'GAME_OVER'
  | 'STATE_CORRUPT'
  | 'UNSUPPORTED'
  | 'INTERNAL';

const EXIT_CODES: Record<ErrorCode, number> = {
  USAGE: 2,
  NO_SAVE: 3,
  SLOT_IN_USE: 3,
  STATE_CORRUPT: 3,
  ILLEGAL_ACTION: 4,
  GAME_OVER: 4,
  UNSUPPORTED: 5,
  INTERNAL: 1,
};

/**
 * An error that is safe to show to an agent: stable code, plain message and an
 * actionable hint. Anything else is reported as INTERNAL with a generic text.
 */
export class GameError extends Error {
  readonly code: ErrorCode;
  readonly hint?: string;
  readonly exitCode: number;

  constructor(code: ErrorCode, message: string, hint?: string) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    this.hint = hint;
    this.exitCode = EXIT_CODES[code];
  }
}

export function usageError(message: string, hint?: string): GameError {
  return new GameError('USAGE', message, hint);
}

export function illegalAction(message: string, hint?: string): GameError {
  return new GameError('ILLEGAL_ACTION', message, hint);
}
