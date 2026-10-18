/**
 * Content loading: species, skills, affixes, zones, items and balance data.
 *
 * The JSON files under `games/lobster-cli-tamer/data/` are the source of truth.
 * They are imported statically so Bun can bundle them into the single binary.
 */

import type { Rng } from '@gameclaw/gamekit';
import affixesJson from '../../data/affixes.json';
import balanceJson from '../../data/balance.json';
import itemsJson from '../../data/items.json';
import coreSkillsJson from '../../data/skills/core_named_skills.json';
import electricSkillsJson from '../../data/skills/electric_skills.json';
import poisonSkillsJson from '../../data/skills/poison_skills.json';
import rockSkillsJson from '../../data/skills/rock_skills.json';
import signatureSkillsJson from '../../data/skills/signature_skills.json';
import spiritSkillsJson from '../../data/skills/spirit_skills.json';
import tideSkillsJson from '../../data/skills/tide_skills.json';
import universalSkillsJson from '../../data/skills/universal_skills.json';
import electricSpeciesJson from '../../data/species/electric_type.json';
import legendarySpeciesJson from '../../data/species/legendary.json';
import poisonSpeciesJson from '../../data/species/poison_type.json';
import rockSpeciesJson from '../../data/species/rock_type.json';
import spiritSpeciesJson from '../../data/species/spirit_type.json';
import tideSpeciesJson from '../../data/species/tide_type.json';
import towerConfigJson from '../../data/tower_config.json';
import zonesJson from '../../data/zones.json';

import type { AffixSlot, Creature, Stats, StatusName } from './state';

/* ------------------------------------------------------------------ *
 * Raw data types
 * ------------------------------------------------------------------ */

export interface Species {
  id: string;
  name: string;
  type: string;
  rarity: string;
  base_stats: Stats;
  stat_growth: Stats;
  base_skill: string;
  skill_pool_tags: string[];
  affix_slots: number;
  capture_base_rate: number;
  habitat: string[];
  lore: string;
  evolution: { target: string; min_level: number } | null;
}

export interface SkillEffect {
  type: string;
  status?: string;
  chance?: number;
  stat?: string;
  target?: string;
  value?: number;
  duration_turns?: number;
  hits?: [number, number];
  condition?: string;
  power_bonus?: number;
  name?: string;
}

export interface Skill {
  id: string;
  name: string;
  type: string;
  category: string;
  power: number;
  accuracy: number;
  effects: SkillEffect[];
  tags: string[];
  description: string;
}

export interface Affix {
  id: string;
  name: string;
  tier: string;
  trigger: string;
  trigger_limit_per_battle: number;
  trigger_threshold?: number;
  effect: {
    type: string;
    target?: string;
    stat?: string;
    value?: number;
    duration_turns?: number;
    status?: string;
    chance?: number;
    name?: string;
  };
  synergy_tags: string[];
  description: string;
}

export interface EncounterEntry {
  species_id: string;
  weight: number;
}

export interface SubArea {
  id: string;
  name: string;
  level_range: [number, number];
  encounter_table: EncounterEntry[];
}

export interface Zone {
  id: string;
  name: string;
  unlock_condition: string;
  sub_areas: SubArea[];
  description?: string;
}

export interface Item {
  id: string;
  name: string;
  type: string;
  multiplier?: number;
  heal_ratio?: number;
  price?: number;
  description: string;
}

export interface TowerBoss {
  floor: number;
  id: string;
  name: string;
  species_id: string;
  phases: number;
  guaranteed_plague: boolean;
}

export interface TowerConfig {
  small_cycle: string[];
  event_floor_positions: number[];
  boss_every_n_floors: number;
  elite_plague_chance: number;
  boss_plague_chance: number;
  bosses: TowerBoss[];
  milestone_unlocks: { floor: number; unlock: string }[];
  enemy_pool_by_band: {
    min_floor: number;
    max_floor: number;
    species_ids: string[];
  }[];
  drops: Record<string, Record<string, [number, number]>>;
  floor_drops: { item_id: string; name: string; count: number; chance: number }[];
}

export interface Balance {
  combat: {
    type_effectiveness: Record<string, { 克制: string; 克制倍率: number }>;
    crit_rate: number;
    crit_multiplier: number;
    switch_penalty: boolean;
  };
  capture: {
    shiny_rate: number;
    tool_multipliers: Record<string, number>;
    no_encounter_weight: number;
    weakened_bonus: number;
    half_hp_bonus: number;
    status_poison_burn_bonus: number;
    status_para_freeze_bonus: number;
    shiny_capture_penalty: number;
  };
  affix: {
    roll_weights: Record<string, number>;
    shiny_roll_bonus: Record<string, number>;
    reroll_cost: Record<string, number>;
    upgrade_cost: Record<string, number>;
    plague_cure_cost: Record<string, number>;
  };
  skill: {
    max_skills: number;
    level_up_choices: number;
    own_type_weight_multiplier: number;
    affix_synergy_weight_multiplier: number;
  };
  exp: { base: number; growth_rate: number };
  tower: {
    permadeath_in_battle: boolean;
    plague_rate_per_floor: number;
    plague_max_rate: number;
    plague_trigger_floor: number;
    taint_to_plague_threshold: number;
    taint_gain: Record<string, number>;
    boss_every_n_floors: number;
    base_enemy_level: number;
    level_scaling_per_floor: number;
    affix_unlock_floor: number;
    deep_abyss_start: number;
    exp_per_floor: number;
  };
  party: { max_size: number; battle_slots: number };
  world: {
    hidden_encounter_base_chance: number;
    steps_min: number;
    steps_max: number;
    battle_loot: Record<string, { chance: number; count: [number, number] }>;
  };
  workshop: {
    reroll_cost: Record<string, number>;
    upgrade_cost_by_tier: Record<string, number>[];
    seal_cost: Record<string, number>;
    unseal_cost: Record<string, number>;
  };
}

/* ------------------------------------------------------------------ *
 * Indexed content
 * ------------------------------------------------------------------ */

const speciesFiles = [
  tideSpeciesJson,
  electricSpeciesJson,
  rockSpeciesJson,
  poisonSpeciesJson,
  spiritSpeciesJson,
  legendarySpeciesJson,
] as unknown as Species[][];

const skillFiles = [
  tideSkillsJson,
  electricSkillsJson,
  rockSkillsJson,
  poisonSkillsJson,
  spiritSkillsJson,
  universalSkillsJson,
  coreSkillsJson,
  signatureSkillsJson,
] as unknown as Skill[][];

export const SPECIES_LIST: Species[] = speciesFiles.flat();

export const SPECIES: ReadonlyMap<string, Species> = new Map(
  SPECIES_LIST.map((species) => [species.id, species]),
);

export const SKILL_LIST: Skill[] = skillFiles.flat();

export const SKILLS: ReadonlyMap<string, Skill> = new Map(
  SKILL_LIST.map((skill) => [skill.name, skill]),
);

export const AFFIXES: Affix[] = affixesJson as unknown as Affix[];

export const AFFIX_BY_ID: ReadonlyMap<string, Affix> = new Map(
  AFFIXES.map((affix) => [affix.id, affix]),
);

export const ZONES: Zone[] = zonesJson as unknown as Zone[];

export const ZONE_BY_ID: ReadonlyMap<string, Zone> = new Map(ZONES.map((zone) => [zone.id, zone]));

export const ITEM_LIST: Item[] = itemsJson as unknown as Item[];

export const BALANCE: Balance = balanceJson as unknown as Balance;

export const TOWER: TowerConfig = towerConfigJson as unknown as TowerConfig;

export const OWN_TYPE_MULTIPLIER = BALANCE.skill.own_type_weight_multiplier;
export const SYNERGY_MULTIPLIER = BALANCE.skill.affix_synergy_weight_multiplier;
export const MAX_MOVES = 4;

export function speciesOf(speciesId: string): Species {
  const species = SPECIES.get(speciesId);
  if (!species) throw new Error(`Unknown species: ${speciesId}`);
  return species;
}

export function skillOf(name: string | null | undefined): Skill | null {
  if (!name) return null;
  return SKILLS.get(name) ?? null;
}

export function computeStats(species: Species, level: number): Stats {
  const base = species.base_stats;
  const growth = species.stat_growth;
  const round = (value: number): number => Math.round(value * 10) / 10;
  return {
    hp: round(base.hp + growth.hp * (level - 1)),
    atk: round(base.atk + growth.atk * (level - 1)),
    def: round(base.def + growth.def * (level - 1)),
    spd: round(base.spd + growth.spd * (level - 1)),
    end: round(base.end + growth.end * (level - 1)),
  };
}

export function expToNext(level: number): number {
  return Math.ceil(BALANCE.exp.base * BALANCE.exp.growth_rate ** (level - 1));
}

export interface MakeCreatureOptions {
  uid: string;
  shiny?: boolean;
  moves?: string[];
  affixSlots?: AffixSlot[];
  nickname?: string | null;
  capturedZone?: string;
}

export function makeCreature(
  speciesId: string,
  level: number,
  options: MakeCreatureOptions,
): Creature {
  const species = speciesOf(speciesId);
  const stats = computeStats(species, level);
  const emptySlots = (): AffixSlot[] =>
    Array.from({ length: species.affix_slots }, () => ({ affixId: '', locked: false }));
  return {
    uid: options.uid,
    speciesId,
    nickname: options.nickname ?? null,
    level,
    exp: 0,
    shiny: options.shiny ?? false,
    stats,
    hp: stats.hp,
    affixSlots: options.affixSlots ?? emptySlots(),
    moves: options.moves ?? [species.base_skill],
    capturedZone: options.capturedZone ?? '',
    hasPlague: false,
    plagueFloors: 0,
    taint: 0,
    dead: false,
  };
}

export function displayName(creature: Creature): string {
  return creature.nickname ?? speciesOf(creature.speciesId).name;
}

export function speciesType(creature: Creature): string {
  return speciesOf(creature.speciesId).type;
}

export function numAffixSlots(creature: Creature): number {
  return creature.affixSlots.length;
}

/**
 * A small extra move pool so higher-level enemies are not one-trick ponies.
 * Never returns the base skill or a duplicate.
 */
export function extraEnemyMoves(
  species: Species,
  level: number,
  rng: Rng,
  count: number,
): string[] {
  if (level < 10 || count <= 0) return [];
  const known = new Set<string>([species.base_skill]);
  const tags = new Set(species.skill_pool_tags);
  const picks: string[] = [];
  const pool = SKILL_LIST.filter(
    (skill) =>
      skill.type === species.type &&
      skill.power > 0 &&
      !known.has(skill.name) &&
      skill.tags.some((tag) => tags.has(tag)),
  );
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const index = rng.int(0, pool.length - 1);
    const [skill] = pool.splice(index, 1);
    if (skill) {
      picks.push(skill.name);
      known.add(skill.name);
    }
  }
  return picks;
}

/** Merge effect-free status names into the known status union at runtime. */
export function isStatusName(value: string | undefined): value is StatusName {
  return (
    value === '中毒' || value === '麻痹' || value === '灼烧' || value === '冰封' || value === '困惑'
  );
}
