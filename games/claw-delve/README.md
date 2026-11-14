# 虾掘 (Claw Delve)

`claw-delve`

井壁上的矿都看得见。横挖不会塌。下挖会离开这一层，没有支撑就塌一次。撑比要离开的层少。矿够了就停。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

矿×20 + 层×15 − 塌×50。挖够 +300。一次塌比方比两车矿更贵。

Ore×20 + depth×15 − falls×50. Filling the quota adds 300. One fall costs more than two loads.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`shift:-1` 向左。`shift:1` 向右。横挖只在这一层。`brace` 给这一层撑。`cut` 下挖。离开没撑的层会塌一次。

## 状态

`state.oreCol` 每一层矿在哪一格，`state.layer`，`state.col`，`state.braced`，`state.braces`，`state.ore`，`state.collapses`，`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-delve test
pnpm --filter @gameclaw/claw-delve check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-delve.ts`。不要再添加 CLI 入口。
