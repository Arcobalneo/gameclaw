# 虾市 (Claw Fair)

`claw-fair`

今天的袋子和昨天的价钱都公开。照昨、加一，或者降到袋子里。加价被拒绝时，昨天的价钱不变。货空了就得进货。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

利×8 + 成交×20 − 走掉×50。钱够 +280。一次走掉比两笔薄利更贵。

Margin×8 + sales×20 − walkaways×50. Filling the till adds 280. One walkaway costs more than two thin sales.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`hold` 按昨天卖。`raise` 比昨天加一。`cut` 降到客人袋子里，只在袋子低于昨天时出现。`restock` 这一天不卖，货加二。

## 状态

`state.purse` 今天的袋子，`state.yesterday` 昨天的价钱，`state.stock`，`state.coins`，`state.walkaways`，`state.day`，`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-fair test
pnpm --filter @gameclaw/claw-fair check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-fair.ts`。不要再添加 CLI 入口。
