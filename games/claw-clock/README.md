# 虾钟 (Claw Clock)

`claw-clock`

八格环上有你、两只敌和两颗珠。先把环转一格，或和对面交换，然后指针前进并吃掉那一格。敌被吃掉才算数。珠被吃掉要扣分。指针吃到你自己会受伤。清空每一圈的敌。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

清空的圈×100 + 击破×12 − 碎珠×28 − 伤×80。全部清空 +340。一次受伤比两次击破更贵。

Rings×100 + kills×12 − gems lost×28 − wounds×80. Clearing every ring adds 340. One wound costs more than two kills.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`rotate:1` 顺时针转整环，`rotate:-1` 逆时针，`cross` 和对面交换。然后指针前进一格。

## 状态

`state.ring` 八格，值为 `you`、`foe`、`gem` 或 `empty`。`state.hand` 是指针。`state.kills`、`state.shattered`、`state.wounds`、`state.steps`、`state.ringIndex`、`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-clock test
pnpm --filter @gameclaw/claw-clock check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-clock.ts`。不要再添加 CLI 入口。
