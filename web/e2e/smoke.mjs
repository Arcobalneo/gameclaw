#!/usr/bin/env node
/**
 * Headless smoke test for the portal.
 *   node e2e/smoke.mjs [url] [--shots dir] [--games a,b]
 * Without a url it builds nothing: start `vite preview` yourself or pass a deployed URL.
 * Uses playwright-core with a system Chrome/Chromium (CHROME_PATH or common paths).
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const url = args.find((a) => /^https?:/.test(a)) ?? 'http://localhost:4173/gameclaw/';
const shotsIdx = args.indexOf('--shots');
const shots = shotsIdx >= 0 ? args[shotsIdx + 1] : null;
const gamesIdx = args.indexOf('--games');
const only = gamesIdx >= 0 ? args[gamesIdx + 1].split(',') : null;
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

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

const shot = async (name) => {
  if (shots) await page.screenshot({ path: path.join(shots, `${name}.png`) });
};

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.gameclaw && document.fonts.status === 'loaded');
await page.waitForTimeout(800);
await shot('00-home');

const list = await page.evaluate(() => window.gameclaw.listGames());
const ids = list.games.map((g) => g.id).filter((id) => !only || only.includes(id));
console.log(`webmcp mode: ${await page.evaluate(() => window.gameclaw.webmcp)}`);
const tools = await page.evaluate(() => document.modelContext?.getTools?.().map((t) => t.name) ?? []);
console.log(`tools: ${tools.join(', ')}`);

let failures = 0;
for (const [i, id] of ids.entries()) {
  // Human path: click the card, then play by keyboard.
  await page.click(`button.card[aria-label*="${list.games.find((g) => g.id === id).english_name}"]`);
  await page.waitForSelector('.gv:not([hidden]) .gv-action', { timeout: 15000 });
  await page.evaluate(() => window.gameclaw.newGame({ seed: 7 }));
  await page.waitForTimeout(200);
  for (let k = 0; k < 3; k += 1) {
    await page.keyboard.press('1');
    await page.waitForTimeout(150);
  }
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  // Agent path: WebMCP tool calls through document.modelContext, fallback to window.gameclaw.
  const agent = await page.evaluate(async (gameId) => {
    const mc = document.modelContext;
    const call = async (name, input) => {
      if (mc?.executeTool) {
        const tool = mc.getTools ? (await mc.getTools()).find((t) => t.name === name) : name;
        const raw = await mc.executeTool(tool ?? name, input);
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
      const map = { get_state: 'getState', act: 'act', list_actions: 'listActions', recap: 'recap' };
      return window.gameclaw[map[name]](input);
    };
    const moves = [];
    for (let k = 0; k < 4; k += 1) {
      const la = await call('list_actions', { game_id: gameId });
      if (!la.ok || !la.actions.length) break;
      const pick = la.actions[Math.min(la.actions.length - 1, k % 2)];
      if (pick.id === 'abort') break;
      const res = await call('act', { game_id: gameId, action_id: pick.id });
      moves.push(`${pick.id}:${res.ok ? 'ok' : res.code}`);
    }
    const st = await call('get_state', { game_id: gameId });
    return { moves, turn: st.state?.turn, headline: st.state?.headline };
  }, id);
  await page.waitForTimeout(700);
  await shot(`${String(i + 1).padStart(2, '0')}-${id}`);
  const ok = agent.turn >= 4 && agent.moves.every((m) => m.endsWith(':ok'));
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} turn=${agent.turn} moves=${agent.moves.join(' ')} | ${agent.headline}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
}

if (errors.length) {
  console.log(`errors (${errors.length}):\n${errors.slice(0, 20).join('\n')}`);
}
await browser.close();
process.exit(failures || errors.length ? 1 : 0);
