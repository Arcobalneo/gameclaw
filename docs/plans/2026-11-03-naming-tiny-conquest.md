# 命名统一与第九款游戏：璿芃攻略（Tiny Conquest）

- 状态：已完成，按用户要求不 commit
- 日期：2026-11-03
- 范围：显示命名规范、`games/tiny-conquest` 新游戏、全量版本与发行面同步到 v2.4.0
- 设计依据：`docs/references/ai-native-game-design-rules.md`
- 结构参照：commit `fdcfe16` 与 `games/vege-life`
- 明确限制：保留所有既有 id、目录、binary 与 release asset 名；不修改根 `SKILL.md` 的游戏发现方式，不写入游戏名单；本次不 commit、不打 tag、不推送

## 1. 目标

1. Catalog 的每个 `name` 都是短中文标题，每个 `englishName` 都是与系列一致的 Title Case 英文名；`lobster-cli-ink` 改为 `Lobster Sideways Ink`。
2. 游戏 definition、README 标题/英文名、帮助与结算标题、版本号跟 catalog 对齐；既有机器 id 不变。
3. 新增 `tiny-conquest` / `璿芃攻略` / `Tiny Conquest`，以繁体中文呈现小人國一年攻堅，支援戰爭、外交、俘虜營救、多結局與鏡面反轉。
4. 新游戏沿用 gamekit 的 JSON、save、observer、report 与统一 CLI，不自行解析 argv 或实现终端服务。
5. 根包、全部 workspace 包、游戏运行时版本与 skill 元数据统一为 `2.4.0`；九款 × 五平台 = 45 个 release artifacts。
6. `validate:catalog`、lint、typecheck、全 workspace 测试、release matrix 与 CI 对应的真实构建全部通过。

## 2. 命名方案

- `docs/NAMING.md` 是唯一命名约定说明：legacy id 永久冻结；新 id 用短英文 kebab-case；只有龙虾系列新游戏可使用 `lobster-cli-` 前缀；显示格式为 `中文名 (English Name)`。
- Catalog 是显示 metadata 的对账来源。只修正显示字段，不重命名任何机器面。
- `lobster-cli-heist` 的 README / definition 改用 `Lobster Sideways Heist`。
- `lobster-cli-tower-defense` 改用短名 `横着守` 与 `Lobster Sideways Hold`。
- `lobster-cli-sideways-look` 的 definition 改用短名 `横着看`。
- `lobster-cli-ink` 的 catalog、package description、README、源码标题与 definition 统一为 `Lobster Sideways Ink`。
- 各游戏 README 以 `中文名 (English Name)` 开头，可另起一行写玩法副标题；不把副标题塞进 catalog `name`。

## 3. Tiny Conquest 玩法设计

**玩感**：每周在「补给、侦察、善意、暴露、武器 build、攻城/条约进度」之间取舍。危险动作先展示发现率，随机结果写入事件；被发现不是立即结算，而是进入可读、可重玩的终端动作段。

### 3.1 一年与目标

- 52 週；选择目标不占一週，野外行动、袭扰、交涉与组装武器各占一週。
- 三个大人國：`鐵壁國`（军事门槛高）、`豐穗國`（外交与补给友好）、`鏡面國`（反转结局）。
- 状态公开战争与外交门槛。`raid` 累积控制，`negotiate` 累积影响；达到门槛后分别用 `conquer:war` / `conquer:pact` 主动收尾。
- 鏡面國的两种攻陷都进入 `鏡國`：璿芃最后看见的微缩王城好像是自己的小人國。其他胜利为 `征服` / `盟約`；失败含 `逾期`、`俘虜`、`斷糧`；`abort` 独立为中止。

### 3.2 日常、补给与部件

- 资源：糧草、銀幣、部件、情報、善意、暴露、体力、控制、影响。
- `buy` 回本國买粮并降暴露；`steal` 偷大人國剩余物资，未被发现时大人只以为是老鼠。
- `scout` / `aid` / `earn` 提供不同资源路线；确定性事件表包含好心人与坏蛋，代价和收益写入日志与事件。
- `design` 进入工坊；依次选择 frame / head / drive，再 `assemble`。部件组合决定威力、噪音与机动；低威力武器会明确产生「抓癢」反馈，不伪装成有效重炮。

### 3.3 被发现后的两个动作小游戏

- `discovery` 只给 `respond:flee` / `respond:fight`。
- 逃跑：先选路线，再按预告输入 `dodge:left|right|duck`。每次有效输入消耗一拍，剩余拍数、路线所需成功数与捕获值全部公开；拍数耗尽或捕获值到阈值则俘虏。
- 迎战：每拍公开游标与最佳出手点，`strike:quick` / `strike:heavy` 依距离结算时机，连续命中累积 combo，`brace` 可守势；武器威力、伤害、连击与反击都写入事件。
- 小游戏不读取真实时钟。所谓时限是确定性的决策拍数，保证非交互 agent 与 seed 回放一致。
- 失败进入 `captured`，可花资源求援/赎身，或在有限尝试内等待救援；失败才进入 `俘虜` 结局。成功回到野外，但若一年已尽仍按 `逾期` 结算。

### 3.4 反支配与信息支持

- 只偷粮会抬暴露并进入动作段；只买粮会受银币限制；挣钱与善意又消耗本可用于攻陷的週数。
- 战争需要部件、情报和武器威力；外交需要善意、情报与持续交涉。两条路线争用同一年的行动。
- `actions` 只列当前合法动作，并给出价格、风险、发现率或门槛；`status` 公开当前目标、补给、build 与收尾条件。
- `recap` 给出本局限定的观察，要求把目标、路线、暴露与关键失败写进 agent 自己的 memory，并提醒换 seed/目标要重新验证。

## 4. 假设与风险

- 假设：不改 gamekit 契约、build/release workflow 或其他游戏玩法；显示名与版本修正不属于机器兼容性破坏。
- 假设：`packages/gamekit/package.json` 也包含在用户要求的「所有 package.json」内，因此从 2.0.0 对齐到 2.4.0；测试 fixture 的示例版本不是发行版本，不改。
- 风险：部件组合扩大动作空间 → 工坊分槽选择，每次只列一个部件槽的少量选项。
- 风险：实时输入破坏确定性 → 只用状态内拍数，不用 `Date.now()` 或真实计时器。
- 风险：小游戏失败不可归因 → 预告、判定值、连击、捕获原因进入 log/events。
- 风险：一年平衡出现单一路线支配 → 测试战争、外交、反转、断粮、俘虏与救援路径，并检查合法动作和结局门槛。
- 风险：历史名称残留在当前文档 → 搜索现行 metadata/README/docs；归档计划保留历史，不改写成从未发生。

## 5. Checklist

- [x] 写入本计划
- [x] 新增命名规范并修正既有 catalog / definition / README 显示名
- [x] 新增 `tiny-conquest` 包、LICENSE、tsconfig、main、definition、content、engine
- [x] 新增 engine 与 CLI 测试：seed 回放、合法动作、补给、工坊、两类小游戏、俘虏/救援、战争/外交/反转/期限/中止
- [x] 新增 catalog 第九条及五平台 release assets，确认 release matrix 为 9 × 5
- [x] 根包、所有 workspace 包、游戏运行时版本、README 版本、SKILL 元数据 → 2.4.0，更新 lockfile importer
- [x] 更新根 README 双语、CHANGELOG、AGENTS、docs 索引/架构/发版/计划计数；SKILL 不列游戏
- [x] 跑 `pnpm validate:catalog && pnpm lint && pnpm check && pnpm test`
- [x] 逐游戏跑标准测试入口，并执行 CI 对应的每款真实 binary build
- [x] 对 tiny-conquest 验证 `--version`、真实 `new → act → recap`、observer 响应与关停、HTML/Markdown settlement
- [x] 审查 diff、版本/名称残留与生成文件；不创建 git commit
