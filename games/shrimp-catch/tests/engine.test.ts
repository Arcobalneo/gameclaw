import { Rng } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';

import { attemptCapture, captureChance } from '../src/engine/capture.js';
import { act } from '../src/engine/index.js';
import {
  AFFIXES,
  makeCreature,
  SKILL_LIST,
  SKILLS,
  SPECIES,
  SPECIES_LIST,
} from '../src/engine/species.js';
import { createState, type TamerState } from '../src/engine/state.js';
import { checkUnlocks } from '../src/engine/world.js';

const NOW = '2026-01-01T00:00:00.000Z';

function fresh(seed = 7): TamerState {
  return createState({ seed, now: NOW });
}

function playBattleToEnd(state: TamerState, maxTurns = 20): void {
  let guard = 0;
  while (state.phase === 'battle' && guard < maxTurns) {
    act(state, 'move:0');
    guard += 1;
  }
}

describe('content loading', () => {
  it('loads every species pool from data', () => {
    expect(SPECIES_LIST).toHaveLength(111);
    expect(SPECIES.size).toBe(111);
    expect(new Set(SPECIES_LIST.map((species) => species.id)).size).toBe(111);
    for (const species of SPECIES_LIST) {
      expect(SKILLS.has(species.base_skill)).toBe(true);
      expect(species.capture_base_rate).toBeGreaterThan(0);
    }
  });

  it('loads the skill, affix and zone catalogues', () => {
    expect(SKILL_LIST).toHaveLength(701);
    expect(AFFIXES).toHaveLength(100);
    expect(SKILLS.size).toBe(701);
  });

  it('computes level-scaled stats deterministically', () => {
    const creature = makeCreature('reef_shrimp', 5, { uid: 'test' });
    expect(creature.stats.hp).toBe(68);
    expect(creature.stats.atk).toBe(36);
    expect(creature.hp).toBe(68);
    expect(creature.moves).toEqual(['潮击']);
    expect(creature.affixSlots).toHaveLength(2);
  });
});

describe('determinism', () => {
  function play(seed: number): TamerState {
    const state = fresh(seed);
    act(state, 'menu:battle');
    expect(state.phase).toBe('encounter');
    act(state, 'encounter:fight');
    playBattleToEnd(state);
    return state;
  }

  it('replays the same seed and action sequence exactly', () => {
    const a = play(7);
    const b = play(7);
    expect(a).toEqual(b);
    expect(a.rng).toEqual(b.rng);
    expect(a.wild).toBeNull();
    expect(a.turn).toBe(b.turn);
  });

  it('changes the encounter with a different seed', () => {
    const a = fresh(7);
    const b = fresh(8);
    act(a, 'menu:battle');
    act(b, 'menu:battle');
    expect(`${a.wild?.speciesId}:${a.wild?.level}:${a.wild?.shiny}`).not.toBe(
      `${b.wild?.speciesId}:${b.wild?.level}:${b.wild?.shiny}`,
    );
  });
});

describe('capture', () => {
  it('rewards weakened targets and caps at 95%', () => {
    const state = fresh(3);
    const wild = makeCreature('reef_shrimp', 5, { uid: 'wild' });
    state.wild = wild;
    state.phase = 'catch';
    wild.hp = 1;
    const weakened = captureChance(state, wild, 'net_spirit');
    expect(weakened).toBeCloseTo(0.95, 5);
    wild.hp = wild.stats.hp;
    const healthy = captureChance(state, wild, 'net_basic');
    expect(healthy).toBeLessThan(weakened);
    expect(healthy).toBeGreaterThan(0.5);
  });

  it('captures a weakened creature into the party with rolled affixes', () => {
    const state = fresh(3);
    state.wild = makeCreature('reef_shrimp', 5, { uid: 'wild' });
    state.wild.hp = 1;
    state.phase = 'catch';
    state.items.net_spirit = 20;
    const rng = Rng.restore(state.rng);
    let success = false;
    for (let i = 0; i < 20 && !success; i += 1) {
      success = attemptCapture(state, rng, 'net_spirit').success;
    }
    expect(success).toBe(true);
    const captured = state.party.filter((creature) => creature !== null);
    expect(captured).toHaveLength(2);
    expect(state.dexCaught).toContain('reef_shrimp');
    expect(state.totalCaptures).toBe(1);
    const newcomer = state.party[1];
    expect(newcomer?.affixSlots).toHaveLength(2);
    expect(newcomer?.affixSlots.every((slot) => slot.affixId.length > 0)).toBe(true);
  });

  it('runs the catch-menu actions end to end', () => {
    const state = fresh(7);
    act(state, 'menu:battle');
    expect(state.phase).toBe('encounter');
    act(state, 'encounter:catch');
    expect(state.phase).toBe('catch');
    act(state, 'catch:bait');
    expect(state.catchBait).toBe(true);
    act(state, 'catch:ball');
    expect(['explore', 'menu', 'battle']).toContain(state.phase);
  });
});

describe('battle', () => {
  it('finishes a wild battle, grants EXP and does not create a memorial', () => {
    const state = fresh(7);
    state.wild = makeCreature('reef_shrimp', 5, { uid: 'wild' });
    state.wild.hp = 1;
    state.phase = 'encounter';
    act(state, 'encounter:fight');
    expect(state.phase).toBe('battle');
    const result = act(state, 'move:0');
    expect(result.log.join('\n')).toContain('倒下');
    expect(state.battle).toBeNull();
    expect(state.phase).not.toBe('battle');
    expect(state.outcome).toBe('ongoing');
    expect(state.totalBattles).toBe(1);
    expect(state.party[0]?.exp).toBeGreaterThan(0);
    expect(state.memorial).toHaveLength(0);
  });

  it('revives wild-battle faints instead of killing them', () => {
    const state = fresh(3);
    const lead = state.party[0];
    expect(lead).not.toBeNull();
    if (!lead) return;
    lead.hp = 1;
    state.wild = makeCreature('abyss_claw_king', 30, { uid: 'boss' });
    state.phase = 'encounter';
    act(state, 'encounter:fight');
    playBattleToEnd(state, 10);
    expect(state.phase).toBe('menu');
    expect(state.memorial).toHaveLength(0);
    expect(state.party[0]?.dead).toBe(false);
    expect(state.party[0]?.hp).toBeGreaterThan(0);
    expect(state.totalBattles).toBe(1);
  });

  it('swaps to a living party member when the lead falls', () => {
    const state = fresh(4);
    const lead = state.party[0];
    expect(lead).not.toBeNull();
    if (!lead) return;
    lead.hp = 1;
    state.party[1] = makeCreature('rock_crab', 8, { uid: 'reserve' });
    state.wild = makeCreature('rock_crab', 10, { uid: 'wild' });
    state.phase = 'encounter';
    act(state, 'encounter:fight');
    let swapped = false;
    for (let i = 0; i < 8 && state.battle; i += 1) {
      act(state, 'move:0');
      if (state.battle?.playerIndex === 1) swapped = true;
    }
    expect(swapped).toBe(true);
  });
});

describe('workshop', () => {
  it('rerolls an affix deterministically while keeping its tier', () => {
    function reroll(seed: number): { state: TamerState; before: string; after: string } {
      const state = createState({ seed, now: NOW });
      state.items.jihe_core = 9;
      state.selectedCreature = 0;
      state.phase = 'workshop-slot';
      const slot = state.party[0]?.affixSlots[0];
      expect(slot).toBeDefined();
      const before = slot?.affixId ?? '';
      act(state, 'workshop:reroll:0');
      return { state, before, after: state.party[0]?.affixSlots[0]?.affixId ?? '' };
    }
    const a = reroll(42);
    const b = reroll(42);
    expect(a.after).toBe(b.after);
    expect(a.after).not.toBe(a.before);
    expect(a.state.rng).toEqual(b.state.rng);
    expect(a.state.items.jihe_core).toBe(6);
  });

  it('refuses to reroll a sealed slot and keeps the affix', () => {
    const state = fresh(5);
    state.items.jihe_core = 9;
    state.selectedCreature = 0;
    state.phase = 'workshop-slot';
    const slot = state.party[0]?.affixSlots[0];
    expect(slot).toBeDefined();
    if (!slot) return;
    slot.locked = true;
    const before = slot.affixId;
    const result = act(state, 'workshop:reroll:0');
    expect(result.log.join('')).toContain('封印');
    expect(slot.affixId).toBe(before);
    expect(state.items.jihe_core).toBe(9);
  });
});

describe('abyss', () => {
  it('permanently kills a creature that reaches 0 HP in battle', () => {
    const state = fresh(9);
    const weak = makeCreature('reef_shrimp', 1, { uid: 'weak' });
    weak.hp = 1;
    state.party = [weak, null, null, null, null, null];
    state.party[0] = weak;
    act(state, 'menu:abyss');
    act(state, 'abyss:enter');
    act(state, 'abyss:next');
    playBattleToEnd(state, 10);
    expect(state.memorial).toHaveLength(1);
    expect(state.memorial[0]?.cause).toContain('深渊');
    expect(state.totalDeaths).toBe(1);
    expect(state.party[0]).toBeNull();
    expect(state.abyssActive).toBe(false);
    expect(state.outcome).toBe('lost');
  });

  it('retreats without losing a healthy party and records the run', () => {
    const state = fresh(13);
    act(state, 'menu:abyss');
    act(state, 'abyss:enter');
    act(state, 'abyss:retreat');
    expect(state.phase).toBe('menu');
    expect(state.abyssActive).toBe(false);
    expect(state.totalRuns).toBe(1);
    expect(state.party.filter(Boolean)).toHaveLength(1);
  });

  it('unlocks zones from the deepest floor', () => {
    const state = fresh(1);
    expect(state.unlockedZones).toEqual(['reef_zone']);
    state.deepestFloor = 60;
    const unlocked = checkUnlocks(state);
    expect(unlocked).toHaveLength(5);
    expect(state.unlockedZones).toHaveLength(6);
  });
});
