import catalogJson from '../../catalog/games.json';

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
  'shrimp-trek': {
    accent: '#ff7a59',
    ink: '#0b1430',
    goal: '选谱系后穿越潮段遭遇与归海闸口，活得越深名声越高。',
    goalEn: 'Pick a lineage, survive tide-cycle encounters and gates, dive as deep as you can.',
    tagZh: '潮水深处，一只虾要活下去。',
    tagEn: 'One shrimp, one tide. Survive the deep.',
  },
  'shrimp-guard': {
    accent: '#4fd1ff',
    ink: '#08182a',
    goal: '布置虾兵守住三条水道，撑过全部 pulse 不让归海线破防。',
    goalEn: 'Deploy shrimp defenders across three lanes and hold the sea line through every pulse.',
    tagZh: '三条水道，守住归海线。',
    tagEn: 'Three lanes. Hold the sea line.',
  },
  'shrimp-heist': {
    accent: '#b28dff',
    ink: '#120c26',
    goal: '潜入设施，找到真目标并带出出口，暴露值不能爆表。',
    goalEn: 'Infiltrate, find the true objective and extract before exposure maxes out.',
    tagZh: '潜入，得手，全身而退。',
    tagEn: 'Sneak in, grab it, get out.',
  },
  'shrimp-catch': {
    accent: '#5ee08f',
    ink: '#0a1d1a',
    goal: '探索、对战、捕捉虾宠，扩充图鉴并挑战深渊层数。',
    goalEn: 'Explore, battle and catch creatures; grow your dex and push the abyss floors.',
    tagZh: '捕捉虾宠，一路潜进深渊。',
    tagEn: 'Catch critters, dive the abyss.',
  },
  'shrimp-look': {
    accent: '#9fc4ff',
    ink: '#070a18',
    goal: '调查怪谈房间，记录足够证据并带着神智离开。',
    goalEn: 'Investigate anomalies, record enough evidence and leave with your nerve intact.',
    tagZh: '怪谈房间：记下异象再离开。',
    tagEn: 'Strange rooms. Record, then leave.',
  },
  'shrimp-rampage': {
    accent: '#ff9a2e',
    ink: '#160a1c',
    goal: '四夜之内收成 4 个南瓜并安抚 3 只南瓜怪。',
    goalEn: 'Within four nights harvest 4 pumpkins and soothe 3 pumpkin monsters.',
    tagZh: '四个夜晚，安抚南瓜怪。',
    tagEn: 'Four nights in the pumpkin patch.',
  },
  'shrimp-ink': {
    accent: '#e8c27a',
    ink: '#14100c',
    goal: '寻访线索、找到真遗址，写成书稿而不饿死。',
    goalEn: 'Chase leads, find the true ruin and finish the manuscript without starving.',
    tagZh: '一支笔，一卷书稿，一条远路。',
    tagEn: 'One brush, one manuscript, one road.',
  },
  'shrimp-greens': {
    accent: '#7ee07a',
    ink: '#0c160e',
    goal: '在十六席饭局里守住素食立场，同时别让身体与家人归零。',
    goalEn: 'Hold your vegetarian line across sixteen meals without breaking body or family.',
    tagZh: '十六顿饭，守住你的素食。',
    tagEn: 'Sixteen meals. Keep your plate green.',
  },
  'shrimp-conquest': {
    accent: '#ff5d73',
    ink: '#1a0a14',
    goal: '一年内选一个大人国，用战争或外交让它低头。',
    goalEn: 'Within one year, make a giant kingdom yield by war or diplomacy.',
    tagZh: '小人国使者，让巨人低头。',
    tagEn: 'A tiny envoy versus a giant kingdom.',
  },
  'shrimp-leap': {
    accent: '#7cf0a0',
    ink: '#0a1020',
    goal: '养成史莱姆，选力度/角度/时机跳过 45 关灯柱。',
    goalEn: 'Raise your slime and clear 45 lamp-post levels by choosing power, angle and timing.',
    tagZh: '史莱姆，一根灯柱接一根。',
    tagEn: 'A slime, a lamp post, a leap. Repeat.',
  },
  'shrimp-burger': {
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
  return GAMES.find((game) => game.id === id);
}
