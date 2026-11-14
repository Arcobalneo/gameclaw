#!/usr/bin/env node
/**
 * Catalog, packages, README and SKILL agree on the web product.
 *
 * Fails when:
 * - a catalog game has no package, or a package is missing from the catalog
 * - package versions drift from the root
 * - a score rule is missing, or its English text contains CJK
 * - README.md does not mention a shipped game id
 * - SKILL.md hardcodes a shipped game id
 * - a relative markdown link does not resolve
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CJK = /[\u3400-\u9fff]/;
const errors = [];

const rootVersion = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog', 'games.json'), 'utf8'));

if (catalog.schema !== 2) errors.push(`catalog: unsupported schema ${catalog.schema}`);
if (catalog.product !== 'web') errors.push('catalog: product must be "web"');
for (const key of ['site', 'skill', 'catalog']) {
  if (!catalog.repo?.[key]) errors.push(`catalog: repo.${key} is missing`);
}
if (catalog.platforms || catalog.games?.some((game) => game.release_assets || game.binary)) {
  errors.push('catalog: CLI platforms, binaries and release assets are not part of v4');
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

const versionFiles = [
  'package.json',
  'packages/gamekit/package.json',
  'web/package.json',
  'relay/package.json',
  ...onDisk.map((id) => `games/${id}/package.json`),
];
for (const rel of versionFiles) {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  if (pkg.version !== rootVersion) {
    errors.push(`${rel}: version ${pkg.version} != ${rootVersion}`);
  }
}

for (const game of catalog.games) {
  const dir = path.join(ROOT, game.source_dir ?? `games/${game.id}`);
  if (!fs.existsSync(dir)) errors.push(`${game.id}: missing source_dir ${game.source_dir}`);
  if (fs.existsSync(path.join(dir, 'src', 'main.ts'))) {
    errors.push(`${game.id}: src/main.ts is a CLI entrypoint and must not ship`);
  }
  const zh = game.score?.zh ?? '';
  const en = game.score?.en ?? '';
  if (!zh || !en) errors.push(`${game.id}: score.zh and score.en are required`);
  if (CJK.test(en)) errors.push(`${game.id}: score.en contains CJK`);
  const readme = path.join(dir, 'README.md');
  if (!fs.existsSync(readme)) errors.push(`${game.id}: missing README.md`);
  else if (!fs.readFileSync(readme, 'utf8').includes(game.id)) {
    errors.push(`${game.id}: README.md does not mention the id`);
  }
}

const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const skill = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf8');
for (const id of shipped) {
  if (!readme.includes(id)) errors.push(`README.md does not mention ${id}`);
  if (skill.includes(id)) errors.push(`SKILL.md must not hardcode shipped game id ${id}`);
}
for (const needle of [
  'https://arcobalneo.github.io/gameclaw/',
  'catalog/games.json',
  'https://github.com/Arcobalneo/gameclaw/blob/main/SKILL.md',
]) {
  if (!skill.includes(needle)) errors.push(`SKILL.md does not mention ${needle}`);
}
if (/darwin-arm64|windows-x64|bun build|single-file/.test(skill)) {
  errors.push('SKILL.md still describes CLI binaries or platform assets');
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

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
console.log(`catalog ok: ${catalog.games.length} web games, schema ${catalog.schema}`);
