/** Pier names and the public kind labels for 虾印 / Claw Stamp. */

export const NAMES = [
  '潮生',
  '灯下',
  '壳市',
  '网尾',
  '盐摊',
  '珠客',
  '礁民',
  '渡口',
  '夜帆',
  '白爪',
  '红钳',
  '青苔',
  '墨点',
  '沙线',
  '港灯',
  '星壳',
  '芦苇',
  '晚潮',
] as const;

export type Kind = 'clear' | 'edge' | 'banned';

export const KIND_LABEL: Record<Kind, string> = {
  clear: '合法',
  edge: '擦边',
  banned: '禁行',
};
