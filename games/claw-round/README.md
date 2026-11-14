# 虾循 (Claw Round)

`claw-round`

桥上五样东西都看得见。六拍之后潮退，位置回到桥头。只有入袋的东西留得下来。闸门公开要其中两样。装错一件就浪费这一潮。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

齐了是 460 − 多花的潮×30 − 错袋×60。没齐只按带对的件数×40。错袋比多花一潮更贵。

A full pocket is 460 − extra tides×30 − wrong pockets×60. A miss scores kept pieces×40. A wrong pocket costs more than an extra tide.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`step:e` 向前，`step:w` 退后。页面上 D 和 A 就是这两步。`grab` 拿起脚下的东西。`pocket` 入袋。`drop` 放回空格。拍数用完就潮退。

## 状态

`state.spots` 五格，`state.need` 闸门要的两样，`state.held` 手里，`state.pocket` 已入袋，`state.loop`、`state.beat`、`state.wrong`、`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-round test
pnpm --filter @gameclaw/claw-round check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-round.ts`。不要再添加 CLI 入口。
