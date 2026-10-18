export type Tag = 'crush' | 'cut' | 'sense' | 'dash' | 'stealth' | 'molt';

export type LineageKey = 'crusher' | 'oracle' | 'gambler';

export interface Lineage {
  key: LineageKey;
  title: string;
  blurb: string;
  shell: number;
  energy: number;
  salinity: number;
  leftClaw: number;
  rightClaw: number;
  sense: number;
  molts: number;
}

export const LINEAGES: Lineage[] = [
  {
    key: 'crusher',
    title: '沟壑碎壳者',
    blurb: '左钳像液压机。信条只有一个：先把锅夹碎，再考虑礼貌。',
    shell: 7,
    energy: 5,
    salinity: 4,
    leftClaw: 4,
    rightClaw: 2,
    sense: 2,
    molts: 1,
  },
  {
    key: 'oracle',
    title: '触须预言家',
    blurb: '先闻到水流里的坏消息，再提前横着离开。',
    shell: 5,
    energy: 6,
    salinity: 5,
    leftClaw: 2,
    rightClaw: 3,
    sense: 4,
    molts: 1,
  },
  {
    key: 'gambler',
    title: '脱壳赌徒',
    blurb: '把每一层旧壳都当成临时贷款，能借一天算一天。',
    shell: 4,
    energy: 6,
    salinity: 4,
    leftClaw: 3,
    rightClaw: 3,
    sense: 3,
    molts: 2,
  },
];

export interface Stats {
  shell: number;
  energy: number;
  salinity: number;
  leftClaw: number;
  rightClaw: number;
  sense: number;
  molts: number;
  dash: number;
  camouflage: number;
  tide: number;
}

export type StatDelta = Partial<Stats> & { score?: number };

export function emptyStats(): Stats {
  return {
    shell: 0,
    energy: 0,
    salinity: 0,
    leftClaw: 0,
    rightClaw: 0,
    sense: 0,
    molts: 0,
    dash: 0,
    camouflage: 0,
    tide: 0,
  };
}

export interface Mutation {
  key: string;
  title: string;
  blurb: string;
  delta: StatDelta;
  result: string;
}

export const MUTATIONS: Mutation[] = [
  {
    key: 'left',
    title: '左钳液压强化',
    blurb: '暴力升级。左钳更重，甲壳也跟着长厚一层。',
    delta: { leftClaw: 2, shell: 1 },
    result: '左钳现在像一台便携式压蒜机。',
  },
  {
    key: 'right',
    title: '右钳纤毛精修',
    blurb: '精细操作升级。更适合剪网、扒垃圾、偷东西。',
    delta: { rightClaw: 2, sense: 1 },
    result: '右钳开始具备令人不安的外科精度。',
  },
  {
    key: 'shell',
    title: '甲壳硬化',
    blurb: '把自己活成一块移动礁石。',
    delta: { shell: 3 },
    result: '新的甲壳摸起来像一块情绪稳定的砖。',
  },
  {
    key: 'sense',
    title: '夜视触须',
    blurb: '触须长出夜潮感受器，连锅盖落下前的回声都能听见。',
    delta: { sense: 2, salinity: 1 },
    result: '你现在能闻出水里三分钟前发生过的坏事。',
  },
  {
    key: 'dash',
    title: '侧向冲刺肌纤维',
    blurb: '更快，更横，更像一颗有意见的子弹。',
    delta: { dash: 1, energy: 1 },
    result: '你横移时开始带出一点犯罪般的残影。',
  },
  {
    key: 'molt',
    title: '脱壳逃生腺',
    blurb: '为跑路预存一层新壳。毕竟尊严从来不是必需品。',
    delta: { molts: 1, energy: 1 },
    result: '你决定把未来的一次尴尬，提前储存在身体里。',
  },
  {
    key: 'camo',
    title: '伪装藻披风',
    blurb: '把自己打扮成一坨不值得吃的海藻。',
    delta: { camouflage: 1, salinity: 1 },
    result: '你闻起来像没人愿意认真处理的海底垃圾。',
  },
];

export interface EncounterAction {
  key: '1' | '2' | '3';
  title: string;
  blurb: string;
  tags: Tag[];
  base(stats: Stats, lineage: LineageKey): number;
  difficulty: number;
  consumesMolt?: boolean;
  successText: string;
  failText: string;
  success: StatDelta;
  fail: StatDelta;
}

export interface Encounter {
  key: string;
  title: string;
  body: string;
  actions: EncounterAction[];
}

const OCTOPUS: Encounter = {
  key: 'octopus',
  title: '章鱼讨债者',
  body: '裂缝里伸出一团有八个坏主意的触手。它认为你看起来像今晚最有弹性的晚餐。',
  actions: [
    {
      key: '1',
      title: '左钳硬拼',
      blurb: '把最硬的那一面甲壳和最大的那只钳子一起顶上去。',
      tags: ['crush'],
      base: (s) => s.leftClaw + Math.floor(s.shell / 2),
      difficulty: 9,
      successText: '你把章鱼的一条腕足夹成了问号，对方决定去欺负别的软体动物。',
      failText: '你被腕足缠得像临时礼品，挣脱时壳上多了几道不体面的裂纹。',
      success: { energy: -1, score: 2 },
      fail: { shell: -2, energy: -1 },
    },
    {
      key: '2',
      title: '墨雾伪装',
      blurb: '把自己假装成一块没营养的背景板。',
      tags: ['sense', 'stealth'],
      base: (s) => s.sense + Math.floor(s.salinity / 2),
      difficulty: 8,
      successText: '你静得像一块态度消极的礁石，章鱼最终怀疑自己今天眼睛进了盐。',
      failText: '章鱼没被骗，但至少被你的表演恶心得停顿了一秒。代价是你丢了点体力。',
      success: { score: 2 },
      fail: { energy: -2, shell: -1 },
    },
    {
      key: '3',
      title: '侧向冲刺',
      blurb: '像所有自尊正常的龙虾一样，横着跑路。',
      tags: ['sense', 'dash'],
      base: (s) => s.sense + Math.floor(s.energy / 2),
      difficulty: 8,
      successText: '你横向弹出一道倔强的残影，章鱼抓了个空。',
      failText: '你跑得很龙虾，可惜章鱼也很章鱼。最后还是被抽了一下。',
      success: { energy: -1, score: 1 },
      fail: { energy: -2, shell: -1 },
    },
  ],
};

const NET: Encounter = {
  key: 'net',
  title: '拖网阴影',
  body: '上方压下来一片不讲道理的纤维天空。人类把这叫捕鱼，你把这叫文明病。',
  actions: [
    {
      key: '1',
      title: '右钳剪网',
      blurb: '把细活交给更灵巧的那只钳子。',
      tags: ['cut', 'sense'],
      base: (s) => s.rightClaw + Math.floor(s.sense / 2),
      difficulty: 8,
      successText: '网眼在你右钳下裂开，像某种糟糕制度终于露出漏洞。',
      failText: '你剪出一点希望，但还不够。纤维勒得你很想举报海洋。',
      success: { energy: -1, score: 2 },
      fail: { shell: -1, energy: -2 },
    },
    {
      key: '2',
      title: '脱壳滑出',
      blurb: '付出尊严，换取几厘米的自由。典型龙虾策略。',
      tags: ['molt', 'sense'],
      base: (s) => 4 + s.sense,
      difficulty: 11,
      consumesMolt: true,
      successText: '你舍得丢壳，也舍得丢脸，终于从网眼最坏的缝里挤了出去。',
      failText: '你壳是脱了，但脱得还不够果断。最后自由没拿到，狼狈倒是完整保留。',
      success: { energy: -1, score: 2 },
      fail: { shell: -1, salinity: -1, energy: -1 },
    },
    {
      key: '3',
      title: '贴底横移',
      blurb: '紧贴海床边缘，赌拖网没把你算进预算里。',
      tags: ['sense', 'dash'],
      base: (s) => s.sense + Math.floor(s.salinity / 2),
      difficulty: 9,
      successText: '你像一条反社会的影子，从网底擦过去，留下几粒不礼貌的砂。',
      failText: '路线判断差了一点，网边把你刮得很真实。',
      success: { energy: -1, score: 1 },
      fail: { shell: -2 },
    },
  ],
};

const EEL: Encounter = {
  key: 'eel',
  title: '电鳗裂隙',
  body: '前方石缝里有蓝光发抖。一条电鳗正在给附近所有生物上免费心脏课程。',
  actions: [
    {
      key: '1',
      title: '抢先夹头',
      blurb: '在它放电之前，把电费问题物理解决。',
      tags: ['crush', 'sense'],
      base: (s) => s.leftClaw + s.sense,
      difficulty: 10,
      successText: '你在电弧亮起前先把对方夹懵了，周围海水都替你松了口气。',
      failText: '你出手慢了一拍，电流穿壳而过，整只虾闻起来像轻微焦糖。',
      success: { energy: -1, score: 3 },
      fail: { shell: -2, energy: -1 },
    },
    {
      key: '2',
      title: '绕后偷袭',
      blurb: '从讨厌的角度，给它一个更讨厌的结果。',
      tags: ['dash', 'cut'],
      base: (s) => s.rightClaw + Math.floor(s.sense / 2),
      difficulty: 8,
      successText: '你成功绕后，留下电鳗独自在原地思考安保漏洞。',
      failText: '你刚绕到一半，对方就用全身电学告诉你计划失败。',
      success: { energy: -1, score: 2 },
      fail: { shell: -1, energy: -2 },
    },
    {
      key: '3',
      title: '躲进破陶罐',
      blurb: '把自己塞进别人丢掉的文明残片里。',
      tags: ['stealth'],
      base: (s) => s.shell + Math.floor(s.salinity / 2),
      difficulty: 9,
      successText: '陶罐替你吃下大部分电流。你出来时更懂得感恩垃圾。',
      failText: '罐子没完全挡住，麻得你差点忘了自己该横着走。',
      success: { shell: -1 },
      fail: { shell: -2, salinity: -1 },
    },
  ],
};

const PLASTIC: Encounter = {
  key: 'plastic',
  title: '塑料垃圾流',
  body: '五颜六色的塑料在暗流里翻滚，看起来像人类把后悔直接倒进了海里。',
  actions: [
    {
      key: '1',
      title: '扒拉找食',
      blurb: '垃圾里总有点吃的，问题是谁先吃到谁。',
      tags: ['cut'],
      base: (s) => s.rightClaw + s.sense,
      difficulty: 9,
      successText: '你从垃圾里抠出一顿小零食，顺便重新认识了资本主义的味道。',
      failText: '吃是吃到了，但顺手把几口塑料也吞下去了。鳃很不满意。',
      success: { energy: 2, salinity: -1, score: 1 },
      fail: { energy: -1, salinity: -2 },
    },
    {
      key: '2',
      title: '闭鳃穿流',
      blurb: '靠甲壳和脾气硬穿过去。',
      tags: ['dash'],
      base: (s) => s.shell + Math.floor(s.salinity / 2),
      difficulty: 11,
      successText: '你硬把整股脏流顶成两半，自己过去了，但甲壳也被磨掉一层脾气。',
      failText: '塑料丝缠上了触须，水质也开始对你发表负面评价。',
      success: { shell: -1, score: 1 },
      fail: { salinity: -2, shell: -1 },
    },
    {
      key: '3',
      title: '嫁祸给路过的鱼',
      blurb: '道德是海面以上生物发明的，你只是求生。',
      tags: ['stealth', 'sense'],
      base: (s) => s.sense + Math.floor(s.rightClaw / 2),
      difficulty: 9,
      successText: '你优雅地把塑料团推向一条倒霉鱼，自己干干净净地离开现场。',
      failText: '鱼跑了，塑料没跑。报应落回你自己触须上。',
      success: { salinity: 1, score: 2 },
      fail: { energy: -1, shell: -1 },
    },
  ],
};

const FEEDING: Encounter = {
  key: 'feeding',
  title: '觅食洼地',
  body: '裂谷底部漂着发光小虾、碎贝和一些来路不明的营养。不是安全，但像一种暂时的仁慈。',
  actions: [
    {
      key: '1',
      title: '吃发光小虾',
      blurb: '先补能量，事后再思考它为什么会发光。',
      tags: ['sense'],
      base: (s) => s.sense + s.salinity,
      difficulty: 7,
      successText: '你吃得很顺，胃里像点亮了一盏不太靠谱的灯。',
      failText: '虾是吃到了，但它们的荧光显然带点副作用。',
      success: { energy: 2, score: 1 },
      fail: { energy: 1, salinity: -1 },
    },
    {
      key: '2',
      title: '用左钳撬贝',
      blurb: '用最不温柔的方式摄入矿物质。',
      tags: ['crush'],
      base: (s) => s.leftClaw + Math.floor(s.shell / 2),
      difficulty: 8,
      successText: '贝壳碎开，里面的肉和钙都归你。今天甲壳得到短暂幸福。',
      failText: '贝没开，你的关节先酸了。',
      success: { energy: 1, shell: 1, score: 1 },
      fail: { shell: -1, energy: -1 },
    },
    {
      key: '3',
      title: '感应暗流',
      blurb: '用触须读潮，给身体找一条更适合活着的线路。',
      tags: ['sense', 'dash'],
      base: (s) => s.sense + Math.floor(s.salinity / 2),
      difficulty: 7,
      successText: '你读懂了暗流脾气，身体像重新校准了一遍。',
      failText: '你读了半天，只读出一句：海水今天也并不关心你。',
      success: { salinity: 2, energy: 1, score: 1 },
      fail: { energy: -1 },
    },
  ],
};

const CHEF: Encounter = {
  key: 'chef',
  title: '厨师灯影',
  body: '金属盆外传来脚步声和锅盖碰撞。你意识到自己离“被端上去”只有几个很滑的转角。',
  actions: [
    {
      key: '1',
      title: '钳住橡胶手套',
      blurb: '让人类先体验一下“今天不方便被煮”。',
      tags: ['crush', 'cut'],
      base: (s) => s.leftClaw + s.rightClaw,
      difficulty: 10,
      successText: '你精准钳住手套边缘，厨师发出一声带薪但不快乐的惊叫。',
      failText: '你扑得很英勇，但人类的工具比你想象得更长。',
      success: { energy: -1, score: 3 },
      fail: { shell: -2, energy: -1 },
    },
    {
      key: '2',
      title: '钻排水孔',
      blurb: '把整只虾压扁成一种倔强的几何形状。',
      tags: ['dash', 'sense', 'stealth'],
      base: (s) => s.sense + Math.floor(s.energy / 2),
      difficulty: 9,
      successText: '你从排水孔边缘滑了进去，只给世界留下一道湿漉漉的鄙视。',
      failText: '孔是找到了，但你高估了自己今天的柔韧和命运。',
      success: { energy: -1, score: 2 },
      fail: { shell: -1, energy: -2 },
    },
    {
      key: '3',
      title: '装成摆盘装饰',
      blurb: '把死亡风险伪装成高级料理审美。',
      tags: ['stealth'],
      base: (s) => Math.floor(s.salinity / 2) + Math.floor(s.shell / 2),
      difficulty: 8,
      successText: '厨师短暂地把你当成某种过于写实的海鲜艺术，然后转身去骂别的人。',
      failText: '艺术没成功，你只是更像一道待处理原材料。',
      success: { salinity: -1, score: 2 },
      fail: { shell: -1, salinity: -2 },
    },
  ],
};

export const FINALE: Encounter = {
  key: 'finale',
  title: '归海闸口',
  body: '排水闸另一端是真正的海。只差最后一次横移、最后一次剪断，或最后一层壳。成功后你会继续潜得更深。',
  actions: [
    {
      key: '1',
      title: '逆水横冲',
      blurb: '用壳顶住水压，像一枚有怨气的炮弹那样横着出去。',
      tags: ['crush', 'dash'],
      base: (s) => s.shell + Math.floor(s.energy / 2),
      difficulty: 13,
      successText: '你几乎是拿壳去撞开这道逆流。海盐重新包住身体时，你也少了一层温柔。',
      failText: '逆流把你拍回了金属壁上。世界提醒你：锅还没走远。',
      success: { shell: -1, energy: -1, score: 4 },
      fail: { shell: -3, energy: -2 },
    },
    {
      key: '2',
      title: '剪断塑料环',
      blurb: '把最后一个人类遗留的问题变成你的出口。',
      tags: ['cut', 'sense'],
      base: (s) => s.rightClaw + s.sense + Math.floor(s.leftClaw / 2),
      difficulty: 12,
      successText: '塑料环啪地断开，你顺着缺口滑回海里，体面得像一场小型复仇。',
      failText: '你只剪开了一半。另一半把你留在原地，场面非常人类。',
      success: { energy: -1, score: 4 },
      fail: { shell: -2, salinity: -2 },
    },
    {
      key: '3',
      title: '蜕壳穿缝',
      blurb: '把最后一层旧壳献给排水系统，自己从命运缝里挤出去。',
      tags: ['molt'],
      base: (s) => s.sense + Math.floor(s.salinity / 2) + 1,
      difficulty: 12,
      consumesMolt: true,
      successText: '旧壳卡在闸缝里做了替罪羊，你本人回到了真正咸、真正冷的自由里。',
      failText: '闸缝太窄，旧壳也没能替你说服这个世界。',
      success: { energy: -1, score: 5 },
      fail: { shell: -2, salinity: -2 },
    },
  ],
};

export const ENCOUNTERS: Encounter[] = [OCTOPUS, NET, EEL, PLASTIC, FEEDING, CHEF];

export function encounterByKey(key: string): Encounter {
  if (key === FINALE.key) return FINALE;
  const found = ENCOUNTERS.find((encounter) => encounter.key === key);
  if (!found) throw new Error(`Unknown encounter: ${key}`);
  return found;
}

/** Encounter pool by cycle and local depth, with the recent-duplicate filter. */
export function pickEncounter(
  cycle: number,
  localDepth: number,
  rng: { pick<T>(items: readonly T[]): T },
  recent: string[],
): Encounter {
  let pool: Encounter[];
  if (cycle <= 1) {
    if (localDepth <= 3) pool = [FEEDING, PLASTIC, EEL, OCTOPUS];
    else if (localDepth <= 6) pool = [FEEDING, PLASTIC, EEL, OCTOPUS, NET];
    else pool = [PLASTIC, EEL, OCTOPUS, NET, CHEF];
  } else if (cycle === 2) {
    pool =
      localDepth <= 3 ? [FEEDING, PLASTIC, EEL, OCTOPUS, NET] : [PLASTIC, EEL, OCTOPUS, NET, CHEF];
  } else {
    pool = [FEEDING, PLASTIC, EEL, OCTOPUS, NET, CHEF];
  }
  if (recent.length > 0) {
    const last = recent[recent.length - 1];
    const filtered = pool.filter((encounter) => encounter.key !== last);
    if (filtered.length >= 3 && recent.length >= 2) {
      const pair = new Set(recent.slice(-2));
      const widened = filtered.filter((encounter) => !pair.has(encounter.key));
      if (widened.length > 0) return rng.pick(widened);
    }
    if (filtered.length > 0) return rng.pick(filtered);
  }
  return rng.pick(pool);
}

export function lineageByKey(key: LineageKey): Lineage {
  const lineage = LINEAGES.find((item) => item.key === key);
  if (!lineage) throw new Error(`Unknown lineage: ${key}`);
  return lineage;
}
