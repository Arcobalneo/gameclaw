# GameClaw v2 规范化改造计划（跨平台 / TypeScript 重写 / Agent-First CLI）

- 状态：执行中
- 日期：2026-10-18
- 作者：GameClaw maintainers
- 范围：仓库级重构（目录结构、技术栈、五款游戏、构建与发版、文档、分发 Skill）

## 1. 目标

把 `gameclaw` 从“五款各自为政的 Python / Node 混合脚本集合”升级为一个**可长期维护的、跨 macOS / Windows / Linux 的、面向 coding agent 的 CLI 游戏发行仓库**。

完成后必须同时满足：

1. 五款游戏全部可用同一套命令语义游玩：`new / status / actions / act / recap / play`。
2. 五款游戏全部产出 `darwin-arm64`、`darwin-x64`、`linux-x64`、`linux-arm64`、`windows-x64` 五个平台的单文件可执行程序。
3. 仓库根目录的 README、SKILL、catalog、docs 与实现完全一致，不再出现“文档写了但代码没有”的情况。
4. GitHub Actions 能在打 tag 时一次性构建并发布全部平台产物，产物命名、校验和、release notes 全部标准化。
5. 分发 Skill 明确教导 agent：从 GitHub 拉取 release 包体失败时，先按 GitHub520 的方式解决网络问题，再重试，而不是放弃或改走源码。

## 2. 第一性原理：为什么这是一个 coding-agent-first 的游戏仓库

### 2.1 玩家不是人，是工具调用循环

人类玩家面对的是一个持续刷新的屏幕和一条持久的输入流。Agent 玩家面对的是**一次工具调用 = 一个决策点**。因此：

- 长驻 PTY、全屏重绘、光标控制、逐字符读取，对 agent 都是敌意界面。
- 每次调用都应返回**完整自洽的一帧**：我是谁、现在怎样、能做什么、代价是什么、下一步怎么调用。
- 一个回合只应消耗一次工具调用，不能要求 agent 先 `status` 再 `actions` 再 `act` 三次才能走一步。

### 2.2 信息必须可判定，而不是可观赏

Agent 需要的不是氛围，而是**可推理的状态**：数值、枚举、明确的合法动作集合、可归因的随机判定。氛围是第二层，不能替代第一层。

### 2.3 记忆成长发生在 agent 自己身上

游戏不内置“外挂记忆库”。游戏的职责是：在关键节点产出**诚实的、单局限定的观察草稿**，推动 agent 把策略写进自己的 memory。因此每局结束必须有结构化 recap（战果、死因、可验证经验），而不是只输出一句“你死了”。

### 2.4 确定性是可测试性的前提

固定 seed + 固定内容版本 + 固定动作序列 = 完全相同的结局。没有确定性，就没有回归测试，也没有公平的复盘。所有随机都必须走可序列化的 PRNG。

### 2.5 发行形态也是产品的一部分

玩家路径是 `下载 → 解压 → 运行`，不是 `clone → 装依赖 → 跑源码`。因此二进制必须零运行时依赖、启动快、体积可控、跨平台一致。

## 3. 现状诊断

| 问题 | 证据 | 影响 |
|---|---|---|
| 技术栈分裂 | 4 款 Python（uv + Nuitka）+ 1 款 Node/TS（SEA + Ink） | 两套构建、两套测试、两套发版路径 |
| 平台覆盖不一致 | roguelike/TD/heist/tamer 仅 linux-x86_64 + darwin-arm64；sideways-look 仅 linux-x86_64 | Windows 用户完全无法游玩 |
| 交互模型不一致 | Python 游戏是长驻菜单循环 + `--script`；sideways-look 是单步子命令 | Agent 无法用同一套心智模型操作 |
| 无机器可读输出 | 全部为人类文本，无 `--json` | Agent 必须解析自然语言，易错 |
| 状态不可观测 | 存档分散在 cwd / home，无统一 schema | 无法做跨游戏工具、无法排障 |
| 构建脚本脆弱 | `uv sync` 注释里记录了多次 lockfile 事故；sideways-look 用本机 Node 二进制注入 SEA | 本地可过、CI 挂掉 |
| 文档与实现漂移 | README 写着 5 款游戏与平台矩阵，实际 release 只有部分产物；`--terminal-native` 等参数与代码不一致 | 用户与 agent 被误导 |
| 仓库噪音 | `docs/plans/` 里 27 份历史计划、`CHANGELOG.md` 混杂多代实现细节 | 维护者难以判断什么是当前事实 |

## 4. 目标架构

```
gameclaw/
├── packages/
│   └── gamekit/                 # 共享运行时（零第三方运行时依赖）
│       ├── src/
│       │   ├── cli/             # 参数解析、命令分发、文本/JSON 渲染
│       │   ├── runtime/        # 存档、会话、观察者、报告
│       │   ├── game/           # GameDefinition 契约、动作校验
│       │   └── util/           # PRNG、颜色、宽度、时间
│       └── tests/
├── games/
│   └── <game-id>/
│       ├── package.json        # bin + build 脚本
│       ├── src/
│       │   ├── main.ts         # 仅做 runCli(definition)
│       │   ├── definition.ts   # 元数据 + 状态机装配
│       │   ├── engine/         # 纯规则层（无 IO）
│       │   └── content/        # 内容数据（TS 常量 / JSON）
│       ├── tests/              # 引擎测试 + CLI 冒烟测试
│       └── README.md           # 该游戏唯一文档入口
├── catalog/games.json          # 机器可读目录（平台、资产、入口）
├── scripts/                    # repo 级 build/test/release 入口
├── .github/workflows/          # ci.yml + release.yml
├── docs/                       # 架构、发版、设计准则、计划归档
├── SKILL.md                    # 可分发 Skill（自包含）
├── README.md / README.zh-CN.md # 人类入口
└── package.json / pnpm-workspace.yaml / tsconfig.base.json
```

### 4.1 分层边界

- `packages/gamekit`：**不知道任何具体游戏**，只提供契约与运行时。
- `games/<id>`：**不知道终端以外的世界**，只实现状态机与内容，不直接 `process.exit`、不直接读 `process.argv`。
- `scripts/*`：唯一允许同时了解仓库布局与构建工具的层。
- `catalog/games.json`：唯一机器可读的游戏清单；README / SKILL 由它派生（人工同步 + CI 校验）。

### 4.2 依赖方向

`games/* → gamekit`，禁止反向依赖；`gamekit` 不依赖任何游戏。

## 5. 技术选型

| 维度 | 选择 | 理由 |
|---|---|---|
| 语言 | TypeScript 5.9，`strict: true` | 类型即文档；重构安全；生态成熟 |
| 模块 | ESM，`moduleResolution: bundler` | 与 Bun / Vitest / 现代打包器一致 |
| 运行时 | Node.js ≥ 22（开发）、Bun 1.3（编译产物） | Bun `build --compile` 是当前最成熟的 TS → 单文件跨平台方案 |
| 包管理 | pnpm 10 workspace | 严格的依赖边界、磁盘友好、CI 快 |
| 测试 | Vitest 3 | TS 原生、快、快照与覆盖率完善 |
| Lint/Format | Biome 2 | 单工具、零配置冲突、比 ESLint+Prettier 快一个量级 |
| CLI 解析 | `node:util.parseArgs` + gamekit 薄封装 | 标准库、零依赖、完全可控的 JSON 错误 |
| 终端渲染 | 自研 ANSI 文本层 | 无依赖、可测试、天然支持 `NO_COLOR` / 非 TTY |
| 观察者页面 | `node:http` + 轮询 JSON | 跨平台、无 SSE/WebSocket 代理问题 |
| 报告 | 内联 CSS 的静态 HTML | 可离线打开、可归档、无外部资源 |
| 发行 | GitHub Actions matrix + 单文件二进制 | 玩家零依赖 |

**零第三方运行时依赖**是刻意选择：二进制更小、冷启动更快、无供应链与原生模块风险、五平台行为一致。开发期依赖（TypeScript、Vitest、Biome、Bun types）不进入产物。

## 6. 统一 CLI 契约（v2 核心）

所有游戏共享同一套命令。这是本次改造最重要的产物。

```bash
<game> new      [--slot N] [--seed N] [--content X] [--json]
<game> status   [--slot N] [--json]
<game> actions  [--slot N] [--json]
<game> act <action-id> [--slot N] [--json]
<game> recap    [--slot N] [--format text|markdown|html] [--json]
<game> saves    [--json]
<game> play     [--slot N] [--seed N]      # 人类交互模式
<game> observer [--slot N] [--port N]      # 前台观察者
<game> help | version
```

全局选项：

- `--state-dir <path>` / `GAMECLAW_HOME`：状态根目录，默认 `~/.gameclaw`
- `--json`：机器可读输出；stdout 只输出一个 JSON 对象
- `--no-color` / `NO_COLOR` / 非 TTY：关闭 ANSI
- `--no-observer` / `--observer`：关闭/强制开启本地观察者
- `--no-report` / `--report`：关闭/强制开启 HTML 结算报告
- `--force`：允许覆盖进行中的存档

### 6.1 文本输出契约

文本模式使用稳定锚点，便于 agent 正则提取，也便于人阅读：

```
GAME   lobster-cli-roguelike v2.0.0  slot=0  turn=3  outcome=ongoing
STATE  潮段 2 · 深度 12 · 沟壑碎壳者 · 海压 +1
STAT   shell=6 energy=4 salinity=5 ...
---
<section lines>
---
ACTIONS
  [1] enc:1  左钳硬拼   risk=medium  左钳+壳/2 vs 9
  [2] enc:2  墨雾伪装   risk=low
NEXT   act enc:1
```

### 6.2 JSON 输出契约

```json
{
  "ok": true,
  "game": { "id": "...", "name": "...", "version": "2.0.0" },
  "slot": 0,
  "runId": "r-...",
  "turn": 3,
  "outcome": "ongoing",
  "status": { "headline": "...", "metrics": [...], "sections": [...] },
  "actions": [{ "id": "...", "label": "...", "risk": "medium" }],
  "log": ["..."],
  "events": [{ "type": "...", "...": "..." }],
  "report": { "html": "...", "markdown": "..." },
  "observer": { "url": "http://127.0.0.1:80xx" },
  "next": "act enc:1"
}
```

错误：

```json
{ "ok": false, "error": { "code": "ILLEGAL_ACTION", "message": "...", "hint": "..." } }
```

退出码：`0` 成功、`1` 内部错误、`2` 用法错误、`3` 存档不存在、`4` 非法动作。

### 6.3 一次调用完成一个回合

`act` 必须返回：本回合发生了什么（log/events）+ 结算后的完整状态 + 新的合法动作集合。Agent 不需要额外调用 `status`。

### 6.4 确定性

- 状态内存放 PRNG 状态（4 × uint32），每次动作后更新。
- `seed` 写入存档；同一 seed + 同一动作序列 + 同一版本 = 同一结果。
- 所有内容版本随二进制编译，不读取外部可变文件（除非显式 `--content`）。

## 7. 五款游戏的规范化方案

| 游戏 | 核心循环 | v2 状态机 | 关键改造 |
|---|---|---|---|
| 横着活（roguelike） | 潮段内 9 场遭遇 + 归海闸口，无限深潜 | `lineage → encounter → mutation → ended` | 遭遇/突变数据化；判定公式外显；`--max-cycles` 保留 |
| 横着守（tower-defense） | pulse 制塔防，部署/撤回/潮技 | `doctrine → setup → battle → ended` | 槽位与波次内容化；预告可机读 |
| 横着潜（heist） | 网格潜行，取物后撤离 | `profile → infiltrate → extract → ended` | 视线/噪音规则显式化；撤离压力保留 |
| 横着抓（tamer） | 捕捉、养成、词条工坊、深渊永久死亡 | `menu → overworld → battle → abyss → ended` | 复用现有 JSON 内容；核心系统保留 |
| 横着看（sideways-look） | 单步观察、记录异常、撤离 | `new → room → ended` | 移除 Ink/React/rot-js；改为 gamekit 单步模型 |

每款游戏必须提供：

- `README.md`：机制、命令、内容列表、观察者与报告说明
- `tests/`：确定性脚本跑通至少一条胜利路径和一条失败路径
- `definition.ts`：只装配，不写规则
- `engine/`：纯函数或纯状态机，禁止 IO

## 8. 跨平台与发版

### 8.1 产物矩阵

| 平台 | 运行器 | 产物 |
|---|---|---|
| linux-x64 | `ubuntu-24.04` | `*.tar.gz` |
| linux-arm64 | `ubuntu-24.04-arm` | `*.tar.gz` |
| darwin-arm64 | `macos-14` | `*.tar.gz` |
| darwin-x64 | `macos-14`（交叉编译） | `*.tar.gz` |
| windows-x64 | `windows-2025` | `*.zip` |

### 8.2 命名

`<game-id>-<os>-<arch>.<ext>`，例如 `lobster-cli-heist-darwin-arm64.tar.gz`。
归档内目录同名，包含二进制、`README.md`、`LICENSE`、`SHA256SUMS`。

### 8.3 发版流程

1. 更新 `CHANGELOG.md` 与 `catalog/games.json` 的版本。
2. 打 tag `vX.Y.Z`。
3. `release.yml` 并行构建 25 个产物（5 游戏 × 5 平台）。
4. 汇总 `SHA256SUMS-<platform>`，创建 GitHub Release，附 generate_release_notes。
5. CI 在 PR 上跑 typecheck / lint / test / 五平台 smoke build，不发布。

## 9. 文档分层（保留并强化）

- `README.md` / `README.zh-CN.md`：给**人**的稳定入口，教用户如何让 agent 发现并启动游戏。
- `SKILL.md`：给 **agent** 的稳定分发技能，自包含，必须包含平台矩阵、资产名、启动命令、网络排障。
- `catalog/games.json`：机器可读事实源。
- `games/<id>/README.md`：单游戏机制与操作细节。
- `docs/`：维护者文档（架构、发版、设计准则、计划归档）。
- `docs/plans/`：历史计划归档，不承诺与当前实现一致；当前事实以 `docs/` 其余文档为准。

### 9.1 新增：GitHub 网络排障指引

`SKILL.md` 必须包含以下事实与操作：

- 症状：`curl` / `gh release download` 超时、TLS 握手失败、连接重置、下载速度接近 0。
- 首选：按 [GitHub520](https://github.com/521xueweihan/GitHub520) 的方式刷新本机 hosts，再重试。
- 次选：使用本机代理（如 Clash）设置 `HTTPS_PROXY` 后重试。
- 最后：改用 `gh release download` 或镜像加速地址，并在回复中明确告知玩家当前使用的是哪种降级路径。
- 禁止：静默失败、假装资产不存在、直接改走源码构建。

## 10. PR 拆分

按可独立 review 的栈式 PR（每个 PR 的 base 是上一个 PR 的分支）：

1. `docs(v2): 规范化改造计划`
2. `feat(core): TS monorepo 基础与 gamekit`
3. `feat(roguelike): 重写为 gamekit 游戏`
4. `feat(tower-defense): 重写为 gamekit 游戏`
5. `feat(heist): 重写为 gamekit 游戏`
6. `feat(tamer): 重写为 gamekit 游戏`
7. `feat(sideways-look): 重写为 gamekit 游戏`
8. `feat(release): 五平台构建与发版流水线`
9. `docs: README / SKILL / catalog / docs 全量刷新，移除 Python 遗留`

每个 PR 必须：CI 绿、文档同步、无跨 PR 的隐式依赖（栈内顺序除外）。

## 11. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 重写导致玩法回退 | 每款游戏保留原有核心循环与内容语义；用确定性脚本测试覆盖胜/负路径 |
| Bun 编译在 Windows/macOS 行为差异 | CI 五平台真实构建 + 冒烟运行；不依赖原生模块 |
| 观察者端口/进程泄漏 | 单实例端口文件 + 健康检查 + TTL + 结束时 `POST /shutdown` |
| 存档格式演进 | 存档带 `schema` 与 `gameVersion`；不兼容时明确报错并提示 `new --force` |
| 文档再次漂移 | catalog 为唯一事实源；CI 校验 README/SKILL 与 catalog 的平台矩阵一致 |
| 旧玩家存档失效 | v1 → v2 不承诺存档迁移；README 明确说明，旧版本继续可用 |

## 12. 验收清单

- [ ] `pnpm install && pnpm check` 在 macOS / Linux / Windows 全绿
- [ ] `pnpm test` 五款游戏全绿（含确定性脚本回归）
- [ ] 五款游戏本地均可 `new → act → ... → recap` 跑通
- [ ] 每款游戏至少一个平台二进制在 CI 中真实构建并 `--version` 冒烟
- [ ] `catalog/games.json` 与 README / SKILL 平台矩阵一致
- [ ] `SKILL.md` 含 GitHub520 网络排障章节
- [ ] `docs/` 无与实现矛盾的描述；历史计划明确标注“归档”
- [ ] 五个栈式 PR 均通过 CI
- [ ] ClawHub 上的 `gameclaw` skill 更新到与仓库 `SKILL.md` 一致

---

## 13. 执行记录（2026-10-18）

按栈式 PR 落地，每个 PR 的 base 是上一个 PR 的分支：

| 分支 | 内容 | 验证 |
|---|---|---|
| `v2/01-plan` | 本计划 | 文档审阅 |
| `v2/02-foundation` | pnpm workspace、`packages/gamekit`、脚本、CI | gamekit 22 个单测；`pnpm check` |
| `v2/03-games` | 五款游戏 TS 重写 + 删除 Python 工具链 | 每款游戏 engine/CLI 测试；真实二进制 smoke |
| `v2/04-release` | 五平台构建与发版流水线 | 本机交叉编译 darwin/linux/windows；YAML 校验 |
| `v2/05-docs` | README / SKILL / catalog / docs 全量刷新 | `validate-catalog` + 链接检查 |

落地时确认的关键事实：

- `gamekit` 的文本 / JSON 契约在五款游戏中一致，`act` 单次调用即可完成一个回合。
- macOS 产物做 ad-hoc codesign；Windows 产物为未签名 exe，README 已如实说明。
- 观察者只监听 `127.0.0.1`，局终通过带 token 的 `/shutdown` 停止，并删除端口文件。
- 所有状态均为纯 JSON；RNG 状态随存档保存，确定性回归测试覆盖每款游戏。
- v0.x 存档不迁移；旧 release 继续可用。
