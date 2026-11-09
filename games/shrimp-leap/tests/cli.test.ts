import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type CliIo, runCli } from '@gameclaw/gamekit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { definition } from '../src/definition';

let root: string;
const extraRoots: string[] = [];

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'leap-cli-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  for (const extra of extraRoots.splice(0)) fs.rmSync(extra, { recursive: true, force: true });
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

function run(args: string[], output: CliIo, stateRoot = root): Promise<number> {
  return runCli(definition, {
    argv: [...args, '--state-dir', stateRoot, '--no-observer', '--no-report'],
    io: output,
  });
}

function json(output: { stdout: string[] }): Record<string, unknown> {
  return JSON.parse(output.stdout.join('')) as Record<string, unknown>;
}

function actionIds(payload: Record<string, unknown>): string[] {
  return (payload.actions as { id: string }[]).map((action) => action.id);
}

describe('shrimp-leap CLI', () => {
  it('opens with new --seed --json and honest setup actions', async () => {
    const output = io();
    expect(await run(['new', '--seed', '7', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.ok).toBe(true);
    expect(payload.game).toMatchObject({
      id: 'shrimp-leap',
      name: '虾跃',
      englishName: 'Shrimp Leap',
      version: '2.8.0',
    });
    expect(payload.phase).toBe('塑形');
    expect(payload.outcome).toBe('ongoing');
    expect(actionIds(payload)).toEqual(['nature:bold', 'nature:steady', 'nature:mellow', 'abort']);
    expect(payload.next).toBe('act nature:bold');
  });

  it('chooses a build and resolves a listed jump with a complete next frame', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--content', 'steady:mint', '--json'], output);
    const opened = json(output);
    expect(opened.phase).toBe('跳街');
    expect(opened.next).toMatch(/^act /);
    const next = String(opened.next).slice(4);
    output.stdout.length = 0;
    expect(await run(['act', next, '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.turn).toBe(1);
    expect(payload.outcome).toBe('ongoing');
    expect((payload.log as string[]).length).toBeGreaterThan(0);
    expect((payload.events as unknown[]).length).toBeGreaterThan(0);
    expect(actionIds(payload).length).toBeGreaterThan(0);
    expect(payload.next).toBe(`act ${actionIds(payload)[0]}`);
  });

  it('accepts every action id exposed by the current JSON frame', async () => {
    const output = io();
    await run(['new', '--seed', '9', '--content', 'bold:coral', '--json'], output);
    const payload = json(output);
    for (const id of actionIds(payload)) {
      const other = fs.mkdtempSync(path.join(os.tmpdir(), 'leap-cli-action-'));
      extraRoots.push(other);
      await run(['new', '--seed', '9', '--content', 'bold:coral', '--json'], io(), other);
      const attempt = io();
      expect(await run(['act', id, '--json'], attempt, other), id).toBe(0);
      expect(json(attempt).ok).toBe(true);
    }
  });

  it('rejects an action that is not legal in the current phase', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'jump:mid:arc:on', '--json'], output)).toBe(4);
    const payload = json(output) as { ok: boolean; error: { code: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('ILLEGAL_ACTION');
  });

  it('returns an ongoing JSON recap with an honest memory prompt', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--content', 'steady:mint', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['recap', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.outcome).toBe('ongoing');
    expect(payload.recap).toMatchObject({ outcome: 'ongoing' });
    expect((payload.recap as { memoryPrompt: string }).memoryPrompt).toContain('重新验证');
  });

  it('writes a markdown recap', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--content', 'steady:mint', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['recap', '--format', 'markdown'], output)).toBe(0);
    expect(output.stdout.join('\n')).toContain('# 虾跃');
    expect(output.stdout.join('\n')).toContain('Memory prompt');
  });

  it('replays the same seed and action into identical JSON frames', async () => {
    const first = io();
    const second = io();
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'leap-cli-replay-'));
    extraRoots.push(other);
    await run(['new', '--seed', '11', '--content', 'mellow:lilac', '--json'], first);
    await run(['new', '--seed', '11', '--content', 'mellow:lilac', '--json'], second, other);
    expect(json(first).status).toEqual(json(second).status);
    const action = String(json(first).next).slice(4);
    first.stdout.length = 0;
    second.stdout.length = 0;
    await run(['act', action, '--json'], first);
    await run(['act', action, '--json'], second, other);
    expect(json(first).status).toEqual(json(second).status);
    expect(json(first).log).toEqual(json(second).log);
    expect(json(first).events).toEqual(json(second).events);
    expect(actionIds(json(first))).toEqual(actionIds(json(second)));
  });

  it('settles abort without calling it a win or a loss', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--content', 'steady:mint', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'abort', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.outcome).toBe('aborted');
    expect(payload.actions as unknown[]).toEqual([]);
    expect(payload.next).toBeNull();
  });
});
