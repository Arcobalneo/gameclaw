import { describe, expect, it } from 'vitest';

import { TARGETS, YEAR_WEEKS } from '../src/content';
import {
  abort,
  act,
  actionsOf,
  canPact,
  canWar,
  createRun,
  detectionChance,
  recapOf,
  rescueChance,
  statusOf,
  type TinyState,
  type Weapon,
  weaponFromDraft,
} from '../src/engine';

function fresh(seed = 7, content = 'harvest', difficulty?: string): TinyState {
  return createRun({ seed, content, difficulty });
}

function ids(state: TinyState): string[] {
  return actionsOf(state).map((action) => action.id);
}

function phaseOf(state: TinyState): string {
  return state.phase;
}

function correctDodge(hazard: number): string {
  return ['dodge:right', 'dodge:left', 'dodge:duck'][hazard]!;
}

function wrongDodge(hazard: number): string {
  return ['dodge:left', 'dodge:right', 'dodge:left'][hazard]!;
}

function escapeDiscovery(state: TinyState, correct: boolean): void {
  state.phase = 'discovery';
  act(state, 'respond:flee');
  act(state, 'route:crumbs');
  while (phaseOf(state) === 'escape') {
    const hazard = state.escape!.hazard;
    act(state, correct ? correctDodge(hazard) : wrongDodge(hazard));
  }
}

const LIGHT_WEAPON: Weapon = {
  frame: 'match',
  head: 'feather',
  drive: 'bellows',
  name: '羽絨槌·火柴框·小風箱',
  power: 1,
  noise: 1,
  agility: 2,
};

describe('shrimp-conquest opening and information', () => {
  it('creates the same serialisable opening from the same seed', () => {
    const left = fresh(11);
    const right = fresh(11);
    expect(left).toEqual(right);
    expect(left.rng).toHaveLength(4);
    expect(JSON.parse(JSON.stringify(left))).toEqual(left);
    expect(statusOf(left).headline).toContain('豐穗國');
    expect(statusOf(left).headline).toContain(`1/${YEAR_WEEKS}`);
  });

  it('starts at the royal briefing unless --content selects a target', () => {
    const briefing = createRun({ seed: 7 });
    expect(briefing.phase).toBe('briefing');
    expect(ids(briefing)).toEqual(['target:bastion', 'target:harvest', 'target:mirror']);
    act(briefing, 'target:mirror');
    expect(briefing.phase).toBe('field');
    expect(briefing.target).toBe('mirror');
    expect(briefing.week).toBe(1);
    expect(fresh(7, 'target:bastion').target).toBe('bastion');
  });

  it('shows both conquest gates and action-specific detection odds', () => {
    const state = fresh(3, 'bastion');
    state.suspicion = 4;
    const lines = statusOf(state)
      .sections.find((section) => section.title === '王令')
      ?.lines.join('\n');
    expect(lines).toContain(`控制 0/${TARGETS.bastion.controlNeed}`);
    expect(lines).toContain(`影響 0/${TARGETS.bastion.influenceNeed}`);
    expect(detectionChance(state, 'steal')).toBe(50);
    expect(detectionChance(state, 'aid')).toBe(0);
    const steal = actionsOf(state).find((action) => action.id === 'steal');
    expect(steal?.detail).toContain('50%');
  });

  it('rejects actions that belong to another phase', () => {
    const state = fresh();
    expect(() => act(state, 'assemble')).toThrow('現在不能執行');
    expect(state.week).toBe(1);
  });
});

describe('shrimp-conquest field economy and weapon design', () => {
  it('buys food at home and spends one weekly ration', () => {
    const state = fresh(4);
    state.suspicion = 4;
    const food = state.food;
    act(state, 'buy');
    expect(state.coins).toBe(5);
    expect(state.food).toBe(food + 6);
    expect(state.suspicion).toBe(2);
    expect(state.week).toBe(2);
    expect(state.outcome).toBe('ongoing');
  });

  it('steals leftovers, records the mouse excuse and resolves a seeded check', () => {
    const state = fresh(5);
    const result = act(state, 'steal');
    expect(state.steals).toBe(1);
    expect(result.log.join('\n')).toContain('又是老鼠');
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'detection', action: 'steal', chance: 14 }),
    );
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'daily' }));
  });

  it('combines three component slots into a weapon without spending weeks in the draft', () => {
    const state = fresh(7);
    act(state, 'design');
    expect(state.phase).toBe('workshop');
    expect(ids(state)).toContain('part:frame:thimble');
    act(state, 'part:frame:thimble');
    act(state, 'part:head:needle');
    act(state, 'part:drive:spring');
    expect(state.week).toBe(1);
    expect(ids(state)).toContain('assemble');
    act(state, 'assemble');
    expect(state.weapon).toMatchObject({ power: 6, noise: 2, agility: 0 });
    expect(state.parts).toBe(0);
    expect(state.week).toBe(2);
    expect(ids(state)).toContain('raid');
  });

  it('can reset a design and makes tickle weapons honest', () => {
    const state = fresh(8);
    act(state, 'design');
    act(state, 'part:frame:match');
    act(state, 'part:reset');
    expect(state.draft).toEqual({ frame: null, head: null, drive: null });
    act(state, 'part:frame:match');
    act(state, 'part:head:feather');
    act(state, 'part:drive:bellows');
    const result = act(state, 'assemble');
    expect(state.weapon?.power).toBe(1);
    expect(result.log.join('\n')).toContain('抓癢');
    const raid = act(state, 'raid');
    expect(raid.log.join('\n')).toContain('不是重炮');
  });

  it('computes stats from every component and hides an unaffordable assembly', () => {
    const weapon = weaponFromDraft({ frame: 'spool', head: 'feather', drive: 'rubber' });
    expect(weapon).toMatchObject({ power: 1, agility: 4 });
    const state = fresh(2);
    state.parts = 1;
    act(state, 'design');
    act(state, 'part:frame:thimble');
    act(state, 'part:head:needle');
    act(state, 'part:drive:spring');
    expect(ids(state)).not.toContain('assemble');
    expect(ids(state)).toContain('cancel');
    act(state, 'cancel');
    expect(state.phase).toBe('field');
    expect(state.week).toBe(1);
  });
});

describe('shrimp-conquest escape and rescue', () => {
  it('uses route choices and visible countdown beats for a successful escape', () => {
    const state = fresh(9);
    const week = state.week;
    escapeDiscovery(state, true);
    expect(state.phase).toBe('field');
    expect(state.escapes).toBe(1);
    expect(state.captures).toBe(0);
    expect(state.week).toBe(week);
  });

  it('captures after two wrong dodges and offers rescue actions', () => {
    const state = fresh(10);
    state.coins = 8;
    escapeDiscovery(state, false);
    expect(state.phase).toBe('captured');
    expect(state.capture?.attemptsLeft).toBe(3);
    expect(ids(state)).toContain('rescue:ransom');
    expect(ids(state)).toContain('rescue:wait');
    const result = act(state, 'rescue:ransom');
    expect(result.log.join('\n')).toContain('四枚銀幣');
    expect(state.phase).toBe('field');
    expect(state.coins).toBe(4);
    expect(state.rescues).toBe(1);
  });

  it('lets known adults answer a signal and spends their goodwill', () => {
    const state = fresh(12);
    state.goodwill = 6;
    state.intel = 4;
    state.phase = 'captured';
    state.capture = { attemptsLeft: 3 };
    act(state, 'rescue:signal');
    expect(state.phase).toBe('field');
    expect(state.goodwill).toBe(4);
    expect(state.intel).toBe(3);
    expect(state.rescues).toBe(1);
  });

  it('ends in captivity when the last rescue attempt fails', () => {
    let captured: TinyState | undefined;
    for (let seed = 1; seed <= 30 && !captured; seed += 1) {
      const state = fresh(seed);
      state.goodwill = 0;
      state.phase = 'captured';
      state.capture = { attemptsLeft: 1 };
      const result = act(state, 'rescue:wait');
      if (result.events?.[0]?.success === false) captured = state;
    }
    expect(captured?.outcome).toBe('lost');
    expect(captured?.ending).toBe('captive');
    expect(recapOf(captured!).title).toContain('俘虜');
  });

  it('makes rescue odds visible and deterministic', () => {
    const state = fresh(13);
    expect(rescueChance(state)).toBe(39);
    state.goodwill = 5;
    state.weapon = { ...LIGHT_WEAPON, agility: 4 };
    expect(rescueChance(state)).toBe(80);
  });
});

describe('shrimp-conquest timing and combo combat', () => {
  it('wins a fight by reading the cursor and building heavy-hit combos', () => {
    const state = fresh(14);
    state.weapon = weaponFromDraft({ frame: 'thimble', head: 'needle', drive: 'spring' });
    state.phase = 'discovery';
    act(state, 'respond:fight');
    let guard = 0;
    while (phaseOf(state) === 'combat' && guard < 8) {
      const combat = state.combat!;
      const accuracy = Math.max(0, 3 - Math.abs(combat.cursor - combat.opening));
      act(state, accuracy >= 2 ? 'strike:heavy' : accuracy > 0 ? 'strike:quick' : 'brace');
      guard += 1;
    }
    expect(state.phase).toBe('field');
    expect(state.fightsWon).toBe(1);
    expect(state.control).toBe(2);
    expect(state.outcome).toBe('ongoing');
  });

  it('writes accuracy, damage and combo into strike events', () => {
    const state = fresh(15);
    state.weapon = weaponFromDraft({ frame: 'thimble', head: 'needle', drive: 'spring' });
    state.phase = 'combat';
    state.combat = {
      round: 1,
      maxRounds: 5,
      cursor: 2,
      opening: 2,
      enemy: 30,
      combo: 0,
      guarded: false,
    };
    const first = act(state, 'strike:heavy');
    expect(first.events?.[0]).toMatchObject({ accuracy: 3, damage: 9, combo: 1 });
    state.combat!.cursor = state.combat!.opening;
    const second = act(state, 'strike:heavy');
    expect(second.events?.[0]).toMatchObject({ accuracy: 3, damage: 11, combo: 2 });
  });

  it('captures a fighter whose last health is lost to a counter', () => {
    const state = fresh(16);
    state.health = 1;
    state.phase = 'combat';
    state.combat = {
      round: 1,
      maxRounds: 5,
      cursor: 0,
      opening: 5,
      enemy: 9,
      combo: 0,
      guarded: false,
    };
    const result = act(state, 'strike:quick');
    expect(result.events?.[0]).toMatchObject({ accuracy: 0, damage: 0, health: 0 });
    expect(state.phase).toBe('captured');
    expect(state.captures).toBe(1);
  });

  it('lets brace preserve a combo without dealing damage', () => {
    const state = fresh(17);
    state.phase = 'combat';
    state.combat = {
      round: 2,
      maxRounds: 5,
      cursor: 1,
      opening: 4,
      enemy: 8,
      combo: 2,
      guarded: false,
    };
    const result = act(state, 'brace');
    expect(state.combat?.combo).toBe(2);
    expect(state.combat?.enemy).toBe(8);
    expect(state.combat?.round).toBe(3);
    expect(result.events?.[0]?.type).toBe('combat-brace');
  });
});

describe('shrimp-conquest endings', () => {
  it('settles a military conquest when all war gates are met', () => {
    const state = fresh(18);
    state.control = TARGETS.harvest.controlNeed;
    state.intel = TARGETS.harvest.warIntelNeed;
    state.weapon = { ...LIGHT_WEAPON, power: TARGETS.harvest.powerNeed };
    expect(canWar(state)).toBe(true);
    act(state, 'conquer:war');
    expect(state.outcome).toBe('won');
    expect(state.ending).toBe('war');
    expect(actionsOf(state)).toEqual([]);
  });

  it('settles a diplomatic conquest without requiring a weapon', () => {
    const state = fresh(19);
    state.influence = TARGETS.harvest.influenceNeed;
    state.goodwill = TARGETS.harvest.goodwillNeed;
    state.intel = TARGETS.harvest.pactIntelNeed;
    expect(canPact(state)).toBe(true);
    act(state, 'conquer:pact');
    expect(state.outcome).toBe('won');
    expect(state.ending).toBe('pact');
    expect(recapOf(state).cause).toContain('盟約');
  });

  it('reveals the homeland reversal for either way of conquering the mirror kingdom', () => {
    for (const route of ['war', 'pact'] as const) {
      const state = fresh(20, 'mirror');
      if (route === 'war') {
        state.control = TARGETS.mirror.controlNeed;
        state.intel = TARGETS.mirror.warIntelNeed;
        state.weapon = { ...LIGHT_WEAPON, power: TARGETS.mirror.powerNeed };
      } else {
        state.influence = TARGETS.mirror.influenceNeed;
        state.goodwill = TARGETS.mirror.goodwillNeed;
        state.intel = TARGETS.mirror.pactIntelNeed;
      }
      act(state, `conquer:${route}`);
      expect(state.outcome).toBe('won');
      expect(state.ending).toBe('mirror');
      expect(state.cause).toContain('自己的小人國');
    }
  });

  it('ends at the fifty-second week and separates starvation from abort', () => {
    const late = fresh(21);
    late.week = YEAR_WEEKS;
    act(late, 'rest');
    expect(late.outcome).toBe('lost');
    expect(late.ending).toBe('deadline');

    const hungry = fresh(22);
    hungry.food = 0;
    hungry.health = 1;
    act(hungry, 'design');
    act(hungry, 'part:frame:match');
    act(hungry, 'part:head:pepper');
    act(hungry, 'part:drive:rubber');
    act(hungry, 'assemble');
    expect(hungry.outcome).toBe('lost');
    expect(hungry.ending).toBe('starvation');

    const stopped = fresh(23);
    abort(stopped);
    expect(stopped.outcome).toBe('aborted');
    expect(stopped.ending).toBe('aborted');
  });
});

describe('shrimp-conquest replay and legal playthrough', () => {
  it('replays random events, detection and resource changes exactly', () => {
    const left = fresh(29);
    const right = fresh(29);
    for (const action of ['aid', 'steal']) {
      act(left, action);
      act(right, action);
    }
    expect(left).toEqual(right);
    expect(statusOf(left)).toEqual(statusOf(right));
  });

  it('can reach a diplomatic ending using only returned legal actions', () => {
    const state = fresh(31, 'harvest', 'easy');
    let guard = 0;
    while (state.outcome === 'ongoing' && guard < 80) {
      const legal = ids(state);
      if (legal.includes('conquer:pact')) act(state, 'conquer:pact');
      else if (state.phase === 'discovery') act(state, 'respond:flee');
      else if (state.phase === 'escape') {
        if (!state.escape!.route) act(state, 'route:crumbs');
        else act(state, correctDodge(state.escape!.hazard));
      } else if (state.phase === 'captured') {
        if (legal.includes('rescue:signal')) act(state, 'rescue:signal');
        else if (legal.includes('rescue:ransom')) act(state, 'rescue:ransom');
        else act(state, 'rescue:wait');
      } else if (state.food < 3 && legal.includes('buy')) act(state, 'buy');
      else if (state.food < 3) act(state, 'steal');
      else if (state.goodwill < TARGETS.harvest.goodwillNeed) act(state, 'aid');
      else if (state.intel < TARGETS.harvest.pactIntelNeed) act(state, 'scout');
      else if (state.coins < 5) act(state, 'earn');
      else act(state, 'negotiate');
      guard += 1;
    }
    expect(guard).toBeLessThan(80);
    expect(state.outcome).toBe('won');
    expect(state.ending).toBe('pact');
  });
});
