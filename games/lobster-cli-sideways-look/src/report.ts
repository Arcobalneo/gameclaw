import fs from 'node:fs/promises';
import path from 'node:path';
import type { GameState } from './model.js';
import { getSaveRoot } from './storage.js';

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function writeReports(state: GameState): Promise<{ textPath: string; htmlPath: string }> {
  const root = getSaveRoot();
  const reportsDir = path.join(root, 'reports');
  await fs.mkdir(reportsDir, { recursive: true });
  const ascii = state.latestAscii.join('\n');
  const text = [
    `CASE: ${state.caseName}`,
    `OUTCOME: ${state.outcome}`,
    `KEY SIGHTINGS: ${state.findings.slice(-5).join(' | ') || 'none'}`,
    `TURNING POINT: ${state.latestResult ?? 'n/a'}`,
    `WHAT LOOKED BACK: ${state.latestWitness ?? 'nothing held still long enough to name'}`,
    'ASCII WITNESS:',
    ascii,
    'MEMORY PROMPTS:',
    `- 本局里 ${state.caseName} 的记录数=${state.recordedClues.length}，下次可验证更早拿取 objective 是否会提高 wrong-record 风险。`,
    `- 本局 dread=${state.dread} nerve=${state.nerve}；若再次进入该副本，可测试更早 brace 是否能让 inspect 质量更稳。`
  ].join('\n');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(state.caseName)} recap</title><style>body{background:#081018;color:#d8e6f2;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:24px;}pre{background:#111b24;padding:16px;border-radius:12px;white-space:pre-wrap;}h1,h2{color:#8ff0ff}</style></head><body><h1>${escapeHtml(state.caseName)}</h1><h2>Outcome</h2><pre>${escapeHtml(state.outcome)}</pre><h2>Latest Witness</h2><pre>${escapeHtml(state.latestWitness ?? 'none')}</pre><h2>ASCII Witness</h2><pre>${escapeHtml(ascii)}</pre><h2>Timeline</h2><pre>${escapeHtml(state.history.map((entry) => `${entry.turn}. ${entry.action} -> ${entry.result}`).join('\n'))}</pre><h2>Memory Prompts</h2><pre>${escapeHtml(text.split('MEMORY PROMPTS:\n')[1] || '')}</pre></body></html>`;
  const textPath = path.join(reportsDir, 'latest.txt');
  const htmlPath = path.join(reportsDir, 'latest.html');
  const datedText = path.join(reportsDir, `run-${state.runId}.txt`);
  const datedHtml = path.join(reportsDir, `run-${state.runId}.html`);
  await fs.writeFile(textPath, text, 'utf8');
  await fs.writeFile(htmlPath, html, 'utf8');
  await fs.writeFile(datedText, text, 'utf8');
  await fs.writeFile(datedHtml, html, 'utf8');
  return { textPath, htmlPath };
}
