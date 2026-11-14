import type { ActionView, RecapView, StatusView } from '@gameclaw/gamekit';
import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { GAMES, gameName, gameTag } from '../src/catalog';
import { dict } from '../src/i18n';
import { allCatalogs } from '../src/i18n/catalogs';
import {
  localizeActions,
  localizeLines,
  localizeRecap,
  localizeStatus,
} from '../src/i18n/localize';
import { CJK, translate } from '../src/i18n/translate';
import { GAME_IDS, loadGame } from '../src/runtime/registry';

describe('i18n dictionary', () => {
  it('has the same non-empty keys in both languages, and EN is pure English', () => {
    const zh = dict('zh');
    const en = dict('en');
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    for (const [k, v] of Object.entries(en)) {
      expect(v, k).not.toBe('');
      expect(CJK.test(v), `en:${k} = ${v}`).toBe(false);
      expect(zh[k as keyof typeof zh], k).not.toBe('');
    }
  });

  it('names and taglines every game in both languages', () => {
    for (const g of GAMES) {
      expect(gameName(g, 'zh')).toMatch(CJK);
      expect(gameTag(g, 'zh')).toMatch(CJK);
      expect(CJK.test(gameName(g, 'en'))).toBe(false);
      expect(CJK.test(gameTag(g, 'en'))).toBe(false);
    }
  });
});

describe('game catalogs', () => {
  it('registers every shipped game with EN that contains no Chinese', () => {
    const ids = [...allCatalogs().keys()].sort();
    expect(ids).toEqual([...GAME_IDS].sort());
    for (const [id, cat] of allCatalogs()) {
      for (const [zh, en] of Object.entries(cat.exact)) {
        expect(en, `${id} exact: ${zh}`).not.toBe('');
        expect(CJK.test(en), `${id} exact en still CJK: ${en}`).toBe(false);
      }
      for (const [zh, en] of Object.entries(cat.terms)) {
        expect(en, `${id} term: ${zh}`).not.toBe('');
        expect(CJK.test(en), `${id} term en still CJK: ${en}`).toBe(false);
      }
      for (const p of cat.patterns) {
        expect(CJK.test(p.en), `${id} pattern en still CJK: ${p.en}`).toBe(false);
        const zhSlots = (p.zh.match(/\{\d+\}/g) ?? []).sort();
        const enSlots = (p.en.match(/\{\d+\}/g) ?? []).sort();
        expect(enSlots, `${id} pattern slots: ${p.zh}`).toEqual(zhSlots);
      }
    }
  });
});

function harvest(
  id: string,
  status: StatusView,
  actions: ActionView[],
  recap: RecapView,
  logs: string[],
): string[] {
  const locS = localizeStatus(id, status, 'en');
  const locA = localizeActions(id, actions, 'en');
  const locR = localizeRecap(id, recap, 'en');
  const locL = localizeLines(id, logs, 'en');
  const bag: string[] = [];
  const push = (s: string) => {
    if (CJK.test(s)) bag.push(s);
  };
  push(locS.headline);
  if (locS.phase) push(locS.phase);
  for (const m of locS.metrics) {
    push(m.label);
    push(String(m.value));
    if (m.hint) push(m.hint);
  }
  for (const sec of locS.sections) {
    push(sec.title);
    for (const line of sec.lines) push(line);
  }
  for (const a of locA) {
    push(a.label);
    if (a.detail) push(a.detail);
    if (a.cost) push(a.cost);
  }
  push(locR.title);
  push(locR.cause);
  push(locR.memoryPrompt);
  for (const m of locR.metrics) {
    push(m.label);
    push(String(m.value));
  }
  for (const line of locR.timeline) push(line);
  for (const line of locR.lessons) push(line);
  for (const line of locL) push(line);
  return bag;
}

describe('engine localization smoke', () => {
  it.each(GAME_IDS)(
    '%s: a sample run localizes get_state / actions / recap with no leftover CJK',
    async (id) => {
      const mod = await loadGame(id);
      const leftovers = new Set<string>();
      for (const seed of [3, 7, 11]) {
        const s = MemorySession.create(mod.definition, { seed });
        const logs: string[] = [];
        for (let i = 0; i < 28; i += 1) {
          const st = s.status();
          const acts = s.actions();
          const recap = s.recap();
          for (const hit of harvest(id, st, acts, recap, logs)) leftovers.add(hit);
          if (!acts.length || st.outcome !== 'ongoing') break;
          const pick = acts.filter((a) => a.id !== 'abort')[
            (i * 7 + seed) % Math.max(1, acts.length - (acts.some((a) => a.id === 'abort') ? 1 : 0))
          ];
          if (!pick) break;
          try {
            const result = s.act(pick.id);
            logs.push(...result.result.log);
          } catch {
            break;
          }
        }
      }
      const residual = [...leftovers];
      if (residual.length) {
        // Print a short sample so a failure is actionable.
        console.warn(`${id} residual CJK (${residual.length}):`, residual.slice(0, 12));
      }
      expect(residual, `${id} leftover CJK`).toEqual([]);
    },
  );

  it('translate is a no-op for Chinese and already-English text', () => {
    expect(translate('claw-guard', '潮令', 'zh')).toBe('潮令');
    expect(translate('claw-guard', 'Orders', 'en')).toBe('Orders');
  });
});
