# 虾泊 (Claw Berth)

`claw-berth`

四个泊位水深不同。吃水不能超过水深，拖船可以多塞深一档。危货挨在一起算事故，新来的船有一半是危货。靠上之后要装四拍才开航。等待让已靠的船装货，也让港外的船失去耐心。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

货×12 + 开航×15 − 怒×40 − 事故×70。装满 +320。一次事故比三次开航更贵。

Cargo×12 + sailed×15 − anger×40 − incidents×70. Filling the quota adds 320. One incident costs more than three sailings.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`dock:泊位` 直接靠上，吃水不能超过水深。`tug:泊位` 用一次拖船，只能多塞深一档。`wait` 等一拍：已靠的船继续装货，港外的船少一点耐心。

## 状态

`state.depths` 四档水深，`state.berths` 已靠的船，`state.current` 港外这一艘，`state.next` 下一艘，`state.cargo`，`state.tugs`，`state.angry`，`state.incidents`，`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-berth test
pnpm --filter @gameclaw/claw-berth check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-berth.ts`。不要再添加 CLI 入口。
