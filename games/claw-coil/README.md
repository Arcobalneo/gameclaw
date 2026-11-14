# 虾绕 (Claw Coil)

`claw-coil`

头走一格，尾巴就补上。箱子在头前面会被推一格，前面是墙就推不动。撞墙或撞自己停在原地并记一次撞。箱子推进坞才算。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

进坞×80 + 身长×8 − 撞×40。全部进坞 +300。一次撞比半箱更贵。

Docked×80 + length×8 − bumps×40. Docking every crate adds 300. One bump costs more than half a crate.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`step:n` `step:s` `step:e` `step:w` 把头往那个方向走一格。页面上 W A S D 就是这四步。撞墙、撞自己、或箱子推不动，都不移动，只加一次撞。

## 状态

`state.snake` 从头到尾，`state.crate`，`state.dock`，`state.stage`，`state.strikes`，`state.seated`，`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-coil test
pnpm --filter @gameclaw/claw-coil check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-coil.ts`。不要再添加 CLI 入口。
