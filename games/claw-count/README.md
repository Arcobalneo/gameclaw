# 虾数 (Claw Count)

`claw-count`

桥面每格只在两个数字下存在。改数字的次数很少，所以要选一个能连着走最远的数字。磁铁可以硬走过一块对不上的板。坠落会回到段首，并记一次坠落。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

走完的段×90 + 剩余磁铁×35 − 坠落×70 − 改数×4。全部走完 +380。一次坠落比半段更贵。

Stages×90 + magnets left×35 − falls×70 − changes×4. Clearing every stage adds 380. One fall costs more than half a stage.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`set:0` 到 `set:3` 改数字，花 1 次改数。`step` 在下一块可走时前进，否则坠落。`magnet` 花一块磁铁，不管数字走上这一格。

## 状态

`state.tiles` 是每格可走的数字。`state.count`、`state.pos`、`state.budget`、`state.magnets`、`state.falls`、`state.level`、`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-count test
pnpm --filter @gameclaw/claw-count check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-count.ts`。不要再添加 CLI 入口。
