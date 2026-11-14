import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type CliIo, runCli } from '@gameclaw/gamekit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { definition } from '../src/definition';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vege-cli-'));
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

describe('shrimp-greens CLI', () => {
  it('opens a sixteen-seat life and says the vegetarianism is chosen', async () => {
    const output = io();
    expect(await run(['new', '--seed', '7', '--content', 'steady:meat', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.ok).toBe(true);
    expect((payload.game as { id: string; version: string }).id).toBe('shrimp-greens');
    expect((payload.game as { version: string }).version).toBe('3.0.0');
    expect(payload.phase).toBe('家里');
    expect(payload.turn).toBe(0);
    expect(payload.outcome).toBe('ongoing');
    const status = payload.status as {
      headline: string;
      sections: { title: string; lines: string[] }[];
    };
    expect(status.headline).toContain('第 1/16 席');
    expect(status.headline).toContain('无肉不欢');
    const who = status.sections.find((section) => section.title === '你是谁');
    expect(who?.lines.join('')).toContain('胎内素');
    expect(actionIds(payload)).toContain('hold');
    expect(actionIds(payload)).toContain('share');
  });

  it('advances one seat per act', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--content', 'steady:meat', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'hold', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.turn).toBe(1);
    expect(payload.outcome).toBe('ongoing');
    expect((payload.actions as unknown[]).length).toBeGreaterThan(0);
    expect((payload.log as string[]).length).toBeGreaterThan(0);
  });

  it('rejects a stove action at the family table', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--content', 'steady:meat', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'stock', '--json'], output)).toBe(4);
    const payload = json(output) as { ok: boolean; error: { code: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('ILLEGAL_ACTION');
  });

  it('writes a markdown recap with a memory prompt', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    await run(['act', 'hold', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['recap', '--format', 'markdown'], output)).toBe(0);
    const text = output.stdout.join('\n');
    expect(text).toContain('# 虾素');
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

  it('replays a seed into the same headline and action list', async () => {
    const first = io();
    const second = io();
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'vege-cli-'));
    await run(['new', '--seed', '11', '--content', 'soft:veg', '--json'], first);
    await runCli(definition, {
      argv: [
        'new',
        '--seed',
        '11',
        '--content',
        'soft:veg',
        '--json',
        '--state-dir',
        other,
        '--no-observer',
        '--no-report',
      ],
      io: second,
    });
    const left = json(first);
    const right = json(second);
    expect(left.status).toEqual(right.status);
    expect(actionIds(left)).toEqual(actionIds(right));
    fs.rmSync(other, { recursive: true, force: true });
  });
});
