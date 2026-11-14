import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type CliIo, runCli } from '@gameclaw/gamekit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { definition } from '../src/definition';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'burger-cli-'));
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

describe('shrimp-burger CLI', () => {
  it('opens with new --seed --json', async () => {
    const output = io();
    expect(await run(['new', '--seed', '7', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.ok).toBe(true);
    expect(payload.game).toMatchObject({
      id: 'shrimp-burger',
      name: '虾堡',
      englishName: 'Shrimp Burger',
      version: '3.0.0',
    });
    expect(payload.outcome).toBe('ongoing');
    expect(actionIds(payload)).toContain('serve');
    expect(actionIds(payload)).toContain('wait');
    expect(String(payload.next)).toMatch(/^act /);
    const status = payload.status as { sections: { title: string; lines: string[] }[] };
    const titles = status.sections.map((section) => section.title);
    expect(titles.some((title) => title.includes('单'))).toBe(true);
    expect(titles).toContain('落物三格');
  });

  it('executes next and returns a complete frame', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    const opened = json(output);
    const next = String(opened.next).slice(4);
    output.stdout.length = 0;
    expect(await run(['act', next, '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.turn).toBe(1);
    expect((payload.log as string[]).length).toBeGreaterThan(0);
    expect(payload.next === null || String(payload.next).startsWith('act ')).toBe(true);
  });

  it('reports version 3.0.0', async () => {
    const output = io();
    expect(await run(['--version'], output)).toBe(0);
    expect(output.stdout.join('')).toMatch(/shrimp-burger v3\.0\.0/);
  });

  it('recap works after abort', async () => {
    const output = io();
    await run(['new', '--seed', '9', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'abort', '--json'], output)).toBe(0);
    expect(json(output).outcome).toBe('aborted');
    output.stdout.length = 0;
    expect(await run(['recap', '--json'], output)).toBe(0);
    const recap = json(output);
    expect(recap.ok).toBe(true);
    expect(String((recap.recap as { cause: string }).cause)).toMatch(/收摊|abort|主动/);
  });
});
