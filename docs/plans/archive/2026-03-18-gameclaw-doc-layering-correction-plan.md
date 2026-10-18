# 2026-03-18 GameClaw 文档分层纠偏计划

## 目标

修正 GameClaw 文档层级混淆问题：
- 根 README 的 prompt 应保持稳定，面向人类用户，教人类如何 prompt 自己的 agent 去获取 / 使用 GameClaw skill 与游戏
- 根 `SKILL.md` 应保持为 prompt-only distribution skill，承载稳定的分发目录与启动入口，而不是频繁吸收单个游戏玩法细节
- 具体游戏介绍、玩法重点、agent 操作提示应沉淀到对应游戏自己的 `SKILL.md`

## 范围

1. 检查并修正根 `README.md` / `README.zh-CN.md` 的稳定入口职责
2. 检查并修正根 `SKILL.md` 的游戏目录是否与当前 shipped games 一致
3. 为 `games/lobster-cli-tamer/` 增加 per-game `SKILL.md`，承接具体玩法 / observer / 结算页 / agent 注意事项
4. 在仓库规则文档中补一条明确的“文档分层”规则，避免后续再次混层

## 不在本次范围

- 不重写所有历史游戏的 per-game `SKILL.md`
- 不重做 release notes / tag
- 不改 catalog schema

## 风险

- 根 README / 根 `SKILL.md` / per-game `SKILL.md` 三层职责若措辞不清，容易再次重叠
- 需避免把 gameplay 细节重新塞回根 README 的稳定 prompt

## Checklist

- [ ] 补 plan 文件
- [ ] 审查根 README / 中文 README / 根 `SKILL.md` / `catalog/games.json` / `lobster-cli-tamer/README.md`
- [ ] 在根 README / 中文 README 中把 `lobster-cli-tamer` 正式接入稳定入口目录
- [ ] 在根 `SKILL.md` 中把 `lobster-cli-tamer` 正式接入分发 skill 目录
- [ ] 新增 `games/lobster-cli-tamer/SKILL.md`
- [ ] 在 repo 规则文档中补充文档分层规则
- [ ] 自审 diff，确认三层职责清楚
- [ ] 汇报结果
