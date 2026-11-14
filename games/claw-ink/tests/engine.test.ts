import { describe, expect, it } from 'vitest';

import { SITES, TALKS, WILD_SITES } from '../src/content';
import { definition } from '../src/definition';
import {
  abort,
  act,
  actionsOf,
  createRun,
  type InkState,
  MAX_TURNS,
  recapOf,
  scoreOf,
  statusOf,
} from '../src/engine';

function fresh(seed = 7, content = 'lamp'): InkState {
  return createRun({ seed, content });
}

describe('claw-ink engine', () => {
  it('creates identical state from the same seed', () => {
    expect(fresh(7)).toEqual(fresh(7));
    expect(fresh(7).trueSite).toBe(fresh(7).trueSite);
    expect(WILD_SITES).toContain(fresh(7).trueSite);
  });

  it('varies the buried site across seeds', () => {
    const sites = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => fresh(seed).trueSite));
    expect(sites.size).toBeGreaterThan(1);
  });

  it('opens in the town with the lamp profile numbers', () => {
    const state = fresh();
    expect(state.location).toBe('town');
    expect(state.turn).toBe(0);
    expect(state.silver).toBe(9);
    expect(state.food).toBe(10);
    expect(state.life).toBe(4);
    expect(state.belief).toBe(72);
    expect(state.outcome).toBe('ongoing');
    expect(statusOf(state).headline).toContain('第 1/18 幕');
  });

  it('offers only legal actions and caps the list at nine', () => {
    const state = fresh();
    const ids = actionsOf(state).map((action) => action.id);
    expect(ids).toContain('travel:stele');
    expect(ids).toContain('travel:ferry');
    expect(ids).toContain('travel:temple');
    expect(ids).toContain('talk:work');
    expect(ids).toContain('talk:buy-food');
    expect(ids.length).toBeLessThanOrEqual(9);
  });

  it('charges both travel and the per-act ration', () => {
    const state = fresh();
    act(state, 'travel:stele');
    expect(state.location).toBe('stele');
    expect(state.turn).toBe(1);
    expect(state.food).toBe(8);
  });

  it('rejects a move that is not on the road', () => {
    const state = fresh();
    expect(() => act(state, 'travel:post')).toThrow('走不到');
  });

  it('spends silver to investigate and always leaves a lead', () => {
    const state = fresh();
    act(state, 'travel:stele');
    const silver = state.silver;
    act(state, 'investigate');
    expect(state.silver).toBe(silver - 2);
    expect(state.lead).not.toBeNull();
    expect(state.clues).toBe(1);
    expect(WILD_SITES).toContain(state.lead?.site);
  });

  it('turns a true lead into proof and a false lead into doubt', () => {
    const trueState = fresh();
    trueState.location = 'temple';
    trueState.lead = { site: trueState.trueSite, truth: true };
    const proof = trueState.proof;
    act(trueState, 'verify');
    expect(trueState.proof).toBe(proof + 1);
    expect(trueState.lead).toBeNull();

    const falseState = fresh();
    falseState.location = 'temple';
    falseState.lead = { site: WILD_SITES.find((id) => id !== falseState.trueSite)!, truth: false };
    const belief = falseState.belief;
    act(falseState, 'verify');
    expect(falseState.belief).toBe(belief - 8);
  });

  it('only digs the brush out of the true site with enough belief or proof', () => {
    const wrong = fresh();
    wrong.location = WILD_SITES.find((id) => id !== wrong.trueSite)!;
    act(wrong, 'dig');
    expect(wrong.hasPen).toBe(false);
    expect(wrong.failedDigs).toBe(1);

    const right = fresh();
    right.location = right.trueSite;
    right.belief = 80;
    act(right, 'dig');
    expect(right.hasPen).toBe(true);
    expect(right.penVerified).toBe(true);
  });

  it('requires three probes before a skeptic can write', () => {
    const state = fresh(7, 'abacus');
    state.location = state.trueSite;
    state.belief = 30;
    state.proof = 2;
    act(state, 'dig');
    expect(state.hasPen).toBe(true);
    expect(state.penVerified).toBe(false);
    expect(actionsOf(state).map((action) => action.id)).not.toContain('write:gold');

    state.location = 'temple';
    state.silver = 30;
    act(state, 'probe');
    act(state, 'probe');
    expect(state.penVerified).toBe(false);
    act(state, 'probe');
    expect(state.penVerified).toBe(true);
    expect(actionsOf(state).map((action) => action.id)).toContain('write:gold');
  });

  it('adds ink debt for every write and devours at six', () => {
    const state = fresh();
    state.hasPen = true;
    state.penVerified = true;
    const silver = state.silver;
    act(state, 'write:gold');
    expect(state.silver).toBe(silver + 10);
    expect(state.debt).toBe(1);

    state.debt = 5;
    act(state, 'write:gold');
    expect(state.debt).toBe(6);
    expect(state.outcome).toBe('lost');
    expect(state.ending).toBe('devoured');
  });

  it('sells the brush only at the post and ends the run', () => {
    const state = fresh();
    state.hasPen = true;
    state.penVerified = true;
    state.location = 'post';
    const silver = state.silver;
    act(state, 'settle:sell');
    expect(state.outcome).toBe('won');
    expect(state.ending).toBe('sold');
    expect(state.silver).toBe(silver + 25);
    expect(state.sold).toBe(1);
    expect(actionsOf(state)).toHaveLength(0);
  });

  it('seals the brush and keeps the run honest', () => {
    const state = fresh();
    state.hasPen = true;
    state.penVerified = true;
    state.location = 'post';
    act(state, 'settle:seal');
    expect(state.ending).toBe('sealed');
    expect(state.outcome).toBe('won');
  });

  it('ends after eighteen acts with an attributable outcome', () => {
    const state = fresh();
    state.food = 60;
    for (let i = 0; i < MAX_TURNS; i += 1) {
      const ids = actionsOf(state).map((action) => action.id);
      const move = ids.includes('talk:work') ? 'talk:work' : ids[0]!;
      act(state, move);
    }
    expect(state.outcome).not.toBe('ongoing');
    expect(state.ending).toBeDefined();
    expect(state.cause.length).toBeGreaterThan(0);
  });

  it('never leaks the dig site through the action list', () => {
    const state = fresh();
    for (const site of WILD_SITES) {
      state.location = site;
      const ids = actionsOf(state).map((action) => action.id);
      expect(ids).toContain('dig');
    }
  });

  it('aborts without pretending it was a win or a loss', () => {
    const state = fresh();
    abort(state);
    expect(state.outcome).toBe('aborted');
    expect(state.ending).toBe('aborted');
    expect(actionsOf(state)).toHaveLength(0);
    expect(recapOf(state).cause).toContain('收');
  });

  it('scores seal higher when no debt was taken', () => {
    const clean = fresh();
    clean.hasPen = true;
    clean.penVerified = true;
    clean.location = 'post';
    act(clean, 'settle:seal');

    const dirty = fresh();
    dirty.hasPen = true;
    dirty.penVerified = true;
    dirty.location = 'post';
    dirty.debt = 3;
    act(dirty, 'settle:seal');

    expect(scoreOf(clean)).toBeGreaterThan(scoreOf(dirty));
  });

  it('keeps every talk usable only once per site visit', () => {
    const state = fresh();
    const talk = TALKS.find((entry) => entry.id === 'work')!;
    act(state, 'talk:work');
    expect(state.talks).toContain(talk.id);
    expect(actionsOf(state).map((action) => action.id)).not.toContain('talk:work');
    expect(() => act(state, 'talk:work')).toThrow('问过');
  });

  it('lists the six sites on the board', () => {
    expect(Object.keys(SITES)).toHaveLength(6);
  });

  it('hides investigate below two silver and offers it at the exact price', () => {
    const state = fresh();
    state.location = 'stele';
    for (const silver of [0, 1]) {
      state.silver = silver;
      expect(actionsOf(state).map((action) => action.id)).not.toContain('investigate');
    }
    state.silver = 2;
    expect(actionsOf(state).map((action) => action.id)).toContain('investigate');
  });

  it('hides a lethal dig at one life and offers it when a life can be spent', () => {
    const state = fresh();
    state.location = 'stele';
    state.life = 1;
    expect(actionsOf(state).map((action) => action.id)).not.toContain('dig');
    state.life = 2;
    expect(actionsOf(state).map((action) => action.id)).toContain('dig');
  });

  it('keeps ongoing and aborted recap outcomes distinct', () => {
    const state = fresh();
    expect(definition.recap(state).outcome).toBe('ongoing');
    abort(state);
    expect(definition.recap(state).outcome).toBe('aborted');
  });

  it('recommends locally useful investigation, verification, income and food', () => {
    const wild = fresh();
    wild.location = 'stele';
    expect(actionsOf(wild)[0]?.id).toBe('investigate');

    const verify = fresh();
    verify.location = 'temple';
    verify.lead = { site: 'stele', truth: false };
    expect(actionsOf(verify)[0]?.id).toBe('verify');

    const poor = fresh();
    poor.silver = 1;
    expect(actionsOf(poor)[0]?.id).toBe('talk:work');

    const hungry = fresh();
    hungry.food = 3;
    expect(actionsOf(hungry)[0]?.id).toBe('talk:buy-food');
  });

  it('labels the turn-seven food price as the next bag price', () => {
    const state = fresh();
    state.turn = 6;
    state.silver = 12;
    const result = act(state, 'talk:buy-food');
    expect(state.silver).toBe(9);
    expect(result.log.join('\n')).toContain('下一袋涨至 4 银');
  });
});
