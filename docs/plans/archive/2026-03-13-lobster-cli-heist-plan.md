# 2026-03-13 `lobster-cli-heist` 新游戏立项计划

## Goal

- [x] 为 `gameclaw` 的第三款候选游戏写出一份可 review、可执行、能直接指导后续实现的立项计划。
- [x] 把此前过于草率的“CLI 潜行 / heist / infiltration”概念，收束成清晰的玩法骨架、信息结构、节奏模型与 MVP 边界。
- [ ] 在后续编码阶段，以这份计划为准推进 `plan -> change -> docs -> validate -> commit`。

## Scope

- 本文档只覆盖新游戏方向与实现前设计，不包含代码实现、catalog 变更、release 变更或 commit。
- 关注首个 playable vertical slice；不承诺一次性设计完整章节化大作。
- 目标是先回答“这游戏为什么成立、怎么玩、怎么验证它是真的好玩”。

## Assumptions

- 候选 game id 暂定为 `lobster-cli-heist`；working title 暂定为《横着潜：只给龙虾玩的 CLI 潜行渗透》。
- 继续沿用 `gameclaw` 的 monorepo、GitHub Releases 二进制发行、prompt-first / AI-native、seed / scripted input / HTML settlement report 等产品边界。
- 默认 compact 输出；长文案只做可选模式，不抢关键信息。
- 游戏启动时默认要在本地 `localhost` 上，从 `8000` 起自动探测空闲端口并拉起一个可供人类实时旁观 agent 进度的 HTML observer 页面；游戏结束后，该页面要以静态结算页形态留存，但运行期 server 本身必须停止并释放端口。
- 首版先做 **单次潜入、单设施 vertical slice**，而不是多章 campaign。

## Design Authority Alignment

- 这款游戏存在的理由是让 agent 玩家在游玩中学会读局、冒险、撤离，而不是跑一个“潜行 benchmark”。
- 关键设计遵循 `docs/references/ai-native-game-design-rules.md`：
  - 先定义玩感，再定机制：本作目标玩感是“读视线、控噪音、压着风险偷到目标并惊险撤离”。
  - 动作空间主动雕刻：每回合只给少量真正值得比较的动作，不做菜单噪音。
  - 失败必须产出价值：失败应能明确归因到视线、噪音、贪心或撤离时机。
  - memory 友好但诚实：报告只鼓励记录可验证观察，不把单局结果包装成真理。
  - 复杂度必须配信息支持：地图、警戒、噪音、路线都要有清晰摘要。

## Working Title / One-line Pitch

- 候选 game id：`lobster-cli-heist`
- working title：`横着潜：只给龙虾玩的 CLI 潜行渗透`
- one-line pitch：
  - 一款短局、高张力、侧剖面表达的 AI-native CLI 潜行 heist：你要作为龙虾渗透手读懂视线、操纵噪音、骗过巡逻、拿到目标，并在设施全面锁死前横着撤离。

## Why This Game Should Exist in GameClaw

- 它补上了 `gameclaw` 现有目录里缺失的一条核心玩法轴：**潜行 / 渗透 / 撤离**，而不是继续在战斗或布防上做轻微换皮。
- 它让 agent 玩家学习到与前两作不同的能力：
  - route planning
  - partial-information reasoning
  - risk staging
  - recovery under pressure
  - extraction discipline
- 它天然适合短局和复盘：一局可以很短，但每一步都可归因、可记录、可重开验证。
- 它能继续发挥 `gameclaw` 已经成立的成功资产：
  - seed 复现
  - scripted input
  - compact default text
  - HTML settlement report
  - memory-friendly honest postmortem
- 它仍然首先是游戏：
  - 玩的是“偷到东西并带出去”的张力
  - 不是“跑 stealth benchmark”或“看 agent 指标表演”

## Why This Version Is Stronger Than the Rough Idea

- 旧 idea 只有题材气味；这版明确锁定了 **目标—渗透—取物—撤离** 的闭环，而不是“地图里有守卫巡逻”就算潜行。
- 旧 idea 没讲清信息结构；这版明确区分了 **已知、可感知、未知但可推断** 三层信息，避免把失败做成盲猜。
- 旧 idea 没讲清一回合干什么；这版把回合压成 **单个主动作 + 明确结算顺序**，适合 CLI 和脚本化。
- 旧 idea 容易沦为“数字没撞上就过了”；这版把 **视线、噪音、曝光、全局警戒、撤离压力** 拆成独立但互相作用的风险系统。
- 旧 idea 容易把潜行写成“只要一直等”；这版明确要求 **拖延有成本、取物后局势升级、低警戒可恢复但高警戒会持续压迫**。
- 旧 idea 可能一上来就想做大地图；这版把 MVP 收束到 **2~3 行 × 6~8 列的侧剖设施** 和单次任务 vertical slice。
- 旧 idea 里的 agent 策略空间模糊；这版明确要让 agent 学会：
  - 什么时候观察，什么时候推进
  - 什么噪音值得冒
  - 什么时候必须放弃贪心支线
  - 什么时候先拿目标、什么时候先清路
  - 高警戒下怎样撤离而不是硬拖到死

## Product Boundary and Player Fantasy

- 这款游戏仍然属于 `gameclaw` 的产品边界：
  - 源码留在 monorepo
  - 玩家路径优先指向 GitHub Releases 二进制
  - prompt-first / AI-native
  - 默认 compact、可脚本化、可复盘
- 应继承的资产：
  - `--seed`
  - `--script`
  - `--quick-start`
  - `--verbose-text`
  - 运行期本地 HTML observer 页面
  - HTML settlement report
  - 脚本耗尽时诚实中止
- 不该硬搬的资产：
  - 肉鸽式长 build 树
  - 塔防式多波守线结构
  - 为了“内容很多”而堆单位 / 关卡 / 长菜单
- 玩家幻想：
  - 你不是来清图的。
  - 你是一个龙虾渗透手，利用排水沟、阴影、杂物堆、蒸汽、塑料环和侧门，把目标从人类设施里偷出来，再在全场反应过来之前横着消失。
- 成功体验应是：
  - “我读懂了局面，押了一次风险，骗开了一条线，最后硬着头皮带着目标跑出去了。”
- 失败体验应是：
  - “我知道自己是在哪个转角暴露、哪次噪音过贪、哪次没先想好撤离线。”

## Core Loop

1. **接任务**
   - 读取任务简报：目标类型、设施主题、已知入口、已知出口、初始警戒、可选 profile / loadout。
2. **选 profile 与入场点**
   - 选择一条偏好线，而不是传统 build 树：
     - 潜影型
     - 破局型
     - 快撤型
3. **侧剖潜入**
   - 在紧凑设施图上推进、观察、躲藏、操纵对象、制造或规避噪音。
4. **拿目标**
   - 目标一旦到手，设施压力升级：巡逻改道、出口可能更危险、部分安全对象转入更积极状态。
5. **撤离**
   - 最终张力不在“有没有摸到目标”，而在“能不能把目标带出去”。
6. **结算与记忆**
   - 输出路线、关键暴露点、噪音峰值、撤离转折点和诚实的观察提示，鼓励玩家写 memory。

建议单局目标时长：

- 首版中位时长：`10~18` 个行动回合
- 失败通常在前中段埋因，高潮通常发生在取物后 `3~6` 回合

## Game State / Map Abstraction / Entities

### 地图抽象

- 不做大而密的 top-down 迷宫。
- 首版采用 **侧剖面设施 strip**：
  - `2~3` 行
  - `6~8` 列
  - 重点表现“横着潜”的空间阅读感
- 每个格子是可解释的战术位置，而不是纯装饰地砖：
  - `open`：开阔地，过线风险高
  - `cover`：掩体，降低曝光增长
  - `shadow`：暗区，适合等待和重置节奏
  - `door`：门 / 闸 / 塑料帘，影响视线和噪音传播
  - `vent`：通风 / 排水捷径，只给部分路线
  - `console`：可交互对象，如断电、开门、诱发蒸汽
  - `objective`：目标点
  - `exit`：撤离点
- 地图应支持少量垂直连接：
  - 梯口 / 通风井 / 杂物堆高差
- 但不追求复杂 platformer 操作。

### 信息结构

本作必须严格控制信息层级，避免“潜行 = 盲猜”。

#### 1. 永远可见的信息

- 玩家当前位置、状态、当前携带物
- 当前全局警戒等级
- 当前可见敌人与安全对象
- 最近一轮已确认噪音位置
- 当前可用动作与其主要风险标签
- 当前已知出口和目标状态

#### 2. 条件可见的信息

- 最近观察过的守卫朝向和下一步预测
- 摄像头扫向节奏
- 某些门后 / 角后区域的局部信息
- 工具生效范围、噪音会吸引到的单位

#### 3. 未知但可推断的信息

- 未进入区域的具体守卫偏移
- 目标是否在若干可疑点中的哪一个
- 某条支路是否值得绕
- 更高警戒后的具体增援点

要求：

- 未知必须被“可推断地呈现”，而不是任意埋雷。
- 玩家输掉以后，至少能说出自己错在观察、执行、贪心或撤离判断的哪一层。

### 实体层

#### 玩家实体

- 渗透手本人
- 当前位置 / 姿态 / 当前 exposure
- 当前 profile 被动
- 当前 gear charges
- 是否已携带目标

#### 安保实体

- `patroller`：来回巡逻的普通守卫
- `watcher`：定点看线的警戒员
- `camera`：固定或摆扫的摄像头
- `sensor`：压力板 / 动静传感器 / 光束
- `responder`：高警戒后出场的快速响应者

#### 可交互对象

- 门 / 闸
- 终端 / 开关 / 电源
- 蒸汽阀 / 杂物堆 / 诱饵点
- 目标柜 / 账本 / 钥卡点
- 出口 / 临时撤离口

#### 临时状态对象

- `noise marker`
- `disabled security`
- `found evidence`（被发现的痕迹 / 倒地单位 / 打开的柜）
- `jammed` / `smoked` / `darkened` 等短时效果

## Turn Structure and Action Economy

### 回合总原则

- 每回合只做 **一个主动作**。
- “少而关键”比“多而碎”更适合 CLI、脚本输入和复盘。
- 免费信息操作可以存在，但不应让输入面变吵；如查看 legend、翻看上回合日志，不计入主动作。

### 单回合结构

1. **Snapshot phase**
   - 输出本回合状态摘要、当前视野、最近噪音、目标 / 出口状态、可执行动作。
2. **Player action phase**
   - 玩家从上下文相关的 `4~6` 个动作里选一个。
3. **Resolution phase**
   - 依序结算：
     - 玩家动作位移 / 交互 / 工具效果
     - 视线检测与 exposure 变化
     - 噪音传播与调查目标更新
     - 守卫 / 摄像头 / 响应者行动
     - alert 升降与关卡状态变化
4. **Aftermath phase**
   - 给出本回合最关键的后果摘要，而不是长流水账。

### MVP 动作类别

- `Sneak / Shift`
  - 向相邻格推进，低噪音，适合卡 timing。
- `Hide / Wait`
  - 原地压低存在感，观察节奏，部分恢复 focus 或让 exposure 下降。
- `Peek / Survey`
  - 低位移、高信息收益；让 agent 真正“先看后动”。
- `Interact`
  - 开门、断电、取卡、拿目标、触发蒸汽、改动环境。
- `Use Gadget`
  - 投诱饵、短时干扰、一次性遮蔽等。
- `Neutralize`
  - 有条件的近距制伏 / 破坏安全对象；强但高风险，不应成为常规清图按钮。
- `Burst Move`
  - 快潜 / 冲刺；不是默认动作，只给少数时机或少数 profile。

### 动作雕刻要求

- 同一回合不应出现 `10` 个以上可行动项。
- 每个动作都必须有真实取舍：
  - 更快但更响
  - 更稳但更慢
  - 更省 gear 但更耗 alert buffer
  - 更安全拿目标但更危险撤离
- 不允许存在长期支配策略，如“永远 wait 到完美再走”或“永远 rush 最赚”。

## Detection / Noise / Alert / Failure Model

### 1. 视线与曝光（Exposure）

- 暴露不是立刻失败，而是一个当前态风险轨道。
- `Exposure` 代表“你此刻被真正确认的程度”，由以下因素推高：
  - 在开阔地穿过有效视线
  - 在亮区 / 无掩体位置停留
  - 在可见状态下执行明显动作
  - 在高警戒时重复出现在同一视野线
- `Exposure` 可通过以下方式压低：
  - 进入 shadow / cover
  - break line of sight
  - `Hide / Wait`
  - 某些 profile / gadget 效果
- 设计目的：
  - 允许“险些被看见”的戏剧性
  - 不把单次小失误直接做成秒死
  - 让低级失误可挽回，高级失误会滚成灾难

### 2. 噪音（Noise）

- 噪音不是单一总分，而是 **场上可传播、可衰减、可调查的事件**。
- 每个动作会产生标签化噪音：
  - `silent`
  - `low`
  - `medium`
  - `loud`
- 噪音通过门、墙、通风和蒸汽区有不同传播效果。
- 守卫不会全图心灵感应，只会：
  - 朝最近 / 最可信的 `noise marker` 调查
  - 在更高警戒下更快、更积极地响应
- 设计目的：
  - 噪音必须既是风险，也是工具
  - “制造一声响把守卫骗开”要成为正经策略，而不是彩蛋

### 3. 全局警戒（Alert）

建议四段式全局警戒：

1. `冷态`
   - 正常巡逻与固定扫视
2. `起疑`
   - 守卫开始偏离原轨、看得更勤、调查噪音更积极
3. `搜索`
   - 有确认目击 / 被发现痕迹 / 目标异常；设施主动找你
4. `封锁`
   - 进入失败倒计时：响应者入场、门闸锁死、撤离窗口缩小

### 4. 失败模型

失败不应只等于“HP 归零”，而应更符合潜行题材：

- **抓现行失败**
  - 在高 exposure 且无法断视线时被确认包夹
- **封锁失败**
  - 进入封锁后仍未在窗口内撤离
- **任务失败**
  - 目标损毁、出口彻底不可用、或某些场景专属失败条件被触发

关键要求：

- 第一眼看到你，不一定立刻死。
- 但如果你在坏位置被连续确认，局面应快速恶化。
- 取物后，失败压力必须明显上升，否则 heist 的高潮不成立。

## Resource Model

MVP 建议只保留少数真正有张力的资源，不做潜行版“背包大杂烩”。

### 1. `Focus`

- 用于高质量观察、精确交互、安静制伏等动作。
- `Focus` 低时，部分动作会：
  - 更慢
  - 更响
  - 或成功窗口更窄
- 主要恢复手段：
  - 在暗区 / 掩体里等待
  - 某些 profile 被动
- 目的：
  - 让“先稳住自己再动”变成真实选择
  - 避免所有潜行动作都像无成本按钮

### 2. `Gear Charges`

- 每个 profile 带少量一次性工具。
- 工具应少而狠：
  - 诱饵
  - 短时干扰
  - 烟雾 / 蒸汽遮断
  - 一次性快潜壳
- 目的：
  - 提供临场应变
  - 但不把局面变成堆 consumables

### 3. `Alert / Exposure`

- 它们本质上是风险资源：
  - 可以被拿来冒险
  - 但冒过头会压缩撤离空间

### 4. `Carry State`

- 拿到目标后，玩家进入“带物状态”：
  - 某些动作更慢或更响
  - 某些捷径不能走
  - 诱导“先想撤离线，再伸手拿货”
- 这能直接强化 heist 的后半段，而不是让拿目标成为终点。

## Progression / Scenario Variety / Replayability

### 首版进度观

- 首版不做长期元养成。
- 长期成长仍优先发生在玩家自己的 memory 中，而不是游戏内数值账户里。
- 单局成长主要体现在：
  - 读懂 patrol / camera / noise
  - 学会不同 profile 的入场节奏
  - 学会何时取物、何时放弃支线

### 首版可重玩来源

- 不同 seed 下的：
  - 目标落点
  - 巡逻偏移
  - 摄像头初始扫向
  - 门锁 / 钥卡分布
  - 次要收益点
- 三条不同 profile / loadout 线：
  1. `藻披影行者`
     - 更擅长压低 exposure、从 shadow 读时机
  2. `断钳拆闸手`
     - 更擅长处理门、摄像头、环境开关与计划性诱导
  3. `脱壳快撤者`
     - 更擅长高风险 reposition、取物后的强撤离
- 有限但 meaningful 的场景变体：
  - 冷库
  - 后厨
  - 码头仓道
- 可选 side objective：
  - 额外情报 / 额外钥卡 / 额外解锁线索
  - 但不应压过主任务

### Anti-consumption strategy（避免被过快消费完）

首版不能靠“多做几张图”硬堆内容量，而要靠**结构性深度**抗快速消费。

#### 1. 同一张设施图要支持两段完全不同的局势

- 前半段是低警戒潜入：读巡逻、压 exposure、节省 gear。
- 后半段是带物撤离：路线受限、噪音变贵、封锁窗口逼近。
- 这意味着同一 seed 也不只是“走一遍图”，而是必须学会两套节奏。

#### 2. 官方任务不应是单一写死脚本，而应由可组合的 mission grammar 生成

即使首版只出 `1` 个官方任务，也应让它由以下层级组合而成：

- `facility frame`
  - 地图骨架、入口/出口拓扑、关键 choke
- `security package`
  - patrol、camera、sensor、response 风格
- `objective package`
  - 目标类型、取物方式、取物后惩罚
- `complication package`
  - 临时断电、冷凝蒸汽、临时加班的人类、目标伪装点、次要收益诱惑

要求：

- 首版内容要先做少，但数据结构要天然支持这些层可扩展。
- 这样 agent 玩家即使“吃透了一张图”，也不等于吃透了整个任务空间。

#### 3. Replayability 必须来自“可学习的变体”，不是噪声

好的变体应让玩家形成这种复盘：

- “这次是摄像头节奏把我卡住了，不是上次那个巡逻点。”
- “同样是后厨 seed，这次钥卡在右侧，导致快撤线不成立。”
- “同 profile 在不同 objective package 下，开局路线优先级变了。”

坏的变体则只是：

- 纯随机 tile 扰动
- 看不出规律的暗雷
- 只会延长时间、不会改变判断的重复回合

#### 4. 深度优先来自 profile × package × extraction pressure 的交叉

抗消费的关键不是 20 个角色，而是少量系统之间能真实交叉：

- 三条 profile 各自对不同 security package 有天然偏好与天敌
- 同一 objective 在不同 complication 下会改变最优入场线
- 取物后的 carry state 会把“潜入最优线”扭成“撤离最差线”

如果这三层交叉做对，agent 玩家会自然开始写：

- 哪类 seed 适合稳潜
- 哪类 seed 必须强取
- 哪类 side objective 只有某 profile 值得碰

#### 5. 首版就要为二次内容扩张预埋插槽

即使不在首版一次做完，也要让后续最自然的扩张路径已经写进 plan：

- 新 `objective package`
  - 账本、钥卡、活体样本、定时货箱
- 新 `security package`
  - 更偏视觉、听觉、封锁、增援的设施风格
- 新 `complication package`
  - 潮湿地面、蒸汽遮蔽、临时盘点、备用出口失效
- 新 `facility frame`
  - 冷库 / 后厨 / 仓道分别形成不同默认张力

这会让后续内容增长更像“加新组合维度”，而不是机械加关卡。

### First expansion ladder after MVP

如果 MVP 证明骨架成立，优先扩的不是地图尺寸，而是任务语法层：

#### v0.1.x（首轮扩张）

- 保持同一套 strip 规模
- 把官方任务扩到 `2~3` 个
- 补到 `2` 种 objective package
- 补到 `2~3` 种 complication package
- 让三条 profile 都至少拥有一条“擅长局”和一条“吃瘪局”

#### v0.2.x（第二轮扩张）

- 再加 `1~2` 个 facility frame
- 引入更明确的 security personality 区分
- 让 observer / settlement report 开始总结“这局属于哪类渗透型问题”

#### 设计判断

- 先扩任务语法，再扩地图面积。
- 先扩可比较的决策差异，再扩纯内容数量。
- 先扩 agent 可学的结构，再扩装饰层。

### 不该做的“伪 replayability”

- 不靠海量随机 tile 噪声制造重玩
- 不靠超长菜单和海量 gadget 名词制造内容幻觉
- 不靠硬塞数值成长让失败看起来像“早晚能磨过去”

## CLI Presentation Strategy

### 默认目标

- 单屏就让 agent 抓到最重要信息：
  - 我在哪
  - 谁能看到我
  - 最近哪有动静
  - 目标离我多远
  - 现在最值得做的几件事是什么

### 建议单屏结构

1. **Header**
   - 任务名 / turn / 当前 phase / alert / focus / gear / carry state
2. **Facility strip**
   - `2~3` 行侧剖 ASCII 图，显示玩家、可见守卫、摄像头、门、掩体、目标、出口、噪音标记
3. **Threat summary**
   - 当前可见威胁、谁在看哪条线、最近噪音会吸引谁
4. **Known forecast**
   - 只给可信的下回合预测，不做上帝视角全图剧透
5. **Action menu**
   - 上下文相关、数量受控的编号动作
6. **Last consequences**
   - 上回合 `1~3` 条关键后果摘要

### 文本原则

- 默认 compact。
- 关键信息优先于气氛文案。
- 风味文本可以有，但不能把视线、噪音、警戒后果藏进修辞里。
- 颜色可以加分，但不能成为唯一信息载体。

### ASCII / CLI 设计约束

- 不依赖超宽终端。
- 不要求鼠标。
- 不要求自然语言命令解析。
- 允许后续补 `verbose-text` 模式，但 compact 必须先成立。

### Live local observer page

- 游戏开始时，默认在 `localhost` 上自 `8000` 起向上探测空闲端口，并打印最终 observer URL。
- 该页面服务于**人类旁观**：应实时展示当前任务、设施 strip、回合摘要、alert、exposure、噪音热点、目标 / 撤离状态，以及最近关键事件。
- 页面必须和 CLI 共享同一份真实运行态，不允许出现“浏览器里有额外隐藏真相、CLI 里没有”的双轨信息设计。
- 页面应美观、清晰、可读，但不能为了视觉而把关键战术信息藏进只适合鼠标交互的组件里。
- 游戏结束后，运行期 observer server 必须停止并释放端口；最终页面内容要以静态 HTML 结算页形式留存，继续支持复盘与分享。
- 如果本地 observer 启动失败，运行时必须诚实报错或明确降级，不允许静默跳过。

## Agent-Player Affordances

MVP 应明确支持以下 agent-friendly 能力：

- `--seed`
  - 固定任务生成和 patrol 偏移
- `--quick-start`
  - 跳过前置菜单直接开局
- `--profile`
  - 直接预选 profile / loadout
- `--script`
  - 逗号分隔或文件化脚本输入（最终实现二选一即可，但至少要有稳定脚本入口）
- `--verbose-text`
  - 需要时展开叙述
- 默认启用的本地 observer URL 输出
  - 自 `localhost:8000+` 自动探测空闲端口
  - 启动时明确打印可打开的页面地址
- `--no-settlement-report`
  - 关闭 HTML 结算
- 诚实的 scripted-input 语义
  - 输入耗尽时不要伪装成正常通关

### Settlement report 建议内容

- 任务 seed 与 profile
- 关键路线回放
- 何时首次起疑 / 何时进入搜索 / 何时封锁
- 最大 exposure 峰值
- 最大 noise 事件
- 取物回合与撤离回合
- 失败或成功的关键拐点
- 观察页最终快照 / 时间线摘要（确保运行期 observer 与结算页是连续的，而不是两套脱节内容）
- `honest memory prompts`
  - 例：哪种门前最好先观察一拍？
  - 例：哪类高警戒撤离不要再贪 side objective？

## MVP Scope for First Playable

首个 playable 必须克制，目标是先打透“玩感骨架”。

### 内容范围

- `1` 个官方任务 vertical slice
- `1` 套核心目标类型：`潜入 -> 取得目标 -> 撤离`
- `3` 条 profile / loadout
- `1` 套 compact render
- `1` 套运行期本地 HTML observer 页面
- `1` 套 HTML settlement report
- `1` 套 seed / script / quick-start 流程
- `1` 套**可扩张的 mission grammar 骨架**（即使首版只喂很少内容，也要让 facility / security / objective / complication 能分层挂接）

### 地图规模

- `2~3` 行 × `6~8` 列
- `1` 个主目标点
- `2` 个入场点中二选一
- `1~2` 个撤离点
- `1~2` 条可切换路线
- `1` 个可选 side objective

### 安保与系统规模

- `2~3` 类守卫
- `1~2` 类摄像 / 传感器
- `4~6` 个关键交互点
- `3~4` 种 gadget / 环境技巧
- `4` 段 alert 状态

### 明确不上首版的内容

- 多章 campaign
- 多任务连续 carry-over
- 全局数据库式成长
- 大型 inventory / loot 系统
- 复杂近战 combat tree
- 大地图自由探索

## Non-goals / Anti-patterns

- 不做“横着活”或“横着守”的数值换皮。
- 不做 top-down stealth sim 的削弱复制版。
- 不做需要玩家记 `20` 个状态词条的系统堆积。
- 不做“只要一直 wait 就最优”的潜行壳。
- 不做“先把全部敌人敲晕再随便走”的伪潜行。
- 不做靠 hidden dice 狠狠阴人的不可归因失败。
- 不做为了 agent 而牺牲游戏感的 benchmark UI。
- 不做“浏览器观察页才有关键真相、CLI 只是残缺版”的双轨信息作弊。
- 不做一上来就三张图、十种目标、二十种 gadget 的内容膨胀。

## Validation Plan

### 1. 规则层验证

- 视线阻挡、掩体 / 暗区修正正确
- exposure 升降可预测
- noise marker 传播 / 衰减 / 调查逻辑正确
- alert 升级与封锁窗口正确
- 取物后 carry state 与撤离压力确实改变玩法
- 同 seed 可复现

### 2. CLI 层验证

- compact 视图在普通终端宽度下稳定可读
- action menu 数量受控，脚本输入稳定
- `--seed` / `--script` / `--profile` / `--verbose-text` / `--no-settlement-report` 正常
- observer 页面会从 `localhost:8000+` 自动探测空闲端口、正确打印 URL、并在运行中持续更新
- 游戏结束后 observer server 会停止，不再占端口，但最终 HTML 结算页仍可打开、信息不失真
- 脚本耗尽或非法输入时给出诚实反馈
- HTML report 可打开、信息不失真

### 3. Gameplay 层验证

至少要证明这些问题的答案是“是”：

- 玩家是不是在真正读视线和噪音，而不是只看数字血条？
- 高风险动作是不是既诱人又可信，而不是纯坑或纯赚？
- 失败是不是通常能说清“哪一步把局面做坏了”？
- 取物后的撤离，是否比取物前明显更紧张？
- 三条 profile 是否各自存在能打通的自然解法？
- 有没有明显长期支配策略？
- 同一张设施图在不同 package 组合下，是否真的能逼出不同开局与撤离判断，而不是只换皮？
- agent 玩家在连续多局后，是否仍能提出新的、可验证的策略假设，而不是很快进入机械背答案？

### 4. Playtest 口径

建议在实现后至少做以下验证：

- 同一官方任务上，不同 profile 各打若干 seed
- 至少覆盖：
  - 稳健潜行成功
  - 高 alert 强撤成功
  - 因贪支线失败
  - 因错误噪音管理失败
- 增加一组“抗消费”验证：
  - 同一批 agent / 人类 tester 连续玩 `8~12` 局后，是否还会因为 package 组合差异而改变路线、取物时机和撤离判断
  - 是否能从报告里稳定抽出新观察，而不是在第 `3~4` 局后就只剩重复模板
- 记录：
  - 哪些回合没有真实选择
  - 哪些信息摘要看不懂
  - 哪些失败像天降而不是自作
  - 哪些动作几乎没人会按
  - 哪些 memory prompt 容易误导为“伪规律”
  - 哪些 package 组合实际上没有改变打法，只是增加阅读量

### 5. 通过线（Fun Gate）

如果以下任一项长期答不上来，就不应急着 release：

- “这一局最刺激的 turn 是哪一回合？”
- “你为什么输？”
- “下一局你准备验证什么假设？”
- “如果把报告写进 memory，它会不会是诚实且可复测的？”
- “连续十局之后，这游戏还有没有新的局面关系值得学？”

## Implementation Phases / Checklist

### Phase 0 — Design lock

- [x] 阅读 `AGENTS.md`
- [x] 阅读 `docs/agent-coding-standards.md`
- [x] 阅读 `docs/repository-architecture.md`
- [x] 阅读 `docs/references/ai-native-game-design-rules.md`
- [x] 阅读现有计划文档并对齐文风
- [x] 阅读已发布游戏 README，确认产品边界
- [x] 写出这份 heist 立项计划
- [ ] 评审并锁定最终 game id、中文标题、英文摘要
- [ ] 评审并锁定 strip map 是否采用 `2x7`、`2x8` 或 `3x6`

### Phase 1 — Tactical skeleton

- [ ] 建立 mission / map / entity / action 的数据模型
- [ ] 落首版 compact strip render
- [ ] 落单回合结算顺序
- [ ] 落视线、exposure、noise、alert 的核心规则
- [ ] 跑出固定 seed 的 deterministic smoke path

### Phase 2 — Playable vertical slice

- [ ] 加入 `3` 条 profile / loadout
- [ ] 加入取物后 carry state 与撤离压力
- [ ] 加入首版 camera / sensor / responder
- [ ] 加入 `1` 个官方任务内容包
- [ ] 加入 settlement report 与 honest memory prompts
- [ ] 把首版官方任务拆成可扩张的 `facility / security / objective / complication` 语法层，而不是单一硬编码脚本

### Phase 3 — Validation and iteration

- [ ] 补规则层 tests
- [ ] 补 render / scripted-input / report tests
- [ ] 做 profile × seed 的回归试玩
- [ ] 做“连续多局后是否仍有新判断”的抗消费试玩
- [ ] 压支配策略
- [ ] 修正 compact 摘要里多余或缺失的信息
- [ ] 删除那些没有改变打法、只增加阅读量的 package 组合

### Phase 3.5 — Content expansion lock (only after core loop proves itself)

- [ ] 决定首轮扩张优先补 `objective package` 还是 `complication package`
- [ ] 为第 `2~3` 个官方任务写轻量 plan，而不是直接堆内容
- [ ] 锁定 observer / settlement report 里要不要增加“局面类型标签”与“策略差异摘要”

### Phase 4 — Repo integration after gameplay sign-off

- [ ] 在 `games/lobster-cli-heist/` 内整理源码、tests、README、per-game metadata
- [ ] 通过根层 `scripts/test-game.sh lobster-cli-heist`
- [ ] 通过根层 `scripts/build-game.sh lobster-cli-heist`
- [ ] 更新 `catalog/games.json`
- [ ] 评估是否更新 `SKILL.md`、`README.md`、`README.zh-CN.md`
- [ ] 验证真实二进制资产与 release 命名
- [ ] 仅在以上都完成后才考虑 commit / release

## Risks and Open Design Questions

### 主要风险

- **伪潜行风险**
  - 如果最佳策略总是把威胁直接清光，潜行题材就塌了。
- **信息过载风险**
  - 如果单屏放太多 patrol / noise / legend，agent 反而抓不到真正重点。
- **等待最优风险**
  - 如果 `Hide / Wait` 总比推进值钱，节奏会死。
- **取物后不够紧风险**
  - 如果拿到目标后局势几乎不变，heist 的高潮会失败。
- **恢复过强或过弱风险**
  - 太容易洗白会没张力，太难恢复会变成第一次失误就宣判死刑。
- **地图过度扩张风险**
  - 一开始就做太大，会让渲染、脚本和归因全失控。
- **过度继承旧作风险**
  - 如果只是把 roguelike / tower defense 的术语换成潜行皮，玩家会感到不是新游戏。
- **内容消耗过快风险**
  - 如果官方任务只是单脚本流程、profile 差异太弱、取物后局势变化不够大，agent 玩家会在很短时间内背答案，失去继续复盘的动力。

### 开放问题

- 首版是否需要 `Neutralize` 人类守卫，还是只允许处理安全对象？
- `Focus` 是否真有必要作为显式资源，还是应该更多由地形和 alert 隐式表达？
- 取物后的限制应以“更响”为主，还是以“路线受限”为主？
- 守卫下一步 forecast 应公开到什么程度，才能既可学又不失张力？
- 首版官方任务场景应优先选：
  - 冷库
  - 后厨
  - 码头仓道
  哪个最利于侧剖表达和新人理解？
- side objective 是否应首版就上，还是先把主任务彻底打稳？
- 首版 mission grammar 要先锁哪几种 package 组合，才能既撑住 replayability，又不把内容面摊得过大？

## Review Notes

这份计划的核心判断是：

- `横着潜` 应该成立为 **短局潜入 + 取物后撤离** 的张力游戏，而不是潜行题材的数值实验。
- 它的空间表达应选择 **小尺寸侧剖设施**，而不是大地图。
- 它的乐趣核心是 **感知、欺骗、暴露管理和撤离决断**。
- 它的 AI-native 优势在于：
  - 紧凑、可脚本化
  - 失败可归因
  - 复盘价值高
  - memory 友好但诚实

如果后续 review 认可这个方向，编码阶段应优先证明：

- compact render 真的能承载潜行信息
- alert / exposure / noise 的三层风险真的能形成好玩张力
- 取物后的撤离段真的能成为高潮
