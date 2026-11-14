# 虾守 (Shrimp Guard)

`shrimp-guard`

三路线、六个部署位、三条 doctrine 的 pulse 制塔防。每 pulse 只做一个关键动作，随后自动结算推进、卡位与漏怪。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

击破×12 + 完整度×25 − 漏怪×40。零泄漏的胜利 +300，漏过仍守住 +80。一次泄漏比三只击破更贵。中止为 0。

Kills×12 + integrity×25 − leaks×40. A leak-free win adds 300; a win that leaked adds 80. One leak costs more than three kills. Abort is 0.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。同一名字只保留最高分。站点总榜是各游戏最高分之和。

## 动作

合法动作由当前局面决定，`list_actions` / 页面按钮给出 id。一次 `act` 只做一步，并返回日志、新状态和下一组动作。

## 本地开发

```bash
pnpm --filter @gameclaw/shrimp-guard test
pnpm --filter @gameclaw/shrimp-guard check
```

状态机在 `src/`。网页场景在 `web/src/games/shrimp-guard.ts`。不要再添加 CLI 入口。
