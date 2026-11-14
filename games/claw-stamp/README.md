# 虾印 (Claw Stamp)

`claw-stamp`

夜渡窗口，十二位旅客。合法就盖章，禁行就拒签。擦边的船资更高，盖下去记过、打断连段，而且不算一次放行。特赦一次，免掉船资，算放行。细看花两耐心，只有擦边会改成合法。放行够数才开船。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

船资×12 + 拦截×35 + 最好连段×22 − 记过×80 − 误判×40。开船 +420，再加剩余耐心×8。没开船只留三分之一。一次记过比两次拦截更贵。

Fares×12 + catches×35 + best streak×22 − strikes×80 − misreads×40. Sailing adds 420 plus patience×8. A failed night keeps one third. One strike costs more than two catches.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`stamp` 盖章，`refuse` 拒签。擦边且还有特赦时才有 `pardon`。耐心至少 2 才有 `listen`。detail 写明船资、记过和连段。

## 状态

`state.traveler` / `state.next` 是当前和下一位，种类为 `clear`、`edge` 或 `banned`。`state.approvals`、`state.quota`、`state.strikes`、`state.strikeLimit`、`state.patience`、`state.streak`、`state.pardons`、`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-stamp test
pnpm --filter @gameclaw/claw-stamp check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-stamp.ts`。不要再添加 CLI 入口。
