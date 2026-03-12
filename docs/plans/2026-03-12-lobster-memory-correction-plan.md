# 2026-03-12 Lobster Memory Correction Plan

## Goal

Correct the memory design of `games/lobster-cli-roguelike` so it matches the intended model:

- the game itself should **not** implement its own persistent外挂 memory system
- instead, the game text should actively encourage the playing OpenClaw / player-lobster to write useful strategy notes into **their own memory system**
- endless play and token-saving output should remain intact

## Checklist

- [x] Inspect the current in-game local memory implementation and all docs/tests that mention it
- [x] Remove file-based persistent memory logic and related CLI flags
- [x] Keep compact mode and endless-cycle structure
- [x] Add textual prompts during encounters / cycle transitions / settlement that encourage strategy note-taking into the player's own memory
- [x] Make win/lose settlement explicitly suggest what kind of strategy should be remembered
- [x] Update tests to reflect the corrected design
- [x] Update game docs and repo docs to remove the wrong memory framing
- [x] Validate via tests + source smoke run + binary smoke run
- [ ] Commit the corrected change set

## Guardrails

- Do not reintroduce a game-owned memory file.
- The game may hint, suggest, and encourage reflection, but the external memory system belongs to the player / OpenClaw runtime.
- Keep the release flow untouched.

## Validation notes

- Fixed the broken multiline string regressions in `lobster_cli_roguelike/game.py` that were blocking import / execution.
- Test suite passed via `./scripts/test-game.sh lobster-cli-roguelike`.
- Real source playthrough passed via `python3 main.py --quick-start --seed 7 --lineage 2 --script 1,1,1,1,1,1,1,1,1,1,1,1,1 --max-cycles 1`.
- Real compiled-binary playthrough passed via `./build/nuitka/lobster-cli-roguelike --quick-start --seed 7 --lineage 2 --script 1,1,1,1,1,1,1,1,1,1,1,1,1 --max-cycles 1`.
- Rebuilt release artifact successfully via `./scripts/build-game.sh lobster-cli-roguelike` and confirmed archive contents under `dist/lobster-cli-roguelike-linux-x86_64.tar.gz`.
