import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const gameRoot = path.resolve(import.meta.dirname, '..');
const cli = ['--import', 'tsx', path.join(gameRoot, 'src', 'cli.tsx')];

function run(args: string[], home: string) {
  return spawnSync(process.execPath, [...cli, ...args], {
    cwd: gameRoot,
    encoding: 'utf8',
    env: { ...process.env, HOME: home }
  });
}

test('help prints core commands', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hzk-help-'));
  const result = run(['--help'], home);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /new --slot/);
  assert.match(result.stdout, /act --slot/);
});

test('new -> actions -> act -> recap flow works', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hzk-flow-'));
  let result = run(['new', '--slot', '0', '--case', 'sealed-tide-station', '--seed', '42'], home);
  assert.equal(result.status, 0, result.stderr || '');
  assert.match(result.stdout, /STATE:/);
  assert.match(result.stdout, /OBSERVER:/);

  result = run(['actions', '--slot', '0'], home);
  assert.equal(result.status, 0);
  const firstAction = result.stdout.split('\n').find((line) => line.startsWith('inspect:'))?.split(' :: ')[0];
  assert.ok(firstAction);

  result = run(['act', '--slot', '0', firstAction!], home);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /RESULT:/);

  result = run(['recap', '--slot', '0', '--format', 'text'], home);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /CASE:/);
  assert.match(result.stdout, /ASCII WITNESS:/);
});

test('backflow-inn case loads and plays', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hzk-inn-'));
  let result = run(['new', '--slot', '1', '--case', 'backflow-inn', '--seed', '99'], home);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /返潮招待所/);

  result = run(['status', '--slot', '1'], home);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /STATE:/);
});

test('saves list works', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hzk-saves-'));
  const result = run(['saves'], home);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /slot=0/);
});
