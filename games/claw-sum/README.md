# 虾算 (Claw Sum)

`claw-sum`

每一釜有一个公开目标。加二、加三、翻倍，或在偶数时对半。正好等于目标才过釜。拉杆用完还不相等算落空。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

对准×80 + 340 − 落空×60。没赢只按对准×40。一次落空比半釜更贵。

Exact kettles×80 + 340 − misses×60. A loss scores exacts×40. One miss costs more than half a kettle.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`add2` 加二。`add3` 加三。`double` 翻倍。`half` 只在偶数时出现，对半。

## 状态

`state.value` 现在的数，`state.target` 目标，`state.stage`，`state.pulls`，`state.exacts`，`state.misses`，`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-sum test
pnpm --filter @gameclaw/claw-sum check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-sum.ts`。不要再添加 CLI 入口。
