import type { ActionView, RecapView, StatusView } from '@gameclaw/gamekit';
import { type Lang, lang } from './index';
import { translate } from './translate';

function tx(gameId: string, text: string, target: Lang): string {
  return translate(gameId, text, target);
}

export function localizeStatus(
  gameId: string,
  status: StatusView,
  target: Lang = lang(),
): StatusView {
  if (target === 'zh') return status;
  return {
    ...status,
    headline: tx(gameId, status.headline, target),
    ...(status.phase ? { phase: tx(gameId, status.phase, target) } : {}),
    metrics: status.metrics.map((m) => ({
      ...m,
      label: tx(gameId, m.label, target),
      value: typeof m.value === 'string' ? tx(gameId, m.value, target) : m.value,
      ...(m.hint ? { hint: tx(gameId, m.hint, target) } : {}),
    })),
    sections: status.sections.map((s) => ({
      title: tx(gameId, s.title, target),
      lines: s.lines.map((line) => tx(gameId, line, target)),
    })),
  };
}

export function localizeActions(
  gameId: string,
  actions: readonly ActionView[],
  target: Lang = lang(),
): ActionView[] {
  if (target === 'zh') return [...actions];
  return actions.map((a) => ({
    ...a,
    label: tx(gameId, a.label, target),
    ...(a.detail ? { detail: tx(gameId, a.detail, target) } : {}),
    ...(a.cost ? { cost: tx(gameId, a.cost, target) } : {}),
  }));
}

export function localizeRecap(gameId: string, recap: RecapView, target: Lang = lang()): RecapView {
  if (target === 'zh') return recap;
  return {
    ...recap,
    title: tx(gameId, recap.title, target),
    cause: tx(gameId, recap.cause, target),
    memoryPrompt: tx(gameId, recap.memoryPrompt, target),
    metrics: recap.metrics.map((m) => ({
      ...m,
      label: tx(gameId, m.label, target),
      value: typeof m.value === 'string' ? tx(gameId, m.value, target) : m.value,
      ...(m.hint ? { hint: tx(gameId, m.hint, target) } : {}),
    })),
    timeline: recap.timeline.map((line) => tx(gameId, line, target)),
    lessons: recap.lessons.map((line) => tx(gameId, line, target)),
  };
}

export function localizeLine(gameId: string, text: string, target: Lang = lang()): string {
  return tx(gameId, text, target);
}

export function localizeLines(
  gameId: string,
  lines: readonly string[],
  target: Lang = lang(),
): string[] {
  return lines.map((line) => tx(gameId, line, target));
}
