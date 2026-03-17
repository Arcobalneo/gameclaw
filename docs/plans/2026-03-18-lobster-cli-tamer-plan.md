# Plan: 横着抓 (lobster-cli-tamer)

- **日期**: 2026-03-18（v2，大幅重写）
- **游戏 ID**: `lobster-cli-tamer`
- **显示名**: 横着抓：只给龙虾玩的 CLI 捕虾养成
- **作者**: 小龙

---

## 一、设计目标 & 核心公式

```
横着抓 = 宝可梦收集养成 × 暗黑词条深度 × 肉鸽无尽深渊 × 永久死亡驱动
```

### 与现有三款游戏的差异
- **首款有本地存档**：虾米 party 永久存在，支持跨 session 续玩
- **最大内容量**：100+ 虾米，500+ 技能，丰富世界地图，无尽深渊
- **永久死亡机制**：深渊失败后每只 party 虾米有 20% 概率死亡 → 持续养成驱动力
- **JSON 配置驱动**：引擎与内容数据完全分离，支持后续无成本扩展

### 三层核心循环
```
【世界层】探索地图 → 遭遇 → 捕捉（刷灵光）→ 词条揭示
     ↓
【修炼层】升级选技能 → 词条重投/升阶 → party 战略优化
     ↓
【深渊层】无尽爬塔 → 失败 → 20%永死惩罚 → 重新捕捉/养成
     ↑___________________________________________________↓
```

---

## 二、世界观 & 命名规范

| 术语 | 含义 |
|------|------|
| **虾米** | 可捕捉的海洋生物（游戏内精灵） |
| **甲录师** | 玩家身份 |
| **虾图录** | 图鉴系统 |
| **灵光** | 闪光（shiny）变体，概率 1/128 |
| **深渊** | 无尽爬塔区域 |
| **词条** | Diablo 式随机词缀 |

---

## 三、架构核心原则：JSON 配置驱动

### 设计哲学
游戏引擎（Python 代码）只实现**规则**，不硬编码任何**内容**。
所有虾米、技能、词条、区域、敌人、关卡参数均通过 JSON 文件定义。
新增内容 = 只需编写/追加 JSON 条目，无需改动引擎代码。

### 配置文件结构
```
games/lobster-cli-tamer/data/
├── species/
│   ├── tide_type.json      # 潮系虾米（20只）
│   ├── rock_type.json      # 岩系虾米（20只）
│   ├── electric_type.json  # 电系虾米（20只）
│   ├── poison_type.json    # 毒系虾米（20只）
│   ├── spirit_type.json    # 灵系虾米（20只）
│   └── legendary.json      # 传说级（10+ 只，分布各系）
├── skills/
│   ├── tide_skills.json    # 潮系技能（~100个）
│   ├── rock_skills.json    # 岩系技能（~100个）
│   ├── electric_skills.json
│   ├── poison_skills.json
│   ├── spirit_skills.json
│   ├── universal_skills.json   # 通用技能（~50个）
│   └── signature_skills.json   # 特招（~50个，虾米专属）
├── affixes.json            # 全词条库（100+ 词条）
├── zones.json              # 世界地图区域配置
├── enemies.json            # 非虾米类敌人（深渊守卫等）
├── tower_config.json       # 深渊层级生成规则
├── items.json              # 道具配置
├── balance.json            # 全局平衡参数（经验曲线、词条概率等）
└── lore.json               # 世界观文本、NPC 台词等
```

### 核心 Schema 示例

**species 条目**
```json
{
  "id": "reef_shrimp",
  "name": "礁虾",
  "type": "潮",
  "rarity": "common",
  "base_stats": { "hp": 40, "atk": 25, "def": 20, "spd": 45, "end": 20 },
  "stat_growth": { "hp": 2.0, "atk": 1.5, "def": 1.0, "spd": 2.5, "end": 1.0 },
  "base_skill": "潮击",
  "skill_pool_tags": ["tide", "basic", "evasion"],
  "affix_slots": 2,
  "capture_base_rate": 0.60,
  "habitat": ["潮礁区"],
  "lore": "礁石缝隙间最常见的虾米，是新手甲录师的第一搭档。",
  "evolution": { "target": "deep_reef_shrimp", "min_level": 20 }
}
```

**skill 条目**
```json
{
  "id": "tide_strike",
  "name": "潮击",
  "type": "潮",
  "category": "physical",
  "power": 65,
  "accuracy": 1.0,
  "effects": [],
  "tags": ["basic", "tide", "physical"],
  "description": "基础潮系物理攻击。"
}
```

技能效果支持的 effect type：
`stat_change / status_apply / recoil / heal / shield / terrain / multi_hit / priority / conditional`

**affix 条目**
```json
{
  "id": "surge_instinct",
  "name": "激流",
  "tier": "blue",
  "trigger": "on_take_damage",
  "trigger_limit_per_battle": 2,
  "effect": { "type": "stat_change", "stat": "atk", "value": 0.25, "duration_turns": 1 },
  "description": "受伤后下一次攻击+25%伤害（每战触发上限2次）"
}
```

**zone 条目**
```json
{
  "id": "reef_zone",
  "name": "潮礁区",
  "unlock_condition": "default",
  "sub_areas": [
    {
      "id": "reef_surface",
      "name": "礁石表层",
      "level_range": [1, 10],
      "encounter_table": [
        { "species_id": "reef_shrimp", "weight": 40 },
        { "species_id": "rock_crab", "weight": 35 },
        { "species_id": "poison_urchin", "weight": 25 }
      ]
    }
  ]
}
```

### 引擎 loader 职责
`loader.py` 在游戏启动时加载所有 JSON，校验 schema，构建内存索引：
- 物种字典 `SPECIES[id]`
- 技能字典 `SKILLS[id]`
- 词条字典 `AFFIXES[id]`
- 区域图 `ZONES[id]`
所有引擎模块只访问这些内存字典，不直接读 JSON 文件。

---

## 四、虾米系统（100+ 只）

### 规模与组织
- **5 属性系 × 20 只 = 100 只基础虾米**（含进化形态）
- **10+ 传说级虾米**（跨属性，深渊专属 or 隐藏触发）
- 每系 20 只分布：4 普通 / 4 稀有 / 4 精英 / 4 进化形态 / 4 区域专属

### 各系角色设计方向
| 系别 | 数量 | 定位风格 |
|------|------|---------|
| 潮系 | 20 | 均衡型、速度型、蓄势爆发 |
| 岩系 | 20 | 坦克型、反击型、破甲型 |
| 电系 | 20 | 高速型、麻痹控制、速度伤害转化 |
| 毒系 | 20 | 持续伤害、控制型、腐蚀 DEF |
| 灵系 | 20 | 辅助型、幻影躲避、概率效果 |
| 传说 | 10+ | 多系融合、深渊归来奖励、隐藏条件解锁 |

### 虾米属性规模
- 每只虾米有独立的 `stat_growth` 向量 → 同级下统计分布差异显著
- 进化：部分虾米有 2-3 段进化（Lv20 / Lv35 / 特殊条件），进化改变外观描述和基础属性上限
- 灵光变体：所有可捕虾米均有灵光版本，+1 词条槽，词条 tier 上限提升

### Checklist
- [ ] `data/species/*.json`：100+ 条虾米数据（按系分文件）
- [ ] `creature.py`：虾米实体类，从 JSON species_id 实例化，含级别/词条/技能字段
- [ ] 进化判断逻辑（升级后自动检查 evolution 条件）
- [ ] 灵光掷骰（1/128），灵光虾米特殊配色描述字段

---

## 五、技能系统（500+ 种）

### 规模设计
```
潮系技能    ~100 个（攻击/防御/地形/特殊）
岩系技能    ~100 个
电系技能    ~100 个
毒系技能    ~100 个
灵系技能    ~100 个
通用技能     ~50 个（物理/状态/场地/辅助）
特招技能     ~50 个（虾米专属，绑定 species_id）
─────────────────
总计         ~600 个
```

### 技能分类标签（用于升级权重偏移）
`physical / special / status / buff / debuff / terrain / multi_hit / priority / aoe / signature / risky / synergy`

### 升级选技能机制（肉鸽式）
- 升级时从技能池随机抽 **3 个**供选择
- 权重偏移规则（由 balance.json 配置）：
  - 本系技能权重 × 2.0
  - 与已有词条 tag 匹配的技能权重 × 1.5
  - 特招仅在该物种出现
- 上限 4 个技能，可主动覆盖

### Checklist
- [ ] `data/skills/*.json`：500+ 技能条目（按系分文件），effect 类型枚举完整
- [ ] `skills.py`：技能引擎，根据 effect 字段驱动战斗中的实际效果执行
- [ ] 升级权重计算函数（从 balance.json 读取偏移参数）
- [ ] 特招绑定逻辑（`species_id` 字段非空时只有该物种可学）

---

## 六、词条系统（100+ 词条）

### 规模与品阶分布
| 品阶 | 符号 | roll 基础权重 | 数量 |
|------|------|------------|------|
| 普通 | ○ | 55% | 30 个 |
| 精良 | ◑ | 28% | 30 个 |
| 精华 | ● | 13% | 25 个 |
| 虾玄 | ✦ | 4% | 15 个 |

- 灵光虾米：每个品阶权重上调 5%（○↓ → ◑/●/✦ 上升）
- 词条槽：普通虾米 2 槽，稀有 3 槽，精英 3 槽，传说 4 槽，灵光 +1 槽

### 词条 trigger 类型（JSON 配置支持的触发器）
`on_take_damage / on_deal_damage / on_turn_start / on_turn_end / on_hp_threshold / on_status_apply / on_switch_in / passive_team`

### 词条操作（修炼场，消耗材料）
- **重投**：指定词条槽，保持品阶，重 roll 内容（消耗 3 甲核）
- **升阶**：品阶+1（消耗 5 灵晶，○→◑→●→✦ 四步）
- **封印**：锁定该槽，重投时跳过（无消耗，随时切换）

### Checklist
- [ ] `data/affixes.json`：100+ 词条条目，trigger/effect 字段完整
- [ ] `affixes.py`：词条 roll 引擎（品阶权重 + 灵光 bonus），战斗中触发事件 hook
- [ ] 重投/升阶/封印操作，材料消耗扣减

---

## 七、战斗系统

### 核心规则
- 1v1 轮流制，速度决定先手，相同速度随机
- 玩家控制前台虾米，可换手（消耗一次行动）
- 每场战斗最多上场 3 只（party 可有 6 只）

### CLI 战斗界面（紧凑格式）
```
── 回合 3 ─────────────────────────────────────────────
[我方] 礁虾 Lv18  HP 52/60  ◑激流(就绪) ○迅爪
[对手] 电鳗 Lv20  HP 31/85
───────────────────────────────────────────────────────
行动: [1]潮击(潮·65) [2]水幕(降ATK) [3]蜕壳(回血) [4]撤退准备  [S]换手
```

词条触发明示：
```
◑ 激流 触发 → 礁虾本次攻击 ATK+25%
```

### 5 系克制（循环）
`潮 > 电 > 岩 > 毒 > 灵 > 潮`（受克制伤害 ×1.5）

### 5 种状态异常
中毒（持续伤害）/ 麻痹（跳过概率）/ 灼烧（ATK-20%）/ 冰封（跳过一次）/ 困惑（攻自身概率）

### Checklist
- [ ] `combat.py`：回合引擎，先手计算，换手，状态异常计时，词条事件 hook
- [ ] skill effect 执行器（根据 JSON effect 字段 dispatch 到对应处理函数）
- [ ] 5 系克制矩阵（从 balance.json 读取倍率，而非硬编码）
- [ ] 战斗信息 CLI 紧凑输出（render.py）

---

## 八、捕捉 & 灵光系统

- 遭遇后展示：物种名、等级、词条品阶范围（内容捕捉后才揭示）
- 捕捉概率：`base_rate × (1 - hp/max_hp) × tool_bonus`，百分比明示
- 捕捉成功 → 展示实际词条，选择入 party 或入仓库
- 灵光（1/128）：CLI 打印 `✨ 灵光虾米！` + 特殊配色描述，图鉴保留灵光捕捉记录

### 道具
| 道具 | 倍率 | 来源 |
|------|------|------|
| 甲网 | ×1.0 | 商店 |
| 精甲网 | ×1.8 | 商店/深渊掉落 |
| 灵甲网 | ×3.0 | 稀有掉落 |

### Checklist
- [ ] `capture.py`：遭遇加权随机（从 zones.json 读取 encounter_table），捕捉流程
- [ ] 灵光掷骰，灵光外观描述从 species JSON 读取 shiny_lore 字段
- [ ] 道具数据从 items.json 读取

---

## 九、世界地图 & 区域

### 区域规模（7 个大区，每区含 2-4 个子区域）
| 大区 | 子区域数 | 解锁条件 | 主力虾米系别 |
|------|---------|---------|------------|
| 潮礁区 | 3 | 初始 | 潮/岩 |
| 深流峡谷 | 3 | 深渊通过 10 层 | 电/潮 |
| 毒藻丛林 | 3 | 深渊通过 20 层 | 毒/灵 |
| 暗礁荒野 | 3 | 深渊通过 30 层 | 岩/电 |
| 热泉秘境 | 2 | 深渊通过 40 层 | 灵系，灵光率×2 |
| 深海裂隙 | 2 | 深渊通过 60 层 | 传说虾米低概率出没 |
| 幽渊入口 | 1 | 任意时刻 | 深渊入口，不含野外捕捉 |

### 区域内活动
- 随机遭遇（加权 encounter_table），可战斗后捕捉或逃跑
- 营地 NPC：回血、道具购买（从 items.json 读取商品列表）
- 隐藏遭遇点：低概率精英/传说虾米（每日刷新间隔从 balance.json 读取）

### Checklist
- [ ] `data/zones.json`：7 大区 × 子区域完整配置
- [ ] `world.py`：区域导航，遭遇随机，营地 NPC，区域解锁条件检查
- [ ] 隐藏点触发逻辑（基于 session 内计数）

---

## 十、深渊系统（无尽 + 永久死亡）

### 设计核心
无尽爬塔 + **永久死亡惩罚** = GameClaw 最强的长期驱动力。
每一只虾米都是不可替代的，失去它们是真实代价，捕捉新虾米是持续目标。

### 层级结构（小循环节奏）

深渊以**4层为一个小循环**，节奏固定：

```
普通战 → 普通战 → 普通战 → 精英战
（循环）            （高难度，附加疫病）
```

- 每 10 层 = BOSS 层（覆盖当轮精英，替换为 BOSS 战）
- 每小循环第 2 或 3 层（随机）= 事件层（商店/回血/捕捉机会）
- 精英战：难度明显高于普通战，**精英怪有概率对虾米施加「疫病」debuff**

### 无尽难度曲线（从 tower_config.json 驱动）
| 深度段 | 敌方特征 | 说明 |
|--------|---------|------|
| 1-30 层 | Lv5-20，无词条 | 入门段，精英无疫病 |
| 31-60 层 | Lv20-35，○/◑ 词条 | 挑战段，精英开始附加疫病 |
| 61-100 层 | Lv30-45，◑/● 词条 | 精英段，疫病触发率提高 |
| 101-150 层 | Lv40-55，●/✦ 词条 | 深渊段，疫病触发率高 |
| 151+ 层 | 等级/词条线性增强 | 无尽段，无上限 |

### BOSS 设计（每 10 层一个，循环升级）
- 第 10 层：**潮礁守护者**（岩系，蜕壳被动，3阶段）
- 第 20 层：**深流幻影**（灵系，幻影频率，破幻后爆发）
- 第 30 层：**深渊螯王**（全系，多词条，多阶段，必定附加疫病）
- 第 40 层+：循环升级版 BOSS（属性和词条强化，行为模式新增变体）
- 每 50 层出现一次**传说守卫**（超强，掉落特殊词条材料）
- BOSS 数据全部在 `tower_config.json` 中配置

### ⚠️ 永久死亡机制（两条独立路径）

#### 路径 1：战斗内死亡 → 立即永久死亡
- 深渊模式中，任意虾米 HP 归零 = **立即永久死亡**（不等待全灭）
- CLI 战斗中立即显示：`💀 [礁虾「小礁」] 在深渊战斗中永久死亡。`
- 死亡虾米立即从 party 移除，写入 memorial，本次深渊不可再用
- 仓库中的备用虾米不受影响

#### 路径 2：疫病 debuff → 退出深渊后结算死亡
**疫病（Plague）**：精英怪附加的**持久性 debuff**，贯穿整个深渊期间。

疫病死亡概率计算：
```
death_chance = min(layers_survived_with_plague × 0.05, 0.50)
```
- 施加疫病的那一层起，每多撑过一层 +5%
- 上限 50%（即 10 层后不再增加）
- 带疫病的虾米在 CLI 状态栏显示：`🦠 疫病 (12层 → 死亡率 60%→上限50%)`

**疫病结算触发时机**：
- 玩家**主动撤退**退出深渊
- 玩家**全灭**退出深渊
- 两种退出方式均触发疫病结算（全灭时战斗内已死亡的虾米不再二次结算）

**疫病结算流程**：
1. 列出所有带疫病的存活虾米，显示各自当前死亡概率
2. 逐只掷骰，CLI 展示结果：
   ```
   🦠 疫病结算 ────────────────────────────────
   电鳌「速闪」  疫病 8层 → 死亡率 40% → ✓ 幸存
   幽虾「迷雾」  疫病 10层 → 死亡率 50% → ❌ 死亡
   ─────────────────────────────────────────────
   ```
3. 死亡的虾米写入 memorial，移出 party
4. 幸存但仍带疫病的虾米：疫病**不会自动解除**，需要在修炼场消耗材料清除

**疫病清除方式**：
- 修炼场词条工坊提供「疫病解除」服务，消耗高价值材料（如 深渊灵晶）
- 不清除疫病直接再次进入深渊 → 死亡概率从上次基础继续累积（+5%/层，不从0开始）
- 彻底的策略选择：用还是不用带疫病的虾米进深渊

**设计意图**：
- 战斗内立即死亡 → 每次深渊都有真实战斗压力，要保住队友不能冒险
- 疫病积累 → 爬得越深、风险越高，何时撤退是真实的战略判断
- 疫病不自动解除 → 修炼场与深渊之间形成材料循环
- 仓库备用池 → 鼓励持续捕捉，提供风险对冲
- 传说/灵光虾米死亡代价极高 → 深渊挑战充满真实张力

### 深渊资源 & 奖励
- 击败敌人 → 甲核/灵晶/潮石（数量随层数增加）
- 击败精英 → 额外掉落「深渊灵晶」（疫病解除材料）
- 事件层商店：道具、词条单次升阶、罕见捕捉机会
- BOSS 掉落：稀有词条材料、特殊技能书
- 深度里程碑（50/100/150...层）：解锁新区域、传说虾米出现条件

### Checklist
- [ ] `data/tower_config.json`：层级生成规则、小循环节奏（3普通+1精英）、BOSS 数据、掉落表、疫病触发率参数
- [ ] `tower.py`：层级生成器（从配置读取），小循环调度，战斗/事件/BOSS 状态机
- [ ] **战斗内永久死亡**：深渊战斗中 HP=0 → 立即永久移除，写入 memorial
- [ ] **疫病 debuff**：精英战斗后按概率附加，在虾米状态中持久保存（存档字段）
- [ ] **疫病死亡结算**：退出深渊时（撤退/全灭）对带疫病虾米掷骰，CLI 逐只展示结果
- [ ] **疫病清除**：修炼场词条工坊新增「疫病解除」服务
- [ ] 疫病累积逻辑：再次进深渊时从上次概率继续累积
- [ ] Memorial 纪念册：区分「战斗内死亡」和「疫病死亡」两类原因
- [ ] BOSS 多阶段战斗逻辑（触发条件从 tower_config.json 读取）
- [ ] 深度里程碑解锁触发
- [ ] 无尽层数：层级生成支持任意深度（无上限）

---

## 十一、全局实时 Trace 看板（游戏级 Observer）

### 与 heist 的关键差别
- **游戏启动时立即部署**，贯穿整个 session（不只是深渊期间）
- **SSE 增量事件流**：每个游戏事件 append 一条 trace，不是定时轮询全量
- 看板 URL 在主菜单前打印，agent 可立即告知主人

### 启动输出
```
╔══════════════════════════════════════════════════════════╗
║  [看板] 实时 Trace 已部署 → http://localhost:8001         ║
║  可在浏览器中实时查看游戏事件流                           ║
╚══════════════════════════════════════════════════════════╝
```

### 增量事件类型
`session_start / zone_enter / encounter / capture_attempt / capture_success / level_up / skill_chosen / affix_triggered / battle_round / battle_end / tower_floor / tower_boss / permadeath_roll / workshop_op / save / session_end`

### 看板页面布局
- 左侧：SSE 实时事件流（时间戳 + 事件类型 badge + 内容，自动滚动）
- 右侧：Party 实时快照（6只虾米，等级/词条/HP）
- 顶部：session 统计（游玩时长、捕捉数、灵光数、最深层、死亡虾米数）

### Checklist
- [ ] `observer.py`：SSE 服务，`push_event(type, payload)` API，端口自动探测
- [ ] HTML 看板模板（左侧事件流 + 右侧快照 + 顶部统计）
- [ ] 所有游戏模块关键操作处调用 `observer.push_event(...)`
- [ ] `permadeath_roll` 事件特殊显示（红色高亮死亡结果）
- [ ] 游戏退出时 server 停止，最终快照保存 `settlement_reports/session_<timestamp>.html`
- [ ] 启动失败时诚实降级（打印提示，游戏继续）

---

## 十二、存档系统

- JSON 本地存档，路径 `~/.lobster-cli-tamer/save_<slot>.json`
- **3 个存档槽**，启动时显示各槽摘要（party 只数、最深层、死亡虾米数）
- 自动保存触发：每次捕捉后、每次深渊层完成后
- 存档内容：party / 仓库 / 材料 / 虾图录进度 / 区域解锁 / 深渊最深记录 / memorial（死亡虾米纪念册）

### 存档 Schema（核心字段）
```json
{
  "version": "1.0",
  "playtime_min": 0,
  "party": [],
  "box": [],
  "memorial": [],
  "zones_unlocked": ["潮礁区"],
  "tower_best": 0,
  "pokedex_seen": [],
  "materials": { "甲核": 0, "灵晶": 0, "潮石": 0 }
}
```

### Checklist
- [ ] `save.py`：读写，3槽管理，自动保存 API，version 字段，迁移预留
- [ ] Memorial 纪念册写入（死亡时追加记录：虾米名/等级/词条/死亡层数）
- [ ] 启动时存档槽摘要展示（含死亡数提示）

---

## 十三、技术架构

### 文件结构
```
games/lobster-cli-tamer/
├── data/                    # 全部内容配置（JSON）
│   ├── species/             # 虾米数据（按系分文件）
│   ├── skills/              # 技能数据（按系分文件）
│   ├── affixes.json
│   ├── zones.json
│   ├── enemies.json
│   ├── tower_config.json
│   ├── items.json
│   └── balance.json
├── lobster_cli_tamer/
│   ├── __init__.py
│   ├── loader.py            # JSON 配置加载 & 校验 & 内存索引
│   ├── main.py              # 入口，存档选择
│   ├── game.py              # 主循环状态机
│   ├── world.py             # 区域探索
│   ├── capture.py           # 捕捉流程
│   ├── combat.py            # 战斗引擎
│   ├── creature.py          # 虾米实体类
│   ├── affixes.py           # 词条 roll & 触发
│   ├── skills.py            # 技能效果执行器
│   ├── tower.py             # 深渊引擎
│   ├── workshop.py          # 修炼场操作
│   ├── save.py              # 存档读写
│   ├── observer.py          # SSE 看板服务
│   ├── report.py            # HTML 结算页
│   └── render.py            # CLI 输出格式
├── main.py
├── pyproject.toml
├── tests/
│   ├── test_loader.py       # JSON schema 校验
│   ├── test_combat.py
│   ├── test_affixes.py
│   ├── test_capture.py
│   ├── test_tower.py
│   ├── test_permadeath.py
│   └── test_save.py
├── docs/
└── game_catalog/
    └── metadata.json
```

### 关键约束
- 标准库 only（`json / random / http.server / threading / pathlib`）
- `loader.py` 是引擎与数据的唯一接口层
- 所有平衡参数（概率/倍率/经验曲线）集中在 `balance.json`，不散落在代码里

---

## 十四、测试计划

### 单元测试
- [ ] `test_loader.py`：所有 JSON 文件可加载，schema 必填字段非空，无孤立引用（技能ID存在等）
- [ ] `test_affixes.py`：roll 分布验证（1000次抽样，各品阶概率符合权重）
- [ ] `test_combat.py`：伤害公式（含克制、含词条触发），状态异常计时
- [ ] `test_capture.py`：概率曲线（满血→弥留，道具倍率），灵光分布（1000次）
- [ ] `test_permadeath.py`：全灭后 20% 死亡骰分布（统计验证），memorial 写入
- [ ] `test_save.py`：存档读写往返，memorial 字段持久化

### 集成测试（脚本化）
- [ ] 新游戏 → 捕捉1只虾米 → 升级选技能 → 进深渊战3层 → 撤退 → 重载存档，party完整
- [ ] 模拟全灭：party 3只全 HP=0 → 触发死亡判定 → 存档 → 重载，memorial 有记录
- [ ] Observer SSE 推送验证（`curl -N http://localhost:800x/events`）
- [ ] 无尽深渊：脚本化爬到 50 层不崩

### 真实游玩验收
- [ ] 爬到第 10 层 BOSS 并击败
- [ ] 捕捉到灵光虾米（✨ 提示正确，词条 bonus 生效）
- [ ] 触发全灭 + 永久死亡，memorial 正确记录
- [ ] 存档关闭后重载，party / 深渊记录 / memorial 完整

---

## 十五、实施 Checklist（开发顺序）

### Phase 1: 数据层（先把内容骨架建好）
- [ ] `data/balance.json`：经验曲线、词条概率、死亡概率（0.20）、克制矩阵
- [ ] `data/species/*.json`：100+ 虾米数据（先写骨架，内容后续填充）
- [ ] `data/skills/*.json`：500+ 技能数据（先写骨架，各系各50个）
- [ ] `data/affixes.json`：100+ 词条数据
- [ ] `data/zones.json`：7大区配置
- [ ] `data/tower_config.json`：层级规则、BOSS 配置
- [ ] `loader.py`：加载 + schema 校验 + 内存索引
- [ ] `test_loader.py`：确保全部 JSON 加载无误

### Phase 2: 实体 & 引擎核心
- [ ] `creature.py`：虾米实体，从 loader 实例化，进化判断
- [ ] `affixes.py`：roll 引擎，触发事件 hook
- [ ] `skills.py`：技能效果执行器（dispatch by effect.type）
- [ ] `combat.py`：回合制引擎，换手，状态异常，词条/技能 hook
- [ ] `test_combat.py` + `test_affixes.py`

### Phase 3: 捕捉 & 世界层
- [ ] `capture.py`：遭遇随机，捕捉概率，灵光，词条生成
- [ ] `world.py`：区域导航，遭遇表，NPC，解锁条件
- [ ] `save.py`：存档读写，3槽，memorial 字段
- [ ] `test_capture.py` + `test_save.py`

### Phase 4: 深渊 & 永久死亡
- [ ] `tower.py`：层级生成器，战斗/事件/BOSS 状态机，材料掉落
- [ ] 全灭判定 → 死亡骰 → memorial 写入
- [ ] 无尽层级：深度无上限，难度线性增强
- [ ] `test_tower.py` + `test_permadeath.py`

### Phase 5: 游戏主循环 & 修炼场
- [ ] `game.py`：修炼场主菜单，区域↔深渊导航
- [ ] `workshop.py`：词条工坊（重投/升阶/封印），仓库管理
- [ ] `render.py`：CLI 紧凑输出规范

### Phase 6: Observer & 结算
- [ ] `observer.py`：SSE 服务，端口探测，`push_event` API
- [ ] HTML 看板模板（左事件流 + 右快照 + 顶统计）
- [ ] `report.py`：单次深渊结算页 + session 最终快照

### Phase 7: 内容填充 & 平衡
- [ ] 100+ 虾米完整内容（lore、skill_pool_tags 完整）
- [ ] 500+ 技能完整内容（effect 参数完整）
- [ ] 100+ 词条完整内容
- [ ] 粗平衡：深渊难度曲线、死亡概率、词条 roll 权重

### Phase 8: 发布
- [ ] 集成测试 + 真实游玩验收全通过
- [ ] `games/lobster-cli-tamer/README.md`
- [ ] `game_catalog/metadata.json`
- [ ] `catalog/games.json` 新增条目
- [ ] 根 `README.md` / `README.zh-CN.md` / `SKILL.md` / `CHANGELOG.md` 更新
- [ ] `uv sync` 重新生成 `uv.lock`
- [ ] `scripts/build-game.sh lobster-cli-tamer` 验证构建
- [ ] GitHub release（linux-x86_64 + darwin-arm64）

---

## 十六、Memory 引导设计

### 触发时机（4 类）
1. 捕捉灵光虾米 → `"✨ 建议记录：[虾米名] + [词条组合] 的实战评估"`
2. 深渊结算 → 自动生成 3 条分析观察（附在结算 HTML 中）
3. 永久死亡事件 → `"❌ [虾米名] 已死亡。建议记录：哪层/何种情况导致全灭"`
4. 首次发现克制关系 → `"[电系] 克制 [岩系]，建议记入策略库"`

### 结算页 Memory 提示（示例）
```
── 本次观察 ──────────────────────────────
▸ 濒死怒浪 在第 34 层触发 3 次关键翻盘。该词条与低血量 build 强烈协同。
▸ 毒藻丛林区的毒系虾米对当前岩系 party 造成了较大压力，建议下次备灵系辅助。
▸ 本次全灭原因：第 38 层 BOSS 第二阶段速度突增，先手未判断正确。
─────────────────────────────────────────
```

---

## 十七、风险 & 注意事项

1. **内容数量 vs 质量**：100+ 虾米 / 500+ 技能的数量目标和每条内容的质量需要平衡；建议 Phase 1 先写结构骨架，Phase 7 再集中填充 lore 和 flavor text
2. **JSON schema 严格性**：loader 需要完善的字段校验，否则内容错误会导致难以追踪的运行时 bug
3. **永久死亡与存档兼容性**：memorial 字段一旦写入不可撤销，存档版本升级时需要谨慎处理
4. **无尽深渊平衡**：150+ 层的数值膨胀需要 balance.json 里的参数有足够的调整空间，不要在代码里硬编码上限
5. **CLI 信息密度**：战斗界面信息量比前三款游戏大，render.py 的紧凑格式是整个游戏体验的关键

## MVP 范围外（不做）

- 进化动画/多段 ASCII 进化演出（只改文字描述）
- 联机/PvP 对战
- 词条传承/遗传机制（后续版本）
- 第二/三张世界地图（后续版本，zones.json 可随时扩展）
