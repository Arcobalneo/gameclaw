/**
 * Typed UI dictionary. `ZH` is the source of truth; `EN` must provide every
 * key (a missing key is a compile error). No string in the UI is bilingual.
 */
export type Lang = 'zh' | 'en';

const ZH = {
  'site.title': 'GameClaw · 虾系游戏厅',
  'site.tagline': '11 款像素小游戏。你来玩，或交给你的 Agent。',
  'site.skip': '跳到游戏列表',
  'site.github': 'GitHub',
  'lang.label': '语言',
  'home.play': '开始',
  'home.open': '打开 {name}',
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
    '复制提示词给桌面 Agent，它通过远程 MCP 接入（Authorization: Bearer 令牌）。工具：list_games、open_game、new_game、get_state、list_actions、act、recap。同页的 WebMCP 或 window.gameclaw.* 仍然可用。',
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
  'site.tagline': '11 pixel games. Play them yourself, or hand them to your agent.',
  'site.skip': 'Skip to games',
  'site.github': 'GitHub',
  'lang.label': 'Language',
  'home.play': 'Play',
  'home.open': 'Open {name}',
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
    'Paste the prompt to a desktop agent; it connects over remote MCP (Authorization: Bearer token). Tools: list_games, open_game, new_game, get_state, list_actions, act, recap. In-page WebMCP and window.gameclaw.* still work.',
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
