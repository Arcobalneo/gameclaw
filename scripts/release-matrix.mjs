import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * One entry per game x platform. Linux and macOS arm64 runners also cross-build
 * the second architecture with Bun, keeping the release matrix to three runners.
 */
const PLATFORM_RUNNERS = [
  { platform: 'linux-x64', runner: 'ubuntu-latest', native: true },
  { platform: 'linux-arm64', runner: 'ubuntu-latest', native: false },
  { platform: 'darwin-arm64', runner: 'macos-14', native: true },
  { platform: 'darwin-x64', runner: 'macos-14', native: false },
  { platform: 'windows-x64', runner: 'windows-2025', native: true },
];

const gamesDir = path.join(ROOT, 'games');
const games = fs
  .readdirSync(gamesDir)
  .filter((name) => {
    const pkgFile = path.join(gamesDir, name, 'package.json');
    if (!fs.existsSync(pkgFile)) return false;
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    return typeof pkg.name === 'string' && pkg.name.startsWith('@gameclaw/');
  })
  .sort();

const include = [];
for (const gameId of games) {
  for (const entry of PLATFORM_RUNNERS) {
    include.push({ game_id: gameId, ...entry });
  }
}

if (process.argv.includes('--ids')) {
  // GitHub matrix expansion rejects an empty array; the CI build job skips
  // this sentinel explicitly so the foundation branch can stay green.
  console.log(JSON.stringify(games.length > 0 ? games : ['__none__']));
} else {
  console.log(JSON.stringify({ include }));
}
