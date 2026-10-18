/**
 * Party, EXP, evolution, skill learning and memorial bookkeeping.
 */
import type { Rng } from '@gameclaw/gamekit';

import {
  AFFIX_BY_ID,
  computeStats,
  displayName,
  expToNext,
  MAX_MOVES,
  OWN_TYPE_MULTIPLIER,
  SKILL_LIST,
  type Skill,
  SYNERGY_MULTIPLIER,
  speciesOf,
} from './species';
import type { Creature, TamerState } from './state';
import { addUnique, maxHp, note, pushLog } from './state';

export function healCreature(creature: Creature, ratio: number): number {
  if (creature.dead) return 0;
  const cap = maxHp(creature);
  const before = creature.hp;
  creature.hp = Math.min(cap, creature.hp + cap * ratio);
  return Math.max(0, creature.hp - before);
}

export function healParty(state: TamerState, ratio: number): { healed: number; lines: string[] } {
  const lines: string[] = [];
  let total = 0;
  for (const creature of state.party) {
    if (!creature || creature.dead || creature.hp <= 0 || creature.hp >= maxHp(creature)) continue;
    const healed = healCreature(creature, ratio);
    if (healed > 0) {
      total += 1;
      lines.push(`${displayName(creature)} 回复 ${Math.round(healed)} HP`);
    }
  }
  return { healed: total, lines };
}

/** Wild battles are not lethal: fainted party members wake up at 25% HP. */
export function restoreAfterWildBattle(state: TamerState): string[] {
  const lines: string[] = [];
  for (const creature of state.party) {
    if (!creature) continue;
    if (creature.dead || creature.hp <= 0) {
      creature.dead = false;
      creature.hp = Math.max(1, Math.round(maxHp(creature) * 0.25));
      lines.push(`${displayName(creature)} 从昏迷中醒来（25% HP）`);
    }
  }
  return lines;
}

export function addMemorial(state: TamerState, creature: Creature, cause: string): void {
  state.memorial.push({
    uid: creature.uid,
    name: displayName(creature),
    speciesId: creature.speciesId,
    level: creature.level,
    shiny: creature.shiny,
    cause,
    floor: state.abyssActive ? state.abyssFloor : null,
  });
  state.totalDeaths += 1;
}

/** Abyss only: HP 0 (or a stale dead flag) means the creature leaves the party forever. */
export function cleanupAbyssDead(state: TamerState, cause: string): string[] {
  const lines: string[] = [];
  state.party.forEach((creature, index) => {
    if (!creature) return;
    if (!creature.dead && creature.hp > 0) return;
    addMemorial(state, creature, cause);
    state.party[index] = null;
    lines.push(`✝ ${displayName(creature)} 永远留在了深渊（${cause}）`);
  });
  return lines;
}

function synergyTags(creature: Creature): Set<string> {
  const tags = new Set<string>();
  for (const slot of creature.affixSlots) {
    const affix = slot.affixId ? AFFIX_BY_ID.get(slot.affixId) : undefined;
    if (affix) for (const tag of affix.synergy_tags) tags.add(tag);
  }
  return tags;
}

export function skillOffers(creature: Creature, rng: Rng, count = 3): Skill[] {
  const species = speciesOf(creature.speciesId);
  const speciesTags = new Set(species.skill_pool_tags);
  const affixTags = synergyTags(creature);
  const known = new Set(creature.moves);
  const pool: { skill: Skill; weight: number }[] = [];
  for (const skill of SKILL_LIST) {
    if (known.has(skill.name)) continue;
    let weight = 1;
    if (skill.type === species.type) weight *= OWN_TYPE_MULTIPLIER;
    const tags = new Set(skill.tags);
    if ([...tags].some((tag) => speciesTags.has(tag))) weight *= 1.3;
    if ([...tags].some((tag) => affixTags.has(tag))) weight *= SYNERGY_MULTIPLIER;
    if (tags.has('signature')) weight *= 0.05;
    pool.push({ skill, weight });
  }

  const picked: Skill[] = [];
  const take = Math.min(count, pool.length);
  for (let i = 0; i < take; i += 1) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) break;
    let roll = rng.float() * total;
    let index = 0;
    for (let j = 0; j < pool.length; j += 1) {
      roll -= pool[j]?.weight ?? 0;
      if (roll <= 0) {
        index = j;
        break;
      }
    }
    const [entry] = pool.splice(index, 1);
    if (entry) picked.push(entry.skill);
  }
  return picked;
}

export function learnSkill(creature: Creature, skillName: string): boolean {
  if (creature.moves.includes(skillName)) return false;
  if (creature.moves.length >= MAX_MOVES) return false;
  creature.moves.push(skillName);
  return true;
}

function evolveIfReady(state: TamerState, creature: Creature, lines: string[]): void {
  const species = speciesOf(creature.speciesId);
  const evolution = species.evolution;
  if (!evolution || creature.level < evolution.min_level) return;
  const next = speciesOf(evolution.target);
  const ratio = creature.hp / maxHp(creature);
  const oldName = species.name;
  creature.speciesId = evolution.target;
  creature.stats = computeStats(next, creature.level);
  creature.hp = Math.max(1, creature.stats.hp * ratio);
  const oldBaseIndex = creature.moves.indexOf(species.base_skill);
  if (oldBaseIndex >= 0 && !creature.moves.includes(next.base_skill)) {
    creature.moves[oldBaseIndex] = next.base_skill;
  } else if (!creature.moves.includes(next.base_skill) && creature.moves.length < MAX_MOVES) {
    creature.moves.push(next.base_skill);
  }
  addUnique(state.dexSeen, evolution.target);
  addUnique(state.dexCaught, evolution.target);
  lines.push(`✦ ${oldName} 进化成了 ${next.name}！（Lv${creature.level}）`);
  note(
    state,
    `观察：${oldName} 在 Lv${creature.level} 进化成 ${next.name}，形态变化会改写基础技能。`,
  );
}

/**
 * Grant EXP, level up (possibly several times), evolve, and queue skill offers.
 * `partyIndex` is only used for the offer queue.
 */
export function grantExp(
  state: TamerState,
  creature: Creature,
  amount: number,
  rng: Rng,
  partyIndex: number,
): string[] {
  const lines: string[] = [];
  if (creature.dead || amount <= 0) return lines;
  creature.exp += amount;
  lines.push(`${displayName(creature)} 获得 ${amount} EXP`);
  while (creature.level < 100 && creature.exp >= expToNext(creature.level)) {
    creature.exp -= expToNext(creature.level);
    creature.level += 1;
    const ratio = creature.hp / maxHp(creature);
    creature.stats = computeStats(speciesOf(creature.speciesId), creature.level);
    creature.hp = Math.max(1, creature.stats.hp * ratio);
    lines.push(`✓ ${displayName(creature)} 升到 Lv${creature.level}`);
    evolveIfReady(state, creature, lines);
    const queued = state.pendingSkills.filter((pending) => pending.uid === creature.uid).length;
    if (creature.level % 2 === 0 && creature.moves.length + queued < MAX_MOVES) {
      const offers = skillOffers(creature, rng, 3);
      if (offers.length > 0) {
        state.pendingSkills.push({
          partyIndex,
          uid: creature.uid,
          creatureName: displayName(creature),
          offers: offers.map((skill) => skill.name),
        });
      }
    }
  }
  return lines;
}

export function releaseToBox(state: TamerState, slotIndex: number): string | null {
  const creature = state.party[slotIndex];
  if (!creature) return null;
  state.party[slotIndex] = null;
  state.box.push(creature);
  return displayName(creature);
}

export function swapWithBox(
  state: TamerState,
  slotIndex: number,
  boxIndex: number,
): { ok: boolean; message: string } {
  if (slotIndex < 0 || slotIndex >= state.party.length) {
    return { ok: false, message: `无效的队伍槽：${slotIndex}` };
  }
  const incoming = state.box[boxIndex];
  if (!incoming) return { ok: false, message: `仓库里没有第 ${boxIndex} 只虾米` };
  const outgoing = state.party[slotIndex] ?? null;
  state.party[slotIndex] = incoming;
  if (outgoing) state.box[boxIndex] = outgoing;
  else state.box.splice(boxIndex, 1);
  return {
    ok: true,
    message: outgoing
      ? `${displayName(outgoing)} 与 ${displayName(incoming)} 交换了位置`
      : `${displayName(incoming)} 从仓库进入队伍第 ${slotIndex} 槽`,
  };
}

/** Keep the run alive after an abyss wipe when the box still holds reserves. */
export function autoRefillFromBox(state: TamerState): string | null {
  const emptySlot = state.party.indexOf(null);
  if (emptySlot < 0) return null;
  const candidates = state.box
    .map((creature, index) => ({ creature, index }))
    .filter((entry) => !entry.creature.dead && entry.creature.hp > 0)
    .sort((a, b) => b.creature.level - a.creature.level);
  const best = candidates[0];
  if (!best) return null;
  state.box.splice(best.index, 1);
  state.party[emptySlot] = best.creature;
  pushLog(state, [`${displayName(best.creature)} 从仓库补进了队伍。`]);
  return displayName(best.creature);
}

export function hasLivingRoster(state: TamerState): boolean {
  for (const creature of state.party) {
    if (creature && !creature.dead && creature.hp > 0) return true;
  }
  for (const creature of state.box) {
    if (!creature.dead && creature.hp > 0) return true;
  }
  return false;
}

export function curePlague(creature: Creature): void {
  creature.hasPlague = false;
  creature.plagueFloors = 0;
  creature.taint = 0;
}

export function plagueCandidates(state: TamerState): { creature: Creature; index: number }[] {
  const out: { creature: Creature; index: number }[] = [];
  state.party.forEach((creature, index) => {
    if (creature && (creature.hasPlague || creature.taint > 0)) out.push({ creature, index });
  });
  return out;
}
