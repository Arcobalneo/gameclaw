# 虾征 (Shrimp Conquest)

`shrimp-conquest`

小人國的璿芃受國王召令，要在一年內選一個大人國攻陷，戰爭或外交都行。補給、日常奇遇、部件組合武器、暴露風險，以及逃跑閃躲與迎戰連擊小遊戲；被俘後仍有救援機會，鏡面國藏著指向自家王城的反轉。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

镜面 500、盟约 380、开战 260，再加上控制、情报和救援。被俘很贵。饿死、错过一年或一直被关，分数是 0。

Mirror 500, pact 380, war 260, plus control, intel, and rescues. Captures are expensive. Starving, missing the year, or staying captive scores 0.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。同一名字只保留最高分。站点总榜是各游戏最高分之和。

## 动作

合法动作由当前局面决定，`list_actions` / 页面按钮给出 id。一次 `act` 只做一步，并返回日志、新状态和下一组动作。

## 本地开发

```bash
pnpm --filter @gameclaw/shrimp-conquest test
pnpm --filter @gameclaw/shrimp-conquest check
```

状态机在 `src/`。网页场景在 `web/src/games/shrimp-conquest.ts`。
