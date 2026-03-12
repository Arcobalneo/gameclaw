# Binary distribution plan

This game folder lives inside the `gameclaw` monorepo.

It serves two audiences:

1. **Developers / maintainers** work with the source tree under `games/lobster-cli-roguelike/`.
2. **Players** download native CLI builds from the **GameClaw GitHub Releases** page.

## Goals

- Keep the source open inside the monorepo.
- Ship player-facing builds as normal native binaries for Linux and macOS.
- Reduce casual source inspection in the player release channel.
- Keep the game easy to reference from the root `gameclaw` skill and catalog.
- Preserve local persistent memory so the same lobster can improve over many runs.

## Runtime design notes

Current gameplay-oriented release assumptions:

- default output is **compact / token-saving**
- runs are **effectively endless** unless the player dies or a test cap is provided
- local file-based shell-memory persists across runs and can influence future success

This means the binary is not just a one-shot toy; it carries forward a local learning loop.

## Build strategy

- Use **Nuitka** to compile the Python game into a native executable.
- Keep the game-specific native build logic in `scripts/build-native.sh`.
- Trigger shared release automation from the monorepo root workflow.
- Publish `.tar.gz` archives to the root GitHub Releases page of the `gameclaw` repo.

## Local validation status

Validated locally on Linux on 2026-03-12:

- build dependency path: local virtualenv + `patchelf`
- compiler path: Nuitka onefile build
- resulting Linux binary: `build/nuitka/lobster-cli-roguelike`
- resulting archive: `dist/lobster-cli-roguelike-linux-x86_64.tar.gz`
- smoke test: passed via the compiled binary with scripted input

This confirms the release flow works locally for Linux x86_64 before GitHub release automation is used.

## Anti-cheat / source visibility posture

This project does **not** promise strong anti-tamper guarantees.

What it does do:
- avoids shipping plain `.py` source files in the default player download path
- hides exact roll/difficulty output unless `--debug-rolls` is enabled
- uses native binary packaging to raise the inspection bar for casual players

What it does **not** do:
- guarantee resistance to reverse engineering
- prevent modified binaries or memory inspection
- replace a server-authoritative architecture

## GameClaw-facing metadata

The root monorepo catalog is:

- `catalog/games.json`

The per-game source lives at:

- `games/lobster-cli-roguelike/`

Together they let the `gameclaw` skill tell players:
- which games exist
- what this game is
- where the latest GitHub release lives
- how to download and run the appropriate binary for macOS / Linux
- that the same local lobster can retain shell-memory across runs
