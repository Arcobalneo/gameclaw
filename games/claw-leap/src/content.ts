export const MAX_LEVEL = 45;
export const GROWTH_INTERVAL = 15;
export const TRAIN_COST = 3;
export const STAT_CAP = 8;

export const NATURE_IDS = ['bold', 'steady', 'mellow'] as const;
export type NatureId = (typeof NATURE_IDS)[number];

export const COLOR_IDS = ['coral', 'mint', 'amber', 'lilac'] as const;
export type ColorId = (typeof COLOR_IDS)[number];

export const POWER_IDS = ['low', 'mid', 'high'] as const;
export type PowerId = (typeof POWER_IDS)[number];

export const ANGLE_IDS = ['flat', 'arc', 'high'] as const;
export type AngleId = (typeof ANGLE_IDS)[number];

export const TIMING_IDS = ['early', 'on', 'late'] as const;
export type TimingId = (typeof TIMING_IDS)[number];

export const STAT_IDS = ['spring', 'control', 'endurance', 'grip'] as const;
export type StatId = (typeof STAT_IDS)[number];

export type Attributes = Record<StatId, number>;

export interface Nature {
  id: NatureId;
  name: string;
  blurb: string;
  stats: Attributes;
}

export const NATURES: Record<NatureId, Nature> = {
  bold: {
    id: 'bold',
    name: '果敢',
    blurb: '先把身体弹出去再想办法。弹力高，控制较低。',
    stats: { spring: 5, control: 3, endurance: 4, grip: 3 },
  },
  steady: {
    id: 'steady',
    name: '沉稳',
    blurb: '看清风拍再收缩。控制高，落点更容易修正。',
    stats: { spring: 4, control: 5, endurance: 4, grip: 4 },
  },
  mellow: {
    id: 'mellow',
    name: '绵韧',
    blurb: '慢慢弹，也能一直弹。耐力与黏性高，初始弹力较低。',
    stats: { spring: 3, control: 4, endurance: 6, grip: 5 },
  },
};

export interface JellyColor {
  id: ColorId;
  name: string;
  blurb: string;
  stats: Partial<Attributes>;
}

export const COLORS: Record<ColorId, JellyColor> = {
  coral: {
    id: 'coral',
    name: '珊瑚橙',
    blurb: '弹力 +1、控制 -1。亮得像一小段刹车灯。',
    stats: { spring: 1, control: -1 },
  },
  mint: {
    id: 'mint',
    name: '薄荷青',
    blurb: '控制 +1、弹力 -1。冷静，但不是没有弹性。',
    stats: { control: 1, spring: -1 },
  },
  amber: {
    id: 'amber',
    name: '灯芯黄',
    blurb: '耐力 +1、黏性 -1。把灯光存进身体里。',
    stats: { endurance: 1, grip: -1 },
  },
  lilac: {
    id: 'lilac',
    name: '夜紫',
    blurb: '黏性 +1、耐力 -1。更容易挂住灯柱，也更容易黏住同伴。',
    stats: { grip: 1, endurance: -1 },
  },
};

export const POWERS: Record<
  PowerId,
  { name: string; impulse: number; cost: number; rescueForce: number; tension: number }
> = {
  low: { name: '轻', impulse: 0, cost: 1, rescueForce: 1, tension: 0 },
  mid: { name: '中', impulse: 1.5, cost: 2, rescueForce: 2, tension: 1 },
  high: { name: '强', impulse: 3, cost: 3, rescueForce: 3, tension: 2 },
};

export const ANGLES: Record<AngleId, { name: string; radians: number }> = {
  flat: { name: '低角', radians: Math.PI / 6 },
  arc: { name: '弧线', radians: Math.PI / 4 },
  high: { name: '高角', radians: Math.PI / 3 },
};

export const TIMINGS: Record<TimingId, { name: string }> = {
  early: { name: '早拍' },
  on: { name: '正拍' },
  late: { name: '晚拍' },
};

export const STAT_NAMES: Record<StatId, string> = {
  spring: '弹力',
  control: '控制',
  endurance: '耐力',
  grip: '黏性',
};

export const SIZE_NAMES = ['豆冻', '弹团', '灯团'] as const;

export const DISTRICTS = [
  { until: 15, name: '旧城慢街', blurb: '灯柱还密，风在屋檐之间试探。' },
  { until: 30, name: '风口长街', blurb: '街面变快，灯柱间距拉开，风开始横着走。' },
  { until: 45, name: '高架黎明', blurb: '最后一段架在天上。能看见更远，也必须跳得更准。' },
] as const;

export const PARTNER_NAMES = ['糯糯', '软糖', '小团', '灯苗', '弹弹', '雨点儿'] as const;

export type EndingId = 'dawn' | 'fall' | 'exhausted' | 'rescue-fall' | 'aborted';

export const ENDING_NAMES: Record<EndingId, string> = {
  dawn: '天亮',
  fall: '坠落',
  exhausted: '力竭',
  'rescue-fall': '黏连坠落',
  aborted: '收团',
};
