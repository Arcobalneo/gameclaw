# Changelog

All notable changes to `gameclaw` will be documented in this file.

## 2026-03-13

### New game: `lobster-cli-tower-defense`
- Added `games/lobster-cli-tower-defense/` as a full new game source tree with packaging, tests, per-game catalog metadata, and distribution docs
- Shipped a playable single-stage vertical slice: pulse-based CLI tower defense, one map, three doctrines, six deployables, five enemy types, deployment / recall windows, and honest leak-based settlement
- Added compact lane render, scripted input support, `--quick-start`, `--seed`, `--doctrine` / `--lineage`, `--verbose-text`, and `--no-settlement-report`
- Added memory-first settlement output plus HTML settlement reports for won / lost / aborted endings

### `lobster-cli-tower-defense` follow-up iteration
- Refactored the tower-defense slice into clearer layers: `stages.py` for stage data, `simulation.py` for rule resolution, and a slimmer `game.py` focused on CLI flow
- Added doctrine-specific simulation coverage plus scripted regression baselines for `oracle`, `crusher`, and `gambler`
- Adjusted support-platform coverage so `LP` / `RP` behave more like side-watch positions instead of trivially seeing through the entire middle front slot
- Verified the follow-up through repo-level tests, targeted scripted smoke, and real playtests before release

### Catalog / release distribution
- Added `lobster-cli-tower-defense` to `catalog/games.json`, `SKILL.md`, `README.md`, and `README.zh-CN.md`
- Expanded the root GitHub release workflow matrix so GameClaw now builds and ships both lobster games on Linux x86_64 and macOS arm64
- Updated release-flow docs to keep asset names, build entrypoints, and player-facing instructions aligned with the actual repo contents

### Repository / design docs
- Replaced the old GDC reference track with a single canonical design authority document: `docs/references/ai-native-game-design-rules.md`
- Corrected the design canon toward **gameplay-first / memory-first / agent-first**, explicitly removing benchmark-first framing
- Updated `AGENTS.md` so future game design work must read the single design-rules document first
- Added local Forge feedback log at `docs/forge-feedback-log.md` to preserve user comments and recurring product signals

### `lobster-cli-roguelike` gameplay improvements
- Rebalanced key encounters including `拖网阴影`, `电鳗裂隙`, `塑料垃圾流`, and `归海闸口`
- Strengthened lineage/build identity while reducing over-generic oracle play
- Changed memory prompts from fake certainty (`更稳/容易翻车`) to honest run-scoped observations (`本局观察 / 下局再验证`)
- Added build observations to mutation flow and settlement prompts
- Improved failure and settlement copy so runs are easier to review and learn from

### Repetition / pacing follow-up
- Added lightweight `潮势` to create more carry-over rhythm between reading-the-water actions and harder follow-up actions
- Added recent-encounter suppression so runs are less likely to hit the same encounter back-to-back in the mid/late phase
- Added mid-phase / late-phase prompts to make a single cycle feel less like repeated button drills

### Scripted-play / QA improvements
- Replaced scripted-input `EOFError` crashes with an explicit **aborted settlement** path
- Settlement output now supports `won / lost / aborted` endings
- Updated tests and CLI/README documentation to match the new gameplay and abort behavior

### Repo hygiene
- Added ignore rules for generated `settlement_reports/` artifacts so review/playtest output stays out of commits by default
