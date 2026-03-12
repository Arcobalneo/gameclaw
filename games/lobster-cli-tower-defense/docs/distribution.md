# Binary distribution plan

This game folder lives inside the `gameclaw` monorepo.

It serves two audiences:

1. **Developers / maintainers** work with the source tree under `games/lobster-cli-tower-defense/`.
2. **Players** download native CLI builds from the **GameClaw GitHub Releases** page.

## Goals

- Keep the source open inside the monorepo.
- Ship player-facing builds as normal native binaries for Linux and macOS.
- Reduce casual source inspection in the player release channel.
- Keep the game easy to reference from the root `gameclaw` skill and catalog.
- Preserve the design where the game nudges the player / OpenClaw to write strategy into their own memory system.

## Runtime design notes

Current gameplay-oriented release assumptions:

- default output is **compact / token-saving**
- combat is **pulse-based**, not real-time
- the game itself does **not** own a persistent外挂 memory database
- instead, it actively encourages the player / agent to write strategy into their own memory system
- after each run, it can generate a local HTML settlement page that the player-agent can send to its human owner for review

## Build strategy

- Use **Nuitka** to compile the Python game into a native executable.
- Keep the game-specific native build logic in `scripts/build-native.sh`.
- Trigger shared release automation from the monorepo root workflow.
- Publish `.tar.gz` archives to the root GitHub Releases page of the `gameclaw` repo.

## Local validation status

Validated locally on Linux on 2026-03-13:

- source test suite: `python3 -m unittest discover -s tests`
- monorepo test entry: `./scripts/test-game.sh lobster-cli-tower-defense`
- resulting Linux archive target: `dist/lobster-cli-tower-defense-linux-x86_64.tar.gz`
- smoke test target: compiled binary with scripted input

This confirms the Linux side of the release flow before GitHub Actions builds the full release matrix.

## Anti-cheat / source visibility posture

This project does **not** promise strong anti-tamper guarantees.

What it does do:

- avoids shipping plain `.py` source files in the default player download path
- uses native binary packaging to raise the inspection bar for casual players
- keeps release assets aligned with the monorepo catalog and player-facing docs

What it does **not** do:

- guarantee resistance to reverse engineering
- prevent modified binaries or memory inspection
- replace a server-authoritative architecture

## GameClaw-facing metadata

The root monorepo catalog is:

- `catalog/games.json`

The per-game source lives at:

- `games/lobster-cli-tower-defense/`

Together they let the `gameclaw` skill tell players:

- which games exist
- what this game is
- where the latest GitHub release lives
- how to download and run the appropriate binary for macOS / Linux
- that the game will encourage them to record useful strategy into their own memory system
