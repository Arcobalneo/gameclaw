#!/usr/bin/env node
/**
 * End-to-end: a headless Chrome tab stays open, a remote MCP client acts,
 * and the page animates the move.
 *
 *   node e2e/relay.mjs [pageUrl] [--shots dir] [--relay http://127.0.0.1:8787]
 *
 * The page URL may already include ?relay=; otherwise --relay (or the default
 * local relay) is appended. Start the relay and the portal first, for example:
 *
 *   bun relay/src/node-server.ts
 *   pnpm --filter @gameclaw/web build && (cd web && npx vite preview --port 4173)
 *   node web/e2e/relay.mjs http://localhost:4173/gameclaw/ --shots /tmp/shots
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const pageUrl = args.find((a) => /^https?:/.test(a)) ?? 'http://localhost:4173/gameclaw/';
const shotsIdx = args.indexOf('--shots');
const shots = shotsIdx >= 0 ? args[shotsIdx + 1] : null;
const relayIdx = args.indexOf('--relay');
const relay = relayIdx >= 0 ? args[relayIdx + 1] : process.env.GAMECLAW_RELAY ?? 'http://127.0.0.1:8787';
const gameId = 'shrimp-leap';

const candidates = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.error('No Chrome found; set CHROME_PATH.');
  process.exit(2);
}
if (shots) fs.mkdirSync(shots, { recursive: true });

const target = new URL(pageUrl);
if (!target.searchParams.get('relay')) target.searchParams.set('relay', relay);

const mcp = `${relay.replace(/\/+$/, '')}/mcp`;

async function mcpCall(token, method, params, id = 1) {
  const res = await fetch(mcp, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

async function tool(token, name, args, id) {
  const result = await mcpCall(token, 'tools/call', { name, arguments: args }, id);
  return result.structuredContent ?? JSON.parse(result.content[0].text);
}

const browser = await chromium.launch({
  executablePath,
  args: ['--no-sandbox', '--use-gl=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

const shot = async (name) => {
  if (shots) await page.screenshot({ path: path.join(shots, `${name}.png`) });
};

await page.goto(target.toString(), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.gameclaw && document.fonts.status === 'loaded');
await page.waitForFunction(() => window.gameclaw.session().status === 'open', { timeout: 15_000 });
const session = await page.evaluate(() => window.gameclaw.session());
console.log(`session code=${session.code} status=${session.status} mcp=${session.mcp}`);
if (!session.id || !session.code) {
  console.error('FAIL no session token/code on the page');
  await browser.close();
  process.exit(1);
}

await shot('00-home-session');

const listed = await tool(session.id, 'list_games', {}, 2);
if (!listed.ok || !listed.games?.length) {
  console.error('FAIL list_games', listed);
  await browser.close();
  process.exit(1);
}

const opened = await tool(session.id, 'open_game', { game_id: gameId }, 3);
if (!opened.ok) {
  console.error('FAIL open_game', opened);
  await browser.close();
  process.exit(1);
}
await page.waitForSelector('.gv:not([hidden])', { timeout: 15_000 });
await shot('01-opened-by-agent');

const fresh = await tool(session.id, 'new_game', { game_id: gameId, seed: 7 }, 4);
if (!fresh.ok) {
  console.error('FAIL new_game', fresh);
  await browser.close();
  process.exit(1);
}
const firstTurn = fresh.state?.turn ?? 0;
const action = (fresh.actions ?? []).find((a) => a.id !== 'abort') ?? (await tool(session.id, 'list_actions', { game_id: gameId }, 5)).actions?.[0];
if (!action) {
  console.error('FAIL no legal action');
  await browser.close();
  process.exit(1);
}
const moved = await tool(session.id, 'act', { game_id: gameId, action_id: action.id }, 6);
if (!moved.ok) {
  console.error('FAIL act', moved);
  await browser.close();
  process.exit(1);
}

await page.waitForTimeout(800);
const ui = await page.evaluate(() => {
  const turn = document.querySelector('.gv-turn')?.textContent ?? '';
  const log = document.querySelector('.gv-log li.log-agent')?.textContent ?? '';
  const headline = document.querySelector('.gv-status')?.textContent ?? '';
  return { turn, log, headline, title: document.title };
});
await shot('02-agent-move');

const ok = moved.ok && (moved.state?.turn ?? 0) >= firstTurn && /agent|Agent/i.test(ui.log);
console.log(
  `${ok ? 'PASS' : 'FAIL'} remote MCP act ${action.id} → turn=${moved.state?.turn} ui="${ui.turn}" log=${JSON.stringify(ui.log)} | ${ui.headline}`,
);

if (errors.length) console.log(`errors (${errors.length}):\n${errors.slice(0, 20).join('\n')}`);
await browser.close();
process.exit(ok && !errors.length ? 0 : 1);
