import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { GAMES, gameName, gameTag } from '../src/catalog';
import { dict } from '../src/i18n';
import { term } from '../src/i18n/terms';
import { GAME_IDS, loadGame } from '../src/runtime/registry';

const CJK = /[\u3400-\u9fff]/;

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

describe('engine term translation', () => {
  it.each(GAME_IDS)(
    '%s: metric labels, phases and action labels translate to English',
    async (id) => {
      const mod = await loadGame(id);
      const misses = new Set<string>();
      for (const seed of [3, 7]) {
        const s = MemorySession.create(mod.definition, { seed });
        for (let i = 0; i < 24; i += 1) {
          const st = s.status();
          for (const m of st.metrics ?? [])
            if (CJK.test(term(id, m.label, 'en'))) misses.add(m.label);
          if (st.phase && CJK.test(term(id, st.phase, 'en'))) misses.add(st.phase);
          const acts = s.actions();
          for (const a of acts) if (CJK.test(term(id, a.label, 'en'))) misses.add(a.label);
          if (!acts.length || st.outcome !== 'ongoing') break;
          const pick = acts.filter((a) => a.id !== 'abort')[
            (i * 7 + seed) % Math.max(1, acts.length - 1)
          ];
          if (!pick) break;
          try {
            s.act(pick.id);
          } catch {
            break;
          }
        }
      }
      expect([...misses]).toEqual([]);
    },
  );
});
