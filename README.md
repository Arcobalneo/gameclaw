# GameClaw

GameClaw 是一个面向 OpenClaw / ClawHub / GitHub Releases 的**终端游戏分发 monorepo**。

它把三件事放进同一个仓库里：

1. **分发 skill**：告诉玩家有哪些游戏、去哪里下载、怎么运行
2. **游戏源码**：每个游戏都在 `games/<game-id>/` 下独立维护
3. **发布流水线**：从源码构建 Linux / macOS 二进制，并通过 GitHub Releases 分发

当前已集成首个游戏：

- `lobster-cli-roguelike` / **《横着活：只给龙虾玩的 CLI 肉鸽》**
  - 默认紧凑文本，尽量节省 token
  - 支持无限潮段
  - 会主动提示游玩者把策略写进自己的 memory，让龙虾靠外部记忆系统越玩越聪明

## 仓库目标

- 源码保持开源、可审阅、可维护
- 玩家默认拿到的是 **GitHub Releases 二进制**，而不是直接运行源码
- `gameclaw` skill 负责“发现游戏 + 指路下载 + 简述运行方式”
- 每个游戏保持相对独立，能单独测试、单独构建、单独扩展

## 仓库结构

```text
.
├── AGENTS.md                      # agent / maintainer workflow rules
├── SKILL.md                       # GameClaw skill behavior
├── README.md                      # repo overview
├── LICENSE
├── .gitignore
├── catalog/
│   └── games.json                 # player-facing game registry metadata
├── docs/
│   ├── repository-architecture.md # monorepo structure notes
│   ├── release-flow.md            # release pipeline documentation
│   ├── agent-coding-standards.md  # coding / documentation / validation norms
│   └── plans/                     # checklist plans for large changes
├── scripts/
│   ├── build-game.sh              # generic per-game build entrypoint
│   └── test-game.sh               # generic per-game test entrypoint
├── .github/
│   └── workflows/
│       └── release.yml            # GitHub Actions release workflow
└── games/
    └── lobster-cli-roguelike/
        ├── README.md
        ├── pyproject.toml
        ├── scripts/build-native.sh
        ├── lobster_cli_roguelike/
        └── tests/
```

## 对玩家的分发模型

玩家不需要接触源码。标准路径是：

1. OpenClaw 触发 `gameclaw` skill
2. skill 读取 `catalog/games.json`
3. 告诉玩家：
   - 有哪些游戏
   - 每个游戏是什么
   - 支持哪些平台
   - 去哪个 GitHub Releases 下载
4. 玩家下载对应平台的 `.tar.gz`
5. 解压并运行其中的二进制 CLI

## 对维护者的发布模型

维护者在这个 monorepo 里：

- 新增 / 修改游戏源码
- 更新 `catalog/games.json`
- 在 `games/<game-id>/` 下维护游戏自身 README、测试和构建脚本
- 使用根目录的 `scripts/build-game.sh <game-id>` 做统一构建
- 通过 `.github/workflows/release.yml` 在 tag 发布时构建发行资产

## 本地验证

以当前首个游戏为例：

```bash
./scripts/test-game.sh lobster-cli-roguelike
./scripts/build-game.sh lobster-cli-roguelike
```

构建成功后，产物位于：

```bash
games/lobster-cli-roguelike/dist/
```

## 设计边界

GameClaw 的目标是：

- **降低普通玩家直接观察源码的便利度**
- **让下载体验更像正常 CLI 工具发行**
- **让某些本地单机游戏主动引导玩家/agent把策略写进自己的记忆系统**，形成持续学习感

GameClaw **不承诺**：

- 绝对防逆向
- 绝对防篡改
- 服务端级别的强对抗防作弊

也就是说，二进制发行会提高观察门槛，但不会神化成“不可分析”；而游戏里的 memory 相关设计也只是主动提醒玩家/agent去写自己的记忆，不是内置外挂记忆系统。

## 继续扩展新游戏

添加一个新游戏时，至少需要：

1. 在 `games/<new-game-id>/` 建立独立源码目录
2. 提供该游戏自己的 README、测试、打包脚本
3. 在 `catalog/games.json` 增加元数据条目
4. 如需发布，接入根目录 release workflow
5. 按 `AGENTS.md` 先写 plan，再改，再补文档，再验证，再提交
