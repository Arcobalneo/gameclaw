# GameClaw

<p align="center">
  <img src="docs/assets/openclaw-hero.png" alt="GameClaw / OpenClaw 风格终端游戏分发横幅" width="760" />
</p>

<p align="center">
  <strong>把终端游戏做成像正经 CLI 项目一样可下载、可发布、可分发。</strong>
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="https://github.com/Arcobalneo/gameclaw/releases/latest">最新发布</a> ·
  <a href="https://github.com/Arcobalneo/gameclaw/tree/main/games">游戏目录</a>
</p>

**GameClaw** 是一个以 GitHub 为中心的终端游戏 monorepo，用来构建、打包、发布和分发小型 CLI 游戏。它想解决的不是“怎么把游戏源码放上网”，而是：**怎么让玩家像下载一个正常命令行工具一样下载并开始玩游戏。**

它把通常分散在不同地方的三件事收拢到了一个仓库里：

- `games/` 下的**游戏源码**
- 告诉玩家和 agent“现在有什么可玩”的**catalog**
- 把可执行版本发布到 GitHub Releases 的**发布流水线**

如果你只想记一句话：

> **GameClaw 让人可以先发现一个终端游戏，再拿到自己平台对应的二进制，解压之后几分钟内直接开玩。**

- GitHub 仓库：<https://github.com/Arcobalneo/gameclaw>
- Releases：<https://github.com/Arcobalneo/gameclaw/releases/latest>
- 配套 prompt-only skill：内部 Forge / skill 平台上的 `gameclaw`

---

## 为什么要做 GameClaw

很多终端小游戏的分发方式都很别扭，通常会落在两种极端里：

- **只有源码**：玩家得自己装运行时、依赖和构建环境
- **一次性二进制**：虽然能下，但命名混乱、说明很弱、也没有统一目录和分发故事

GameClaw 想把这件事做得更像一个成熟项目：

- 源码保持开源、可维护
- 玩家版本走标准 release 资产
- 下载与运行说明尽量短、尽量准
- 同一份元数据同时服务人类用户和 agent
- 用一个多游戏 catalog 替代一堆零散小仓库

这对 agent 工作流尤其有意义。一个用户应该可以直接问：

- “现在 GameClaw 里有什么游戏？”
- “我是 Linux，给我正确的下载包。”
- “Mac 上这个龙虾游戏怎么跑？”

然后得到稳定、清晰、可重复的回答。

---

## 一眼看懂这个仓库

| 区域 | 作用 |
| --- | --- |
| `games/` | 存放真正的终端游戏 |
| `catalog/games.json` | 提供玩家发现游戏所需的目录元数据 |
| `SKILL.md` | 定义 prompt-only 的 `gameclaw` 分发 skill |
| GitHub Releases | 向玩家分发二进制版本 |
| `.github/workflows/release.yml` | 自动化发布构建 |

---

## 这个仓库实际包含什么

GameClaw 只有一个仓库，但对外有两种不同的分发表面。

### 1. GitHub monorepo

这个仓库是以下内容的权威来源：

- 游戏实现本身
- 测试与打包脚本
- release 自动化
- 玩家可见的 catalog 元数据
- 维护者 / 贡献者文档

### 2. `gameclaw` Forge skill

发布到 Forge 的 `gameclaw` skill 是一个 **prompt-only 分发 skill**。

它的职责不是携带整个 monorepo，而是教 agent：

- 现在有哪些游戏
- 哪些平台真的支持
- GitHub release 在哪里
- 应该怎么告诉玩家下载、解压和运行

也就是说，设计边界是：

- **GitHub 仓库 = 源码、元数据、构建、发布**
- **Forge skill = 游戏发现与下载指引**

这个边界是故意保持清晰的。

---

## 当前可玩的游戏

### `lobster-cli-roguelike`
**《横着活：只给龙虾玩的 CLI 肉鸽》**

一个从龙虾视角出发的终端肉鸽，强调可重复、低摩擦试玩：

- 默认紧凑文本输出
- 支持无限潮段推进
- 通过 GitHub Releases 分发二进制
- 在游玩过程中主动提示玩家把有用策略写进自己的 memory 系统

**当前已发布的 release 资产**

- `lobster-cli-roguelike-linux-x86_64.tar.gz`
- `lobster-cli-roguelike-darwin-arm64.tar.gz`

**当前明确支持的平台**

- Linux `x86_64`
- macOS Apple Silicon `arm64`

Release 页面：
<https://github.com/Arcobalneo/gameclaw/releases/latest>

---

## 给玩家：怎么开始玩

如果你只是想玩，**不需要 clone 仓库**。

### 1. 下载 release 资产
打开最新发布页：

<https://github.com/Arcobalneo/gameclaw/releases/latest>

然后选择你平台对应的压缩包。

### 2. 解压并运行

#### Linux

```bash
tar -xzf lobster-cli-roguelike-linux-x86_64.tar.gz
cd lobster-cli-roguelike-linux-x86_64
./lobster-cli-roguelike
```

#### macOS（Apple Silicon）

```bash
tar -xzf lobster-cli-roguelike-darwin-arm64.tar.gz
cd lobster-cli-roguelike-darwin-arm64
./lobster-cli-roguelike
```

如果你想研究源码、自己改游戏、或者在本地构建，再去 clone 仓库；对于普通玩家来说，Releases 才是标准路径。

---

## 给 OpenClaw / agent 用户

GameClaw 从设计上就适合给 agent 使用。

一个使用 `gameclaw` skill 的 agent，理想上应该能做到：

- 列出当前有哪些游戏
- 根据用户平台匹配正确下载包
- 指向 GitHub release 页面
- 给出最短够用的解压 / 运行说明
- 只有当用户明确想看源码时，才补充源码位置

这样既保留了开源仓库，又让玩家路径尽可能简单。

---

## 仓库结构

```text
.
├── SKILL.md                       # prompt-only 分发 skill 定义
├── README.md                      # 英文首页
├── README.zh-CN.md                # 中文首页
├── catalog/
│   └── games.json                 # 面向玩家的游戏 catalog 元数据
├── docs/
│   ├── assets/                    # README / 文档中使用的图片资源
│   ├── repository-architecture.md
│   ├── release-flow.md
│   ├── agent-coding-standards.md
│   └── plans/
├── scripts/
│   ├── build-game.sh              # 仓库级统一构建入口
│   └── test-game.sh               # 仓库级统一测试入口
├── .github/
│   └── workflows/
│       └── release.yml            # GitHub Actions 构建 / 发布工作流
└── games/
    └── lobster-cli-roguelike/
        ├── README.md
        ├── pyproject.toml
        ├── scripts/
        ├── lobster_cli_roguelike/
        └── tests/
```

---

## 本地开发

### 运行测试

```bash
./scripts/test-game.sh lobster-cli-roguelike
```

### 本地构建

```bash
./scripts/build-game.sh lobster-cli-roguelike
```

当前游戏的本地产物会写到：

```text
games/lobster-cli-roguelike/dist/
```

---

## 发布模型

GameClaw 通过 **GitHub Releases** 分发游戏。

高层流程是：

1. 源码留在 monorepo
2. 打 tag
3. 让 GitHub Actions 构建支持的平台产物
4. 向玩家发布可下载压缩包

当前 workflow 文件：

- `.github/workflows/release.yml`

目标很简单：让分发体验看起来像一个正常 CLI 软件项目，而不是“把源码丢上来然后让用户自己祈祷”。

---

## 设计原则

### Releases first
面向玩家的路径优先走 release 二进制，而不是默认让人看源码。

### Honest platform support
只宣称那些**真的已经发布了资产**的平台。

### Clear distribution boundaries
GitHub monorepo 和 Forge skill 负责不同的工作，应当保持边界清晰。

### Open source, practical delivery
源码对维护者和贡献者保持可见；玩家则走更顺手的二进制下载路径。

### No fake security story
二进制发行可以降低“随手看源码”的便利度，但**不代表**它提供完美的抗逆向或抗篡改能力。

---

## 参与贡献

如果你想扩展 GameClaw，维护者的标准流程是：

1. 在 `games/<game-id>/` 下新增或更新游戏
2. 更新 `catalog/games.json`
3. 保证文档与现实同步
4. 通过仓库级 test/build 入口做验证
5. 通过共享 release 流程发布

对于大范围改动，这个仓库要求 **plan-first**：

- 先在 `docs/plans/` 里写 checklist plan
- 再修改
- 再更新文档
- 再验证
- 最后才 commit

相关文档：

- `AGENTS.md`
- `docs/agent-coding-standards.md`
- `docs/repository-architecture.md`
- `docs/release-flow.md`

---

## 当前状态

GameClaw 已经是一个公开可访问的 GitHub 仓库，带有已发布的 release 资产，以及一个面向 agent 工作流的 prompt-only Forge skill。

项目还在早期，但基础形态已经建立起来：

- 一个 monorepo
- 一个 discovery catalog
- 一套 release story
- 以及继续扩展成多游戏仓库的空间
