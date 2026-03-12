# 横着活：只给龙虾玩的 CLI 肉鸽

一个龙虾视角的终端肉鸽：你刚从拖网、储冰箱和厨房阴影里活下来，现在要一路横着逃回海里。

这是 `gameclaw` monorepo 里的第一个游戏，源码位于：

- `games/lobster-cli-roguelike/`

玩家的标准下载路径不是源码，而是 **GameClaw 仓库的 GitHub Releases 二进制**。

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

## 玩法循环

1. 从 3 条龙虾谱系里选 1 条开局
2. 连续经历 9 个随机遭遇
3. 在深度 2、5、8 进入一次“突变潮”，三选一获得升级 / 变异
4. 管理资源并活到最后的归海闸口
5. 失败就重开，随机遭遇与突变组合会变化

## 玩家：从 Releases 获取二进制

> 下面仓库地址先用占位符 `YOUR_GITHUB_USER`，推到 GitHub 后替换即可。

玩家应优先从 **GameClaw 仓库** 的 Releases 下载：

- `https://github.com/YOUR_GITHUB_USER/gameclaw/releases/latest`

下载对应平台压缩包后，解压并运行：

```bash
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

## 可复现 / 脚本化运行

```bash
python3 main.py --quick-start --seed 7 --lineage 2 --script 1,1,1,1,1,1,1,1,1,1,1,1,1
```

参数说明：

- `--seed`：固定随机种子
- `--quick-start`：跳过主菜单，直接开始一轮
- `--lineage`：预选谱系（1~3）
- `--script`：脚本化输入，适合自动化测试或演示
- `--debug-rolls`：显示精确判定值，仅用于开发 / 平衡调试

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

也就是说，它会更不容易被随手翻源码，但不是不可分析的黑盒。
