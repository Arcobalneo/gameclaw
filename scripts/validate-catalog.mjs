#!/usr/bin/env node
/**
 * Validate that the catalog, game packages, README and SKILL agree.
 *
 * Fails when:
 * - a catalog entry points at a missing game or package
 * - a shipped game is missing from the catalog
 * - a platform / asset name does not follow the naming contract
 * - README.md / SKILL.md no longer mention a shipped game id
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLATFORMS = ['darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64', 'windows-x64'];
const errors = [];

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog', 'games.json'), 'utf8'));
if (catalog.schema !== 1) errors.push(`catalog: unsupported schema ${catalog.schema}`);
if (JSON.stringify(catalog.platforms) !== JSON.stringify(PLATFORMS)) {
  errors.push('catalog: platform list must match the five supported platforms');
}

const gamesDir = path.join(ROOT, 'games');
const shipped = new Set(catalog.games.map((game) => game.id));
const onDisk = fs.readdirSync(gamesDir).filter((name) => {
  const pkg = path.join(gamesDir, name, 'package.json');
  if (!fs.existsSync(pkg)) return false;
  return JSON.parse(fs.readFileSync(pkg, 'utf8')).name?.startsWith('@gameclaw/');
});

for (const id of shipped) {
  if (!onDisk.includes(id)) errors.push(`catalog: ${id} has no package under games/`);
}
for (const id of onDisk) {
  if (!shipped.has(id)) errors.push(`games/${id}: package exists but is missing from the catalog`);
}

const assetFor = (id, platform) =>
  `${id}-${platform}.${platform === 'windows-x64' ? 'zip' : 'tar.gz'}`;

for (const game of catalog.games) {
  const dir = path.join(ROOT, game.source_dir ?? `games/${game.id}`);
  if (!fs.existsSync(dir)) errors.push(`${game.id}: missing source_dir ${game.source_dir}`);
  const pkgFile = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgFile)) {
    errors.push(`${game.id}: missing package.json`);
  } else {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    if (pkg.version !== '2.0.0') errors.push(`${game.id}: package version ${pkg.version} != 2.0.0`);
  }
  if (game.binary !== game.id) errors.push(`${game.id}: binary must equal the game id`);
  for (const platform of PLATFORMS) {
    const expected = assetFor(game.id, platform);
    const actual = game.release_assets?.[platform];
    if (actual !== expected) {
      errors.push(`${game.id}: asset for ${platform} is ${actual ?? 'missing'}, expected ${expected}`);
    }
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const skill = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf8');
for (const id of shipped) {
  if (!readme.includes(id)) errors.push(`README.md does not mention ${id}`);
  if (!skill.includes(id)) errors.push(`SKILL.md does not mention ${id}`);
}
for (const platform of PLATFORMS) {
  if (!skill.includes(platform)) errors.push(`SKILL.md does not mention platform ${platform}`);
}

// Relative markdown links must resolve, including archived docs.
const markdownFiles = [
  'README.md',
  'README.zh-CN.md',
  'SKILL.md',
  'CONTRIBUTING.md',
  'AGENTS.md',
  ...walk(path.join(ROOT, 'docs')).filter((file) => file.endsWith('.md')),
];
for (const file of markdownFiles) {
  const full = path.isAbsolute(file) ? file : path.join(ROOT, file);
  const text = fs.readFileSync(full, 'utf8');
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0].trim();
    if (!target || /^(https?:|mailto:)/.test(target)) continue;
    const resolved = path.resolve(path.dirname(full), target);
    if (!fs.existsSync(resolved)) {
      errors.push(`${path.relative(ROOT, full)}: broken link ${target}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`catalog validation failed (${errors.length}):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`catalog ok: ${catalog.games.length} games × ${PLATFORMS.length} platforms`);
