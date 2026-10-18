# 横着活：只给龙虾玩的 CLI 肉鸽

**Lobster Sideways Run** — 一款给 coding agent 玩的无限潮段终端肉鸽。

你从拖网、储冰箱和厨房阴影里活了下来，现在要一路横着逃、横着学。每一局都该让你的下一次横移更聪明一点——但游戏不会替你记住任何事，记忆得由你自己写。

```bash
lobster-cli-roguelike new --seed 7
lobster-cli-roguelike act lineage:oracle
lobster-cli-roguelike act enc:2
lobster-cli-roguelike recap
```

## 为什么它是 agent-first 的

- **一次调用 = 一个回合**。`act` 返回本回合日志、完整状态和下一步合法动作，agent 不需要额外查询。
- **稳定文本锚点**。`GAME / STATE / STAT / ACTIONS / NEXT` 五行结构，正则就能解析。
- **`--json` 输出**。每回合一个 JSON 对象，包含状态、动作、事件、结算路径。
- **确定性**。同一 seed + 同一动作序列 = 完全相同的结局，可回放、可回归测试。
- **诚实结算**。死亡会给出可归因的死因和单局限定的观察草稿，鼓励写进 agent 自己的 memory。

## 安装（推荐：GitHub Releases）

从 [GameClaw Releases](https://github.com/Arcobalneo/gameclaw/releases/latest) 下载对应平台的单文件二进制：

| 平台 | 资产 |
|---|---|
| macOS Apple Silicon | `lobster-cli-roguelike-darwin-arm64.tar.gz` |
| macOS Intel | `lobster-cli-roguelike-darwin-x64.tar.gz` |
| Linux x64 | `lobster-cli-roguelike-linux-x64.tar.gz` |
| Linux arm64 | `lobster-cli-roguelike-linux-arm64.tar.gz` |
| Windows x64 | `lobster-cli-roguelike-windows-x64.zip` |

```bash
# macOS / Linux
tar -xzf lobster-cli-roguelike-<platform>.tar.gz
cd lobster-cli-roguelike-<platform>
./lobster-cli-roguelike --version
```

```powershell
# Windows
Expand-Archive lobster-cli-roguelike-windows-x64.zip
.\lobster-cli-roguelike-windows-x64\lobster-cli-roguelike.exe --version
```

二进制不需要 Node、Python 或任何运行时依赖。

## 玩法

### 一局的结构

1. 选择一条龙虾谱系（3 选 1）。
2. 每个**潮段**包含 9 场随机遭遇。
3. 第 2 / 5 / 8 场遭遇后进入**突变潮**，3 选 1 获得永久强化。
4. 第 10 步是**归海闸口**：判定失败即死亡，成功则进入更深、海压更高的下一潮段。
5. 默认无限深潜，直到死亡；也可用 `--content one-cycle` / `three-cycles` 主动收束。

### 属性

| 属性 | 作用 |
|---|---|
| 壳 `壳` | 主要生命线与硬解基础值，归零即死 |
| 能 `能` | 体力与冲刺基础值，归零即死 |
| 盐 `盐` | 环境适应，归零即死 |
| 左钳 / 右钳 | 硬解 / 细解的基础值 |
| 须 | 感知、预判、绕行 |
| 蜕 | 脱壳类动作的次数 |
| 潮势 | 0–2，细解成功积累，硬解与脱壳消耗；直接影响判定 |

### 判定

```
d6 + 动作基础值 + 谱系/潮势加成  >=  动作难度 + 海压
```

- 海压 = `max(0, 潮段 - 1)`，可用 `--difficulty easy|normal|hard` 调整。
- 成功与失败都有明确的属性变化；失败不一定立刻死亡，但会消耗资源。
- 每次判定都会写进本局观察，结算时作为 `LESSONS` 输出。

### 谱系

- **沟壑碎壳者**：壳 7 / 左钳 4，硬解 +2，适合正面顶穿。
- **触须预言家**：须 4 / 能 6，感知与伪装 +1，适合读潮和绕行。
- **脱壳赌徒**：蜕 2，脱壳 +2，适合用次数换机会。

### 遭遇与突变

6 种基础遭遇（章鱼讨债者、拖网阴影、电鳗裂隙、塑料垃圾流、觅食洼地、厨师灯影）+ 归海闸口，每种 3 个动作。7 种突变覆盖左钳、右钳、甲壳、触须、冲刺、脱壳、伪装七条 build 线。

## CLI 参考

```bash
lobster-cli-roguelike new      [--slot N] [--seed N] [--content endless|one-cycle|three-cycles]
                               [--difficulty easy|normal|hard] [--json]
lobster-cli-roguelike status   [--slot N] [--json]
lobster-cli-roguelike actions  [--slot N] [--json]
lobster-cli-roguelike act <id> [--slot N] [--json]
lobster-cli-roguelike recap    [--slot N] [--format text|markdown|html] [--json]
lobster-cli-roguelike saves    [--json]
lobster-cli-roguelike play     [--slot N]
lobster-cli-roguelike observer [--port N]
lobster-cli-roguelike doctor
```

动作 id：

- `lineage:crusher|oracle|gambler`
- `enc:1|2|3`
- `mutation:left|right|shell|sense|dash|molt|camo`
- `abort`（任何时候都能诚实收尾）

全局参数：`--state-dir`、`--json`、`--no-color`、`--no-observer`、`--no-report`、`--force`、`--verbose`。

## 运行时输出

- 存档：`~/.gameclaw/lobster-cli-roguelike/saves/slot-<n>.json`
- 日志：`~/.gameclaw/lobster-cli-roguelike/journals/<run-id>.ndjson`
- 结算：`~/.gameclaw/lobster-cli-roguelike/reports/latest.html` 与 `latest.md`
- 观察者：`new` / `play` 时自动在 `127.0.0.1:8000+` 启动，结束时关闭

用 `--state-dir <path>` 或 `GAMECLAW_HOME` 可以把状态放进沙箱目录，适合并行评测。

## 本地开发

```bash
pnpm install
pnpm --filter @gameclaw/lobster-cli-roguelike test
pnpm --filter @gameclaw/lobster-cli-roguelike check
bun games/lobster-cli-roguelike/src/main.ts new --seed 7
node scripts/build-game.mjs lobster-cli-roguelike
```

## 防逆向边界

二进制减少普通玩家直接翻源码的便利度，但不保证不可逆向、不可篡改。它不是强对抗反作弊系统。

## License

MIT
