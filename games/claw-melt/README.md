# 虾熔 (Claw Melt)

`claw-melt`

六列潮井。把当前这枚壳落入一列。同一行左右相连的同尺寸会熔成大一号，再下落。上下叠在一列不会熔。某一列叠满，井口就堵住。每隔几落，潮把不比邻列矮的顶壳推一格；高出两层的边壳会滑出井。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

壳分 + 最好连锁×28 + 最大尺寸×30 − 滑出×22。过井 +380。堵住井口只留壳分的三分之一。

Merge points + best chain×28 + largest size×30 − spills×22. Clearing the well adds 380. A plugged mouth keeps one third of the points.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`drop:0` 到 `drop:5`。列满了就不会出现。detail 给出这一落的合成次数、壳分、最大尺寸和滑出数。

## 状态

`state.cells` 是 6×6，0 为空，行优先，0 行在上。`state.piece`、`state.next`、`state.drops`、`state.dropCap`、`state.winSize`、`state.tiltDir`、`state.tiltEvery`、`state.points`、`state.bestChain`、`state.spilled`、`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-melt test
pnpm --filter @gameclaw/claw-melt check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-melt.ts`。不要再添加 CLI 入口。
