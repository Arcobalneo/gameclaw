import type { Palette } from '../color';
import { padEndDisplay, truncateDisplay, wrapText } from '../text';
import type { ActionView, GameMeta, Metric, RecapView, StatusView } from '../types';

const WIDTH = 88;

export function renderMetrics(metrics: Metric[]): string {
  return metrics.map((metric) => `${metric.label}=${metric.value}`).join('  ');
}

export function renderStatus(status: StatusView, palette: Palette): string[] {
  const lines: string[] = [];
  lines.push(`${palette.bold('STATE')}  ${status.headline}`);
  if (status.metrics.length > 0) {
    const statLine = `${palette.bold('STAT')}   ${renderMetrics(status.metrics)}`;
    if (statLine.length <= WIDTH * 2) {
      lines.push(statLine);
    } else {
      lines.push(`${palette.bold('STAT')}`);
      for (const metric of status.metrics) {
        lines.push(
          `       ${metric.label}=${metric.value}${metric.hint ? ` (${metric.hint})` : ''}`,
        );
      }
    }
  }
  if (status.sections.length > 0) {
    lines.push(palette.gray('---'));
    for (const section of status.sections) {
      if (section.title) lines.push(palette.cyan(section.title));
      for (const line of section.lines) {
        if (line === '') lines.push('');
        else lines.push(...wrapText(line, WIDTH));
      }
    }
    lines.push(palette.gray('---'));
  }
  return lines;
}

export function renderActions(actions: ActionView[], palette: Palette, verbose = false): string[] {
  if (actions.length === 0) return [];
  const lines = [palette.bold('ACTIONS')];
  actions.forEach((action, index) => {
    const risk = action.risk ? ` risk=${action.risk}` : '';
    const cost = action.cost ? ` cost=${action.cost}` : '';
    const head = `  [${index + 1}] ${padEndDisplay(action.id, 26)} ${action.label}${risk}${cost}`;
    lines.push(truncateDisplay(head, WIDTH * 2));
    if (verbose && action.detail) {
      for (const detailLine of wrapText(action.detail, WIDTH - 8))
        lines.push(`      ${detailLine}`);
    }
  });
  return lines;
}

export interface FrameTextInput {
  meta: GameMeta;
  slot: number;
  turn: number;
  outcome: string;
  seed: number;
  status: StatusView;
  actions: ActionView[];
  log?: string[];
  observerUrl?: string;
  reportHtml?: string;
  reportMarkdown?: string;
  verbose?: boolean;
}

export function renderFrameText(input: FrameTextInput, palette: Palette): string {
  const { meta, status } = input;
  const lines: string[] = [];
  lines.push(
    `${palette.bold('GAME')}   ${meta.id} v${meta.version}  slot=${input.slot}  turn=${input.turn}  outcome=${input.outcome}  seed=${input.seed}`,
  );
  if (input.log && input.log.length > 0) {
    for (const entry of input.log) {
      for (const line of wrapText(entry, WIDTH)) lines.push(`${palette.bold('LOG')}    ${line}`);
    }
  }
  lines.push(...renderStatus(status, palette));
  const actionLines = renderActions(input.actions, palette, input.verbose);
  if (actionLines.length > 0) lines.push(...actionLines);
  if (input.observerUrl) lines.push(`${palette.bold('OBSERVER')} ${input.observerUrl}`);
  if (input.reportHtml) lines.push(`${palette.bold('REPORT')}   ${input.reportHtml}`);
  if (input.reportMarkdown) lines.push(`${palette.bold('RECAP')}    ${input.reportMarkdown}`);
  if (status.outcome === 'ongoing' && input.actions[0]) {
    lines.push(`${palette.bold('NEXT')}   act ${input.actions[0].id}`);
  } else if (status.outcome !== 'ongoing') {
    lines.push(`${palette.bold('NEXT')}   recap  (run is ${status.outcome})`);
  }
  return lines.join('\n');
}

export function renderRecapText(recap: RecapView, palette: Palette): string {
  const lines: string[] = [];
  lines.push(`${palette.bold('RESULT')}  ${recap.outcome} · ${recap.title}`);
  if (recap.cause)
    for (const line of wrapText(recap.cause, WIDTH))
      lines.push(`${palette.bold('CAUSE')}   ${line}`);
  if (recap.metrics.length > 0)
    lines.push(`${palette.bold('METRICS')} ${renderMetrics(recap.metrics)}`);
  if (recap.timeline.length > 0) {
    lines.push(palette.bold('TIMELINE'));
    for (const entry of recap.timeline) lines.push(`  · ${entry}`);
  }
  if (recap.lessons.length > 0) {
    lines.push(palette.bold('LESSONS'));
    for (const lesson of recap.lessons) {
      for (const line of wrapText(lesson, WIDTH - 4)) lines.push(`  - ${line}`);
    }
  }
  lines.push(`${palette.bold('MEMORY')}  ${recap.memoryPrompt}`);
  return lines.join('\n');
}

export function renderHelp(meta: GameMeta, stateRoot: string): string {
  return [
    `${meta.name}  ${meta.englishName}`,
    `${meta.id} v${meta.version} · ${meta.tagline}`,
    '',
    meta.description,
    '',
    'USAGE',
    `  ${meta.id} new [--slot N] [--seed N] [--content X] [--difficulty Y]`,
    `  ${meta.id} status  [--slot N]`,
    `  ${meta.id} actions [--slot N]`,
    `  ${meta.id} act <action-id> [--slot N]`,
    `  ${meta.id} recap   [--slot N] [--format text|markdown|html]`,
    `  ${meta.id} saves`,
    `  ${meta.id} play    [--slot N]`,
    `  ${meta.id} observer [--port N]`,
    `  ${meta.id} help | version`,
    '',
    'FLAGS',
    '  --json              emit one machine-readable JSON object on stdout',
    '  --state-dir <path>  override the state root (default: ~/.gameclaw)',
    '  --slot <n>          save slot, 0-99 (default: 0)',
    '  --seed <n>          deterministic seed for a new run',
    '  --content <id>      scenario / case / preset id',
    '  --difficulty <id>   difficulty preset',
    '  --no-observer       do not start the local observer page',
    '  --no-report         do not write an HTML settlement report',
    '  --no-color          disable ANSI colour',
    '  --force             overwrite an existing run in the slot',
    '  --verbose           include action details and longer text',
    '',
    'AGENT LOOP',
    '  1. act <id> returns the outcome, the full state and the next legal actions.',
    '  2. Every run is deterministic for a given seed and action sequence.',
    '  3. When a run ends, recap prints the cause and honest single-run lessons.',
    '',
    'GAME GUIDE',
    ...meta.guide.map((line) => `  ${line}`),
    '',
    `STATE ROOT  ${stateRoot}`,
    `REPO        ${meta.repo}`,
  ].join('\n');
}

export function renderSavesText(
  summaries: {
    slot: number;
    exists: boolean;
    turn?: number;
    outcome?: string;
    headline?: string;
  }[],
): string {
  if (summaries.length === 0) return 'No saves yet. Start one with: new';
  return summaries
    .map((summary) =>
      summary.exists
        ? `slot=${summary.slot} turn=${summary.turn ?? '?'} outcome=${summary.outcome ?? '?'} :: ${summary.headline ?? ''}`
        : `slot=${summary.slot} empty`,
    )
    .join('\n');
}

export function outcomeLabel(outcome: string): string {
  if (outcome === 'won') return 'escaped';
  if (outcome === 'lost') return 'sunk';
  if (outcome === 'aborted') return 'interrupted';
  return 'ongoing';
}
