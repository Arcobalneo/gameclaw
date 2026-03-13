# Release flow

This repo distributes games via **GitHub Releases**.

## Release philosophy

- Source stays in-repo and open for maintainers / contributors.
- Players should normally download compiled binaries from Releases.
- Maintainers use the root `uv` workspace (`pyproject.toml` + `uv.lock`) to manage Python test / build dependencies.
- Releases are built from the game source folders inside `games/`.

`uv` is a maintainer workflow detail. It does **not** change the player-facing product boundary: players should still primarily download release binaries instead of setting up Python environments.

## Maintainer prerequisites

- Install `uv` locally.
- Use the stable repo entrypoints under `scripts/` whenever possible.
- Keep each game's own packaging metadata in `games/<game-id>/pyproject.toml`.
- The root scripts currently pin `uv` to the official PyPI index so `uv.lock` stays portable across machines that have a different default mirror configured.

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

These root test commands now:

1. sync a locked environment from the repo-root `pyproject.toml` and `uv.lock`
2. install only the selected workspace package into the root `.venv`
3. run that game's tests from its own folder

If you intentionally want to stay inside a game directory, you can also run:

```bash
uv run --project ../.. --package <game-id> python -m unittest discover -s tests
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

These root build commands now:

1. sync a locked environment from the repo-root `pyproject.toml` and `uv.lock`
2. include the selected game's `build` extra
3. run the game's native build script inside that locked `uv` environment
4. output release archives under `games/<game-id>/dist/`

If you intentionally want to stay inside a game directory, you can also run:

```bash
uv run --project ../.. --package <game-id> --extra build ./scripts/build-native.sh
```

## GitHub Actions workflow

The root workflow lives at:

- `.github/workflows/release.yml`

Current supported / published release targets for shipped games:
- Linux x86_64
- macOS arm64

Current publicly available release assets confirmed in repo metadata:
- `lobster-cli-roguelike-linux-x86_64.tar.gz`
- `lobster-cli-roguelike-darwin-arm64.tar.gz`
- `lobster-cli-tower-defense-linux-x86_64.tar.gz`
- `lobster-cli-tower-defense-darwin-arm64.tar.gz`

Player-facing docs and workflow targets should stay aligned with the assets that are actually being shipped.

The workflow now:

1. checks out the monorepo
2. sets up Python
3. sets up `uv`
4. installs OS-level build dependencies when needed
5. builds the selected game through `./scripts/build-game.sh`
6. uploads `games/<game-id>/dist/*.tar.gz`
7. publishes those archives to GitHub Release assets on tagged builds

## Asset naming convention

Each game is responsible for producing stable asset names. The current naming sets in repo metadata are:

- `lobster-cli-roguelike-linux-x86_64.tar.gz`
- `lobster-cli-roguelike-darwin-arm64.tar.gz`
- `lobster-cli-tower-defense-linux-x86_64.tar.gz`
- `lobster-cli-tower-defense-darwin-arm64.tar.gz`

## Publishing model

Recommended release trigger:
- push a tag like `v0.1.0`

## Truthful positioning

Binary distribution in this repo is meant to:
- make player downloads simple
- reduce casual source visibility in the player path

It is **not** meant to claim perfect anti-reversing or anti-tamper guarantees.
