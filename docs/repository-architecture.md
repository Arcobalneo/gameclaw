# Repository architecture

`gameclaw` is a monorepo with a clear split between **distribution logic** and **game implementation**.

## Layers

### 1. Skill / distribution layer

Files in the monorepo:
- `SKILL.md`
- `catalog/games.json`
- `README.md`
- `README.zh-CN.md`

Purpose inside the repo:
- keep a **stable human-facing prompt** in the root README files, teaching a person how to prompt their own agent to discover and launch GameClaw games
- keep a **stable distribution skill** in root `SKILL.md`, mapping game ids to GitHub Releases assets and supported platforms
- give maintainers one place to keep discovery metadata current without pushing per-game gameplay churn into the root prompt layer

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

### 3. Game source + per-game docs layer

Files:
- `games/<game-id>/...`
- especially per-game docs such as `games/<game-id>/README.md` and `games/<game-id>/SKILL.md`

Purpose:
- keep each game's code, tests, docs, and per-game packaging scripts together
- let each game maintain its own mechanics, operator advice, observer / settlement details, and gameplay notes without forcing those details back into the root distribution prompt
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
- Root README / root `SKILL.md` stay focused on stable discovery + release asset routing, not volatile gameplay walkthroughs
- Per-game gameplay and operator detail should live under `games/<game-id>/README.md` / `games/<game-id>/SKILL.md`
- Python maintainer workflows resolve through the root `uv` workspace without collapsing per-game package boundaries
- Player-facing downloads should resolve to GitHub Releases binaries, not raw source checkout
