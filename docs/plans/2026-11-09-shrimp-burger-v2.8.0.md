# 新游戏上线计划：虾堡（Shrimp Burger）v2.8.0

- 状态：进行中
- 日期：2026-11-09
- 范围：新增 `games/shrimp-burger`、catalog / 五平台发行面、测试、中文 README 与全仓现行版本同步到 `2.8.0`
- 设计依据：`docs/references/ai-native-game-design-rules.md`
- 结构参照：`games/shrimp-leap`，并参考 `games/shrimp-greens` / `games/shrimp-conquest` 的契约测试
- 明确限制：复用 gamekit；不新增运行时依赖；不实现全屏 TUI；`SKILL.md` 只更新版本，不列游戏名单；不创建 PR、release tag，不发布 ClawHub

## 1. 目标

1. 新增 id / binary / package / 目录均为 `shrimp-burger` 的标准 GameClaw 游戏，标题严格为 `虾堡 (Shrimp Burger)`。
2. 把实时接汉堡改造成离散回合：阅读配方、三格落物与火候，在接料、驱赶、安抚、出餐和等待之间分配班次时间。
3. 错料不自动失败；融合、偷吃、火候与缺失配料共同形成可解释的确定性味觉判定，可能幸运美味，也可能灾难。
4. 每次 `act` 返回日志、完整状态、结构化事件和下一批真实可执行动作；`next` 给出当前建议，recap 能归因到订单、动作、火候、错料、偷吃或时间。
5. 进入 `catalog/games.json`，覆盖五个平台及 release assets；自动派生矩阵从 10×5 扩到 11×5。
6. 根包、gamekit、全部游戏包、运行时版本、相关测试与 README 现行版本、SKILL 元数据统一为 `2.8.0`。
7. 更新双语根 README、CHANGELOG、NAMING、AGENTS、架构 / 发版 / 计划文档；完成校验、真实 binary 构建与至少 15 步真实 CLI 试玩。
8. 按用户要求尽早、多次 commit 并 push `feat/shrimp-burger-v2.8.0`；最终 smoke 日志保存到 `/tmp/shrimp-burger-smoke.txt`。

## 2. 玩法设计

### 2.1 玩感、流程与胜负

**玩感**：一边看订单一边在混乱站台腾出双手。所需食材与火候会抢同一个接取动作；错料可以赌，融合可以省事也可能更怪；害虫逼近时，要继续接料还是停手驱赶；出餐失败后，安抚又要花掉宝贵班次。

- 默认 normal：60 回合内送出 4 份达到美味门槛的汉堡；easy / hard 调整目标、时限与容错，不另开规则。
- 主阶段为 `service`；不合格出餐进入 `guest` 安抚窗口，最后为 `ended`。不设置冗长 prep。
- `shift-done`：美味汉堡达到目标，立即获胜。
- `walkouts`：愤怒离店达到上限；`ruined`：灾难餐达到上限；`timeout`：班次耗尽仍未达标；`aborted`：通用主动中止。
- `score / served / goal / turnsRemaining / walkouts / ruined` 全部进入状态与 status。

### 2.2 落物、接料与火候

- 动作 id 保持精简：`catch:<0|1|2>`、`shoo:<pestId>`、`soothe`、`serve`、`wait`、`discard-top`。
- 每个服务动作消耗 1 回合并推进落物；`serve` 结算当前汉堡并清空叠层；`wait` 只推进；`discard-top` 仅在有叠层时出现，用 1 回合移除顶层，给误接提供真实代价。
- `state.recipe` 公开必需配料、可选配料、说明与整数目标火候区间；`state.stack` 保留实际接到的所有普通、错误与融合材料。
- `state.falling` 公开三格普通食材、错料、`rare / medium / well` 火候球及融合进度。火候球分别增加不同整数火候，每 tick 小幅冷却，最终限制在 0–100。
- 火候与接料竞争同一回合。过热可等待冷却或冒险出餐；一直等待则会耗尽班次。

### 2.3 错料与确定性味觉判定

- 接到配方外材料**始终入栈**，不会自动报非法或直接判负；配方外材料也可先保留，最后赌一次。
- 出餐时从保存的 sfc32 状态恢复 RNG。美味阈值由必需缺失、错料组合及各自味觉修正、目标火候偏差、融合 / 特殊材料奖励共同计算；再抽 1–100 的判定值。
- 达到阈值为 `tasty`；在带错料、缺失或火候越界时成功为 `lucky`；未达阈值按差距分为 `bad` / `disaster`。错料和火候越界均不是无 RNG 的自动失败。
- `serve` 的 detail 公开当前阈值与主要修正，但不提前泄露判定值；`events` 与 `state.lastOrder` 在出餐后记录阈值、roll、错料 IDs、缺失 IDs、heatDelta、火候越界值与结论。
- `bad / disaster` 进入 `guest`：`soothe` 花 1 回合保住客人并开下一单；`wait` 明确放弃安抚并记一次 angry walk-off。灾难餐同时累计 ruined。

### 2.4 融合

- 落物可随机成为 `kind=fusion` 的两阶段材料：`progress=0` 为融合中，未接取则保留到下一 tick 变为 `progress=1`；其他格正常刷新。
- 融合中也能直接接取，会立即得到公开结果并附带额外热量，形成“现在抢”与“等稳定”的取舍；稳定后接取没有额外热量。
- 融合结果以 `satisfies` 公开可满足的一项或多项配方需求，因此可能 on-legend、off-legend 或 special；黄金锅巴等特殊材料提供味觉奖励。
- `fusion-start / fusion-ready / fusion-catch` 事件、落物字段与栈内 `fused / legend / special` 字段保持一致，recap 记录本局融合次数。

### 2.5 害虫与反支配

- 老鼠、海鸥、浣熊、鸽子、猫间歇出现，各有稳定 pest id、剩余偷吃拍数与不同目标：顶层、配方内材料、火候、多层或落物。
- `shoo:<pestId>` 消耗本回合并移除目标；其他服务动作会让害虫倒计时。偷吃写入日志、事件、总数与订单复盘。
- 无脑全接会累积错料、过热并忽略害虫；无脑全等会丢失落物与班次；配方与火候抢回合；安抚与驱赶也让出推进时间；融合既可能补齐需求，也可能带来怪材料。
- 动作排序提供诚实建议：可合理出餐时优先 `serve`，紧急偷吃、缺失食材与合适火候按局势排序，无价值落物时推荐 `wait`。其他合法但有风险的选择仍可真实执行。

## 3. 状态、契约与测试

主要 JSON 路径：

- `state.phase / difficulty / turnsUsed / turnsRemaining / goal / served / score`
- `state.order / recipe / stack / heat / falling / pests / guest`
- `state.walkouts / ruined / pestThefts / fusionsCaught / wrongCaught / soothed`
- `state.lastOrder / lastSetback / timeline / outcome / ending / cause / rng`

测试覆盖：

- 同 seed 与同动作序列的逐帧回放、不同 seed 差异、四字 RNG、JSON 可序列化。
- 所有当前列出动作逐个真实执行；动作列表与 `act` 共用 `actionsOf` 准入；非法阶段动作被拒绝。
- 错料入栈且不自动失败、阈值输入与幸运 / 灾难分支、火候边界、缺失需求、融合两阶段及特殊材料。
- 各类害虫倒计时 / 驱赶 / 偷吃、discard 代价、soothe / walkout、ruined / timeout / shift-done / aborted。
- 多个 seed 的推荐策略完整胜利与粗心策略失败，避免支配策略或不可达目标。
- CLI `new --seed --json / act --json / status / actions / recap --json`、版本、错误码、报告与 next。

## 4. 假设与风险

- 假设：不改 gamekit 契约、共享 observer/report、现有游戏玩法或 workflow；矩阵由 workspace 包自动发现。
- 假设：`--difficulty easy|normal|hard` 沿用现有游戏的 normal fallback；`--content` 不增加另一套开局规则。
- 风险：随机器材导致缺料或时间失衡 → 三路生成、所需材料权重、推荐策略多种子完整跑通并按实玩调整。
- 风险：味觉随机制造“无辜失败” → 出餐前公开阈值和全部修正，出餐后保存 roll 与归因；成功不掩盖错误，失败明确触发动作。
- 风险：融合在刷新时消失 → 未稳定融合跨 tick 保留，测试进度与 RNG 回放。
- 风险：害虫只有文案没有后果 → 每类实现不同实际目标，测试状态变化与 shoo 成本。
- 风险：动作列表与执行不一致 → `act` 直接以 `actionsOf` 为唯一准入来源，engine 与 CLI 双重逐个执行。
- 风险：发行面漏改 → 搜索全部现行 `2.7.0`、十款与 50 产物描述；历史 CHANGELOG / 旧计划保留原文。
- 风险：观察页 / 报告只在 import 层验证 → 用真实 binary 完整开一局，检查 localhost 页面、终局关停与静态报告。

## 5. Checklist

- [x] 阅读设计准则、shrimp-leap 实现 / 测试、gamekit、catalog、构建与发行配置
- [x] 写入本计划并提交早期 checkpoint
- [ ] 新增 `shrimp-burger` 包、LICENSE、tsconfig、main、definition、content、engine
- [ ] 新增 engine / CLI 测试并通过包级 typecheck / test
- [ ] 新增中文 README，标题严格为 `虾堡 (Shrimp Burger)`，记录动作、状态路径与数值
- [ ] 新增 catalog 第十一条与五平台 release assets；lockfile 加入 workspace importer
- [ ] 全仓现行版本与测试断言升到 2.8.0，SKILL 保持无游戏名单
- [ ] 更新双语根 README、CHANGELOG、NAMING、AGENTS、架构 / 发版 / 计划索引
- [ ] 跑 `pnpm validate:catalog && pnpm lint && pnpm check && pnpm test` 并修复
- [ ] 验证 release matrix 为 11×5，构建本机真实 binary 与至少一个 foreign target
- [ ] 用真实 CLI / binary 完成至少 15 步试玩，保存 `/tmp/shrimp-burger-smoke.txt`
- [ ] 验证 observer 页面响应、终局关停、HTML / Markdown 结算
- [ ] 审查生成文件与 diff，将本计划标记完成；commit 并 push 全部交付，不建 PR / tag / release

## 6. 验证记录

待实现与实玩后填写。
