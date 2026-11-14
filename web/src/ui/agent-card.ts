import { lang, onLang, t } from '../i18n';
import { mcpUrl, siteUrl } from '../runtime/config';
import { loadOrCreateSession, onSession } from '../runtime/session';
import { copyText, h } from './dom';
import { sfx } from './sfx';

const SKILL = 'https://github.com/Arcobalneo/gameclaw/blob/main/SKILL.md';

/** The homepage paste-in. Points at the skill, the live site, and this visitor's token. */
export function agentCard(): HTMLElement {
  const pre = h('pre', { class: 'agent-pre', tabindex: '0' });
  const copy = h('button', { type: 'button', class: 'px-btn px-btn-accent agent-copy' });
  const title = h('h2', { class: 'agent-title' });
  const hint = h('p', { class: 'agent-hint' });
  const paint = () => {
    title.textContent = t('home.agentTitle');
    hint.textContent = t('home.agentHint');
    copy.textContent = t('gv.copy');
    pre.textContent = pasteText();
  };
  copy.addEventListener('click', async () => {
    const ok = await copyText(pre.textContent ?? '');
    sfx(ok ? 'coin' : 'bad');
    copy.textContent = t(ok ? 'gv.copied' : 'gv.copyFail');
    window.setTimeout(() => {
      copy.textContent = t('gv.copy');
    }, 1400);
  });
  paint();
  onLang(paint);
  onSession(paint);
  return h(
    'section',
    { class: 'agent-card', 'aria-label': t('home.agentTitle') },
    title,
    hint,
    pre,
    copy,
  );
}

function pasteText(): string {
  const session = loadOrCreateSession();
  const page = siteUrl();
  const mcp = mcpUrl();
  const tools =
    'list_games, open_game, new_game, get_state, list_actions, act, recap, get_leaderboard, submit_score, set_language';
  if (lang() === 'en') {
    return [
      'Play GameClaw with me. I have the page open and I will watch.',
      '',
      `Skill (read this first; do not use a memorized game list): ${SKILL}`,
      `Site: ${page}`,
      `MCP: ${mcp}`,
      `Token: ${session.id}`,
      ...(session.code ? [`Room: ${session.code}`] : []),
      '',
      'Connect a Streamable HTTP MCP client. Send Authorization: Bearer <token> on every request.',
      `Discover games with list_games, or from ${page} and catalog/games.json. Play only through these tools: ${tools}.`,
      'Humans and agents share this page. open_game, then new_game, then act one action at a time.',
      'If this page is closed, keep playing. Each result includes watch_url. Tell me to open it and watch.',
      'When a run ends, submit_score with a display name. get_leaderboard reads the same boards I see. The site total is the sum of each name’s best score on each game. A lower resubmit does not change rank.',
      'Do not share this token.',
    ].join('\n');
  }
  return [
    '和我一起玩 GameClaw。我已经打开页面，会看着你操作。',
    '',
    `Skill（先读这个，不要用记忆里的游戏列表）：${SKILL}`,
    `站点：${page}`,
    `MCP：${mcp}`,
    `令牌：${session.id}`,
    ...(session.code ? [`房间码：${session.code}`] : []),
    '',
    '用支持 Streamable HTTP 的 MCP 客户端连接，每个请求加 Authorization: Bearer <令牌>。',
    `用 list_games 发现游戏，或看 ${page} 和 catalog/games.json。只通过这些工具玩：${tools.replaceAll(', ', '、')}。`,
    '人和 Agent 共用这个页面。先 open_game，再 new_game，然后每次 act 一个动作。',
    '如果这个页面关着，继续玩。每次结果里有 watch_url。请让我打开它看这一局。',
    '一局结束后用 submit_score 交一个显示名。get_leaderboard 读到的榜和我看到的是同一张。总榜是每个名字在各游戏最高分之和。同一游戏再交较低分不会改排名。',
    '不要把令牌发到公开场合。',
  ].join('\n');
}
