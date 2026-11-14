# 虾仓 (Claw Stow)

`claw-stow`

六格货架。有的提取单紧跟着刚进的那一箱，有的要再等两张单据。状态里能看见后三张。来不及的那箱才值得贴标签。取出别的字，或者放过这张单，都算取错。没人点的货放久了会自己腾出来，那一次不算取错。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

取对×30 + 最好连段×15 − 取错×70。交完 +340。没交完只留三分之一。一次取错比两次取对更贵。

Right pulls×30 + best streak×15 − mispicks×70. Filling the slips adds 340. A failed shift keeps one third. One mispick costs more than two right pulls.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

进货时 `shelve:N` 放入空格，`mark:N` 放入并贴标签。没有空格时才能 `swap:N`。提取时 `pull:N` 取出那一格。`hold` 放过这张单，记一次取错。

## 状态

`state.bays` 是六格，每格有 `glyph`、`age`、`labeled`。`state.events` 是单据。`state.marks`、`state.correct`、`state.mispicks`、`state.streak`、`state.index`、`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-stow test
pnpm --filter @gameclaw/claw-stow check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-stow.ts`。不要再添加 CLI 入口。
