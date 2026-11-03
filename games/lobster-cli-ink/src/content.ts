/**
 * Static content for 横着写 / Lobster Sideways Ink.
 *
 * Everything here is data: six stops on the road, three starting profiles and
 * the twelve conversations that stand in for a whole world of rumours. The
 * engine owns every rule; this file owns every name.
 */

export type SiteId = 'town' | 'stele' | 'ferry' | 'pool' | 'temple' | 'post';

export interface Site {
  id: SiteId;
  name: string;
  short: string;
  /** Wild sites are the only places a brush could be buried. */
  wild: boolean;
  neighbors: SiteId[];
  blurb: string;
}

export const SITE_ORDER: SiteId[] = ['town', 'stele', 'ferry', 'pool', 'temple', 'post'];

export const SITES: Record<SiteId, Site> = {
  town: {
    id: 'town',
    name: '归墟镇',
    short: '镇',
    wild: false,
    neighbors: ['stele', 'ferry', 'temple'],
    blurb: '石板路被水汽泡得发亮，米铺门口排着队，人人都在说那支笔。',
  },
  stele: {
    id: 'stele',
    name: '断碑坡',
    short: '坡',
    wild: true,
    neighbors: ['town', 'pool'],
    blurb: '半截无字碑歪在风里，坡下的土颜色比别处深。',
  },
  ferry: {
    id: 'ferry',
    name: '雾渡口',
    short: '渡',
    wild: true,
    neighbors: ['town', 'pool', 'post'],
    blurb: '船不靠岸，船夫只卖干粮，然后指一指雾里。',
  },
  pool: {
    id: 'pool',
    name: '墨池',
    short: '池',
    wild: true,
    neighbors: ['stele', 'ferry'],
    blurb: '池水黑得能照见别人，听久了会听见有人在低声念你的名字。',
  },
  temple: {
    id: 'temple',
    name: '荒庙',
    short: '庙',
    wild: true,
    neighbors: ['town', 'post'],
    blurb: '供桌被搬空了，墙上还留着没抄完的经，墨迹是新的。',
  },
  post: {
    id: 'post',
    name: '皇驿',
    short: '驿',
    wild: false,
    neighbors: ['ferry', 'temple'],
    blurb: '驿丞不问来路，只问你要递名帖，还是要打点。',
  },
};

export const WILD_SITES: SiteId[] = ['stele', 'ferry', 'pool', 'temple'];

export type ProfileId = 'lamp' | 'abacus' | 'scribe';

export interface Profile {
  id: ProfileId;
  name: string;
  line: string;
  belief: number;
  silver: number;
  food: number;
  life: number;
  proof: number;
  renown: number;
  manuscript: number;
}

export const PROFILES: Record<ProfileId, Profile> = {
  lamp: {
    id: 'lamp',
    name: '执灯信者',
    line: '你信，所以你已经在路上。信让你看得见线索，也让你更容易把假话当真。',
    belief: 72,
    silver: 9,
    food: 10,
    life: 4,
    proof: 0,
    renown: 1,
    manuscript: 0,
  },
  abacus: {
    id: 'abacus',
    name: '算筹疑者',
    line: '你不信。你带够了钱、算好了路，打算把每一条传闻都验一遍。',
    belief: 28,
    silver: 15,
    food: 11,
    life: 3,
    proof: 1,
    renown: 0,
    manuscript: 0,
  },
  scribe: {
    id: 'scribe',
    name: '走笔录者',
    line: '你半信半疑，但你带着笔和纸。无论笔是真是假，这趟都值得写下来。',
    belief: 50,
    silver: 11,
    food: 11,
    life: 4,
    proof: 0,
    renown: 2,
    manuscript: 1,
  },
};

export const PROFILE_IDS: ProfileId[] = ['lamp', 'abacus', 'scribe'];

export interface TalkDef {
  id: string;
  site: SiteId;
  label: string;
  detail: string;
  cost?: { silver?: number; food?: number };
  requiresRenown?: number;
  effect: {
    silver?: number;
    food?: number;
    life?: number;
    belief?: number;
    proof?: number;
    renown?: number;
    manuscript?: number;
  };
  log: string;
}

export const TALKS: TalkDef[] = [
  {
    id: 'work',
    site: 'town',
    label: '在米铺接零工',
    detail: '扛半天米袋，换几个铜钱和一点脸熟。每人只肯雇你一次。',
    effect: { silver: 5, renown: 1 },
    log: '你扛了半天米袋，掌心磨破，换到 5 银和一点脸熟。',
  },
  {
    id: 'buy-food',
    site: 'town',
    label: '买一袋粮',
    detail: '镇上粮价随年月浮动，一次补 6 粮。',
    cost: { silver: 3 },
    effect: { food: 6 },
    log: '你把粮袋甩上肩，袋子比看上去沉。',
  },
  {
    id: 'herder',
    site: 'stele',
    label: '问坡上的牧人',
    detail: '他见过夜里发光的土，也见过有人挖到一半就跑。',
    effect: { belief: 8 },
    log: '牧人说他爷爷见过那支笔落下，说完又低头赶羊。',
  },
  {
    id: 'berries',
    site: 'stele',
    label: '拾坡后的野果',
    detail: '酸，但能填肚子。',
    effect: { food: 3 },
    log: '你摘了一兜野果，酸的，至少能撑一阵。',
  },
  {
    id: 'rations',
    site: 'ferry',
    label: '向船夫买干粮',
    detail: '两银换五天份的干粮。',
    cost: { silver: 2 },
    effect: { food: 5 },
    log: '船夫递来油纸包，顺手把船撑远了半丈。',
  },
  {
    id: 'boatman',
    site: 'ferry',
    label: '听船夫讲雾里的事',
    detail: '他讲了三十年，故事越讲越短。',
    effect: { belief: 6, manuscript: 1 },
    log: '船夫说，雾里有一支笔在等人来写；你记下了一页。',
  },
  {
    id: 'ink-voice',
    site: 'pool',
    label: '俯身听墨声',
    detail: '会听见有人念你的名字，也会掉一段命。',
    effect: { belief: 12, life: -1 },
    log: '池水念了你的名字。你站起来时，手在抖。',
  },
  {
    id: 'draw-water',
    site: 'pool',
    label: '取一壶池水',
    detail: '水能喝，喝完嘴里发苦。',
    effect: { food: 2, life: -1 },
    log: '你灌了一壶，水苦得像药，喝完胃里发凉。',
  },
  {
    id: 'assay-ink',
    site: 'temple',
    label: '验一验庙里的残墨',
    detail: '三银换一份能对得上的证据。',
    cost: { silver: 3 },
    effect: { proof: 1 },
    log: '你把残墨刮进纸里，对着光看，墨色里有极细的金。',
  },
  {
    id: 'copy-sutra',
    site: 'temple',
    label: '替人抄一页经',
    detail: '香客给钱，抄经让人心静。',
    effect: { silver: 3, belief: 2 },
    log: '你抄完一页，手腕发酸，心里却静了一点。',
  },
  {
    id: 'name-card',
    site: 'post',
    label: '递名帖',
    detail: '有名望的人才递得进去；换银，也换更大的名。',
    requiresRenown: 3,
    effect: { silver: 6, renown: 1 },
    log: '驿丞看了你的名帖，把你请进侧厅喝了盏茶，走时塞了 6 银。',
  },
  {
    id: 'bribe',
    site: 'post',
    label: '打点驿丞',
    detail: '三银换一个能进出的名字。',
    cost: { silver: 3 },
    effect: { renown: 1 },
    log: '驿丞收了银子，把你的名字写进一册没人翻的簿子。',
  },
];

/** Lines that never reveal whether a dig site is the real one. */
export const DIG_FAILURE = [
  '你挖到指节发白，只翻出湿土、碎瓦和一枚锈钉。',
  '土很实。你换了个方向再挖，还是什么都没有。',
  '你挖了半夜，坑底渗出水来。笔不在这一锹里。',
];

export const INVESTIGATE_MISS = [
  '你顺着痕迹走了一圈，只找到半句被人擦掉的话。',
  '有人比你先到过，留下的只有脚印和灰。',
];

export const ENDING_NAMES = {
  keep_believer: '执笔',
  keep_verified: '证笔',
  sold: '售笔',
  sealed: '封笔',
  seek: '寻笔',
  preach: '劝世',
  starved: '墨尽',
  devoured: '墨噬',
  aborted: '收壳',
} as const;

export type EndingId = keyof typeof ENDING_NAMES;

export const ENDING_BASE: Record<EndingId, number> = {
  keep_believer: 60,
  keep_verified: 72,
  sold: 58,
  sealed: 68,
  seek: 44,
  preach: 48,
  starved: 8,
  devoured: 4,
  aborted: 0,
};
