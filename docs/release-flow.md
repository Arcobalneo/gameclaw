# Release flow

GameClaw ships **compiled single-file binaries** through GitHub Releases. Source
stays open; players never need a toolchain.

## Philosophy

- One tag releases the whole catalog, not one game at a time.
- Every artifact is built from the same commit and the same gamekit version.
- Asset names are stable and machine-derivable: `<game-id>-<platform>.<ext>`.
- Every archive carries `SHA256SUMS`; every release carries an aggregate one.
- Unsigned binaries are stated honestly, not hidden.

## Prerequisites

Maintainers need Node.js ≥ 22, pnpm 10 and Bun ≥ 1.3 (Bun compiles the binaries).

```bash
node --version
pnpm --version
bun --version
```

## Local workflow

### Test one game

```bash
node scripts/test-game.mjs lobster-cli-heist
# equivalent to:
pnpm --filter @gameclaw/lobster-cli-heist check
pnpm --filter @gameclaw/lobster-cli-heist test
```

### Test everything

```bash
pnpm lint
pnpm check
pnpm test
```

### Build one game for the host platform

```bash
node scripts/build-game.mjs lobster-cli-heist
```

Outputs:

```
games/lobster-cli-heist/dist/
├── lobster-cli-heist
└── lobster-cli-heist-darwin-arm64.tar.gz
```

The build script runs `--version` on the produced binary when the target matches
the host, then packages the archive.

### Build for another platform

```bash
node scripts/build-game.mjs lobster-cli-heist --platform windows-x64
node scripts/build-game.mjs lobster-cli-heist --platform linux-arm64
```

Allowed platforms: `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`,
`windows-x64`. Cross-compilation is supported by Bun; the script skips the host
smoke run for foreign targets.

## Release matrix

The matrix is derived from `games/*/package.json` by
`scripts/release-matrix.mjs`, so onboarding a game does not require editing a
workflow.

| Platform | Runner | Build mode | Archive |
|---|---|---|---|
| `linux-x64` | `ubuntu-latest` | native | `.tar.gz` |
| `linux-arm64` | `ubuntu-latest` | cross | `.tar.gz` |
| `darwin-arm64` | `macos-14` | native | `.tar.gz` |
| `darwin-x64` | `macos-14` | cross | `.tar.gz` |
| `windows-x64` | `windows-latest` | native | `.zip` |

Five games × five platforms = 25 artifacts per release.

## Release process

1. Update `version` in every `games/<id>/package.json` you changed, and the
   matching `GAME_VERSION` constant in its `definition.ts`.
2. Update `CHANGELOG.md` (user-visible changes only).
3. Run the full local validation:

   ```bash
   pnpm lint && pnpm check && pnpm test
   node scripts/build-game.mjs <each changed game>
   ```

4. Commit, tag, push:

   ```bash
   git tag v2.0.0
   git push origin main --tags
   ```

5. `release.yml` fans out to the matrix, builds 25 artifacts, uploads them as
   workflow artifacts, writes `SHA256SUMS`, and publishes the GitHub Release.
6. Verify the release from a clean directory (see below).

## Verification checklist

After the workflow finishes:

```bash
mkdir -p /tmp/gc-verify && cd /tmp/gc-verify
gh release download v2.0.0 --repo Arcobalneo/gameclaw
sha256sum -c SHA256SUMS

tar -xzf lobster-cli-heist-darwin-arm64.tar.gz
./lobster-cli-heist-darwin-arm64/lobster-cli-heist --version

./lobster-cli-heist-darwin-arm64/lobster-cli-heist new \
  --seed 7 --state-dir /tmp/gc-verify/state --no-observer --no-report
./lobster-cli-heist-darwin-arm64/lobster-cli-heist actions \
  --state-dir /tmp/gc-verify/state --no-observer --no-report
```

For observer changes, also verify:

1. the page responds on the printed URL (`curl --noproxy '*'`)
2. the port is released when the run ends
3. `reports/latest.html` exists and opens offline

## Archive contents

Every archive extracts into a directory named `<game-id>-<platform>` containing:

- the binary (`<game-id>` or `<game-id>.exe`)
- `README.md`
- `LICENSE`
- `SHA256SUMS`

## Asset naming

```
<game-id>-<platform>.tar.gz   # darwin-*, linux-*
<game-id>-<platform>.zip      # windows-*
```

Example: `lobster-cli-tamer-linux-arm64.tar.gz`.

## Platform notes

- **macOS**: binaries are ad-hoc signed (`codesign --sign -`) at build time.
  Browser downloads may still carry a quarantine flag; `xattr -d
  com.apple.quarantine ./<game>` clears it.
- **Windows**: binaries are not Authenticode-signed, so SmartScreen may warn.
- **Linux**: glibc-based Bun binaries; no extra runtime packages required.

## Rollback

Releases are immutable in practice. If an artifact is broken:

1. Publish a patch tag (`v2.0.1`) with the fix.
2. Mark the broken release as "pre-release" or delete it if it never reached
   players.
3. Never silently replace an asset under the same tag.

## Truthful positioning

Binary distribution:

- makes downloads simple
- reduces casual source visibility in the player path

It does **not** guarantee anti-reversing or anti-tamper. Do not claim otherwise.
