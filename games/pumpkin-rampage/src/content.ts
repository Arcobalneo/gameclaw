/**
 * Static content for 南瓜大暴走 / Pumpkin Rampage.
 *
 * Text lives here; every number that changes during a run lives in `engine.ts`.
 */

export type MonsterKind = 'roller' | 'runner' | 'bouncer' | 'floater';
export type Mood = 'grumpy' | 'playful' | 'shy';
export type Approach = 'candy' | 'song' | 'pat';

export interface MonsterKindSpec {
  readonly name: string;
  /** How it is described when it moves. */
  readonly verb: string;
  /** How many successful soothes it takes to be calmed. */
  readonly need: number;
  /** Difficulty of the soothe roll before agitation is added. */
  readonly base: number;
  /** What a careful look tells you about its tracks. */
  readonly tell: string;
}

export const MONSTER_KINDS: Record<MonsterKind, MonsterKindSpec> = {
  roller: {
    name: '滚筒南瓜',
    verb: '滚走',
    need: 2,
    base: 5,
    tell: '藤蔓被压出一道圆弧，土是往一边翻的。',
  },
  runner: {
    name: '疾跑南瓜',
    verb: '跑开',
    need: 2,
    base: 5,
    tell: '畦面留着一串浅浅的脚印，间距很大。',
  },
  bouncer: {
    name: '弹跳南瓜',
    verb: '弹走',
    need: 3,
    base: 6,
    tell: '畦边有两个对称的浅坑，像落地又弹起。',
  },
  floater: {
    name: '飞天南瓜',
    verb: '飘走',
    need: 3,
    base: 6,
    tell: '它投下的影子比南瓜本身多出一个。',
  },
};

export const MOODS: Record<Mood, { name: string; line: string }> = {
  grumpy: {
    name: '暴躁',
    line: '它的藤须绷得笔直，你一靠近就想撞过来。',
  },
  playful: {
    name: '顽皮',
    line: '它一边滚一边偷看你，像在等你追。',
  },
  shy: {
    name: '怯生',
    line: '它缩在畦角，藤须轻轻发抖。',
  },
};

/** Roll modifier for each approach against each mood. */
export const APPROACH_FIT: Record<Mood, Record<Approach, number>> = {
  grumpy: { candy: 2, song: -1, pat: 0 },
  playful: { candy: 0, song: 2, pat: 1 },
  shy: { candy: -1, song: 0, pat: 2 },
};

export const APPROACHES: Record<Approach, { name: string; blurb: string }> = {
  candy: { name: '递糖果', blurb: '消耗 1 糖果，对暴躁的南瓜最有效。' },
  song: { name: '哼小调', blurb: '不花资源，对顽皮的南瓜最有效。' },
  pat: { name: '轻拍藤须', blurb: '多花 1 体力，对怯生的南瓜最有效。' },
};

export const PLOT_NAMES = ['东畦', '南畦', '西畦', '中畦', '北畦', '角畦'] as const;

export const PLOT_IDS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const;

export const CROP_STAGES = ['空畦', '抽藤', '可以收了'] as const;

export const FLAVOR = {
  probeMiss: [
    '只有几只夜蛾从叶子底下飞出来。',
    '土壤是干的，连虫爬的痕迹都没有。',
    '你听见的只是风穿过塑料布的声音。',
  ],
  probeHint: [
    '叶子在动，但你没看清是风还是别的什么。',
    '有什么东西从畦那头挪开了，很轻。',
    '藤蔓晃了一下，又停住。',
  ],
  sootheFail: [
    '它猛地一扭，从你手边滑了出去。',
    '它被你惊到，翻过田垄跑了。',
    '你还没靠近，它就已经弹开了。',
  ],
  capture: [
    '它慢慢软下来，靠在你手心里不动了。',
    '南瓜怪呼噜了一声，藤须垂下来。',
    '它最后滚了半圈，停下来，安静了。',
  ],
} as const;
