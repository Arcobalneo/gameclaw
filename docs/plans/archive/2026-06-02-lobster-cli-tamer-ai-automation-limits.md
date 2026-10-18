# 派大虾 AI 自动化实玩边界 (2026-06-02)

## 背景

实玩 v0.2.2 二进制 (commit 3746050) 时,通过直接调 WorldSession API 跑自动化驱动 (`/tmp/tamer-run/auto-direct-v2.py`),试图推到解锁下一区域。

## 结论

**v0.2.2 核心 bug 全部修复**,野外抓怪 loop 正常工作。但 **AI 自动化玩游戏的边界** 在于 balance:

- Lv5 礁虾(HP 48, ATK 31)打 Lv10 rock_crab(HP 110, ATK 34)需要 14 回合
- Lv10 rock_crab 打 Lv5 礁虾 19 伤害/回合,2 回合秒
- 自动化无脑 1 攻击策略无法稳定抓 Lv6+ 怪

## 实测中验证的修复

1. **dead 标记在野外战斗设上**(v0.2.0) — 死怪不再占 party 槽位
2. **battle_turn 立即 cleanup_dead**(v0.1.9) — 战斗中间换手也正确
3. **试捕失败涨 pity**(v0.2.2) — 没网也累计,触发保底补给
4. **主菜单补给**(v0.2.1) — 涨了 pity 回主菜单立刻补给
5. **战利品击退掉**(v0.2.0) — 抓 1 怪后 net_basic 5→4→5 自动补给

## 实测的卡点

- 礁石表层怪 level_range 1-10,rock_crab Lv10 频率高
- 40% reef_shrimp 同伴 = 抓成功率高,但不是 100%
- 队伍只有 1 只 Lv5 礁虾时,前 5 次 step 大概率遇到 Lv6+ 怪 → 死 → 清埋 → 退
- 这导致队伍长时间只有 1 只

## 给人类玩家的建议

1. 先用 Lv5 礁虾反复 step 抓 reef_shrimp(40% 概率,同种),凑 3-4 只
2. 升到 Lv8+ 后,再挑战 rock_crab / poison_urchin
3. 主菜单用 "5 查看队伍详情" 看个体能力
4. 调换菜单(选项 6)在队伍满 6 时,把低等级退到 box
5. 词条工坊(选项 3)升级技能

## 给未来 AI 玩家的建议

- 不要试图直接 WorldSession.step() 无脑打怪
- 改用更细的策略:看到 enemy.level > party_max_lv + 1 就 RUN
- 或者修改 `data/zones.json` reef_surface 的 level_range 临时改成 [1, 5] 用于 AI 训练
- 或者加 `--ai-easy` flag,降低怪伤害 30%

## 关联文件

- 实测代码: `/tmp/tamer-run/auto-direct.py`, `auto-direct-v2.py`, `auto-v022-v7.sh`
- 实测日志: `/tmp/tamer-run/auto_direct_v2.log`
- v0.2.2 修复 commit: `3746050`
- 之前的修复 plan: `docs/plans/2026-06-02-lobster-cli-tamer-bugfix-and-unblock.md`

## 下一步

等用户决定:
- A. 手动玩推到解锁(AI 辅助修 bug)
- B. 改 balance(影响 release)
- C. 加 AI 友好模式(独立 flag)
- D. 修别的潜在 bug
