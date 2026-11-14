# 虾罩 (Claw Mask)

`claw-mask`

同一条廊有墨层和潮层。面罩盖住的三格看墨层，其余看潮层。迈上当前可见、而且可走的那一层。有的格子必须露在罩外。前面的廊各有两格反过来，最后一廊是三格。每两个动作，潮往前一格。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

走完的廊×90 − 滑移×4 − 坠落×75。全部走完 +360。一次坠落比很多次滑动更贵。

Halls×90 − slides×4 − falls×75. Clearing every hall adds 360. One fall costs more than many slides.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`step` 迈一步。`mask:+1` 和 `mask:-1` 移动面罩。detail 写明下一格现在可走还是空。

## 状态

`state.ink` 和 `state.tide` 各八格，值为 `walk` 或 `gap`。`state.mask` 是面罩左端。`state.pos`、`state.flood`、`state.falls`、`state.corridor`、`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-mask test
pnpm --filter @gameclaw/claw-mask check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-mask.ts`。不要再添加 CLI 入口。
