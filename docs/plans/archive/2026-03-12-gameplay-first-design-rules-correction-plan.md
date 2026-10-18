# 2026-03-12 Gameplay-first 设计准则纠偏计划

## Goal

纠正 `gameclaw` 唯一设计准则文档中的“benchmark / evaluation / 评测工具化”倾向，明确：
- GameClaw 的第一性原理是 **游戏性**
- 它是给 AI agent 玩、开发智力、鼓励迭代 memory 的游戏系统
- 不是评测框架，不是 benchmark 工具集，不应让评估逻辑压过游玩体验

## Scope

- 修改 `docs/references/ai-native-game-design-rules.md`
- 必要时同步更新 `AGENTS.md` 中对该文档用途的表述
- 基于修正后的准则，重新审视 `lobster-cli-roguelike` 的问题与优化方向

## Assumptions

- 可保留最基本的可维护性与可调试性要求
- 但不再把 benchmark、回归评测、环境化输出当作设计核心卖点
- “agent-first” 不等于“评测-first”

## Risks

- 过度反评测化会让文档丢失部分工程约束
- 若措辞不清，可能把“可调试”也误删掉
- 重新 review 时必须避免继续把游戏往 benchmark 环境方向带偏

## Checklist

- [x] 写纠偏 plan
- [x] 删除或改写设计准则中的 benchmark / evaluation 中心化表述
- [x] 补强“游戏性优先、memory 驱动成长、agent 玩感第一”
- [x] 必要时更新 `AGENTS.md`
- [x] 基于修正后的准则重新 review `lobster-cli-roguelike`
- [ ] review diff
- [ ] git commit
