#!/usr/bin/env node
/**
 * v4 ships no CLI binaries.
 *
 * GitHub workflows still call this file, and this change cannot edit
 * `.github/workflows` (the token has no workflow scope).
 *
 * `--ids` prints ["__none__"] so ci.yml skips the binary build job.
 * Do not tag a release until release.yml is retired: it would try to build
 * this sentinel and fail looking for archives.
 */
const sentinel = {
  include: [
    {
      game_id: '__none__',
      platform: 'linux-x64',
      runner: 'ubuntu-latest',
      native: true,
    },
  ],
};

if (process.argv.includes('--ids')) {
  console.log(JSON.stringify(['__none__']));
} else {
  console.log(JSON.stringify(sentinel));
}
