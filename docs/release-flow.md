# Release flow (v4)

v4.0.0 is a web release. There are no CLI binaries and no platform archives.

## What a human publishes

1. **Portal.** From a clean tree:

   ```bash
   GAMECLAW_BASE=/gameclaw/ pnpm --filter @gameclaw/web build
   ```

   Publish `web/dist` to the `gh-pages` branch that serves
   <https://arcobalneo.github.io/gameclaw/>.

2. **Relay.** In `relay/`:

   ```bash
   pnpm --filter @gameclaw/relay test
   wrangler deploy
   ```

   `wrangler.toml` migration `v3` adds the `Leaderboard` Durable Object.
   `v1` (`SessionRoom`, `CodeRegistry`) and `v2` (`PlayStats`) stay. Do not
   edit or delete old migration tags. Deploy once; existing play counts and
   rooms stay on their objects.

The worker needs the existing account auth in the maintainer's environment.
Do not commit tokens.

## What not to do

`.github/workflows/ci.yml` and `release.yml` still describe CLI builds. This
repository's automation token cannot edit workflow files. `scripts/release-matrix.mjs`
prints a `__none__` sentinel so the CI build job skips.

Do **not** push a `v*` tag until those workflows are replaced. `release.yml`
would try to compile binaries and fail the release.

## Version

Root `package.json`, `web`, `relay`, `gamekit`, and every game package share
one version. Each game's `GAME_VERSION` is `4.0.0`. `MemorySession.restore`
rejects a save from another game version, so v3 saves do not load into v4.
