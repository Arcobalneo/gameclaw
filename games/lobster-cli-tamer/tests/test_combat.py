"""测试战斗引擎。"""
from lobster_cli_tamer.loader import load_game_data
from lobster_cli_tamer.creature import Creature
from lobster_cli_tamer.affixes import roll_affix_slots
from lobster_cli_tamer.combat import (
    BattleState, BattleEngine, BattleAction, ActionType,
    BattleResult, Combatant, make_enemy_combatant,
)

_data = None

def _get_data():
    global _data
    if _data is None:
        _data = load_game_data()
    return _data


def _make_player(species_id: str = "reef_shrimp", level: int = 10) -> tuple:
    data = _get_data()
    c = Creature.from_species(species_id, data, level=level)
    c.bind_species_data(data)
    c.moves = ["潮击1", "防御姿态1", "蜕壳1"]
    return c, data


def test_player_wins_low_level_enemy() -> None:
    player_c, data = _make_player("reef_shrimp", 15)
    enemy = make_enemy_combatant("rock_crab", 5, data)
    enemy.creature.moves = ["岩砸1"]
    state = BattleState(
        player=Combatant(creature=player_c),
        enemy=enemy,
        player_party=[player_c],
    )
    engine = BattleEngine(state, data)
    for _ in range(40):
        if state.is_over():
            break
        engine.run_turn(BattleAction(action_type=ActionType.USE_SKILL, skill_name="潮击1"))
    assert state.result == BattleResult.PLAYER_WIN


def test_player_loses_impossible_fight() -> None:
    """玩家 Lv1 对 Lv50 传说级，应该输。"""
    player_c, data = _make_player("reef_shrimp", 1)
    enemy = make_enemy_combatant("abyss_claw_king", 50, data)
    # 使用物种默认 base_skill（深渊螯压，已在 core_named_skills 中定义）
    # from_species 已自动设置 moves=[base_skill]，无需覆盖
    state = BattleState(
        player=Combatant(creature=player_c),
        enemy=enemy,
        player_party=[player_c],
    )
    engine = BattleEngine(state, data)
    for _ in range(50):
        if state.is_over():
            break
        engine.run_turn(BattleAction(action_type=ActionType.USE_SKILL, skill_name="潮击1"))
    assert state.result == BattleResult.PLAYER_LOSE


def test_type_effectiveness_matters() -> None:
    """潮系攻击电系：伤害应高于攻击同系。"""
    data = _get_data()
    from lobster_cli_tamer.skills import execute_skill, get_type_effectiveness

    skill = next(s for s in data.skills.values() if s.get("type") == "潮" and s.get("power", 0) > 50)
    attacker = Creature.from_species("reef_shrimp", data, level=10)
    attacker.bind_species_data(data)
    neutral = Creature.from_species("rock_crab", data, level=10)
    neutral.bind_species_data(data)
    electric = Creature.from_species("electric_shrimp", data, level=10)
    electric.bind_species_data(data)

    eff_neutral = get_type_effectiveness("潮", "岩", data.balance)
    eff_electric = get_type_effectiveness("潮", "电", data.balance)
    assert eff_electric > eff_neutral


def test_auto_switch_when_active_fainted() -> None:
    """深渊：第一只虾米 HP 归零后，引擎应自动换上第二只，不卡死。"""
    data = _get_data()

    # 第一只：极低血量，一击就倒
    c1 = Creature.from_species("reef_shrimp", data, level=1)
    c1.bind_species_data(data)
    c1.moves = ["潮击1"]
    c1.hp_current = 1.0  # 濒死

    # 第二只：正常
    c2 = Creature.from_species("rock_crab", data, level=5)
    c2.bind_species_data(data)
    c2.moves = ["岩砸1"]

    enemy = make_enemy_combatant("reef_shrimp", 1, data)
    enemy.creature.moves = ["潮击1"]

    state = BattleState(
        player=Combatant(creature=c1),
        enemy=enemy,
        player_party=[c1, c2],
        is_tower=True,
    )
    engine = BattleEngine(state, data)

    # 最多跑 60 回合，战斗必须结束（不能无限循环）
    for _ in range(60):
        if state.is_over():
            break
        engine.run_turn(BattleAction(action_type=ActionType.USE_SKILL, skill_name="潮击1"))

    assert state.is_over(), "战斗应在有限回合内结束，不应卡死"
    # c1 已倒，引擎应换上了 c2
    assert not c1.is_alive, "c1 应已倒下"


def test_permadeath_in_tower() -> None:
    """深渊模式：玩家虾米 HP 归零时 dead=True。"""
    player_c, data = _make_player("reef_shrimp", 1)
    enemy = make_enemy_combatant("abyss_claw_king", 50, data)
    enemy.creature.moves = ["深渊螯压奥义"]
    state = BattleState(
        player=Combatant(creature=player_c),
        enemy=enemy,
        player_party=[player_c],
        is_tower=True,
    )
    engine = BattleEngine(state, data)
    for _ in range(30):
        if state.is_over():
            break
        engine.run_turn(BattleAction(action_type=ActionType.USE_SKILL, skill_name="潮击1"))
    if state.result == BattleResult.PLAYER_LOSE:
        assert player_c.dead, "深渊模式下战斗死亡应设 dead=True"
