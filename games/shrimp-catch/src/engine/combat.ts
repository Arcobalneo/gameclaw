/**
 * Turn-based battle engine.
 *
 * All transient battle state (stat stages, shields, statuses, per-battle affix
 * counters) lives inside `state.battle`, so a save can always be reloaded in the
 * middle of a fight. The engine never rolls a random number outside a passed Rng.
 */
import type { Rng } from '@gameclaw/gamekit';

import { consumeItem, itemName, itemOf } from './items';
import {
  AFFIX_BY_ID,
  type Affix,
  BALANCE,
  displayName,
  isStatusName,
  MAX_MOVES,
  type Skill,
  type SkillEffect,
  skillOf,
  speciesOf,
} from './species';
import type { BattleState, CombatantSide, Creature, TamerState } from './state';
import { emptySide, firstAliveIndex, hpRatio, maxHp } from './state';

export type BattleAction =
  | { kind: 'move'; index: number }
  | { kind: 'swap'; index: number }
  | { kind: 'potion'; itemId: string }
  | { kind: 'run' };

export interface TurnResult {
  log: string[];
  ended: boolean;
}

const LOG_LIMIT = 80;

function clampStage(value: number): number {
  return Math.max(0.25, Math.min(4, value));
}

export function createBattle(
  state: TamerState,
  enemy: Creature,
  mode: 'wild' | 'abyss',
  enemyFirst = false,
): BattleState {
  const playerIndex = firstAliveIndex(state);
  if (playerIndex < 0) throw new Error('Cannot start a battle with no living party member');
  const battle: BattleState = {
    mode,
    enemy,
    enemySide: emptySide(),
    playerIndex,
    playerSide: emptySide(),
    round: 0,
    log: [],
    enemyFirst,
    result: 'ongoing',
    expGained: 0,
  };
  const lines = applyPassiveTeam(state, battle);
  for (const line of lines) battle.log.push(line);
  if (mode === 'abyss') {
    const species = speciesOf(enemy.speciesId);
    battle.log.push(
      `深渊敌人：${species.name} Lv${enemy.level}（${species.type}${enemy.shiny ? ' · 灵光' : ''}）`,
    );
  }
  return battle;
}

function activeCreature(state: TamerState, battle: BattleState): Creature | null {
  return state.party[battle.playerIndex] ?? null;
}

function logLine(battle: BattleState, lines: string[], text: string): void {
  battle.log.push(text);
  lines.push(text);
  if (battle.log.length > LOG_LIMIT) battle.log.splice(0, battle.log.length - LOG_LIMIT);
}

function applyPassiveTeam(state: TamerState, battle: BattleState): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const creature of state.party) {
    if (!creature || creature.dead || creature.hp <= 0) continue;
    for (const slot of creature.affixSlots) {
      if (!slot.affixId || seen.has(slot.affixId)) continue;
      const affix = AFFIX_BY_ID.get(slot.affixId);
      if (affix?.trigger !== 'passive_team') continue;
      seen.add(slot.affixId);
      const effect = affix.effect;
      if (effect.type === 'stat_change' && effect.stat && effect.value !== undefined) {
        const stat = effect.stat as 'atk' | 'def' | 'spd';
        if (stat === 'atk' || stat === 'def' || stat === 'spd') {
          battle.playerSide.stage[stat] = clampStage(battle.playerSide.stage[stat] + effect.value);
          lines.push(`✦ 队伍词条 [${affix.name}] → ${stat}+${Math.round(effect.value * 100)}%`);
        }
      }
    }
  }
  return lines;
}

function stage(side: CombatantSide, stat: 'atk' | 'def' | 'spd'): number {
  return side.stage[stat];
}

function changeStage(side: CombatantSide, stat: string, value: number): void {
  if (stat !== 'atk' && stat !== 'def' && stat !== 'spd') return;
  side.stage[stat] = clampStage(side.stage[stat] + value);
}

function applyAffixEffect(
  battle: BattleState,
  owner: Creature,
  ownerSide: CombatantSide,
  oppSide: CombatantSide,
  affix: Affix,
  rng: Rng,
  lines: string[],
): void {
  const effect = affix.effect;
  if (effect.type === 'stat_change' && effect.stat && effect.value !== undefined) {
    const target = effect.target === 'enemy' ? oppSide : ownerSide;
    changeStage(target, effect.stat, effect.value);
    const arrow = effect.value >= 0 ? '↑' : '↓';
    lines.push(`  ${effect.stat.toUpperCase()}${arrow}`);
  } else if (effect.type === 'shield' && effect.value !== undefined) {
    ownerSide.shield += effect.value * maxHp(owner);
    lines.push(`  获得 ${Math.round(effect.value * maxHp(owner))} 护盾`);
  } else if (effect.type === 'heal' && effect.value !== undefined) {
    const before = owner.hp;
    owner.hp = Math.min(maxHp(owner), owner.hp + effect.value * maxHp(owner));
    lines.push(`  回复 ${Math.round(owner.hp - before)} HP`);
  } else if (effect.type === 'status_apply') {
    if (!oppSide.status && isStatusName(effect.status) && rng.chance(effect.chance ?? 0)) {
      oppSide.status = effect.status;
      oppSide.statusTurns = 0;
      if (effect.status === '冰封') oppSide.freezeSkip = true;
      lines.push(`  词条附加状态：${effect.status}`);
    }
  } else if (effect.type === 'terrain') {
    lines.push(`  场地变化：${effect.name ?? '未知地形'}`);
  }
  void battle;
}

function triggerAffixes(
  battle: BattleState,
  owner: Creature,
  ownerSide: CombatantSide,
  oppSide: CombatantSide,
  event: string,
  rng: Rng,
  lines: string[],
): void {
  for (const slot of owner.affixSlots) {
    if (!slot.affixId) continue;
    const affix = AFFIX_BY_ID.get(slot.affixId);
    if (!affix || affix.trigger !== event) continue;
    const used = ownerSide.affixCounts[affix.id] ?? 0;
    if (used >= (affix.trigger_limit_per_battle ?? 99)) continue;
    if (event === 'on_hp_threshold') {
      const threshold = affix.trigger_threshold ?? 0.25;
      if (hpRatio(owner) > threshold) continue;
    }
    ownerSide.affixCounts[affix.id] = used + 1;
    lines.push(`  ✦ ${affix.name} 触发`);
    applyAffixEffect(battle, owner, ownerSide, oppSide, affix, rng, lines);
  }
}

function enemyDamageMultiplier(state: TamerState): number {
  if (state.difficulty === 'easy') return 0.6;
  if (state.difficulty === 'hard') return 1.25;
  return 1;
}

export function activeCreatureOf(state: TamerState): Creature | null {
  if (!state.battle) return null;
  return activeCreature(state, state.battle);
}

export function availableMoves(state: TamerState): string[] {
  const creature = activeCreatureOf(state);
  if (!creature) return [];
  return creature.moves.slice(0, MAX_MOVES);
}

function resolvePriority(
  state: TamerState,
  battle: BattleState,
  skill: Skill | null,
  rng: Rng,
): boolean {
  const player = activeCreature(state, battle);
  if (!player) return false;
  let priority = 0;
  if (skill) {
    for (const effect of skill.effects) {
      if (effect.type === 'priority') priority = effect.value ?? 1;
    }
  }
  const playerSpd = player.stats.spd * stage(battle.playerSide, 'spd') + priority * 9999;
  const enemySpd = battle.enemy.stats.spd * stage(battle.enemySide, 'spd');
  if (playerSpd === enemySpd) return rng.chance(0.5);
  return playerSpd > enemySpd;
}

function maybeSkipAction(
  side: CombatantSide,
  creature: Creature,
  rng: Rng,
  lines: string[],
  battle: BattleState,
): boolean {
  if (side.status === '麻痹' && rng.chance(0.3)) {
    logLine(battle, lines, `${displayName(creature)} 麻痹！无法行动`);
    return true;
  }
  if (side.status === '冰封' && side.freezeSkip) {
    side.freezeSkip = false;
    logLine(battle, lines, `${displayName(creature)} 被冰封，无法行动`);
    return true;
  }
  if (side.status === '困惑' && rng.chance(0.35)) {
    const damage = creature.stats.atk * 0.4;
    creature.hp = Math.max(0, creature.hp - damage);
    logLine(
      battle,
      lines,
      `${displayName(creature)} 陷入混乱，攻击了自己！（${Math.round(damage)}）`,
    );
    if (creature.hp <= 0) creature.dead = true;
    return true;
  }
  return false;
}

function conditionalBonus(effects: SkillEffect[], attacker: Creature, defender: Creature): number {
  let bonus = 1;
  for (const effect of effects) {
    if (effect.type !== 'conditional') continue;
    if (effect.condition === 'hp_below_half' && hpRatio(attacker) < 0.5) {
      bonus += effect.power_bonus ?? 0;
    } else if (effect.condition === 'target_low_hp' && hpRatio(defender) < 0.3) {
      bonus += effect.power_bonus ?? 0;
    }
  }
  return bonus;
}

function multihit(effects: SkillEffect[], rng: Rng): number {
  for (const effect of effects) {
    if (effect.type === 'multi_hit' && effect.hits) {
      return rng.int(effect.hits[0], effect.hits[1]);
    }
  }
  return 1;
}

function applySkill(
  state: TamerState,
  rng: Rng,
  battle: BattleState,
  skill: Skill,
  attacker: Creature,
  defender: Creature,
  attackerSide: CombatantSide,
  defenderSide: CombatantSide,
  playerAttacker: boolean,
  lines: string[],
): void {
  if (!rng.chance(skill.accuracy)) {
    logLine(battle, lines, `${displayName(attacker)} 的 ${skill.name} 没有命中`);
    return;
  }

  triggerAffixes(battle, attacker, attackerSide, defenderSide, 'on_deal_damage', rng, lines);

  const typeEffect = typeMultiplier(skill.type, speciesOf(defender.speciesId).type);

  if (skill.power > 0) {
    const atk = attacker.stats.atk * stage(attackerSide, 'atk');
    const def = Math.max(1, defender.stats.def * stage(defenderSide, 'def'));
    const randomFactor = 0.85 + rng.float() * 0.15;
    const crit = rng.chance(BALANCE.combat.crit_rate);
    const cond = conditionalBonus(skill.effects, attacker, defender);
    const hits = multihit(skill.effects, rng);
    let damage =
      (((skill.power * atk) / def) * typeEffect * randomFactor * (crit ? 1.5 : 1) * cond) / 4;
    damage *= hits;
    if (!playerAttacker) damage *= enemyDamageMultiplier(state);

    if (crit) lines.push('  会心一击！');
    if (typeEffect > 1) lines.push('  效果拔群！');
    else if (typeEffect < 1 && typeEffect > 0) lines.push('  效果不太好……');

    if (damage > 0) {
      if (defenderSide.shield > 0) {
        const absorbed = Math.min(defenderSide.shield, damage);
        defenderSide.shield -= absorbed;
        damage -= absorbed;
        if (absorbed > 0) lines.push(`  护盾吸收了 ${absorbed.toFixed(1)} 伤害`);
      }
      defender.hp = Math.max(0, defender.hp - damage);
      const suffix = hits > 1 ? `（共${hits}连击）` : '';
      lines.push(`  造成 ${damage.toFixed(1)} 伤害${suffix}`);
      if (defender.hp <= 0) defender.dead = true;
    }
  }

  for (const effect of skill.effects) {
    if (effect.type === 'heal' && effect.value !== undefined) {
      const before = attacker.hp;
      attacker.hp = Math.min(maxHp(attacker), attacker.hp + effect.value * maxHp(attacker));
      lines.push(`  回复了 ${(attacker.hp - before).toFixed(1)} HP`);
    } else if (effect.type === 'shield' && effect.value !== undefined) {
      attackerSide.shield += effect.value * maxHp(attacker);
      lines.push(`  获得 ${Math.round(effect.value * maxHp(attacker))} 护盾`);
    } else if (effect.type === 'status_apply') {
      if (!defenderSide.status && isStatusName(effect.status) && rng.chance(effect.chance ?? 0)) {
        defenderSide.status = effect.status;
        defenderSide.statusTurns = 0;
        if (effect.status === '冰封') defenderSide.freezeSkip = true;
        lines.push(`  ${displayName(defender)} 陷入了 ${effect.status}！`);
      }
    } else if (effect.type === 'stat_change' && effect.stat && effect.value !== undefined) {
      const target = effect.target === 'self' ? attackerSide : defenderSide;
      changeStage(target, effect.stat, effect.value);
      const direction = effect.value > 0 ? '↑' : '↓';
      lines.push(`  ${effect.stat.toUpperCase()} ${direction}`);
    } else if (effect.type === 'recoil' && effect.value !== undefined) {
      const recoil = effect.value * maxHp(attacker);
      attacker.hp = Math.max(0, attacker.hp - recoil);
      lines.push(`  反伤 ${recoil.toFixed(1)}`);
      if (attacker.hp <= 0) attacker.dead = true;
    } else if (effect.type === 'terrain') {
      lines.push(`  场地变成 ${effect.name ?? '未知地形'}（叙事效果）`);
    }
  }

  triggerAffixes(battle, defender, defenderSide, attackerSide, 'on_take_damage', rng, lines);
  if (hpRatio(defender) < 0.5) {
    triggerAffixes(battle, attacker, attackerSide, defenderSide, 'on_hp_threshold', rng, lines);
  }
}

export function typeMultiplier(attackType: string, defenderType: string): number {
  const entry = BALANCE.combat.type_effectiveness[attackType];
  if (entry && entry.克制 === defenderType) return entry.克制倍率;
  return 1;
}

function tickStatuses(state: TamerState, battle: BattleState, lines: string[]): void {
  const sides: { side: CombatantSide; creature: Creature | null }[] = [
    { side: battle.enemySide, creature: battle.enemy },
    { side: battle.playerSide, creature: activeCreature(state, battle) },
  ];
  for (const { side, creature } of sides) {
    if (!creature) continue;
    // Do not let poison finish the player after the winning blow landed.
    if (side === battle.playerSide && (battle.enemy.hp <= 0 || battle.enemy.dead)) continue;
    if (side.status === '中毒' || side.status === '灼烧') {
      const damage = maxHp(creature) * 0.05;
      creature.hp = Math.max(0, creature.hp - damage);
      logLine(
        battle,
        lines,
        `${displayName(creature)} ${side.status}！受到 ${damage.toFixed(1)} 伤害`,
      );
      if (side.status === '灼烧') {
        side.stage.atk = clampStage(side.stage.atk - 0.02);
      }
      if (creature.hp <= 0) creature.dead = true;
    }
    if (side.statusTurns > 0) {
      side.statusTurns -= 1;
      if (side.statusTurns === 0) {
        lines.push(`${displayName(creature)} 的 ${side.status} 解除了`);
        side.status = null;
      }
    }
    if (side.shield > 0) side.shield = Math.max(0, side.shield * 0.5);
  }
}

function checkEnd(state: TamerState, battle: BattleState, rng: Rng, lines: string[]): void {
  if (battle.result !== 'ongoing') return;
  if (battle.enemy.hp <= 0 || battle.enemy.dead) {
    battle.result = 'win';
    const species = speciesOf(battle.enemy.speciesId);
    battle.expGained = Math.max(10, species.affix_slots * battle.enemy.level * 8);
    logLine(battle, lines, `✓ ${displayName(battle.enemy)} 倒下了！获得 ${battle.expGained} EXP`);
    return;
  }

  const player = activeCreature(state, battle);
  if (!player || player.hp > 0) return;
  player.dead = true;
  const nextIndex = state.party.findIndex(
    (creature, index) =>
      index !== battle.playerIndex && creature !== null && !creature.dead && creature.hp > 0,
  );
  if (nextIndex >= 0) {
    const next = state.party[nextIndex];
    if (!next) return;
    logLine(battle, lines, `⚡ ${displayName(player)} 倒下！${displayName(next)} 自动上场`);
    battle.playerIndex = nextIndex;
    battle.playerSide = emptySide();
    applyPassiveTeam(state, battle);
    triggerAffixes(battle, next, battle.playerSide, battle.enemySide, 'on_switch_in', rng, lines);
    return;
  }
  battle.result = 'lose';
  logLine(battle, lines, '✗ 我方全灭！');
}

function doPlayerMove(
  state: TamerState,
  rng: Rng,
  battle: BattleState,
  moveIndex: number,
  lines: string[],
): void {
  const player = activeCreature(state, battle);
  if (!player || player.dead || player.hp <= 0) return;
  if (maybeSkipAction(battle.playerSide, player, rng, lines, battle)) return;

  const moveName =
    player.moves[moveIndex] ?? player.moves[0] ?? speciesOf(player.speciesId).base_skill;
  const skill = skillOf(moveName);
  if (!skill) {
    logLine(battle, lines, `[找不到技能 ${moveName}，跳过]`);
    return;
  }
  logLine(battle, lines, `${displayName(player)} 使用了 【${skill.name}】`);
  applySkill(
    state,
    rng,
    battle,
    skill,
    player,
    battle.enemy,
    battle.playerSide,
    battle.enemySide,
    true,
    lines,
  );
}

function doEnemyMove(state: TamerState, rng: Rng, battle: BattleState, lines: string[]): void {
  const enemy = battle.enemy;
  if (enemy.dead || enemy.hp <= 0) return;
  if (maybeSkipAction(battle.enemySide, enemy, rng, lines, battle)) return;

  const options = enemy.moves.filter((move) => skillOf(move));
  const moveName = options.length > 0 ? rng.pick(options) : speciesOf(enemy.speciesId).base_skill;
  const skill = skillOf(moveName);
  if (!skill) return;
  const player = activeCreature(state, battle);
  if (!player) return;
  logLine(battle, lines, `${displayName(enemy)} 使用了 【${skill.name}】`);
  applySkill(
    state,
    rng,
    battle,
    skill,
    enemy,
    player,
    battle.enemySide,
    battle.playerSide,
    false,
    lines,
  );
}

export function enemyFreeAttack(state: TamerState, rng: Rng): TurnResult {
  const battle = state.battle;
  if (battle?.result !== 'ongoing') return { log: [], ended: true };
  const lines: string[] = [];
  logLine(battle, lines, '敌方趁机出手！');
  doEnemyMove(state, rng, battle, lines);
  checkEnd(state, battle, rng, lines);
  return { log: lines, ended: battle.result !== 'ongoing' };
}

function handleRun(state: TamerState, rng: Rng, battle: BattleState, lines: string[]): TurnResult {
  if (battle.mode === 'abyss') {
    logLine(battle, lines, '你放弃了这场深渊战斗，准备撤退。');
    battle.result = 'retreat';
    return { log: lines, ended: true };
  }
  const player = activeCreature(state, battle);
  const chance = player
    ? Math.max(0.35, Math.min(0.95, 0.5 + (player.stats.spd - battle.enemy.stats.spd) / 200))
    : 0.35;
  if (rng.chance(chance)) {
    logLine(battle, lines, '成功逃离了战斗。');
    battle.result = 'fled';
    return { log: lines, ended: true };
  }
  logLine(battle, lines, '逃跑失败！');
  doEnemyMove(state, rng, battle, lines);
  checkEnd(state, battle, rng, lines);
  return { log: lines, ended: battle.result !== 'ongoing' };
}

function handleSwap(
  state: TamerState,
  rng: Rng,
  battle: BattleState,
  index: number,
  lines: string[],
): TurnResult {
  const incoming = state.party[index];
  const outgoing = activeCreature(state, battle);
  if (!incoming || incoming.dead || incoming.hp <= 0) {
    logLine(battle, lines, '[换手失败：该虾米已无法战斗]');
    return { log: lines, ended: false };
  }
  if (index === battle.playerIndex) {
    logLine(battle, lines, '[换手失败：已经是当前上场的虾米]');
    return { log: lines, ended: false };
  }
  if (outgoing) {
    logLine(battle, lines, `${displayName(outgoing)} 退场，${displayName(incoming)} 上场！`);
  }
  battle.playerIndex = index;
  battle.playerSide = emptySide();
  applyPassiveTeam(state, battle);
  triggerAffixes(battle, incoming, battle.playerSide, battle.enemySide, 'on_switch_in', rng, lines);
  logLine(battle, lines, '敌方趁换手出手！');
  doEnemyMove(state, rng, battle, lines);
  checkEnd(state, battle, rng, lines);
  return { log: lines, ended: battle.result !== 'ongoing' };
}

function handlePotion(
  state: TamerState,
  rng: Rng,
  battle: BattleState,
  itemId: string,
  lines: string[],
): TurnResult {
  const item = itemOf(itemId);
  const player = activeCreature(state, battle);
  if (item?.type !== 'heal' || !player) {
    throw new Error(`Cannot use ${itemId} in battle`);
  }
  if (!consumeItem(state, itemId, 1)) throw new Error(`No ${itemName(itemId)} left`);
  const heal = maxHp(player) * (item.heal_ratio ?? 0.25);
  const before = player.hp;
  player.hp = Math.min(maxHp(player), player.hp + heal);
  logLine(
    battle,
    lines,
    `使用 ${item.name}，${displayName(player)} 回复 ${Math.round(player.hp - before)} HP`,
  );
  logLine(battle, lines, '敌方趁治疗出手！');
  doEnemyMove(state, rng, battle, lines);
  checkEnd(state, battle, rng, lines);
  return { log: lines, ended: battle.result !== 'ongoing' };
}

export function battleTurn(state: TamerState, rng: Rng, action: BattleAction): TurnResult {
  const battle = state.battle;
  if (battle?.result !== 'ongoing') {
    return { log: ['战斗已经结束。'], ended: true };
  }
  const lines: string[] = [];
  battle.round += 1;
  logLine(battle, lines, `── 回合 ${battle.round} ──`);

  const player = activeCreature(state, battle);
  if (player) {
    triggerAffixes(
      battle,
      player,
      battle.playerSide,
      battle.enemySide,
      'on_turn_start',
      rng,
      lines,
    );
  }
  triggerAffixes(
    battle,
    battle.enemy,
    battle.enemySide,
    battle.playerSide,
    'on_turn_start',
    rng,
    lines,
  );

  if (action.kind === 'run') return handleRun(state, rng, battle, lines);
  if (action.kind === 'swap') return handleSwap(state, rng, battle, action.index, lines);
  if (action.kind === 'potion') {
    return handlePotion(state, rng, battle, action.itemId, lines);
  }

  const moveName = player?.moves[action.index] ?? null;
  const chosenSkill = skillOf(moveName);
  let playerFirst = resolvePriority(state, battle, chosenSkill, rng);
  if (battle.enemyFirst) {
    playerFirst = false;
    battle.enemyFirst = false;
  }

  if (playerFirst) {
    doPlayerMove(state, rng, battle, action.index, lines);
    if (battle.result === 'ongoing') doEnemyMove(state, rng, battle, lines);
  } else {
    doEnemyMove(state, rng, battle, lines);
    if (battle.result === 'ongoing') doPlayerMove(state, rng, battle, action.index, lines);
  }

  tickStatuses(state, battle, lines);
  checkEnd(state, battle, rng, lines);

  const opponent = battle.enemy;
  triggerAffixes(battle, opponent, battle.enemySide, battle.playerSide, 'on_turn_end', rng, lines);
  const currentPlayer = activeCreature(state, battle);
  if (currentPlayer) {
    triggerAffixes(
      battle,
      currentPlayer,
      battle.playerSide,
      battle.enemySide,
      'on_turn_end',
      rng,
      lines,
    );
  }
  checkEnd(state, battle, rng, lines);
  return { log: lines, ended: battle.result !== 'ongoing' };
}

export function battleSideSummary(state: TamerState, battle: BattleState): string[] {
  const player = activeCreature(state, battle);
  const lines: string[] = [];
  if (player) {
    lines.push(
      `我方 #${battle.playerIndex} ${displayName(player)} Lv${player.level} HP ${Math.ceil(player.hp)}/${Math.ceil(maxHp(player))}${battle.playerSide.shield > 0 ? ` 🛡${Math.round(battle.playerSide.shield)}` : ''}${battle.playerSide.status ? ` [${battle.playerSide.status}]` : ''}`,
    );
  }
  lines.push(
    `敌方 ${displayName(battle.enemy)} Lv${battle.enemy.level} HP ${Math.ceil(battle.enemy.hp)}/${Math.ceil(maxHp(battle.enemy))}${battle.enemySide.shield > 0 ? ` 🛡${Math.round(battle.enemySide.shield)}` : ''}${battle.enemySide.status ? ` [${battle.enemySide.status}]` : ''}`,
  );
  return lines;
}
