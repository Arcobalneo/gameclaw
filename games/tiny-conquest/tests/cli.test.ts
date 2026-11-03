import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type CliIo, runCli } from '@gameclaw/gamekit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { definition } from '../src/definition';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-cli-'));
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

describe('tiny-conquest CLI', () => {
  it('opens with catalog display metadata and the selected target', async () => {
    const output = io();
    expect(await run(['new', '--seed', '7', '--content', 'mirror', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.ok).toBe(true);
    expect(payload.game).toMatchObject({
      id: 'tiny-conquest',
      name: '璿芃攻略',
      englishName: 'Tiny Conquest',
      version: '2.4.0',
    });
    expect(payload.phase).toBe('野外');
    expect(payload.turn).toBe(0);
    expect(payload.outcome).toBe('ongoing');
    expect((payload.status as { headline: string }).headline).toContain('鏡面國');
    expect(actionIds(payload)).toContain('design');
    expect(actionIds(payload)).toContain('steal');
  });

  it('selects a target and then advances one week per field action', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    expect(actionIds(json(output))).toContain('target:harvest');
    output.stdout.length = 0;
    await run(['act', 'target:harvest', '--json'], output);
    expect(json(output).phase).toBe('野外');
    output.stdout.length = 0;
    expect(await run(['act', 'aid', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.turn).toBe(2);
    expect(payload.outcome).toBe('ongoing');
    expect((payload.log as string[]).length).toBeGreaterThan(0);
    expect((payload.actions as unknown[]).length).toBeGreaterThan(0);
  });

  it('supports the complete non-interactive workshop input sequence', async () => {
    const output = io();
    await run(['new', '--seed', '8', '--content', 'harvest', '--json'], output);
    for (const action of [
      'design',
      'part:frame:match',
      'part:head:feather',
      'part:drive:rubber',
      'assemble',
    ]) {
      output.stdout.length = 0;
      expect(await run(['act', action, '--json'], output)).toBe(0);
    }
    const payload = json(output);
    expect(actionIds(payload)).toContain('raid');
    expect((payload.log as string[]).join('\n')).toContain('威力 2');
  });

  it('rejects an illegal phase action with a stable error', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--content', 'harvest', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'respond:flee', '--json'], output)).toBe(4);
    const payload = json(output) as { ok: boolean; error: { code: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('ILLEGAL_ACTION');
  });

  it('writes a markdown recap with a memory prompt', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    await run(['act', 'target:harvest', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['recap', '--format', 'markdown'], output)).toBe(0);
    const text = output.stdout.join('\n');
    expect(text).toContain('# 璿芃攻略');
    expect(text).toContain('Memory prompt');
  });

  it('settles an abort without a win or a loss', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'abort', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.outcome).toBe('aborted');
    expect((payload.actions as unknown[]).length).toBe(0);
  });

  it('replays the same seed and actions into identical frames', async () => {
    const first = io();
    const second = io();
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-cli-'));
    try {
      await run(['new', '--seed', '11', '--content', 'harvest', '--json'], first);
      await runCli(definition, {
        argv: [
          'new',
          '--seed',
          '11',
          '--content',
          'harvest',
          '--json',
          '--state-dir',
          other,
          '--no-observer',
          '--no-report',
        ],
        io: second,
      });
      first.stdout.length = 0;
      second.stdout.length = 0;
      await run(['act', 'scout', '--json'], first);
      await runCli(definition, {
        argv: ['act', 'scout', '--json', '--state-dir', other, '--no-observer', '--no-report'],
        io: second,
      });
      const left = json(first);
      const right = json(second);
      expect(left.status).toEqual(right.status);
      expect(left.log).toEqual(right.log);
      expect(left.events).toEqual(right.events);
      expect(actionIds(left)).toEqual(actionIds(right));
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });
});
