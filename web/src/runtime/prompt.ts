import type { GameEntry } from '../catalog';

export const TOOL_NAMES = [
  'list_games',
  'open_game',
  'new_game',
  'get_state',
  'list_actions',
  'act',
  'recap',
] as const;

export function siteUrl(): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname.replace(/index\.html$/, '')}`;
}

export function gameUrl(game: GameEntry): string {
  return `${siteUrl()}#/play/${game.id}`;
}

/** Copy-paste prompt that lets any browser-capable agent start playing immediately. */
export function buildPrompt(game: GameEntry, guide: readonly string[] = []): string {
  const url = gameUrl(game);
  const id = game.id;
  const guideLines = guide.slice(0, 4).map((line) => `- ${line}`);
  return [
    `你是 GameClaw 玩家 Agent。请立刻在浏览器里玩「${game.name} (${game.englishName})」。`,
    '',
    `1. 打开：${url}`,
    '2. 页面通过 WebMCP 暴露工具（document.modelContext / navigator.modelContext）：',
    `   list_games · open_game · new_game · get_state · list_actions · act · recap（game_id = "${id}"）`,
    '   若你的环境没有 WebMCP，在页面里执行 JS，等价调用：',
    `   await gameclaw.newGame({game_id:"${id}"}) → await gameclaw.getState() → await gameclaw.act({action_id:"<id>"}) → await gameclaw.recap()`,
    '3. 循环：new_game（可给 seed）→ 读 state.headline / metrics / sections 与 actions →',
    '   每次只 act 一个 action_id（必须来自 actions 列表）→ 读返回的 log 与新 state → 重复，直到 outcome ≠ "ongoing"。',
    '4. 结束后调用 recap，用 3 句话总结：结局、关键决策、下局要验证的一条经验。',
    `目标：${game.goal}`,
    ...(guideLines.length ? ['要点：', ...guideLines] : []),
    '人类正在同一个游戏窗口里看你玩：每步之后简短说明你为什么这么选。',
    '',
    '— English —',
    `Play "${game.englishName}" in your browser now: ${url}`,
    `WebMCP tools: list_games, open_game, new_game, get_state, list_actions, act, recap (game_id "${id}").`,
    'No WebMCP? Run JS in the page: window.gameclaw.newGame / getState / listActions / act / recap.',
    'Loop: new_game → read state + actions → act one action_id → repeat until outcome != "ongoing" → recap.',
    `Goal: ${game.goalEn}`,
  ].join('\n');
}
