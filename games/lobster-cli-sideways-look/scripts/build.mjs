/**
 * lobster-cli-sideways-look build script
 * Produces a self-contained Linux x86_64 ELF binary via Node.js SEA.
 *
 * Pipeline:
 *   1. Compile TypeScript -> ESM JS (via tsc)
 *   2. ncc bundle (single file, ESM)
 *   3. Inject bundle as app.mjs asset into SEA blob
 *   4. Copy local Node binary and inject SEA blob via postject
 *
 * Runtime: requires Node 24+ (with --experimental-sea-config support)
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const platform = process.platform === 'darwin' ? 'darwin-arm64' : 'linux-x86_64';
const buildDir = path.join(root, 'build', 'sea-out');
const runtimeDir = path.join(buildDir, 'runtime');
const distDir = path.join(root, 'dist', `lobster-cli-sideways-look-${platform}`);

async function run(cmd, opts = {}) {
  console.error(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
}

async function main() {
  // 1. Clean
  await fs.rm(buildDir, { recursive: true, force: true });
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(buildDir, { recursive: true });
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(distDir, { recursive: true });

  // 2. TypeScript compile
  await run('npx tsc --outDir build/ts --rootDir .');

  // 3. ncc bundle (ESM, single file)
  await run('npx ncc build build/ts/src/cli.js -o build/ncc --minify');

  // 4. Build SEA preparation blob
  // 4a. Write bootstrap (CJS, uses node:sea to load app.mjs asset via tmp file)
  const bootstrap = [
    "const { getAsset } = require('node:sea');",
    "const { writeFileSync, mkdtempSync, unlinkSync } = require('node:fs');",
    "const { tmpdir } = require('node:os');",
    "const { join } = require('node:path');",
    "const raw = getAsset('app.mjs');",
    "const tmpdirPath = mkdtempSync(join(tmpdir(), 'sea-'));",
    "const tmpFile = join(tmpdirPath, 'app.mjs');",
    "writeFileSync(tmpFile, Buffer.from(raw));",
    "import(tmpFile).catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {",
    "  try { unlinkSync(tmpFile); } catch (_) {}",
    "});"
  ].join('\n');
  await fs.writeFile(path.join(buildDir, 'bootstrap.cjs'), bootstrap, 'utf8');

  // 4b. SEA config
  const seaConfig = {
    main: path.join(buildDir, 'bootstrap.cjs'),
    output: path.join(buildDir, 'sea-prep.blob'),
    disableExperimentalSEAWarning: true,
    assets: { 'app.mjs': path.join(root, 'build', 'ncc', 'index.js') }
  };
  await fs.writeFile(
    path.join(buildDir, 'sea-config.json'),
    JSON.stringify(seaConfig, null, 2),
    'utf8'
  );

  // 4c. Generate SEA blob
  await run('node --experimental-sea-config ' + path.join(buildDir, 'sea-config.json'));

  // 5. Copy local Node binary and inject blob
  await fs.copyFile(process.execPath, path.join(runtimeDir, 'lobster-cli-sideways-look'));
  await run(
    'npx postject ' +
      path.join(runtimeDir, 'lobster-cli-sideways-look') +
      ' NODE_SEA_BLOB ' +
      path.join(buildDir, 'sea-prep.blob') +
      ' --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
  );

  // 6. Copy assets to dist
  await fs.copyFile(path.join(root, 'README.md'), path.join(distDir, 'README.md'));
  await fs.copyFile(path.join(root, 'LICENSE'), path.join(distDir, 'LICENSE'));
  await fs.copyFile(
    path.join(runtimeDir, 'lobster-cli-sideways-look'),
    path.join(distDir, 'lobster-cli-sideways-look')
  );

  console.error('Build complete.');
  console.error('  Binary: ' + path.join(distDir, 'lobster-cli-sideways-look'));
  console.error('  To run: ' + path.join(distDir, 'lobster-cli-sideways-look') + ' --help');
}

main().catch((e) => { console.error(e); process.exit(1); });
