# 横着抓：只给龙虾玩的 CLI 捕兽养成

**Lobster Sideways Catch** — 一款给 coding agent 玩的终端捕兽养成游戏。
`lobster-cli-tamer` v2.0.0，TypeScript 重写版，共享 GameClaw v2 gamekit 运行时。

你是一名甲录师，在潮礁海域捕捉、培养、编队虾米。野外抓宠、词条工坊洗词条、无尽深渊刷材料——深渊里 HP 归零就是永久死亡，撤退时疫病还要掷死亡骰。

```bash
lobster-cli-tamer new --seed 7
lobster-cli-tamer act menu:explore
lobster-cli-tamer act zone:reef_zone
lobster-cli-tamer act choice:step
lobster-cli-tamer act encounter:catch
lobster-cli-tamer act catch:bait
lobster-cli-tamer act catch:ball
```

## 内容规模

- 6 个元素物种池（潮 / 电 / 岩 / 毒 / 灵 / 传说），共 **111 只虾米**
- **701** 条技能数据（4 技能上限、类型、状态、连击、反伤、护盾、优先级）
- **100** 个词条（common / blue / purple / gold 四阶）
- 6 片海域、17 个子区域，按深渊最深层解锁
- 10 种道具与材料（甲网、精甲网、灵甲网、灵光球、大小潮药、净疫盐、甲核、灵晶、潮石、深渊灵晶）
- 无尽深渊：普通 / 精英 / BOSS，每 10 层 BOSS，通关目标第 60 层

## 为什么它是 agent-first 的

- **一次调用 = 一个回合**。`act` 返回本回合日志、完整状态和下一步全部合法动作，不需要额外 `status` + `actions` 往返。
- **稳定文本锚点**。`GAME / STATE / STAT / ACTIONS / NEXT` 五段结构，正则即可解析；`ActionView.detail` 携带伤害、捕捉率、费用等数字。
- **`--json` 输出**。每回合恰好一个 JSON 对象，包含 `status`、`actions`、`log`、`events`、`next`。
- **确定性回放**。状态里的 `rng: number[]` 是 sfc32 四字状态；同 seed + 同动作序列 = 完全相同的一局。
- **紧凑状态**。headline 给区域/层数，metrics 给存活、队伍 HP、货币、最深，sections 只给队伍摘要、当前战斗/遭遇和最近观察。
- **诚实结算**。`recap` 给出可归因的结束原因和“单局观察”，鼓励写进 agent 自己的 memory，而不是伪装成稳定规律。
- **随时可停**。`act abort` 永远可用，结束为 `aborted`，不会伪装成胜利或死亡。

## 核心循环

1. **主菜单**：选野外、直接找遭遇、深渊、工坊、队伍、道具或保存。
2. **野外**：按 3-8 步的节奏推进；遭遇后选择战斗、捕捉或溜走。
3. **战斗/捕捉**：先削弱再投网；捕捉成功直接入队，失败进入战斗。
4. **养成**：升级、进化、学技能；在工坊重投/升阶/封印词条。
5. **深渊**：承担污染、疫病和永久死亡风险，换取甲核/灵晶/潮石与深层解锁。
6. **目标**：抵达深渊第 60 层，解锁全部海域并结算为 `won`。

## 系统

### 捕捉

- 捕捉率 = 物种基础率 × 球倍率 × HP 系数（<30% ×1.5，<60% ×1.2）× 状态系数（中毒/灼烧 ×1.2，麻痹/冰封/困惑 ×1.5）× 灵光惩罚（×0.7），上限 95%。
- `catch:ball` 自动投出当前最强的捕捉工具；`catch:bait` 每场限一次，捕捉率 +20%，但如果这一球失败，敌方先手。
- 捕捉失败会立刻进入战斗；战斗里也可以用 `item:<捕捉球 id>` 投球，失败会被反击。
- 捕捉成功时按物种槽位数 + 灵光额外 1 槽 roll 满词条；灵光个体进入 `shinyCaught`。

### 队伍与仓库

- 队伍 6 槽，仓库无限。捕捉优先填队伍空槽，满了进仓库。
- `party:swap:<队伍槽>:<仓库序号>`：空槽直接填入，否则交换。
- `party:release:<idx>` 退回仓库；`party:heal:<idx>` 消耗小潮药回复 25%。
- **野外**战斗倒地不会永久死亡：战斗结束全队以 25% HP 苏醒。
- **深渊**战斗内 HP 归零立即永久死亡，移入纪念碑；全灭后若仓库还有虾米会自动补一人进队。

### 战斗

- 每只虾米最多 4 个技能，按速度决定出手顺序，技能可带 `priority` 抢先。
- 类型克制：潮→电→岩→毒→灵→潮，克制 ×1.5；技能类型与物种类型分离。
- 状态：中毒/灼烧每回合扣 5% 最大 HP，灼烧还会持续降攻；麻痹 30% 跳过；冰封跳过一回合；困惑 35% 自伤。
- 伤害、暴击（6.25%，×1.5）、连击、回复、护盾（每回合衰减 50%）、反伤、条件增伤全部由数据驱动。
- 胜利给 EXP 与掉落；升级按 `ceil(50 × 1.15^(level-1))` 递进，偶数级且技能未满 4 个时进入 `skill` 阶段三选一。
- 数据支持进化：等级达到 `min_level` 自动进化，重算属性、替换基础技能并记入图鉴。

### 词条工坊

- 每只虾米 2-4 个词条槽（灵光 +1），词条分 common / blue / purple / gold。
- `workshop:reroll:<槽>`：保持品阶随机换内容，消耗甲核 ×3。
- `workshop:upgrade:<槽>`：升到下一品阶，按当前品阶消耗灵晶 ×2 / ×5 / ×12。
- `workshop:seal:<槽>`：锁定词条，消耗潮石 ×1；`workshop:unseal:<槽>` 解封，消耗潮石 ×2。
- 战斗触发：`on_deal_damage`、`on_take_damage`、`on_turn_start`、`on_turn_end`、`on_hp_threshold`、`on_switch_in`、`passive_team`。

### 无尽深渊

- 每层递增敌人等级；每 5 层精英（多一个词条），每 10 层 BOSS（两个词条，部分 BOSS 必带疫病）。
- 每通过一层，全队累积深渊污染；污染满 5 转化为疫病，已有疫病则继续累加层数。
- **撤退 / 放弃战斗 / 全灭**都会结算疫病：每只虾米死亡率 = `min(疫病层数 × 3%, 25%)`，死亡即永久移入纪念碑。
- 未满 5 的污染会在撤退后保留，需要净疫盐净化。
- 最深纪录解锁海域（10 / 20 / 30 / 40 / 60 层），通关目标为第 60 层。
- 深渊层间只能用治疗药，不能回工坊；这是“何时撤退”的核心压力。

## 动作 id

| 阶段 | 动作 id | 说明 |
|---|---|---|
| 主菜单 | `menu:explore` `menu:battle` `menu:abyss` `menu:workshop` `menu:party` `menu:items` `menu:save` | `menu:battle` 跳过步数直接抽一次遭遇 |
| 区域 | `zone:<zone-id>` | 潮礁区 / 深流峡谷 / 毒藻丛林 / 暗礁荒野 / 热泉秘境 / 深海裂隙 |
| 子区域 | `choice:sub:<sub-area-id>` | 选择等级段与遭遇表 |
| 探索 | `choice:step` `choice:leave` | 一步一回合，3-8 步一次遭遇 |
| 遭遇 | `encounter:fight` `encounter:catch` `encounter:flee` | 战斗 / 进入捕捉 / 按速度溜走 |
| 捕捉 | `catch:ball` `catch:bait` | 投最强球 / 撒诱饵 |
| 战斗 | `move:<0-3>` `swap:<party-idx>` `item:<item-id>` `run` | 技能 / 换人 / 药或球 / 逃跑（深渊=放弃本局） |
| 升级 | `choice:skill:<0-2>` `choice:skill:skip` | 三选一学技能，或跳过 |
| 队伍 | `party:swap:<slot>:<box-idx>` `party:heal:<idx>` `party:release:<idx>` | 换位 / 治疗 / 退回仓库 |
| 道具 | `item:<item-id>` `item:cure_plague` `choice:cure:<idx>` | 全队治疗 / 选净化目标 |
| 工坊 | `choice:target:<idx>` `workshop:reroll:<slot>` `workshop:upgrade:<slot>` `workshop:seal:<slot>` `workshop:unseal:<slot>` `workshop:back` | 先选虾米再选槽 |
| 深渊 | `abyss:enter` `abyss:next` `abyss:retreat` | 进入 / 下一层 / 撤退结算 |
| 通用 | `choice:back` `choice:menu` `choice:target:<idx>` `choice:cure:<idx>` | 返回与目标选择 |
| 任意 | `abort` | 诚实中止本局 |

运行时支持 id 前缀匹配；完整 id 最稳。

## CLI 参考

```bash
lobster-cli-tamer new      [--slot N] [--seed N] [--content <species-id>] [--difficulty easy|normal|hard] [--json]
lobster-cli-tamer status   [--slot N] [--json]
lobster-cli-tamer actions  [--slot N] [--json]
lobster-cli-tamer act <id> [--slot N] [--json]
lobster-cli-tamer recap    [--slot N] [--format text|markdown|html] [--json]
lobster-cli-tamer saves    [--json]
lobster-cli-tamer play     [--slot N]
lobster-cli-tamer observer [--port N]
lobster-cli-tamer doctor
lobster-cli-tamer help | version
```

全局参数：`--state-dir <path>`、`--json`、`--no-color`、`--no-observer`、`--no-report`、`--force`、`--verbose`。
`GAMECLAW_HOME` 可覆盖状态根目录；`--content` 用来指定起始物种（默认 `reef_shrimp`），便于确定性测试。
`--difficulty easy` 会把敌人等级压到队伍附近、敌方伤害 ×0.6、捕捉率 +5%；`hard` 则相反。

## 运行时输出

以默认状态根 `~/.gameclaw` 为例：

- 存档：`~/.gameclaw/lobster-cli-tamer/saves/slot-<n>.json`
- 流水：`~/.gameclaw/lobster-cli-tamer/journals/<run-id>.ndjson`
- 结算：`~/.gameclaw/lobster-cli-tamer/reports/latest.html` 与 `latest.md`
- 观察者：`new` / `play` 自动在 `127.0.0.1:8000+` 启动，结束时关闭
- 观察者端口文件：`~/.gameclaw/lobster-cli-tamer/observer/daemon.json`

用 `--state-dir /tmp/tamer --no-observer` 可以把一局完全放进沙箱目录，适合并行评测。
每回合自动原子写盘；`menu:save` 只是一次明确的保存动作，不是唯一的持久化时机。

## 五平台发布

从 [GameClaw Releases](https://github.com/Arcobalneo/gameclaw/releases/latest) 下载：

| 平台 | 资产 |
|---|---|
| macOS Apple Silicon | `lobster-cli-tamer-darwin-arm64.tar.gz` |
| macOS Intel | `lobster-cli-tamer-darwin-x64.tar.gz` |
| Linux x64 | `lobster-cli-tamer-linux-x64.tar.gz` |
| Linux arm64 | `lobster-cli-tamer-linux-arm64.tar.gz` |
| Windows x64 | `lobster-cli-tamer-windows-x64.zip` |

```bash
# macOS / Linux
tar -xzf lobster-cli-tamer-<platform>.tar.gz
cd lobster-cli-tamer-<platform>
./lobster-cli-tamer --version
```

```powershell
# Windows
Expand-Archive lobster-cli-tamer-windows-x64.zip
.\lobster-cli-tamer-windows-x64\lobster-cli-tamer.exe --version
```

单文件二进制，不需要 Node、Python 或任何运行时依赖。

## 本地开发

```bash
# 仓库根目录
pnpm install

# 只验证本游戏
pnpm --filter @gameclaw/lobster-cli-tamer check
pnpm --filter @gameclaw/lobster-cli-tamer test
npx biome check games/lobster-cli-tamer

# 从源码跑一局
bun games/lobster-cli-tamer/src/main.ts new --seed 7 --state-dir /tmp/tamer-smoke --no-observer

# 构建当前平台单文件二进制
node scripts/build-game.mjs lobster-cli-tamer

# 构建指定平台
node scripts/build-game.mjs lobster-cli-tamer --platform linux-arm64
```

源码结构：

```
src/main.ts            CLI 入口（只调用 runCli）
src/definition.ts      GameDefinition：meta / status / actions / recap
src/engine/state.ts    可序列化状态、创建、统一 RNG
src/engine/species.ts  物种 / 技能 / 词条 / 区域 / 平衡数据加载
src/engine/items.ts    道具、材料、掉落与保底
src/engine/world.ts    野外探索、遭遇、区域解锁
src/engine/capture.ts  捕捉率与入队
src/engine/combat.ts   回合制战斗、状态、词条触发
src/engine/party.ts    EXP / 升级 / 进化 / 技能 / 纪念碑
src/engine/workshop.ts 词条 roll 与工坊经济
src/engine/abyss.ts    深渊层、污染/疫病、永久死亡
src/engine/index.ts    单动作分发 act / abort
```

## 设计取舍与已简化项（诚实清单）

这是一次为 v2 运行时可玩性服务的重写，不是 Python 代码的逐行复刻。以下差异是有意为之：

- **事件层未实现**：`tower_config` 里的 `event_floor_positions` 没有做成独立事件；只保留普通 / 精英 / BOSS 三类楼层。
- **队伍 6 只都可上场**，没有采用 `battle_slots: 3` 的出战上限；换人只在战斗中按槽位操作。
- **野外倒地 = 战后 25% 苏醒**，永久死亡只发生在深渊；这样两种模式的失败代价足够不同。
- **捕捉失败立即进战斗**（而非原地重试），诱饵失败会让敌方先手；避免“无限投球”式零代价捕捉。
- **技能只学不替换**：4 个技能满后不再提供新技能，没有 Python 版的替换界面。
- **地形类词条只做叙事提示**，不改战斗数值；数值型词条（属性、护盾、治疗、状态）完整生效。
- **BOSS 等级重新缩放**：数据里没有 boss 等级字段，按层数与循环给到可打的等级；难度档会做上下限修正。
- **工坊货币补全**：`甲核 / 灵晶 / 潮石 / 深渊灵晶` 在 `items.json` 中不存在，重写时作为材料道具补进 `items.ts`，否则深渊掉落和工坊费用都会落空。
- **图鉴 / 昵称不单独做菜单**：图鉴进度放在 `STAT` 与结算页，减少一层无决策菜单。
- **通关目标固定为第 60 层**：数据里的里程碑最高是 60 层；达到后结算为 `won`，而不是无限挂机。
- 旧 Python 实现、`pyproject.toml`、PyInstaller spec、`docs/` 与 `game_catalog/` 已在本次迁移中移除；`data/**` 与 `LICENSE` 原样保留并复用。

## 防逆向边界

发行二进制减少普通玩家直接翻源码的便利度，但不保证不可逆向、不可篡改。它不是强对抗反作弊系统；真正的规则与内容仍以本仓库源码和 `data/**` 为准。

## License

MIT
