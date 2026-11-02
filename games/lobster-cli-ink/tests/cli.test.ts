import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type CliIo, runCli } from '@gameclaw/gamekit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { definition } from '../src/definition';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-cli-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function io(): CliIo & { stdout: string[]; stderr: string[] } {
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

function run(args: string[], output: CliIo): Promise<number> {
  return runCli(definition, {
    argv: [...args, '--state-dir', root, '--no-observer', '--no-report'],
    io: output,
  });
}

function json(output: { stdout: string[] }): Record<string, unknown> {
  return JSON.parse(output.stdout.join('')) as Record<string, unknown>;
}

function actionIds(payload: Record<string, unknown>): string[] {
  return (payload.actions as { id: string }[]).map((action) => action.id);
}

describe('lobster-cli-ink CLI', () => {
  it('opens on the first act with a legal, bounded action list', async () => {
    const output = io();
    expect(await run(['new', '--seed', '7', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.ok).toBe(true);
    expect(payload.game).toMatchObject({ id: 'lobster-cli-ink', name: '横着写' });
    expect(payload.turn).toBe(0);
    expect(payload.outcome).toBe('ongoing');
    const ids = actionIds(payload);
    expect(ids.length).toBeGreaterThanOrEqual(4);
    expect(ids.length).toBeLessThanOrEqual(9);
    const status = payload.status as { headline: string };
    expect(status.headline).toContain('第 1/18 幕');
    expect(status.headline).toContain('归墟镇');
  });

  it('advances exactly one act per turn and keeps the run going', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    const first = json(output);
    const actionId = actionIds(first)[0]!;

    output.stdout.length = 0;
    expect(await run(['act', actionId, '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.turn).toBe(1);
    expect(payload.outcome).toBe('ongoing');
    const status = payload.status as { headline: string };
    expect(status.headline).toContain('第 2/18 幕');
    expect((payload.actions as unknown[]).length).toBeGreaterThan(0);
  });

  it('rejects an illegal action with exit code 4', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'travel:post', '--json'], output)).toBe(4);
    const payload = json(output) as { ok: boolean; error: { code: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('ILLEGAL_ACTION');
  });

  it('writes a readable markdown recap', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    await run(['act', actionIds(json(output))[0]!, '--json'], output);
    output.stdout.length = 0;
    expect(await run(['recap', '--format', 'markdown'], output)).toBe(0);
    const text = output.stdout.join('\n');
    expect(text).toContain('横着写');
    expect(text).toContain('Memory prompt');
  });

  it('settles an abort without pretending it was a win', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'abort', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.outcome).toBe('aborted');
  });

  it('replays identically from the same seed', async () => {
    const first = io();
    await run(['new', '--seed', '11', '--json'], first);
    const a = json(first);

    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });

    const second = io();
    await run(['new', '--seed', '11', '--json'], second);
    const b = json(second);

    expect((a.status as { headline: string }).headline).toBe(
      (b.status as { headline: string }).headline,
    );
    expect(actionIds(a)).toEqual(actionIds(b));
  });
});
