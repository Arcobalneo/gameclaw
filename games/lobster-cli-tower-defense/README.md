# 横着守：只给龙虾玩的 CLI 塔防

**Lobster Line Defense** — 一款给 coding agent 玩的 pulse-based 终端塔防，版本 `2.0.0`。

三条 lane 在闸前总卡口 `C` 汇合。你要在归海线被打穿之前，把锅沿杂兵、抽水跳虾、塑圈钻头、电鳗借火体和章鱼搬运手一层层挡下来。每个 pulse 只给你一个介入窗口，然后系统自动结算攻击、卡位、推进和漏怪。

```bash
lobster-cli-tower-defense new --seed 7
lobster-cli-tower-defense act doctrine:crusher
lobster-cli-tower-defense act deploy:reef-guard:C
lobster-cli-tower-defense act ready
lobster-cli-tower-defense act hold
lobster-cli-tower-defense recap
```

## 为什么它是 agent-first 的

- **一次调用 = 一个回合**。`act` 同时返回本回合日志、完整状态和下一步合法动作，agent 不需要额外轮询。
- **稳定 action id**。`doctrine:*` / `deploy:*:*` / `recall:*` / `skill` / `ready` / `hold` 都是可脚本化、可回归测试的字符串。
- **稳定文本锚点**。`GAME / STATE / STAT / ACTIONS / NEXT` 五行结构，正则即可解析；`--json` 则给出结构化状态、动作与事件。
- **确定性**。同一 seed + 同一动作序列 = 同一结果，存档里保存 sfc32 的四个状态字。
- **低 token 的默认输出**。地图是紧凑 ASCII 行，roster / cooldowns / 敌潮预告都压成短行；细节放在 `ActionView.detail`，只在 `--verbose` 或 JSON 里展开。
- **诚实结算**。失败会给可归因的漏怪 lane、最后打穿你的敌人，以及只属于本局的观察草稿，方便写进 agent 自己的 memory。

## 安装（GitHub Releases）

从 [GameClaw Releases](https://github.com/Arcobalneo/gameclaw/releases/latest) 下载对应平台的单文件二进制：

| 平台 | 资产 |
|---|---|
| macOS Apple Silicon | `lobster-cli-tower-defense-darwin-arm64.tar.gz` |
| macOS Intel | `lobster-cli-tower-defense-darwin-x64.tar.gz` |
| Linux x64 | `lobster-cli-tower-defense-linux-x64.tar.gz` |
| Linux arm64 | `lobster-cli-tower-defense-linux-arm64.tar.gz` |
| Windows x64 | `lobster-cli-tower-defense-windows-x64.zip` |

```bash
# macOS / Linux
tar -xzf lobster-cli-tower-defense-<platform>.tar.gz
cd lobster-cli-tower-defense-<platform>
./lobster-cli-tower-defense --version
```

```powershell
# Windows
Expand-Archive lobster-cli-tower-defense-windows-x64.zip
.\lobster-cli-tower-defense-windows-x64\lobster-cli-tower-defense.exe --version
```

二进制内置运行时，不需要 Node、Python 或任何第三方依赖。

## 玩法

### 一局的结构

1. **doctrine 阶段**：三选一，决定初始潮令、完整度、单位折扣与潮技。
2. **setup 阶段**：自由部署和撤回，不消耗 pulse；随时 `act ready` 放敌潮。
3. **battle 阶段**：每个 pulse 只做 **1 个动作**（deploy / recall / skill / hold），然后自动结算。
4. **结算**：归海线完整度归零即失守；守住最后一 pulse 且场上没有敌人即胜利。

### pulse 结算顺序

```
入潮 → 潮技生效 → 单位攻击 → 敌人接触伤害 → 敌人推进 / 漏怪 → 持续型单位计时
```

- `潮令`：部署、再编和发动潮技的资源；每个 pulse 结束后按 doctrine 回复。
- `归海线完整度`：漏怪会扣，归零即失败。
- `拦口（block）`：按敌人 `weight` 占用卡口容量；轻单位占 1，章鱼搬运手占 2。
- `破甲`：减少目标护甲；护甲最多把一次伤害压到 1，不会让攻击完全无效。
- `减速`：扣减本 pulse 移动步数，但站在空路上的敌人每 pulse 至少前进 1 格，避免尾波无限停滞。
- `易伤`：本 pulse 内受到更多伤害，结算后清空。
- `击退`：把目标沿路径往回推。

### 地图与部署位

```
左  L0[.] -> L1[.] -> C[.] -> 海
中  M0[.] -> M1[.] -> C[.] -> 海
右  R0[.] -> R1[.] -> C[.] -> 海
高  LP[.] | RP[.]
```

| 位置 | 类型 | 覆盖 |
|---|---|---|
| `L1` / `M1` / `R1` | 各线前排拦口 | 本线入口来的敌人 + `C` |
| `C` | 三线共享的闸前总卡口 | `C`（所有 lane 共用容量） |
| `LP` | 左高台 | `L0` / `L1` / `M0` / `C` |
| `RP` | 右高台 | `R0` / `R1` / `M0` / `C` |

### 三条 doctrine

| doctrine | 特点 | 潮技 |
|---|---|---|
| 沟壑碎壳者 | 初始潮令 8 / 完整度 8；拦口单位 +2 壳，重钳与闸桩各便宜 1 | `碎壳顶潮`：自动选一个最受压的前排位，本 pulse 攻 +2、拦 +1 |
| 触须预言家 | 初始潮令 7 / 完整度 7；多看 1 个 pulse 预告；须哨与盐口各便宜 1，支援单位攻 +1 | `触须预警`：自动选压力最高的一条 lane，本 pulse 该 lane 敌人减速 +1、易伤 +1 |
| 脱壳赌徒 | 初始潮令 7 / 完整度 7；撤回多返 1、再编冷却 -1、诱饵多活 1 pulse | `脱壳换线`：自动把一个已部署单位挪到更危险的空位，并回 2 点壳 |

### 六个可部署单位

| 单位 | cost | 壳 | 攻 | 拦 | 说明 |
|---|---:|---:|---:|---:|---|
| 礁口重钳 | 4 | 12 | 3 | 2 | 标准前排，只能站 `L1/M1/R1/C` |
| 塑圈剪手 | 3 | 6 | 3 | 0 | 远程，优先剪带甲 / 精英，破甲 1 |
| 须探哨兵 | 3 | 5 | 1 | 0 | 支援，优先快目标；减速 1、易伤 1 |
| 盐沫喷口 | 2 | 5 | 1 | 0 | 小范围溅射，减速 1；适合补 runners |
| 蜕壳诱饵 | 2 | 7 | 0 | 3 | 短命肉盾，默认持续 2 pulse |
| 回涌闸桩 | 4 | 9 | 2 | 1 | 控制前排，攻击会把目标往回推 1 格 |

### 五种敌潮单位

| 敌人 | 壳 | 速度 | 护甲 | 接触伤害 | 漏怪 | 重量 |
|---|---:|---:|---:|---:|---:|---:|
| 锅沿杂兵 | 5 | 1 | 0 | 1 | 1 | 1 |
| 抽水跳虾 | 4 | 2 | 0 | 1 | 1 | 1 |
| 塑圈钻头 | 8 | 1 | 1 | 2 | 1 | 1 |
| 电鳗借火体 | 7 | 1 | 0 | 3 | 1 | 1 |
| 章鱼搬运手 | 14 | 1 | 0 | 3 | 2 | 2 |

## 动作 id

| action id | 作用 |
|---|---|
| `doctrine:crusher` / `doctrine:oracle` / `doctrine:gambler` | 开局选择 doctrine |
| `deploy:<unit-key>:<slot-key>` | 部署一个 ready 单位到合法空位，例如 `deploy:reef-guard:C` |
| `recall:<slot-key>` | 撤回一个已部署单位，返还潮令并进入再编冷却 |
| `skill` | 发动 doctrine 潮技；目标由规则自动选定，detail 里给出具体目标与数值 |
| `ready` | setup → battle，开始敌潮 |
| `hold` | 本 pulse 不干预，直接结算 |
| `abort` | 由 gamekit 提供，任何阶段都能诚实中止 |

`deploy` 只在单位 ready、位置合法且空、潮令足够时出现；`skill` 只在冷却结束、潮令足够且有目标时出现。动作列表顺序稳定，`NEXT` 指向当前第一个合法动作。

单位 key：`reef-guard` / `ring-cutter` / `whisker-scout` / `salt-spray` / `molt-decoy` / `gate-stake`。

slot key：`L1` / `M1` / `R1` / `C` / `LP` / `RP`。

## CLI 参考

```bash
lobster-cli-tower-defense new      [--slot N] [--seed N] [--json]
lobster-cli-tower-defense status   [--slot N] [--json]
lobster-cli-tower-defense actions  [--slot N] [--json]
lobster-cli-tower-defense act <id> [--slot N] [--json]
lobster-cli-tower-defense recap    [--slot N] [--format text|markdown|html] [--json]
lobster-cli-tower-defense saves    [--json]
lobster-cli-tower-defense play     [--slot N]
lobster-cli-tower-defense observer [--port N]
lobster-cli-tower-defense doctor
lobster-cli-tower-defense help
lobster-cli-tower-defense version
```

全局参数：`--state-dir <path>`、`--json`、`--no-color`、`--no-observer`、`--no-report`、`--force`、`--verbose`、`--slot <n>`、`--seed <n>`。

本作目前只有一张 stage；gamekit 通用的 `--content` / `--difficulty` 会被接受但不改变关卡内容。

- 文本模式保持紧凑；`--json` 每回合输出一个对象，包含 `status`、`actions`、`log`、`events`。
- `--force` 覆盖已有 slot；`--state-dir` / `GAMECLAW_HOME` 可把状态放进沙箱目录，适合并行评测。
- 错误使用稳定退出码：`USAGE=2`、`NO_SAVE=3`、`ILLEGAL_ACTION=4`、`INTERNAL=1`。

## 状态与运行时文件

默认根目录是 `~/.gameclaw/`，可用 `--state-dir` 或环境变量 `GAMECLAW_HOME` 覆盖。

| 内容 | 路径 |
|---|---|
| 存档 | `~/.gameclaw/lobster-cli-tower-defense/saves/slot-<n>.json` |
| 回合日志 | `~/.gameclaw/lobster-cli-tower-defense/journals/<run-id>.ndjson` |
| 结算报告 | `~/.gameclaw/lobster-cli-tower-defense/reports/latest.html` / `latest.md` |
| observer 端口文件 | `~/.gameclaw/lobster-cli-tower-defense/observer/daemon.json` |

`new` / `play` 会在 `127.0.0.1:8000+` 自动启动观察页，结束时关闭；失败会明确提示，不会假装观察页存在。

## 本地开发

```bash
pnpm install
pnpm --filter @gameclaw/lobster-cli-tower-defense check
pnpm --filter @gameclaw/lobster-cli-tower-defense test
bun games/lobster-cli-tower-defense/src/main.ts new --seed 7 --state-dir /tmp/td-dev --no-observer
node scripts/build-game.mjs lobster-cli-tower-defense
```

源码结构：

```
src/content.ts     doctrine、单位、敌人、关卡与波次蓝图
src/engine.ts      纯规则状态机与 pulse 结算
src/definition.ts  meta / status / actions / act / abort / recap
src/main.ts        只负责 import definition 并调用 runCli
tests/             engine 与 CLI 回归测试
```

## 与 Python 垂直切片的差异

这是从旧 Python 垂直切片重写来的 TypeScript 版本，玩法骨架保持一致，但修掉了几个会让 agent 卡死的边界：

- **不再有 perma-slow 软锁**：站在空路上的敌人每 pulse 至少前进 1 格；减速仍然对 speed 2 的跳虾有效。
- **护甲保底 1 点伤害**：防止低攻单位面对护甲目标时完全打不动，导致尾波无限停滞。
- **撤回退款封顶**：返还不会超过该单位本次部署成本，避免 setup 里反复 deploy/recall 刷潮令。
- **setup 撤回立即 ready**：setup 是规划阶段，不再因为一次撤回而把自己锁到 battle pulse 2。
- **潮技自动选目标**：`skill` 是唯一动作 id，目标由确定性规则选定，避免多一层 `skill:<target>` 动作空间。

## 防逆向边界

二进制发行会降低普通玩家在下载路径里直接翻源码的便利度，但不承诺不可逆向、不可篡改，也不是强对抗反作弊系统。源码仍保留在 monorepo 的 `games/lobster-cli-tower-defense/`。

## License

MIT
