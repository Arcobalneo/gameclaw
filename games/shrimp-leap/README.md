# 虾跃 (Shrimp Leap)

一颗像史莱姆的果冻小生物，沿着不断延伸的街道跳过一根又一根灯柱。性格、颜色和训练改变身体；力度、角度和时机决定这一跳。通关 45 根灯柱，把夜色跳到天亮。

```bash
shrimp-leap new --seed 7 --json
shrimp-leap act nature:steady --json
shrimp-leap act color:mint --json
shrimp-leap act jump:mid:arc:on --json
shrimp-leap recap --json
```

当前版本 `2.8.0`，运行在 GameClaw 的 TypeScript `gamekit` v2 运行时上。无全屏 TUI，无真实网络依赖。

## Agent-first 规则

- **一次调用 = 一个明确动作**。`act` 返回日志、完整新状态、结构化事件与下一批合法动作，不需要在 `status` / `actions` 之间轮询。
- **动作列表与执行共用同一准入来源**。列出的动作都能执行；一个预测会跳短的跳跃仍是合法动作，会正常扣除代价并留下失误，不会返回 `ILLEGAL_ACTION`。
- **`next` 是当前建议**。跳跃按预测结果、落点误差与体力成本排序。没有可落地组合或体力不足时，`rest` 排在最前。
- **同 seed + 同动作序列 = 同结果**。街道生成、离线同伴、风拍和物理都保存在状态中；规则不读真实时钟，也不用 `Math.random()`。
- **失败可归因**。日志和 `events` 写关卡、三档输入、间距、高差、风、预计落点、误差、容差、体力与摔落次数。`recap` 区分坠落、力竭和救援坠落。
- **默认 observer 与报告**。`new` 启动本地观察页；终局停止服务并写 HTML / Markdown 结算。自动化测试可加 `--no-observer --no-report`。

## 开局：性格与颜色

`new` 后先执行 `nature:<id>`，再执行 `color:<id>`。也可用 `--content steady:mint` 直接选定两项；顺序不限，未提供的维度仍在游戏里选择。

| 性格 | 初始属性（弹 / 控 / 耐 / 黏） | 倾向 |
|---|---|---|
| `bold` 果敢 | 5 / 3 / 4 / 3 | 初速度高，但控制较低 |
| `steady` 沉稳 | 4 / 5 / 4 / 4 | 时机误差更小，落地容差较大 |
| `mellow` 绵韧 | 3 / 4 / 6 / 5 | 体力与黏性高，离线黏连概率略高 |

| 颜色 | 修正 |
|---|---|
| `coral` 珊瑚橙 | 弹力 +1、控制 -1 |
| `mint` 薄荷青 | 控制 +1、弹力 -1 |
| `amber` 灯芯黄 | 耐力 +1、黏性 -1 |
| `lilac` 夜紫 | 黏性 +1、耐力 -1 |

四项有效属性由**性格 + 颜色 + 永久训练 + 体型**组成：

- `spring` 弹力：提高跳跃初速度，也在救援外的主线中决定可达距离。
- `control` 控制：降低时机对落点的扰动，并增加落地容差。
- `endurance` 耐力：提高体力上限与 `rest` 恢复量。体力上限为 `10 + 耐力×2`。
- `grip` 黏性：增加灯柱边沿容差，也提高救援的拉力贡献。

`--difficulty easy|normal|hard` 调整地图间距、落地容差与允许的摔落次数（4 / 3 / 2）。

## 一条街，45 关

`state.street` 是持续累积的灯柱数组。每次过关只在末端续建，不重置地图；旧灯柱的 `x`、高度、间距、高差和风都保留。当前关为 `state.level`，已通关数为 `state.cleared`。

- 1–15：旧城慢街，街速 1。
- 16–30：风口长街，街速 2，间距与风增强。
- 31–45：高架黎明，街速 3，视野与物理压力最大。

视野从当前位置起可见 2 根，随关数逐步提高到 5 根。`status` 的“延伸街道”只显示可见部分，完整已生成数组仍在 `state.street`。

通关 15 / 30 关分别长成 `弹团` / `灯团`：弹力、耐力、黏性各 +1，当前体力 +4；体型也带来少量重量修正。第 45 关落地即胜利，不要求额外收尾动作。

主要状态路径：

- `state.personality` / `state.color` / `state.training` / `state.size`
- `state.level` / `state.cleared` / `state.street` / `state.beat`
- `state.stamina` / `state.sparks` / `state.falls` / `state.bond`
- `state.rescue` / `state.sinceRescue`
- `state.lastJump` / `state.lastSetback` / `state.timeline`
- `state.rng`：sfc32 四字状态

## 跳跃：力度 × 角度 × 时机

动作 id：

```text
jump:<low|mid|high>:<flat|arc|high>:<early|on|late>
```

| 档位 | 含义 |
|---|---|
| 力度 `low / mid / high` | 初速度递增，基础体力消耗为 1 / 2 / 3 |
| 角度 `flat / arc / high` | 30° / 45° / 60°；高差会改变最佳角度 |
| 时机 `early / on / late` | 与当前风拍的相对差值修正落点；不是实时按键 |

物理采用确定性抛物线近似：弹力与力度决定初速度，角度拆分水平与竖直速度，高差决定飞行时间；随后叠加当前风、街速、体型重量与时机修正。所有中间落点舍入到两位小数后判定。

当前目标的间距、高差、基础风、当前风、风拍和落地容差都在 `status` 中。每个跳跃的 `ActionView.detail` 直接给出预计落点、误差与结果：

- `perfect` 完美：过关，灯花 +2。
- `clean` 站稳：过关，灯花 +1。
- `edge` 擦边：仍过关，额外体力 -1，不得灯花。
- `short / long` 跳短 / 跳远：留在原关，额外体力 -1，摔落 +1。

体力低于某个力度的**基础成本**时，该力度的动作不列出。高风险的最后一跳可能把体力扣到 0；若同时失误，就进入 `力竭` 结局。

## 休息与养成

- `rest`：恢复 `5 + 耐力` 点体力（不超过上限），并推进风拍。即使体力已满也能用来等风，但不推进关卡。
- `train:spring|control|endurance|grip`：消耗 3 灯花，对应属性永久 +1。基础与训练合计上限 8，体型加成另算；已满单项不会出现。训练也推进风拍。

灯花只能来自精准落地和救援，不能靠反复休息刷取。训练改变后续物理，因此要重新读取动作预测。

## 离线“网络模式”：同频黏连救援

这里**没有网络连接、真人玩家或异步输入**。成功落地后，seed 可能生成一个与你同性格的果冻同伴；绵韧性格触发率略高。每次救援后至少隔 3 次过关才可能随机触发；连续 7 次过关未遇同伴会触发保底，避免整局看不到副本。基础救援需求为 7，通常需要两至三拍配合，而不是一次按钮就结束；轻拉更安全但贡献低，中拉与强拉能缩短过程却更快累积拉力。

进入 `rescue` 后，主街跳跃暂停。状态公开 `progress / need / tension / maxTension / roundsLeft / cue`，动作 id 为：

```text
rescue:<low|mid|high>:<early|on|late>
```

- 力度提供基础贡献；与 `cue` 合拍增加进度且不增加额外拉力。
- 拉力超过上限会失败；救援进度超过需求太多也会额外拉紧。
- 三拍用完仍进度不足会失败。`rescue:ease` 只在已有拉力时出现，用一拍让拉力 -2。
- 成功：灯花 +2，下一跳 `bond=1`，落地容差 +0.45；下一跳后护持消耗。
- 失败：体力 -2、摔落 +1，回到主线；若达到摔落上限，进入独立的 `黏连坠落` 结局。

救援的每个动作也公开执行后的进度和拉力，并按当前结果排序。

## 结局与复盘

- `dawn` 天亮：第 45 关落地，胜利。
- `fall` 坠落：普通跳跃失误累计到本难度的摔落上限。
- `exhausted` 力竭：体力扣到 0 且这一跳没有落地。
- `rescue-fall` 黏连坠落：救援失败造成最后一次摔落。
- `aborted` 收团：通用 `abort` 主动中止，不算胜负。

`recap --json` 保留进行中状态，不会把尚未结束的一局误报成中止。`memoryPrompt` 要求记录本局 build、训练和具体误差，并明确提醒换 seed、体型或属性后重新验证。

## 平台与发行

提供 `darwin-arm64`、`darwin-x64`、`linux-x64`、`linux-arm64`、`windows-x64` 五个平台的单文件二进制，资产名为 `shrimp-leap-<platform>.tar.gz`（Windows 为 `.zip`）。压缩包附带本 README、LICENSE 与 SHA256SUMS。

二进制降低直接翻阅源码的便利度，但不保证不可逆向或防篡改。游戏没有第三方运行时依赖；observer 只监听本机回环地址，离线同伴机制不发起网络连接。

## 开发

```bash
pnpm --filter @gameclaw/shrimp-leap typecheck
pnpm --filter @gameclaw/shrimp-leap test
node scripts/test-game.mjs shrimp-leap
bun games/shrimp-leap/src/main.ts new --seed 7 --state-dir /tmp/sl
node scripts/build-game.mjs shrimp-leap
```
