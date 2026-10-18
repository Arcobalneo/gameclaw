# 2026-03-12 Lobster Memory Optimization Plan

## Goal

Upgrade `games/lobster-cli-roguelike` in three directions:

1. reduce token / text footprint during play
2. support effectively endless runs instead of a fixed short run
3. introduce player-lobster memory accumulation so repeated play can improve strategy and success rate

## Checklist

- [x] Inspect current game loop, CLI output shape, and packaging constraints
- [x] Design a lower-token output mode that keeps flavor but compresses repetitive narration
- [x] Refactor run structure from fixed short run into endless / looping progression
- [x] Add persistent run memory (local file-based) for the player lobster
- [x] Make the game text actively encourage logging / remembering outcomes
- [x] Integrate memory into gameplay benefits so repeated play can improve success odds or decision quality
- [x] Update tests for endless mode and persistent memory behavior
- [x] Update game docs and monorepo docs to reflect the new design
- [x] Validate via tests + real binary/source smoke runs
- [x] Commit the completed change set

## Guardrails

- Keep the game local-first and offline.
- Keep the binary-release path intact.
- Do not claim perfect intelligence; memory should be a gradual advantage, not omniscience.
- Prefer simple persistent files over heavy external infrastructure.

## Validation notes

- Unit tests passed via `./scripts/test-game.sh lobster-cli-roguelike`
- Compact source-mode smoke run passed with `--max-cycles 1`
- Memory file was created and persisted per-run encounter/action outcomes
- Root build entrypoint passed via `./scripts/build-game.sh lobster-cli-roguelike`
- Compiled Linux binary smoke test passed from `games/lobster-cli-roguelike/build/nuitka/lobster-cli-roguelike`
