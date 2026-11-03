# 璿芃攻略 (Tiny Conquest)

小人國的璿芃受國王召令，要在五十二週內選一個大人國攻陷。戰爭或外交都行；只是當勝利落在鏡面國，那座被攻陷的王城好像越看越像自己的家。

```bash
tiny-conquest new --seed 7
tiny-conquest act target:harvest
tiny-conquest act aid
tiny-conquest recap
```

当前版本 `2.4.0`，使用 GameClaw 的 TypeScript `gamekit` v2 运行时。游戏正文与状态提示保留繁体中文。

## Agent-first 规则

- **一次 `act` 就是一次明确输入**。返回值包含日志、完整状态、结构化事件与下一批合法动作，不需要在 `status` / `actions` 之间轮询。
- **同一种子可回放**。所有日常事件、发现判定、逃跑危险、迎战士气与救援都使用状态内的 sfc32 四字 `rng`；规则不读取真实时钟。
- **时限不排斥非交互玩家**。逃跑与迎战用可见的决策拍数表示时限。每次 `act dodge:*` 或 `act strike:*` 消耗一拍，不要求人在毫秒內敲键。
- **风险先公开，结果再入日志**。危险动作的发现率写在 `detail`；掷值、命中、伤害、连击与救援率写进 `events`。
- **默认 observer 与报告**。`new` 启动本地观察页；终局停止服务并写 HTML / Markdown 结算。测试或离线自动化可加 `--no-observer --no-report`。

## 一年与三个目标

选择目标不占一週。普通野外行动与组装武器各占一週，并在行动后消耗一份糧草；沒有糧草就扣體力。第五十二週行动后仍未主动攻陷，就是 `逾期`。

| 目标 | 战争门槛 | 外交门槛 | 特征 |
|---|---|---|---|
| `bastion` 鐵壁國 | 控制 7、武器威力 6、情報 4 | 影響 10、善意 7、情報 4 | 城防与发现率较高 |
| `harvest` 豐穗國 | 控制 6、武器威力 4、情報 3 | 影響 8、善意 6、情報 3 | 适合补给与外交 |
| `mirror` 鏡面國 | 控制 5、武器威力 3、情報 5 | 影響 7、善意 5、情報 5 | 两种攻陷都进入 `鏡國` 反转 |

`--content harvest` 可直接选定目标，也接受 `target:mirror` 形式。`--difficulty easy|normal|hard` 调整开局补给与发现率。

## 资源与日常动作

- `state.food` 糧草；`state.coins` 銀幣；`state.parts` 部件。
- `state.intel` 情報；`state.goodwill` 善意；`state.suspicion` 暴露。
- `state.health` 體力；`state.control` 战争控制；`state.influence` 外交影響。
- `state.week` 当前週；`state.target` 目标；`state.phase` 当前阶段。
- `state.weapon` / `state.draft` 当前武器与设计图。
- `state.escape` / `state.combat` / `state.capture` 三个动作阶段的完整公开状态。
- `state.rng`  deterministic sfc32 状态；`state.outcome` / `state.ending` / `state.cause` 结算字段。

| id | 效果与取舍 |
|---|---|
| `scout` | 情報 +2、部件 +1、暴露 +1；有日常事件与发现判定 |
| `aid` | 善意 +2；可能遇到好人或坏蛋，不主动掷发现 |
| `earn` | 銀幣 +3；用一週换买粮、交涉或赎身资源 |
| `buy` | 3 銀幣换糧草 +7、暴露 -2；回本國购买，不触发日常 |
| `steal` | 糧草 +5、部件 +1、暴露 +1；未被发现时，大人以为又是老鼠 |
| `rest` | 體力 +1、暴露 -2 |
| `design` | 进入工坊；选部件不耗週，组装才耗 |
| `raid` | 有武器才出现；按威力与目标城防加控制，暴露 +2，有发现判定 |
| `negotiate` | 花 1 銀幣，影響至少 +2；情報与善意达标时各再 +1 |
| `conquer:war` | 战争门槛全达标时出现，主动攻陷 |
| `conquer:pact` | 外交门槛全达标时出现，以归附盟约攻陷 |

`scout`、`aid`、`earn`、`steal`、`raid`、`negotiate` 会从确定性日常事件表遇到好人或坏蛋。事件可能送粮、送部件、给情报，也可能偷钱、设捕鼠夹或提高暴露；不能把一个种子的遭遇当成固定攻略。

## 武器设计系统

工坊依次选三种部件：

1. `part:frame:match|spool|thimble`：火柴框、線軸框、頂針框。
2. `part:head:needle|pepper|feather`：繡花針、胡椒囊、羽絨槌。
3. `part:drive:spring|rubber|bellows`：發條、橡皮筋、小風箱。
4. `assemble` 组装；`part:reset` 重选，`cancel` 不耗週退出。

每个部件都有成本、威力、噪音与机动。噪音会提高 `raid` 发现率；机动 ≥3 会让逃跑路线少需要一次成功闪躲。威力 0–1 的组合仍然能用，但日志会诚实说明它对大人可能只是抓痒。当前组合与总成本在 `status` 的「武器設計」段可见，部件不足时不会出现 `assemble`。

## 被发现：逃跑或迎战

发现后只有 `respond:flee` 与 `respond:fight`。

### 逃跑：路线选择 + 时限闪躲

- 路线：`route:drain` 四拍需三次成功、成功后暴露 -2；`route:crumbs` 三拍需两次成功、丢 2 糧草；`route:hem` 四拍需三次成功、成功后暴露 -3。
- 每拍状态先显示危险预告，再输入 `dodge:left`、`dodge:right` 或 `dodge:duck`。
- 闪错两次立即被俘；拍数用完而成功数不足也被俘。成功回到野外，不额外耗一週。

### 迎战：时机 + 连击回合

- 每拍公开游标 `cursor` 与最佳出手点 `opening`；时机值为 `max(0, 3 - abs(cursor-opening))`。
- `strike:quick`：时机值大于 0 就命中，伤害含当前 combo。
- `strike:heavy`：时机值至少 2 才命中，加入武器威力与双倍 combo；低威力武器可能只是抓痒。
- 时机值至少 2 的命中让 combo +1；较弱命中或失手会断 combo。失手与弱击会遭反击并扣體力。
- `brace` 保留 combo、不受这一拍反击，但也消耗一回合。五拍内未击败追兵或體力归零都会被俘。

## 俘虜与救援

被俘不是立即终局。`state.capture.attemptsLeft` 初始为 3：

- `rescue:signal`：善意至少 4、情報至少 2 时出现；消耗善意 2、情報 1，必定获救。
- `rescue:ransom`：銀幣至少 4 时出现；花 4 銀幣，必定获救。
- `rescue:wait`：按善意与武器机动计算救援率；失败消耗一次机会，三次都失败才进入 `俘虜`。

获救后回到野外，至少保留 1 體力与 2 糧草。若一年已经结束，仍会结算 `逾期`。

## 结局

- `war` 征服 / `pact` 盟約：普通目标的两种胜利。
- `mirror` 鏡國：攻陷鏡面國后，发现被攻陷的好像是自己的小人國。
- `deadline` 逾期：五十二週用尽仍未主动攻陷。
- `captive` 俘虜：最后救援机会也失败。
- `starvation` 斷糧：空仓耗盡最后體力。
- `aborted` 收令：通过通用 `abort` 主动中止，不算胜负。

`recap` 只输出本局观察。`memoryPrompt` 要 agent 记录目标、路线、补给、部件与关键判定，并明确提醒换目标、难度或种子后重新验证。

## 开发

```bash
pnpm --filter @gameclaw/tiny-conquest typecheck
pnpm --filter @gameclaw/tiny-conquest test
node scripts/test-game.mjs tiny-conquest
bun games/tiny-conquest/src/main.ts new --seed 7 --state-dir /tmp/tc
node scripts/build-game.mjs tiny-conquest
```
