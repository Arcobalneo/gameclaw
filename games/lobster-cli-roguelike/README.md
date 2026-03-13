# 横着活：只给龙虾玩的 CLI 肉鸽

一个龙虾视角的终端肉鸽：你刚从拖网、储冰箱和厨房阴影里活下来，现在要一路横着逃、横着学，并把值得活下来的招数写进**你自己的 memory**。

这是 `gameclaw` monorepo 里的第一个游戏，源码位于：

- `games/lobster-cli-roguelike/`

玩家的标准下载路径不是源码，而是 **GameClaw 仓库的 GitHub Releases 二进制**。

## 这次优化后的三个核心方向

### 1. 默认节省 token

游戏现在默认是**紧凑文本模式**：

- 保留标题、状态、选项、结果、结算建议
- 压缩大段重复叙述
- 更适合反复试玩、脚本化运行、以及让 agent / 玩家低成本连续试错

如果想切回更长的文案，可以使用：

```bash
python3 main.py --verbose-text
```

### 2. 不再只打一小轮，而是能一直玩下去

旧版是一段固定短流程。

现在改成了：

- 每个**潮段**包含 9 个随机遭遇 + 1 个归海闸口
- 成功穿过归海闸口后，不是直接结束，而是进入更深一段海域
- 海压会逐段增加，难度缓慢上升
- 默认会无限继续，直到你死亡

为了测试或演示，也支持人为限制潮段数：

```bash
python3 main.py --quick-start --max-cycles 2
```

### 3. 游戏不会替你外挂记忆，但会主动催你去写自己的 memory

这里的设计已经纠正为你要的方式：

- **游戏本身不保存一套外挂式持久化记忆系统**
- 它不会替玩家偷偷存“龙虾经验数据库”
- 它做的事只有一个：在过程中和结算时，主动提醒游玩者去把策略写进**自己的 memory**
- 每轮结束后默认还会额外生成一份本地 **HTML 结算页**；这份页面本身只负责展示结算信息，转发给主人 review 的提示放在 CLI 终端输出里

也就是说，让龙虾越来越聪明的，不是游戏内置外挂，而是：

> 游戏文本不断推动正在游玩的 OpenClaw / 玩家，把关键策略写进自己的记忆系统。

## 在 monorepo 里的角色

这个游戏目录负责：

- 游戏源码
- 游戏测试
- 游戏自身的原生打包脚本
- 游戏级 README / 文档

而以下内容由仓库根目录统一负责：

- 游戏目录索引：`catalog/games.json`
- Skill 分发逻辑：`SKILL.md`
- GitHub Actions release workflow：根目录 `.github/workflows/release.yml`
- 统一构建入口：`scripts/build-game.sh`
- 统一测试入口：`scripts/test-game.sh`

## 为什么它是“只给龙虾玩的”

这不是把普通地牢换成海底皮肤：

- 核心能力就是龙虾能力：左右钳分工、触须感知、侧向冲刺、蜕壳脱身、盐度适应
- 大多数决策都建立在“龙虾怎么活下去”上，而不是人类英雄逻辑
- 敌人与危险也按龙虾视角成立：拖网、章鱼、电鳗、塑料垃圾流、厨师与锅
- 文案默认你关心的不是金币和经验，而是“今天别被煮”“壳还够不够硬”“还剩几层体面可以脱”

## 玩法循环（新版）

1. 从 3 条龙虾谱系里选 1 条开局
2. 进入一个潮段：连续经历 9 个随机遭遇
3. 在深度 2、5、8 进入一次“突变潮”，三选一获得升级 / 变异
4. 冲过归海闸口
5. 成功则进入下一潮段，失败则死亡
6. 游戏在过程中和结算时提示你把策略写进自己的 memory

## 本轮 gameplay-first 微调

- 随机遭遇现在会尽量避开刚打过的 1~2 个场景；中后段不会那么容易连续刷到同一种按钮题
- 新增轻量“潮势”状态：感知 / 横移 / 伪装成功会攒势，后续强攻、剪切、脱壳更吃这个节奏；同一套 build 在不同顺序下会有不同手感
- `塑料垃圾流` 现在更明确分成三条路：冒险扒食、硬壳顶穿、甩锅脱身；不同谱系会更自然地偏向不同解法
- `归海闸口` 不再是一道固定答案题：碎壳者更敢硬冲，预言家更偏剪环，赌徒更适合拿壳换缝
- memory 提示改成“本局观察 / 下局再验证”的口径，避免把一次好运或一次暴毙抄成铁律
- 突变潮会把 build 观察也塞进本轮摘记里，结算时更容易看出“这局我是怎么活的”
- 失败结算会更明确指出你倒在哪个场景，以及这局还剩下哪些可验证的经验
- `--script` 输入耗尽不再抛 `EOFError`；CLI 会诚实地按“中止结算”收尾，方便 agent 验收当前状态和观察摘记

## 玩家：从 Releases 获取二进制

玩家应优先从 **GameClaw 仓库** 的 Releases 下载：

- `https://github.com/Arcobalneo/gameclaw/releases/latest`

下载对应平台压缩包后，进入解压目录并运行。

Linux：

```bash
tar -xzf lobster-cli-roguelike-linux-x86_64.tar.gz
cd lobster-cli-roguelike-linux-x86_64
./lobster-cli-roguelike
```

macOS Apple Silicon：

```bash
tar -xzf lobster-cli-roguelike-darwin-arm64.tar.gz
cd lobster-cli-roguelike-darwin-arm64
./lobster-cli-roguelike
```

## 维护者：从源码运行

### 方式 A：在游戏目录里直接运行

```bash
cd games/lobster-cli-roguelike
python3 main.py
```

### 方式 B：从 monorepo 根目录统一调用

```bash
./scripts/test-game.sh lobster-cli-roguelike
./scripts/build-game.sh lobster-cli-roguelike
```

## 控制方式

- `1 / 2 / 3`：选择菜单项、行动或突变
- 全程纯终端交互，不需要鼠标，不需要网页
- 每轮结束后默认会在当前工作目录生成 `settlement_reports/*.html` 可视化结算页；如果不需要，可在启动时加 `--no-settlement-report`
- CLI 终端会明确提示：结算报告生成到了哪个路径，以及 agent 玩家可以把它发给主人 review

## 关键参数

```bash
python3 main.py --quick-start --seed 7 --lineage 2 --script 1,1,1,1,1,1,1,1,1,1,1,1,1 --max-cycles 2
```

参数说明：

- `--seed`：固定随机种子
- `--quick-start`：跳过主菜单，直接开始一轮
- `--lineage`：预选谱系（1~3）
- `--script`：脚本化输入，适合自动化测试或演示；如果输入耗尽，游戏会以“中止结算”诚实收尾
- `--debug-rolls`：显示精确判定值，仅用于开发 / 平衡调试
- `--verbose-text`：切回长文案模式；默认是节省 token 的紧凑模式
- `--max-cycles`：限制潮段数，便于测试；默认无限继续直到死亡

## 测试

维护者现在统一通过仓库根目录的 `uv` workspace（`pyproject.toml` + `uv.lock`）运行测试。

如果你在该游戏目录里直接执行：

```bash
uv run --project ../.. --package lobster-cli-roguelike python -m unittest discover -s tests
```

如果你想遵循 monorepo 的稳定入口，则从仓库根目录执行：

```bash
./scripts/test-game.sh lobster-cli-roguelike
```

## 本地打包

如果你只想在该游戏目录里本地打包：

```bash
uv run --project ../.. --package lobster-cli-roguelike --extra build ./scripts/build-native.sh
```

如果你想遵循 monorepo 的统一入口，则从仓库根目录执行：

```bash
./scripts/build-game.sh lobster-cli-roguelike
```

## 关于“防作弊”的真实边界

这个游戏的二进制发行目标是：

- 降低普通玩家直接观察源码的便利度
- 让下载体验更像正常 CLI 工具

不是：

- 绝对防逆向
- 绝对防篡改
- 强对抗防作弊系统

它会更不容易被随手翻源码，但不是不可分析的黑盒。
