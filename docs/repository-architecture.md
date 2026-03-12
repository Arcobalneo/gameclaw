# Repository architecture

`gameclaw` is a monorepo with a clear split between **distribution logic** and **game implementation**.

## Layers

### 1. Skill / distribution layer

Files:
- `SKILL.md`
- `catalog/games.json`
- `README.md`

Purpose:
- expose player-facing game discovery
- map game ids to GitHub Releases assets
- give OpenClaw enough structure to answer install/download questions

### 2. Operations / maintainer layer

Files:
- `AGENTS.md`
- `docs/agent-coding-standards.md`
- `docs/release-flow.md`
- `docs/plans/`
- `scripts/build-game.sh`
- `scripts/test-game.sh`

Purpose:
- standardize how agents and maintainers make changes
- preserve traceability
- keep build/test/release entrypoints consistent across games

### 3. Game source layer

Files:
- `games/<game-id>/...`

Purpose:
- keep each game's code, tests, docs, and per-game packaging scripts together
- allow one game to evolve without forcing the same language/runtime on others

## Why monorepo instead of one repo per game?

Because the repo itself is part of the product:

- one skill distributes many games
- one catalog describes many games
- one release philosophy governs many games
- one agent workflow governs many games

Per-game repos would make the skill and release story more fragmented.

## Expected invariants

- Every shipped game has an entry in `catalog/games.json`
- Every shipped game lives in `games/<game-id>/`
- Every shipped game can be tested and built via root scripts
- Player-facing downloads should resolve to GitHub Releases binaries, not raw source checkout
