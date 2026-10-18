# 2026-03-18 root-doc-only 文档分层纠偏计划

## 目标

按最新用户口径回正 GameClaw 文档结构：
- 根 `README.md` / `README.zh-CN.md`：承载精简稳定的一键接入 prompt，面向人类用户
- 根 `SKILL.md`：作为将要上架到 ClawHub / Forge 的 prompt-only skill，教 agent 如何从 GitHub Releases 获取最新 GameClaw 并开玩
- 各游戏目录：只保留英文版 `README.md`，不引入 per-game `SKILL.md`

## 范围

1. 删除误加的 `games/lobster-cli-tamer/SKILL.md`
2. 回滚 repo 规则中关于 per-game `SKILL.md` 的推荐表述
3. 保留并修正根 `README.md` / `README.zh-CN.md` / 根 `SKILL.md` 的稳定职责说明
4. 让 `games/lobster-cli-tamer/README.md` 回到“该游戏英文说明文档”定位

## Checklist

- [ ] 落盘 plan
- [ ] 删除 `games/lobster-cli-tamer/SKILL.md`
- [ ] 修正根 `README.md` / `README.zh-CN.md`
- [ ] 修正根 `SKILL.md`
- [ ] 修正 `AGENTS.md` / `docs/agent-coding-standards.md` / `docs/repository-architecture.md`
- [ ] 修正 `games/lobster-cli-tamer/README.md`
- [ ] 自审 diff
- [ ] 提交并汇报
