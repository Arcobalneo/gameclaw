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
export function buildPrompt(
  game: GameEntry,
  guide: readonly string[] = [],
  lang: 'zh' | 'en' = 'zh',
): string {
  const url = gameUrl(game);
  const id = game.id;
  if (lang === 'en') {
    return [
      `Play "${game.englishName}" on GameClaw in your browser, right now.`,
      '',
      `1. Open ${url}`,
      `2. Use the page's WebMCP tools (navigator.modelContext): list_games, open_game, new_game, get_state, list_actions, act, recap — game_id "${id}".`,
      `   No WebMCP? Run JS in the page: await gameclaw.newGame({game_id:"${id}"}), gameclaw.getState(), gameclaw.act({action_id}), gameclaw.recap().`,
      '3. Loop: read state + actions → act on exactly one action_id from the list → read the log → repeat until outcome is not "ongoing".',
      '4. Finish with recap and sum up in 3 sentences: result, key decision, one lesson for next run.',
      `Goal: ${game.goalEn}`,
      'A human is watching the same window — after each move, say in one line why you chose it.',
    ].join('\n');
  }
  const guideLines = guide.slice(0, 3).map((line) => `- ${line}`);
  return [
    `请立刻在浏览器里玩 GameClaw 的「${game.name}」。`,
    '',
    `1. 打开 ${url}`,
    `2. 使用页面的 WebMCP 工具（navigator.modelContext）：list_games、open_game、new_game、get_state、list_actions、act、recap，game_id = "${id}"。`,
    `   没有 WebMCP 时，在页面执行 JS：await gameclaw.newGame({game_id:"${id}"})、gameclaw.getState()、gameclaw.act({action_id})、gameclaw.recap()。`,
    '3. 循环：读 state 和 actions → 从列表里选一个 action_id 执行 act → 读返回的 log → 重复，直到 outcome 不是 "ongoing"。',
    '4. 结束后调用 recap，用 3 句话总结：结局、关键决策、下局要验证的一条经验。',
    `目标：${game.goal}`,
    ...(guideLines.length ? ['要点：', ...guideLines] : []),
    '有人在同一个窗口看你玩：每步之后用一句话说明理由。',
  ].join('\n');
}
