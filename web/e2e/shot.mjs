#!/usr/bin/env node
/**
 * Dev screenshot helper.
 *   node e2e/shot.mjs --url http://localhost:5173/gameclaw/ --out dir [--lang zh|en]
 *        [--home] [--games a,b] [--seed 7] [--acts 0,1,0] [--mid 120] [--canvas]
 * --mid N  : also capture a frame N ms after the last act (VFX in flight).
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const flag = (k) => argv.includes(`--${k}`);
const url = arg('url', 'http://localhost:5173/gameclaw/');
const out = arg('out', '/tmp/shots');
const lang = arg('lang', 'zh');
const seed = Number(arg('seed', '7'));
const acts = (arg('acts', '') || '').split(',').filter(Boolean).map(Number);
const mid = arg('mid', null);
const prefix = arg('prefix', '');
fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: lang === 'zh' ? 'zh-CN' : 'en-US' });
await ctx.addInitScript((l) => {
  localStorage.setItem('gameclaw:lang', l);
  localStorage.setItem('gameclaw:muted', '1');
}, lang);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.gameclaw && document.fonts.status === 'loaded');
await page.waitForTimeout(600);
if (flag('home')) {
  await page.screenshot({ path: path.join(out, `${prefix}home-${lang}.png`) });
  await page.screenshot({ path: path.join(out, `${prefix}home-${lang}-full.png`), fullPage: true });
}
const games = (arg('games', '') || '').split(',').filter(Boolean);
for (const id of games) {
  await page.evaluate((g) => window.gameclaw.openGame({ game_id: g }), id);
  await page.waitForSelector('.gv:not([hidden]) .stage-canvas');
  await page.evaluate(([g, s]) => window.gameclaw.newGame({ game_id: g, seed: s }), [id, seed]);
  await page.waitForTimeout(500);
  for (const [k, a] of acts.entries()) {
    const list = await page.evaluate((g) => window.gameclaw.listActions({ game_id: g }), id);
    const choices = list.actions.filter((x) => x.id !== 'abort');
    if (!choices.length) break;
    const pick = choices[Math.min(a, choices.length - 1)];
    await page.evaluate(([g, aid]) => window.gameclaw.act({ game_id: g, action_id: aid }), [id, pick.id]);
    if (mid && k === acts.length - 1) {
      await page.waitForTimeout(Number(mid));
      const el = flag('canvas') ? await page.$('.gv:not([hidden]) .stage-canvas') : page;
      await el.screenshot({ path: path.join(out, `${prefix}${id}-${lang}-mid.png`) });
    } else await page.waitForTimeout(350);
  }
  await page.waitForTimeout(900);
  const el = flag('canvas') ? await page.$('.gv:not([hidden]) .stage-canvas') : page;
  await el.screenshot({ path: path.join(out, `${prefix}${id}-${lang}.png`) });
  const perf = await page.evaluate(() => {
    const c = document.querySelector('.gv:not([hidden]) .stage-canvas');
    return c ? 'ok' : 'none';
  });
  if (perf !== 'ok') console.log('no canvas', id);
}
if (errors.length) console.log('ERRORS:\n' + errors.slice(0, 10).join('\n'));
await browser.close();
