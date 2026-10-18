/**
 * Overworld: zones, sub-areas, step pacing, wild encounters and zone unlocks.
 */
import type { Rng } from '@gameclaw/gamekit';

import { createBattle } from './combat';
import { rollBattleLoot } from './items';
import { grantExp, restoreAfterWildBattle } from './party';
import {
  BALANCE,
  displayName,
  extraEnemyMoves,
  makeCreature,
  type SubArea,
  speciesOf,
  ZONE_BY_ID,
  ZONES,
  type Zone,
} from './species';
import type { Creature, TamerState } from './state';
import { addUnique, firstAliveIndex, maxPartyLevel, nextUid, note, timeline } from './state';

export function zoneById(zoneId: string): Zone | null {
  return ZONE_BY_ID.get(zoneId) ?? null;
}

export function subAreaById(zone: Zone, subAreaId: string): SubArea | null {
  return zone.sub_areas.find((sub) => sub.id === subAreaId) ?? null;
}

export function zoneDisplayName(zoneId: string): string {
  return zoneById(zoneId)?.name ?? zoneId;
}

export function subAreaDisplayName(zoneId: string, subAreaId: string): string {
  const zone = zoneById(zoneId);
  return zone ? (subAreaById(zone, subAreaId)?.name ?? subAreaId) : subAreaId;
}

export function unlockedZoneList(state: TamerState): Zone[] {
  return ZONES.filter((zone) => state.unlockedZones.includes(zone.id));
}

function conditionUnlocked(state: TamerState, condition: string): boolean {
  const raw = condition.trim();
  if (raw === 'default') return true;
  if (raw.startsWith('tower_best>=')) {
    const threshold = Number.parseInt(raw.slice('tower_best>='.length), 10);
    return Number.isFinite(threshold) && state.deepestFloor >= threshold;
  }
  if (raw.startsWith('dex>=')) {
    const threshold = Number.parseInt(raw.slice('dex>='.length), 10);
    return Number.isFinite(threshold) && state.dexCaught.length >= threshold;
  }
  return false;
}

/** Returns newly unlocked zone ids. Unlocks are derived from depth and dex. */
export function checkUnlocks(state: TamerState): string[] {
  const unlocked: string[] = [];
  for (const zone of ZONES) {
    if (state.unlockedZones.includes(zone.id)) continue;
    if (conditionUnlocked(state, zone.unlock_condition)) {
      state.unlockedZones.push(zone.id);
      unlocked.push(zone.id);
      note(state, `观察：探索进度解锁了新区域 ${zone.name}（${zone.unlock_condition}）。`);
    }
  }
  return unlocked;
}

export function beginExplore(
  state: TamerState,
  rng: Rng,
  zoneId: string,
  subAreaId: string,
): string[] {
  const zone = zoneById(zoneId);
  if (!zone) throw new Error(`Unknown zone: ${zoneId}`);
  const sub = subAreaById(zone, subAreaId) ?? zone.sub_areas[0];
  if (!sub) throw new Error(`Zone ${zoneId} has no sub-areas`);
  state.currentZone = zone.id;
  state.currentSubArea = sub.id;
  state.explore = {
    zoneId: zone.id,
    subAreaId: sub.id,
    steps: 0,
    target: rollSteps(state, rng),
  };
  state.phase = 'explore';
  return [`进入 ${zone.name} / ${sub.name}（Lv${sub.level_range[0]}-${sub.level_range[1]}）。`];
}

function rollSteps(_state: TamerState, rng: Rng): number {
  const min = BALANCE.world.steps_min;
  const max = BALANCE.world.steps_max;
  return rng.int(min, max);
}

/** Roll one wild encounter. `null` means the area stayed quiet. */
export function rollWildEncounter(state: TamerState, rng: Rng): Creature | null {
  const zone = zoneById(state.currentZone);
  const sub = zone ? subAreaById(zone, state.currentSubArea) : null;
  if (!sub) return null;
  const table = sub.encounter_table;
  if (table.length === 0) return null;

  const sum = table.reduce((total, entry) => total + entry.weight, 0);
  const noEncounter = BALANCE.capture.no_encounter_weight * sum;
  const choices: { speciesId: string; weight: number }[] = [
    { speciesId: '__none__', weight: noEncounter },
    ...table.map((entry) => ({ speciesId: entry.species_id, weight: entry.weight })),
  ];
  const total = choices.reduce((acc, choice) => acc + choice.weight, 0);
  let roll = rng.float() * total;
  let picked = '__none__';
  for (const choice of choices) {
    roll -= choice.weight;
    if (roll <= 0) {
      picked = choice.speciesId;
      break;
    }
  }
  if (picked === '__none__') return null;

  const species = speciesOf(picked);
  const [min, max] = sub.level_range;
  let level = rng.int(min, max);
  const partyLevel = maxPartyLevel(state);
  const cap = state.difficulty === 'easy' ? partyLevel : partyLevel + 4;
  level = Math.max(1, Math.min(level, cap));

  const shiny = rng.chance(BALANCE.capture.shiny_rate);
  const extra = extraEnemyMoves(species, level, rng, level >= 20 ? 2 : level >= 10 ? 1 : 0);
  const wild = makeCreature(picked, level, {
    uid: nextUid(state),
    shiny,
    moves: [species.base_skill, ...extra],
  });
  return wild;
}

export function enterEncounter(state: TamerState, wild: Creature): string[] {
  state.wild = wild;
  state.catchBait = false;
  state.phase = 'encounter';
  const species = speciesOf(wild.speciesId);
  addUnique(state.dexSeen, wild.speciesId);
  const prefix = wild.shiny ? '✦ 灵光！' : '';
  const line = `${prefix}野生 ${species.name}（Lv${wild.level} · ${species.type}）出现了！`;
  if (wild.shiny) {
    note(state, `观察：灵光 ${species.name} 出现，灵光个体捕捉率更低，词条更好。`);
  }
  timeline(state, `遭遇 ${species.name} Lv${wild.level}`);
  return [line];
}

/** `menu:battle` convenience: look for a wild creature without walking. */
export function findWildEncounter(state: TamerState, rng: Rng, attempts = 4): string[] {
  for (let i = 0; i < attempts; i += 1) {
    const wild = rollWildEncounter(state, rng);
    if (wild) return enterEncounter(state, wild);
  }
  return ['你在附近找了一圈，没有遇到野生虾米。'];
}

export function exploreStep(state: TamerState, rng: Rng): string[] {
  const explore = state.explore;
  if (!explore) throw new Error('Not exploring');
  explore.steps += 1;
  if (explore.steps < explore.target) {
    return [`第 ${explore.steps}/${explore.target} 步，水面暂时平静。`];
  }
  explore.steps = 0;
  explore.target = rollSteps(state, rng);
  const wild = rollWildEncounter(state, rng);
  if (!wild) return ['水面依旧平静，这一轮没有遇到野生虾米。'];
  return enterEncounter(state, wild);
}

export function startWildBattle(state: TamerState, enemyFirst: boolean): string[] {
  if (!state.wild) throw new Error('No wild creature to fight');
  if (firstAliveIndex(state) < 0) return ['队伍全灭，无法战斗。'];
  state.battle = createBattle(state, state.wild, 'wild', enemyFirst);
  state.phase = 'battle';
  const lines = [`战斗开始：${displayName(state.wild)} 拦住了去路。`];
  if (enemyFirst) lines.push('诱饵激怒了它，敌方先手！');
  timeline(state, `战斗开始 vs ${displayName(state.wild)}`);
  return lines;
}

export function fleeWildEncounter(state: TamerState, rng: Rng): boolean {
  const leadIndex = firstAliveIndex(state);
  const lead = state.party[leadIndex];
  if (!lead || !state.wild) return false;
  const playerSpd = lead.stats.spd;
  const enemySpd = state.wild.stats.spd;
  const chance = Math.max(0.35, Math.min(0.95, 0.55 + (playerSpd - enemySpd) / 200));
  return rng.chance(chance);
}

export function fleeWildBattle(state: TamerState, rng: Rng): boolean {
  const leadIndex = firstAliveIndex(state);
  const battle = state.battle;
  const lead = state.party[leadIndex];
  if (!lead || !battle) return false;
  const chance = Math.max(
    0.35,
    Math.min(0.95, 0.5 + (lead.stats.spd - battle.enemy.stats.spd) / 200),
  );
  return rng.chance(chance);
}

/** Resolve rewards, revivals and phase after a wild battle. */
export function resolveWildBattleEnd(
  state: TamerState,
  rng: Rng,
  result: 'win' | 'lose' | 'fled' | 'caught',
): string[] {
  const battle = state.battle;
  const exp = battle?.expGained ?? 0;
  const wildName = state.wild ? displayName(state.wild) : '野生虾米';
  const lines: string[] = [];
  state.battle = null;
  state.wild = null;
  state.catchBait = false;

  if (result === 'win') {
    state.totalBattles += 1;
    const amount = exp || 10;
    state.party.forEach((creature, index) => {
      if (!creature || creature.dead || creature.hp <= 0) return;
      lines.push(...grantExp(state, creature, amount, rng, index));
    });
    const loot = rollBattleLoot(state, rng);
    if (loot) {
      state.items[loot.id] = (state.items[loot.id] ?? 0) + loot.count;
      lines.push(
        `击退 ${wildName} 后捡到了 ${loot.name} ×${loot.count}${loot.guaranteed ? '（保底）' : ''}`,
      );
    }
    note(
      state,
      `观察：在 ${zoneDisplayName(state.currentZone)} 击败 ${wildName}，获得 ${amount} EXP。`,
    );
    timeline(state, `击败 ${wildName}`);
  } else if (result === 'lose') {
    state.totalBattles += 1;
    state.explore = null;
    state.phase = 'menu';
    lines.push('你带着倒下的队伍退回营地，野外战斗不产生永久死亡。');
    note(state, '教训：野外全灭只是撤退；深渊全灭或战斗内 HP 归零才是永久死亡。');
    timeline(state, `野外全灭 vs ${wildName}`);
  } else if (result === 'caught') {
    lines.push(`${wildName} 已被收进甲录。`);
  } else {
    lines.push('你成功脱离了战斗。');
    timeline(state, `逃离 ${wildName}`);
  }

  lines.push(...restoreAfterWildBattle(state));
  if (state.phase !== 'menu') {
    state.phase = state.pendingSkills.length > 0 ? 'skill' : state.explore ? 'explore' : 'menu';
  }
  state.lastResult = lines[lines.length - 1] ?? state.lastResult;
  return lines;
}
