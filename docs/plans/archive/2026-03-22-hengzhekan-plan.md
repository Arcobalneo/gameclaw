# Plan: 横着看 (`lobster-cli-sideways-look`)

- **日期**: 2026-03-22
- **工作标题**: 横着看：只给龙虾玩的 CLI 视觉恐怖
- **已锁定 game id**: `lobster-cli-sideways-look`
- **已锁定存档目录**: `~/.gameclaw/sideways-look/`
- **目标技术栈**: TypeScript + Node 24 + `rot.js` + `Ink`
- **作者**: 小龙

---

## 一、Goal

- [x] 先为《横着看》落一份可 review、可执行、能直接指导后续实现的立项 plan。
- [x] 明确它不是“拿终端硬凹恐怖气氛”的概念稿，而是一款真正适合 coding agent 用 bash 工具游玩的**命令式视觉恐怖游戏**。
- [x] 提前锁定三条硬约束：
  - 存档先行
  - CLI 工具化先行
  - 配置层 / 逻辑层解耦先行
- [ ] 在 plan 评审通过后，再进入实现阶段，继续遵循 `plan -> code -> docs -> validate -> commit`。

## 二、Scope

- 本文档只覆盖新游戏方向、架构边界、MVP 范围与实施 checklist，不包含代码实现。
- 首版追求一个**可完整跑通、可存档、可复盘、可向人类讲述怪谈**的 playable vertical slice；但这个 vertical slice 不再是单一 case，而是共享同一套规则骨架的 **4 个短副本入口**。
- 不承诺首版就做大型 campaign、多章节长篇叙事或大量场景包。

## 三、Assumptions

- 继续沿用 `gameclaw` monorepo 与 release-first 的产品边界，但允许这款游戏成为仓库里第一款 **Node / TS 技术栈** 游戏。
- 这里的 `Ink` 指 **React CLI renderer**，不是 inkle 的 narrative scripting language。
- `rot.js` 主要负责：
  - RNG / seed 可复现
  - 事件调度
  - 房间图 / 邻接关系
  - 怪谈出现节奏与升级顺序
- `Ink` 主要负责：
  - 稳定、固定宽度、可代理解析的 TUI 组件
  - 恐怖氛围 ASCII 版式
  - 单次命令执行后的快照渲染
- 这款游戏的**控制表面必须是单步 CLI 指令**，而不是 PTY 挂着不退出的交互式大循环。
- 默认仍应满足 GameClaw 新游戏通用要求：
  - 运行期本地 observer 页面
  - 结束后静态 HTML 结算页

---

## 四、One-line Pitch

> 一款给 coding agent 玩的命令式 CLI 视觉恐怖游戏：你在一座被潮湿怪谈污染的横向观察设施中，通过“横着看”的全景 ASCII 视图辨认异常、记录目击、管理恐惧、逐步揭开真相，并在它真正开始回看你之前逃出去。

---

## 五、为什么这款游戏应该存在于 GameClaw

### 1. 它补的是当前目录里真正缺的一条玩法轴

现有几款游戏已经覆盖了：
- 肉鸽生存
- 塔防布线
- 潜行渗透
- 捕兽养成

《横着看》要补的是：
- **观察 / 识别 / 归档 / 怪谈应对**
- **视觉异常推理**
- **缓慢升级的心理压强**
- **“看见”本身就是风险** 的玩法

### 2. 它天然适合 agent 玩家

它要求 agent 真正练会：
- 从固定格式终端快照中读状态
- 对比场景差异
- 在有限动作里选最有信息价值的一步
- 把“所见所闻”整理成可复盘的观察
- 在风险升级前决定继续深入还是撤离

### 3. 它对人类旁观也成立

这类游戏的强价值不只是一局通关，而是：
- agent 玩完后能向人类复述“看到了什么”
- 复述里不只是数值总结，而有具体怪谈片段
- 最好还能直接复制 ASCII 恐怖图样，增强代入感

也就是说，它的终局产物应同时包含：
- 决策复盘
- 怪谈叙述
- 可直接转述给人的 ASCII 见闻块

---

## 六、核心设计判断

## 6.1 这不是“传统交互式 CLI 游戏”，而是“CLI 工具式回合游戏”

这是本项目最关键的结构判断。

为了真正 agent-friendly，MVP 不应把玩法建立在：
- 一直挂着的 PTY
- 需要持续读 prompt 的全屏 UI
- 复杂按键模式
- 隐式状态变化

而应建立在**单次命令 -> 单次输出 -> 状态落盘**的模型上：

```bash
lobster-cli-sideways-look new --slot 0 --seed 42
lobster-cli-sideways-look load --slot 0
lobster-cli-sideways-look status --slot 0
lobster-cli-sideways-look actions --slot 0
lobster-cli-sideways-look act --slot 0 inspect:left-window
lobster-cli-sideways-look act --slot 0 move:archive-room
lobster-cli-sideways-look recap --slot 0 --format text
```

这意味着：
- 每个命令都是一步 CLI 工具操作
- 每次执行后都能安全退出
- agent 不需要和一个长期交互会话搏斗
- 存档天然成为主状态载体

## 6.2 恐怖感不靠 jump scare，而靠“横向视野 + 重复凝视 + 错误识别”

《横着看》的恐怖玩感应该来自：
- 你在宽幅 ASCII 场景里看到了“不该在那里的东西”
- 它一开始可能只是微小异常
- 你越观察，它越具体
- 你错判、漏判、或把它叫错名字，会让局势更坏
- 某些东西只有在**横向比较相邻 panel** 时才显形

所以“横着看”不是纯标题，而是机制本身：
- 视觉信息是横向展开的
- 关键线索常跨 panel 边界出现
- 恐惧来自“边缘处多出了一格东西”或“本该连续的轮廓断掉了”

## 6.3 游戏核心不是打怪，而是“识别—记录—应对—撤离”

首版核心循环应是：

1. 进入当前区域
2. 读取横向场景快照
3. 识别是否存在异常 / 风险 / 可交互线索
4. 选择一步动作（观察、移动、记录、干预、躲避、撤离）
5. 结算怪谈推进与环境变化
6. 将关键见闻写入 run journal
7. 最终收束为一次“见闻报告”

这让它区别于 heist / roguelike：
- 不是以战斗或 build 为主轴
- 而是以“看清”和“没看清”的代价为主轴

## 6.4 必须像主流 CLI 工具一样可 discover、可 script、可 debug

用户已明确要求：
- `--help` 必须详细
- `--version` 必须稳定
- 各种操作必须是一条单步 CLI 指令

因此首版就要把 CLI 契约当成产品骨架，而不是实现后再补。

---

## 七、产品骨架

## 7.1 已锁定命名

- 中文显示名：`横着看：只给龙虾玩的 CLI 视觉恐怖`
- 已锁定 game id：`lobster-cli-sideways-look`
- 已锁定二进制名：`lobster-cli-sideways-look`
- 已锁定存档目录：`~/.gameclaw/sideways-look/`
- 已锁定命名策略：**继续保留 `lobster-cli-` 前缀**，维持 GameClaw catalog 的一致性。
- 已锁定世界观口径：**继续保留“只给龙虾玩的”统一表述**；但具体文案气质允许更冷、更硬、更恐怖，不必为了统一口径牺牲氛围密度。

## 7.2 存档目录布局（首版建议）

```text
~/.gameclaw/sideways-look/
├── saves/
│   ├── slot-0.json
│   ├── slot-1.json
│   └── slot-2.json
├── journals/
│   └── run-<id>.ndjson
├── reports/
│   ├── latest.html
│   ├── latest.txt
│   └── run-<id>.html
├── observer/
│   ├── daemon.json
│   └── latest-state.json
└── last_slot
```

关键要求：
- 每次会改变状态的命令都必须自动写盘
- 任何一次 `act` 完成后，重新执行 `load/status/actions` 都能恢复同一局面
- 日志与存档分离：
  - `save` 保存当前游戏状态
  - `journal` 保存所见所闻与动作历史

---

## 八、CLI Contract（MVP 必须锁死）

## 8.1 基础命令

```bash
lobster-cli-sideways-look --help
lobster-cli-sideways-look --version
lobster-cli-sideways-look saves
lobster-cli-sideways-look new --slot 0 [--seed 42] [--case sealed-tide-station|backflow-inn|archive-corridor|blind-screen-room]
lobster-cli-sideways-look load --slot 0
lobster-cli-sideways-look status --slot 0
lobster-cli-sideways-look actions --slot 0
lobster-cli-sideways-look act --slot 0 <action-id>
lobster-cli-sideways-look recap --slot 0 [--format text|md|html]
lobster-cli-sideways-look ascii --slot 0 [--latest]
```

## 8.2 设计约束

- `load`：加载存档并打印当前完整快照，不进入交互循环。
- `status`：更偏结构化状态摘要。
- `actions`：只列当前合法动作与编号 / action-id。
- `act`：执行一步并自动保存，输出这一步带来的结果与新的快照。
- `recap`：输出可复盘报告。
- `ascii`：输出最近一次关键怪谈事件的可分享 ASCII 块。
- **已锁定交互策略**：MVP 坚定采用纯单步命令式 CLI；不额外保留常驻交互壳作为 canonical surface。

## 8.3 输出锚点要求

为了让 generic coding agent 可靠解析，命令输出应保持稳定锚点：

```text
STATE:
VIEW:
THREATS:
OBJECTIVE:
ACTIONS:
RESULT:
NEXT:
```

允许气氛文案存在，但不能吞没这些结构锚点。

---

## 九、玩法骨架

## 9.1 核心玩感

这款游戏要让 agent 玩家体验到：
- “我看到了某种不对劲，但还没完全确认。”
- “我得决定是继续看清它，还是先远离它。”
- “我把它记错 / 放任不管 / 看得太久，局势就坏掉了。”
- “我活着回来了，而且我真的能向别人讲出今晚见到的东西。”

## 9.2 基础循环

1. **进入场景 / 房间**
2. **读取横向 ASCII 场景**
3. **识别异常、线索、可互动物**
4. **在 4~6 个动作里选一个**
5. **rot.js 结算环境推进与怪谈事件**
6. **记录 journal**
7. **推进到下一步，直到成功撤离、彻底失控或达成坏结局**

## 9.3 首版建议资源模型

首版只保留少数真正有张力的状态：

- `Focus`
  - 高质量观察 / 精细辨认所需资源
  - 低时更容易漏掉细节或得到模糊描述
- `Nerve`
  - 心理稳定度
  - 被异常正面压迫、长时间注视、误判后下降
- `Dread`
  - 全局威胁轨
  - 怪谈升级、场景污染、出口恶化的主节奏器
- `Evidence`
  - 破局进度
  - 必须累积足够可靠的见闻 / 物件 / 记录，才能触发正确撤离或真结局

关键判断：
- 不要一上来塞 HP、体力、背包、弹药等一堆传统资源。
- 首版重点是“观察质量”和“恐惧升级”。

## 9.4 MVP 动作类别

- `inspect:<target>`
  - 观察某个 panel / 物件 / 异常
  - 高信息收益，但可能让某些东西更清晰地反看你
- `move:<room>`
  - 移动到相邻房间 / 区域
- `record:<phenomenon>`
  - 将确认过的异常写入记录
  - 某些现象只有被正确归档后才会转化为 `Evidence`
- `interact:<object>`
  - 开灯、拉闸、翻抽屉、关百叶窗、播放录音、拿取物件
- `brace`
  - 稳住自己，少量恢复 `Focus` 或减轻 `Nerve` 流失
- `extract`
  - 尝试撤离
  - 只有满足条件时才有意义；否则可能触发坏结局或更强追逐

动作空间必须被主动雕刻：
- 每回合只给 4~6 个真正值得比较的动作
- 不允许菜单噪音

---

## 十、场景结构：为什么必须“横着看”

## 10.1 横向全景是机制，不是装饰

每个场景默认由 `3~4` 个横向 panel 组成：
- 左段
- 中段
- 右段
- 可选更远一段 / 反射段

关键异常的呈现方式优先使用：
- 多出一个本不该存在的轮廓
- 相邻 panel 之间的边缘不连续
- 倒影和实景不一致
- 长宽比不对的“人形”
- 应该静止的东西在下一次 `status` 中微妙偏移

## 10.2 首版场景框架（已按 4 副本入口收紧）

首版不再只做一个官方 case，而是做 **4 个可选短副本**；玩家在 `new` 时可通过 `--case` 直接指定，也可以走默认列表选择。

建议首版 4 个副本如下：

1. `sealed-tide-station` / `封潮观察站`
   - 调性：海边废弃观察站、潮湿窗面、观测台、玻璃反光
   - 强项：最适合做“远端轮廓不对劲”的横向观察恐怖
2. `backflow-inn` / `返潮招待所`
   - 调性：废弃招待所、走廊客房、门缝、床尾、镜面
   - 强项：最适合做“门后 / 床尾 / 房内布局变化”的压迫感
3. `archive-corridor` / `归档长廊`
   - 调性：档案馆、长走廊、柜列、标签错位、资料污染
   - 强项：最适合做“连续 panel 对比”和“记录错误导致局势恶化”
4. `blind-screen-room` / `盲屏机房`
   - 调性：监控机房、屏幕阵列、反射延迟、影像不同步
   - 强项：最适合做“你看的不是现场，而是被回看的画面”这一层恐怖

每个副本首版规模控制为：
- `3~5` 个关键房间
- `1` 条主线撤离目标
- `1~2` 个该副本特有异常包
- `1` 个最能代表该调性的 ASCII witness motif

4 个副本应共享：
- 同一套存档 / journal / recap 结构
- 同一套资源状态（Focus / Nerve / Dread / Evidence）
- 同一套动作骨架
- 同一套异常配置 schema

这样做的好处是：
- 首版就具备更强的内容张力与可选入口
- 但工程上仍然是**一套引擎 + 四个短内容包**，而不是四套分裂游戏

---

## 十一、异常系统（首版真正的内容核心）

和《横着抓》类似，内容层与逻辑层必须彻底解耦。

首版建议把“怪谈”拆成可组合配置：

### 11.1 异常 archetype 配置

每个异常应至少配置：
- `id`
- `display_name`
- `visual_signature`
- `spawn_rules`
- `severity_tier`
- `reaction_rules`
- `resolution_rules`
- `ascii_motif`
- `witness_lines`
- `misread_penalty`

### 11.2 首版异常类型建议

- 轮廓多出一节的窗边人影
- 反射里多一只手的监控屏
- 走廊尽头长度不对的门框
- 不在当前房间却在视野边缘出现的椅背
- 录音带播放时才显形的湿脚印
- 档案柜标签与抽屉内容互换
- 墙面海报里位置变化的头部剪影

### 11.3 关键设计要求

- 异常不能只是 flavor text。
- 每种异常都要真正影响：
  - 风险推进
  - 可用动作
  - `Evidence` 获取
  - `Nerve` / `Dread` 变化
- 某些异常只有“正确记录”才算处理。
- 错误记录、过度凝视、放着不管，后果必须不同。

---

## 十二、配置层 / 逻辑层解耦方案

这是这款游戏的架构核心，必须像《横着抓》一样把后续内容扩展成本压低。

## 12.1 推荐目录

```text
games/lobster-cli-sideways-look/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli/
│   ├── engine/
│   ├── render/
│   ├── observer/
│   └── report/
├── content/
│   ├── cases/
│   ├── rooms/
│   ├── anomalies/
│   ├── props/
│   ├── event-packs/
│   ├── text/
│   └── ascii/
├── tests/
├── scripts/
└── README.md
```

## 12.2 逻辑层职责

逻辑层只负责：
- 读取存档与配置
- 生成当前合法动作
- 结算一步动作
- 用 rot.js 推进事件调度
- 产出结构化状态
- 调用 Ink 渲染
- 写 journal / report / observer state

## 12.3 配置层职责

配置层只负责：
- case 的房间拓扑
- room 的 panel 结构与初始物件
- 异常定义与出现条件
- 文案模板
- ASCII motif
- 结局条件
- observer / recap 要用的文本素材

**新增怪谈内容的目标流程**应当是：
- 先加 JSON / JSON5 / YAML 配置
- 只在必要时改引擎
- 不让“加一只新怪谈”变成“重写一块系统”

---

## 十三、技术栈判断

## 13.1 rot.js 的角色

`rot.js` 在本项目里不是拿来做传统 roguelike 地图，而是拿来做：
- seed 控制
- 事件调度器
- 房间邻接 / 图结构辅助
- FOV / 可见性工具（如果需要）
- 加权随机与节奏推进

核心目标：**让怪谈出现与升级是可控、可复现、可扩展的。**

## 13.2 Ink 的角色

`Ink` 在本项目里不应被当成“做一个长期驻留的炫酷 TUI app”来使用。

更合理的用法是：
- 将每次命令执行后的状态用固定宽度组件渲染为字符串
- 保持 deterministic output
- 不依赖 cursor move / spinner / 复杂交互模式
- 用组件化方式管理：
  - panoramic view
  - threat cards
  - action list
  - witness block
  - ASCII horror frames

也就是说，**Ink 用来做稳定排版，不用来做 agent 不友好的交互魔术。**

## 13.3 打包与 release 风险

因为这会是仓库里第一款 Node / TS 游戏，首版 plan 必须承认：
- 当前根层 `scripts/test-game.sh` / `scripts/build-game.sh` 仍是 Python/uv 假设
- 新游戏接入前，需要先把 repo-level build/test entrypoint 设计成**按游戏 runtime 分发**，而不是继续把所有游戏假设成 Python 包

建议路线：
- 游戏目录自带 `package.json`、本地 test/build 命令
- 根脚本后续升级为：
  - 读取 game metadata / runtime 类型
  - Python 走 uv
  - Node 走 npm/pnpm/bun 中选定的一条稳定链路

这应写进后续实现 phase，而不是临时硬拗。

---

## 十四、Observer 与结算页

## 14.1 为什么这款游戏仍然要 observer

虽然它是单步 CLI 命令式游戏，但仍应保留 GameClaw 的 observer 传统：
- 人类可以实时旁观 agent 这局看到了什么
- observer 页面可展示：
  - 当前房间
  - 横向 ASCII 视图
  - 最近一次异常
  - `Dread` / `Nerve` / `Evidence`
  - 最近动作日志

## 14.2 关键实现判断：observer 需要轻量 daemon

因为命令不是常驻进程，所以 observer 不能绑在一次命令生命周期里。

建议方案：
- `new` / `load` 时尝试拉起一个轻量 observer daemon
- daemon 只做只读展示：盯状态文件 / journal 文件
- `act` 每执行一步，就把最新状态写到 observer 共享文件
- 结局到达时：
  - daemon 停止
  - 生成静态 `report.html`

如果 daemon 启动失败：
- 必须诚实提示
- 游戏主链路仍可继续

## 14.3 结算产物

至少输出三种：
- `report.html`
- `report.txt`
- 可直接粘贴给人的 ASCII witness block

首版理想效果：
- agent 玩完后，直接执行 `recap` 或 `ascii`
- 就能把“今晚见到了什么”以很强氛围感回报给人类

---

## 十五、Recap / Agent-to-human 输出设计

这款游戏的一个关键成功判据是：
**agent 玩完后，是否自然会向人类讲鬼故事。**

所以 recap 不能只有：
- seed
- turn 数
- 是否通关

还必须有：
- 关键见闻时间线
- 最危险的一次误判
- 哪个异常第一次真正让局势恶化
- 适合转述的 witness 段落
- 至少一段 ASCII 恐怖图样

### 首版建议 recap 结构

```text
CASE:
OUTCOME:
KEY SIGHTINGS:
TURNING POINT:
WHAT LOOKED BACK:
ASCII WITNESS:
MEMORY PROMPTS:
```

### Memory prompt 要求

必须诚实，不伪装成真理，例如：
- “本局里，档案室的镜面反射异常只在连续两次 inspect 后显形；下次可验证这是否和房间湿度事件有关。”
- “你在 Dread 已高时仍继续观察右端窗面，直接导致 Nerve 崩掉；下次可测试先转移房间是否更稳。”

---

## 十六、MVP 范围

首个 playable 只做以下内容：

- `4` 个可选短副本：
  - `sealed-tide-station` / `封潮观察站`
  - `backflow-inn` / `返潮招待所`
  - `archive-corridor` / `归档长廊`
  - `blind-screen-room` / `盲屏机房`
- 每个副本 `3~5` 个关键房间，总体控制在可维护范围内
- `12~18` 个异常 archetype，其中：
  - `6~8` 个共享基础异常
  - 每个副本 `1~3` 个专属异常
- `3` 个主要工具 / 干预手段
- `3` 条主结局类型（成功撤离 / 带错记录逃离 / 失控），允许不同副本在 flavor 上分化
- `1` 套 save/load 流程
- `1` 套 observer daemon + 静态 report
- `1` 套 recap / ascii 输出
- 完整 `--help` / `--version`
- 完整单步命令式 CLI 回路
- `new --case ...` 的副本选择入口

首版明确不上：
- 多章节 campaign
- 自然语言输入解析
- 大型 inventory
- 音效系统
- 全屏实时 action 模式
- 大量随机地图

---

## 十七、Validation Plan

## 17.1 CLI 层

必须验证：
- `--help` 信息完整
- `--version` 稳定
- `new/load/status/actions/act/recap` 全都可以单条命令独立使用
- 每个变更状态的命令都会自动落盘
- 非法 action 会给出诚实错误

## 17.2 Save / reload 层

必须验证：
- `act` 后立即 kill 进程，再次 `load`，状态一致
- `last_slot` 可用
- journal 与 save 同步推进

## 17.3 Gameplay 层

至少要证明：
- 恐怖感不是纯修辞，而是和“读错/漏看/看太久”的机制后果相关
- 当前动作列表始终可比较，不会沦为机械点最优项
- 连续几局后，agent 真的会形成新的观察假设，而不是只背固定答案
- recap 输出真的能让人读出一局“见闻故事”

## 17.4 Config extensibility

必须验证：
- 新增一个异常 archetype 时，只需要加配置与极少模板代码
- 新增一个 room/case 时，不需要改核心结算器

## 17.5 Observer / report

必须验证：
- observer 能从 `localhost:8000+` 自动探测端口
- daemon 失效时命令能诚实降级
- 结束后静态 HTML 确实可打开
- `ascii` 命令能稳定产出可复制字符画

---

## 十八、Implementation Phases / Checklist

## Phase 0 — Design lock

- [x] 阅读 `AGENTS.md`
- [x] 阅读 `docs/references/ai-native-game-design-rules.md`
- [x] 阅读现有 heist / tamer plan，对齐计划文风与 repo 约束
- [x] 写出本 plan
- [x] 锁定 game id / 存档目录英文名
- [x] 锁定继续使用 `lobster-cli-` 前缀
- [x] 锁定继续保留“只给龙虾玩的”统一口径
- [x] 锁定 MVP 坚定采用纯单步命令式 CLI
- [x] 锁定首版采用 `4` 个可选短副本入口，而非单一 case
- [ ] 锁定四个副本的最终中英文显示名与 case id
- [ ] 锁定每个副本的房间数量上限与专属异常数上限

## Phase 1 — Runtime skeleton

- [ ] 建立 `games/lobster-cli-sideways-look/` 目录骨架
- [ ] 建立 `package.json` / `tsconfig.json` / test runner
- [ ] 建立 CLI parser
- [ ] 建立 save path 与 slot 管理
- [ ] 建立 `status/actions/act` 的结构化输出骨架

## Phase 2 — Core engine

- [ ] 用 rot.js 建立 case graph、事件调度器与 seed 复现
- [ ] 实现核心状态模型（Focus / Nerve / Dread / Evidence）
- [ ] 实现动作解析与一步结算
- [ ] 实现 journal 写入
- [ ] 实现 autosave

## Phase 3 — Content grammar + render

- [ ] 定义 room / anomaly / text / ascii 配置 schema
- [ ] 建立 Ink 渲染组件
- [ ] 跑通首版 panoramic ASCII view
- [ ] 跑通 `封潮观察站 / 返潮招待所 / 归档长廊 / 盲屏机房` 四个短副本的最小内容包
- [ ] 为异常加入 witness text 与 ascii motif
- [ ] 验证共享异常与副本专属异常可以只靠配置挂接，而不需要改核心结算器

## Phase 4 — Observer + recap

- [ ] 建 observer daemon
- [ ] 建 live observer HTML
- [ ] 建 static report 输出
- [ ] 建 `recap --format text|html`
- [ ] 建 `ascii --latest`

## Phase 5 — Repo integration

- [ ] 为 mixed-runtime monorepo 设计 root build/test 分发方式
- [ ] 接入 `catalog/games.json`
- [ ] 接入根 `README.md` / `README.zh-CN.md` / `SKILL.md`
- [ ] 接入 release 产物命名
- [ ] 验证 Linux / macOS 构建路线

## Phase 6 — Real playtest

- [ ] 真实用 bash 单步命令分别打通至少 `2` 个不同副本
- [ ] 至少在另外 `1` 个副本中打出一条清晰的失败链路
- [ ] 验证 save/load/continue
- [ ] 验证 observer / report
- [ ] 验证 agent 视角 recap 的可读性
- [ ] 验证至少一条“看错导致翻车”的失败链路是清晰可归因的
- [ ] 验证 `ascii --latest` 对不同副本都能产出风格明确、可转述的 witness block

---

## 十九、主要风险

### 1. Ink 很容易把项目带向“炫酷但不 agent-friendly 的交互式 TUI”

必须持续克制：
- Ink 负责排版
- CLI 契约负责交互
- 不能反过来

### 2. Node 技术栈接入会触发 repo build/test 机制调整

这不是坏事，但必须正面设计，不能临时 patch。

### 3. 恐怖感可能只停留在文案层

如果异常不真正改变状态、动作空间和后果，这款游戏会退化成“看描写段子”。

### 4. 视觉玩法可能退化成纯找不同

如果只靠差异检测，没有“记录 / 误判 / 处理 / 撤离”链路，游戏深度会很薄。

### 5. 单步命令模型可能损失沉浸感

因此必须用：
- witness text
- ASCII motif
- recap
- observer

把气氛补回来，但不能反向破坏工具化骨架。

---

## 二十、已锁定决策 & 下一轮细化重点

本轮评审已锁定：

1. **命名策略已锁定**
   - 保留 `lobster-cli-` 前缀
   - 当前 game id 采用 `lobster-cli-sideways-look`

2. **首版内容结构已锁定**
   - 不做单一 case
   - 首版直接做 `4` 个可选短副本入口

3. **控制表面已锁定**
   - MVP 坚定采用纯单步命令式 CLI
   - 不把常驻交互壳作为 canonical surface

4. **catalog 世界观已锁定**
   - 继续保留“只给龙虾玩的”统一口径
   - 但允许文案整体更冷、更硬、更恐怖

下一轮需要细化的重点变成：

- 四个副本各自的房间拓扑与核心异常包
- 共享异常与副本专属异常的比例
- `record` / `inspect` / `extract` 三者的失败后果差异
- observer daemon 与单步命令模式之间的状态同步方案
- mixed-runtime monorepo 的 build/test 接线方式

---

## 二十一、结论

这份 plan 当前已经收紧到一个明确方向：

- 《横着看》会被做成一款**命令式、存档驱动、可脚本化、可复盘**的 CLI 视觉恐怖游戏。
- `rot.js` 负责事件和空间节奏，`Ink` 负责稳定而恐怖的 TUI 排版。
- 配置层和逻辑层必须像《横着抓》那样彻底解耦，否则后续怪谈扩展会很快失控。
- 首版不做单一 case，而是做 **4 个可选短副本入口**，在共享规则骨架上提供不同恐怖调性。
- 它真正的差异化价值，不只是“恐怖题材”，而是：
  - 给 agent 一套可用 bash 玩下去的视觉观察玩法
  - 并在游戏结束后，天然产出一份能讲给人听的怪谈见闻报告

下一步不再讨论抽象方向，而是把四个副本的内容 grammar、CLI 命令契约细节，以及 mixed-runtime monorepo 的工程接线收紧到可直接开工。