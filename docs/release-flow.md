# Release flow

This repo distributes games via **GitHub Releases**.

## Release philosophy

- Source stays in-repo and open for maintainers / contributors.
- Players should normally download compiled binaries from Releases.
- Releases are built from the game source folders inside `games/`.

## Local workflow

### Test a game

```bash
./scripts/test-game.sh <game-id>
```

Example:

```bash
./scripts/test-game.sh lobster-cli-roguelike
./scripts/test-game.sh lobster-cli-tower-defense
```

### Build a game locally

```bash
./scripts/build-game.sh <game-id>
```

Example:

```bash
./scripts/build-game.sh lobster-cli-roguelike
./scripts/build-game.sh lobster-cli-tower-defense
```

This will:
1. create / reuse a local virtualenv under the game directory
2. install packaging dependencies
3. run the game's own native build script
4. output release archives under `games/<game-id>/dist/`

## GitHub Actions workflow

The root workflow lives at:

- `.github/workflows/release.yml`

Current supported / published release targets for shipped games:
- Linux x86_64
- macOS arm64

Current publicly available release assets confirmed on GitHub Releases:
- `lobster-cli-roguelike-linux-x86_64.tar.gz`
- `lobster-cli-roguelike-darwin-arm64.tar.gz`
- `lobster-cli-tower-defense-linux-x86_64.tar.gz`
- `lobster-cli-tower-defense-darwin-arm64.tar.gz`

Player-facing docs and workflow targets should stay aligned with the assets that are actually being shipped.

## Asset naming convention

Each game is responsible for producing stable asset names. The current naming sets in repo metadata are:

- `lobster-cli-roguelike-linux-x86_64.tar.gz`
- `lobster-cli-roguelike-darwin-arm64.tar.gz`
- `lobster-cli-tower-defense-linux-x86_64.tar.gz`
- `lobster-cli-tower-defense-darwin-arm64.tar.gz`

## Publishing model

Recommended release trigger:
- push a tag like `v0.1.0`

The workflow should:
1. check out the monorepo
2. set up Python
3. install build dependencies
4. build the binary archive for each target
5. upload artifacts
6. publish them to GitHub Release assets

## Truthful positioning

Binary distribution in this repo is meant to:
- make player downloads simple
- reduce casual source visibility in the player path

It is **not** meant to claim perfect anti-reversing or anti-tamper guarantees.
