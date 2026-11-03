import { describe, expect, it } from 'vitest';

import type { DoctrineKey, EnemyKey, LaneKey } from '../src/content';
import { ENEMIES, STAGE } from '../src/content';
import { definition } from '../src/definition';
import {
  abort,
  act,
  createRun,
  deployOptions,
  doctrineOf,
  type TowerDefenseState,
  unitMaxHp,
} from '../src/engine';

const NOW = '2026-01-01T00:00:00.000Z';

function start(doctrine: DoctrineKey = 'crusher', seed = 7): TowerDefenseState {
  const state = createRun({ seed, now: NOW });
  act(state, `doctrine:${doctrine}`);
  return state;
}

function clearWave(state: TowerDefenseState): void {
  state.wavePlan[state.pulse - 1] = [];
}

function addEnemy(
  state: TowerDefenseState,
  key: EnemyKey,
  lane: LaneKey,
  pos: number,
  hp?: number,
): void {
  state.enemies.push({
    uid: state.nextUid,
    key,
    lane,
    pos,
    hp: hp ?? ENEMIES[key].maxHp,
    slowed: 0,
    exposed: 0,
  });
  state.nextUid += 1;
}

function section(state: TowerDefenseState, title: string): string[] {
  return definition.status(state).sections.find((item) => item.title === title)?.lines ?? [];
}

describe('tower defense engine', () => {
  it('starts in the doctrine phase and moves to setup after a pick', () => {
    const state = createRun({ seed: 7, now: NOW });
    expect(state.phase).toBe('doctrine');
    expect(state.outcome).toBe('ongoing');
    expect(definition.actions(state).map((action) => action.id)).toEqual([
      'doctrine:crusher',
      'doctrine:oracle',
      'doctrine:gambler',
    ]);
    act(state, 'doctrine:crusher');
    expect(state.phase).toBe('setup');
    expect(state.doctrine).toBe('crusher');
    expect(state.tide).toBe(8);
    expect(state.integrity).toBe(8);
    expect(state.roster).toHaveLength(6);
    expect(state.roster.find((unit) => unit.key === 'reef-guard')?.hp).toBe(14);
  });

  it('enters battle explicitly with ready and keeps pulse 1', () => {
    const state = start('crusher');
    expect(state.phase).toBe('setup');
    expect(state.pulse).toBe(1);
    act(state, 'ready');
    expect(state.phase).toBe('battle');
    expect(state.pulse).toBe(1);
    expect(state.outcome).toBe('ongoing');
  });

  it('is deterministic for the same seed and action sequence', () => {
    const script = [
      'deploy:reef-guard:C',
      'deploy:gate-stake:M1',
      'deploy:salt-spray:LP',
      'ready',
      'hold',
      'hold',
      'skill',
      'hold',
    ];
    const play = (): TowerDefenseState => {
      const state = start('crusher', 11);
      for (const action of script) act(state, action);
      return state;
    };
    const a = play();
    const b = play();
    expect(a.rng).toEqual(b.rng);
    expect(a.wavePlan).toEqual(b.wavePlan);
    expect(a.phase).toBe(b.phase);
    expect(a.pulse).toBe(b.pulse);
    expect(a.enemies).toEqual(b.enemies);
    expect(a.roster).toEqual(b.roster);
    expect(a.timeline).toEqual(b.timeline);
  });

  it('rejects illegal deploys and recalls', () => {
    const state = start('crusher');
    expect(() => act(state, 'deploy:reef-guard:LP')).toThrow();
    act(state, 'deploy:reef-guard:C');
    expect(() => act(state, 'deploy:gate-stake:C')).toThrow();
    expect(() => act(state, 'recall:RP')).toThrow();
    act(state, 'deploy:gate-stake:M1');
    act(state, 'deploy:salt-spray:LP');
    expect(() => act(state, 'deploy:molt-decoy:L1')).toThrow();
  });

  it('applies battle cooldown after recall and allows redeploy later', () => {
    const state = start('crusher');
    act(state, 'deploy:reef-guard:C');
    act(state, 'ready');
    const tideBeforeRecall = state.tide;
    act(state, 'recall:C');
    // Recall refunds 1, then the pulse resolves and pays the doctrine's income.
    expect(state.tide).toBe(tideBeforeRecall + 1 + doctrineOf(state).tidePerPulse);
    expect(state.roster.find((unit) => unit.key === 'reef-guard')?.slot).toBeNull();
    expect(() => act(state, 'deploy:reef-guard:C')).toThrow();
    act(state, 'hold');
    expect(state.roster.find((unit) => unit.key === 'reef-guard')?.readyPulse).toBe(3);
    expect(state.pulse).toBe(3);
    act(state, 'deploy:reef-guard:C');
    expect(state.roster.find((unit) => unit.key === 'reef-guard')?.slot).toBe('C');
  });

  it('lets setup recall reopen the slot immediately but never prints tide', () => {
    const state = start('gambler');
    act(state, 'deploy:molt-decoy:L1');
    const tideAfterDeploy = state.tide;
    act(state, 'recall:L1');
    expect(state.tide).toBe(tideAfterDeploy + 1);
    expect(state.roster.find((unit) => unit.key === 'molt-decoy')?.readyPulse).toBe(1);
    act(state, 'deploy:molt-decoy:L1');
    expect(state.roster.find((unit) => unit.key === 'molt-decoy')?.slot).toBe('L1');
  });

  it('blocks only as many light enemies as the choke capacity allows', () => {
    const state = start('crusher');
    act(state, 'deploy:reef-guard:C');
    act(state, 'ready');
    clearWave(state);
    addEnemy(state, 'pot-grunt', 'left', 2, 5);
    addEnemy(state, 'pot-grunt', 'left', 2, 5);
    addEnemy(state, 'pot-grunt', 'left', 2, 5);

    act(state, 'hold');

    expect(state.leaks).toBe(1);
    expect(state.integrity).toBe(state.maxIntegrity - 1);
    expect(state.enemies).toHaveLength(2);
    expect(state.lastBreakLane).toBe('left');
  });

  it('pushes a target back with the gate stake', () => {
    const state = start('crusher');
    act(state, 'deploy:gate-stake:L1');
    act(state, 'ready');
    clearWave(state);
    addEnemy(state, 'pot-grunt', 'left', 1, 5);

    act(state, 'hold');

    const enemy = state.enemies[0];
    expect(enemy).toBeDefined();
    expect(enemy?.hp).toBe(3);
    expect(enemy?.pos).toBe(1);
  });

  it('lets the scout slow a runner by one step', () => {
    const state = start('oracle');
    act(state, 'deploy:whisker-scout:LP');
    act(state, 'ready');
    clearWave(state);
    addEnemy(state, 'pump-runner', 'left', 0, 4);

    act(state, 'hold');

    const enemy = state.enemies[0];
    expect(enemy?.hp).toBe(2);
    expect(enemy?.pos).toBe(1);
  });

  it('targets armored enemies with the ring cutter', () => {
    const state = start('crusher');
    act(state, 'deploy:ring-cutter:LP');
    act(state, 'ready');
    clearWave(state);
    addEnemy(state, 'pot-grunt', 'left', 2, 5);
    addEnemy(state, 'ring-borer', 'left', 2, 2);

    const result = act(state, 'hold');

    expect(state.kills).toBe(1);
    expect(result.log.join('\n')).toContain('收壳了【塑圈钻头】');
  });

  it('buffs a path slot for one pulse with the crusher skill', () => {
    const state = start('crusher');
    act(state, 'deploy:gate-stake:L1');
    act(state, 'ready');
    clearWave(state);
    addEnemy(state, 'pot-grunt', 'left', 1, 4);
    const tideBefore = state.tide;

    act(state, 'skill');

    expect(state.skillUses).toBe(1);
    expect(state.tide).toBe(tideBefore - 2 + doctrineOf(state).tidePerPulse);
    expect(state.skillReadyPulse).toBe(4);
    expect(state.kills).toBe(1);
    expect(state.crusherSlot).toBeNull();
  });

  it('slows and exposes a whole lane with the oracle skill', () => {
    const state = start('oracle');
    act(state, 'deploy:whisker-scout:LP');
    act(state, 'ready');
    clearWave(state);
    addEnemy(state, 'pump-runner', 'left', 0, 4);

    act(state, 'skill');

    const enemy = state.enemies[0];
    expect(state.skillUses).toBe(1);
    expect(enemy?.hp).toBe(1);
    expect(enemy?.pos).toBe(1);
  });

  it('moves a unit and heals two shell with the gambler skill', () => {
    const state = start('gambler');
    act(state, 'deploy:ring-cutter:LP');
    const unit = state.roster.find((item) => item.key === 'ring-cutter');
    if (!unit) throw new Error('missing cutter');
    unit.hp = unitMaxHp(doctrineOf(state), 'ring-cutter') - 2;
    act(state, 'ready');
    const tideBefore = state.tide;

    act(state, 'skill');

    expect(state.skillUses).toBe(1);
    expect(state.tide).toBe(tideBefore - 1 + doctrineOf(state).tidePerPulse);
    expect(unit.slot).not.toBe('LP');
    expect(unit.slot).not.toBeNull();
    expect(unit.hp).toBe(unitMaxHp(doctrineOf(state), 'ring-cutter'));
  });

  it('expires the decoy after its duration and respects gambler bonus', () => {
    const state = start('gambler');
    for (let index = 0; index < state.wavePlan.length; index += 1) state.wavePlan[index] = [];
    act(state, 'deploy:molt-decoy:L1');
    const decoy = state.roster.find((unit) => unit.key === 'molt-decoy');
    expect(decoy?.duration).toBe(3);
    act(state, 'ready');
    act(state, 'hold');
    act(state, 'hold');
    expect(decoy?.slot).toBe('L1');
    act(state, 'hold');
    expect(decoy?.slot).toBeNull();
    expect(decoy?.duration).toBeNull();
    expect(decoy?.readyPulse).toBe(4);
  });

  it('shows more forecast pulses for the oracle', () => {
    const crusher = start('crusher');
    const oracle = start('oracle');
    expect(section(crusher, '敌潮预告')).toHaveLength(2);
    expect(section(oracle, '敌潮预告')).toHaveLength(3);
  });

  it('wins after surviving the last pulse with no enemies left', () => {
    const state = start('crusher');
    state.wavePlan = [[]];
    act(state, 'ready');
    act(state, 'hold');
    expect(state.outcome).toBe('won');
    expect(state.phase).toBe('ended');
  });

  it('has a real deterministic winning line for seed 7', () => {
    const script = [
      'doctrine:crusher',
      'deploy:whisker-scout:RP',
      'deploy:salt-spray:R1',
      'deploy:ring-cutter:LP',
      'ready',
      'hold',
      'skill',
      'deploy:molt-decoy:C',
      'hold',
      'skill',
      'deploy:gate-stake:C',
      'deploy:reef-guard:L1',
      'skill',
      'deploy:molt-decoy:R1',
      'deploy:salt-spray:M1',
      'skill',
      'deploy:molt-decoy:R1',
      'hold',
      'deploy:molt-decoy:C',
      'skill',
    ];
    const state = createRun({ seed: 7, now: NOW });
    for (const action of script) {
      if (state.outcome !== 'ongoing') break;
      act(state, action);
    }
    expect(state.outcome).toBe('won');
    expect(state.phase).toBe('ended');
    expect(state.integrity).toBeGreaterThan(0);
    expect(state.pulse).toBeGreaterThan(state.wavePlan.length - 1);
    expect(state.cause).toContain('守到了最后一 pulse');
  });

  it('has a losing path when the line is left alone', () => {
    const state = start('gambler');
    act(state, 'ready');
    for (let i = 0; i < 20 && state.outcome === 'ongoing'; i += 1) act(state, 'hold');
    expect(state.outcome).toBe('lost');
    expect(state.phase).toBe('ended');
    expect(state.integrity).toBeLessThanOrEqual(0);
    expect(state.cause).toContain('归海线被打穿');
  });

  it('aborts cleanly at any phase', () => {
    const state = start('crusher');
    act(state, 'ready');
    abort(state);
    expect(state.outcome).toBe('aborted');
    expect(state.phase).toBe('ended');
    expect(state.cause).toContain('中止');
  });

  it('only exposes legal deploy slots and affordable units', () => {
    const state = start('crusher');
    const slotsForGuard = deployOptions(state)
      .filter((option) => option.unit === 'reef-guard')
      .map((option) => option.slot);
    expect(slotsForGuard).toEqual(['L1', 'M1', 'R1', 'C']);
    expect(deployOptions(state).every((option) => option.cost <= state.tide)).toBe(true);
    expect(STAGE.slotOrder).toHaveLength(6);
  });
});
