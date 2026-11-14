# 虾拨 (Claw Flip)

`claw-flip`

一条八格的桥。拨动一次，所有板变成空，所有空变成板。石头永远不可走。簧很少，用来跳过石头。迈上不可走的格子会受伤并停住。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

走完的段×100 + 剩余簧×20 − 伤×80 − 拨动×6。全部走完 +320。一次受伤比一段里的拨动更贵。

Stages×100 + springs left×20 − wounds×80 − flips×6. Clearing every stage adds 320. One wound costs more than a stage of flips.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`flip` 拨动开关。`step` 迈一格。`hop` 花 1 簧跳过下一格，落点必须可走。

## 状态

`state.tiles` 是 `plate`、`gap` 或 `stone`。`state.flipped`、`state.pos`、`state.springs`、`state.flips`、`state.wounds`、`state.stage`、`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-flip test
pnpm --filter @gameclaw/claw-flip check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-flip.ts`。不要再添加 CLI 入口。
