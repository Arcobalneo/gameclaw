import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { definition } from '../src/definition';
import { act, actionsOf, createRun, ladderScore, type StowState, suggest } from '../src/engine';

function careless(state: StowState): string {
  const slip = state.events[state.index];
  if (!slip || slip.kind === 'order') {
    if (state.bays[0]) return 'pull:0';
    return 'hold';
  }
  const open = state.bays.indexOf(null);
  if (open >= 0) return `shelve:${open}`;
  return 'swap:0';
}

function play(seed: number, policy: (state: StowState) => string) {
  const state = createRun({ seed });
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < 40) {
    act(state, policy(state));
    guard += 1;
  }
  return state;
}

describe('claw-stow engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(createRun({ seed: 7 })).toEqual(createRun({ seed: 7 }));
    expect(createRun({ seed: 7 }).events).not.toEqual(createRun({ seed: 8 }).events);
    expect(createRun({ seed: 1 }).rng).toHaveLength(4);
    const again = createRun({ seed: 4 });
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
  });

  it('counts a matching pull and a wrong pull differently', () => {
    const state = createRun({ seed: 2 });
    state.events[0] = { kind: 'order', glyph: 1 };
    state.bays[0] = { glyph: 1, age: 0, labeled: false };
    state.bays[1] = { glyph: 2, age: 0, labeled: false };
    act(state, 'pull:1');
    expect(state.mispicks).toBe(1);
    expect(state.streak).toBe(0);
    state.events[state.index] = { kind: 'order', glyph: 1 };
    state.bays[0] = { glyph: 1, age: 0, labeled: false };
    act(state, 'pull:0');
    expect(state.correct).toBe(1);
    expect(state.streak).toBe(1);
  });

  it('treats a mark as wasted when the next three slips do not order the crate', () => {
    const state = createRun({ seed: 4 });
    const actions = actionsOf(state);
    const mark = actions.find((action) => action.id.startsWith('mark:'));
    const shelve = actions.find((action) => action.id.startsWith('shelve:'));
    expect(mark?.detail).toContain('浪费');
    expect(shelve?.detail).not.toContain('浪费');
    expect(mark?.risk).toBe('high');
    expect(shelve?.risk).toBe('low');
  });

  it('spoils an unmarked crate that has to wait, and keeps a marked one', () => {
    const plain = createRun({ seed: 5 });
    expect(plain.events[3]?.kind).toBe('crate');
    plain.index = 3;
    plain.spoil = 3;
    plain.marks = 1;
    act(plain, 'shelve:0');
    act(plain, 'shelve:1');
    act(plain, 'shelve:2');
    expect(plain.bays[0]).toBeNull();
    const marked = createRun({ seed: 5 });
    marked.index = 3;
    marked.spoil = 3;
    marked.marks = 1;
    const glyph = marked.events[3]?.glyph ?? 0;
    act(marked, 'mark:0');
    act(marked, 'shelve:1');
    act(marked, 'shelve:2');
    expect(marked.bays[0]?.glyph).toBe(glyph);
  });

  it('lets the careful line finish more slips than pulling the first bay', () => {
    let careful = 0;
    let blind = 0;
    for (let seed = 1; seed <= 10; seed += 1) {
      if (play(seed, suggest).outcome === 'won') careful += 1;
      if (play(seed, careless).outcome === 'won') blind += 1;
    }
    expect(careful).toBeGreaterThanOrEqual(8);
    expect(blind).toBeLessThan(careful);
  });

  it('scores zero on abort and uses the win formula', () => {
    const session = MemorySession.create(definition, { seed: 3 });
    expect(session.recap().score).toBe(0);
    session.act('abort');
    expect(session.recap().score).toBe(0);
    const won = createRun({ seed: 1 });
    won.outcome = 'won';
    won.correct = 4;
    won.bestStreak = 3;
    won.mispicks = 1;
    expect(ladderScore(won)).toBe(4 * 30 + 3 * 15 - 70 + 340);
  });
});
