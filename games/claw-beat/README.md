# 虾节 (Claw Beat)

`claw-beat`

一句四拍的短语会留下来。每轮最多改两拍，然后用它迎下四拍看得见的来势。点最多两下，而且不能相邻，还得留一个歇。闪吃劈，架也吃劈，点吃停，虚专吃闪。五轮内把对方打到零，气息先尽就输。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

命中×12 + 拆招×30 + 格挡×10 + 剩余气息×8 − 受击×28。击倒 +420。受击比两次命中更贵。没击倒只留命中和拆招的三分之一。

Hits×12 + ripostes×30 + blocks×10 + breath left×8 − damage taken×28. A knockout adds 420. Damage taken costs more than two hits. A loss keeps one third of the hit and riposte points.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`set:拍:jab|guard|slip|rest` 改一拍。`commit` 交锋。不合法的短语不会出现。交锋的 detail 写明你会受多少、对方掉多少、几下拆招、几下格挡。

## 状态

`state.phrase` 四拍，`state.tape` 八拍来势，前四拍是这一轮。`state.edits`、`state.editCap`、`state.breath`、`state.enemy`、`state.commits`、`state.hits`、`state.ripostes`、`state.blocks`、`state.taken`、`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-beat test
pnpm --filter @gameclaw/claw-beat check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-beat.ts`。不要再添加 CLI 入口。
