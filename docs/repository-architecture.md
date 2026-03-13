# Repository architecture

`gameclaw` is a monorepo with a clear split between **distribution logic** and **game implementation**.

## Layers

### 1. Skill / distribution layer

Files in the monorepo:
- `SKILL.md`
- `catalog/games.json`
- `README.md`

Purpose inside the repo:
- define the canonical player-facing discovery prompt
- map game ids to GitHub Releases assets
- give maintainers one place to keep discovery metadata current

Important packaging boundary:
- the **Forge-published `gameclaw` skill should contain only `SKILL.md`**
- `catalog/games.json` remains canonical repo metadata, but should not be assumed to exist in registry-installed copies of the skill
- therefore `SKILL.md` must stay self-contained enough to work on its own

### 2. Operations / maintainer layer

Files:
- `AGENTS.md`
- `docs/agent-coding-standards.md`
- `docs/release-flow.md`
- `docs/plans/`
- `pyproject.toml`
- `uv.lock`
- `scripts/build-game.sh`
- `scripts/test-game.sh`

Purpose:
- standardize how agents and maintainers make changes
- preserve traceability
- keep build/test/release entrypoints consistent across games
- lock Python maintainer dependencies at the repo root via the `uv` workspace

### 3. Game source layer

Files:
- `games/<game-id>/...`

Purpose:
- keep each game's code, tests, docs, and per-game packaging scripts together
- allow one game to evolve without forcing the same language/runtime on others

## Python dependency boundary

For Python-based games in this repo:

- the repo root owns workspace locking and maintainer environment sync through `pyproject.toml` and `uv.lock`
- each game keeps its own `pyproject.toml` for package metadata, entrypoints, and game-specific extras
- root scripts should execute one selected game at a time instead of flattening the whole monorepo into one package

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
- Python maintainer workflows resolve through the root `uv` workspace without collapsing per-game package boundaries
- Player-facing downloads should resolve to GitHub Releases binaries, not raw source checkout
