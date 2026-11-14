# 虾礁 (Claw Reef)

`claw-reef`

标点都看得见。先走一步，或者下锚停住。然后公开的潮把没下锚的推一格。标只在潮推完、你还站着的那一格算数。潮把你推上海胆也算一次被冲。下锚可以压住脚下的海胆。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

标×90 + 剩余锚×10 − 被冲×70。踩完 +280。一次被冲比省下两只锚更贵。

Marks×90 + anchors left×10 − sweeps×70. Standing on every mark adds 280. One sweep costs more than two saved anchors.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`step:n` `step:e` `step:s` `step:w` 先走一格。`anchor` 这一潮停住，花一只锚。detail 写明潮推完落在哪、那一格是不是还没踩的标，或者会不会顶墙、推上海胆。

## 状态

`state.x` `state.y` 潮推完的位置，`state.goals` 标点，`state.urchins` 海胆，`state.got` 已经踩到的，`state.tide` 决定下一步潮向，`state.anchors`，`state.swept`，`state.rng`。普通难度三枚标、四只锚。盘面会洗到存在一条不超被冲上限的路。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-reef test
pnpm --filter @gameclaw/claw-reef check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-reef.ts`。不要再添加 CLI 入口。
