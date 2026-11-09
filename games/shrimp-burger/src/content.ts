export const HEAT_START = 20;
export const COOLING = 2;
export const LANE_COUNT = 3;
export const MAX_TIMELINE = 80;
export const MAX_NOTES = 12;
export const MAX_PESTS = 2;

export type Difficulty = 'easy' | 'normal' | 'hard';
export type Phase = 'service' | 'guest' | 'ended';
export type EndingId = 'shift-done' | 'walkouts' | 'ruined' | 'timeout' | 'aborted';
export type TasteVerdict = 'tasty' | 'lucky' | 'bad' | 'disaster';
export type LegendRole = 'required' | 'compatible' | 'optional' | 'wrong' | 'special';
export type HeatGrade = 'rare' | 'medium' | 'well';

export const MATERIAL_IDS = [
  'bun',
  'patty',
  'cheese',
  'lettuce',
  'tomato',
  'pickle',
  'sauce',
  'bacon',
  'egg',
  'seaweed',
  'sock',
  'battery',
  'cheese-bacon',
  'garden-wrap',
  'pickle-egg',
  'golden-bun',
  'sock-patty',
  'sauce-cheese',
] as const;
export type MaterialId = (typeof MATERIAL_IDS)[number];

export interface MaterialSpec {
  id: MaterialId;
  name: string;
  taste: number;
  special: boolean;
  fused: boolean;
  satisfies: readonly MaterialId[];
  fusionBonus: number;
}

export const MATERIALS: Record<MaterialId, MaterialSpec> = {
  bun: { id: 'bun', name: '面包', taste: 0, special: false, fused: false, satisfies: [], fusionBonus: 0 },
  patty: { id: 'patty', name: '肉饼', taste: 0, special: false, fused: false, satisfies: [], fusionBonus: 0 },
  cheese: { id: 'cheese', name: '芝士', taste: 0, special: false, fused: false, satisfies: [], fusionBonus: 0 },
  lettuce: { id: 'lettuce', name: '生菜', taste: 0, special: false, fused: false, satisfies: [], fusionBonus: 0 },
  tomato: { id: 'tomato', name: '番茄', taste: 0, special: false, fused: false, satisfies: [], fusionBonus: 0 },
  pickle: { id: 'pickle', name: '酸黄瓜', taste: 0, special: false, fused: false, satisfies: [], fusionBonus: 0 },
  sauce: { id: 'sauce', name: '酱汁', taste: 0, special: false, fused: false, satisfies: [], fusionBonus: 0 },
  bacon: { id: 'bacon', name: '培根', taste: 0, special: false, fused: false, satisfies: [], fusionBonus: 0 },
  egg: { id: 'egg', name: '太阳蛋', taste: 0, special: false, fused: false, satisfies: [], fusionBonus: 0 },
  seaweed: { id: 'seaweed', name: '海苔', taste: -2, special: false, fused: false, satisfies: [], fusionBonus: 0 },
  sock: { id: 'sock', name: '袜子', taste: -20, special: false, fused: false, satisfies: [], fusionBonus: 0 },
  battery: { id: 'battery', name: '电池', taste: -28, special: false, fused: false, satisfies: [], fusionBonus: 0 },
  'cheese-bacon': {
    id: 'cheese-bacon',
    name: '芝培根',
    taste: 2,
    special: false,
    fused: true,
    satisfies: ['cheese', 'bacon'],
    fusionBonus: 5,
  },
  'garden-wrap': {
    id: 'garden-wrap',
    name: '生菜番茄卷',
    taste: 2,
    special: false,
    fused: true,
    satisfies: ['lettuce', 'tomato'],
    fusionBonus: 4,
  },
  'pickle-egg': {
    id: 'pickle-egg',
    name: '酸黄瓜太阳蛋',
    taste: 1,
    special: false,
    fused: true,
    satisfies: ['pickle', 'egg'],
    fusionBonus: 4,
  },
  'golden-bun': {
    id: 'golden-bun',
    name: '黄金锅巴',
    taste: 8,
    special: true,
    fused: true,
    satisfies: ['bun'],
    fusionBonus: 12,
  },
  'sock-patty': {
    id: 'sock-patty',
    name: '袜排',
    taste: -18,
    special: false,
    fused: true,
    satisfies: [],
    fusionBonus: 0,
  },
  'sauce-cheese': {
    id: 'sauce-cheese',
    name: '芝士酱漩',
    taste: 3,
    special: false,
    fused: true,
    satisfies: ['sauce', 'cheese'],
    fusionBonus: 5,
  },
};

export const BASE_MATERIAL_IDS = [
  'bun',
  'patty',
  'cheese',
  'lettuce',
  'tomato',
  'pickle',
  'sauce',
  'bacon',
  'egg',
  'seaweed',
  'sock',
  'battery',
] as const satisfies readonly MaterialId[];

export const FUSION_IDS = [
  'cheese-bacon',
  'garden-wrap',
  'pickle-egg',
  'golden-bun',
  'sock-patty',
  'sauce-cheese',
] as const satisfies readonly MaterialId[];

export const HEAT_ORBS: Record<HeatGrade, { name: string; value: number }> = {
  rare: { name: '三分火候', value: 12 },
  medium: { name: '五分火候', value: 22 },
  well: { name: '全熟火候', value: 34 },
};

export const HEAT_GRADES = ['rare', 'medium', 'well'] as const;

export interface RecipeSpec {
  id: string;
  name: string;
  required: readonly MaterialId[];
  optional: readonly MaterialId[];
  heatMin: number;
  heatMax: number;
  note: string;
}

export const RECIPES: readonly RecipeSpec[] = [
  {
    id: 'classic',
    name: '经典虾堡',
    required: ['bun', 'patty', 'cheese'],
    optional: ['pickle', 'sauce', 'lettuce'],
    heatMin: 44,
    heatMax: 62,
    note: '配料表外不会自动失败，但会改写味觉阈值。',
  },
  {
    id: 'garden',
    name: '田园鲜堡',
    required: ['bun', 'patty', 'lettuce', 'tomato'],
    optional: ['sauce', 'pickle', 'cheese'],
    heatMin: 40,
    heatMax: 58,
    note: '清爽路线：错料仍可入栈，火候偏低更好。',
  },
  {
    id: 'breakfast',
    name: '清晨熔岩',
    required: ['bun', 'patty', 'egg', 'bacon'],
    optional: ['cheese', 'sauce'],
    heatMin: 56,
    heatMax: 74,
    note: '要更烫一点。芝培根融合能一次补齐两样。',
  },
  {
    id: 'picklehouse',
    name: '酸黄瓜屋',
    required: ['bun', 'patty', 'cheese', 'pickle'],
    optional: ['sauce', 'lettuce'],
    heatMin: 48,
    heatMax: 64,
    note: '酸黄瓜太阳蛋属于可选惊喜。',
  },
  {
    id: 'seaside',
    name: '潮汐堡',
    required: ['bun', 'patty', 'seaweed', 'sauce'],
    optional: ['lettuce', 'tomato'],
    heatMin: 40,
    heatMax: 58,
    note: '海苔在这里是正经配料，不是袜子。',
  },
  {
    id: 'station',
    name: '夜班站长堡',
    required: ['bun', 'patty', 'bacon', 'cheese', 'sauce'],
    optional: ['egg', 'pickle'],
    heatMin: 60,
    heatMax: 78,
    note: '材料多、火候高；融合与错料的诱惑也最大。',
  },
];

export type PestKind = 'mouse' | 'seagull' | 'raccoon' | 'pigeon' | 'cat';

export const PEST_KINDS = ['mouse', 'seagull', 'raccoon', 'pigeon', 'cat'] as const;

export const PEST_SPECS: Record<
  PestKind,
  { name: string; warning: number; blurb: string }
> = {
  mouse: { name: '老鼠', warning: 2, blurb: '偷顶层食材；栈空则偷一格落物。' },
  seagull: { name: '海鸥', warning: 2, blurb: '专偷配方内材料；没有就偷顶层。' },
  raccoon: { name: '浣熊', warning: 3, blurb: '先偷火候；火候已冷则偷顶层。' },
  pigeon: { name: '鸽子', warning: 2, blurb: '啄两格落物，顺手弄脏心情。' },
  cat: { name: '猫', warning: 3, blurb: '掀掉顶上两层；栈空则偷一格落物。' },
};

export interface DifficultySpec {
  goal: number;
  turns: number;
  maxWalkouts: number;
  maxRuined: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultySpec> = {
  easy: { goal: 3, turns: 68, maxWalkouts: 4, maxRuined: 4 },
  normal: { goal: 4, turns: 60, maxWalkouts: 3, maxRuined: 3 },
  hard: { goal: 5, turns: 58, maxWalkouts: 2, maxRuined: 2 },
};

export const GUEST_NAMES = [
  '阿潮',
  '灯柱小姐',
  '夜班仓鼠',
  '路过的虾',
  '焦急的猫',
  '迟到的快递员',
  '会飞的雨衣',
] as const;

export const ENDING_NAMES: Record<EndingId, string> = {
  'shift-done': '交班成功',
  walkouts: '客人愤然离店',
  ruined: '厨房报废',
  timeout: '班次耗尽',
  aborted: '主动收摊',
};
