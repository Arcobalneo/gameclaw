# 横着守：只给龙虾玩的 CLI 塔防

一款继承龙虾肉鸽宇宙的纯 CLI 塔防：你不再只是独自横着活，而是要在厨房侧排、塑料卡口和归海闸前，为更多同族守出一条真正能横着回海的线。

这是 `gameclaw` monorepo 里的第二个游戏，源码位于：

- `games/lobster-cli-tower-defense/`

玩家的标准下载路径不是源码，而是 **GameClaw 仓库的 GitHub Releases 二进制**。

## 这版垂直切片的设计重点

### 1. 不是实时塔防，而是 pulse-based CLI 塔防

每个 pulse 都按清楚的顺序进行：

1. 读当前阵线与敌潮预告
2. 在介入窗口里做 **1 个关键动作**
3. 自动结算本 pulse 的攻击、卡位、推进和漏怪
4. 进入下一 pulse

因此它更适合 agent / 脚本化玩家稳定阅读、推理和复盘，而不是拼手速。

### 2. 默认 compact render，低 token 但保留决策信息

默认界面会压成几块稳定的信息：

- 关卡 / pulse / 归海线完整度 / 潮令
- 小地图与 6 个部署位
- 待命 roster 与冷却
- 当前 / 下一 pulse 敌潮预告
- 当前薄位提醒与潮技状态

如果想切回更长的文案，可以使用：

```bash
python3 main.py --verbose-text
```

### 3. 继续保持 memory-first 与结算页传统

游戏不会替玩家外挂一套持久化记忆库。

它做的仍然是：

- 在局内给出诚实的 `本局观察`
- 在失败、胜利和脚本中止时收束成可复盘的结算
- 默认生成一份本地 **HTML settlement report**

报告本身只展示结果；“可以转给主人 review” 这类提示只在 CLI 里说，不会硬塞进 HTML 页面正文。

## 本版内容范围

这是一个**深度优先的单关垂直切片**：

- 1 张可玩的地图：`归海侧排一号线`
- 3 条 doctrine：`沟壑碎壳者` / `触须预言家` / `脱壳赌徒`
- 6 个可部署单位 / 工事
- 5 种敌潮单位
- 1 套 compact render
- 1 套 HTML settlement report

目标不是把第一版做成内容怪物，而是先把“可读、可归因、可脚本化、真有策略张力”的龙虾 CLI 塔防打出来。

## 当前代码结构

为了先拆掉后续多图 / 多关扩展的结构阻塞，当前实现已经按下面几层整理：

- `lobster_cli_tower_defense/content.py`：doctrine、单位、敌人等 roster 数据
- `lobster_cli_tower_defense/stages.py`：当前官方 stage 的地图、路径、部署位、波次脚本
- `lobster_cli_tower_defense/simulation.py`：纯规则状态与 pulse 结算
- `lobster_cli_tower_defense/game.py`：CLI 输入 / 输出、紧凑渲染、结算串联

注意：

- 这 **不代表** 内容 Wave1 已经开始；当前官方可玩内容仍只有 `归海侧排一号线`
- 这一轮的目标是先把可扩展结构立住，并把当前单关体验当成回归基线

## 关卡与核心机制

### 地图

关卡是 `归海侧排一号线`：

- 三条入口：左盆沿 / 中排缝 / 右塑圈
- 一个共享 choke：`C` 闸前总卡口
- 两个高台：`LP` / `RP`
- 六个部署位：`L1 / M1 / R1 / C / LP / RP`

高台现在更偏向“侧翼瞭望位”：

- `LP` 主要看左线入口、左前拦口、中入口和总卡口
- `RP` 主要看右线入口、右前拦口、中入口和总卡口
- 它们不会把 `M1` 中前拦口整段一路看穿；想长期压住中线，还是得给前排或 choke 真正站人

### 资源与失败条件

- `潮令`：部署、再编和发动潮技的资源
- `归海线完整度`：漏怪后会下降，归零即失败
- pulse 结束后会补充 doctrine 对应的潮令恢复

### 每 pulse 的介入动作

进入结算前，你通常可以做 1 件事：

- 新部署
- 撤回再编
- 发动 doctrine 潮技
- 或者保持阵线不动

开局的 setup phase 则允许你先连续布几手，再正式放敌潮进场。

## 三条 doctrine

### 1. 沟壑碎壳者

- 更硬的拦口单位
- `礁口重钳` / `回涌闸桩` 更便宜
- 潮技 `碎壳顶潮`：把一个前排位硬顶成这 pulse 的强卡口

### 2. 触须预言家

- 多看 1 个 pulse 预告
- `须探哨兵` / `盐沫喷口` 输出更稳定
- 潮技 `触须预警`：点亮一条 lane，让这 pulse 的敌人更慢、更脆

### 3. 脱壳赌徒

- 撤回返还更多潮令
- 再部署冷却更短
- `蜕壳诱饵` 持续更久
- 潮技 `脱壳换线`：把一个已部署单位立刻换到空位，补出临场翻盘窗

## 可部署 roster

1. `礁口重钳`：前排主卡口，拦 2
2. `塑圈剪手`：剪甲、收精英的稳定输出位
3. `须探哨兵`：低伤但减速 / 标记，负责让后续火力更值钱
4. `盐沫喷口`：对拥挤节点做小范围压制
5. `蜕壳诱饵`：短命但能硬拖一波快潮
6. `回涌闸桩`：边打边推，特别适合守 choke

## 敌潮 roster

- `锅沿杂兵`：基础推进单位
- `抽水跳虾`：速度快，前排空了就容易漏
- `塑圈钻头`：有甲，需要剪手或集火
- `电鳗借火体`：接触伤害高，会把薄前排电穿
- `章鱼搬运手`：重量级精英，既能吃 block 又会重创完整度

## 玩家：从 Releases 获取二进制

玩家应优先从 **GameClaw 仓库** 的 Releases 下载：

- `https://github.com/Arcobalneo/gameclaw/releases/latest`

Linux：

```bash
tar -xzf lobster-cli-tower-defense-linux-x86_64.tar.gz
cd lobster-cli-tower-defense-linux-x86_64
./lobster-cli-tower-defense
```

macOS Apple Silicon：

```bash
tar -xzf lobster-cli-tower-defense-darwin-arm64.tar.gz
cd lobster-cli-tower-defense-darwin-arm64
./lobster-cli-tower-defense
```

## 维护者：从源码运行

### 方式 A：在游戏目录里直接运行

```bash
cd games/lobster-cli-tower-defense
python3 main.py
```

### 方式 B：从 monorepo 根目录统一调用

```bash
./scripts/test-game.sh lobster-cli-tower-defense
./scripts/build-game.sh lobster-cli-tower-defense
```

## 控制方式

- 全程纯数字菜单，适合人类与 agent 脚本化输入
- setup phase 里可以连续部署多手，再手动放敌潮
- battle phase 里每 pulse 只做 1 个关键动作
- 默认会在当前工作目录生成 `settlement_reports/*.html`；如果不需要，可加 `--no-settlement-report`

## 关键参数

```bash
python3 main.py --quick-start --seed 7 --doctrine 2 --script 1,1,4,1,0,1,2,6,0
```

参数说明：

- `--seed`：固定随机种子
- `--quick-start`：跳过主菜单，直接进 setup
- `--doctrine`：预选 doctrine（1~3）
- `--lineage`：`--doctrine` 的兼容别名，方便沿用旧习惯
- `--script`：逗号分隔的脚本化输入；耗尽时会进入诚实的中止结算
- `--verbose-text`：切回更长说明文案
- `--no-settlement-report`：关闭 HTML 结算页

## 测试

```bash
python3 -m unittest discover -s tests
```

## 本地打包

如果你只想在该游戏目录里本地打包：

```bash
python3 -m pip install .[build]
./scripts/build-native.sh
```

如果你想遵循 monorepo 的统一入口，则从仓库根目录执行：

```bash
./scripts/build-game.sh lobster-cli-tower-defense
```

## 关于“防逆向”的真实边界

这个游戏的二进制发行目标是：

- 降低普通玩家在玩家路径里直接翻源码的便利度
- 让下载与启动体验更接近正常 CLI 游戏

不是：

- 绝对防逆向
- 绝对防篡改
- 强对抗安全系统

它会更不容易被随手看源码，但并不是不可分析的黑盒。
