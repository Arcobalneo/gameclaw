# 虾闹 (Shrimp Rampage)

四夜田园动作游戏。南瓜田里进了会滚、会跑、会弹、会飞的南瓜怪。你要在天亮前摸进六畦田，一边种南瓜、一边把它们哄回去。

```bash
shrimp-rampage new --seed 7
shrimp-rampage act probe:p1
shrimp-rampage act soothe:candy:p3
shrimp-rampage recap
```

当前版本 `3.0.0`，运行在 GameClaw 的 TypeScript `gamekit` v2 运行时上。

## 为什么它是 agent-first 的

- **一次调用 = 一个动作**。`act` 返回本回合日志、完整状态与下一批合法动作；agent 不需要在 `status` / `actions` 之间反复轮询。
- **稳定文本锚点**。`GAME / STATE / STAT / ACTIONS / NEXT` 的结构可以直接正则解析。
- **`--json` 输出**。每回合一个 JSON 对象，包含 `status`、`actions`、`events`、`observer`、`report` 与 `next`。
- **确定性**。同一 seed + 同一动作序列 = 完全相同的结局；save 里保存 sfc32 的 `rng` 状态，可回放、可做回归测试。
- **动作带代价**。每个 `ActionView` 都写明体力消耗与预期后果，不靠猜。

## 核心循环

一个 run 是 **4 夜**，每夜 **6 个动作**，共用一条体力条（初始 16，每夜开局回 6）。

| 动作 | 代价 | 作用 |
|---|---|---|
| `probe:p1` | 1 体力 | 查看某畦：暴露南瓜怪的种属与情绪，并可能砸坏田埂 |
| `soothe:candy\|song\|pat:p1` | 2 体力 | 安抚一只已探明的南瓜怪 |
| `plant:p1` | 1 体力 | 把南瓜籽种进空畦 |
| `water:p1` | 1 体力 | 推进一档生长 |
| `harvest:p1` | 1 体力 | 收成，得 1 南瓜 + 1 南瓜籽 |
| `rally` | 2 体力 | 一次暴露最多 3 只南瓜怪的位置，但会把它们惊到 |
| `cook` | 0 体力 | 消耗 1 南瓜换体力上限 +2 |
| `eat-seed` | 0 体力 | 吃掉 1 南瓜籽回 2 体力 |
| `rest` | 0 体力 | 回 3 体力，结束当夜剩余动作 |
| `end-night` | 0 体力 | 提前收工，体力带到明晚 |

## 真正的张力

**一次查看换一次选择。** 不探明就安抚，会丢掉情绪契合加成，还可能白花 2 点体力。

情绪与手段的契合表：

| 情绪 | 糖果 | 小调 | 轻拍 |
|---|---|---|---|
| 暴躁 `grumpy` | +2 | -1 | 0 |
| 顽皮 `playful` | 0 | +2 | +1 |
| 怯生 `shy` | -1 | 0 | +2 |

**安抚与收成抢同一条体力。** 攒够 3 只安抚，就意味着少浇几次水；反过来也一样。第 4 夜结束时要同时满足 **收成 4** 与 **安抚 3**，任一条不够都算没守住。

**第三夜大暴走。** 从第 3 夜起，你每做一个动作，所有南瓜怪都会换畦——刚探明的信息立刻过期，`rally` 的价值陡然上升，而它又会惊动它们。

**探明是有代价的。** `probe` 会踩坏田埂；田埂耐久 3，归零则该畦当夜报废。

## 南瓜怪的四种走法

| 种属 | 需要安抚次数 | 成功线（DC） | 行为 |
|---|---|---|---|
| 滚轮 `roller` | 2 | 5 | 直线滚过田埂 |
| 快跑 `runner` | 2 | 5 | 换畦频繁 |
| 弹跳 `bouncer` | 3 | 6 | 落点砸坏田埂 |
| 飘浮 `floater` | 3 | 6 | 跨畦移动，难围堵 |

每次安抚掷 `1d6 + 契合 + 探明加成`：情绪契合 −2 ~ +2，未探明为 0；`probe` 探明后额外 **+2**。动作列表里的 `detail` 直接写出「成功线 N+（约 x/6）」，agent 不用自己猜概率。

## 结算

`recap` 输出 `--format markdown` 的结算页：标题、结局、归因、关键指标、最近 10 条时间线、可复用教训，以及一段给 agent 写进自己记忆的 `memoryPrompt`。未完局调用时保持 `ongoing`，标题与归因只描述季中进度，不会生成中止结算。

最终结局只有三种：`won`（守住这一季）、`lost`（没守住）、`aborted`（主动收手）。

## 开发

```bash
pnpm --filter @gameclaw/shrimp-rampage typecheck
pnpm --filter @gameclaw/shrimp-rampage test
bun games/shrimp-rampage/src/main.ts new --seed 7 --state-dir /tmp/pr
node scripts/build-game.mjs shrimp-rampage
```

## 许可证

MIT
