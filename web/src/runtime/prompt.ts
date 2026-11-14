import type { GameEntry } from '../catalog';
import { mcpUrl as defaultMcpUrl, siteUrl } from './config';
import { loadOrCreateSession } from './session';

export const TOOL_NAMES = [
  'list_games',
  'open_game',
  'new_game',
  'get_state',
  'list_actions',
  'act',
  'recap',
  'get_leaderboard',
  'submit_score',
  'set_language',
] as const;

export interface PromptContext {
  mcpUrl?: string;
  token?: string;
  code?: string | null;
  pageUrl?: string;
}

/** Copy-paste prompt: a desktop agent connects to the remote MCP with this token. */
export function buildPrompt(
  game: GameEntry,
  guide: readonly string[] = [],
  lang: 'zh' | 'en' = 'zh',
  ctx: PromptContext = {},
): string {
  const session = ctx.token ? { id: ctx.token, code: ctx.code ?? null } : loadOrCreateSession();
  const token = ctx.token ?? session.id;
  const code = ctx.code !== undefined ? ctx.code : session.code;
  const mcp = ctx.mcpUrl ?? defaultMcpUrl();
  const page =
    ctx.pageUrl ?? (typeof window !== 'undefined' ? `${siteUrl()}#/play/${game.id}` : '');
  const id = game.id;
  const tools =
    'list_games, open_game, new_game, get_state, list_actions, act, recap, get_leaderboard, submit_score';

  if (lang === 'en') {
    return [
      `Play "${game.englishName}" on GameClaw over remote MCP. I already have the page open and will watch.`,
      '',
      `MCP: ${mcp}`,
      `Token: ${token}`,
      ...(code ? [`Room: ${code}`] : []),
      page ? `Page: ${page}` : '',
      '',
      '1. Connect a Streamable HTTP MCP client to the MCP URL. Send Authorization: Bearer <token> on every request.',
      `2. Tools: ${tools}. game_id "${id}".`,
      '3. Loop: open_game or new_game → read state + actions → act on exactly one action_id → read the log → repeat until outcome is not "ongoing".',
      '4. Finish with recap. If the run was won or lost, call submit_score with a display name. get_leaderboard reads this game and the site total.',
      '5. Sum up in 3 sentences: result, key decision, one lesson for next run.',
      `Goal: ${game.goalEn}`,
      `Scoring: ${game.scoreEn}`,
      'After each move, say in one line why you chose it.',
      'If no browser is connected, keep playing. Tell me to open watch_url from the tool result so I can watch.',
      'Do not share this token publicly.',
    ]
      .filter((line, i, arr) => line !== '' || arr[i - 1] !== '')
      .join('\n')
      .trim();
  }

  const guideLines = guide.slice(0, 3).map((line) => `- ${line}`);
  return [
    `请通过远程 MCP 玩 GameClaw 的「${game.name}」。我已经打开了页面，会看着你玩。`,
    '',
    `MCP：${mcp}`,
    `令牌：${token}`,
    ...(code ? [`房间码：${code}`] : []),
    page ? `页面：${page}` : '',
    '',
    '1. 用支持 Streamable HTTP 的 MCP 客户端连接上述 MCP 地址，每个请求加 Authorization: Bearer <令牌>。',
    `2. 工具：${tools.replaceAll(', ', '、')}。game_id = "${id}"。`,
    '3. 循环：open_game 或 new_game → 读 state 和 actions → 从列表里选一个 action_id 执行 act → 读返回的 log → 重复，直到 outcome 不是 "ongoing"。',
    '4. 结束后调用 recap。胜或负时用 submit_score 交一个显示名。get_leaderboard 读取本局榜和总榜。',
    '5. 用 3 句话总结：结局、关键决策、下局要验证的一条经验。',
    `目标：${game.goal}`,
    `计分：${game.scoreZh}`,
    ...(guideLines.length ? ['要点：', ...guideLines] : []),
    '每步之后用一句话说明理由。',
    '如果页面没连上，继续玩。把结果里的 watch_url 发给我，我打开就能看。',
    '不要把令牌发到公开场合。',
  ]
    .filter((line, i, arr) => line !== '' || arr[i - 1] !== '')
    .join('\n')
    .trim();
}
