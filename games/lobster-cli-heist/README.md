# 横着潜：只给龙虾玩的 CLI 潜行渗透

**Lobster CLI Heist** — 一款给 coding agent 玩的短局潜行 heist。你是龙虾渗透手，要在两排货架、镜头和巡逻蟹之间摸到目标，再在设施锁死前横着撤出去。

```bash
lobster-cli-heist new --seed 7
lobster-cli-heist act choose:runner
lobster-cli-heist act move:e
lobster-cli-heist recap
```

当前版本 `2.0.0`，运行在 GameClaw 的 TypeScript `gamekit` v2 运行时上。旧 Python vertical slice 已退役。

## 为什么它是 agent-first 的

- **一次调用 = 一个回合**。`act` 返回本回合日志、完整状态、下一批合法动作；agent 不需要在 `status` / `actions` 之间反复查询。
- **稳定文本锚点**。`GAME / STATE / STAT / ACTIONS / NEXT` 的结构可以直接正则解析。
- **`--json` 输出**。每回合一个 JSON 对象，包含 `status`、`actions`、`events`、`observer`、`report` 与 `next`。
- **确定性**。同一 seed + 同一动作序列 = 完全相同的结局；save 里保存 sfc32 的 `rng` 状态，可回放、可做回归测试。
- **动作带数字风险**。每个 `ActionView.detail` 都写出目标格、噪音、预计曝光、sensor 或下一拍巡逻，不靠猜。
- **诚实结算**。失败会给出可归因的 cause 和单局限定的观察草稿，鼓励写进 agent 自己的 memory。

## 安装（推荐：GitHub Releases）

从 [GameClaw Releases](https://github.com/Arcobalneo/gameclaw/releases/latest) 下载对应平台的单文件二进制：

| 平台 | 资产 |
|---|---|
| macOS Apple Silicon | `lobster-cli-heist-darwin-arm64.tar.gz` |
| macOS Intel | `lobster-cli-heist-darwin-x64.tar.gz` |
| Linux x64 | `lobster-cli-heist-linux-x64.tar.gz` |
| Linux arm64 | `lobster-cli-heist-linux-arm64.tar.gz` |
| Windows x64 | `lobster-cli-heist-windows-x64.zip` |

```bash
# macOS / Linux
tar -xzf lobster-cli-heist-<platform>.tar.gz
cd lobster-cli-heist-<platform>
./lobster-cli-heist --version
```

```powershell
# Windows
Expand-Archive lobster-cli-heist-windows-x64.zip
.\lobster-cli-heist-windows-x64\lobster-cli-heist.exe --version
```

二进制不需要 Node、Python 或任何运行时依赖。

## 一局的结构

1. **setup**：先看设施 / 安保 / 目标 / 麻烦的简报，再从 3 条 profile 中选 1 条。`new` 后先用 `act choose:<key>`。
2. **infiltrate**：在两行 × 七列的设施里移动、读节奏、开终端、摸缓存，找到真正的候选货格。
3. **extraction**：拿到目标后自动进入带货撤离段。脚步变响、响应者切入、撤离窗开始倒数。
4. **settlement**：撤离成功 `won`，被抓 `lost`，主动收壳 `aborted`。

每回合只做一个主动作。`observe` / `wait` 也会让设施推进一拍。

## 地图与移动

地图是 `2 行 × 7 列`，行标记为 `上` / `下`，列从 1 开始。格子地形：

- `#` 掩体格：隐蔽度 1
- `:` 暗格：隐蔽度 1
- `.` 开阔格：隐蔽度 0

关键设施：`X` 撤离快门、`T` 终端、`$` 侧缓存、`?` 未确认货格、`O` 已确认真目标、`E` 已排空的货格、`V` 通风口、`~` 喷发中的蒸汽格。

移动规则：

- `move:e` / `move:w`：左右走 1 格。
- `move:n` / `move:s`：只在**爬升列**可用；爬升列随设施不同，地图下的简报会提示。
- 站在通风口端点时，朝另一端的方向走会触发 **vent 滑潜**，一次跨过整段通风管。
- **带货后 vent 失效**，而且带货脚步更响；这是撤离段的核心压力。
- 不能走进巡逻蟹 / 快速响应者当前占据的格子。

## 三条 profile

| key | 名称 | 初始 gear | 被动 | 撤离窗 |
|---|---|---|---|---|
| `shade` | 藻披影行者 | 墨幕壳 ×2 | 暗格 / 蒸汽里等待更强；观察后位移更静 | +0 |
| `breaker` | 断钳拆闸手 | 干扰钉 ×2 | 终端不制造噪音；卡涩快门不挡路 | +1 |
| `runner` | 脱壳快撤者 | 空壳冲刺 ×2 | 取物后第一次位移更轻 | +1 |

`gear` 的效果：

- **墨幕壳**：在当前格留下 2 拍墨幕（隐蔽度 3），并立刻曝光 -2。
- **干扰钉**：按最要紧的威胁自动选目标：镜头 > sensor > 巡逻蟹；断钳手的被动让卡涩快门本来就不挡路。
- **空壳冲刺**：朝当前目标自动冲刺 2 格，绕开守卫，并在这拍少吸 1 点曝光。没有可用路线时原地缩壳，曝光 -2。

## 设施 / 安保 / 目标 / 麻烦

**3 套设施骨架**：

- `cold-rack`：低温挂架 A-12，上排开阔挂架，下排排水沟。
- `galley-backline`：后厨背线 3 号灶后，蒸汽、帘布和备货格挤在一起。
- `dock-drain`：码头仓道 D-4，上层仓道直而暴露，下层排水回路安全但难回头。

**3 套安保包**：

- `line-watch`：直线盯守组，上层看线员 + 底层搬运蟹巡逻。
- `servo-cam`：摆扫镜头组，镜头节奏 + 终端附近 sensor。
- `seal-crew`：封锁响应组，上层巡逻 + 快速响应者。

**3 套目标包**：

| 目标 | 真目标规则 | 线索 | 撤离窗 | 带货噪音 | 假警报 | 缓存收益 | 目标分 |
|---|---|---|---|---|---|---|---|
| 盐账账本 | `upper_inner` | 高位货格、非最外侧 | 8 | +1 | +1 | 真目标情报 | 7 |
| 活体样本罐 | `farthest_exit` | 终端锁定最低温格 | 8 | +2 | +2 | 带货噪音 -1 | 9 |
| 黄铜钥环 | `lower_deep` | 最深、偏低 | 7 | +1 | +1 | 撤离窗 +2、快门可开 | 8 |

目标包会与 profile 的撤离加成叠加；实际窗口在 pickup 时显示在 `窗` 指标里。

**4 套 complication**：

- `steam-backflow`：每 3 拍蒸汽喷发，遮视线但也制造噪音。
- `jammed-shutter`：带货后快门卡涩，需要终端或缓存里的旧通行环处理；断钳手的被动直接无视它。
- `overtime-sorter`：多一名临时加班看线员。
- `slick-floor`：带货噪音 +1。

## 曝光、噪音与检测

- **曝光**：watcher 视线、镜头扫线、巡逻蟹近线、响应者贴身都会加曝光。上限普通难度 `9`（easy `10`、hard `8`），达到上限即 `lost`。
- **隐蔽度**：掩体 / 暗格 `1`，蒸汽格 `2`，墨幕 `3`；watcher 和镜头对隐蔽度 ≥2 的格子基本无感。
- **噪音**：普通移动到暗格为 0，其余为 1；带货会叠加目标包与 complication 的噪音。噪音 ≥2 会把巡逻蟹拉向声源；只要有已确认的动静，同排 watcher 就会转头。
- **警戒**：0–3。噪音 ≥2、踩上 sensor、误开空货格都会推高；低警戒安静两拍可以回落。
- **观察**：`observe` 读下一拍巡逻 / 镜头，并在掩体 / 暗格里额外压 1 点曝光；它还会让**紧接着的下一次位移或冲刺**噪音 -1（`shade` 为 -2）。
- **sensor**：踩上即 `噪音 +2`、`警戒 +1`；站在 sensor 上做任何动作都会再次触发。

## 撤离段

拿到真目标后：

- `alert` 至少 2；
- 撤离窗写入 save，之后每个非 pickup 动作倒数 1；
- 带货移动噪音更高；
- 快速响应者在若干拍后从设施中部切入，并沿最短路径追你；同格即 `lost`；
- 在 `X` 撤离快门执行 `interact:extract`：快门没卡就 `won`，卡住则先处理闸门。

`interact:console` 可以预开卡涩快门、让镜头停 1 拍、在部分目标包上锁定真目标。`interact:cache` 给一次性的路线收益，但会消耗最贵的节奏。

## 胜负与战绩

- `won`：带货从撤离快门出去。
- `lost`：曝光达到上限 / 被巡逻蟹或响应者撞上 / 撤离窗归零。
- `aborted`：随时可以 `act abort` 诚实收尾，不会伪装成胜利或死亡。

账面分来自目标分 + 撤离奖励，再按警戒、回合数、误开空格和是否撤离做修正。最终以 `recap` 的 `账面` 为准。

## 动作 id

```text
choose:shade | choose:breaker | choose:runner     # setup 阶段
move:n | move:s | move:e | move:w                 # 一个方向 = 一次位移
observe                                           # 读下一拍；下一次位移噪音 -1/-2
wait                                              # 隐蔽等待，压曝光
interact:console                                  # 终端
interact:cache                                    # 侧缓存
interact:objective                                # 检查 / 拿取候选货格
interact:extract                                  # 带货撤离（需站在出口）
gear                                              # 当前 profile 的 gear
abort                                             # gamekit 提供的诚实收尾
```

`ActionView.detail` 会写出具体数字：目标格、噪音、预计曝光、sensor、下一拍巡逻与剩余道具次数。

## CLI 参考

```bash
lobster-cli-heist new      [--slot N] [--seed N] [--content cold-rack|galley-backline|dock-drain]
                           [--difficulty easy|normal|hard] [--json]
lobster-cli-heist status   [--slot N] [--json]
lobster-cli-heist actions  [--slot N] [--json]
lobster-cli-heist act <id> [--slot N] [--json]
lobster-cli-heist recap    [--slot N] [--format text|markdown|html] [--json]
lobster-cli-heist saves    [--json]
lobster-cli-heist play     [--slot N]
lobster-cli-heist observer [--port N]
lobster-cli-heist doctor
lobster-cli-heist help | version
```

全局参数：`--state-dir`、`--json`、`--no-color`、`--no-observer`、`--no-report`、`--force`、`--verbose`。

`--content` 固定设施骨架；`--difficulty` 只影响曝光上限和撤离窗（easy 更宽，hard 更紧）。

### 一个可复现的 13 步胜利示例

```bash
lobster-cli-heist new --seed 7 --state-dir /tmp/heist-demo --no-observer
lobster-cli-heist act choose:runner --state-dir /tmp/heist-demo --no-observer
lobster-cli-heist act move:e --state-dir /tmp/heist-demo --no-observer
lobster-cli-heist act move:e --state-dir /tmp/heist-demo --no-observer
lobster-cli-heist act move:e --state-dir /tmp/heist-demo --no-observer
lobster-cli-heist act interact:objective --state-dir /tmp/heist-demo --no-observer
lobster-cli-heist act gear --state-dir /tmp/heist-demo --no-observer
lobster-cli-heist act move:e --state-dir /tmp/heist-demo --no-observer
lobster-cli-heist act move:w --state-dir /tmp/heist-demo --no-observer
lobster-cli-heist act move:w --state-dir /tmp/heist-demo --no-observer
lobster-cli-heist act gear --state-dir /tmp/heist-demo --no-observer
lobster-cli-heist act move:w --state-dir /tmp/heist-demo --no-observer
lobster-cli-heist act move:w --state-dir /tmp/heist-demo --no-observer
lobster-cli-heist act interact:extract --state-dir /tmp/heist-demo --no-observer
```

## 运行时路径

默认状态根是 `~/.gameclaw/lobster-cli-heist/`：

- 存档：`saves/slot-<n>.json`
- 日志：`journals/<run-id>.ndjson`
- 结算：`reports/latest.html` 与 `reports/latest.md`
- 观察者：`observer/daemon.json`（记录端口与 token）

`new` / `play` 会自动从 `127.0.0.1:8000` 起找空闲端口启动本地 observer 页面；局结束时 server 停止，同时保留静态 HTML / Markdown 结算页。用 `--no-observer` / `--no-report` 可以显式关闭。`--state-dir <path>` 或 `GAMECLAW_HOME` 可以把状态放进沙箱目录，适合并行评测。

## 本地开发

```bash
pnpm install
pnpm --filter @gameclaw/lobster-cli-heist check
pnpm --filter @gameclaw/lobster-cli-heist test
bun games/lobster-cli-heist/src/main.ts new --seed 7
node scripts/build-game.mjs lobster-cli-heist
```

零第三方运行时依赖：游戏只使用 `node:*` 与 `@gameclaw/gamekit`。

## 防逆向边界

二进制减少普通玩家直接翻源码的便利度，也让下载与启动体验更接近正常 CLI 游戏；它**不保证**不可逆向、不可篡改，也不是强对抗反作弊系统。源码仍保存在 monorepo 的 `games/lobster-cli-heist/` 里。

## License

MIT
