# 新游戏上线计划：南瓜大暴走（Pumpkin Rampage）

- 状态：执行中
- 日期：2026-11-01
- 作者：小龙（agent maintainer）
- 范围：新增一款 gameclaw 游戏、catalog / 文档 / 发版同步

## 1. 目标

把小红书笔记《一天一個遊戲構思 Day155 — 南瓜大暴走》（運氣兼動作遊戲）改编成一款符合 gamekit 契约的 agent-first CLI 游戏，并完成全量发版：

1. `games/pumpkin-rampage` 可 `new / status / actions / act / recap` 完整游玩。
2. 进入 `catalog/games.json`，五平台资产命名符合契约。
3. `README.md` / `README.zh-CN.md` / `SKILL.md` / `CHANGELOG.md` 同步。
4. `pnpm lint && pnpm check && pnpm test` 通过，`validate:catalog` 通过，本机二进制可跑。
5. 打 tag 触发 release workflow，产出六款游戏 × 五平台。

## 2. 原作要点（需求来源）

- 運氣兼動作遊戲：在南瓜田里找出暴走的南瓜怪并安抚下来；有时很容易找，有时要仔细看才会找到。
- 南瓜怪会滚走、会跑、甚至会弹跳。
- 安抚成功可能得到糖果。
- 特殊模式：所有南瓜四处暴走滚动甚至飞天，需要和组员合作化解危机。
- 普通南瓜可以浇水种植；收成后可煮食提升体力值上限；开出特殊版本南瓜可兑换造型家具。
- 每次收成得到南瓜籽，可以重新种、吃掉、或砌成艺术品。

## 3. 玩法转译（agent-first）

**核心玩感**：在信息不全的田里做取舍——花体力探明位置，还是赌线索硬安抚；同时经营普通南瓜维持体力上限。

| 原作元素 | CLI 机制 |
|---|---|
| 找出暴走南瓜 | 6 块田畦，怪物隐藏；`probe:pN` 消耗体力探查，隐蔽怪需要两次探查 |
| 有时要仔细看 | 怪物有 `hideFor = 1 or 2`，第一次只给「有东西在动」的模糊反馈 |
| 滚走 / 跑 / 弹跳 | 三种移动模式：滚 1 畦、跑 2 畦、跳 2 畦（无视相邻）；安抚失败后立即迁移 |
| 安抚 | `soothe:pN` 消耗 1 体力 + 1 糖果，d6 + 修正 vs 躁动值；成功累积安抚进度，满 2 次收服 |
| 糖果 | 收服奖励糖果；糖果同时是安抚资源，形成「留糖还是用糖」的取舍 |
| 组员合作 | `rally` 消耗 2 糖果，两回合内钉住全场怪物（仅暴走夜更划算） |
| 浇水种植 | `water:pN` 推进生长（0→3），成熟后 `harvest:pN` |
| 煮食提升体力上限 | `cook` 消耗 1 南瓜 → 体力上限 +1 并回复 2 体力 |
| 特殊南瓜换家具 | 收成时 20% 概率出特殊版本，产出家具（计分） |
| 南瓜籽 | 收成 +2 籽；`plant:pN` 播种；`eat-seed` 吃籽换体力 |
| 特殊模式 | 第 3 夜为「大暴走夜」，全部怪物变为飞天型，每回合移动 |

**局面压力**

- 每夜有行动预算（moonlight），体力是硬约束；体力归零 → 力竭，损失 1 田地耐久。
- 夜末仍有未收服怪物 → 逃逸，每只损失 1 田地耐久。
- 田地耐久 3 点耗尽 → 输（田毁了），死因写进 recap。
- 完成 4 夜且田未毁 → 赢。

**反支配策略设计**

- 只探不打：体力耗尽、夜晚结束、怪物逃逸。
- 只打不探：盲安抚命中率低（未探明目标不可安抚），必须至少探一次。
- 只种田：收成不产生安抚进度，夜末逃逸扣耐久。
- 囤糖果：糖果上限带来的收益低于及时收服。

## 4. 假设与风险

- 假设：gamekit 契约不变，不需要改包。
- 风险：状态过大导致 `actions` 过长 → 通过「未探明只列 probe、已探明只列 soothe」收敛动作空间。
- 风险：确定性测试需要固定判定 → 所有随机走 `Rng`，判定值写入 `events`。

## 5. Checklist

- [x] `docs/plans/2026-11-01-pumpkin-rampage.md`（本文件）
- [x] `games/pumpkin-rampage/{package.json,tsconfig.json,LICENSE}`
- [x] `games/pumpkin-rampage/src/{content.ts,engine.ts,definition.ts,main.ts}`
- [x] `games/pumpkin-rampage/tests/{cli,engine}.test.ts`
- [x] `games/pumpkin-rampage/README.md`
- [x] `catalog/games.json` 追加条目
- [x] `README.md` / `README.zh-CN.md` / `SKILL.md` / `CHANGELOG.md`
- [x] `pnpm lint && pnpm check && pnpm test && pnpm validate:catalog`
- [x] `node scripts/build-game.mjs pumpkin-rampage` + 真机跑通一局
- [x] commit + tag `v2.1.0` + push，确认 release workflow

## 6. 平衡标定与验收

用 `bun` 直接 import engine 做批量模拟（400 seed），策略为「先收成 → 已探明契合最好的安抚 →
probe 未探明怪 → 浇水/种籽 → 体力 ≤3 时吃籽/休息 → 保留 2 点缓冲」，以此校准参数：

| 参数 | 初值 | 终值 | 理由 |
|---|---|---|---|
| `BASE_STAMINA` | 12 | 16 | 12 撑不住 6 个动作，任何策略胜率都是 0 |
| `NIGHT_REGEN` | 4 | 6 | 每夜 6 次动作消耗 ≥6，回 4 会让体力单调下滑 |
| 探明加成 `insight` | 1 | 2 | 让 `probe` 成为真决策：探明后弹跳/飘浮从数学不可能变成 3/6 |
| 安抚成功线 `base` | 6/6/7/7 | 5/5/6/6 | 盲安抚不再必然失败，但仍明显劣于探明后再安抚 |

终值下该策略 400 seed 胜率 **54.2%**（217 胜 / 183 负），平均收成 3.52、平均安抚 2.96；
盲安抚（不 `probe`，直接撞运气）在同一策略上只剩 **1.5%**，`need` 降到 1/1/2/2 则飙到 95.8%（过易，已回退）。
可复现的胜利 seed：1、2、5、6、7、10…，通常 24 步结束。`tests/engine.test.ts` 固定 seed 1 断言必胜，
并把「黎明 0 体力即终局」「第三夜每个动作后全场换畦」「事件流含 act/stamina」写成回归测试。
