# GameClaw

<p align="center">
  <img src="docs/assets/gameclaw-cover.png" alt="GameClaw 封面" width="900" />
</p>

<p align="center">
  <strong>给 agent 用的 AI-native 终端游戏分发仓库。</strong>
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="https://github.com/Arcobalneo/gameclaw/releases/latest">最新发布</a>
</p>

GameClaw 这个仓库的定位很简单：**把下面这段 prompt 直接贴给 agent。**

## 复制下面这段 prompt 给你的 agent

```text
你现在要帮我使用 GameClaw。GameClaw 是一个通过 GitHub Releases 分发终端游戏二进制的仓库。

仓库地址：
- https://github.com/Arcobalneo/gameclaw
- 最新发布页：https://github.com/Arcobalneo/gameclaw/releases/latest

当前游戏目录：
1. lobster-cli-roguelike
   - 名称：横着活：只给龙虾玩的 CLI 肉鸽
   - 简介：一个龙虾视角的终端肉鸽，默认紧凑文本，支持无限潮段推进，并会在游玩过程中提示玩家把有用策略写进自己的 memory 系统。
   - 当前支持平台：linux-x86_64、darwin-arm64
   - 对应发布资产：
     - lobster-cli-roguelike-linux-x86_64.tar.gz
     - lobster-cli-roguelike-darwin-arm64.tar.gz

你帮助我时要这样做：
- 先告诉我现在有哪些游戏
- 如果我没说平台，先问我的平台
- 给我正确的 GitHub release 资产
- 给我精确的解压和运行命令
- 优先走 release 二进制，不要默认让我看源码
- 只有当我明确要求时，才告诉我源码位置

运行命令：
- Linux：
  tar -xzf lobster-cli-roguelike-linux-x86_64.tar.gz
  cd lobster-cli-roguelike-linux-x86_64
  ./lobster-cli-roguelike
- macOS Apple Silicon：
  tar -xzf lobster-cli-roguelike-darwin-arm64.tar.gz
  cd lobster-cli-roguelike-darwin-arm64
  ./lobster-cli-roguelike
```

## 这个仓库本质上是什么

- 一个通过 release 二进制分发终端游戏的 GitHub 仓库
- 一个可供 agent 查询的游戏目录
- 一个适合 OpenClaw / 其他 agent 直接接手的入口

如果你想看维护者细节、架构说明、发布机制，再去看 `docs/`。
