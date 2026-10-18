import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type CliIo, runCli } from '@gameclaw/gamekit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { definition } from '../src/definition';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'tower-defense-cli-'));
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

function metric(payload: Record<string, unknown>, label: string): unknown {
  const status = payload.status as { metrics: { label: string; value: unknown }[] };
  return status.metrics.find((item) => item.label === label)?.value;
}

describe('tower defense CLI', () => {
  it('starts a run in the doctrine phase', async () => {
    const output = io();
    expect(await run(['new', '--seed', '7', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.ok).toBe(true);
    expect(payload.phase).toBe('doctrine');
    expect(actionIds(payload)).toEqual(
      expect.arrayContaining(['doctrine:crusher', 'doctrine:oracle', 'doctrine:gambler']),
    );
  });

  it('walks through new, setup, ready, hold, status, actions and recap', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);

    output.stdout.length = 0;
    expect(await run(['act', 'doctrine:crusher', '--json'], output)).toBe(0);
    let payload = json(output);
    expect(payload.turn).toBe(1);
    expect(payload.phase).toBe('setup');
    expect(actionIds(payload)).toEqual(expect.arrayContaining(['deploy:reef-guard:C', 'ready']));

    output.stdout.length = 0;
    expect(await run(['act', 'deploy:reef-guard:C', '--json'], output)).toBe(0);
    payload = json(output);
    expect(payload.phase).toBe('setup');
    expect(metric(payload, '潮令')).toBe(5);

    output.stdout.length = 0;
    expect(await run(['act', 'ready', '--json'], output)).toBe(0);
    payload = json(output);
    expect(payload.phase).toBe('battle');
    expect(payload.turn).toBe(3);

    output.stdout.length = 0;
    expect(await run(['status', '--json'], output)).toBe(0);
    payload = json(output);
    expect((payload.status as { headline: string }).headline).toContain('Pulse 1/10');

    output.stdout.length = 0;
    expect(await run(['actions', '--json'], output)).toBe(0);
    payload = json(output);
    expect(actionIds(payload)).toEqual(expect.arrayContaining(['hold', 'recall:C', 'skill']));

    output.stdout.length = 0;
    expect(await run(['act', 'hold', '--json'], output)).toBe(0);
    payload = json(output);
    expect(payload.turn).toBe(4);
    expect((payload.log as string[]).join('\n')).toContain('入潮');

    output.stdout.length = 0;
    expect(await run(['recap', '--json'], output)).toBe(0);
    payload = json(output);
    expect(payload.ok).toBe(true);
    const recap = payload.recap as { title: string; outcome: string; cause: string };
    expect(recap.title).toContain('横着守');
    expect(recap.outcome).toBe('ongoing');
    expect(recap.cause.length).toBeGreaterThan(0);
  });

  it('rejects an illegal deploy with exit code 4', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    await run(['act', 'doctrine:crusher', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'deploy:reef-guard:LP', '--json'], output)).toBe(4);
    const payload = json(output) as { ok: boolean; error: { code: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('ILLEGAL_ACTION');
  });

  it('aborts a run and exposes the terminal state', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'abort', '--json'], output)).toBe(0);
    let payload = json(output);
    expect(payload.outcome).toBe('aborted');
    expect(actionIds(payload)).toEqual([]);

    output.stdout.length = 0;
    expect(await run(['status', '--json'], output)).toBe(0);
    payload = json(output);
    expect((payload.status as { headline: string }).headline).toContain('中止');

    output.stdout.length = 0;
    expect(await run(['recap', '--json'], output)).toBe(0);
    payload = json(output);
    expect((payload.recap as { outcome: string }).outcome).toBe('aborted');
  });
});
