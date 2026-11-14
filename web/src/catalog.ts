import catalogJson from '../../catalog/games.json';
import { canonicalGameId } from '../../relay/src/games';

/**
 * Static game metadata for the home grid. Engines + renderers are lazy chunks
 * under `src/games/<id>.ts`; this file must stay tiny.
 */
export interface GameEntry {
  id: string;
  name: string;
  englishName: string;
  tagline: string;
  summary: string;
  genres: string[];
  /** Accent colour for cards and window chrome. */
  accent: string;
  /** Dark base colour for cards. */
  ink: string;
  /** One-line goal used in agent prompts (Chinese). */
  goal: string;
  goalEn: string;
  /** Short card taglines. */
  tagZh: string;
  tagEn: string;
  /** Documented ladder rule. */
  scoreZh: string;
  scoreEn: string;
}

interface CatalogGame {
  id: string;
  name: string;
  englishName: string;
  tagline: string;
  summary: string;
  genres: string[];
  score?: { zh: string; en: string };
}

const LOOK: Record<
  string,
  Pick<GameEntry, 'accent' | 'ink' | 'goal' | 'goalEn' | 'tagZh' | 'tagEn'>
> = {
  'claw-trek': {
    accent: '#ff7a59',
    ink: '#0b1430',
    goal: '选谱系后穿越潮段遭遇与归海闸口，活得越深名声越高。',
    goalEn: 'Pick a lineage, survive tide-cycle encounters and gates, dive as deep as you can.',
    tagZh: '潮水深处，一只虾要活下去。',
    tagEn: 'One shrimp, one tide. Survive the deep.',
  },
  'claw-guard': {
    accent: '#4fd1ff',
    ink: '#08182a',
    goal: '布置虾兵守住三条水道，撑过全部 pulse 不让归海线破防。',
    goalEn: 'Deploy shrimp defenders across three lanes and hold the sea line through every pulse.',
    tagZh: '三条水道，守住归海线。',
    tagEn: 'Three lanes. Hold the sea line.',
  },
  'claw-heist': {
    accent: '#b28dff',
    ink: '#120c26',
    goal: '潜入设施，找到真目标并带出出口，暴露值不能爆表。',
    goalEn: 'Infiltrate, find the true objective and extract before exposure maxes out.',
    tagZh: '潜入，得手，全身而退。',
    tagEn: 'Sneak in, grab it, get out.',
  },
  'claw-catch': {
    accent: '#5ee08f',
    ink: '#0a1d1a',
    goal: '探索、对战、捕捉虾宠，扩充图鉴并挑战深渊层数。',
    goalEn: 'Explore, battle and catch creatures; grow your dex and push the abyss floors.',
    tagZh: '捕捉虾宠，一路潜进深渊。',
    tagEn: 'Catch critters, dive the abyss.',
  },
  'claw-look': {
    accent: '#9fc4ff',
    ink: '#070a18',
    goal: '调查怪谈房间，记录足够证据并带着神智离开。',
    goalEn: 'Investigate anomalies, record enough evidence and leave with your nerve intact.',
    tagZh: '怪谈房间：记下异象再离开。',
    tagEn: 'Strange rooms. Record, then leave.',
  },
  'claw-rampage': {
    accent: '#ff9a2e',
    ink: '#160a1c',
    goal: '四夜之内收成 4 个南瓜并安抚 3 只南瓜怪。',
    goalEn: 'Within four nights harvest 4 pumpkins and soothe 3 pumpkin monsters.',
    tagZh: '四个夜晚，安抚南瓜怪。',
    tagEn: 'Four nights in the pumpkin patch.',
  },
  'claw-ink': {
    accent: '#e8c27a',
    ink: '#14100c',
    goal: '寻访线索、找到真遗址，写成书稿而不饿死。',
    goalEn: 'Chase leads, find the true ruin and finish the manuscript without starving.',
    tagZh: '一支笔，一卷书稿，一条远路。',
    tagEn: 'One brush, one manuscript, one road.',
  },
  'claw-greens': {
    accent: '#7ee07a',
    ink: '#0c160e',
    goal: '在十六席饭局里守住素食立场，同时别让身体与家人归零。',
    goalEn: 'Hold your vegetarian line across sixteen meals without breaking body or family.',
    tagZh: '十六顿饭，守住你的素食。',
    tagEn: 'Sixteen meals. Keep your plate green.',
  },
  'claw-conquest': {
    accent: '#ff5d73',
    ink: '#1a0a14',
    goal: '一年内选一个大人国，用战争或外交让它低头。',
    goalEn: 'Within one year, make a giant kingdom yield by war or diplomacy.',
    tagZh: '小人国使者，让巨人低头。',
    tagEn: 'A tiny envoy versus a giant kingdom.',
  },
  'claw-leap': {
    accent: '#7cf0a0',
    ink: '#0a1020',
    goal: '养成史莱姆，选力度/角度/时机跳过 45 关灯柱。',
    goalEn: 'Raise your slime and clear 45 lamp-post levels by choosing power, angle and timing.',
    tagZh: '史莱姆，一根灯柱接一根。',
    tagEn: 'A slime, a lamp post, a leap. Repeat.',
  },
  'claw-burger': {
    accent: '#ffc24a',
    ink: '#1a100a',
    goal: '限时接料、控火候、赶害虫，送出足够份美味汉堡。',
    goalEn: 'Catch ingredients, manage heat, shoo pests and serve enough tasty burgers in time.',
    tagZh: '接住天上掉的汉堡料。',
    tagEn: 'Catch falling fixings. Serve it hot.',
  },
  'claw-stamp': {
    accent: '#ffc24a',
    ink: '#140e08',
    goal: '十二张夜渡里放行够数，擦边盖章要记过。',
    goalEn: 'Approve enough night-ferry passes. Stamping an edge guest is a strike.',
    tagZh: '夜渡窗口，盖章或拒签。',
    tagEn: 'A night ferry. Stamp or refuse.',
  },
  'claw-melt': {
    accent: '#ff8a5c',
    ink: '#14080c',
    goal: '把壳落入潮井，左右合成，别把井口堵住。',
    goalEn: 'Drop shells into the tide well, melt them side by side, and do not plug a column.',
    tagZh: '六列潮井，顶壳会被推走。',
    tagEn: 'Six columns. The tide pushes the tops.',
  },
  'claw-net': {
    accent: '#7ec8ff',
    ink: '#06141c',
    goal: '补住破洞，在网破之前把鱼收到定额。',
    goalEn: 'Tie the tears and haul a full basket before the net rips.',
    tagZh: '补网，赶在裂开前收鱼。',
    tagEn: 'Mend the net. Haul before it rips.',
  },
  'claw-beat': {
    accent: '#ff5d73',
    ink: '#160810',
    goal: '改一句四拍的短语，五轮内把对方打到零。',
    goalEn: 'Rewrite a four-beat phrase and drop the opponent to zero within five rounds.',
    tagZh: '四拍一句，每轮只改两拍。',
    tagEn: 'Four beats. Two edits a round.',
  },
  'claw-count': {
    accent: '#ffc24a',
    ink: '#101820',
    goal: '用一个数字走完桥，改数很少，磁铁更少。',
    goalEn: 'Cross the bridge with one number. Changes are scarce, and so are magnets.',
    tagZh: '一个数字，决定哪块板还在。',
    tagEn: 'One number. The planks appear or vanish.',
  },
  'claw-mask': {
    accent: '#c49aff',
    ink: '#120818',
    goal: '滑动三格面罩，踩上当前可见的那一层。',
    goalEn: 'Slide a three-cell mask and step on whichever layer is showing.',
    tagZh: '面罩盖住的地方看墨层。',
    tagEn: 'The mask shows the ink layer.',
  },
  'claw-clock': {
    accent: '#ff5d73',
    ink: '#160810',
    goal: '转环，让指针吃掉敌，别吃到珠和自己。',
    goalEn: 'Turn the ring so the hand eats foes, not gems or you.',
    tagZh: '先转环，指针再吃下一格。',
    tagEn: 'Turn the ring. Then the hand eats.',
  },
  'claw-flip': {
    accent: '#7ee0a0',
    ink: '#081410',
    goal: '拨一次开关，所有板和空对调。石头只能跳。',
    goalEn: 'One flip swaps every plate and gap. Stones can only be hopped.',
    tagZh: '一拨，板和空对调。',
    tagEn: 'One flip. Plates and gaps trade places.',
  },
  'claw-round': {
    accent: '#7ec8ff',
    ink: '#081018',
    goal: '六拍内把闸门要的两样装进袋。',
    goalEn: 'Pocket the two items the gate asks for before six beats.',
    tagZh: '潮退之后，只有袋子里的留下。',
    tagEn: 'After the tide, only the pocket remains.',
  },
  'claw-coil': {
    accent: '#8fd48a',
    ink: '#08140c',
    goal: '把箱子推进坞，别撞墙。',
    goalEn: 'Push the crate onto the dock without hitting a wall.',
    tagZh: '头走一格，尾巴补上。',
    tagEn: 'The head steps. The tail follows.',
  },
  'claw-sum': {
    accent: '#c49aff',
    ink: '#140818',
    goal: '把数字正好拉到目标。',
    goalEn: 'Pull the number until it matches the target.',
    tagZh: '正好相等才过釜。',
    tagEn: 'Only an exact match clears the kettle.',
  },
  'claw-berth': {
    accent: '#6ec8e0',
    ink: '#081018',
    goal: '把货装满，危货不要挨着。',
    goalEn: 'Fill the quota. Keep hazard ships apart.',
    tagZh: '吃水不能超过水深。',
    tagEn: 'Draft cannot exceed the berth.',
  },
  'claw-delve': {
    accent: '#e0b050',
    ink: '#140c08',
    goal: '挖够矿。离开没撑的层会塌。',
    goalEn: 'Fill the ore quota. An unbraced layer falls when you leave it.',
    tagZh: '横挖不塌。下挖才离开这一层。',
    tagEn: 'Sideways does not fall. Down leaves the layer.',
  },
  'claw-fair': {
    accent: '#ff9a4a',
    ink: '#1a0c08',
    goal: '把钱攒够。客人记得昨天的价钱。',
    goalEn: "Fill the till. Customers remember yesterday's price.",
    tagZh: '加价一次只能加一。',
    tagEn: 'A raise is only one.',
  },
  'claw-reef': {
    accent: '#6ec8e0',
    ink: '#041018',
    goal: '潮推完之后，还站在标上。海胆要下锚。',
    goalEn: 'Still be standing on the mark after the tide pushes. Anchor an urchin.',
    tagZh: '先走，潮再推。海胆要下锚。',
    tagEn: 'Step, then the tide pushes. Anchor an urchin.',
  },
  'claw-lamp': {
    accent: '#ffb45a',
    ink: '#100c18',
    goal: '立灯照亮水洼。最亮的柱常常挡住封滩。',
    goalEn: 'Light the pools. The widest post often blocks the seal.',
    tagZh: '灯笼不能互相看见。',
    tagEn: 'Lanterns must not see each other.',
  },
  'claw-raft': {
    accent: '#e8a05a',
    ink: '#1a1020',
    goal: '把箱子放进左舷、中舱或右舷。放错一侧，下一阵会再偏。',
    goalEn: 'Stash each crate. The wrong side leans the next gust.',
    tagZh: '偏重的一侧会落水。',
    tagEn: 'The heavy side dumps.',
  },
  'claw-stow': {
    accent: '#d8a868',
    ink: '#140e08',
    goal: '按单据取出正确的一格。来不及的那箱才贴标签。',
    goalEn: 'Pull the bay the slip names. Mark the crate that would spoil.',
    tagZh: '先看后三张，再决定贴不贴。',
    tagEn: 'Read three slips, then decide on a mark.',
  },
  'claw-glass': {
    accent: '#c8e4ff',
    ink: '#080c18',
    goal: '转动镜子，让月光束照到神龛。',
    goalEn: 'Turn the mirrors so the moonbeam hits the shrine.',
    tagZh: '三面镜子，一道月光束。',
    tagEn: 'Three mirrors. One moonbeam.',
  },
};

export const GAMES: readonly GameEntry[] = (catalogJson.games as CatalogGame[])
  .filter((game) => LOOK[game.id])
  .map((game) => ({
    id: game.id,
    name: game.name,
    englishName: game.englishName,
    tagline: game.tagline,
    summary: game.summary,
    genres: game.genres,
    scoreZh: game.score?.zh ?? '',
    scoreEn: game.score?.en ?? '',
    ...LOOK[game.id]!,
  }));

export function gameName(game: GameEntry, l: 'zh' | 'en'): string {
  return l === 'zh' ? game.name : game.englishName;
}

export function gameTag(game: GameEntry, l: 'zh' | 'en'): string {
  return l === 'zh' ? game.tagZh : game.tagEn;
}

export function findGame(id: string): GameEntry | undefined {
  const canon = canonicalGameId(id);
  return GAMES.find((game) => game.id === canon);
}
