---
name: lobster-cli-tamer
summary: 《横着抓：只给龙虾玩的 CLI 捕兽养成》游戏内说明与 agent 操作指南。包含启动方式、核心循环、深渊风险、Observer / HTML 结算页、以及对 agent 玩家更友好的操作建议。
---

# lobster-cli-tamer

《横着抓：只给龙虾玩的 CLI 捕兽养成》是一款龙虾宇宙下的 CLI 捕兽养成游戏。

这份文档是 **per-game、agent-facing** 的长期说明：
- 讲这个游戏是什么
- 讲怎么启动
- 讲 agent 在游玩时该关注什么
- 讲 observer / 结算页 / 存档这些运行期能力

它不是 GameClaw 根 README 里的稳定分发 prompt 的替代品；
根 README 负责教**人类用户**如何 prompt 自己的 agent 获取并启动游戏，
而这份 `SKILL.md` 负责承载这个具体游戏的细节。

## 当前版本能玩什么

核心内容：
- 111 只可收集虾米
- 700+ 技能数据
- 100 条词条（可重投 / 升阶 / 封印）
- 野外探索 + 捕捉 + 编队成长
- 工坊资源循环
- 无尽深渊：战斗内永久死亡 + 精英疫病 + 撤退结算风险
- 默认启动本地 Observer 看板
- 退出时自动生成静态 HTML 结算页

## 玩家：从 GitHub Releases 获取二进制

玩家默认应优先使用 GameClaw 仓库的 release 二进制，而不是源码：
- `https://github.com/Arcobalneo/gameclaw/releases/latest`

### Linux

```bash
tar -xzf lobster-cli-tamer-linux-x86_64.tar.gz
cd lobster-cli-tamer-linux-x86_64
./lobster-cli-tamer
```

### macOS Apple Silicon

```bash
tar -xzf lobster-cli-tamer-darwin-arm64.tar.gz
cd lobster-cli-tamer-darwin-arm64
./lobster-cli-tamer
```

## 维护者：从源码运行

### 方式 A：游戏目录直跑

```bash
cd games/lobster-cli-tamer
PYTHONPATH=. python3 -m lobster_cli_tamer.game
```

### 方式 B：从 monorepo 根目录统一调用

```bash
./scripts/test-game.sh lobster-cli-tamer
./scripts/build-game.sh lobster-cli-tamer
```

## 核心游玩循环

### 1. 野外探索

主循环通常是：
- 进入探索区
- 遭遇野生虾米
- 选择战斗 / 捕捉 / 逃跑
- 捕到后补充队伍或进 box
- 持续积累资源与词条基础

### 2. 编队与成长

重点不只是抓更多，而是：
- 养出更稳定的主力队
- 利用升级和技能池形成更清楚的战斗分工
- 把有价值的词条留下来，而不是无脑重投

### 3. 工坊

工坊提供：
- 重投
- 升阶
- 封印
- 解封

agent 游玩时要把它理解成“长期养成投资”而不是即时收益按钮。

### 4. 深渊

深渊是高风险模式：
- 战斗内 HP 归零 = 立即永久死亡
- 精英层会传播疫病
- 退出或失败时会按累积层数结算疫病死亡率
- 队伍构筑、替补深度、撤退时机都比普通探索重要得多

## Agent 玩家操作建议

### 1. 默认优先稳定开局，而不是乱抓

前中期更重要的是：
- 先形成能稳定清野的队伍
- 再考虑稀有捕捉
- 不要因为背包里有高级捕捉网就对任何目标都立刻交掉

### 2. 捕捉网现在有明确选择

当前可用捕捉类道具包括：
- `net_basic`
- `net_fine`
- `net_spirit`
- `shiny_trap`

agent 不应再默认把捕捉行为理解成“永远使用基础网”；
进入捕捉时，应根据目标价值和背包数量决定使用哪一种。

### 3. 深渊里不要把无效输入当成默认出招

当前版本已修正：
- 无效输入会提示并重新输入
- 不会再静默释放第一个技能

这意味着 agent 脚本在深渊里应该更诚实地处理输入失败，而不是依赖历史 bug。

### 4. Observer / 结算页是正式能力，不是附赠调试件

运行时：
- 会默认在本地 `localhost:8000+` 找空闲端口启动 Observer
- 可用于人类旁观 agent 当前队伍、事件流与运行状态

结束时：
- 会生成静态 HTML 结算页
- 适合发给主人 review，或供 agent 复盘本局选择

## 运行期产物

- Observer：`http://localhost:8000+`
- 存档：`~/.lobster-cli-tamer/save_<slot>.json`
- 静态结算页：`~/.lobster-cli-tamer/reports/latest.html`

## 对 agent 更重要的真实边界

- 这不是浏览器游戏，CLI 才是主控制面
- Observer 只负责旁观，不提供隐藏真相 UI
- 深渊是永久死亡模式，不应该把它当成普通刷本
- 捕捉、养成、工坊、深渊之间存在长期资源张力，不是单回合最优即可

## 文档分层说明

- **GameClaw 根 README**：稳定的人类入口，教人类如何 prompt 自己的 agent 去获取和启动游戏
- **GameClaw 根 `SKILL.md`**：稳定的分发 skill，维护当前有哪些游戏、支持哪些平台、对应哪些 release 资产
- **本文件 `games/lobster-cli-tamer/SKILL.md`**：这个具体游戏的玩法 / 启动 / 运行期 / agent 操作说明
