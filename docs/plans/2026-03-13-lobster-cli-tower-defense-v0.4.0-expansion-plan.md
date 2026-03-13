# 2026-03-13 `lobster-cli-tower-defense` v0.4.0 之后的大完整版扩展计划

## 目标盒子（Goal Box）

- [ ] 在 **不破坏 v0.4.0 单关垂直切片当前手感** 的前提下，把 `lobster-cli-tower-defense` 从“单关硬编码原型”推进到“可继续扩展为多图 / 多关 / 多 stage script 的结构化项目”。
- [ ] 先解决 **结构阻塞**，再做内容 Wave1；优先拆开地图数据、波次脚本、模拟规则边界、CLI 呈现边界。
- [ ] 保持 agent-first：信息仍然紧凑、结果仍然可归因、失败仍然 memory-first，不把主循环膨胀成更吵的菜单系统。
- [ ] 为后续版本预留清晰入口：`stage data`、`simulation rules`、`render/report`、`CLI flow`、`tests` 分层明确。

## 反目标（Anti-Goals）

- [ ] 不在这一轮直接大批量新增地图、敌人、单位或多章内容包。
- [ ] 不把单关 vertical slice 改造成重 UI / 多层菜单 / 大量子指令的 CLI 工具壳。
- [ ] 不引入伪持久成长数据库，不假装“局外养成系统”已经成立。
- [ ] 不破坏现有 monorepo build / release / test 主干入口。
- [ ] 不为了“更通用”而把当前可读性和可维护性抽象坏。

## 现状判断

- [ ] 当前 v0.4.0 体验已经成立：单关、三 doctrine、单套 compact render、单份 HTML settlement report、支持 scripted input。
- [ ] 当前主要阻塞不是内容量不足，而是 **stage 数据、波次脚本、地图节点、部署位、规则结算与 CLI 交互仍耦合在一起**。
- [ ] 如果直接继续堆新图 / 新敌潮，会让回归、复用和设计归因越来越难。

## 阶段拆分（Phases）

### Phase 0 — 结构拆分前置（当前轮次优先）

- [x] 写下完整版扩展计划，明确阶段、gate、验收口径。
- [x] 把当前单关的地图 / 路径 / 节点标题 / 部署位 / 波次蓝图抽到可复用的数据层。
- [x] 给“当前唯一关卡”保留一个稳定的默认 stage 入口，避免 CLI 调用层到处散落常量。
- [x] 把纯规则函数与 CLI 输入输出边界拉开，形成可直接单测的 simulation surface。
- [x] 补第一批规则层测试，覆盖 block / push / slow / recall / skill / leak attribution / 尾波清理里的关键回归点。

### Phase 1 — 单关结构稳定化（内容仍克制）

- [x] 明确 stage definition schema：标题、blurb、lanes、paths、slots、forecast labels、wave script builder。
- [x] 明确 simulation API：spawn、attack、strike、movement、tail cleanup、score / notes / leak attribution。
- [x] 给 scripted smoke test 固定一组回归种子 / 输入脚本，作为“体验不变”基线。
- [x] 更新 README / 设计说明，让后续开发者知道：当前已经支持数据化 stage，但仍只有 1 张官方 stage。

## 2026-03-13 本轮推进记录

### 新补的护栏

- [x] 为 `crusher` / `gambler` 潮技补专门规则测试。
- [x] 新增跨 `crusher` / `oracle` / `gambler` 的 scripted regression baseline。
- [x] 继续保留脚本耗尽时的诚实中止口径，不把中止伪装成胜利。

### 真实试玩观察

- [x] `oracle` / seed `7`：`LP` 须探哨兵 + `触须预警` 的第一 pulse 链路清楚，反馈密度合适。
- [x] `gambler` / seed `7`：把高台剪手从 `LP` 换到 `RP` 去接右线快潮时，旧版仍会长期优先打中线 `M1` 残敌，导致“换线”决策有点假。

### 因试玩做的小迭代

- [x] 把 `LP` / `RP` 调成更偏侧翼的瞭望位：仍能看中入口与总卡口，但不再整段覆盖 `M1`。
- [x] 目标是让高台换边更像真实换线，而不是“只是 UI 上站到了另一边，火力还总被中线吸走”。

### Phase 2 — 多图准备（仍先结构，后内容）

- [ ] 为第二张地图验证 schema 是否够用，但只做最小试制，不默认挂进主流程。
- [ ] 检查 slots / coverage / paths 是否足以表达“不同 choke 结构”和“非对称高台”。
- [ ] 检查 wave script builder 是否能表达：固定脚本、seed 重映射、阶段性精英提示、尾波-only 清场段。

### Phase 3 — 内容 Wave 1（后续版本，不在本轮）

- [ ] 新增少量地图与相应 stage script。
- [ ] 再评估是否需要少量新单位 / 新敌人来支撑地图分化。
- [ ] 以“不同地图真的改变布防逻辑”为主，不以数量为主。

### Phase 4 — 多关 run / 章节化（后续版本，不在本轮）

- [ ] 只有在单关数据层和规则层稳定后，才考虑多 stage run。
- [ ] 设计关间连接时，优先保证阶段感与复盘价值，不做伪长期养成。
- [ ] 如果扩到多关，仍坚持 compact 主视图，不做臃肿 hub/menu。

## Gate（阶段门）

### Gate A — 允许继续做结构拆分的条件

- [ ] 已写计划文档并明确本轮不做内容 Wave1。
- [ ] 已确认设计 authority 仍以 `docs/references/ai-native-game-design-rules.md` 为准。

### Gate B — Phase 0 完成条件

- [ ] stage 核心数据已从硬编码逻辑中抽离。
- [ ] 规则层至少存在一组不依赖 CLI 输入的可直接测试入口。
- [ ] 现有单关 seed 行为与 compact 体验没有明显回归。
- [ ] 新增测试能覆盖本轮最脆弱的规则点。

### Gate C — 允许开始内容 Wave1 的条件

- [ ] 已有针对单关结构回归的自动化测试。
- [ ] README / 相关设计说明已同步，不会误导后续维护者继续往旧硬编码堆东西。
- [ ] 至少跑过 repo-level test entry 与一个 scripted smoke test。

### Gate D — 允许考虑多关章节化的条件

- [ ] 第二张地图的试制没有迫使规则层再大改一次。
- [ ] CLI 主循环在加入 stage 选择或多关流程后，仍保持低噪音、少动作、高可归因。

## 本轮执行边界（This Round Only）

- [ ] 只做 Phase 0 + Phase 1 的第一批工作。
- [ ] 优先解结构阻塞，不直接开始内容 Wave1。
- [ ] 优先拆：stage data、wave plan data、simulation API、规则层测试、最少必要文档。
- [ ] 不做 git commit。

## 验收口径（Acceptance Criteria）

### 结构验收

- [ ] `地图/路径/部署位/波次脚本` 已经能通过集中数据结构表达，而不是散在主循环与规则函数里。
- [ ] CLI 层主要负责：输入选择、文案输出、调用规则层；规则层主要负责：状态推进与事件生成。
- [ ] 当前 stage 仍然可以通过一个默认入口启动，不需要新菜单来“证明”结构更通用。

### 体验验收

- [ ] v0.4.0 当前默认体验保持不变：仍是单关、单主循环、单 pulse 介入窗、compact render 默认开启。
- [ ] 对玩家可见的规则行为没有被无意改写：同 seed 仍可复现，同脚本输入仍可 honest 结束。

### 测试验收

- [ ] `./scripts/test-game.sh lobster-cli-tower-defense` 通过。
- [ ] 至少一组额外针对性验证通过（例如 scripted smoke test 或单模块测试）。
- [ ] 新增测试明确覆盖本轮拆分后最容易回归的规则点。

## 风险与提醒

- [ ] 最大风险不是“写不出更通用的数据结构”，而是抽象过度后让当前单关更难读、更难改。
- [ ] 规则层与 CLI 层的切分要以“更好测、更好扩” 为准，不要为了教科书式分层强行拆出过多文件。
- [ ] leak attribution 与尾波清理会牵涉结算节奏，改动时必须有测试兜底。
- [ ] 如果某个结构点拆开后明显比预期更重，应诚实停在可审阅状态，不要假装“多图支持已经完成”。

## 本轮 checklist

- [ ] 新建本计划文档
- [ ] 提取默认 stage 数据定义
- [ ] 提取 stage wave plan builder
- [ ] 提取规则层纯函数入口
- [ ] 保持现有 CLI 主循环体验
- [ ] 新增第一批规则层测试
- [ ] 更新 README / 相关说明
- [ ] 跑 repo-level test
- [ ] 跑额外 smoke / targeted validation
- [ ] 输出剩余阻塞清单（不提交 git）
