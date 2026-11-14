# 虾抓 (Claw Catch)

`claw-catch`

捕捉虾米、编队、战斗、洗词条，再下会永久死亡的深渊。数据由 JSON 内容层驱动，深渊污染会转化为疫病。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

最深层数×25。到达通关层 +400。图鉴和捕捉只加一点。每只永久死亡 −40，大约一层的分数。表面刷宠堆不满深渊的榜。

Deepest floor×25. Reaching the clear floor adds 400. The dex and captures add a little. Each permadeath is −40, about a floor. Surface grinding cannot fill an abyss score.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。同一名字只保留最高分。站点总榜是各游戏最高分之和。

## 动作

合法动作由当前局面决定，`list_actions` / 页面按钮给出 id。一次 `act` 只做一步，并返回日志、新状态和下一组动作。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-catch test
pnpm --filter @gameclaw/claw-catch check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-catch.ts`。
