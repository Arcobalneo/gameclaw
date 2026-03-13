from __future__ import annotations

from dataclasses import dataclass, field

from lobster_cli_tower_defense.content import ENEMIES, UNITS, UNIT_ORDER, Doctrine, EnemyType, SpawnEntry, UnitType
from lobster_cli_tower_defense.stages import DEFAULT_STAGE, StageDefinition, build_wave_plan


@dataclass(frozen=True)
class LeakEvent:
    pulse: int
    lane: str
    enemy_key: str
    enemy_title: str
    amount: int


@dataclass
class Enemy:
    uid: int
    enemy_key: str
    lane: str
    path: tuple[str, ...]
    position_index: int
    current_hp: int
    slowed: int = 0
    exposed: int = 0

    @property
    def kind(self) -> EnemyType:
        return ENEMIES[self.enemy_key]

    @property
    def node_id(self) -> str:
        return self.path[self.position_index]


@dataclass
class UnitState:
    unit_key: str
    current_hp: int
    slot_key: str | None = None
    ready_pulse: int = 1
    duration_left: int | None = None
    damage_done: int = 0
    kills: int = 0
    deployments: int = 0
    recalls: int = 0
    defeats: int = 0
    last_slot: str | None = None

    @property
    def template(self) -> UnitType:
        return UNITS[self.unit_key]


@dataclass
class GameState:
    seed: int
    doctrine: Doctrine
    stage: StageDefinition
    wave_plan: list[tuple[SpawnEntry, ...]]
    pulse: int
    tide: int
    integrity: int
    max_integrity: int
    roster: dict[str, UnitState]
    enemies: list[Enemy] = field(default_factory=list)
    leaks: int = 0
    total_kills: int = 0
    next_enemy_uid: int = 1
    lane_leaks: dict[str, int] = field(default_factory=dict)
    first_leak: dict[str, tuple[int, str] | None] = field(default_factory=dict)
    leak_history: list[LeakEvent] = field(default_factory=list)
    run_notes: list[str] = field(default_factory=list)
    skill_ready_pulse: int = 1
    skill_uses: int = 0
    crusher_skill_slot: str | None = None
    oracle_skill_lane: str | None = None
    last_break_lane: str | None = None
    last_break_enemy: str | None = None

    def roster_by_slot(self, slot_key: str) -> UnitState | None:
        for unit in self.roster.values():
            if unit.slot_key == slot_key:
                return unit
        return None


def push_run_note(notes: list[str], note: str, *, limit: int = 6) -> None:
    if note in notes:
        notes.remove(note)
    notes.append(note)
    if len(notes) > limit:
        del notes[:-limit]


def skill_cooldown_remaining(state: GameState) -> int:
    return max(0, state.skill_ready_pulse - state.pulse)


def unit_cost(doctrine: Doctrine, unit_key: str) -> int:
    template = UNITS[unit_key]
    return max(1, template.cost - doctrine.discounts.get(unit_key, 0))


def unit_max_hp(doctrine: Doctrine, unit_key: str) -> int:
    template = UNITS[unit_key]
    hp = template.max_hp
    if template.block > 0:
        hp += doctrine.blocker_hp_bonus
    return hp


def unit_attack(doctrine: Doctrine, unit_key: str) -> int:
    template = UNITS[unit_key]
    attack = template.attack
    if unit_key in {"whisker-scout", "salt-spray"}:
        attack += doctrine.support_attack_bonus
    return attack


def unit_duration(doctrine: Doctrine, unit_key: str) -> int | None:
    template = UNITS[unit_key]
    if template.duration is None:
        return None
    return template.duration + doctrine.decoy_duration_bonus


def unit_redeploy_cooldown(doctrine: Doctrine, unit_key: str) -> int:
    template = UNITS[unit_key]
    return max(1, template.redeploy_cooldown + doctrine.redeploy_cooldown_delta)


def build_game_state(seed: int, doctrine: Doctrine, *, stage: StageDefinition = DEFAULT_STAGE) -> GameState:
    roster = {
        unit_key: UnitState(unit_key=unit_key, current_hp=unit_max_hp(doctrine, unit_key))
        for unit_key in UNIT_ORDER
    }
    return GameState(
        seed=seed,
        doctrine=doctrine,
        stage=stage,
        wave_plan=build_wave_plan(seed, stage=stage),
        pulse=1,
        tide=doctrine.starting_tide,
        integrity=doctrine.starting_integrity,
        max_integrity=doctrine.starting_integrity,
        roster=roster,
        lane_leaks={lane: 0 for lane in stage.lanes},
        first_leak={lane: None for lane in stage.lanes},
    )


def current_entries(state: GameState, offset: int) -> tuple[SpawnEntry, ...]:
    index = state.pulse - 1 + offset
    if 0 <= index < len(state.wave_plan):
        return state.wave_plan[index]
    return ()


def ready_units(state: GameState) -> list[UnitState]:
    return [
        state.roster[key]
        for key in UNIT_ORDER
        if state.roster[key].slot_key is None and state.roster[key].ready_pulse <= state.pulse
    ]


def deployed_units(state: GameState) -> list[UnitState]:
    return [
        state.roster[key]
        for key in UNIT_ORDER
        if state.roster[key].slot_key is not None
    ]


def effective_attack(state: GameState, unit: UnitState) -> int:
    attack = unit_attack(state.doctrine, unit.unit_key)
    if state.crusher_skill_slot and unit.slot_key == state.crusher_skill_slot:
        attack += 2
    return attack


def effective_block(state: GameState, unit: UnitState) -> int:
    block = unit.template.block
    if state.crusher_skill_slot and unit.slot_key == state.crusher_skill_slot:
        block += 1
    return block


def lane_has_blocker(state: GameState, lane: str) -> bool:
    for slot_key in state.stage.lane_block_slots.get(lane, ()): 
        unit = state.roster_by_slot(slot_key)
        if unit is not None and effective_block(state, unit) > 0:
            return True
    return False


def deploy_unit_to_slot(state: GameState, unit_key: str, slot_key: str) -> UnitState:
    unit = state.roster[unit_key]
    if slot_key not in state.stage.slots:
        raise ValueError(f"unknown slot: {slot_key}")
    if slot_key not in unit.template.allowed_slots:
        raise ValueError(f"{unit.template.title} cannot deploy to {slot_key}")
    if unit.slot_key is not None:
        raise ValueError(f"{unit.template.title} is already deployed")
    if unit.ready_pulse > state.pulse:
        raise ValueError(f"{unit.template.title} is still cooling down")
    if state.roster_by_slot(slot_key) is not None:
        raise ValueError(f"slot {slot_key} is occupied")
    cost = unit_cost(state.doctrine, unit.unit_key)
    if state.tide < cost:
        raise ValueError("not enough tide")
    unit.slot_key = slot_key
    unit.current_hp = unit_max_hp(state.doctrine, unit.unit_key)
    unit.duration_left = unit_duration(state.doctrine, unit.unit_key)
    unit.last_slot = slot_key
    unit.deployments += 1
    state.tide -= cost
    return unit


def send_unit_to_cooldown(state: GameState, unit: UnitState, *, defeated: bool) -> None:
    unit.slot_key = None
    unit.duration_left = None
    unit.current_hp = unit_max_hp(state.doctrine, unit.unit_key)
    unit.ready_pulse = state.pulse + unit_redeploy_cooldown(state.doctrine, unit.unit_key)
    if defeated:
        unit.defeats += 1


def recall_unit_at_slot(state: GameState, slot_key: str) -> tuple[UnitState, int]:
    unit = state.roster_by_slot(slot_key)
    if unit is None:
        raise ValueError(f"no unit at {slot_key}")
    refund = 1 + state.doctrine.recall_refund_bonus
    state.tide += refund
    send_unit_to_cooldown(state, unit, defeated=False)
    unit.recalls += 1
    return unit, refund


def _spend_skill_charge(state: GameState, *, target_name: str) -> None:
    if skill_cooldown_remaining(state) > 0:
        raise ValueError("skill is cooling down")
    if state.tide < state.doctrine.skill_cost:
        raise ValueError("not enough tide for skill")
    state.tide -= state.doctrine.skill_cost
    state.skill_ready_pulse = state.pulse + state.doctrine.skill_cooldown + 1
    state.skill_uses += 1
    push_run_note(
        state.run_notes,
        f"记进 memory 的本局观察：这次把【{state.doctrine.skill_name}】交给了 {target_name}；它像翻盘窗，不等于每个 pulse 都该提前白交。",
    )


def activate_crusher_skill(state: GameState, slot_key: str) -> None:
    unit = state.roster_by_slot(slot_key)
    if unit is None:
        raise ValueError(f"no unit at {slot_key}")
    slot = state.stage.slots[slot_key]
    if not slot.is_path:
        raise ValueError("crusher skill needs a path slot")
    state.crusher_skill_slot = slot_key
    _spend_skill_charge(state, target_name=f"{unit.template.title}@{slot_key}")


def activate_oracle_skill(state: GameState, lane: str) -> None:
    if lane not in state.stage.lanes:
        raise ValueError(f"unknown lane: {lane}")
    state.oracle_skill_lane = lane
    _spend_skill_charge(state, target_name=state.stage.lane_titles[lane])


def activate_gambler_skill(state: GameState, from_slot: str, to_slot: str) -> UnitState:
    unit = state.roster_by_slot(from_slot)
    if unit is None:
        raise ValueError(f"no unit at {from_slot}")
    if to_slot not in state.stage.slots:
        raise ValueError(f"unknown slot: {to_slot}")
    if state.roster_by_slot(to_slot) is not None:
        raise ValueError(f"slot {to_slot} is occupied")
    if to_slot not in unit.template.allowed_slots:
        raise ValueError(f"{unit.template.title} cannot move to {to_slot}")
    unit.slot_key = to_slot
    unit.last_slot = to_slot
    unit.current_hp = min(unit_max_hp(state.doctrine, unit.unit_key), unit.current_hp + 2)
    _spend_skill_charge(state, target_name=f"{unit.template.title} -> {to_slot}")
    return unit


def enemies_at_node(state: GameState, node_id: str) -> list[Enemy]:
    return [enemy for enemy in state.enemies if enemy.node_id == node_id]


def spawn_enemies(state: GameState) -> list[str]:
    entries = current_entries(state, 0)
    if not entries:
        return ["本 pulse 没有新敌潮入场。"]
    events = []
    for entry in entries:
        for _ in range(entry.count):
            kind = ENEMIES[entry.enemy_key]
            state.enemies.append(
                Enemy(
                    uid=state.next_enemy_uid,
                    enemy_key=entry.enemy_key,
                    lane=entry.lane,
                    path=state.stage.paths[entry.lane],
                    position_index=0,
                    current_hp=kind.max_hp,
                )
            )
            state.next_enemy_uid += 1
    summary = []
    for entry in entries:
        enemy = ENEMIES[entry.enemy_key]
        summary.append(f"{state.stage.lane_short[entry.lane]}【{enemy.title}】x{entry.count}")
    events.append(f"入潮：{'；'.join(summary)}。")
    return events


def apply_oracle_skill(state: GameState) -> list[str]:
    if not state.oracle_skill_lane:
        return []
    lane = state.oracle_skill_lane
    affected = 0
    for enemy in state.enemies:
        if enemy.lane == lane:
            enemy.slowed = max(enemy.slowed, 1)
            enemy.exposed += 1
            affected += 1
    return [f"{state.stage.lane_titles[lane]}被【{state.doctrine.skill_name}】点亮：{affected} 个目标更慢、更脆。"]


def unit_priority(unit: UnitState, slot_order: tuple[str, ...]) -> tuple[int, int]:
    order = {
        "support": 0,
        "splash": 0,
        "ranged": 1,
        "control": 2,
        "melee": 3,
        "decoy": 4,
    }[unit.template.kind]
    return (order, slot_order.index(unit.slot_key or slot_order[0]))


def covered_enemies(state: GameState, unit: UnitState) -> list[Enemy]:
    if not unit.slot_key:
        return []
    slot = state.stage.slots[unit.slot_key]
    enemies = [enemy for enemy in state.enemies if enemy.node_id in slot.coverage]
    if unit.template.kind in {"melee", "control", "decoy"}:
        enemies = [enemy for enemy in enemies if enemy.node_id == slot.node]
    return enemies


def target_rank(enemy: Enemy) -> tuple[int, int, int]:
    return (enemy.position_index, enemy.current_hp, -enemy.uid)


def choose_target(unit: UnitState, enemies: list[Enemy]) -> Enemy | None:
    if not enemies:
        return None
    if unit.unit_key == "ring-cutter":
        armored = [enemy for enemy in enemies if "armored" in enemy.kind.tags or "elite" in enemy.kind.tags]
        if armored:
            enemies = armored
    elif unit.unit_key == "whisker-scout":
        fast = [enemy for enemy in enemies if "runner" in enemy.kind.tags or "shock" in enemy.kind.tags]
        if fast:
            enemies = fast
    return max(enemies, key=target_rank)


def damage_enemy(unit: UnitState, enemy: Enemy, amount: int, *, armor_pierce: int = 0) -> int:
    reduction = max(0, enemy.kind.armor - armor_pierce)
    actual = max(0, amount + enemy.exposed - reduction)
    enemy.current_hp -= actual
    unit.damage_done += actual
    return actual


def cleanup_dead(state: GameState, source: UnitState, events: list[str]) -> None:
    alive: list[Enemy] = []
    for enemy in state.enemies:
        if enemy.current_hp > 0:
            alive.append(enemy)
            continue
        state.total_kills += 1
        source.kills += 1
        events.append(f"{source.slot_key or '?'} {source.template.short} 收壳了【{enemy.kind.title}】。")
    state.enemies = alive


def resolve_unit_actions(state: GameState) -> list[str]:
    events: list[str] = []
    for unit in sorted(deployed_units(state), key=lambda item: unit_priority(item, state.stage.slot_order)):
        if not unit.slot_key:
            continue
        if unit.current_hp <= 0:
            continue
        candidates = covered_enemies(state, unit)
        if unit.unit_key == "molt-decoy" or not candidates:
            continue
        if unit.unit_key == "salt-spray":
            slot = state.stage.slots[unit.slot_key]
            best_node = None
            best_size = -1
            for node_id in slot.coverage:
                size = len(enemies_at_node(state, node_id))
                if size > best_size:
                    best_node = node_id
                    best_size = size
            if not best_node or best_size <= 0:
                continue
            targets = enemies_at_node(state, best_node)
            for enemy in targets:
                damage_enemy(unit, enemy, effective_attack(state, unit))
                enemy.slowed = max(enemy.slowed, unit.template.slow)
            events.append(f"{unit.slot_key} {unit.template.short} 在 {best_node} 喷出盐沫，压了 {len(targets)} 个目标。")
            cleanup_dead(state, unit, events)
            continue
        target = choose_target(unit, candidates)
        if target is None:
            continue
        dealt = damage_enemy(
            unit,
            target,
            effective_attack(state, unit),
            armor_pierce=unit.template.armor_pierce,
        )
        if unit.template.slow:
            target.slowed = max(target.slowed, unit.template.slow)
        if unit.template.expose:
            target.exposed += unit.template.expose
        if unit.template.push:
            target.position_index = max(0, target.position_index - unit.template.push)
        events.append(f"{unit.slot_key} {unit.template.short} -> 【{target.kind.title}】 {dealt}。")
        cleanup_dead(state, unit, events)
    return events


def resolve_enemy_strikes(state: GameState) -> list[str]:
    events: list[str] = []
    for slot_key in [key for key in state.stage.slot_order if state.stage.slots[key].is_path]:
        unit = state.roster_by_slot(slot_key)
        if unit is None:
            continue
        node_enemies = enemies_at_node(state, state.stage.slots[slot_key].node)
        if not node_enemies:
            continue
        total = sum(enemy.kind.contact_damage for enemy in node_enemies)
        unit.current_hp -= total
        events.append(f"{slot_key} {unit.template.short} 吃到 {len(node_enemies)} 个目标合计 {total} 点冲击。")
        if unit.current_hp <= 0:
            threat = max(node_enemies, key=lambda enemy: (enemy.kind.contact_damage, enemy.kind.leak)).kind.title
            push_run_note(
                state.run_notes,
                f"记进 memory 的本局观察：{slot_key} 的【{unit.template.title}】被【{threat}】打穿过一次；这说明这里只靠薄前排容易崩。",
            )
            send_unit_to_cooldown(state, unit, defeated=True)
            events.append(f"{slot_key} 的【{unit.template.title}】被拆掉，进入再编冷却。")
    return events


def is_blocked_now(state: GameState, enemy: Enemy) -> bool:
    node_id = enemy.node_id
    unit = None
    for item in deployed_units(state):
        if item.slot_key and state.stage.slots[item.slot_key].node == node_id and state.stage.slots[item.slot_key].is_path:
            unit = item
            break
    if unit is None:
        return False
    capacity = effective_block(state, unit)
    if capacity <= 0:
        return False
    occupants = sorted(
        [item for item in state.enemies if item.node_id == node_id],
        key=lambda item: item.uid,
    )
    used = 0
    for occupant in occupants:
        if used + occupant.kind.weight <= capacity:
            if occupant.uid == enemy.uid:
                return True
            used += occupant.kind.weight
            continue
        return False if occupant.uid == enemy.uid else False
    return False


def resolve_enemy_movement(state: GameState) -> list[str]:
    events: list[str] = []
    active: list[Enemy] = []
    for enemy in sorted(state.enemies, key=lambda item: (-item.position_index, item.uid)):
        escaped = False
        steps = max(0, enemy.kind.speed - enemy.slowed)
        enemy.slowed = 0
        while steps > 0:
            if is_blocked_now(state, enemy):
                break
            enemy.position_index += 1
            if enemy.position_index >= len(enemy.path) - 1:
                state.integrity -= enemy.kind.leak
                state.leaks += enemy.kind.leak
                state.lane_leaks[enemy.lane] += enemy.kind.leak
                state.last_break_lane = enemy.lane
                state.last_break_enemy = enemy.kind.title
                state.leak_history.append(
                    LeakEvent(
                        pulse=state.pulse,
                        lane=enemy.lane,
                        enemy_key=enemy.enemy_key,
                        enemy_title=enemy.kind.title,
                        amount=enemy.kind.leak,
                    )
                )
                if state.first_leak[enemy.lane] is None:
                    state.first_leak[enemy.lane] = (state.pulse, enemy.kind.title)
                    push_run_note(
                        state.run_notes,
                        f"记进 memory 的本局观察：{state.stage.lane_titles[enemy.lane]}在 pulse {state.pulse} 第一次漏了【{enemy.kind.title}】；下局要再验证这里是缺前排，还是只是太贪着省潮令。",
                    )
                events.append(f"【{enemy.kind.title}】从 {state.stage.lane_titles[enemy.lane]}漏过，归海线 -{enemy.kind.leak}。")
                escaped = True
                break
            steps -= 1
        enemy.exposed = 0
        if not escaped:
            active.append(enemy)
    state.enemies = active
    return events


def expire_duration_units(state: GameState) -> list[str]:
    events: list[str] = []
    for unit in deployed_units(state):
        if unit.duration_left is None:
            continue
        unit.duration_left -= 1
        if unit.duration_left <= 0:
            slot_key = unit.slot_key or "?"
            send_unit_to_cooldown(state, unit, defeated=False)
            events.append(f"{slot_key} 的【{unit.template.title}】撑完了这波，自动退回再编。")
    return events


def resolve_pulse(state: GameState) -> list[str]:
    events: list[str] = []
    events.extend(spawn_enemies(state))
    events.extend(apply_oracle_skill(state))
    events.extend(resolve_unit_actions(state))
    events.extend(resolve_enemy_strikes(state))
    events.extend(resolve_enemy_movement(state))
    events.extend(expire_duration_units(state))
    state.crusher_skill_slot = None
    state.oracle_skill_lane = None
    return events


def pulse_display_label(state: GameState) -> str:
    total = len(state.wave_plan)
    if state.pulse <= total:
        return f"{state.pulse}/{total}"
    return f"{total}+尾波"


def build_score(state: GameState) -> int:
    return state.total_kills * 2 + state.integrity * 3 - state.leaks


def build_status_line(state: GameState) -> str:
    return (
        f"归海线 {state.integrity}/{state.max_integrity} | 潮令 {state.tide} | 漏 {state.leaks} | "
        f"Pulse {pulse_display_label(state)} | 收壳 {build_score(state)}"
    )


def build_final_notes(state: GameState, *, ending: str) -> list[str]:
    notes = list(state.run_notes)
    if any(state.lane_leaks.values()):
        lane = max(state.stage.lanes, key=lambda item: state.lane_leaks[item])
        leaked = state.lane_leaks[lane]
        if leaked > 0:
            push_run_note(
                notes,
                f"记进 memory 的本局观察：{state.stage.lane_titles[lane]}总共漏了 {leaked} 点完整度；如果这条线又要吃快潮又要吃精英，C 位最好别空太久。",
            )
    best_unit = max(state.roster.values(), key=lambda item: (item.damage_done, item.kills))
    if best_unit.damage_done > 0:
        push_run_note(
            notes,
            f"记进 memory 的本局观察：本局输出最高的是【{best_unit.template.title}】（{best_unit.damage_done} 伤 / {best_unit.kills} 收壳）；它更像补关键 threat 的位子，不该随手乱摆。",
        )
    if state.skill_uses > 0:
        push_run_note(
            notes,
            f"记进 memory 的本局观察：这轮【{state.doctrine.skill_name}】共用了 {state.skill_uses} 次；它更像救节奏的窗，而不是一冷却好就必须交的按钮。",
        )
    if ending == "won":
        push_run_note(notes, "记进 memory 的本局观察：这次守住了，不等于这条图已经被你解完；下局最好再换 seed 验证是不是同一套 opener 仍然稳。")
    elif ending == "lost" and state.last_break_lane and state.last_break_enemy:
        push_run_note(
            notes,
            f"记进 memory 的本局观察：最后打穿你的是 {state.stage.lane_titles[state.last_break_lane]}的【{state.last_break_enemy}】；下局优先验证那里是缺拦口、缺减速，还是潮技交晚了。",
        )
    if not notes:
        notes.append("记进 memory 的本局观察：这轮还没提炼出稳定结论，下局最好先盯最先崩掉的 lane。")
    return notes[-5:]
