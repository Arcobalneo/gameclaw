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
}

interface CatalogGame {
  id: string;
  name: string;
  englishName: string;
  tagline: string;
  summary: string;
  genres: string[];
}

const LOOK: Record<string, Pick<GameEntry, 'accent' | 'ink' | 'goal' | 'goalEn'>> = {
  'shrimp-trek': {
    accent: '#ff7a59',
    ink: '#0b1430',
    goal: '选谱系后穿越潮段遭遇与归海闸口，活得越深名声越高。',
    goalEn: 'Pick a lineage, survive tide-cycle encounters and gates, dive as deep as you can.',
  },
  'shrimp-guard': {
    accent: '#4fd1ff',
    ink: '#08182a',
    goal: '布置虾兵守住三条水道，撑过全部 pulse 不让归海线破防。',
    goalEn: 'Deploy shrimp defenders across three lanes and hold the sea line through every pulse.',
  },
  'shrimp-heist': {
    accent: '#b28dff',
    ink: '#120c26',
    goal: '潜入设施，找到真目标并带出出口，暴露值不能爆表。',
    goalEn: 'Infiltrate, find the true objective and extract before exposure maxes out.',
  },
  'shrimp-catch': {
    accent: '#5ee08f',
    ink: '#0a1d1a',
    goal: '探索、对战、捕捉虾宠，扩充图鉴并挑战深渊层数。',
    goalEn: 'Explore, battle and catch creatures; grow your dex and push the abyss floors.',
  },
  'shrimp-look': {
    accent: '#9fc4ff',
    ink: '#070a18',
    goal: '调查怪谈房间，记录足够证据并带着神智离开。',
    goalEn: 'Investigate anomalies, record enough evidence and leave with your nerve intact.',
  },
  'shrimp-rampage': {
    accent: '#ff9a2e',
    ink: '#160a1c',
    goal: '四夜之内收成 4 个南瓜并安抚 3 只南瓜怪。',
    goalEn: 'Within four nights harvest 4 pumpkins and soothe 3 pumpkin monsters.',
  },
  'shrimp-ink': {
    accent: '#e8c27a',
    ink: '#14100c',
    goal: '寻访线索、找到真遗址，写成书稿而不饿死。',
    goalEn: 'Chase leads, find the true ruin and finish the manuscript without starving.',
  },
  'shrimp-greens': {
    accent: '#7ee07a',
    ink: '#0c160e',
    goal: '在十六席饭局里守住素食立场，同时别让身体与家人归零。',
    goalEn: 'Hold your vegetarian line across sixteen meals without breaking body or family.',
  },
  'shrimp-conquest': {
    accent: '#ff5d73',
    ink: '#1a0a14',
    goal: '一年内选一个大人国，用战争或外交让它低头。',
    goalEn: 'Within one year, make a giant kingdom yield by war or diplomacy.',
  },
  'shrimp-leap': {
    accent: '#7cf0a0',
    ink: '#0a1020',
    goal: '养成史莱姆，选力度/角度/时机跳过 45 关灯柱。',
    goalEn: 'Raise your slime and clear 45 lamp-post levels by choosing power, angle and timing.',
  },
  'shrimp-burger': {
    accent: '#ffc24a',
    ink: '#1a100a',
    goal: '限时接料、控火候、赶害虫，送出足够份美味汉堡。',
    goalEn: 'Catch ingredients, manage heat, shoo pests and serve enough tasty burgers in time.',
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
    ...LOOK[game.id]!,
  }));

export function findGame(id: string): GameEntry | undefined {
  return GAMES.find((game) => game.id === id);
}
