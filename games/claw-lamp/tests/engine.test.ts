import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { definition } from '../src/definition';
import { act, actionsOf, createRun, type LampState, ladderScore, suggest } from '../src/engine';

function rush(state: LampState): string {
  const actions = actionsOf(state);
  const places = actions
    .filter((action) => action.id.startsWith('place:'))
    .sort((a, b) => Number(a.id.slice(6)) - Number(b.id.slice(6)));
  if (places[0]) return places[0].id;
  if (actions.some((action) => action.id === 'seal')) return 'seal';
  const lift = actions.find((action) => action.id.startsWith('lift:'));
  return lift?.id ?? 'seal';
}

function play(seed: number, policy: (state: LampState) => string) {
  const state = createRun({ seed });
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < 80) {
    act(state, policy(state));
    guard += 1;
  }
  return state;
}

describe('claw-lamp engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(createRun({ seed: 7 })).toEqual(createRun({ seed: 7 }));
    expect(createRun({ seed: 7 }).rng).not.toEqual(createRun({ seed: 8 }).rng);
    expect(createRun({ seed: 1 }).rng).toHaveLength(4);
    const again = createRun({ seed: 4 });
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
    let differ = false;
    for (let seed = 1; seed <= 8; seed += 1) {
      if (
        JSON.stringify(createRun({ seed }).posts) !==
        JSON.stringify(createRun({ seed: seed + 1 }).posts)
      ) {
        differ = true;
      }
    }
    expect(differ).toBe(true);
  });

  it('refuses a post that can see a standing lantern and seals a lit shoal', () => {
    const state = createRun({ seed: 1 });
    const trap = actionsOf(state).find((action) => action.id === 'place:0');
    expect(trap).toBeTruthy();
    expect(actionsOf(state)[0]?.id).toBe('place:0');
    expect(suggest(state)).not.toBe('place:0');
    act(state, 'place:0');
    expect(actionsOf(state).some((action) => action.id === 'place:3')).toBe(false);
    state.placed = state.posts.map(() => false);
    state.stock = 2;
    state.tide = 3;
    act(state, suggest(state));
    act(state, suggest(state));
    expect(actionsOf(state).some((action) => action.id === 'seal')).toBe(true);
    const stock = state.stock;
    act(state, 'seal');
    expect(state.cleared).toBe(1);
    expect(state.saved).toBe(stock);
  });

  it('lets the careful line win more seeds than planting the first post', () => {
    let careful = 0;
    let blind = 0;
    for (let seed = 1; seed <= 10; seed += 1) {
      if (play(seed, suggest).outcome === 'won') careful += 1;
      if (play(seed, rush).outcome === 'won') blind += 1;
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
    won.cleared = 4;
    won.saved = 2;
    won.lifts = 1;
    expect(ladderScore(won)).toBe(4 * 100 + 16 - 18 + 360);
  });
});
