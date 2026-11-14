/** Phrase words for 虾节 / Claw Beat. */

export const MOVES = ['jab', 'guard', 'slip', 'rest'] as const;
export type Move = (typeof MOVES)[number];

export const INTENTS = ['strike', 'grab', 'feint', 'rest'] as const;
export type Intent = (typeof INTENTS)[number];

export const MOVE_LABEL: Record<Move, string> = {
  jab: '点',
  guard: '架',
  slip: '闪',
  rest: '歇',
};

export const INTENT_LABEL: Record<Intent, string> = {
  strike: '劈',
  grab: '擒',
  feint: '虚',
  rest: '停',
};

export const CHUNKS: readonly (readonly Intent[])[] = [
  ['strike', 'feint', 'rest', 'grab'],
  ['grab', 'strike', 'strike', 'feint'],
  ['feint', 'rest', 'grab', 'strike'],
  ['strike', 'grab', 'feint', 'rest'],
  ['rest', 'strike', 'feint', 'grab'],
  ['strike', 'feint', 'grab', 'rest'],
  ['grab', 'feint', 'strike', 'rest'],
  ['feint', 'strike', 'rest', 'grab'],
];
