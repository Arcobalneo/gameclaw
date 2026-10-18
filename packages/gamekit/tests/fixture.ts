import { Rng } from '../src/rng';
import type { ActionResult, ActionView, GameDefinition, RecapView, StatusView } from '../src/types';

export interface CounterState {
  seed: number;
  rng: number[];
  turn: number;
  count: number;
  outcome: 'ongoing' | 'won' | 'lost' | 'aborted';
  log: string[];
  target: number;
}

export const counterGame: GameDefinition<CounterState> = {
  meta: {
    id: 'test-counter',
    name: 'Counter',
    englishName: 'Counter',
    tagline: 'A fixture game',
    description: 'A tiny deterministic state machine used to test gamekit.',
    version: '2.0.0',
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: ['act inc to count', 'act abort to stop'],
  },

  create({ seed, now }): CounterState {
    const rng = Rng.fromSeed(seed);
    return {
      seed,
      rng: rng.serialize(),
      turn: 0,
      count: 0,
      outcome: 'ongoing',
      log: [`created at ${now}`],
      target: rng.int(2, 4),
    };
  },

  status(state: CounterState): StatusView {
    return {
      headline: `count ${state.count} / ${state.target}`,
      metrics: [
        { label: 'count', value: state.count },
        { label: 'target', value: state.target },
      ],
      sections: [],
      outcome: state.outcome,
      turn: state.turn,
    };
  },

  actions(state: CounterState): ActionView[] {
    if (state.outcome !== 'ongoing') return [];
    return [
      { id: 'inc', label: 'Increment', risk: 'low' },
      { id: 'dec', label: 'Decrement', risk: 'low' },
    ];
  },

  act(state: CounterState, actionId: string): ActionResult {
    state.turn += 1;
    if (actionId === 'inc') state.count += 1;
    if (actionId === 'dec') state.count -= 1;
    if (state.count >= state.target) {
      state.outcome = 'won';
      state.log.push('reached target');
      return { log: ['target reached'], events: [{ type: 'win', count: state.count }] };
    }
    return { log: [`count is now ${state.count}`] };
  },

  abort(state: CounterState): void {
    state.outcome = 'aborted';
  },

  recap(state: CounterState): RecapView {
    return {
      title: 'Counter run',
      outcome: state.outcome,
      cause: `finished at count ${state.count}`,
      metrics: [{ label: 'count', value: state.count }],
      timeline: state.log,
      lessons: ['small steps are still steps'],
      memoryPrompt: 'Write one observation into memory.',
    };
  },
};
