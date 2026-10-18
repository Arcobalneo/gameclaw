#!/usr/bin/env node
/**
 * Build one game into a single-file binary (and archive when packaging).
 *
 * Usage:
 *   node scripts/build-game.mjs <game-id> [--platform <os>-<arch>] [--no-archive]
 *
 * Platforms: darwin-arm64, darwin-x64, linux-x64, linux-arm64, windows-x64.
 * Default: the current host platform.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`build-game: ${message}`);
  process.exit(1);
}

function hostPlatform() {
  const osName = process.platform === 'win32' ? 'windows' : process.platform;
  const arch = process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : process.arch;
  return `${osName}-${arch}`;
}

function parsePlatform(raw) {
  const match = /^(darwin|linux|windows)-(x64|arm64)$/.exec(raw ?? '');
  if (!match) {
    fail(`invalid platform "${raw}", expected darwin|linux|windows-x64|arm64`);
  }
  return { os: match[1], arch: match[2], label: `${match[1]}-${match[2]}` };
}

function bunTarget(platform) {
  return `bun-${platform.os}-${platform.arch}`;
}

function archiveName(gameId, platform) {
  return platform.os === 'windows' ? `${gameId}-${platform.label}.zip` : `${gameId}-${platform.label}.tar.gz`;
}

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', cwd: ROOT, ...options });
}

function sha256(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function packageArtifact(gameId, platform, gameDir, binaryPath, outDir) {
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), `gameclaw-${gameId}-`));
  const stage = path.join(stageDir, `${gameId}-${platform.label}`);
  fs.mkdirSync(stage, { recursive: true });
  const binaryName = platform.os === 'windows' ? `${gameId}.exe` : gameId;
  fs.copyFileSync(binaryPath, path.join(stage, binaryName));
  try {
    fs.chmodSync(path.join(stage, binaryName), 0o755);
  } catch {
    // Windows does not need a POSIX execute bit.
  }
  for (const file of ['README.md', 'LICENSE']) {
    const source = path.join(gameDir, file);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(stage, file));
  }
  const checksum = `${sha256(path.join(stage, binaryName))}  ${binaryName}\n`;
  fs.writeFileSync(path.join(stage, 'SHA256SUMS'), checksum, 'utf8');

  const archivePath = path.join(outDir, archiveName(gameId, platform));
  if (platform.os === 'windows') {
    if (process.platform === 'win32') {
      run('powershell', [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path "${stageDir}\\*" -DestinationPath "${archivePath}" -Force`,
      ]);
    } else {
      run('zip', ['-q', '-r', archivePath, path.basename(stage)], { cwd: stageDir });
    }
  } else {
    run('tar', ['-czf', archivePath, '-C', stageDir, path.basename(stage)]);
  }
  fs.rmSync(stageDir, { recursive: true, force: true });
  return archivePath;
}

const args = process.argv.slice(2);
const gameId = args[0];
if (!gameId) fail('usage: node scripts/build-game.mjs <game-id> [--platform <os>-<arch>]');
const platformIndex = args.indexOf('--platform');
const platform = parsePlatform(platformIndex >= 0 ? args[platformIndex + 1] : hostPlatform());
const shouldArchive = !args.includes('--no-archive');

const gameDir = path.join(ROOT, 'games', gameId);
if (!fs.existsSync(path.join(gameDir, 'package.json'))) fail(`unknown game id: ${gameId}`);

const outDir = path.join(gameDir, 'dist');
fs.mkdirSync(outDir, { recursive: true });

const binaryName = gameId;
const binaryPath = path.join(outDir, `${binaryName}${platform.os === 'windows' ? '.exe' : ''}`);

console.log(`build-game: ${gameId} -> ${platform.label}`);
run('bun', [
  'build',
  '--compile',
  '--minify',
  `--target=${bunTarget(platform)}`,
  path.join(gameDir, 'src', 'main.ts'),
  '--outfile',
  binaryPath,
]);

// Ad-hoc sign macOS binaries so Gatekeeper is less hostile to a fresh download.
if (platform.os === 'darwin' && process.platform === 'darwin') {
  try {
    run('codesign', ['--force', '--sign', '-', binaryPath]);
    console.log('build-game: ad-hoc codesigned');
  } catch {
    console.warn('build-game: codesign failed, shipping unsigned binary');
  }
}

// Verify the produced binary is executable on the host platform.
if (platform.label === hostPlatform()) {
  const version = execFileSync(binaryPath, ['--version'], { encoding: 'utf8' }).trim();
  console.log(`build-game: smoke ${binaryName} --version -> ${version}`);
} else {
  console.log('build-game: cross-compiled artifact, skipping host smoke run');
}

if (shouldArchive) {
  const archivePath = packageArtifact(gameId, platform, gameDir, binaryPath, outDir);
  console.log(`build-game: archive ${archivePath}`);
}
