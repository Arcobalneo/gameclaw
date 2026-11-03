import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type CliIo, runCli } from '@gameclaw/gamekit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { definition } from '../src/definition';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'pumpkin-cli-'));
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

describe('shrimp-rampage CLI', () => {
  it('starts a run on the first night with a full stamina bar', async () => {
    const output = io();
    expect(await run(['new', '--seed', '7', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.ok).toBe(true);
    expect(payload.phase).toBe('第 1 夜');
    expect(payload.turn).toBe(0);
    expect(actionIds(payload)).toContain('probe:p1');
    expect(actionIds(payload)).toContain('end-night');
    const status = payload.status as { headline: string };
    expect(status.headline).toContain('动作 0/6');
    expect(status.headline).toContain('体力 16/16');
  });

  it('advances one turn per act and keeps the action list legal', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'probe:p1', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.turn).toBe(1);
    expect(payload.phase).toBe('第 1 夜');
    expect(payload.outcome).toBe('ongoing');
    expect((payload.actions as unknown[]).length).toBeGreaterThan(0);
  });

  it('rejects illegal actions with exit code 4', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'soothe:candy:p1', '--json'], output)).toBe(4);
    const payload = json(output) as { ok: boolean; error: { code: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('ILLEGAL_ACTION');
  });

  it('spends stamina for every field action', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    await run(['act', 'water:p1', '--json'], output);
    const payload = json(output);
    const status = payload.status as { headline: string };
    expect(status.headline).toContain('动作 1/6');
    expect(status.headline).toContain('体力 15/16');
  });

  it('writes a readable markdown recap', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    await run(['act', 'probe:p1', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['recap', '--format', 'markdown'], output)).toBe(0);
    const text = output.stdout.join('\n');
    expect(text).toContain('# 虾闹');
    expect(text).toContain('Memory prompt');
  });

  it('settles an abort without pretending it was a win or a loss', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'abort', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.outcome).toBe('aborted');
    expect((payload.actions as unknown[]).length).toBe(0);
  });

  it('replays identically from the same seed', async () => {
    const first = io();
    await run(['new', '--seed', '11', '--json'], first);
    first.stdout.length = 0;
    await run(['act', 'probe:p3', '--json'], first);
    const a = json(first);

    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });

    const second = io();
    await run(['new', '--seed', '11', '--json'], second);
    second.stdout.length = 0;
    await run(['act', 'probe:p3', '--json'], second);
    const b = json(second);

    expect((a.status as { headline: string }).headline).toBe(
      (b.status as { headline: string }).headline,
    );
    expect(actionIds(a)).toEqual(actionIds(b));
  });
});
