/**
 * Typed UI dictionary. `ZH` is the source of truth; `EN` must provide every
 * key (a missing key is a compile error). No string in the UI is bilingual.
 */
export type Lang = 'zh' | 'en';

const ZH = {
  'site.title': 'GameClaw · 虾系游戏厅',
  'site.tagline': '人和 Agent 玩同一局。你看着，或者你自己上手。',
  'site.skip': '跳到游戏列表',
  'site.github': 'GitHub',
  'lang.label': '语言',
  'home.play': '开始',
  'home.open': '打开 {name}',
  'home.agentTitle': '交给你的 Agent',
  'home.agentHint': '复制下面这一段。Agent 用你的令牌连上远程 MCP，你在这个页面里看。',
  'home.boardTitle': '总榜',
  'home.boardRule':
    '每个名字在每款游戏只留最高分。总榜是这些最高分之和。同一局交两次无效；再交较低分不改排名。',
  'win.tabs': '已打开的游戏',
  'win.loading': '载入中',
  'win.new': '新局',
  'win.sound': '音效',
  'win.fullscreen': '全屏',
  'win.help': '帮助',
  'win.close': '关闭',
  'win.closeGame': '关闭 {name}',
  'gv.canvas': '{name} 游戏画面',
  'gv.actions': '行动',
  'gv.log': '记录',
  'gv.turn': '回合 {n}',
  'gv.seed': '种子 {n}',
  'gv.agent': 'Agent 操作中',
  'gv.again': '再来一局',
  'gv.prompt': 'Agent 提示词',
  'gv.promptHint': '复制给你的桌面 Agent。它通过远程 MCP 下棋，你在这个窗口里看。',
  'gv.copy': '复制',
  'gv.copied': '已复制',
  'gv.copyFail': '复制失败',
  'gv.preview': '预览',
  'gv.noActions': '本局已结束',
  'help.title': '怎么玩',
  'help.goal': '目标',
  'help.keys': '操作',
  'help.keysBody':
    '点击行动或画面 · 1–9 直接选择 · ↑↓ / WASD 切换 · Enter 确认 · N 新局 · M 静音 · F 全屏 · Esc 关闭',
  'help.details': '局面',
  'help.agent': 'Agent 接入',
  'help.agentBody':
    '复制提示词给桌面 Agent，它通过远程 MCP 接入（Authorization: Bearer 令牌）。工具：list_games、open_game、new_game、get_state、list_actions、act、recap、get_leaderboard、submit_score、set_language。同页的 WebMCP 或 window.gameclaw.* 仍然可用。',
  'help.score': '计分',
  'board.title': '本局榜',
  'board.empty': '还没有成绩',
  'board.name': '显示名',
  'board.submit': '交分',
  'board.points': '天梯分 {n}',
  'board.best': '已是最高 {n}',
  'board.posted': '已上榜 {n}',
  'board.needName': '先写一个显示名',
  'board.unfinished': '这局还不能交分',
  'risk.low': '稳',
  'risk.medium': '险',
  'risk.high': '危',
  'outcome.ongoing': '进行中',
  'outcome.won': '胜利',
  'outcome.lost': '失败',
  'outcome.aborted': '已中止',
  'banner.won': '胜利',
  'banner.lost': '失败',
  'banner.aborted': '中止',
  'who.agent': 'Agent',
  'who.human': '你',
  'who.system': '系统',
  'session.code': '房间码',
  'session.copy': '复制房间码 {code}',
  'session.copied': '已复制房间码 {code}',
  'session.copyFail': '复制失败',
  'session.join': '输入房间码',
  'session.joinHint': '在另一台设备打开同一个房间',
  'session.joinBad': '找不到这个房间码',
  'session.reconnecting': '连接已断开，正在重连…',
  'action.abort': '放弃本局',
  'stats.played': '{n} 人已玩过',
  'stats.site': '{n} 人已玩过',
} as const;

export type MsgKey = keyof typeof ZH;

const EN: Record<MsgKey, string> = {
  'site.title': 'GameClaw',
  'site.tagline': 'Humans and agents share one run. Watch, or play it yourself.',
  'site.skip': 'Skip to games',
  'site.github': 'GitHub',
  'lang.label': 'Language',
  'home.play': 'Play',
  'home.open': 'Open {name}',
  'home.agentTitle': 'Paste this to your agent',
  'home.agentHint': 'Copy the block. Your agent connects with your token; you watch this page.',
  'home.boardTitle': 'Site board',
  'home.boardRule':
    'Each name keeps its best score per game. The site board sums those bests. The same run cannot be sent twice, and a lower resubmit does not change rank.',
  'win.tabs': 'Open games',
  'win.loading': 'Loading',
  'win.new': 'New run',
  'win.sound': 'Sound',
  'win.fullscreen': 'Fullscreen',
  'win.help': 'Help',
  'win.close': 'Close',
  'win.closeGame': 'Close {name}',
  'gv.canvas': '{name} game view',
  'gv.actions': 'Actions',
  'gv.log': 'Log',
  'gv.turn': 'Turn {n}',
  'gv.seed': 'Seed {n}',
  'gv.agent': 'Agent playing',
  'gv.again': 'Play again',
  'gv.prompt': 'Agent prompt',
  'gv.promptHint':
    'Paste this to your desktop agent. It plays over remote MCP; you watch in this window.',
  'gv.copy': 'Copy',
  'gv.copied': 'Copied',
  'gv.copyFail': 'Copy failed',
  'gv.preview': 'Preview',
  'gv.noActions': 'Run finished',
  'help.title': 'How to play',
  'help.goal': 'Goal',
  'help.keys': 'Controls',
  'help.keysBody':
    'Click an action or the scene · 1–9 pick · ↑↓ / WASD move · Enter confirm · N new run · M mute · F fullscreen · Esc close',
  'help.details': 'Situation',
  'help.agent': 'For agents',
  'help.agentBody':
    'Paste the prompt to a desktop agent; it connects over remote MCP (Authorization: Bearer token). Tools: list_games, open_game, new_game, get_state, list_actions, act, recap, get_leaderboard, submit_score, set_language. In-page WebMCP and window.gameclaw.* still work.',
  'help.score': 'Scoring',
  'board.title': 'This game',
  'board.empty': 'No scores yet',
  'board.name': 'Name',
  'board.submit': 'Submit',
  'board.points': 'Ladder {n}',
  'board.best': 'Best is {n}',
  'board.posted': 'Posted {n}',
  'board.needName': 'Enter a display name',
  'board.unfinished': 'This run cannot be submitted',
  'risk.low': 'Safe',
  'risk.medium': 'Risky',
  'risk.high': 'Danger',
  'outcome.ongoing': 'In progress',
  'outcome.won': 'Victory',
  'outcome.lost': 'Defeat',
  'outcome.aborted': 'Aborted',
  'banner.won': 'VICTORY',
  'banner.lost': 'DEFEAT',
  'banner.aborted': 'ABORTED',
  'who.agent': 'Agent',
  'who.human': 'You',
  'who.system': 'System',
  'session.code': 'Room',
  'session.copy': 'Copy room code {code}',
  'session.copied': 'Copied room code {code}',
  'session.copyFail': 'Copy failed',
  'session.join': 'Enter room code',
  'session.joinHint': 'Open the same room on another device',
  'session.joinBad': 'That room code was not found',
  'session.reconnecting': 'Connection lost, reconnecting…',
  'action.abort': 'Abort run',
  'stats.played': '{n} have played',
  'stats.site': '{n} have played',
};

const DICTS: Record<Lang, Record<MsgKey, string>> = { zh: ZH, en: EN };
const STORAGE_KEY = 'gameclaw:lang';

function detect(): Lang {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    /* private mode */
  }
  const nav = (
    globalThis.navigator?.languages?.[0] ??
    globalThis.navigator?.language ??
    'zh'
  ).toLowerCase();
  return nav.startsWith('zh') ? 'zh' : 'en';
}

let current: Lang = detect();
const listeners = new Set<(lang: Lang) => void>();

export function lang(): Lang {
  return current;
}

export function setLang(next: Lang): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  if (next === current) return;
  current = next;
  if (typeof document !== 'undefined')
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
  for (const fn of listeners) fn(next);
}

export function onLang(fn: (lang: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(key: MsgKey, vars?: Record<string, string | number>): string {
  const raw = DICTS[current][key];
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : raw;
}

/** Test helper: dictionary for a given language. */
export function dict(l: Lang): Readonly<Record<MsgKey, string>> {
  return DICTS[l];
}
