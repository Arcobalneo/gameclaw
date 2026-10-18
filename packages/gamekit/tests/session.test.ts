import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CliIo, runCli } from '../src/cli/run';
import { GameError } from '../src/errors';
import { Session } from '../src/session';
import { counterGame } from './fixture';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'gamekit-test-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function memoryIo(): CliIo & { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    out: (text) => stdout.push(text),
    err: (text) => stderr.push(text),
    isTTY: false,
    readLine: async () => null,
  };
}

describe('Session', () => {
  it('creates, persists and reloads a run', () => {
    const session = new Session(counterGame, root, 0);
    const save = session.create({ seed: 11 });
    expect(save.seed).toBe(11);
    expect(fs.existsSync(path.join(root, 'test-counter', 'saves', 'slot-0.json'))).toBe(true);
    const loaded = session.load();
    expect(loaded.state.count).toBe(0);
    expect(loaded.state.target).toBeGreaterThanOrEqual(2);
  });

  it('refuses to overwrite an existing slot without force', () => {
    const session = new Session(counterGame, root, 0);
    session.create({ seed: 1 });
    expect(() => session.create({ seed: 2 })).toThrowError(/already contains a run/);
    const forced = session.create({ seed: 2, force: true });
    expect(forced.seed).toBe(2);
  });

  it('advances the run and settles when the target is reached', () => {
    const session = new Session(counterGame, root, 0);
    let save = session.create({ seed: 5 });
    const target = (save.state as { target: number }).target;
    for (let i = 0; i < target; i += 1) {
      save = session.act('inc').save;
    }
    expect(save.outcome).toBe('won');
    expect(save.turn).toBe(target);
    const recap = session.recap(save);
    expect(recap.outcome).toBe('won');
    expect(recap.lessons.length).toBeGreaterThan(0);
  });

  it('rejects illegal actions with a helpful hint', () => {
    const session = new Session(counterGame, root, 0);
    session.create({ seed: 3 });
    let error: unknown;
    try {
      session.act('nope');
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GameError);
    expect((error as GameError).code).toBe('ILLEGAL_ACTION');
    expect((error as GameError).hint).toContain('inc');
  });

  it('supports abort as a first-class action', () => {
    const session = new Session(counterGame, root, 0);
    session.create({ seed: 3 });
    const save = session.act('abort').save;
    expect(save.outcome).toBe('aborted');
  });

  it('refuses to act after the run ended', () => {
    const session = new Session(counterGame, root, 0);
    session.create({ seed: 3 });
    session.act('abort');
    expect(() => session.act('inc')).toThrowError(/already ended/);
  });
});

describe('runCli', () => {
  it('prints a JSON envelope for new runs', async () => {
    const io = memoryIo();
    const code = await runCli(counterGame, {
      argv: ['new', '--seed', '9', '--json', '--state-dir', root, '--no-observer'],
      io,
    });
    expect(code).toBe(0);
    const payload = JSON.parse(io.stdout.join('')) as Record<string, unknown>;
    expect(payload.ok).toBe(true);
    expect(payload.game).toMatchObject({ id: 'test-counter' });
    expect(Array.isArray(payload.actions)).toBe(true);
  });

  it('applies actions and reports the settlement', async () => {
    const io = memoryIo();
    await runCli(counterGame, {
      argv: ['new', '--seed', '9', '--state-dir', root, '--no-observer'],
      io,
    });
    const session = new Session(counterGame, root, 0);
    const target = (session.load().state as { target: number }).target;
    for (let i = 0; i < target; i += 1) {
      const result = await runCli(counterGame, {
        argv: ['act', 'inc', '--state-dir', root, '--no-observer'],
        io,
      });
      expect(result).toBe(0);
    }
    const save = session.load();
    expect(save.outcome).toBe('won');
    expect(fs.existsSync(path.join(root, 'test-counter', 'reports', 'latest.html'))).toBe(true);
  });

  it('returns exit code 3 when there is no save', async () => {
    const io = memoryIo();
    const code = await runCli(counterGame, {
      argv: ['status', '--state-dir', root, '--no-observer'],
      io,
    });
    expect(code).toBe(3);
    expect(io.stderr.join('\n')).toContain('NO_SAVE');
  });

  it('returns a machine-readable error for illegal actions', async () => {
    const io = memoryIo();
    await runCli(counterGame, {
      argv: ['new', '--seed', '9', '--state-dir', root, '--no-observer'],
      io,
    });
    io.stdout.length = 0;
    const code = await runCli(counterGame, {
      argv: ['act', 'nope', '--state-dir', root, '--no-observer', '--json'],
      io,
    });
    expect(code).toBe(4);
    const payload = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      error: { code: string; hint: string };
    };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('ILLEGAL_ACTION');
    expect(payload.error.hint).toContain('inc');
  });
});
