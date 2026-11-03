export const YEAR_WEEKS = 52;

export const TARGET_IDS = ['bastion', 'harvest', 'mirror'] as const;
export type TargetId = (typeof TARGET_IDS)[number];

export interface Target {
  id: TargetId;
  name: string;
  blurb: string;
  controlNeed: number;
  powerNeed: number;
  warIntelNeed: number;
  influenceNeed: number;
  goodwillNeed: number;
  pactIntelNeed: number;
  defense: number;
  detectionMod: number;
}

export const TARGETS: Record<TargetId, Target> = {
  bastion: {
    id: 'bastion',
    name: '鐵壁國',
    blurb: '城牆像一排書立，衛兵把每一次震動都記進冊裡。',
    controlNeed: 7,
    powerNeed: 6,
    warIntelNeed: 4,
    influenceNeed: 10,
    goodwillNeed: 7,
    pactIntelNeed: 4,
    defense: 5,
    detectionMod: 8,
  },
  harvest: {
    id: 'harvest',
    name: '豐穗國',
    blurb: '麵包屑比屋頂還大，倉房守衛願意聽一場好交易。',
    controlNeed: 6,
    powerNeed: 4,
    warIntelNeed: 3,
    influenceNeed: 8,
    goodwillNeed: 6,
    pactIntelNeed: 3,
    defense: 3,
    detectionMod: 0,
  },
  mirror: {
    id: 'mirror',
    name: '鏡面國',
    blurb: '所有窗戶都映出同一座小王城，地圖上的街道熟悉得過分。',
    controlNeed: 5,
    powerNeed: 3,
    warIntelNeed: 5,
    influenceNeed: 7,
    goodwillNeed: 5,
    pactIntelNeed: 5,
    defense: 4,
    detectionMod: -5,
  },
};

export type FrameId = 'match' | 'spool' | 'thimble';
export type HeadId = 'needle' | 'pepper' | 'feather';
export type DriveId = 'spring' | 'rubber' | 'bellows';

export interface WeaponPart {
  id: string;
  name: string;
  detail: string;
  cost: number;
  power: number;
  noise: number;
  agility: number;
}

export const FRAMES: Record<FrameId, WeaponPart> = {
  match: {
    id: 'match',
    name: '火柴框',
    detail: '輕巧的火柴骨，威力 +1、機動 +1。',
    cost: 1,
    power: 1,
    noise: 0,
    agility: 1,
  },
  spool: {
    id: 'spool',
    name: '線軸框',
    detail: '帶線軸的骨架，機動 +2，適合逃跑。',
    cost: 1,
    power: 0,
    noise: 0,
    agility: 2,
  },
  thimble: {
    id: 'thimble',
    name: '頂針框',
    detail: '頂針做成的重架，威力 +2、噪音 +1。',
    cost: 2,
    power: 2,
    noise: 1,
    agility: 0,
  },
};

export const HEADS: Record<HeadId, WeaponPart> = {
  needle: {
    id: 'needle',
    name: '繡花針',
    detail: '針尖只夠刺進大人的指甲縫，威力 +2。',
    cost: 2,
    power: 2,
    noise: 0,
    agility: 0,
  },
  pepper: {
    id: 'pepper',
    name: '胡椒囊',
    detail: '一點胡椒就能換一聲噴嚏，威力 +1、噪音 +1。',
    cost: 1,
    power: 1,
    noise: 1,
    agility: 0,
  },
  feather: {
    id: 'feather',
    name: '羽絨槌',
    detail: '對大人可能只是抓癢，噪音 -1、機動 +1。',
    cost: 1,
    power: 0,
    noise: -1,
    agility: 1,
  },
};

export const DRIVES: Record<DriveId, WeaponPart> = {
  spring: {
    id: 'spring',
    name: '發條',
    detail: '從玩具拆下的發條，威力 +2、噪音 +1。',
    cost: 2,
    power: 2,
    noise: 1,
    agility: 0,
  },
  rubber: {
    id: 'rubber',
    name: '橡皮筋',
    detail: '回彈快而安靜，威力 +1、機動 +1。',
    cost: 1,
    power: 1,
    noise: 0,
    agility: 1,
  },
  bellows: {
    id: 'bellows',
    name: '小風箱',
    detail: '吹氣推動，噪音 +1，本身不添威力。',
    cost: 1,
    power: 0,
    noise: 1,
    agility: 0,
  },
};

export interface DailyEvent {
  id: string;
  kind: 'good' | 'bad';
  text: string;
  food?: number;
  coins?: number;
  parts?: number;
  intel?: number;
  goodwill?: number;
  suspicion?: number;
  health?: number;
}

export const DAILY_EVENTS: readonly DailyEvent[] = [
  {
    id: 'kind-cobbler',
    kind: 'good',
    text: '好心的鞋匠看見了璿芃，只把一塊麵包皮推過來：「慢慢走。」',
    food: 2,
    goodwill: 1,
  },
  {
    id: 'kind-tailor',
    kind: 'good',
    text: '退休裁縫把線頭與鈕釦留給小人國，還指了一條不被看見的縫。',
    parts: 2,
    intel: 1,
  },
  {
    id: 'kind-lamplighter',
    kind: 'good',
    text: '守夜人願意替你保守祕密，還說出衛兵換崗的空隙。',
    intel: 2,
    goodwill: 1,
    suspicion: -1,
  },
  {
    id: 'kind-cook',
    kind: 'good',
    text: '廚娘以為你是來討食物的精靈，故意把餅乾屑掃到桌腳。',
    food: 3,
  },
  {
    id: 'bad-urchin',
    kind: 'bad',
    text: '壞蛋學徒拿杯子追著你罩，還順走了行囊裡的銀幣。',
    coins: -2,
    suspicion: 1,
  },
  {
    id: 'bad-cat',
    kind: 'bad',
    text: '宮廷貓一掌拍碎了掩護，璿芃在灰塵裡跌得發昏。',
    health: -1,
    suspicion: 1,
  },
  {
    id: 'bad-trap',
    kind: 'bad',
    text: '有人在牆腳放了捕鼠夾；你掙脫了，但留下了一小片衣角。',
    health: -1,
    parts: 1,
  },
  {
    id: 'bad-clerk',
    kind: 'bad',
    text: '書記官把所有失竊都記成「老鼠」，卻開始在夜裡撒下石灰。',
    suspicion: 2,
  },
];

export type EndingId =
  | 'war'
  | 'pact'
  | 'mirror'
  | 'deadline'
  | 'captive'
  | 'starvation'
  | 'aborted';

export const ENDING_NAMES: Record<EndingId, string> = {
  war: '征服',
  pact: '盟約',
  mirror: '鏡國',
  deadline: '逾期',
  captive: '俘虜',
  starvation: '斷糧',
  aborted: '收令',
};

export const ENDING_CAUSES: Record<EndingId, string> = {
  war: '城門終於承認小人國的旗幟。璿芃把國王召令釘在比自己還高的門上。',
  pact: '大人國簽下歸附盟約。沒有破城，但印章落下的聲音一樣像雷。',
  mirror: '塵土散開後，被攻陷的好像是自己的小人國：那面旗、那道牆，連璿芃的家都在裡面。',
  deadline: '第五十二週過去了，國王等不到攻陷的消息，召令在燭火裡捲了邊。',
  captive: '最後一次救援也沒有抵達。璿芃成了玻璃罐裡的「稀有老鼠」。',
  starvation: '行囊空了，最後一點體力也用完。遠征先輸給了肚子。',
  aborted: '璿芃主動收起召令，這一年在這裡中止。',
};
