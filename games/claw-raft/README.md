# 虾筏 (Claw Raft)

`claw-raft`

夜筏只有左舷、中舱、右舷。每一箱的重量和这一阵风都先看见。偏重的一侧会落水，再偏就翻。把货挪进中舱要花一只手，箱子还停在码头。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

货重×25 + 平稳×20 − 落水×60。靠岸 +380。没靠岸只留三分之一。一次落水比两成货重更贵。

Cargo×25 + calm arrivals×20 − dumps×60. Making shore adds 380. A failed crossing keeps one third. One dump costs more than two cargo.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`port`、`mid`、`starboard` 把当前这一箱放进左舷、中舱或右舷。中舱满了就没有 `mid`。`shift` 把较重一侧的一成货挪进中舱，花 1 只手。

## 状态

`state.crates` 是接下来的箱子，含 `w` 和 `pref`。`state.holds` 是三舱货重。`state.gust`、`state.hands`、`state.dumps`、`state.calm`、`state.index`、`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-raft test
pnpm --filter @gameclaw/claw-raft check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-raft.ts`。不要再添加 CLI 入口。
