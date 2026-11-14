# 虾潜 (Claw Heist)

`claw-heist`

读巡逻、摄像头与噪音，取走目标后在封锁前撤离。三套 profile、设施、安保、目标与复杂化包交叉生成任务。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

带走的目标分按警戒倍率计算：0 警戒 ×4，1 警戒 ×2，更高 ×1，再 ×25，加上剩余时间，减去认错的货格。死在里面只留目标分的五分之一。吵着撤出去赢不了安静的一局。

Loot is multiplied by alert: ×4 at 0, ×2 at 1, ×1 above that, then ×25, plus time left, minus wrong crates. Dying keeps one fifth of the loot. A loud extract cannot beat a quiet one.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。同一名字只保留最高分。站点总榜是各游戏最高分之和。

## 动作

合法动作由当前局面决定，`list_actions` / 页面按钮给出 id。一次 `act` 只做一步，并返回日志、新状态和下一组动作。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-heist test
pnpm --filter @gameclaw/claw-heist check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-heist.ts`。
