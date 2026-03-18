# lobster-cli-tamer v0.1.4 — Bugfix Plan

> 基于 agent 玩家汇报文档 + 源码交叉核实
> 状态：**待 review**

---

## 总体策略

- 12 个已报告 bug + 1 个额外发现，分三优先级处理
- P0（4个）：直接影响核心游玩体验，本次必修
- P1（4个）：可读性 / 数据准确性问题，本次一并修
- P2（4个）：设计补完 / 隐患，本次修其中明确有共识的 2 个，其余标注待讨论
- 额外发现（1个）：`shiny_trap` 数据缺失，本次顺手补

---

## P0 — 必修

### Bug 1：Observer 看板显示 `species_id` 而非中文名

**位置**：`creature.py:to_dict()` + `observer.py` JS 模板（第 256 行）

**根因**：
- `Creature.to_dict()` 只序列化 `species_id`，不包含 `species_name`（中文名）
- JS 模板：`m.nickname || m.species_id`，无昵称时回退到原始 ID

**修复**：
1. `creature.py` `to_dict()` 增加一行：
   ```python
   "species_name": self.species_name,
   ```
   （`species_name` property 已存在，返回 `_species_name` 或 fallback `species_id`）

2. `observer.py` JS 模板改为：
   ```js
   m.nickname || m.species_name || m.species_id
   ```

**影响范围**：`creature.py`、`observer.py`
**改动量**：2 行

---

### Bug 2：`total_abyss_runs` 双重计数

**位置**：`game.py:324` + `tower.py:209`

**现状**：
- `game.py:324`：进入深渊时无条件 `+1`（在 `confirm == "y"` 之后）
- `tower.py:209`：战败或投降（`PLAYER_LOSE` / `SURRENDERED`）时再 `+1`
- 结果：战败路径 `+2`；按 q 主动撤退仅 `+1`（game.py 那次），统计不一致

**修复方向**：

**选项 A（推荐）**：统一由 `tower.py` 负责计数，删除 `game.py:324`。
- `tower.py` 需要覆盖所有结束路径：
  - 当前 `_on_floor_end`（战败 / 投降）已有 `+1` ✓
  - `game.py` 中按 q 撤退路径（调 `tower._settle_plague()` 后 break）未在 tower 内计数 → 需要在 `tower.py` 暴露一个 `end_run()` 方法，或在 q 路径中显式计数
- 具体：在 `game.py` 的 q 分支 `tower.floor = 0; break` 之前加 `self.save.total_abyss_runs += 1`，同时删除 `game.py:324` 的无条件 `+1`

**选项 B**：统一由 `game.py` 负责，删除 `tower.py:209`，并在 game.py 的所有退出路径（战败、投降、q 撤退）各加 `+1`。

**推荐选项 A**，改动更集中。

**影响范围**：`game.py`、（可能 `tower.py`）
**改动量**：2~3 行

---

### Bug 3：深渊战斗无效输入静默使用第一技能

**位置**：`game.py` 深渊战斗循环 `except (ValueError, IndexError):` 块（约第 353 行）

**现状**：
```python
except (ValueError, IndexError):
    evts = tower.battle_turn(BattleAction(
        action_type=ActionType.USE_SKILL,
        skill_name=moves[0] if moves else ""))
```
无效输入直接出招，深渊永久死亡模式下误操作不可逆。

**对比**：野外战斗（`game.py` 约第 288 行）已正确处理：
```python
except (ValueError, IndexError):
    warn("无效输入"); continue
```

**修复**：将深渊战斗的 `except` 块改成与野外战斗一致：
```python
except (ValueError, IndexError):
    warn("无效输入"); continue
```

**影响范围**：`game.py`
**改动量**：2 行

---

### Bug 4：捕捉球硬编码 `net_basic`，高级球无法使用

**位置**：`game.py:273`

**现状**：
```python
item_id = "net_basic"
```
`items.json` 有 `net_basic`（1.0×）、`net_fine`（1.8×）、`net_spirit`（3.0×），以及 `floor_drops` 会掉落 `shiny_trap`（详见额外发现），但玩家没有入口选择。

**修复**：
在 cmd == "c" 分支中，改为弹出子菜单：
1. 枚举 `data.items` 中 `type == "capture"` 的道具
2. 过滤出背包中数量 > 0 的
3. 若只有一种直接使用；若多种列表展示让玩家选
4. 取消（0）回到主战斗菜单

```python
elif cmd == "c":
    capture_items = [
        item for item in self.data.items.values()
        if item.get("type") == "capture"
        and self.save.get_item_count(item["id"]) > 0
    ]
    if not capture_items:
        warn("没有捕捉球了！"); continue
    if len(capture_items) == 1:
        item_id = capture_items[0]["id"]
    else:
        sub_opts = [
            (str(i+1), f"{it['name']} ×{self.save.get_item_count(it['id'])}（{it.get('multiplier',1.0)}×）")
            for i, it in enumerate(capture_items)
        ] + [("0", "取消")]
        render_menu("选择捕捉球", sub_opts)
        sc = input().strip()
        if sc == "0": continue
        try:
            item_id = capture_items[int(sc)-1]["id"]
        except (ValueError, IndexError):
            warn("无效输入"); continue
    evts = ws.battle_turn(BattleAction(
        action_type=ActionType.USE_SKILL,
        skill_name=f"__capture__{item_id}"))
    ...
```

**影响范围**：`game.py`
**改动量**：~20 行（逻辑替换）

---

## P1 — 应修

### Bug 5：疫病死亡率显示不准确

**位置**：`render.py:105`

**现状**：
```python
warn(f"携带深渊疫病（已历 {c.plague_floors} 层，死亡率 {c.plague_floors*5:.0f}%）")
```
硬编码 `*5`，未读 balance，未封顶（理论上 11 层显示 55%，实际结算封 50%）。

**修复**：
`render_party_detail` 需要接收 `data` 参数（当前已有 `data` 可用），改为：
```python
chance = c.plague_death_chance(data.balance)
warn(f"携带深渊疫病（已历 {c.plague_floors} 层，死亡率 {chance*100:.0f}%）")
```
先确认 `render_party_detail` 的调用处是否传入了 `data`：
```
game.py → render.py 中的 render_party_detail(save.party, data)
```
若未传，需补传。

**影响范围**：`render.py`（可能 `game.py` 调用侧）
**改动量**：1~3 行

---

### Bug 6：工坊费用显示为原始 Python dict

**位置**：`workshop.py:244-247`

**现状**：
```
重投：{'jihe_core': 3}
升阶（common→blue）：{'spirit_crystal': 2}
```

**修复**：
在 `workshop.py` 中加一个辅助函数（利用 `data.items`）：
```python
def _format_cost(cost: dict[str, int], data) -> str:
    parts = []
    for item_id, count in cost.items():
        name = data.items[item_id]["name"] if item_id in data.items else item_id
        parts.append(f"{name} ×{count}")
    return " / ".join(parts) if parts else "免费"
```
调用处改为：
```python
lines.append(f"  重投：{_format_cost(rc, data)}")
lines.append(f"  升阶（common→blue）：{_format_cost(uc0, data)}")
lines.append(f"  封印：{_format_cost(_seal_cost(balance), data)}")
lines.append(f"  解封：{_format_cost(_unseal_cost(balance), data)}")
```
需确认 `cost_guide()` 的调用处是否传入 `data`，若没有则需补传。

**影响范围**：`workshop.py`（可能 `game.py` 调用侧）
**改动量**：~10 行

---

### Bug 7：`globals()["success"]` 脆弱间接引用

**位置**：`render.py:220`

**现状**：
```python
globals()["success"]("捕捉成功！🎉")
```

**修复**：直接调用：
```python
success("捕捉成功！🎉")
```

**影响范围**：`render.py`
**改动量**：1 行

---

### Bug 8：结算页 HTML 道具仓库显示原始 JSON

**位置**：`report.py:121`

**现状**：
```python
<pre>{_e(json.dumps(save.items, ensure_ascii=False, indent=2))}</pre>
```
显示 `{"jihe_core": 3, "spirit_crystal": 2}`。

**修复**：
`generate_session_report` 需要 `data` 参数（当前无）。

**方案**：
1. 给 `generate_session_report` 增加可选参数 `data: Optional["GameData"] = None`
2. 在 `_build_html` 内将 `save.items` 渲染为可读 HTML 列表：
```python
def _format_items(items: dict, data) -> str:
    if not items:
        return "（空）"
    lines = []
    for item_id, count in items.items():
        name = data.items[item_id]["name"] if (data and item_id in data.items) else item_id
        lines.append(f"<li>{name} ×{count}</li>")
    return "<ul>" + "".join(lines) + "</ul>"
```
3. 在 `game.py` 调用 `generate_session_report` 的地方补传 `data=self.data`

**影响范围**：`report.py`、`game.py`
**改动量**：~15 行

---

## P2 — 选修（本次修其中 2 个）

### Bug 9：`tower_config.json` 的 `drops` 块是死代码（**本次修**）

**位置**：`tower.py:_roll_drop()` + `tower_config.json`

**现状**：`tower_config.json` 有按层类型（normal/elite/boss）分层的 `drops` 配置，但 `_roll_drop()` 只读 `floor_drops`，所有层统一掉落。

**修复**：
按 `self._floor_type` 分路查 `drops[type]`：
```python
def _roll_drop(self) -> Optional[dict[str, Any]]:
    tc = self.data.tower_config
    floor_type_key = self._floor_type.value.lower()  # "普通"→需映射
    drops_by_type = tc.get("drops", {})
    # 映射：普通→normal, 精英→elite, BOSS→boss
    type_map = {"普通": "normal", "精英": "elite", "BOSS": "boss"}
    type_key = type_map.get(self._floor_type.value, "normal")
    type_drops = drops_by_type.get(type_key, {})
    if type_drops:
        # 结构：{item_name: [min, max]}，item_name 是中文
        # 需要从 data.items 反查 id
        items_by_name = {v["name"]: k for k, v in self.data.items.items()}
        drops = []
        for item_name, count_range in type_drops.items():
            item_id = items_by_name.get(item_name)
            if item_id:
                count = random.randint(count_range[0], count_range[1])
                if count > 0:
                    drops.append({"id": item_id, "name": item_name, "count": count})
        return random.choice(drops) if drops else None
    # fallback: floor_drops
    floor_drops = tc.get("floor_drops", [])
    for d in floor_drops:
        if random.random() < d.get("chance", 0):
            return {"id": d["item_id"], "name": d.get("name", d["item_id"]), "count": d.get("count", 1)}
    return None
```
注意：`drops` 中引用了"甲核"、"灵晶"、"深渊灵晶"、"潮石"，需确认这些 id 都在 `items.json` 中存在（见额外发现，部分可能缺失）。

**影响范围**：`tower.py`
**改动量**：~20 行

---

### Bug 10：`balance.json` 缺少已引用的配置键（**本次修**）

**位置**：`data/balance.json`

**缺失键及推荐默认值**（与代码中硬编码默认一致）：
```json
"capture": {
    // 已有：shiny_rate, tool_multipliers
    "no_encounter_weight": 0.4,
    "weakened_bonus": 1.5,
    "half_hp_bonus": 1.2,
    "status_poison_burn_bonus": 1.2,
    "status_para_freeze_bonus": 1.5,
    "shiny_capture_penalty": 0.7
},
"world": {
    // 已有：hidden_encounter_base_chance
    "steps_min": 3,
    "steps_max": 8
}
```

**影响范围**：`data/balance.json`
**改动量**：8 个键值对补充

---

### Bug 11：深渊敌方仅有一个技能（**待讨论，暂不修**）

**现状**：`tower.py:_spawn_enemy()` 强制 `cb.creature.moves = [base_skill]`

**影响**：BOSS 战单调，strategy depth 降低

**讨论点**：
- 简单修复：从物种 `skill_pool_tags` 里随机选 2~3 个技能
- 但需要确认物种数据中 `skill_pool_tags` 与技能库的对应关系是否完整
- 建议下一个版本专项处理，本次暂缓

---

### Bug 12：类型克制仅单向加成，无抵抗减伤（**待讨论，暂不修**）

**现状**：只有攻击方克制对方时 1.5×，被克制时无 0.67× 减伤

**讨论点**：
- 可能是有意为之的简化设计
- 若加入双向，会大幅改变整体 balance，需要单独的 balance 调整
- 建议作为独立 feature 讨论，本次不改

---

## 额外发现：`shiny_trap` 缺失于 `items.json`

**问题**：`tower_config.json` 的 `floor_drops` 中有 `shiny_trap`（灵光球，5% 掉率），但 `items.json` 中不存在该 item。

**现象**：玩家可以"获得"灵光球，存档 `save.items["shiny_trap"]++`，但使用时 `data.items.get("shiny_trap")` 返回 None，`capture.py` 回退 multiplier=1.0，等同普通球。

**修复**：在 `items.json` 中补充：
```json
{
  "id": "shiny_trap",
  "name": "灵光球",
  "type": "capture",
  "multiplier": 5.0,
  "price": 0,
  "description": "专为捕捉灵光虾米设计，捕捉倍率 5.0×"
}
```
（multiplier 数值待定，建议 5.0，可覆盖灵光 0.7× 惩罚后仍比灵甲网更强）

---

## 实施顺序

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | Bug 7（globals → 直接调用）| `render.py` |
| 2 | Bug 3（无效输入 continue）| `game.py` |
| 3 | Bug 2（abyss_runs 计数）| `game.py` |
| 4 | Bug 1（species_name）| `creature.py`, `observer.py` |
| 5 | Bug 5（plague rate）| `render.py`（可能 `game.py`）|
| 6 | Bug 10（balance.json 补全）| `data/balance.json` |
| 7 | 额外：shiny_trap 补 items.json | `data/items.json` |
| 8 | Bug 6（workshop cost display）| `workshop.py` |
| 9 | Bug 8（report items display）| `report.py`, `game.py` |
| 10 | Bug 4（capture 子菜单）| `game.py` |
| 11 | Bug 9（drops dead code）| `tower.py` |
| 12 | 全量测试 + rebuild + release v0.1.4 | — |

---

## 不在本次范围

- Bug 11（boss 多技能）：需单独 balance 设计
- Bug 12（类型抵抗）：需单独 balance 设计

---

*文档生成时间：2026-03-18*
