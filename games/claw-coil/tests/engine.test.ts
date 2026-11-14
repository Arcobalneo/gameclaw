import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/content';
import { definition } from '../src/definition';
import { act, createRun, ladderScore, suggest } from '../src/engine';

function play(seed: number) {
  const state = createRun({ seed });
  let guard = 0;
  while (state.outcome === 'ongoing' && guard < 40) {
    act(state, suggest(state));
    guard += 1;
  }
  return state;
}

describe('claw-coil engine', () => {
  it('replays a seed and stays JSON-safe', () => {
    expect(createRun({ seed: 5 })).toEqual(createRun({ seed: 5 }));
    expect(createRun({ seed: 1 }).rng).toHaveLength(4);
    const again = createRun({ seed: 2 });
    expect(JSON.parse(JSON.stringify(again))).toEqual(again);
  });

  it('follows every authored push onto the dock', () => {
    for (const level of LEVELS) {
      const state = createRun({ seed: 1 });
      state.stages = 1;
      state.snake = level.snake.map((cell) => [cell[0], cell[1]]);
      state.crate = [level.crate[0], level.crate[1]];
      state.dock = [level.dock[0], level.dock[1]];
      for (const move of level.moves) act(state, move);
      expect(state.outcome).toBe('won');
    }
  });

  it('strikes a wall and does not move', () => {
    const state = createRun({ seed: 1 });
    state.snake = [
      [1, 1],
      [1, 2],
      [1, 3],
    ];
    act(state, 'n');
    expect(state.strikes).toBe(1);
    expect(state.snake[0]).toEqual([1, 1]);
  });

  it('lets the planned line win more often than always east', () => {
    let planned = 0;
    let east = 0;
    for (let seed = 1; seed <= 8; seed += 1) {
      if (play(seed).outcome === 'won') planned += 1;
      const state = createRun({ seed });
      let guard = 0;
      while (state.outcome === 'ongoing' && guard < 20) {
        act(state, 'e');
        guard += 1;
      }
      if (state.outcome === 'won') east += 1;
    }
    expect(planned).toBeGreaterThanOrEqual(8);
    expect(east).toBeLessThan(planned);
  });

  it('scores zero on abort', () => {
    const session = MemorySession.create(definition, { seed: 3 });
    expect(session.recap().score).toBe(0);
    session.act('abort');
    expect(session.recap().score).toBe(0);
    const won = createRun({ seed: 1 });
    won.outcome = 'won';
    won.seated = 3;
    won.strikes = 0;
    expect(ladderScore(won)).toBe(3 * 80 + won.snake.length * 8 + 300);
  });
});
