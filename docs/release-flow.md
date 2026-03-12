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
```

### Build a game locally

```bash
./scripts/build-game.sh <game-id>
```

Example:

```bash
./scripts/build-game.sh lobster-cli-roguelike
```

This will:
1. create / reuse a local virtualenv under the game directory
2. install packaging dependencies
3. run the game's own native build script
4. output release archives under `games/<game-id>/dist/`

## GitHub Actions workflow

The root workflow lives at:

- `.github/workflows/release.yml`

Current release targets for the first game:
- Linux x86_64
- macOS x86_64
- macOS arm64

## Asset naming convention

Each game is responsible for producing stable asset names. For `lobster-cli-roguelike`, the current convention is:

- `lobster-cli-roguelike-linux-x86_64.tar.gz`
- `lobster-cli-roguelike-darwin-x86_64.tar.gz`
- `lobster-cli-roguelike-darwin-arm64.tar.gz`

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
