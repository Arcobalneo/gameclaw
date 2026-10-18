# 横着看：只给龙虾玩的 CLI 视觉恐怖

**Lobster Sideways Look** — 一款给 coding agent 单步游玩的终端视觉恐怖游戏。

你在一座不肯承认自己已经封潮的观察站里横着走。每次 `inspect` 都会让侧视面板多看你一眼；`record` 把看见的东西写进档案，证据够了，档案才会承认你的记录。取得档案、走到出口、撤离——或者带着一份错误记录走出门。

```bash
lobster-cli-sideways-look new --seed 7 --content sealed-tide-station
lobster-cli-sideways-look act inspect:left-window
lobster-cli-sideways-look act record
lobster-cli-sideways-look act move:monitor-hall
lobster-cli-sideways-look recap
```

当前版本：`2.0.0`。

## 为什么它是 agent-first 的

- **一次调用 = 一个回合**。`act` 返回本回合日志、完整状态和下一步合法动作，agent 不需要在每次动作之间额外查询 `status` 和 `actions`。
- **稳定文本锚点**。`GAME / STATE / STAT / ACTIONS / NEXT` 五行结构，正则就能解析。
- **`--json` 输出**。每回合一个 JSON 对象，包含状态、动作、事件、结算路径和 `next` 提示。
- **确定性**。同一 seed + 同一动作序列 = 完全相同的结果，可回放、可回归测试。
- **单步、无长驻循环**。没有必须保持打开的 PTY；每条命令都会自动存档，失败也不会污染已有存档。
- **诚实结算**。成功撤离、错误记录、神经崩溃、恐惧封顶和中止分别有可归因的结局与单局限定观察，鼓励 agent 写进自己的 memory。

## 安装（推荐：GitHub Releases）

从 [GameClaw Releases](https://github.com/Arcobalneo/gameclaw/releases/latest) 下载对应平台的单文件二进制：

| 平台 | 资产 |
|---|---|
| macOS Apple Silicon | `lobster-cli-sideways-look-darwin-arm64.tar.gz` |
| macOS Intel | `lobster-cli-sideways-look-darwin-x64.tar.gz` |
| Linux x64 | `lobster-cli-sideways-look-linux-x64.tar.gz` |
| Linux arm64 | `lobster-cli-sideways-look-linux-arm64.tar.gz` |
| Windows x64 | `lobster-cli-sideways-look-windows-x64.zip` |

```bash
# macOS / Linux
tar -xzf lobster-cli-sideways-look-<platform>.tar.gz
cd lobster-cli-sideways-look-<platform>
./lobster-cli-sideways-look --version
```

```powershell
# Windows
Expand-Archive lobster-cli-sideways-look-windows-x64.zip
.\lobster-cli-sideways-look-windows-x64\lobster-cli-sideways-look.exe --version
```

二进制不需要 Node、Bun、Python 或任何运行时依赖。

## 四个副本入口

| case id | 中文名 | 入口房间 | 主题 | 目标证据 |
|---|---|---|---|---|
| `archive-corridor` | 归档长廊 | `index-foyer` | 标签错位、目录污染 | 3 |
| `backflow-inn` | 返潮招待所 | `front-desk` | 门缝、床尾、镜面 | 3 |
| `blind-screen-room` | 盲屏机房 | `relay-door` | 监控延迟与反向凝视 | 3 |
| `sealed-tide-station` | 封潮观察站 | `lookout-deck` | 海边废弃观察站 | 3 |

每个副本有 5 个房间，包含房间面板、2 个 inspect 目标、1 个可交互物、出口，以及 360 条事件配置（`inspect` / `move` / `interact` 各 120 条）。事件按动作类型与房间 tags 匹配；当前房间没有匹配 tags 时回退到该副本同动作类型的事件池。

## 玩法

### 一局的结构

1. `new` 不带 `--content` 时先进入**副本选择**，用 `act choose:<case-id>` 进入；`--content <case-id>` 可直接开局。
2. 在房间里用 `inspect:<target-id>` 观察目标，命名**当前现象**；用 `record` 把它写成一条证据。
3. `move:<room-id>` 在出口之间移动；`interact:<interactable-id>` 操作稳定物、揭露装置，或取得目标档案。
4. 证据达到 `requiredEvidence` 后，取得的目标才是 **verified**；证据不足时取得会标记为 **uncertain**，之后继续 `record` 可以把它升到 verified。
5. 在 `isExit` 房间用 `extract` 撤离：verified = 成功；uncertain = **错误记录**；未取得目标则会被出口拒绝。
6. `nerve` 归零或 `dread` 达到 10 即失败。任何阶段都可以 `abort` 诚实中止。

### 四项指标

| 指标 | 作用 |
|---|---|
| `专注` focus | 上限 9。每次 `inspect` 消耗 1 点；专注为 0 后继续 inspect 会额外 +1 恐惧。`brace` 恢复 2 点。事件也会改变它。 |
| `神经` nerve | 上限 10，初始 8。事件会消耗；归零立即失败。`brace` 恢复 1 点。 |
| `恐惧` dread | 上限 10，初始 0。事件、取得目标、被出口拒绝都会增加；达到 10 立即失败。`brace` 降低 1 点。 |
| `证据` evidence | 记录现象 +1；少数 inspect 事件也会给 +1。达到目标要求即可让已取得档案变为 verified。 |

> 这是本移植版为了给「专注」一个明确作用而追加的轻量规则：专注耗尽后继续观察会额外增加恐惧。原 standalone 版里专注只作为展示指标。

### 现象、记录与档案

- `inspect` 会从当前房间匹配的事件池中抽一条 `inspect` 事件，应用 focus/nerve/dread/evidence 变化，并把该事件的标题、线索、目击文本和 ASCII 面板设为**当前现象**。
- `record` 只在存在未记录的当前现象时出现。记录会写入 `recordedClues` 并增加 1 点证据；已经记录过的线索不会重复出现。
- 目标档案的 interactable 带 `effect: "objective"`。取得时恐惧 +2；此时证据不足就是 uncertain，之后每次证据增加都会重新校验，足够时自动升为 verified。
- `stabilize` 类交互物在事件之外额外恢复专注 +1、神经 +1、恐惧 -1。
- `reveal` 类交互物会把一条 interact 事件暴露成可记录现象（同样受未记录线索过滤）。
- 移动会清空当前现象，但仍会应用目标房间的 `move` 事件并更新「上一次结果」和侧视面板。

### 事件表

事件 JSON 保留自旧版内容层，字段包括：

```json
{
  "trigger": "inspect",
  "roomTags": ["archive"],
  "focusDelta": -1,
  "nerveDelta": 0,
  "dreadDelta": 1,
  "evidenceDelta": 0,
  "clueId": "paper-depth-1",
  "clueText": "...",
  "witness": "...",
  "ascii": ["..."]
}
```

事件解析完全走 `@gameclaw/gamekit` 的 sfc32 RNG，状态里保存四字 `rng: number[]`；同一 seed 与动作序列会得到同一串事件。

## 动作 id

| 动作 | id 形式 | 说明 |
|---|---|---|
| 选择副本 | `choose:<case-id>` | 仅在 case-select 阶段出现 |
| 观察 | `inspect:<target-id>` | 当前房间的 inspect 目标 |
| 记录 | `record` | 当前现象存在且未记录时出现 |
| 移动 | `move:<room-id>` | 只列出当前房间的出口 |
| 交互 | `interact:<interactable-id>` | 稳定 / 揭露 / 取得档案 |
| 稳定 | `brace` | 恢复专注与神经、降低恐惧 |
| 撤离 | `extract` | 仅在 `isExit` 房间出现 |
| 中止 | `abort` | gamekit 自动追加，任何进行中的回合都可用 |

`act` 支持完整 id、合法唯一前缀或动作列表里的序号。

## CLI 参考

```bash
lobster-cli-sideways-look new      [--slot N] [--seed N] [--content <case-id>] [--json]
lobster-cli-sideways-look status   [--slot N] [--json]
lobster-cli-sideways-look actions  [--slot N] [--json]
lobster-cli-sideways-look act <id> [--slot N] [--json]
lobster-cli-sideways-look recap    [--slot N] [--format text|markdown|html] [--json]
lobster-cli-sideways-look saves    [--json]
lobster-cli-sideways-look play     [--slot N]
lobster-cli-sideways-look observer [--port N]
lobster-cli-sideways-look doctor
lobster-cli-sideways-look help | version
```

全局参数：`--state-dir`、`--json`、`--slot`、`--seed`、`--content`、`--no-color`、`--no-observer`、`--no-report`、`--force`、`--verbose`。

`new` / `play` 默认从 `127.0.0.1:8000` 起找第一个空闲端口启动本地 observer 页面，结束时关闭并保留静态 HTML 结算页；无法启动时会明确提示，不会假装 observer 存在。

## 状态路径

默认根目录 `~/.gameclaw/lobster-cli-sideways-look/`：

- 存档：`saves/slot-<n>.json`
- 动作日志：`journals/<run-id>.ndjson`
- 结算：`reports/<run-id>-<outcome>.html` / `.md`，以及 `reports/latest.html` / `latest.md`
- observer：`observer/daemon.json`（daemon 端口与令牌）

用 `--state-dir <path>` 或环境变量 `GAMECLAW_HOME` 可以把状态放进沙箱目录，适合并行评测。

## 本地开发

```bash
pnpm install
pnpm --filter @gameclaw/lobster-cli-sideways-look check
pnpm --filter @gameclaw/lobster-cli-sideways-look test
bun games/lobster-cli-sideways-look/src/main.ts new --seed 7 --content sealed-tide-station --state-dir /tmp/look-smoke --no-observer
node scripts/build-game.mjs lobster-cli-sideways-look
node scripts/test-game.mjs lobster-cli-sideways-look
```

实现只依赖 `node:*` 与 `@gameclaw/gamekit`：

- `src/main.ts` — 唯一入口，把 `definition` 交给 gamekit 的 `runCli`
- `src/definition.ts` — `GameDefinition`：状态视图、动作视图、结算
- `src/engine.ts` — 副本状态、动作解析、事件判定、失败与撤离
- `src/content.ts` — 加载并校验 `content/cases/**` 与 `content/events/**`
- `src/model.ts` — 可 JSON 序列化的状态类型

旧版的 Ink / React / rot.js / observer / report 实现已删除，CLI、存档、observer、结算全部由 gamekit 提供。

## 防逆向边界

单文件二进制减少普通玩家直接翻源码的便利度，但不保证不可逆向、不可篡改，也不是强对抗反作弊系统。内容 JSON 会随 Bun 打包进二进制；有决心的逆向者仍然可以提取字符串或还原数据。

## License

MIT
