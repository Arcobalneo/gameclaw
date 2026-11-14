# Release flow

GameClaw is a web release. There are no CLI binaries and no platform archives.
A version is live when the portal and the relay are published. A git tag is
optional documentation of that version.

## Quality gate

From a clean tree, on the version you intend to ship:

```bash
pnpm lint && pnpm check && pnpm test
pnpm validate:catalog
GAMECLAW_BASE=/gameclaw/ pnpm --filter @gameclaw/web build
```

CI on `main` and on pull requests runs the same lint, typecheck, test, catalog
check, and portal build. It does not publish.

## What a human publishes

1. **Portal.** Publish `web/dist` (built with `GAMECLAW_BASE=/gameclaw/`) to the
   `gh-pages` branch that serves
   <https://arcobalneo.github.io/gameclaw/>. Keep `.nojekyll` and keep
   `404.html` in sync with `index.html` so deep links resolve.

2. **Relay.** In `relay/`:

   ```bash
   pnpm --filter @gameclaw/relay test
   wrangler deploy
   ```

   `wrangler.toml` migrations are append-only. `v1` is `SessionRoom` and
   `CodeRegistry`. `v2` is `PlayStats`. `v3` is `Leaderboard`. Do not edit or
   delete old migration tags. Deploy once; existing rooms, play counts, and
   boards stay on their objects.

The worker uses the maintainer's existing account auth. Do not commit tokens.

3. **Git tag (optional).** After the site and the relay are confirmed live,
   tag `vX.Y.Z` and push the tag. `.github/workflows/release.yml` then opens a
   GitHub Release with notes only. It does not attach binaries and does not
   deploy the site or the relay.

## Version

Root `package.json`, `web`, `relay`, `gamekit`, and every game package share
one version when gameplay or the public contract changes. Each game's
`GAME_VERSION` must match that version: `MemorySession.restore` rejects a save
from another game version.

A docs-only or CI-only cleanup does not need a `GAME_VERSION` bump.
