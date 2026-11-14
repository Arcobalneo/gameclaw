// Dev tool: capture clean 384x216 cover frames from the real scenes into public/covers/.
// Usage: node e2e/covers.mjs [--url http://localhost:5173/gameclaw/] [--only id]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const url = arg('url', 'http://localhost:5173/gameclaw/');
const only = arg('only', '');
const out = path.resolve(import.meta.dirname, '../public/covers');
fs.mkdirSync(out, { recursive: true });

/** Seed + action-index path that lands on a representative, text-free moment. */
const PLAN = {
  'claw-trek': [7, [1, 0, 1, 2, 2, 2], 1.6],
  'claw-guard': [7, [1, 30, 21, 10, 10, 6, 6], 1.2],
  'claw-heist': [7, [1, 2, 2], 1.2],
  'claw-catch': [7, [1, 0], 1.6],
  'claw-look': [7, [3, 0, 4, 1], 1.6],
  'claw-rampage': [7, [4, 10, 5, 11, 15, 11, 5], 1.4],
  'claw-ink': [7, [0, 1], 1.6],
  'claw-greens': [7, [0, 1], 1.6],
  'claw-conquest': [7, [0, 0, 3], 1.6],
  'claw-leap': [7, [2, 1, 0, 7], 2.2],
  'claw-burger': [7, [1, 1, 1, 0, 0], 1.4],
  'claw-stamp': [7, [0, 0, 0, 1], 1.4],
  'claw-melt': [4, [0, 1, 2, 0, 3], 1.4],
  'claw-net': [7, [1, 2, 0, 1], 1.4],
  'claw-beat': [3, [1, 2, 0], 1.6],
  'claw-count': [5, [0, 0, 1, 0], 1.4],
  'claw-mask': [4, [0, 0, 1, 0], 1.4],
  'claw-clock': [6, [0, 1, 0], 1.4],
  'claw-flip': [2, [1, 0, 0], 1.4],
  'claw-round': [7, [0, 0, 1], 1.4],
  'claw-coil': [7, [0, 1, 2], 1.4],
  'claw-sum': [7, [0, 1], 1.4],
  'claw-berth': [7, [0], 1.4],
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('gameclaw:muted', '1'));
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.gameclaw && document.fonts.status === 'loaded');
for (const [id, [seed, acts, wait]] of Object.entries(PLAN)) {
  if (only && only !== id) continue;
  await page.evaluate((g) => window.gameclaw.openGame({ game_id: g }), id);
  await page.waitForSelector('.gv:not([hidden]) .stage-canvas');
  await page.evaluate(([g, s]) => window.gameclaw.newGame({ game_id: g, seed: s }), [id, seed]);
  for (const a of acts) {
    const list = await page.evaluate((g) => window.gameclaw.listActions({ game_id: g }), id);
    const choices = list.actions.filter((x) => x.id !== 'abort');
    if (!choices.length) break;
    const pick = choices[Math.min(a, choices.length - 1)];
    await page.evaluate(([g, aid]) => window.gameclaw.act({ game_id: g, action_id: aid }), [id, pick.id]);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(wait * 1000);
  const data = await page.evaluate(() => window.__gcStage.snapshot());
  fs.writeFileSync(path.join(out, `${id}.png`), Buffer.from(data.split(',')[1], 'base64'));
  console.log('cover', id);
}
await browser.close();
