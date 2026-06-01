# Plan: 横着抓 Bug 修复 + 完整体验解锁

- **日期**: 2026-06-02
- **作者**: 小龙
- **关联游戏**: `lobster-cli-tamer` v0.1.7 → v0.1.8+
- **关联现有 plan**: `2026-03-18-lobster-cli-tamer-plan.md`

---

## 一、Goal

- 修复在派大虾🦞 实测两轮中暴露的所有阻塞性 bug，让普通玩家(尤其是 coding agent 玩家)**纯合法手段**就能跑通"打深渊解锁下一个区域"的核心目标。
- 把 `lobster-cli-tamer` 的当前死局状态(slot 0: 6 只全 HP=0 / memorial=0 / box=0 死档)从"无法挽救的破损存档"变成"在修好 bug 后,玩家可以重新读档继续"或"重开新档可以正常推进"。
- 发版 `v0.1.8` 到 GitHub Releases,本地与远端 release 一致。
- 修完后再用新版本跑一轮真实游玩,验证解锁下一区域可达。
- 同步把整个流程中持续发现的次要 bug 全部修完。

---

## 二、本轮游玩中亲测发现的所有 bug

### 🔴 P0 阻塞性

1. **野外战斗死亡的怪永远不清埋(world.py _on_battle_end BUG)**
   - 现象:野外战斗中怪 HP=0,但 `combat.py take_damage` 只在 `is_tower=True`(深渊)时设 `dead=True`;野外 `is_tower=False` → 死掉的怪 `dead=False` + `hp_current=0`
   - 后续: `world.py _on_battle_end PLAYER_LOSE` 分支 `for c in active_party: if c.dead: add_to_memorial` —— 因为野外 `dead=False` 永远不进 memorial
   - 同时 `PLAYER_WIN` 分支直接不处理 dead
   - 后果:HP=0 怪 `is_alive=False` → `active_party` 排除 → 但 **party 槽位还占着 dead=False HP=0 的怪** → 抓新怪装不进 6 槽 → 玩家永远无法组满有生力量的队伍
   - 复现:第二轮新档抓 5 只 → 死 6 只 → memorial=0 → active_party=0 → 永远进不了深渊

2. **珊瑚帝王蟹 BOSS"珊瑚壁垒"护盾无上限累积(战术性)**
   - 现象: `corrosive_bulwark` 技能 `type: "shield" value: 0.25` —— 每回合 +0.25 × max_hp 护盾,持续时间未在 combat 中衰减
   - `combat.py _tick_status_both` 只处理 `STATUS_POISON/BURN/PARALYZE/FREEZE/CONFUSE`,不处理 `shield`
   - 后果:BOSS 战死循环,普通攻击 5 HP 永远打不破 73.5/回合 累积的护盾
   - 设计意图可能是 status 类应该衰减,shield 也应如此;但当前实现成"永久累积"

### 🟠 P1 严重体验问题

3. **没有"换队伍 / 放生 / 复活"机制**
   - 玩家抓到强怪但队伍满 6 时,强怪进 `box`(死仓库),游戏内没有任何菜单能把它换出来
   - 死局路径:主力死光 → box 怪取不出 → 永远无法继续
   - 应该至少提供:一个 `box` 调换菜单(把 party 里的怪放回 box,或从 box 取怪),或者一个"放生"按钮

4. **BOSS 战强制死循环(r 退无效)**
   - `game.py` 中 BOSS 战 `r` 显示 "本层不可撤退";战斗双方都无法掉血(因为 bug #2) → 永远不结束
   - 后果:玩家只能强 kill tmux 退游戏,丢失本局进度

5. **SKILL_CHOICE 替换槽位没有清晰提示**
   - `game.py _skill_choice_prompt` 当 `len(creature.moves) >= 4` 时要求选 1-4 替换
   - 但 prompt 文字只说"需指定替换序号:1-4",脚本/玩家容易漏掉
   - 实际游玩中 7 次 SKILL_CHOICE 都因只发 "1" 后没跟替换号而 INVALID_INPUT

### 🟡 P2 小问题

6. **`r` 跑野外战斗不扣血,应该显示"成功逃跑!"还是"未战"**
   - 玩家预期"r = 退战斗" → 但有些解读下觉得白白错过了 EXP/捕捉机会
   - 体验:可以加个"r 退战斗也获得 1/4 EXP 补偿"的简单规则

7. **主菜单存档在战斗中死亡不持久化**
   - 战斗中 HP=0 + dead=True 的怪,在主菜单"存档"时还是按死掉但 `dead=True` 持久化
   - 但 `memorial` 是否记录是另一回事(见 bug #1)

8. **大量 SKILL_CHOICE 重复出现提示不太友好**
   - 每次 INVALID_INPUT 重新渲染完整候选 + 当前技能 + 提示,信息冗余
   - 体验可优化

---

## 三、Scope

### 在本 plan 中

- 修所有 P0 阻塞性 bug(#1, #2)
- 修 P1 的 #3(加 swap API)、#4(加 BOSS 战退出口)、#5(改 SKILL_CHOICE prompt 提示)
- 修 P2 的 #7(主菜单存档触发 dead 状态)
- 不动 P2 #6, #8(体验小问题,留到下版)
- 写 plan + 修代码 + 改文档 + 单测 + 真玩 + 发版

### 不在本 plan 中(留给后续)

- 新内容(新虾米、新技能、新区域)—— 留给 v0.2.0 大版本
- 美术/界面 polish
- 多人/云存档
- 难度调整/平衡

---

## 四、Assumptions

- 玩家默认使用 `--terminal-native --no-color` 模式(本轮游玩实测验证)
- Python 3.10+
- 现有数据文件(JSON)不动 —— bug 在代码侧
- 发版 v0.1.8 而非 v0.2.0,语义是 bug 修复 + 小幅新功能(swap 菜单)
- 公开 release assets 仍只发布 `linux-x86_64` + `darwin-arm64`,符合现有 CI 矩阵
- 测试用 `uv` workspace 跑 `scripts/test-game.sh lobster-cli-tamer`

---

## 五、修复方案

### Fix 1: 野外战斗死亡清埋(world.py + combat.py)

**思路**:`combat.py take_damage` 中,即使 `is_tower=False`,HP=0 时也应该把 `creature.dead=True`(永久死亡只在 tower 里"无法复活"语义上,野外怪也是真的"死了")

**具体修改**:
- `combat.py` `take_damage`: 不再用 `is_tower` 决定 `dead=True`,改为 HP<=0 时统一设 `dead=True`
- `world.py _on_battle_end`:
  - PLAYER_WIN 分支增加 dead 清理 + add_to_memorial
  - PLAYER_LOSE 分支保持现有(已用 `if c.dead`)
- 抽出 helper `_cleanup_dead_in_party()` 在 PLAYER_WIN/PLAYER_LOSE 都调用,统一处理 add_to_memorial + party[idx] = None

### Fix 2: shield 累积衰减(combat.py)

**思路**:`_tick_status_both` 中增加 `shield_hp *= 0.5` 衰减(每回合剩余 50%)

**具体修改**:
- 在 `_tick_status_both` 中,处理完 status 后,对 `shield_hp > 0` 的 `Combatant` 衰减 50%
- 这样珊瑚壁垒的 73.5 护盾下一回合只加 ~36.75,长跑后趋近 0
- 同时让"灼烧/中毒"扣血仍然绕护盾扣 HP 的特性保留

**替代方案(更稳妥)**: 改成 status 类每回合衰减 50% —— 这样珊瑚壁垒的"持续 1 回合"语义得到尊重

### Fix 3: box 调换菜单(game.py + save.py)

**思路**: 主菜单新增选项 `7 调换队伍`,可以选 party 一只怪放回 box,从 box 选一只怪填入

**具体修改**:
- `game.py _main_menu` 选项中加 `7 调换队伍`
- 新增 `_swap_menu()` 方法:
  - 渲染 party (非空),`[1-6] = 放回 box` + `[0] 返回`
  - 选一个后,渲染 box,`[1-N] = 调换入` + `[0] 返回`
  - box 空时显示提示
- `save.py` 加 helper `swap_party_to_box(party_idx) -> Creature` 把 party[idx] 移到 box,返回原怪

### Fix 4: BOSS 战允许 q 退(game.py)

**思路**: BOSS 战 r 仍然无效,但 q 退到主菜单(类似野外 r 退战斗但保留深渊进度)

**具体修改**:
- 在 `game.py _abyss_loop` 中, BOSS 战时的 menu options 增加 `("q", "放弃战斗(退深渊)")`
- cmd == "q" 时:`tower._settle_plague()`, `tower.floor = 0`, `total_abyss_runs += 1`, `write_save`, break loop
- 这样 BOSS 战不再死锁 —— 玩家可以 Q 退深渊,但有疫病骰代价

### Fix 5: SKILL_CHOICE prompt 提示更明确

**思路**: 把"需指定替换序号"信息在显示候选之前就展示清楚

**具体修改**:
- `game.py _skill_choice_prompt` 在显示候选前就 print 一个明显的提示框:
  ```
  ⚠ 当前技能已满 4 个,选择后将询问替换哪个技能。
  ```
- 不改其他逻辑

### Fix 6: 顺手修的其他小问题

- 主菜单"存档"时 `if any HP=0` 提示"已自动清理 N 只阵亡虾米"

---

## 六、测试计划

### 单元测试

- 新增 `tests/test_battle_dead_cleanup.py`:
  - 野外战斗死亡,验证 dead=True,add_to_memorial,槽位变 None
  - 野外战斗胜利,我方死,验证 dead=True,add_to_memorial,active_party 减员
- 新增 `tests/test_shield_decay.py`:
  - BOSS 战多回合,验证 shield_hp 衰减
- 新增 `tests/test_swap_menu.py`:
  - 模拟 swap 流程,验证 party/box 互转
- 新增 `tests/test_boss_q_retreat.py`:
  - BOSS 战 q 退,验证退深渊 + 疫病骰

### 实玩验证

1. 修完 bug 后构建本地新二进制
2. 用新二进制开新档(也清掉当前死档,备份留 `/tmp`)
3. 实际玩一遍目标流程:
   - 抓满 6 只
   - 反复 1-9 层练级(中途允许 q 退 BOSS 战避免死锁)
   - 学 status_apply 技能
   - 推 10 层 BOSS(用困惑/灼烧/中毒绕护盾)
   - 目标:deepest >= 10,触发 `tower_best>=10` 解锁深流峡谷

### 验收标准

- ✅ Fix 1 单元测试通过 + 实玩无"HP=0 怪永远占槽"现象
- ✅ Fix 2 单元测试通过 + BOSS 战不再死锁
- ✅ Fix 3 单元测试通过 + 实玩可从 box 调换出怪
- ✅ Fix 4 单元测试通过 + BOSS 战 q 退到主菜单
- ✅ Fix 5 实玩 SKILL_CHOICE 提示更明确
- ✅ 发版 v0.1.8 在 GitHub Releases
- ✅ 实玩达成 deepest >= 10,unlocked_zones 包含 `deep_current_canyon`

---

## 七、Release Plan

1. 改完代码 + 测试通过 + 改文档(CHANGELOG + README)
2. 更新 `games/lobster-cli-tamer/pyproject.toml` version `0.1.7` → `0.1.8`
3. 在 README 资产列表加 v0.1.8 (changelog 在 CHANGELOG.md 加一条)
4. commit on main
5. `git tag v0.1.8 && git push --tags` (或用 `gh release create`)
6. GitHub Actions 自动 build linux-x86_64 + darwin-arm64 + 上传 release assets
7. 下载新 release 资产到本地 `/tmp/tamer/`,替换 v0.1.7 二进制
8. 跑游戏验证版本

---

## 八、Risks

- **Fix 1 风险**:`dead=True` 在野外会导致玩家更"硬核",但其实是对的(怪真的死了)
- **Fix 2 风险**:shield 衰减可能让 BOSS 太弱,需要平衡
- **Fix 3 风险**:swap API 可能破坏 box 无限存储的设计意图 —— 但之前设计意图本来就有问题(box 死仓库)
- **Fix 4 风险**:BOSS 战 q 退让玩家"逃避 BOSS",可能让游戏太简单 —— 但死局没法玩是更严重的问题,先解决它,后续再平衡
- **发版风险**:GitHub Actions 可能因依赖问题失败,需要监控

---

## 九、Checklist

- [x] 写 plan 文档
- [ ] 修 combat.py take_damage(野外也设 dead)
- [ ] 修 world.py _on_battle_end(统一 dead 清理)
- [ ] 修 combat.py _tick_status_both(shield 衰减)
- [ ] 修 game.py _main_menu(加 7 调换队伍)
- [ ] 新增 game.py _swap_menu + save.py swap_party_to_box helper
- [ ] 修 game.py _abyss_loop(BOSS 战 q 退)
- [ ] 修 game.py _skill_choice_prompt(明确替换提示)
- [ ] 写单元测试
- [ ] 跑 `./scripts/test-game.sh lobster-cli-tamer` 全绿
- [ ] 本地构建新二进制
- [ ] 实玩达成 deepest >= 10
- [ ] 改 version 0.1.7 → 0.1.8
- [ ] 改 CHANGELOG.md
- [ ] 改 README.md
- [ ] commit + push
- [ ] `gh release create v0.1.8` 触发 actions
- [ ] 等 actions 跑完
- [ ] 下载新 release 资产,本地与远端一致
- [ ] 用新版本再玩一遍验证
- [ ] (如需) 修次要 bug → v0.1.9
- [ ] 最终验证:本地 + GitHub 都到 v0.1.9 或更新

---

## 十、作者备注

- 这是一份"实测驱动修复"的 plan,所有 bug 编号都来自派大虾🦞 在 2026-06-01 实测两轮中遇到的真实问题
- 用户的要求: "本地与 GitHub 发版保持一致" —— 意味着最终验证时本地二进制和 GitHub Release 资产必须是同版本
- 本 plan 完成后,实玩可能发现新 bug,持续滚入下个 plan
