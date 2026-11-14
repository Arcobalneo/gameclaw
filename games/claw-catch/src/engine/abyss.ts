/**
 * The endless abyss: scaling floors, a boss every ten floors, taint -> plague,
 * retreat death rolls and in-battle permanent death.
 */
import type { Rng } from '@gameclaw/gamekit';

import { createBattle } from './combat';
import { rollAbyssDrop } from './items';
import { autoRefillFromBox, cleanupAbyssDead, grantExp, hasLivingRoster } from './party';
import { BALANCE, displayName, extraEnemyMoves, makeCreature, speciesOf, TOWER } from './species';
import type { Creature, TamerState } from './state';
import { alivePartyIndices, maxPartyLevel, nextUid, note, timeline } from './state';
import { rollAffixSlots } from './workshop';

export type FloorKind = 'normal' | 'elite' | 'boss';

export const WIN_FLOOR = Math.max(60, ...TOWER.milestone_unlocks.map((entry) => entry.floor));

export function floorKind(floor: number): FloorKind {
  if (floor % TOWER.boss_every_n_floors === 0) return 'boss';
  if (floor % 5 === 4) return 'elite';
  return 'normal';
}

export function floorKindLabel(kind: FloorKind): string {
  if (kind === 'boss') return 'BOSS';
  if (kind === 'elite') return '精英';
  return '普通';
}

function bossForFloor(
  floor: number,
): { boss: (typeof TOWER.bosses)[number]; cycle: number } | null {
  const bosses = TOWER.bosses;
  if (bosses.length === 0) return null;
  const index = Math.floor(floor / TOWER.boss_every_n_floors) - 1;
  const boss = bosses[index % bosses.length];
  return boss ? { boss, cycle: Math.floor(index / bosses.length) } : null;
}

function scaleLevel(state: TamerState, base: number, floorBonus: number): number {
  const partyLevel = maxPartyLevel(state);
  let level = base;
  if (state.difficulty === 'easy') level = Math.min(level, partyLevel + 1);
  else if (state.difficulty === 'hard') level += floorBonus;
  return Math.max(1, Math.round(level));
}

function attachAffixes(creature: Creature, rng: Rng, count: number): void {
  const slots = rollAffixSlots(rng, count, false);
  slots.forEach((slot, index) => {
    if (creature.affixSlots[index]) creature.affixSlots[index] = slot;
  });
}

export interface AbyssSpawn {
  creature: Creature;
  label: string;
  kind: FloorKind;
}

export function spawnAbyssEnemy(state: TamerState, rng: Rng, floor: number): AbyssSpawn {
  const kind = floorKind(floor);
  if (kind === 'boss') {
    const bossInfo = bossForFloor(floor);
    if (bossInfo) {
      const { boss, cycle } = bossInfo;
      const base = 8 + floor * 0.6 + cycle * 4;
      const level = scaleLevel(state, base, 2);
      const species = speciesOf(boss.species_id);
      const moves = [species.base_skill, ...extraEnemyMoves(species, level, rng, 3)].slice(0, 4);
      const creature = makeCreature(boss.species_id, level, {
        uid: nextUid(state),
        moves,
      });
      attachAffixes(creature, rng, 2);
      return { creature, label: boss.name, kind };
    }
  }

  const band =
    TOWER.enemy_pool_by_band.find(
      (entry) => floor >= entry.min_floor && floor <= entry.max_floor,
    ) ?? TOWER.enemy_pool_by_band[TOWER.enemy_pool_by_band.length - 1];
  if (!band || band.species_ids.length === 0) {
    throw new Error('tower_config has no enemy pool for this floor');
  }
  const speciesId = rng.pick(band.species_ids);
  const species = speciesOf(speciesId);
  const base = BALANCE.tower.base_enemy_level + floor * BALANCE.tower.level_scaling_per_floor;
  const level = scaleLevel(state, base + (kind === 'elite' ? 1 : 0), 2);
  const extraCount = level >= 20 ? 2 : level >= 10 ? 1 : 0;
  const moves = [species.base_skill, ...extraEnemyMoves(species, level, rng, extraCount)].slice(
    0,
    4,
  );
  const creature = makeCreature(speciesId, level, { uid: nextUid(state), moves });
  if (kind === 'elite') attachAffixes(creature, rng, 1);
  return { creature, label: species.name, kind };
}

export function enterAbyss(state: TamerState): string[] {
  if (alivePartyIndices(state).length === 0) {
    return ['队伍里没有能战斗的虾米，无法进入深渊。'];
  }
  state.abyssActive = true;
  state.abyssFloor = 0;
  state.explore = null;
  state.wild = null;
  state.battle = null;
  state.phase = 'abyss';
  timeline(state, '进入深渊');
  note(
    state,
    '深渊规则：战斗内 HP 归零即永久死亡；每层累积污染，污染满 5 转化为疫病；撤退按疫病层数掷骰。',
  );
  return ['你踏入深渊入口。战斗内 HP 归零 = 永久死亡，撤退时疫病会结算死亡骰。'];
}

export function startAbyssFloor(state: TamerState, rng: Rng): string[] {
  if (!state.abyssActive) throw new Error('Not in an abyss run');
  if (alivePartyIndices(state).length === 0) return ['队伍全灭，深渊结束。'];
  state.abyssFloor += 1;
  const floor = state.abyssFloor;
  const spawn = spawnAbyssEnemy(state, rng, floor);
  state.battle = createBattle(state, spawn.creature, 'abyss');
  state.phase = 'battle';
  const lines = [
    `━━ 深渊第 ${floor} 层 [${floorKindLabel(spawn.kind)}] ━━`,
    `敌人：${spawn.label} Lv${spawn.creature.level}（${speciesOf(spawn.creature.speciesId).type}）`,
  ];
  timeline(state, `深渊第 ${floor} 层 [${floorKindLabel(spawn.kind)}]`);
  return lines;
}

export function plagueDeathChance(creature: Creature): number {
  if (!creature.hasPlague) return 0;
  return Math.min(
    creature.plagueFloors * BALANCE.tower.plague_rate_per_floor,
    BALANCE.tower.plague_max_rate,
  );
}

function applyTaint(state: TamerState, kind: FloorKind): string[] {
  const lines: string[] = [];
  const gain = BALANCE.tower.taint_gain[kind] ?? 1;
  const threshold = BALANCE.tower.taint_to_plague_threshold;
  for (const index of alivePartyIndices(state)) {
    const creature = state.party[index];
    if (!creature) continue;
    if (creature.hasPlague) {
      creature.plagueFloors += gain;
      lines.push(
        `🦠 ${displayName(creature)} 带着疫病继续恶化（+${gain}，当前 ${creature.plagueFloors} 层）`,
      );
      continue;
    }
    creature.taint += gain;
    lines.push(
      `☣ ${displayName(creature)} 深渊污染 +${gain}（当前 ${creature.taint}/${threshold}）`,
    );
    if (creature.taint >= threshold) {
      const converted = creature.taint;
      creature.taint = 0;
      creature.hasPlague = true;
      creature.plagueFloors += converted;
      lines.push(`🦠 ${displayName(creature)} 的污染转化为疫病（+${converted} 层）`);
      note(state, `观察：${displayName(creature)} 的深渊污染转为疫病，撤退时会掷死亡骰。`);
    }
  }
  return lines;
}

/** Retreat / wipe resolution: plague floors decide who dies for good. */
export function settlePlague(state: TamerState, rng: Rng): string[] {
  const lines: string[] = [];
  for (const index of alivePartyIndices(state)) {
    const creature = state.party[index];
    if (!creature) continue;
    if (!creature.hasPlague) {
      if (creature.taint > 0) {
        lines.push(`☣ ${displayName(creature)} 带着深渊污染离开（${creature.taint}，未清除）`);
      }
      continue;
    }
    const chance = plagueDeathChance(creature);
    lines.push(`🦠 ${displayName(creature)} 疫病死亡率 ${Math.round(chance * 100)}%，掷骰……`);
    if (rng.chance(chance)) {
      creature.dead = true;
      note(state, `${displayName(creature)} 死于深渊疫病。`);
      lines.push(`✝ ${displayName(creature)} 因疫病永远离去……`);
      state.party[index] = null;
      state.memorial.push({
        uid: creature.uid,
        name: displayName(creature),
        speciesId: creature.speciesId,
        level: creature.level,
        shiny: creature.shiny,
        cause: `深渊疫病（${creature.plagueFloors}层）`,
        floor: state.abyssFloor,
      });
      state.totalDeaths += 1;
    } else {
      lines.push(`${displayName(creature)} 侥幸活了下来，但疫病仍在。`);
    }
  }
  return lines;
}

function finishRun(state: TamerState): void {
  state.abyssActive = false;
  state.abyssFloor = 0;
  state.battle = null;
  state.wild = null;
  state.totalRuns += 1;
}

function milestoneLines(state: TamerState): string[] {
  const lines: string[] = [];
  for (const milestone of TOWER.milestone_unlocks) {
    if (state.deepestFloor === milestone.floor) {
      lines.push(`✦ 深渊里程碑：第 ${milestone.floor} 层，${milestone.unlock} 已开放。`);
    }
  }
  return lines;
}

function checkRunLost(state: TamerState): boolean {
  if (hasLivingRoster(state)) return false;
  state.outcome = 'lost';
  state.phase = 'ended';
  state.cause = '队伍与仓库里已经没有能战斗的虾米。甲录师的潮汐到此为止。';
  note(state, '教训：队伍全灭且仓库无备用，是本作唯一的硬失败。');
  return true;
}

export function resolveAbyssBattleEnd(
  state: TamerState,
  rng: Rng,
  result: 'win' | 'lose' | 'retreat',
): string[] {
  const lines: string[] = [];
  const floor = state.abyssFloor;
  const kind = floorKind(floor);
  const bossInfo = kind === 'boss' ? bossForFloor(floor) : null;
  state.battle = null;

  lines.push(...cleanupAbyssDead(state, `深渊第${floor}层战斗`));

  if (result === 'win') {
    state.totalBattles += 1;
    const exp = Math.max(10, BALANCE.tower.exp_per_floor + floor * 4);
    for (const index of alivePartyIndices(state)) {
      const creature = state.party[index];
      if (!creature) continue;
      lines.push(...grantExp(state, creature, exp, rng, index));
    }

    lines.push(...applyTaint(state, kind));

    if (bossInfo?.boss.guaranteed_plague) {
      for (const index of alivePartyIndices(state)) {
        const creature = state.party[index];
        if (!creature) continue;
        creature.hasPlague = true;
        creature.plagueFloors += 1;
        lines.push(`🦠 ${bossInfo.boss.name} 的诅咒让 ${displayName(creature)} 染上疫病。`);
      }
    }

    const drop = rollAbyssDrop(state, rng, kind);
    if (drop) {
      state.items[drop.id] = (state.items[drop.id] ?? 0) + drop.count;
      lines.push(`获得了 ${drop.name} ×${drop.count}${drop.guaranteed ? '（保底）' : ''}`);
    }

    if (floor > state.deepestFloor) {
      state.deepestFloor = floor;
      lines.push(`✦ 新纪录！深渊最深到达第 ${floor} 层。`);
      note(state, `观察：首次通过深渊第 ${floor} 层，最深纪录更新。`);
    }
    lines.push(...milestoneLines(state));

    timeline(state, `通过深渊第 ${floor} 层`);

    if (state.deepestFloor >= WIN_FLOOR) {
      state.outcome = 'won';
      state.phase = 'ended';
      state.abyssActive = false;
      state.totalRuns += 1;
      state.cause = `你抵达深渊第 ${WIN_FLOOR} 层，六片海域全部向你敞开。潮汐记住了这只甲录师。`;
      lines.push(`★ 通关：抵达第 ${WIN_FLOOR} 层，本局胜利。`);
      note(state, '总结：深渊通关依赖队伍等级、词条质量与撤退时机的平衡。');
      return lines;
    }

    state.phase = state.pendingSkills.length > 0 ? 'skill' : 'abyss';
    return lines;
  }

  if (result === 'lose') {
    state.totalBattles += 1;
    lines.push('队伍在深渊中全灭。');
    lines.push(...settlePlague(state, rng));
    finishRun(state);
    const refilled = autoRefillFromBox(state);
    if (refilled) lines.push(`${refilled} 从仓库补进了队伍。`);
    state.phase = 'menu';
    note(state, '教训：深渊战斗内 HP 归零不可复活；全灭后只能靠仓库备用继续。');
    timeline(state, `深渊第 ${floor} 层全灭`);
    checkRunLost(state);
    return lines;
  }

  lines.push('你主动撤退，深渊疫病开始结算。');
  finishRun(state);
  lines.push(...settlePlague(state, rng));
  const refilled = autoRefillFromBox(state);
  if (refilled) lines.push(`${refilled} 从仓库补进了队伍。`);
  state.phase = 'menu';
  timeline(state, `从深渊第 ${floor} 层撤退`);
  checkRunLost(state);
  return lines;
}

/** `abyss:retreat` from the floor menu (no active battle). */
export function retreatAbyss(state: TamerState, rng: Rng): string[] {
  if (!state.abyssActive) return ['当前不在深渊里。'];
  const floor = state.abyssFloor;
  const lines = [`你在第 ${floor} 层选择撤退。`];
  lines.push(...settlePlague(state, rng));
  finishRun(state);
  state.phase = 'menu';
  timeline(state, `从深渊第 ${floor} 层撤退`);
  note(state, `观察：第 ${floor} 层撤退，未清洁的污染会保留到下一次深渊。`);
  const refilled = autoRefillFromBox(state);
  if (refilled) lines.push(`${refilled} 从仓库补进了队伍。`);
  checkRunLost(state);
  return lines;
}
