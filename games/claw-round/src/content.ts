export const ITEMS = ['ticket', 'lamp', 'coin', 'rope', 'bell'] as const;
export type Item = (typeof ITEMS)[number];

export const ITEM_LABEL: Record<Item, string> = {
  ticket: '票',
  lamp: '灯',
  coin: '币',
  rope: '绳',
  bell: '铃',
};
