# Changelog

All notable changes to `gameclaw` will be documented in this file.

## 2026-06-02

### `lobster-cli-tamer` v0.2.4 — 主菜单用药

派大虾 v0.2.3 在 AI 友好模式实玩中又发现：potion_minor 在 items 数据里被发放 3 个，但主菜单里没有 UI 入口，AI 自动化 / 人类玩家都无法用，导致多次战斗后血线衰减后无法回血。

- **New: 主菜单选项 8=用药**
  - 消耗 1 个 potion_minor
  - 给队伍中所有活的 / 未满血 的虾米回 30% 最大 HP
  - 多个虾米同时回血
  - 队伍满血时也会显示“已满血”提示
  - potion 耗尽时提示"没有 potion_minor 了！"

- **New: `game.py` 新增 `_use_potion` 方法**

- **New: tests/test_potion_main_menu.py 加 3 个测试**
  - test_potion_heals_active_party: 1 只 20% HP → 50% HP
  - test_potion_heals_multiple_creatures: 3 只同时回
  - test_potion_fails_when_empty: potion 耗尽返回 False

- **Fix: tests/test_terminal_native_cli.py 主菜单 action 字符串**
  - 从 "...,7=存档,q=退出" 改为 "...,7=存档,8=用药,q=退出"

- 64 个测试全绿 (61 + 3 新)

### `lobster-cli-tamer` v0.2.3 — AI 友好模式 `--ai-easy`

派大虾 v0.2.2 在 AI 自动化实玩中遇到设计层问题：Lve5 礁虾打 Lv10 怪需要 14 回合，Lv10 一击秒 Lv5。AI 自动化无脑 1 攻击策略无法稳定推进。human 玩家可以通过走位/调换/词条策略玩。决定**不污染** normal mode balance，而是加 AI 友好模式 flag。

- **New: `--ai-easy` flag 启动选项**
  - 野外怪 Lv 锁 ≤ 队伍最高 Lv + 1
  - BOSS 怪 Lv 锁 ≤ 队伍最高 Lv + 5
  - 敌怪对我方伤害 ×0.5
  - normal mode 行为 100% 不变

- **New: GameOptions.ai_easy, BattleState.ai_easy, WorldSession.ai_easy, TowerSession.ai_easy**
  - 全部默认 False
  - 传递链: parse_options → Game → WorldSession/TowerSession → encounter/BattleState

- **New: tests/test_ai_easy.py 加 6 个测试**
  - 验证 GameOptions/BattleState/WorldSession/parse_options/encounter 的 ai_easy 行为

- 61 个测试全绿 (55 + 6 新)

#### Plan

- `docs/plans/2026-06-02-lobster-cli-tamer-ai-easy-mode.md`
- 关联: `docs/plans/2026-06-02-lobster-cli-tamer-ai-automation-limits.md`

### `lobster-cli-tamer` v0.2.2 — 没网也涨 pity

派大虾在 v0.2.1 二进制实玩中又发现: c 试捕 fast path 调 `_handle_capture` 内部 `consume_item`，如果没捕捉球了 `consume_item` 失败 early return，但 `consume_capture_tool_pity` 放在 `_handle_capture` 之后调也被跳过，导致玩家卡在“没 net + 战斗不赢 = pity 不涨 = 永不再补给”的状态。

- **Fix: world.py battle_turn 把 `consume_capture_tool_pity` 移到 `_handle_capture` 之前**
  - v0.2.1 把 `consume_capture_tool_pity` 放在 `_handle_capture` 之后，导致没网时 `_handle_capture` 早出跳过 pity 调。
  - v0.2.2 修复: 不管 `_handle_capture` 内部是否早出，都先调 `consume_capture_tool_pity(None)` 涨 pity。这样 c 1 试捕多次失败后能触发保底补给。

- **New: tests/test_battle_dead_cleanup.py 加 test_capture_no_net_still_increments_pity**
  - 覆盖 v0.2.2 的没网也涨 pity 逻辑。

### `lobster-cli-tamer` v0.2.1 — 保底补给贯穿主菜单

派大虾在 v0.2.0 二进制实玩中又发现: c 1 试捕失败路径不走 _roll_battle_loot也不调 consume_capture_tool_pity，导致 capture_tool_pity 不会涨。

- **Fix: world.py battle_turn c 试捕失败也调 consume_capture_tool_pity**
  - 之前 v0.2.0 在 c 试捕成功路径补 loot + cleanup，但失败路径也不调 pity 计算。
  - v0.2.1 修复: 试捕行动总是调 save.consume_capture_tool_pity(None)，让 c 1 试捕反复失败的 pity 递增能触发保底补给。

- **Fix: game.py _main_menu 每轮都调 _grant_emergency_net_if_needed**
  - 之前只在加载存档时补给一次。主菜单每轮调，能及时补给已涨 pity 后的玩家。

- **New: tests/test_battle_dead_cleanup.py 加 test_capture_consume_pity_涨_补_网**
  - 覆盖 v0.2.1 的 pity 涨 + 保底补给逻辑。

### `lobster-cli-tamer` v0.2.0 — 完整解锁核心 loop (野外死怪清埋 + BOSS 护盾衰减 + box 调换菜单 + BOSS 战 q 退 + 野外 loot + 保底补给)

完整修复了派大虾在 2026-06-01 两轮实测中触发的所有 P0/P1 死局，以及后续在 v0.1.9 实玩中又发现的 loot 路径 BUG 和保底补给逻辑 BUG。

#### v0.1.8

- combat.py take_damage 统一设 dead=True (HP<=0)
- world.py _on_battle_end 统一清埋 dead
- combat.py _tick_status_both 每回合 shield_hp *= 0.5
- game.py _main_menu 加 6 调换队伍
- game.py _swap_menu 新增方法
- save.py cleanup_dead_creatures helper
- game.py _abyss_loop BOSS 战 q 退到主菜单
- game.py _skill_choice_prompt 明确替换提示
- uv.lock 一致性 (PyPI 锁定)
- scripts/test-game.sh + build-game.sh 修 --locked 错位
- 新增 52 个测试

#### v0.1.9

- combat.py _apply_skill HP<=0 时统一设 dead=True (野外不依赖 is_tower)
- world.py battle_turn 每回合 cleanup_dead_creatures
- 加测试 test_battle_turn_中间就清埋_dead_creatures

#### v0.2.0 (这个版本)

- **Fix: world.py battle_turn 捕捉成功路径也走 loot + cleanup**
  - 派大虾用 v0.1.9 实玩时发现只 c 1 试捕不消耗回合的路径不走 _on_battle_end也不调 _roll_battle_loot,导致只打 5-6 场战斗后 0 补给,playable 仍受限。
  - 修复:在 _handle_capture 后检查 battle_engine 是否清空(抓成功 = 战斗结束),清空则走 cleanup + loot。

- **Fix: game.py _grant_emergency_net_if_needed 改为 pity-based 补给**
  - 旧逻辑要求 capture_total == 0 才补给,玩家如果刚开始有 5 个 net,全用完后永远不再补给,致永不能再抓怪。
  - 改用 capture_tool_pity >= 3 触发补给 + 重置 pity。

### `lobster-cli-tamer` v0.1.9 — battle_turn 立即清埋 + 野外 dead 标记 (完整修复)

- **Fix: combat.py _apply_skill 现在 HP<=0 时统一设 dead=True**
  - 旧实现: `if defender.hp_current <= 0 and st.is_tower: defender.dead = True`
  - v0.1.8 commit 有这行 `and st.is_tower` 检查，所以野外战斗中死掉的怪 dead=False。实际 GitHub release v0.1.8 仍未修野外路径。
  - v0.1.9 修复: 去掉 `and st.is_tower`，无论深渊/野外，HP<=0 时都设 dead=True。
  - 这是 v0.1.8 commit 注释里写了但实际代码没改完的最后一道。

- **Fix: world.py battle_turn 立即 cleanup_dead_creatures**
  - v0.1.8 commit 写了 world.py _on_battle_end 统一清埋，但战斗中自动换手时死掉的怪没机会走 _on_battle_end（战斗还在继续）。
  - v0.1.9 修复: 在 battle_turn 的 run_turn 之后、state.is over() 检查之前，先调 save.cleanup_dead_creatures(cause="野外战斗")，让战斗中死掉的怪立即被释放。
  - 表现: 野外战斗中抓新怪能在当前战斗中填入之前战斗中死亡的怪留下的空槽。

### `lobster-cli-tamer` v0.1.8 — Bug fix release (unlocks the core loop)

- **Fix: battle_turn 每回合后立即 cleanup_dead_creatures**
  - 派大虾🦞 在 2026-06-01 用 v0.1.8 二进制跑第二轮实测中触发了续问题：战斗中自动换手后死掉的怪 (dead=True HP=0) 仍然占着 save.party 槽位，因为 _on_battle_end 只在 state.is_over() 时才触发。
  - 修改 `world.py battle_turn`: 在 run_turn 之后、state.is_over() 检查之前，先调 save.cleanup_dead_creatures(cause="野外战斗")，让战斗中死掉的怪立即被释放。
  - 表现: 野外抓到新怪后能在当前战斗中填入之前战斗中死亡的怪留下的空槽，无需等到主菜单才被清理。

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
