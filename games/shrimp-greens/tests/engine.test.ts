import { describe, expect, it } from 'vitest';

import { FAMILY_IDS, GENDER_IDS, PERSONALITY_IDS, REASON_IDS } from '../src/content';
import { definition } from '../src/definition';
import {
  abort,
  act,
  actionsOf,
  createRun,
  MAX_TURNS,
  nameOdds,
  recapOf,
  type Scene,
  sceneOf,
  statusOf,
  type VegeState,
} from '../src/engine';

function fresh(seed = 7, content?: string, difficulty?: string): VegeState {
  return createRun({ seed, content, difficulty });
}

function ids(state: VegeState): string[] {
  return actionsOf(state).map((action) => action.id);
}

function put(state: VegeState, scene: Partial<Scene> & Pick<Scene, 'id' | 'kind' | 'who'>): void {
  const current = sceneOf(state);
  state.scenes[state.turn] = {
    ...current,
    title: scene.id,
    heat: 1,
    vegOnTable: false,
    thin: false,
    phase: current.phase,
    blurb: '测试席',
    ...scene,
  };
}

describe('shrimp-greens opening', () => {
  it('replays the same opening from the same seed', () => {
    expect(fresh(7)).toEqual(fresh(7));
    expect(fresh(7, 'sharp:meat')).toEqual(fresh(7, 'sharp:meat'));
  });

  it('varies gender, personality and family across seeds', () => {
    const genders = new Set(GENDER_IDS.map(() => ''));
    genders.clear();
    const personalities = new Set<string>();
    const families = new Set<string>();
    for (let seed = 1; seed <= 36; seed += 1) {
      const state = fresh(seed);
      genders.add(state.gender);
      personalities.add(state.personality);
      families.add(state.family);
      expect(GENDER_IDS).toContain(state.gender);
      expect(PERSONALITY_IDS).toContain(state.personality);
      expect(FAMILY_IDS).toContain(state.family);
      expect(REASON_IDS).toContain(state.reason);
    }
    expect(genders.size).toBeGreaterThan(1);
    expect(personalities.size).toBeGreaterThan(1);
    expect(families.size).toBeGreaterThan(1);
  });

  it('locks personality and family from --content without calling it prenatal', () => {
    const state = fresh(3, 'sharp:meat');
    expect(state.personality).toBe('sharp');
    expect(state.family).toBe('meat');
    expect(state.houseCreed).toBe('none');
    expect(state.creedGap).toBe(false);
    const who = statusOf(state).sections.find((section) => section.title === '你是谁');
    expect(who?.lines.join('')).toContain('不是「胎内素」');
    expect(who?.lines.join('')).toContain('自己选的素食者');
    expect(statusOf(state).headline).toContain('烈');
    expect(statusOf(state).headline).toContain('无肉不欢');
    expect(statusOf(state).headline).toContain(`第 1/${MAX_TURNS} 席`);
  });

  it('forces a creed gap in a vegetarian house and keeps meat off the clash track', () => {
    const veg = fresh(5, 'soft:veg:gap');
    expect(veg.family).toBe('veg');
    expect(veg.creedGap).toBe(true);
    expect(veg.houseCreed).not.toBe(veg.reason);
    expect(veg.houseCreed).not.toBe('none');
    const meat = fresh(5, 'soft:meat');
    expect(meat.clash).toBe(0);
    expect(meat.home).toBeLessThan(veg.home);
  });

  it('deals sixteen seats and follows the house on the braise', () => {
    const meat = fresh(8, 'steady:meat');
    const veg = fresh(8, 'steady:veg');
    expect(meat.scenes).toHaveLength(16);
    expect(meat.scenes.filter((scene) => scene.phase === 'home')).toHaveLength(4);
    const meatBraise = meat.scenes.find((scene) => scene.id === 'braise');
    const vegBraise = veg.scenes.find((scene) => scene.id === 'braise');
    const breakfast = meat.scenes.find((scene) => scene.id === 'breakfast');
    expect(breakfast?.vegOnTable).toBe(true);
    expect(meatBraise?.vegOnTable).toBe(false);
    expect(vegBraise?.vegOnTable).toBe(true);
    expect(meat.scenes.find((scene) => scene.id === 'homecoming')?.heat).toBe(3);
    expect(veg.scenes.find((scene) => scene.id === 'homecoming')?.heat).toBe(1);
  });
});

describe('shrimp-greens action space', () => {
  it('hides a speech that cannot succeed and shows a bite only when meat is on the table', () => {
    const state = fresh(1, 'sharp:meat');
    put(state, { id: 'braise', kind: 'meal', who: 'family', heat: 3, vegOnTable: false });
    expect(nameOdds(state, sceneOf(state)).faces).toBe(0);
    expect(ids(state)).not.toContain('name');
    expect(ids(state)).toContain('bite');
    state.prep = 0;
    expect(ids(state)).not.toContain('bring');
    state.prep = 1;
    expect(ids(state)).toContain('bring');
  });

  it('offers stock on your own stove and drops it once the boxes are full', () => {
    const state = fresh(1, 'steady:veg');
    put(state, { id: 'kitchen', kind: 'kitchen', who: 'self', heat: 0, vegOnTable: true });
    expect(ids(state)).toContain('stock');
    expect(ids(state)).not.toContain('bite');
    state.prep = 3;
    expect(ids(state)).not.toContain('stock');
  });

  it('charges a male guest an extra point of face at the client table', () => {
    const male = fresh(4, 'male:steady:meat');
    const female = fresh(4, 'female:steady:meat');
    for (const state of [male, female]) {
      put(state, { id: 'client', kind: 'meal', who: 'work', heat: 3, vegOnTable: false });
    }
    act(male, 'hold');
    act(female, 'hold');
    expect(female.room - male.room).toBe(1);
    expect(male.body).toBe(female.body);
  });

  it('rejects a bite when the table is already vegetarian', () => {
    const state = fresh(1, 'steady:veg');
    put(state, { id: 'breakfast', kind: 'meal', who: 'family', heat: 1, vegOnTable: true });
    expect(ids(state)).not.toContain('bite');
    expect(() => act(state, 'bite')).toThrow('不能做');
  });
});

describe('shrimp-greens endings', () => {
  it('blows up a meat household when clash, body and home are all low', () => {
    const state = fresh(2, 'steady:meat');
    const script: Array<{
      scene: Partial<Scene> & Pick<Scene, 'id' | 'kind' | 'who'>;
      action: string;
    }> = [
      {
        scene: { id: 'braise', kind: 'meal', who: 'family', heat: 3, vegOnTable: false },
        action: 'hold',
      },
      {
        scene: { id: 'guest', kind: 'meal', who: 'family', heat: 2, vegOnTable: false },
        action: 'hold',
      },
      {
        scene: { id: 'breakfast', kind: 'meal', who: 'family', heat: 1, vegOnTable: true },
        action: 'share',
      },
      {
        scene: { id: 'hotpot', kind: 'meal', who: 'class', heat: 3, vegOnTable: false },
        action: 'hold',
      },
      {
        scene: { id: 'newyear', kind: 'meal', who: 'family', heat: 3, vegOnTable: false },
        action: 'hold',
      },
    ];
    for (const step of script) {
      expect(state.outcome).toBe('ongoing');
      put(state, step.scene);
      act(state, step.action);
    }
    expect(state.outcome).toBe('lost');
    expect(state.ending).toBe('clash');
    expect(state.clash).toBeGreaterThanOrEqual(3);
    expect(state.home).toBeGreaterThan(0);
    expect(state.body).toBeGreaterThan(0);
    expect(state.cause).toContain('冲突');
    const recap = recapOf(state);
    expect(recap.lessons.join('')).toContain('冲突');
    expect(recap.memoryPrompt).toContain('不要写成所有素食者的规律');
  });

  it('lets a vegetarian house name the gap and settle apart', () => {
    const state = fresh(6, 'soft:veg:gap');
    expect(state.creedGap).toBe(true);
    const familySeat = state.scenes.findIndex((scene) => scene.who === 'family');
    state.turn = familySeat;
    expect(ids(state)).toContain('differ');
    expect(ids(state)).not.toContain('settle:split');
    act(state, 'differ');
    expect(state.namedDifference).toBe(true);
    state.turn = 12;
    state.line = Math.max(state.line, 5);
    state.home = Math.max(state.home, 4);
    state.body = Math.max(state.body, 3);
    expect(ids(state)).toContain('settle:split');
    act(state, 'settle:split');
    expect(state.outcome).toBe('won');
    expect(state.ending).toBe('split');
    expect(recapOf(state).title).toContain('分席');
  });

  it('ends in anorexia, a dissolved line, a cutoff, a label, or no settlement', () => {
    const hungry = fresh(1, 'steady:veg');
    hungry.body = 1;
    hungry.room = 5;
    put(hungry, { id: 'hotpot', kind: 'meal', who: 'class', heat: 3, vegOnTable: false });
    act(hungry, 'hold');
    expect(hungry.ending).toBe('anorexia');
    expect(hungry.outcome).toBe('lost');

    const bite = fresh(1, 'soft:meat');
    bite.line = 2;
    bite.body = 5;
    bite.home = 4;
    put(bite, { id: 'hotpot', kind: 'meal', who: 'class', heat: 3, vegOnTable: false });
    act(bite, 'bite');
    expect(bite.ending).toBe('dissolved');
    expect(bite.body).toBeGreaterThan(0);

    const cutoff = fresh(1, 'steady:meat');
    cutoff.home = 1;
    cutoff.body = 5;
    put(cutoff, { id: 'guest', kind: 'meal', who: 'family', heat: 2, vegOnTable: false });
    act(cutoff, 'hold');
    expect(cutoff.ending).toBe('cutoff');

    const labeled = fresh(1, 'steady:veg');
    labeled.room = 1;
    labeled.body = 5;
    put(labeled, { id: 'picnic', kind: 'meal', who: 'class', heat: 2, vegOnTable: false });
    act(labeled, 'hold');
    expect(labeled.ending).toBe('labeled');

    const loose = fresh(1, 'steady:veg');
    loose.turn = 15;
    loose.body = 5;
    loose.home = 6;
    loose.room = 5;
    loose.line = 5;
    loose.prep = 0;
    put(loose, {
      id: 'ownstove',
      kind: 'kitchen',
      who: 'self',
      heat: 0,
      vegOnTable: true,
      phase: 'seat',
    });
    expect(ids(loose)).toContain('settle:truce');
    act(loose, 'hold');
    expect(loose.ending).toBe('loose');
    expect(loose.outcome).toBe('lost');
  });

  it('settles a hosted table, a truce and an outside script once the gates are open', () => {
    const host = fresh(1, 'sharp:veg');
    host.turn = 12;
    host.line = 6;
    host.body = 3;
    host.prep = 1;
    host.home = 3;
    act(host, 'settle:host');
    expect(host.outcome).toBe('won');
    expect(host.ending).toBe('host');
    expect(host.prep).toBe(0);

    const truce = fresh(1, 'soft:meat');
    truce.turn = 12;
    truce.home = 6;
    truce.body = 3;
    truce.line = 2;
    truce.room = 3;
    act(truce, 'settle:truce');
    expect(truce.ending).toBe('truce');

    const script = fresh(1, 'steady:meat');
    script.turn = 12;
    script.room = 7;
    script.body = 3;
    script.line = 4;
    script.home = 3;
    act(script, 'settle:script');
    expect(script.ending).toBe('script');
    expect(script.outcome).toBe('won');
  });

  it('recommends an available settlement ahead of hold', () => {
    const state = fresh(1, 'soft:meat');
    state.turn = 12;
    state.home = 6;
    state.body = 3;
    state.line = 2;
    state.room = 3;
    put(state, {
      id: 'ownstove',
      kind: 'kitchen',
      who: 'self',
      heat: 0,
      vegOnTable: true,
      phase: 'seat',
    });
    expect(ids(state)).toContain('hold');
    expect(ids(state)).toContain('settle:truce');
    expect(ids(state)[0]).toBe('settle:truce');
  });

  it('writes the dice into the event when a talk can land', () => {
    const state = fresh(9, 'steady:veg', 'easy');
    state.creedGap = false;
    put(state, { id: 'breakfast', kind: 'meal', who: 'family', heat: 0, vegOnTable: true });
    expect(nameOdds(state, sceneOf(state)).faces).toBe(6);
    const result = act(state, 'name');
    const check = result.events?.find((event) => event.type === 'check');
    expect(check).toMatchObject({ action: 'name', success: true });
    expect(state.nameWins).toBe(1);
    expect(state.home).toBeGreaterThan(3);
  });

  it('fails a talk the sharp personality cannot win at a loud family table', () => {
    const state = fresh(9, 'sharp:meat', 'hard');
    state.home = 5;
    state.body = 5;
    put(state, { id: 'newyear', kind: 'meal', who: 'family', heat: 3, vegOnTable: false });
    expect(ids(state)).not.toContain('name');
    const result = act(state, 'name');
    const check = result.events?.find((event) => event.type === 'check');
    expect(check).toMatchObject({ success: false });
    expect(state.clash).toBe(1);
    expect(state.outcome).toBe('ongoing');
  });
});

describe('shrimp-greens replay', () => {
  it('plays two copies of a seed into the same ending', () => {
    const play = (seed: number, content: string): VegeState => {
      const state = fresh(seed, content);
      let guard = 0;
      while (state.outcome === 'ongoing' && guard < 20) {
        act(state, policy(state));
        guard += 1;
      }
      return state;
    };
    const left = play(11, 'steady:veg');
    const right = play(11, 'steady:veg');
    expect(left.ending).toBe(right.ending);
    expect(left.timeline).toEqual(right.timeline);
    expect(left.score).toBe(right.score);
    expect(left.outcome).not.toBe('ongoing');
  });

  it('can win from a plate-first policy on both kinds of house', () => {
    const seen = new Set<string>();
    let wins = 0;
    let meatWins = 0;
    let vegWins = 0;
    for (const content of ['soft:veg', 'steady:veg', 'sharp:meat', 'steady:meat', 'soft:meat']) {
      for (let seed = 1; seed <= 24; seed += 1) {
        const state = fresh(seed, content);
        let guard = 0;
        while (state.outcome === 'ongoing' && guard < 20) {
          act(state, policy(state));
          guard += 1;
        }
        seen.add(`${content}:${state.ending}`);
        if (state.outcome !== 'won') continue;
        wins += 1;
        if (state.family === 'meat') meatWins += 1;
        if (state.family === 'veg') vegWins += 1;
      }
    }
    expect(wins, [...seen].sort().join(' | ')).toBeGreaterThan(10);
    expect(meatWins, [...seen].sort().join(' | ')).toBeGreaterThan(0);
    expect(vegWins).toBeGreaterThan(0);
  });
});

describe('shrimp-greens abort', () => {
  it('keeps an ongoing recap ongoing', () => {
    expect(definition.recap(fresh(1)).outcome).toBe('ongoing');
  });

  it('records an abort without calling it a win or a loss', () => {
    const state = fresh(1);
    abort(state);
    expect(state.outcome).toBe('aborted');
    expect(state.ending).toBe('aborted');
    expect(actionsOf(state)).toEqual([]);
    expect(recapOf(state).outcome).toBe('aborted');
    expect(definition.recap(state).outcome).toBe('aborted');
  });
});

function policy(state: VegeState): string {
  const choices = ids(state);
  const has = (id: string): boolean => choices.includes(id);
  for (const id of ['settle:host', 'settle:split', 'settle:script', 'settle:truce']) {
    if (has(id)) return id;
  }
  if (has('stock')) return 'stock';
  if (has('bring')) return 'bring';
  const scene = sceneOf(state);
  if (has('name')) {
    const odds = nameOdds(state, scene);
    if (odds.faces >= 4 && (state.home <= 2 || state.room <= 2 || state.line <= 2)) return 'name';
  }
  if (scene.vegOnTable && has('hold')) return 'hold';
  if (has('differ') && state.home >= 5 && state.line >= 3) return 'differ';
  if (has('hold') && state.line <= 2 && state.home > 1 && state.body > 1 && state.room > 1) {
    return 'hold';
  }
  if (has('share') && state.line > 1) return 'share';
  if (has('hold') && state.body > 1 && state.home > 1 && state.room > 1) return 'hold';
  if (has('share')) return 'share';
  if (has('hold')) return 'hold';
  return choices[0] ?? 'hold';
}
