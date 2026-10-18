import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type CliIo, runCli } from '@gameclaw/gamekit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { definition } from '../src/definition';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'sideways-look-cli-'));
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

function run(args: string[], output: CliIo) {
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

describe('sideways-look CLI', () => {
  it('starts a run with --content and exposes the case, metrics and actions', async () => {
    const output = io();
    expect(
      await run(['new', '--seed', '7', '--content', 'sealed-tide-station', '--json'], output),
    ).toBe(0);
    const payload = json(output);
    expect(payload.ok).toBe(true);
    expect(payload.phase).toBe('exploring');
    expect(payload.turn).toBe(0);
    expect((payload.game as { id: string; version: string }).id).toBe('lobster-cli-sideways-look');
    expect((payload.game as { version: string }).version).toBe('2.0.0');
    expect(actionIds(payload)).toEqual(
      expect.arrayContaining(['inspect:left-window', 'move:monitor-hall', 'brace']),
    );
    const metrics = payload.status as { metrics: { label: string; value: unknown }[] };
    expect(metrics.metrics.map((metric) => metric.label)).toEqual(['专注', '神经', '恐惧', '证据']);
  });

  it('runs inspect then record through the JSON envelope', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--content', 'sealed-tide-station', '--json'], output);
    output.stdout.length = 0;

    expect(await run(['act', 'inspect:left-window', '--json'], output)).toBe(0);
    let payload = json(output);
    expect(payload.turn).toBe(1);
    expect((payload.log as string[]).join('\n')).toContain('现象被命名为');
    expect(actionIds(payload)).toContain('record');

    output.stdout.length = 0;
    expect(await run(['act', 'record', '--json'], output)).toBe(0);
    payload = json(output);
    expect(payload.turn).toBe(2);
    const metrics = (payload.status as { metrics: { label: string; value: unknown }[] }).metrics;
    expect(metrics.find((metric) => metric.label === '证据')?.value).toBe('1/3');
    expect((payload.events as { type: string }[]).some((event) => event.type === 'record')).toBe(
      true,
    );
  });

  it('supports case selection without --content', async () => {
    const output = io();
    expect(await run(['new', '--seed', '9', '--json'], output)).toBe(0);
    const select = json(output);
    expect(select.phase).toBe('case-select');
    expect(actionIds(select)).toContain('choose:archive-corridor');

    output.stdout.length = 0;
    expect(await run(['act', 'choose:archive-corridor', '--json'], output)).toBe(0);
    const chosen = json(output);
    expect(chosen.phase).toBe('exploring');
    expect(chosen.turn).toBe(1);
    expect((chosen.status as { headline: string }).headline).toContain('归档长廊');
  });

  it('rejects illegal actions with exit code 4 and a machine-readable error', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--content', 'sealed-tide-station', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'inspect:not-a-target', '--json'], output)).toBe(4);
    const payload = json(output) as { ok: boolean; error: { code: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('ILLEGAL_ACTION');
  });

  it('extracts with the wrong record as a lost ending', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--content', 'sealed-tide-station', '--json'], output);
    for (const action of [
      'move:monitor-hall',
      'move:archive-bay',
      'interact:claim-record',
      'move:exit-lock',
    ]) {
      output.stdout.length = 0;
      expect(await run(['act', action, '--json'], output)).toBe(0);
    }
    expect(json(output).outcome).toBe('ongoing');

    output.stdout.length = 0;
    expect(await run(['act', 'extract', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.outcome).toBe('lost');
    expect((payload.status as { headline: string }).headline).toContain('错误记录');
    expect(actionIds(payload)).toHaveLength(0);
    expect((payload.log as string[]).join('\n')).toContain('错误记录');
  });

  it('aborts cleanly and produces a markdown recap', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--content', 'blind-screen-room', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'abort', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.outcome).toBe('aborted');
    expect(actionIds(payload)).toHaveLength(0);

    output.stdout.length = 0;
    expect(await run(['recap', '--format', 'markdown'], output)).toBe(0);
    const markdown = output.stdout.join('\n');
    expect(markdown).toContain('# 横着看：只给龙虾玩的 CLI 视觉恐怖');
    expect(markdown).toContain('## Memory prompt');
  });
});
