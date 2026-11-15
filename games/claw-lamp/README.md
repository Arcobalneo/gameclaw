# 虾灯 (Claw Lamp)

`claw-lamp`

黑浅滩上的柱子照亮水洼。不同的种子从不同的一段开始。两根能看见彼此的柱不能同时立着灯笼。照得最广的那根常常挡住真正能封滩的柱。潮水只够很少几次挪动，立错了再收回来比省下灯笼更贵。第三滩起少一次潮。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

封上的段×100 + 省下灯笼×8 − 挪灯×18。全部封上 +360。没封完只留三分之一。一次挪灯比两只省下的灯笼更贵。

Stages×100 + lamps saved×8 − lifts×18. Sealing every stage adds 360. A failed night keeps one third. One lift costs more than two saved lamps.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`place:N` 把灯笼立上第 N 根柱，花 1 潮。`lift:N` 收起来，也花 1 潮，并记一次挪灯。detail 写明新照亮几个水洼，以及挡住哪几根柱。水洼都亮了才能 `seal`。

## 状态

`state.posts` 是柱，含 `covers`、`sees`、`x`、`y`。`state.placed`、`state.stock`、`state.tide`、`state.lifts`、`state.saved`、`state.stage`、`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-lamp test
pnpm --filter @gameclaw/claw-lamp check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-lamp.ts`。不要再添加 CLI 入口。
