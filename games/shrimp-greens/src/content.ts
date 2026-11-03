/**
 * Static content for 虾素 / Shrimp Greens.
 *
 * Names, blurbs and the sixteen-seat menu live here. Every number that changes
 * a run is applied in the engine, so a sentence in this file cannot invent a
 * result the stats do not show.
 */

export type GenderId = 'female' | 'male' | 'nonbinary';
export type PersonalityId = 'steady' | 'soft' | 'sharp';
export type FamilyId = 'meat' | 'veg';
export type ReasonId = 'ethic' | 'faith' | 'health' | 'taste';
export type CreedId = ReasonId | 'none';
export type PhaseId = 'home' | 'school' | 'out' | 'seat';
export type SceneKind = 'meal' | 'label' | 'kitchen' | 'settle';
export type Who = 'family' | 'class' | 'work' | 'self';
export type VegRule = 'always' | 'never' | 'house' | 'roll';

export type EndingId =
  | 'host'
  | 'truce'
  | 'script'
  | 'split'
  | 'anorexia'
  | 'cutoff'
  | 'labeled'
  | 'dissolved'
  | 'clash'
  | 'loose'
  | 'aborted';

export const GENDER_IDS: readonly GenderId[] = ['female', 'male', 'nonbinary'];
export const PERSONALITY_IDS: readonly PersonalityId[] = ['steady', 'soft', 'sharp'];
export const FAMILY_IDS: readonly FamilyId[] = ['meat', 'veg'];
export const REASON_IDS: readonly ReasonId[] = ['ethic', 'faith', 'health', 'taste'];
export const HOUSE_CREEDS: readonly ReasonId[] = ['ethic', 'faith', 'health'];
export const PHASE_ORDER: readonly PhaseId[] = ['home', 'school', 'out', 'seat'];

export const GENDER_NAMES: Record<GenderId, string> = {
  female: '女',
  male: '男',
  nonbinary: '非二元',
};

export const STEREOTYPE: Record<GenderId, string> = {
  female: '娇气',
  male: '不够意思',
  nonbinary: '又一套身份',
};

export const PHASE_NAMES: Record<PhaseId, string> = {
  home: '家里',
  school: '校园',
  out: '出门',
  seat: '立席',
};

export const PHASE_ENTER: Record<PhaseId, string> = {
  home: '',
  school: '你开始在学校吃饭。家人还在，但场面从这里起算。',
  out: '你出门了。应酬、同事和朋友局不会因为你解释过一次就结束。',
  seat: '你可以收束了。门槛写在「收束」里，不够的不会出现在动作列表中。',
};

export const WHO_NAMES: Record<Who, string> = {
  family: '家人',
  class: '同学',
  work: '外面的人',
  self: '你自己',
};

export interface Profile {
  id: PersonalityId;
  name: string;
  blurb: string;
  body: number;
  home: number;
  room: number;
  line: number;
  prep: number;
}

export const PROFILES: Record<PersonalityId, Profile> = {
  steady: {
    id: 'steady',
    name: '稳',
    blurb: '说话留余地。离席伤关系较轻，解释更容易被听见。',
    body: 5,
    home: 4,
    room: 5,
    line: 4,
    prep: 0,
  },
  soft: {
    id: 'soft',
    name: '软',
    blurb: '不爱把桌子掀了。同席时不太掉立场，但开局立场就低。',
    body: 5,
    home: 5,
    room: 5,
    line: 2,
    prep: 0,
  },
  sharp: {
    id: 'sharp',
    name: '烈',
    blurb: '立场很清楚。对家里人说话像宣判，对外面的人反而说得动。',
    body: 4,
    home: 3,
    room: 5,
    line: 5,
    prep: 1,
  },
};

export const FAMILY_NAMES: Record<FamilyId, string> = {
  meat: '无肉不欢',
  veg: '素食家庭',
};

export const FAMILY_BLURB: Record<FamilyId, string> = {
  meat: '家里的菜默认有肉。他们爱你，你也爱他们，但这张桌子不按你的盘子摆。',
  veg: '家里也吃素。这是运气，不是免战。理由若不一样，摩擦还在。',
};

export const REASON_NAMES: Record<ReasonId, string> = {
  ethic: '伦理',
  faith: '信仰',
  health: '养生',
  taste: '口味',
};

export const REASON_BLURB: Record<ReasonId, string> = {
  ethic: '你不想把动物当食物。',
  faith: '有些东西你不往嘴里放。',
  health: '你的身体不接受肉。',
  taste: '你就是不爱吃，也不打算为了场面学会爱。',
};

export const ENDING_NAMES: Record<EndingId, string> = {
  host: '自席',
  truce: '同桌',
  script: '外席',
  split: '分席',
  anorexia: '厌食',
  cutoff: '断席',
  labeled: '标签',
  dissolved: '随席',
  clash: '冲突',
  loose: '没收束',
  aborted: '中止',
};

export const ENDING_CAUSE: Record<EndingId, string> = {
  host: '你摆出自己的一桌。没人必须改口，但这张桌子默认你的盘子。',
  truce: '家里的菜还是家里的菜。你的位子还在，你的盘子也还在。',
  script: '同事和朋友记住了你怎么吃饭。应酬还在，但不再每次都从零解释。',
  split: '家里也吃素，理由和你不一样。你们把这句话说开了，仍然坐在同一间屋子里。',
  anorexia: '你连着几顿没有吃下东西，身体先停了。这一局结束在吃不下，不是结束在说服了谁。',
  cutoff: '家里这桌不再给你留位子。冲突没有变成商量，位子先没了。',
  labeled: '外面的人只剩下一个称呼。没有人再跟你约一顿能吃的饭。',
  dissolved: '你还能坐下，但已经说不清自己为什么不吃肉。立场归零，这一局的素食者身份散了。',
  clash: '肉食家里的硬碰硬叠满了：冲突到了线，身体和家人都已经很低。这一席是吵崩的，也是吃崩的。',
  loose: '十六席过完了，盘子还没放稳。活到最后不算收束。',
  aborted: '你把这一席推开了，日子还没过完。',
};

export const ENDING_BASE: Record<EndingId, number> = {
  host: 48,
  split: 44,
  script: 40,
  truce: 36,
  clash: 14,
  loose: 12,
  anorexia: 10,
  cutoff: 10,
  labeled: 10,
  dissolved: 8,
  aborted: 0,
};

export const WIN_ENDINGS: ReadonlySet<EndingId> = new Set(['host', 'truce', 'script', 'split']);

export interface SceneTemplate {
  id: string;
  phase: PhaseId;
  kind: SceneKind;
  title: string;
  heat: number;
  veg: VegRule;
  who: Who;
  thin?: boolean;
  blurb: string;
}

export const SCENE_TEMPLATES: readonly SceneTemplate[] = [
  {
    id: 'breakfast',
    phase: 'home',
    kind: 'meal',
    title: '早饭',
    heat: 1,
    veg: 'always',
    who: 'family',
    blurb: '粥、咸菜、一个鸡蛋。肉不在这顿。',
  },
  {
    id: 'braise',
    phase: 'home',
    kind: 'meal',
    title: '红烧',
    heat: 3,
    veg: 'house',
    who: 'family',
    blurb: '锅里是红烧。素食家里是素的，肉食家里没有第二盘。',
  },
  {
    id: 'guest',
    phase: 'home',
    kind: 'meal',
    title: '亲戚上桌',
    heat: 2,
    veg: 'house',
    who: 'family',
    blurb: '亲戚把筷子递过来，问你怎么还不夹。',
  },
  {
    id: 'newyear',
    phase: 'home',
    kind: 'meal',
    title: '年夜饭',
    heat: 3,
    veg: 'house',
    who: 'family',
    blurb: '一年里最吵的一桌。位子是留给你的，菜不一定是。',
  },
  {
    id: 'canteen',
    phase: 'school',
    kind: 'meal',
    title: '食堂窗口',
    heat: 1,
    veg: 'always',
    who: 'class',
    thin: true,
    blurb: '素窗口还开着。分量小，味道一般，但确实是素的。',
  },
  {
    id: 'hotpot',
    phase: 'school',
    kind: 'meal',
    title: '同学火锅',
    heat: 3,
    veg: 'never',
    who: 'class',
    blurb: '锅底已经红了。清汤锅在菜单最后一行，今天没人点。',
  },
  {
    id: 'teacher',
    phase: 'school',
    kind: 'label',
    title: '班主任的问题',
    heat: 1,
    veg: 'never',
    who: 'class',
    blurb: '老师把你留下来，问你是不是在家里闹别扭。',
  },
  {
    id: 'picnic',
    phase: 'school',
    kind: 'meal',
    title: '春游便当',
    heat: 2,
    veg: 'never',
    who: 'class',
    blurb: '别人的盒子里有鸡腿。你的位子空着。',
  },
  {
    id: 'kitchen',
    phase: 'out',
    kind: 'kitchen',
    title: '出租屋的灶',
    heat: 0,
    veg: 'always',
    who: 'self',
    blurb: '一间灶，两口锅。这是你自己的饭点。',
  },
  {
    id: 'lunch',
    phase: 'out',
    kind: 'meal',
    title: '同事午饭',
    heat: 2,
    veg: 'roll',
    who: 'work',
    blurb: '有人订了套餐。有没有素菜，看这家店今天做不做。',
  },
  {
    id: 'client',
    phase: 'out',
    kind: 'meal',
    title: '客户应酬',
    heat: 3,
    veg: 'never',
    who: 'work',
    blurb: '转盘上的肉先转到你面前。没人先问你吃不吃。',
  },
  {
    id: 'friends',
    phase: 'out',
    kind: 'meal',
    title: '朋友局',
    heat: 2,
    veg: 'never',
    who: 'work',
    blurb: '朋友说随便吃点。菜单上没有随便。',
  },
  {
    id: 'homecoming',
    phase: 'seat',
    kind: 'meal',
    title: '回一趟家',
    heat: 2,
    veg: 'house',
    who: 'family',
    blurb: '门还开着。菜按家里的习惯摆，不是按你的。',
  },
  {
    id: 'ownstove',
    phase: 'seat',
    kind: 'kitchen',
    title: '自己的灶',
    heat: 0,
    veg: 'always',
    who: 'self',
    blurb: '还是那两口锅。你可以吃，也可以再备一盒。',
  },
  {
    id: 'labeled',
    phase: 'seat',
    kind: 'label',
    title: '介绍你的人',
    heat: 2,
    veg: 'never',
    who: 'work',
    blurb: '有人说：这是那个吃素的。后面的话还没出口。',
  },
  {
    id: 'lasttable',
    phase: 'seat',
    kind: 'settle',
    title: '收束的这一席',
    heat: 1,
    veg: 'always',
    who: 'self',
    blurb: '桌子是你的。这一席用来决定以后怎么吃饭。',
  },
];
