/**
 * Static content for 横着守: doctrines, units, enemies and the single stage.
 *
 * Everything here is data. The engine only stores string keys in its save
 * state, so a save stays JSON-serialisable and small.
 */

import type { Rng } from '@gameclaw/gamekit';

export type DoctrineKey = 'crusher' | 'oracle' | 'gambler';

export type UnitKey =
  | 'reef-guard'
  | 'ring-cutter'
  | 'whisker-scout'
  | 'salt-spray'
  | 'molt-decoy'
  | 'gate-stake';

export type EnemyKey = 'pot-grunt' | 'pump-runner' | 'ring-borer' | 'eel-spark' | 'octopus-hauler';

export type LaneKey = 'left' | 'mid' | 'right';

export type SlotKey = 'L1' | 'M1' | 'R1' | 'C' | 'LP' | 'RP';

export type NodeKey = 'L0' | 'L1' | 'M0' | 'M1' | 'R0' | 'R1' | 'C' | 'LP' | 'RP' | 'SEA';

export type UnitKind = 'melee' | 'ranged' | 'support' | 'splash' | 'decoy' | 'control';

export type EnemyTag = 'runner' | 'armored' | 'shock' | 'elite' | 'heavy';

export interface Doctrine {
  key: DoctrineKey;
  title: string;
  subtitle: string;
  blurb: string;
  startingTide: number;
  tidePerPulse: number;
  startingIntegrity: number;
  forecastDepth: number;
  discounts: Partial<Record<UnitKey, number>>;
  blockerHpBonus: number;
  supportAttackBonus: number;
  decoyDurationBonus: number;
  recallRefundBonus: number;
  redeployCooldownDelta: number;
  skillName: string;
  skillCost: number;
  skillCooldown: number;
  skillBlurb: string;
}

export const DOCTRINES: readonly Doctrine[] = [
  {
    key: 'crusher',
    title: '沟壑碎壳者',
    subtitle: '碎壳防线',
    blurb: '把最窄的卡口变成最硬的壳。宁可前排磨碎，也不让归海线先碎。',
    startingTide: 8,
    tidePerPulse: 2,
    startingIntegrity: 8,
    forecastDepth: 2,
    discounts: { 'reef-guard': 1, 'gate-stake': 1 },
    blockerHpBonus: 2,
    supportAttackBonus: 0,
    decoyDurationBonus: 0,
    recallRefundBonus: 0,
    redeployCooldownDelta: 0,
    skillName: '碎壳顶潮',
    skillCost: 2,
    skillCooldown: 2,
    skillBlurb: '本 pulse 让一个前排位攻 +2、拦口 +1。',
  },
  {
    key: 'oracle',
    title: '触须预言家',
    subtitle: '潮图预警',
    blurb: '比起多下一只虾，它更相信先把下一波坏消息闻明白。',
    startingTide: 7,
    tidePerPulse: 3,
    startingIntegrity: 7,
    forecastDepth: 3,
    discounts: { 'whisker-scout': 1, 'salt-spray': 1 },
    blockerHpBonus: 0,
    supportAttackBonus: 1,
    decoyDurationBonus: 0,
    recallRefundBonus: 0,
    redeployCooldownDelta: 0,
    skillName: '触须预警',
    skillCost: 2,
    skillCooldown: 2,
    skillBlurb: '本 pulse 点亮一条 lane：该 lane 的敌人更慢、更脆。',
  },
  {
    key: 'gambler',
    title: '脱壳赌徒',
    subtitle: '退潮再编',
    blurb: '它不把阵线当城墙，而是当临时信用。能换线就换线，能晚死就晚死。',
    startingTide: 7,
    tidePerPulse: 3,
    startingIntegrity: 7,
    forecastDepth: 2,
    discounts: { 'molt-decoy': 1, 'ring-cutter': 1 },
    blockerHpBonus: 0,
    supportAttackBonus: 0,
    decoyDurationBonus: 1,
    recallRefundBonus: 1,
    redeployCooldownDelta: -1,
    skillName: '脱壳换线',
    skillCost: 1,
    skillCooldown: 1,
    skillBlurb: '把一个已部署单位立即挪到空位，并回 2 点壳。',
  },
];

export interface UnitType {
  key: UnitKey;
  title: string;
  short: string;
  blurb: string;
  cost: number;
  maxHp: number;
  attack: number;
  block: number;
  allowedSlots: readonly SlotKey[];
  kind: UnitKind;
  armorPierce: number;
  slow: number;
  expose: number;
  push: number;
  /** Lifetime in pulses; `null` means the unit stays until recalled or broken. */
  duration: number | null;
  redeployCooldown: number;
}

export const UNITS: Record<UnitKey, UnitType> = {
  'reef-guard': {
    key: 'reef-guard',
    title: '礁口重钳',
    short: '重钳',
    blurb: '标准前排。站住、挡住、把冲到脸上的东西直接夹碎。',
    cost: 4,
    maxHp: 12,
    attack: 3,
    block: 2,
    allowedSlots: ['L1', 'M1', 'R1', 'C'],
    kind: 'melee',
    armorPierce: 0,
    slow: 0,
    expose: 0,
    push: 0,
    duration: null,
    redeployCooldown: 2,
  },
  'ring-cutter': {
    key: 'ring-cutter',
    title: '塑圈剪手',
    short: '剪手',
    blurb: '专门收甲壳和精英。站错位会脆，但剪对东西很值。',
    cost: 3,
    maxHp: 6,
    attack: 3,
    block: 0,
    allowedSlots: ['L1', 'M1', 'R1', 'C', 'LP', 'RP'],
    kind: 'ranged',
    armorPierce: 1,
    slow: 0,
    expose: 0,
    push: 0,
    duration: null,
    redeployCooldown: 2,
  },
  'whisker-scout': {
    key: 'whisker-scout',
    title: '须探哨兵',
    short: '须哨',
    blurb: '低伤害、真有用。先减速、再做标记，让后续火力不白打。',
    cost: 3,
    maxHp: 5,
    attack: 1,
    block: 0,
    allowedSlots: ['L1', 'M1', 'R1', 'C', 'LP', 'RP'],
    kind: 'support',
    armorPierce: 0,
    slow: 1,
    expose: 1,
    push: 0,
    duration: null,
    redeployCooldown: 1,
  },
  'salt-spray': {
    key: 'salt-spray',
    title: '盐沫喷口',
    short: '盐口',
    blurb: '盯拥挤节点做小范围压制，适合补 runners 的节奏。',
    cost: 2,
    maxHp: 5,
    attack: 1,
    block: 0,
    allowedSlots: ['L1', 'M1', 'R1', 'C', 'LP', 'RP'],
    kind: 'splash',
    armorPierce: 0,
    slow: 1,
    expose: 0,
    push: 0,
    duration: null,
    redeployCooldown: 1,
  },
  'molt-decoy': {
    key: 'molt-decoy',
    title: '蜕壳诱饵',
    short: '诱饵',
    blurb: '短命，但能把最危险的一波先钉住。',
    cost: 2,
    maxHp: 7,
    attack: 0,
    block: 3,
    allowedSlots: ['L1', 'M1', 'R1', 'C'],
    kind: 'decoy',
    armorPierce: 0,
    slow: 0,
    expose: 0,
    push: 0,
    duration: 2,
    redeployCooldown: 1,
  },
  'gate-stake': {
    key: 'gate-stake',
    title: '回涌闸桩',
    short: '闸桩',
    blurb: '守 choke 的硬桩。打得不算快，但会把目标往回推。',
    cost: 4,
    maxHp: 9,
    attack: 2,
    block: 1,
    allowedSlots: ['L1', 'M1', 'R1', 'C'],
    kind: 'control',
    armorPierce: 0,
    slow: 0,
    expose: 0,
    push: 1,
    duration: null,
    redeployCooldown: 2,
  },
};

export const UNIT_ORDER: readonly UnitKey[] = [
  'reef-guard',
  'ring-cutter',
  'whisker-scout',
  'salt-spray',
  'molt-decoy',
  'gate-stake',
];

export interface EnemyType {
  key: EnemyKey;
  title: string;
  short: string;
  blurb: string;
  maxHp: number;
  speed: number;
  armor: number;
  contactDamage: number;
  leak: number;
  weight: number;
  tags: readonly EnemyTag[];
}

export const ENEMIES: Record<EnemyKey, EnemyType> = {
  'pot-grunt': {
    key: 'pot-grunt',
    title: '锅沿杂兵',
    short: '杂',
    blurb: '没什么花活，就是会把前排磨薄。',
    maxHp: 5,
    speed: 1,
    armor: 0,
    contactDamage: 1,
    leak: 1,
    weight: 1,
    tags: [],
  },
  'pump-runner': {
    key: 'pump-runner',
    title: '抽水跳虾',
    short: '跳',
    blurb: '速度快，前排空了就很容易直接穿线。',
    maxHp: 4,
    speed: 2,
    armor: 0,
    contactDamage: 1,
    leak: 1,
    weight: 1,
    tags: ['runner'],
  },
  'ring-borer': {
    key: 'ring-borer',
    title: '塑圈钻头',
    short: '钻',
    blurb: '带甲推进单位，适合让剪手和集火去处理。',
    maxHp: 8,
    speed: 1,
    armor: 1,
    contactDamage: 2,
    leak: 1,
    weight: 1,
    tags: ['armored'],
  },
  'eel-spark': {
    key: 'eel-spark',
    title: '电鳗借火体',
    short: '鳗',
    blurb: '推进不快，但接触伤害高，会把薄位电穿。',
    maxHp: 7,
    speed: 1,
    armor: 0,
    contactDamage: 3,
    leak: 1,
    weight: 1,
    tags: ['shock'],
  },
  'octopus-hauler': {
    key: 'octopus-hauler',
    title: '章鱼搬运手',
    short: '章',
    blurb: '重型精英，既吃拦口又会对完整度造成更重创伤。',
    maxHp: 14,
    speed: 1,
    armor: 0,
    contactDamage: 3,
    leak: 2,
    weight: 2,
    tags: ['elite', 'heavy'],
  },
};

export const ENEMY_ORDER: readonly EnemyKey[] = [
  'pot-grunt',
  'pump-runner',
  'ring-borer',
  'eel-spark',
  'octopus-hauler',
];

export interface Slot {
  key: SlotKey;
  title: string;
  node: NodeKey;
  isPath: boolean;
  coverage: readonly NodeKey[];
}

export type LaneSymbol = 'A' | 'B' | 'C';

export interface SpawnSpec {
  laneSymbol: LaneSymbol;
  enemy: EnemyKey;
  count: number;
}

export interface SpawnEntry {
  lane: LaneKey;
  enemy: EnemyKey;
  count: number;
}

export interface StageDefinition {
  key: string;
  title: string;
  blurb: string;
  lanes: readonly LaneKey[];
  laneTitles: Record<LaneKey, string>;
  laneShort: Record<LaneKey, string>;
  paths: Record<LaneKey, readonly NodeKey[]>;
  nodeTitles: Partial<Record<NodeKey, string>>;
  slots: Record<SlotKey, Slot>;
  slotOrder: readonly SlotKey[];
  waveBlueprints: readonly (readonly (readonly SpawnSpec[])[])[];
  laneBlockSlots: Record<LaneKey, readonly SlotKey[]>;
  supportSlots: readonly SlotKey[];
  exitLabel: string;
  supportRowLabel: string;
  forecastLabels: readonly string[];
}

export const STAGE: StageDefinition = {
  key: 'side-drain-line-1',
  title: '归海侧排一号线',
  blurb:
    '这是一条贴着金属台沿、抽水泵偶尔回涌的侧排水线。左边是盆沿碎口，中间是狭窄排缝，右边卡着塑料环。你要在它们合流前，把归海线守到最后一 pulse。',
  lanes: ['left', 'mid', 'right'],
  laneTitles: { left: '左盆沿', mid: '中排缝', right: '右塑圈' },
  laneShort: { left: '左', mid: '中', right: '右' },
  paths: {
    left: ['L0', 'L1', 'C', 'SEA'],
    mid: ['M0', 'M1', 'C', 'SEA'],
    right: ['R0', 'R1', 'C', 'SEA'],
  },
  nodeTitles: {
    L0: '左入口',
    L1: '左前拦口',
    M0: '中入口',
    M1: '中前拦口',
    R0: '右入口',
    R1: '右前拦口',
    C: '闸前总卡口',
    LP: '左高台',
    RP: '右高台',
    SEA: '归海线',
  },
  slots: {
    L1: { key: 'L1', title: '左前拦口', node: 'L1', isPath: true, coverage: ['L1', 'C'] },
    M1: { key: 'M1', title: '中前拦口', node: 'M1', isPath: true, coverage: ['M1', 'C'] },
    R1: { key: 'R1', title: '右前拦口', node: 'R1', isPath: true, coverage: ['R1', 'C'] },
    C: { key: 'C', title: '闸前总卡口', node: 'C', isPath: true, coverage: ['C'] },
    LP: {
      key: 'LP',
      title: '左高台',
      node: 'LP',
      isPath: false,
      coverage: ['L0', 'L1', 'M0', 'C'],
    },
    RP: {
      key: 'RP',
      title: '右高台',
      node: 'RP',
      isPath: false,
      coverage: ['R0', 'R1', 'M0', 'C'],
    },
  },
  slotOrder: ['L1', 'M1', 'R1', 'C', 'LP', 'RP'],
  waveBlueprints: [
    [
      [{ laneSymbol: 'A', enemy: 'pot-grunt', count: 2 }],
      [
        { laneSymbol: 'B', enemy: 'pump-runner', count: 1 },
        { laneSymbol: 'C', enemy: 'pot-grunt', count: 1 },
      ],
      [{ laneSymbol: 'A', enemy: 'ring-borer', count: 1 }],
      [
        { laneSymbol: 'B', enemy: 'eel-spark', count: 1 },
        { laneSymbol: 'A', enemy: 'pot-grunt', count: 1 },
      ],
      [{ laneSymbol: 'C', enemy: 'pump-runner', count: 2 }],
      [
        { laneSymbol: 'A', enemy: 'octopus-hauler', count: 1 },
        { laneSymbol: 'B', enemy: 'pot-grunt', count: 1 },
      ],
      [
        { laneSymbol: 'B', enemy: 'ring-borer', count: 1 },
        { laneSymbol: 'C', enemy: 'pump-runner', count: 1 },
      ],
      [
        { laneSymbol: 'A', enemy: 'pump-runner', count: 1 },
        { laneSymbol: 'C', enemy: 'eel-spark', count: 1 },
      ],
      [
        { laneSymbol: 'B', enemy: 'octopus-hauler', count: 1 },
        { laneSymbol: 'A', enemy: 'ring-borer', count: 1 },
      ],
      [
        { laneSymbol: 'A', enemy: 'pot-grunt', count: 2 },
        { laneSymbol: 'B', enemy: 'pump-runner', count: 1 },
        { laneSymbol: 'C', enemy: 'eel-spark', count: 1 },
      ],
    ],
    [
      [{ laneSymbol: 'B', enemy: 'pot-grunt', count: 2 }],
      [
        { laneSymbol: 'C', enemy: 'pump-runner', count: 1 },
        { laneSymbol: 'A', enemy: 'pot-grunt', count: 1 },
      ],
      [{ laneSymbol: 'B', enemy: 'ring-borer', count: 1 }],
      [
        { laneSymbol: 'A', enemy: 'eel-spark', count: 1 },
        { laneSymbol: 'C', enemy: 'pot-grunt', count: 1 },
      ],
      [
        { laneSymbol: 'B', enemy: 'pump-runner', count: 1 },
        { laneSymbol: 'C', enemy: 'pump-runner', count: 1 },
      ],
      [{ laneSymbol: 'A', enemy: 'octopus-hauler', count: 1 }],
      [
        { laneSymbol: 'C', enemy: 'ring-borer', count: 1 },
        { laneSymbol: 'B', enemy: 'pot-grunt', count: 2 },
      ],
      [
        { laneSymbol: 'A', enemy: 'pump-runner', count: 1 },
        { laneSymbol: 'B', enemy: 'eel-spark', count: 1 },
      ],
      [
        { laneSymbol: 'C', enemy: 'octopus-hauler', count: 1 },
        { laneSymbol: 'A', enemy: 'ring-borer', count: 1 },
      ],
      [
        { laneSymbol: 'A', enemy: 'pot-grunt', count: 1 },
        { laneSymbol: 'B', enemy: 'pump-runner', count: 1 },
        { laneSymbol: 'C', enemy: 'eel-spark', count: 1 },
      ],
    ],
  ],
  laneBlockSlots: {
    left: ['L1', 'C'],
    mid: ['M1', 'C'],
    right: ['R1', 'C'],
  },
  supportSlots: ['LP', 'RP'],
  exitLabel: '海',
  supportRowLabel: '高',
  forecastLabels: ['- 本 pulse 入潮：', '- 下 pulse：', '- 再下 pulse：'],
};

export function doctrineByKey(key: string): Doctrine {
  const doctrine = DOCTRINES.find((item) => item.key === key);
  if (!doctrine) throw new Error(`Unknown doctrine: ${key}`);
  return doctrine;
}

/** Expand a seeded blueprint into concrete lane spawns. */
export function buildWavePlan(rng: Rng, stage: StageDefinition = STAGE): SpawnEntry[][] {
  const blueprint = stage.waveBlueprints[rng.int(0, stage.waveBlueprints.length - 1)];
  if (!blueprint) throw new Error('Stage has no wave blueprints');
  const laneOrder = rng.shuffle(stage.lanes);
  const symbols: LaneSymbol[] = ['A', 'B', 'C'];
  const laneMap = {} as Record<LaneSymbol, LaneKey>;
  for (const [index, symbol] of symbols.entries()) {
    const lane = laneOrder[index];
    if (!lane) throw new Error('lane symbols and lanes must stay aligned');
    laneMap[symbol] = lane;
  }
  return blueprint.map((pulse) =>
    pulse.map((spec) => ({
      lane: laneMap[spec.laneSymbol],
      enemy: spec.enemy,
      count: spec.count,
    })),
  );
}
