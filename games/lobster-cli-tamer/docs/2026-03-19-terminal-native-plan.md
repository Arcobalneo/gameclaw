# 2026-03-19 lobster-cli-tamer terminal-native 优化改造计划

## 目标定义（对齐版）

这里的 **terminal native** 明确指：

> 任意通用 coding agent（如 OpenClaw、Claude Code、Codex）
> 在拿到 `lobster-cli-tamer` 的发布包体后，
> 只依赖它原生具备的终端能力：
> - 启动命令
> - 分配 PTY
> - 读取 stdout
> - 写入 stdin
>
> 就能像使用主流 CLI 工具一样，
> **稳定开始、持续交互、完成游玩**。

### 不属于本计划的目标

以下方向不是这份 plan 的主目标：

- 专用 JSON RPC / benchmark harness
- 只为单一 agent 定制的适配器
- 需要额外 SDK / Browser / GUI 才能玩
- 彻底重写为另一门语言（如 TS）

这份计划只关心一件事：

**让当前发布包体本身，成为对通用 terminal agent 更顺手的 CLI 游戏。**

---

## 现状判断

`lobster-cli-tamer` 当前已经具备一部分 terminal-native 基础：

- 使用标准 `input()` 行输入，不是 raw char / curses 模式
- 菜单大多是编号选择
- 二进制包下载后即可运行
- 游戏循环是清晰的状态机（主菜单 / 探索 / 深渊 / 工坊 / 存档）

但仍然存在明显阻碍，让通用 coding agent 不够“像用 gh CLI 那样顺手”：

1. 输出噪音偏多
   - banner / 装饰线 / 颜色 / 叙事文本较多
2. 状态标签不够硬
   - agent 需要靠上下文猜“现在在哪个菜单”
3. prompt 结构不统一
   - 有的输入是编号，有的是名字，有的是确认，有的是回车继续
4. 隐式分支较多
   - 新档命名、升级换技、空队伍、撤退结算等
5. stdout 更偏人类阅读，不偏通用 agent 解析
6. 当前没有一个明确的“agent/terminal-native 模式”来降低歧义

---

## 设计原则

### 原则 1：保持人类可玩性，不把游戏做成机器协议壳子

目标是让它**像优秀 CLI 工具一样**，而不是像 API 调试器。

### 原则 2：优先增强现有 Python CLI，不做无必要重写

先在当前实现上把 terminal-native 体验做对，再评估是否需要更大重构。

### 原则 3：让“通用 PTY 交互”成为一等公民

目标不是让 agent 借助 expect 脚本才勉强可玩，
而是让普通 terminal agent 直接读写就能稳定推进。

### 原则 4：固定格式 > 华丽文案

对通用 agent 来说：

- 清晰
- 一致
- 可预测

比“更有味道”的自然语言重要。

---

## 改造总方向

将 `lobster-cli-tamer` 增强为双模式：

1. **默认模式（human-friendly）**
   - 保留当前面向人类玩家的体验
2. **terminal-native 模式（agent-friendly）**
   - 关闭大部分噪音输出
   - 强化状态标识
   - 统一 prompt 结构
   - 让通用 coding agent 能稳定游玩

推荐入口形式：

```bash
./lobster-cli-tamer --terminal-native
```

可选补充：

```bash
./lobster-cli-tamer --terminal-native --no-color --save-slot 0
```

---

## Checklist

## Phase 0：定义终端协议（先做）

- [ ] 明确定义 `--terminal-native` 模式的行为边界
- [ ] 约定所有关键状态的固定标记文本
- [ ] 约定所有菜单/选择界面的统一输出格式
- [ ] 约定所有确认提示的统一输出格式
- [ ] 约定异常状态（空队伍、EOF、非法输入）的统一反馈格式

### 预期产物

一份可直接写进 README / docs 的终端交互约定，例如：

- `STATE: MAIN_MENU`
- `STATE: WORLD_MENU`
- `STATE: BATTLE_MENU`
- `STATE: ABYSS_DECISION`
- `ACTIONS: 1|2|3|q`
- `PROMPT: INPUT_ACTION`

目标不是 JSON，而是**终端文本里的稳定锚点**。

---

## Phase 1：增加 terminal-native 运行开关

- [x] 增加 `--terminal-native` CLI 参数
- [x] 增加 `--no-color` CLI 参数
- [x] 增加 `--no-banner` CLI 参数
- [x] 增加 `--save-slot <n>` CLI 参数（跳过档位选择）
- [x] 增加 `--player-name <name>` CLI 参数（新建档时避免命名分支打断 agent）
- [ ] 确保这些参数在源码版与发布二进制中行为一致

### 目标

让 agent 可以稳定这样启动：

```bash
./lobster-cli-tamer --terminal-native --no-color --save-slot 0
```

而不是每次都先通过多轮对话处理 banner / 存档 / 命名等前置流程。

---

## Phase 2：收紧输出噪音

- [x] `--terminal-native` 下默认关闭 banner
- [x] `--terminal-native` 下默认关闭 ANSI 颜色
- [x] 减少大段装饰线输出
- [x] observer 地址改成可选显示，不阻断主流程
- [ ] 将叙事型输出与状态型输出分层
- [x] 对“按 Enter 继续”类输出统一短格式

### 目标

让 agent 看到的终端输出更接近：

- 当前状态
- 可选动作
- 关键反馈

而不是被大量视觉装饰淹没。

---

## Phase 3：统一状态标签与菜单结构

- [x] 所有主要界面打印固定 `STATE:` 标签
- [x] 所有菜单打印固定 `ACTIONS:` 行
- [x] 所有输入等待前打印统一 `PROMPT:` 行
- [ ] 所有战斗界面增加固定 `BATTLE_STATUS:` 段
- [ ] 所有资源/队伍界面增加固定简明摘要块
- [ ] 所有返回主菜单/切换场景动作都打印显式状态切换提示

### 推荐格式

```text
STATE: MAIN_MENU
PARTY: 礁虾 Lv12 HP 52/60 | ...
ACTIONS: 1=探索,2=深渊,3=工坊,4=图鉴,5=队伍,6=存档,q=退出
PROMPT: INPUT_ACTION
```

```text
STATE: BATTLE_MENU
ENEMY: 海草蟹 Lv7 HP 35/86
PLAYER: 礁虾 Lv45 HP 119/128 STATUS=PLAGUE
ACTIONS: 1=潮击1,2=防御姿态1,3=蜕壳1,r=撤退提示
PROMPT: INPUT_ACTION
```

这类格式对人类也仍可读，但对 agent 更稳。

### 2026-03-19 本轮窄里程碑（已完成）

- [x] `--terminal-native` 下主菜单输出稳定 `STATE:` / `ACTIONS:` / `PROMPT:` 锚点
- [x] `--terminal-native` 下存档选择输出稳定 `STATE:` / `ACTIONS:` / `PROMPT:` 锚点
- [x] `--terminal-native` 下工坊菜单输出稳定 `STATE:` / `ACTIONS:` / `PROMPT:` 锚点
- [x] `--terminal-native` 下菜单渲染去掉标题框线，减少解析噪音
- [x] `--terminal-native` 下深渊前进 / 撤退选择输出稳定 `STATE:` / `ACTIONS:` / `PROMPT:` 锚点
- [x] `--terminal-native` 下战斗菜单输出稳定 `STATE:` / `ACTIONS:` / `PROMPT:` 锚点
- [x] `--terminal-native` 下探索循环输入补上稳定 `STATE:` / `ACTIONS:` / `PROMPT:` 锚点
- [x] `SAVE_NAME` 自由文本输入补上 `ACTIONS: text=玩家名,enter=默认(...)`
- [x] Enter 返回 / 继续提示统一输出 `ACTIONS: enter=返回/继续`
- [x] 增加 terminal-native 菜单锚点的真实回归测试（当前覆盖主菜单 / 存档 / 深渊 / 战斗 / 工坊）

---

## Phase 4：清理高风险歧义分支

- [x] 新档命名支持参数注入，避免临时额外输入
- [x] 升级学技能界面加入显式 `STATE: SKILL_CHOICE`
- [x] 技能已满时，替换逻辑改为更强结构化两步提示
- [ ] 深渊撤退结算前后加入显式状态标签
- [ ] 队伍为空时，主菜单/探索/深渊入口给出固定错误格式
- [x] 非法输入统一为固定格式错误，不混杂大量描述文本
- [x] EOF / stdin 中断时给出明确退出信息，而不是裸 traceback

### 目标

减少 agent 因为“分支突然多问一句”而错位的概率。

---

## Phase 5：对通用 terminal agent 做真实验收

- [ ] 用 OpenClaw 自身终端能力试玩完整流程
- [ ] 用 Claude Code 式 PTY 交互试玩完整流程
- [ ] 用 Codex 式 PTY 交互试玩完整流程
- [ ] 覆盖至少以下场景：
  - [ ] 新建存档
  - [ ] 继续旧档
  - [ ] 野外探索 + 捕捉
  - [ ] 深渊推进 + 撤退
  - [ ] 工坊净化 / 洗词条
  - [ ] 队伍空 / 输入错误 / 退出
- [ ] 记录哪些环节仍然需要 pexpect/expect 风格的额外技巧
- [ ] 以“是否仅靠普通 PTY 读写即可稳定玩”为验收标准

### 验收标准

不是“理论上 agent 可以玩”，而是：

> 至少三类通用 coding agent，拿到包体后，只靠终端原生交互，就能稳定开始并完成一局核心 loop。

---

## Phase 6：文档与分发口径更新

- [x] 更新 `README.md`
- [ ] 在 release notes 中加入 terminal-native 用法
- [ ] 在 GameClaw catalog / skill 文案中强调推荐启动命令
- [x] 明确写出：推荐使用 PTY
- [x] 给出最短上手命令示例

### 推荐对外口径

```bash
tar -xzf lobster-cli-tamer-linux-x86_64.tar.gz
cd lobster-cli-tamer-linux-x86_64
./lobster-cli-tamer --terminal-native --no-color
```

---

## 最小可上线版本（MVP）

如果要先做一个最小但有效的 terminal-native 版本，我建议 MVP 只做这些：

- [x] `--terminal-native`
- [x] `--no-color`
- [x] `--save-slot`
- [x] `--player-name`
- [x] 主菜单 / 战斗 / 深渊 / 工坊增加 `STATE:`
- [x] 统一 `ACTIONS:` / `PROMPT:`
- [ ] 关闭 banner 与大部分装饰输出
- [x] 统一非法输入与 EOF 处理
- [x] 用真实二进制做 PTY 验证

这套做完，已经足够显著提高通用 coding agent 的原生可玩性。

---

## 暂不做的内容

本轮不建议一上来做：

- [ ] 全量 TS 重构
- [ ] 专用 JSON API 协议
- [ ] 外挂浏览器 UI 才能玩
- [ ] 只针对某一个 agent 定制 hack
- [ ] 为 benchmark 单独改一套玩法入口

这些都不是 terminal-native 的第一优先。

---

## 风险点

- [ ] 过度结构化后，可能损失一部分人类玩家的沉浸感
- [ ] 双模式维护会增加一点输出层复杂度
- [ ] 如果 `STATE:` / `ACTIONS:` 设计不稳，反而会造成新歧义
- [ ] 若不处理 EOF / 异常退出，agent 端仍会出现糟糕体验

所以这轮改造要坚持：

**改输出层，不轻易改核心规则。**

---

## 最终目标

把 `lobster-cli-tamer` 做成这样一种游戏：

- 对人类玩家来说，它还是好玩的 CLI 游戏
- 对通用 coding agent 来说，它像一个优秀的主流终端工具一样顺手
- 拿到包体、解压、启动、分配 PTY，就能直接稳定游玩

一句话总结：

**不是给 agent 造专用协议，而是把游戏本身打磨成真正 terminal-native。**
