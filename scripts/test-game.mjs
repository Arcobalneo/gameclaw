#!/usr/bin/env node
/**
 * Test one game through the repo-level entrypoint.
 *
 * Usage: node scripts/test-game.mjs <game-id> [--watch]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gameId = process.argv[2];
if (!gameId) {
  console.error('usage: node scripts/test-game.mjs <game-id>');
  process.exit(1);
}
const gameDir = path.join(ROOT, 'games', gameId);
const packageFile = path.join(gameDir, 'package.json');
if (!fs.existsSync(packageFile)) {
  console.error(`test-game: unknown game id: ${gameId}`);
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit', cwd: ROOT });
}

run('pnpm', ['--filter', pkg.name, 'check']);
run('pnpm', ['--filter', pkg.name, 'test']);
