import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { definition } from '../src/definition';
import {
  act,
  actionsOf,
  type BeatState,
  createRun,
  exchange,
  ladderScore,
  legalPhrase,
  previewCommit,
  suggest,
} from '../src/engine';

function fresh(seed = 7, difficulty?: string): BeatState {
  return createRun({ seed, difficulty });
}

function play(state: BeatState, limit = 40): BeatState {
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < limit) {
    act(state, suggest(state));
    guard += 1;
  }
  return state;
}

describe('claw-beat engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(fresh(7)).toEqual(fresh(7));
    expect(fresh(7).tape).not.toEqual(fresh(8).tape);
    expect(fresh(1).rng).toHaveLength(4);
    const again = fresh(4);
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
    expect(legalPhrase(fresh(1).phrase)).toBe(true);
  });

  it('answers a chop with a slip and punishes a slip into a feint', () => {
    expect(exchange('slip', 'strike')).toMatchObject({ them: 2, you: 0, kind: 'riposte' });
    expect(exchange('slip', 'feint')).toMatchObject({ you: 2, them: 0, kind: 'hurt' });
    expect(exchange('jab', 'rest')).toMatchObject({ them: 2, kind: 'hit' });
    expect(exchange('guard', 'strike').kind).toBe('block');
  });

  it('refuses a phrase with adjacent jabs or no rest', () => {
    expect(legalPhrase(['jab', 'jab', 'rest', 'guard'])).toBe(false);
    expect(legalPhrase(['jab', 'guard', 'jab', 'slip'])).toBe(false);
    expect(legalPhrase(['jab', 'guard', 'slip', 'rest'])).toBe(true);
    const state = fresh(3);
    act(state, 'set:0:jab');
    expect(actionsOf(state).some((action) => action.id === 'set:1:jab')).toBe(false);
  });

  it('matches the commit preview and then draws a new bar', () => {
    const state = fresh(5);
    act(state, 'set:0:slip');
    const preview = previewCommit(state);
    const before = state.tape.slice(0, 4);
    act(state, 'commit');
    expect(state.taken).toBe(preview.dmgYou);
    expect(state.enemy).toBe(Math.max(0, preview.enemy));
    expect(state.tape.slice(0, 4)).not.toEqual(before);
    expect(state.edits).toBe(0);
  });

  it('knocks the opponent out and loses when breath hits zero', () => {
    const win = fresh(2);
    win.enemy = 1;
    win.phrase = ['jab', 'rest', 'rest', 'rest'];
    win.tape = ['rest', 'rest', 'rest', 'rest', 'strike', 'strike', 'strike', 'strike'];
    act(win, 'commit');
    expect(win.outcome).toBe('won');
    expect(win.cause).toBe('击倒');

    const lose = fresh(2);
    lose.breath = 2;
    lose.phrase = ['rest', 'rest', 'rest', 'rest'];
    lose.tape = ['strike', 'strike', 'strike', 'strike', 'rest', 'rest', 'rest', 'rest'];
    act(lose, 'commit');
    expect(lose.outcome).toBe('lost');
    expect(lose.cause).toBe('气息尽了');
    expect(ladderScore(lose)).toBeGreaterThanOrEqual(0);
  });

  it('lets the rewriting line win more seeds than committing four rests', () => {
    let rewritten = 0;
    let idle = 0;
    for (let seed = 1; seed <= 16; seed += 1) {
      if (play(fresh(seed)).outcome === 'won') rewritten += 1;
      const rest = fresh(seed);
      let guard = 0;
      while (rest.outcome === 'ongoing' && guard < 8) {
        act(rest, 'commit');
        guard += 1;
      }
      if (rest.outcome === 'won') idle += 1;
    }
    expect(rewritten).toBeGreaterThanOrEqual(10);
    expect(idle).toBe(0);
  });

  it('scores zero on abort', () => {
    const session = MemorySession.create(definition, { seed: 9 });
    expect(session.recap().score).toBe(0);
    session.act('abort');
    expect(session.recap().outcome).toBe('aborted');
    expect(session.recap().score).toBe(0);
  });
});
