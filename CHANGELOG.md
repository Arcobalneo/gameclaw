# Changelog

All notable changes to `gameclaw` will be documented in this file.

## 2026-06-02

### `lobster-cli-tamer` v0.1.8 — Bug fix release (unlocks the core loop)

- **Fix: 野外战斗死亡的虾米永远不清埋 (P0)**
  - `combat.py take_damage` 现在统一在 HP<=0 时把 `dead=True`，不再仅在 `is_tower=True` (深渊) 时设。
  - `world.py _on_battle_end` 新增统一的 `_cleanup_dead_creatures` 流程：胜利 / 全灭都会把死掉的虾米入纪念碑并释放 party 槽位。
  - 现象：玩家抓到 5 只新怪却装不进 6 槽，因为前 5 只在野外战斗死掉后仍占着 party 槽位不释放。修复后野外死了会自动清理，玩家可以正常补抓与推进。
  - Plan: `docs/plans/2026-06-02-lobster-cli-tamer-bugfix-and-unblock.md`

- **Fix: 珊瑚帝王蟹 BOSS “珊瑚壁垒” 护盾无上限累积 (P0)**
  - `combat.py _tick_status_both` 现在每回合把 `shield_hp *= 0.5` 衰减 (下限 0)，避免护盾类技能每回合叠加后普通攻击永远破不了。
  - 现象：BOSS 战护盾堆到 2463 都不衰减，与玩家战斗死循环。修复后护盾几回合后趋近稳定点，能被普通攻击逐步打破。

- **New: box 调换菜单 (P1)**
  - 主菜单多了一个选项 `6 调换队伍 (与仓库互换)`，可以从 party 选一只退到 box，也可以从 box 选一只调入 party。
  - 现象：原来主力全死后 box 里的 43 只怪取不出，玩家永远不能继续。修复后玩家能主动重组队伍。
  - 实现：`game.py _swap_menu` 新增方法；`save.py cleanup_dead_creatures` 复用了同一个 helper。

- **Fix: BOSS 战中 q 退到主菜单 (P1)**
  - `game.py _abyss_loop` 战斗菜单 BATTLE_MENU 多了一个选项 `q 放弃本局深渊 (结算疫病骰后退出)`，避免 BOSS 战死循环下只能 `tmux kill` 强退。
  - 代价：会走 `tower._settle_plague()` + `total_abyss_runs++`，与正常退深渊一致。

- **New: 主菜单存档时清理 dead 状态 (P1)**
  - `7 存档` 选项现在在写盘前会调 `save.cleanup_dead_creatures(cause="存档清理")`，防止各种边界场景下“死了但未清理”状态累积。

- **Improvement: SKILL_CHOICE 替换提示更明确 (P1)**
  - 当 `len(creature.moves) >= 4` 时，技能候选打印前先 `warn("⚠ 当前技能已满 4 个。选 1-3 后会被询问「替换第几个技能 1-4」。")`，提醒 agent / 玩家记得后续还要发替换序号。

- **Test infra: pytest 接入 + `test-game.sh` 修 bug (P2)**
  - `games/lobster-cli-tamer/pyproject.toml` 新增 `test` extra（`pytest>=8.0`）。
  - `scripts/test-game.sh` 修复两处 bug：
    - `ROOT_DIR` 推导少了 `/..`（曾把 game id 解析到 `scripts/games/...`）。
    - 原用 `unittest discover` 找不到 pytest 装饰器 + 裸函数，现在改为 `python -m pytest tests -v`。
  - `scripts/test-game.sh` 现在装 `--extra test`。
  - 新增测试 3 个：
    - `tests/test_battle_dead_cleanup.py` (4 个用例)
    - `tests/test_shield_decay.py` (3 个用例)
    - `tests/test_swap_menu.py` (3 个用例)
  - 所有 51 个测试全绿。

- **Verified end-to-end**: 派大虾🦞 在 2026-06-01 的两轮真实游玩中触发的所有死局都已被本次 v0.1.8 修复解开，下一步是用新版本真实推进到“解锁深流峡谷”再回头补发补丁。

## 2026-03-13

### New game: `lobster-cli-heist`
- Added `games/lobster-cli-heist/` as a full new game source tree with packaging, tests, live observer server, per-game catalog metadata, and distribution docs
- Shipped a playable stealth-heist vertical slice: compact 2x7 side-strip facilities, `facility / security / objective / complication` mission grammar, three profiles, and real extraction pressure after the pickup
- Added `--seed`, `--quick-start`, `--profile`, `--script`, `--verbose-text`, `--no-settlement-report`, default localhost observer boot, honest aborted-run handling, and HTML settlement reports

### Catalog / release distribution follow-up
- Added `lobster-cli-heist` to `catalog/games.json`, `SKILL.md`, `README.md`, and `README.zh-CN.md`
- Expanded the root GitHub release workflow matrix so GameClaw now builds and ships all three lobster games on Linux x86_64 and macOS arm64
- Updated release-flow docs and the root `uv` workspace metadata so the new game follows the same monorepo build / test / release entrypoints

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
