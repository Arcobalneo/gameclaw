# 派大虾 v0.2.3: AI 友好模式 (2026-06-02)

## 目标

让 AI agent / 自动脚本能稳定推到解锁下一区域,验证后续 bug 修复的端到端流程。
**不污染**正常人类玩家的 game balance。

## 方案:加 `--ai-easy` flag

启动游戏时加 `--ai-easy`,内部开启:

1. **野外怪等级锁**: `encounter()` 时,如果 `options.ai_easy`,怪 `level = min(rolled_level, party_max_lv + 1)` — 怪不会比队伍强 2 级以上
2. **BOSS 等级锁**: `tower.py generate_boss()` 时,如果 `options.ai_easy`,BOSS 等级锁 = 当前层数 + 队伍最高 Lv
3. **战斗伤害折扣**: `_apply_skill` 接收 `attacker_side` 时,如果 `options.ai_easy`,敌怪对我方伤害 ×0.5
4. **捕捉率加成**: `capture_attempt` 时如果 `ai_easy`,rate ×1.3

## 实施步骤

1. `GameOptions` 加 `ai_easy: bool = False`
2. `parse_options` 加 `--ai-easy` argparse
3. `encounter()` 函数传 `ai_easy: bool = False` 参数
4. `tower.py` 调 `encounter` 时传 ai_easy
5. `combat.py _apply_skill` 接收 `data.options.ai_easy` 上下文 — 用 self.data 拿不到 options;改用 state 传 `ai_easy: bool`
6. `BattleState` 加 `ai_easy: bool = False`
7. `capture.py capture_attempt` 加 ai_easy 参数
8. 写 test
9. 跑 auto-direct-v3.py 用 --ai-easy
10. 推到 deepest:10 击败 BOSS → 解锁新区域 → 报告

## 关键约束

- `normal mode` 行为 100% 不变(没有 --ai-easy flag 时)
- `tower_config.json` 不动
- `species/*.json` 不动
- 战斗数值公式不变,只在结果上 ×0.5

## 关联

- 实测发现文档: `docs/plans/2026-06-02-lobster-cli-tamer-ai-automation-limits.md`
- bug 修复 plan: `docs/plans/2026-06-02-lobster-cli-tamer-bugfix-and-unblock.md`
- v0.2.2 修复 commit: `3746050`
