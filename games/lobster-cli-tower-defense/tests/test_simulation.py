import unittest

from lobster_cli_tower_defense.content import DOCTRINES, ENEMIES, SpawnEntry
from lobster_cli_tower_defense.simulation import (
    Enemy,
    activate_crusher_skill,
    activate_gambler_skill,
    activate_oracle_skill,
    build_game_state,
    deploy_unit_to_slot,
    pulse_display_label,
    recall_unit_at_slot,
    resolve_enemy_movement,
    resolve_pulse,
    resolve_unit_actions,
    unit_max_hp,
)


def doctrine(key: str):
    return next(item for item in DOCTRINES if item.key == key)


def add_enemy(state, enemy_key: str, lane: str, position_index: int, *, current_hp: int | None = None) -> Enemy:
    kind = ENEMIES[enemy_key]
    enemy = Enemy(
        uid=state.next_enemy_uid,
        enemy_key=enemy_key,
        lane=lane,
        path=state.stage.paths[lane],
        position_index=position_index,
        current_hp=kind.max_hp if current_hp is None else current_hp,
    )
    state.next_enemy_uid += 1
    state.enemies.append(enemy)
    return enemy


class SimulationRuleTests(unittest.TestCase):
    def test_block_capacity_at_choke_stops_only_two_light_enemies(self):
        state = build_game_state(7, doctrine("crusher"))
        deploy_unit_to_slot(state, "reef-guard", "C")
        for _ in range(3):
            add_enemy(state, "pot-grunt", "left", 2)

        events = resolve_enemy_movement(state)

        self.assertEqual(state.integrity, state.max_integrity - 1)
        self.assertEqual(state.leaks, 1)
        self.assertEqual(len(state.enemies), 2)
        self.assertEqual(state.last_break_lane, "left")
        self.assertIn("漏过", events[-1])

    def test_push_from_gate_stake_knocks_target_back(self):
        state = build_game_state(7, doctrine("crusher"))
        deploy_unit_to_slot(state, "gate-stake", "L1")
        enemy = add_enemy(state, "pot-grunt", "left", 1)

        resolve_unit_actions(state)

        self.assertEqual(enemy.position_index, 0)

    def test_scout_slow_reduces_runner_movement(self):
        state = build_game_state(7, doctrine("oracle"))
        deploy_unit_to_slot(state, "whisker-scout", "LP")
        enemy = add_enemy(state, "pump-runner", "left", 0)

        resolve_unit_actions(state)
        resolve_enemy_movement(state)

        self.assertEqual(enemy.position_index, 1)

    def test_recall_refunds_tide_and_sets_shorter_gambler_cooldown(self):
        state = build_game_state(7, doctrine("gambler"))
        deploy_unit_to_slot(state, "ring-cutter", "LP")
        tide_after_deploy = state.tide

        unit, refund = recall_unit_at_slot(state, "LP")

        self.assertEqual(unit.unit_key, "ring-cutter")
        self.assertEqual(refund, 2)
        self.assertEqual(state.tide, tide_after_deploy + refund)
        self.assertIsNone(state.roster["ring-cutter"].slot_key)
        self.assertEqual(state.roster["ring-cutter"].ready_pulse, 2)
        self.assertEqual(state.roster["ring-cutter"].recalls, 1)

    def test_oracle_skill_slows_spawned_lane_immediately(self):
        state = build_game_state(7, doctrine("oracle"))
        state.wave_plan = [(SpawnEntry(lane="left", enemy_key="pump-runner", count=1),)]

        activate_oracle_skill(state, "left")
        events = resolve_pulse(state)

        self.assertEqual(state.tide, doctrine("oracle").starting_tide - doctrine("oracle").skill_cost)
        self.assertEqual(state.skill_uses, 1)
        self.assertEqual(state.skill_ready_pulse, 4)
        self.assertEqual(len(state.enemies), 1)
        self.assertEqual(state.enemies[0].position_index, 1)
        self.assertIn("点亮", events[1])

    def test_crusher_skill_buffs_targeted_path_slot_for_one_pulse(self):
        state = build_game_state(7, doctrine("crusher"))
        state.wave_plan = [()]
        deploy_unit_to_slot(state, "gate-stake", "L1")
        add_enemy(state, "pot-grunt", "left", 1, current_hp=4)
        tide_after_deploy = state.tide

        activate_crusher_skill(state, "L1")
        events = resolve_pulse(state)

        self.assertEqual(state.tide, tide_after_deploy - doctrine("crusher").skill_cost)
        self.assertEqual(state.skill_uses, 1)
        self.assertEqual(state.skill_ready_pulse, 4)
        self.assertEqual(len(state.enemies), 0)
        self.assertIsNone(state.crusher_skill_slot)
        self.assertIn("L1 闸桩 -> 【锅沿杂兵】 4。", events)
        self.assertIn("L1 闸桩 收壳了【锅沿杂兵】。", events)

    def test_gambler_skill_moves_unit_heals_and_preserves_duration(self):
        state = build_game_state(7, doctrine("gambler"))
        unit = deploy_unit_to_slot(state, "molt-decoy", "L1")
        unit.current_hp = unit_max_hp(state.doctrine, unit.unit_key) - 1
        unit.duration_left = 1
        tide_after_deploy = state.tide

        moved = activate_gambler_skill(state, "L1", "C")

        self.assertIs(moved, unit)
        self.assertEqual(unit.slot_key, "C")
        self.assertEqual(unit.last_slot, "C")
        self.assertEqual(unit.current_hp, unit_max_hp(state.doctrine, unit.unit_key))
        self.assertEqual(unit.duration_left, 1)
        self.assertEqual(state.tide, tide_after_deploy - doctrine("gambler").skill_cost)
        self.assertEqual(state.skill_uses, 1)
        self.assertEqual(state.skill_ready_pulse, 3)

    def test_leak_attribution_tracks_first_and_last_break(self):
        state = build_game_state(7, doctrine("crusher"))
        add_enemy(state, "octopus-hauler", "right", 2)

        resolve_enemy_movement(state)

        self.assertEqual(state.integrity, state.max_integrity - 2)
        self.assertEqual(state.last_break_lane, "right")
        self.assertEqual(state.last_break_enemy, ENEMIES["octopus-hauler"].title)
        self.assertEqual(state.first_leak["right"], (1, ENEMIES["octopus-hauler"].title))
        self.assertEqual(state.lane_leaks["right"], 2)
        self.assertEqual(state.leak_history[-1].enemy_key, "octopus-hauler")
        self.assertEqual(state.leak_history[-1].amount, 2)

    def test_tail_wave_cleanup_resolves_without_new_spawns(self):
        state = build_game_state(7, doctrine("crusher"))
        state.wave_plan = [()]
        state.pulse = 2
        deploy_unit_to_slot(state, "reef-guard", "L1")
        add_enemy(state, "pot-grunt", "left", 1, current_hp=3)

        events = resolve_pulse(state)

        self.assertEqual(pulse_display_label(state), "1+尾波")
        self.assertEqual(state.total_kills, 1)
        self.assertEqual(len(state.enemies), 0)
        self.assertEqual(events[0], "本 pulse 没有新敌潮入场。")


if __name__ == "__main__":
    unittest.main()
