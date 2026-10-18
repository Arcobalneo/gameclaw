import fs from 'node:fs';
import path from 'node:path';

import type { GamePaths } from './paths';
import type { GameMeta, RecapView, SaveFile } from './types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function outcomeTheme(outcome: string): { badge: string; accent: string } {
  if (outcome === 'won') return { badge: 'ESCAPED', accent: '#4ecdc4' };
  if (outcome === 'lost') return { badge: 'SUNK', accent: '#ff6b6b' };
  if (outcome === 'aborted') return { badge: 'INTERRUPTED', accent: '#ffd166' };
  return { badge: 'ONGOING', accent: '#8ecae6' };
}

export function renderRecapMarkdown(meta: GameMeta, save: SaveFile, recap: RecapView): string {
  const lines: string[] = [];
  lines.push(`# ${meta.name} — ${recap.title}`);
  lines.push('');
  lines.push(`- game: \`${meta.id}\` v${meta.version}`);
  lines.push(`- seed: \`${save.seed}\``);
  lines.push(`- slot: \`${save.slot}\``);
  lines.push(`- turn: \`${save.turn}\``);
  lines.push(`- outcome: \`${recap.outcome}\``);
  lines.push('');
  lines.push('## Cause');
  lines.push('');
  lines.push(recap.cause || '—');
  if (recap.metrics.length > 0) {
    lines.push('');
    lines.push('## Metrics');
    lines.push('');
    for (const metric of recap.metrics) lines.push(`- ${metric.label}: ${metric.value}`);
  }
  if (recap.timeline.length > 0) {
    lines.push('');
    lines.push('## Timeline');
    lines.push('');
    for (const entry of recap.timeline) lines.push(`- ${entry}`);
  }
  if (recap.lessons.length > 0) {
    lines.push('');
    lines.push('## Lessons');
    lines.push('');
    for (const lesson of recap.lessons) lines.push(`- ${lesson}`);
  }
  lines.push('');
  lines.push('## Memory prompt');
  lines.push('');
  lines.push(recap.memoryPrompt);
  lines.push('');
  return lines.join('\n');
}

export function renderRecapHtml(meta: GameMeta, save: SaveFile, recap: RecapView): string {
  const theme = outcomeTheme(recap.outcome);
  const metrics = recap.metrics
    .map(
      (metric) =>
        `<div class="metric"><span class="k">${escapeHtml(metric.label)}</span><span class="v">${escapeHtml(
          String(metric.value),
        )}</span></div>`,
    )
    .join('');
  const timeline = recap.timeline.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('');
  const lessons = recap.lessons.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(meta.name)} · ${escapeHtml(recap.title)}</title>
<style>
:root{color-scheme:dark;--bg:#07131f;--panel:#0d2031;--line:rgba(255,255,255,.08);--text:#ebf4ff;--muted:#9bb3c9;--accent:${theme.accent}}
*{box-sizing:border-box}
body{margin:0;padding:40px 18px 64px;background:radial-gradient(circle at 50% 0,#12314a 0,var(--bg) 55%);color:var(--text);font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:860px;margin:0 auto}
.badge{display:inline-block;padding:4px 10px;border-radius:999px;background:var(--accent);color:#04121c;font-weight:700;letter-spacing:.08em;font-size:12px}
h1{font-size:26px;margin:14px 0 6px}
.sub{color:var(--muted);margin:0 0 24px}
.panel{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin:16px 0}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:0 0 10px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.metric{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}
.metric .k{color:var(--muted);font-size:12px}
.metric .v{font-size:18px;font-weight:700;color:var(--accent)}
ul{margin:0;padding-left:20px}
li{margin:4px 0}
.cause{font-size:16px}
.memory{border-left:3px solid var(--accent);padding-left:14px;color:var(--text)}
footer{margin-top:28px;color:var(--muted);font-size:12px;text-align:center}
</style>
</head>
<body>
<main>
  <span class="badge">${escapeHtml(theme.badge)}</span>
  <h1>${escapeHtml(meta.name)} · ${escapeHtml(recap.title)}</h1>
  <p class="sub">${escapeHtml(meta.englishName)} · seed ${save.seed} · slot ${save.slot} · turn ${save.turn}</p>
  <section class="panel"><h2>Cause</h2><p class="cause">${escapeHtml(recap.cause || '—')}</p></section>
  <section class="panel"><h2>Metrics</h2><div class="grid">${metrics}</div></section>
  ${timeline ? `<section class="panel"><h2>Timeline</h2><ul>${timeline}</ul></section>` : ''}
  ${lessons ? `<section class="panel"><h2>Lessons</h2><ul>${lessons}</ul></section>` : ''}
  <section class="panel"><h2>Memory prompt</h2><p class="memory">${escapeHtml(recap.memoryPrompt)}</p></section>
  <footer>${escapeHtml(meta.id)} v${escapeHtml(meta.version)} · ${escapeHtml(meta.repo)}</footer>
</main>
</body>
</html>
`;
}

export interface ReportPaths {
  html: string;
  markdown: string;
}

export function writeRecapReport(
  paths: GamePaths,
  meta: GameMeta,
  save: SaveFile,
  recap: RecapView,
): ReportPaths {
  fs.mkdirSync(paths.reportsDir, { recursive: true });
  const base = `${save.runId}-${recap.outcome}`;
  const htmlPath = path.join(paths.reportsDir, `${base}.html`);
  const markdownPath = path.join(paths.reportsDir, `${base}.md`);
  fs.writeFileSync(htmlPath, renderRecapHtml(meta, save, recap), 'utf8');
  fs.writeFileSync(markdownPath, renderRecapMarkdown(meta, save, recap), 'utf8');
  const latestHtml = path.join(paths.reportsDir, 'latest.html');
  const latestMarkdown = path.join(paths.reportsDir, 'latest.md');
  fs.copyFileSync(htmlPath, latestHtml);
  fs.copyFileSync(markdownPath, latestMarkdown);
  return { html: htmlPath, markdown: markdownPath };
}
