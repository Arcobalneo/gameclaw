# 2026-03-13 `lobster-cli-tower-defense` 新游戏立项计划

## Goal

为 `gameclaw` monorepo 规划下一个新游戏，暂定：

- game id：`lobster-cli-tower-defense`
- working title：`横着守：只给龙虾玩的 CLI 塔防`

目标不是复制现有肉鸽，而是在**完全继承《横着活：只给龙虾玩的 CLI 肉鸽》世界观、气质与 agent-first 设计原则**的前提下，做一款：

- 纯 CLI
- 低噪音但高信息密度
- 面向 agent 玩家可稳定理解与操作
- 具有显著策略深度与 build / 阵线差异
- 可走完整流程：`plan -> code -> verify -> playtest -> release`

这份文档只做**立项与实现前规划**，不包含游戏代码实现。

## Current Repo Context

基于当前仓库现状，本项目的设计与落地必须服从这些事实：

- `gameclaw` 已是一个分层明确的分发 monorepo，根层负责 skill、catalog、docs、release、统一 build/test 入口。
- 当前 catalog 里只有一个已上架游戏：`lobster-cli-roguelike`。
- 现有龙虾游戏已经确立了一套非常清晰的产品人格：
  - 龙虾视角求生
  - 紧凑 CLI 文本
  - 可脚本化输入
  - 鼓励玩家把经验写进自己的 memory
  - 默认生成 HTML settlement report
  - 通过 monorepo root release 流程发二进制
- 用户反馈明确表扬了：世界观、文案气味、memory 提示、结算页、分发边界清晰。
- 用户反馈也明确指出了现有痛点：单局中后段重复感、事件差异不足、策略深度与谱系分化仍可继续拉开。

因此，这个新项目不应该背离龙虾世界，而应该把既有优势保留下来，并把“更强策略深度、更低重复感、更鲜明局内身份差异”当成首要价值。

## Scope

本计划覆盖的是**未来完整立项到发布的工作蓝图**，主要包含：

- 新游戏的核心玩法方向
- 从 Arknights-like 塔防思想到龙虾世界的原创映射
- 预计的技术结构与 repo 落点
- 预计的验证、试玩、打包、发布路径
- 后续编码阶段的 checklist

本计划阶段**不做**：

- 新游戏代码
- 对 `lobster-cli-roguelike` 现有实现的改动
- `catalog/games.json` 的实际增改
- `SKILL.md` / `README.md` / workflow 的实际修改
- git commit

## Design Authority Alignment

本项目必须明确继承 `docs/references/ai-native-game-design-rules.md` 的方向：

- 游戏性优先于工具性
- 先为 agent 玩家设计，再考虑旁观者
- 关键状态、动作与后果必须稳定清楚
- 动作空间必须被主动雕刻，不能靠堆很多按钮假装深度
- 随机性必须制造变化，但失败仍应可归因
- failure / settlement 必须能产出下一局有价值的 memory 线索
- token 节省不能以牺牲决策质量为代价
- 长流程必须持续给出阶段感

这意味着：

- 新塔防不能做成“纯实时 + 纯手速”的 CLI 壳子
- 必须优先设计成 agent 易读、可暂停思考、结果可复盘的**脉冲式 / 回合化塔防**
- 必须从第一版就考虑 memory 提示、阶段推进感、失败归因和 compact render

## Assumptions

- 新游戏会继续放在 `games/<game-id>/` 下，并保持 monorepo layering。
- 第一版大概率继续使用 Python 实现，以最大化复用现有 build/test/release 经验；如后续有强理由改语言，再单独立计划。
- 第一版应尽量复用已有 distribution philosophy：
  - source 留在 monorepo
  - 玩家优先下载 GitHub Releases 二进制
  - Linux x86_64 / macOS arm64 仍是默认目标平台
- 世界观必须与 `lobster-cli-roguelike` 连续，而不是另起炉灶：厨房、拖网、塑料、人类设施、暗流、章鱼、电鳗、归海意象都可以继续沿用。
- Arknights-like 仅可借鉴其**核心结构思想**，不能直接照搬术语、角色表达、文案口吻或设定命名。
- 新游戏依然要保持 GameClaw 的 honesty：
  - 二进制只降低 casual source visibility
  - 不宣称不可逆向

## Proposed Game Fantasy

玩家不再只是“一只试图活着回海的龙虾”，而是变成：

- 在同一世界观中，负责守住一条条**归海撤离线 / 排水闸通道 / 海床缝口**的龙虾指挥者
- 需要在有限潮势、有限壳兵与复杂敌潮中，组织同族、诱饵、工事与突变能力
- 把被人类世界逼到角落里的龙虾群，护送回真正的海

一句话版本：

> 这不是“龙虾版传统塔防皮肤”，而是“龙虾世界里，为了让更多龙虾横着活回海，你必须把地形、潮势、壳兵与敌潮全部读懂”的 AI-native CLI 塔防。

## Proposed Game Loop

建议的单局主循环如下：

1. **选指挥谱系 / doctrine**
   - 延续现有三大谱系，但改造成塔防里的指挥学派与 roster 偏向。

2. **读取关卡简报**
   - 展示紧凑 ASCII 地图
   - 展示敌潮入口 / 归海出口 / 可部署格 / 特殊地形
   - 展示本关可容忍漏怪数、初始潮令、已携带 roster、关卡特殊机制

3. **布防阶段**
   - 玩家花费 `潮令` 部署单位 / 陷阱 / 一次性工具
   - 可查看敌潮预告与关键精英提示

4. **脉冲推进阶段**
   - 游戏按离散 pulse 推进，而不是要求实时连打
   - 每个 pulse 中：敌人前进、单位自动攻击/阻挡、技能充能、地形触发
   - 在固定 intervention window 允许玩家执行 1 次关键操作

5. **战术介入**
   - 可能操作包括：部署、撤回、换线、触发技能、启用闸门/诱饵/垃圾流工具
   - 重点是“少而关键”的动作，而不是大量细碎命令

6. **波次 / 关卡结算**
   - 结算漏怪、资源回收、关键击杀、build 表现
   - 输出诚实的本局观察草稿，鼓励写入 memory

7. **关间成长**
   - 从若干突变 / 壳工事 / 新 roster 里选一个
   - 让 run 内 build 逐渐成型，而不是每关都像重新开始

8. **多关后总收尾**
   - 生成 HTML settlement report
   - 提示本局观察、阵容、关键失败点与下一局可验证假设

## Commander / Build Direction Guess

为了继承现有肉鸽里已经成立的三条身份线，建议保留三种核心指挥 doctrine：

### 1. `沟壑碎壳者` → 重甲阻断 / 正面压制

- 强项：堵口、硬吃、反冲、近战压线
- 典型单位：重壳前排、夹击守卫、硬壳撞闸工
- 风格：更容易稳住前线，但展开慢、潮令吃紧

### 2. `触须预言家` → 预判布防 / 视野控制 / 精准处理

- 强项：提前读潮、陷阱协同、远程点杀、路线操控
- 典型单位：触须哨兵、潮纹观测手、诱导型部署位
- 风格：更依赖信息差与站位质量，而不是纯硬度

### 3. `脱壳赌徒` → 机动 redeploy / 高波动爆发 / 以壳换节奏

- 强项：快速撤回再部署、一次性强解、临时诱饵、风险反打
- 典型单位：脱壳诱饵、侧冲突击手、借壳工兵
- 风格：操作张力高，上限高，但更容易翻车

这样既延续现有世界与人格，也能天然拉开塔防里的阵容构筑差异。

## Mapping: Arknights-like Mechanics into Lobster World

以下只借鉴“结构思想”，全部转换成 GameClaw / lobster 世界中的原创表达：

### 1. Operators / Units → 龙虾壳兵 / 海床工事 / 临时同盟体

- 不直接做“职业名照搬”
- 改成龙虾世界可自洽的单位类型，例如：
  - `碎壳前排`
  - `剪网手`
  - `触须哨兵`
  - `脱壳诱饵`
  - `泥沙伏击位`
  - `藻披隐匿位`

### 2. Deployment Cost → `潮令` / `潮势预算`

- 不用现成术语
- 表达为潮水窗口里你能调动多少横移动员能力
- 资源随 pulse 缓慢恢复，形成“什么时候下人、什么时候攒资源”的张力

### 3. Lanes / Tiles → 排水通道 / 礁口 / 海床节点

- 地图不是抽象棋盘，而是：
  - 金属盆边
  - 排水孔岔路
  - 塑料环卡口
  - 暗流裂隙
  - 归海闸口前沿
- 节点要有明确地形身份，帮助 agent 快速理解部署限制

### 4. Block / Hold → `拦口` / `卡位`

- 重甲单位负责把敌潮卡在狭窄节点
- 轻型单位则偏向侧切、收尾、诱导或短时截流

### 5. Skills → `潮技` / `突变技`

- 技能不强调华丽，而强调可读的战术价值
- 例如：短时加壳、强制横移、诱发垃圾流、临时闭鳃、脱壳脱离、触须预警

### 6. Redeploy / Retreat → `撤回回穴` / `退潮再编`

- 允许有节奏地回收单位，但要有冷却
- 特别适合 `脱壳赌徒` doctrine 做高风险机动解法

### 7. Base HP / Life Points → `归海线完整度` / `漏网数`

- 被敌人突破不一定立刻死局，但会降低撤离线完整度
- 这样能保留塔防里“可以漏一点，但不能一直漏”的决策张力

### 8. Enemy Waves → `敌潮批次`

- 每批敌潮都应给出紧凑预告：
  - 数量
  - 路线
  - 精英威胁
  - 特殊词条
- 保证失败可归因，而不是“突然就爆了”

### 9. Stage Hazards → 人类世界 / 海洋污染 / 生物威胁

- 可转化的原创 hazard：
  - `抽水泵脉冲`
  - `锅水回涌`
  - `塑料回旋流`
  - `电鳗过载区`
  - `章鱼缠线口`

### 10. Roster Growth / Roguelite Layer → `突变` / `壳工事` / `黑市捡物`

- 这是新游戏和现有肉鸽最重要的连接点之一
- 新塔防不应只做单关解谜，而应保留 run 内 build 成型感

## Content Direction Guess

建议第一版内容不要一上来做得过大，而是先做一个**深度优先的小内容面**：

- 3 个指挥谱系
- 8~12 种基础可部署单位 / 工事
- 10~15 种敌人
- 4~6 张关卡地图
- 2~3 类 run 内成长来源
- 1 套 compact 模式文本
- 1 套 HTML 结算页

重点不是“数量看起来多”，而是：

- 每个单位真的有清晰分工
- 每张地图真的能改变布防逻辑
- 每类敌潮真的要求不同应对
- 每条 doctrine 都有自然偏好的解法，但不形成明显支配策略

## CLI Interaction Shape Guess

为了兼顾纯 CLI 与高策略深度，建议第一版采用：

- 默认 compact 输出
- 小型 ASCII 地图
- 关键摘要优先
- 明确 phase 切分
- 明确 intervention window
- 明确本 pulse 发生了什么

建议的单屏结构类似：

1. 关卡标题 / pulse / 完整度 / 潮令
2. 小地图
3. 我方部署摘要
4. 下一批敌潮摘要
5. 可执行动作列表

避免做法：

- 每个 pulse 输出过长叙述
- 同时给过多操作按钮
- 把关键状态藏在长文案里

## Memory / Settlement Direction

必须继承现有龙虾游戏的 memory-first 优势，但继续保持“诚实观察，不伪装真理”的口径。

建议保留：

- 每关后的 `本局观察`
- build 观察
- 失败归因提示
- HTML settlement report

建议新增的塔防专属观察维度：

- 哪张图的哪个卡口最容易崩
- 哪类敌潮更怕哪种单位 / 地形 / 技能节奏
- 哪条 doctrine 在什么关型更舒服
- 哪次撤回 / 再部署是翻盘点

## Technical / File Layout Guess

后续编码阶段，建议优先落成以下结构：

- `games/lobster-cli-tower-defense/README.md`
- `games/lobster-cli-tower-defense/pyproject.toml`
- `games/lobster-cli-tower-defense/main.py`
- `games/lobster-cli-tower-defense/game_catalog/lobster-cli-tower-defense.json`
- `games/lobster-cli-tower-defense/scripts/build-native.sh`
- `games/lobster-cli-tower-defense/lobster_cli_tower_defense/__init__.py`
- `games/lobster-cli-tower-defense/lobster_cli_tower_defense/game.py`
- `games/lobster-cli-tower-defense/lobster_cli_tower_defense/content.py`
- `games/lobster-cli-tower-defense/lobster_cli_tower_defense/render.py`
- `games/lobster-cli-tower-defense/lobster_cli_tower_defense/report.py`
- `games/lobster-cli-tower-defense/tests/test_game.py`
- `games/lobster-cli-tower-defense/tests/test_render.py`
- `games/lobster-cli-tower-defense/tests/test_report.py`

后续 root 侧预计会涉及：

- `catalog/games.json`
- `SKILL.md`
- `README.md`
- `README.zh-CN.md`
- `CHANGELOG.md`

如能复用 root 现有稳定入口，则尽量**不改**：

- `scripts/build-game.sh`
- `scripts/test-game.sh`

## Validation Plan

后续实现阶段的验证建议按四层推进：

### 1. 规则层

- 地图与路径解析正确
- 部署限制正确
- 单位阻挡 / 攻击 / 技能 / 撤回规则正确
- 敌潮推进与地形触发正确
- 随机种子可复现

### 2. CLI 层

- `--quick-start` / `--seed` / `--script` / `--verbose-text` / `--no-settlement-report` 等参数可用
- 脚本化输入耗尽时诚实中止，不抛无意义异常
- compact render 可在 agent 语境下稳定读懂

### 3. Gameplay 层

- 三条 doctrine 至少各有一条能打得舒服的 build 线
- 不出现明显长期支配策略
- 高风险战术值得赌，但失败也可归因
- 单局中后段不会快速退化为重复按同一套命令

### 4. Artifact 层

- `./scripts/test-game.sh lobster-cli-tower-defense`
- `./scripts/build-game.sh lobster-cli-tower-defense`
- 对真实编译产物做 scripted smoke test
- 检查 release archive 命名与 catalog 元数据一致

## Playtest Plan

在 verify 之后、release 之前，单独做一轮 playtest：

- 用 3 条 doctrine 各试玩若干局
- 覆盖至少几种不同地图 / 种子
- 记录：
  - 哪些部署位总是必选
  - 哪些单位基本没人想拿
  - 哪些敌潮突然且不可归因
  - 哪些关卡摘要太长或太短
  - 哪些 memory 提示有误导性

playtest 的目标不是“证明能通关”，而是确认它是否**真的好玩、读得懂、值得复盘**。

## Release Plan

如果编码与验证阶段顺利，建议沿用现有 monorepo release 路径：

1. 在 `games/lobster-cli-tower-defense/` 完成源码、tests、docs、per-game metadata
2. 更新 root catalog 与 player-facing docs
3. 本地跑测试
4. 本地构建真实二进制资产并 smoke test
5. 再接入 / 复用根层 GitHub Release 流程

建议的资产名：

- `lobster-cli-tower-defense-linux-x86_64.tar.gz`
- `lobster-cli-tower-defense-darwin-arm64.tar.gz`

发布口径仍应保持诚实：

- 二进制降低 casual source visibility
- 不承诺绝对防逆向

## Main Risks

- **IP 气味风险**：如果机制映射不够原创，会显得像“换皮复述”。
- **CLI 可读性风险**：塔防天然状态量更大，若摘要设计不够好，会迅速失控。
- **伪深度风险**：单位和地图数量看似多，但真实选择不够，反而重复。
- **支配策略风险**：某套阵容或某类开局长期碾压，破坏重玩价值。
- **实现复杂度风险**：如果一开始就做太完整，编码阶段容易膨胀。
- **节奏风险**：若 pulse 太碎，玩家会觉得烦；若跳太大，又会失去介入感。
- **世界观断裂风险**：如果单位与敌人命名脱离原作语感，会失去“这就是同一个龙虾世界”的连续性。

## Recommended Implementation Order

后续阶段建议按这个顺序进入编码：

1. 先锁定最小可玩的战斗骨架
2. 再锁地图表达与 compact render
3. 再锁 3 条 doctrine 与首批单位
4. 再补敌潮与关卡内容
5. 再接 memory / settlement / HTML report
6. 最后补 catalog、docs、release 对接

## Checklist

- [x] 阅读 `AGENTS.md`
- [x] 阅读 `docs/references/ai-native-game-design-rules.md`
- [x] 阅读 `catalog/games.json`
- [x] 阅读 `games/lobster-cli-roguelike/README.md`
- [x] 阅读 `lobster-cli-roguelike` 核心实现与相关 docs
- [x] 阅读 `CHANGELOG.md`
- [x] 阅读 `docs/forge-feedback-log.md`
- [x] 基于当前仓库状态整理新游戏方向
- [x] 写立项计划文档到 `docs/plans/`
- [ ] 确认最终 game id / 中英文标题 / 对外 summary
- [ ] 确认塔防是 pulse-based CLI 而非实时 CLI
- [ ] 确认最小地图规格、tile 类型与单屏渲染格式
- [ ] 确认 3 条 doctrine 的被动、单位偏向与 build 身份
- [ ] 确认首批单位 roster
- [ ] 确认首批敌潮 roster
- [ ] 确认关卡 progression 与 run 内成长结构
- [ ] 搭建 `games/lobster-cli-tower-defense/` 目录骨架
- [ ] 实现基础模拟与 CLI loop
- [ ] 实现 scripted test 覆盖
- [ ] 实现 HTML settlement report
- [ ] 更新 catalog / SKILL / README / CHANGELOG
- [ ] 运行 verify
- [ ] 做一轮 playtest
- [ ] 准备 release 资产
- [ ] review diff
- [ ] git commit

