import { describe, expect, it } from 'vitest';

import { CASES, EVENTS } from '../src/content';
import {
  act,
  activeRoom,
  caseOf,
  createRun,
  GAME_VERSION,
} from '../src/engine';
import { definition } from '../src/definition';
import type { LookState } from '../src/model';

const NOW = '2026-01-01T00:00:00.000Z';

function sealed(seed = 7): LookState {
  return createRun({ seed, content: 'sealed-tide-station', now: NOW });
}

function ids(state: LookState): string[] {
  return definition.actions(state).map((action) => action.id);
}

const WIN_ROUTE = [
  'inspect:left-window',
  'record',
  'brace',
  'inspect:horizon-gap',
  'record',
  'brace',
  'inspect:left-window',
  'record',
  'move:monitor-hall',
  'move:archive-bay',
  'interact:claim-record',
  'move:exit-lock',
  'extract',
];

describe('sideways-look content', () => {
  it('loads four valid cases and all event tables', () => {
    expect(CASES.map((item) => item.id)).toEqual([
      'archive-corridor',
      'backflow-inn',
      'blind-screen-room',
      'sealed-tide-station',
    ]);
    for (const caseConfig of CASES) {
      expect(caseConfig.rooms).toHaveLength(5);
      expect(caseConfig.defaultAscii.length).toBeGreaterThan(0);
      const events = EVENTS.filter((event) => event.caseId === caseConfig.id);
      expect(events).toHaveLength(360);
      for (const trigger of ['inspect', 'move', 'interact'] as const) {
        expect(events.filter((event) => event.trigger === trigger)).toHaveLength(120);
      }
    }
  });

  it('starts in case selection without --content and enters a case with choose', () => {
    const select = createRun({ seed: 7, now: NOW });
    expect(select.phase).toBe('case-select');
    expect(select.outcome).toBe('ongoing');
    expect(ids(select)).toEqual([
      'choose:archive-corridor',
      'choose:backflow-inn',
      'choose:blind-screen-room',
      'choose:sealed-tide-station',
    ]);

    act(select, 'choose:backflow-inn');
    expect(select.phase).toBe('exploring');
    expect(select.caseId).toBe('backflow-inn');
    expect(select.roomId).toBe('front-desk');
    expect(select.requiredEvidence).toBe(3);
    expect(definition.status(select).headline).toContain('返潮招待所');
  });

  it('rejects unknown content and unknown case selection ids', () => {
    expect(() => createRun({ seed: 7, content: 'no-such-case', now: NOW })).toThrow(
      /Unknown --content case/,
    );
    const select = createRun({ seed: 7, now: NOW });
    expect(() => act(select, 'choose:no-such-case')).toThrow(/Illegal action/);
  });
});

describe('sideways-look engine', () => {
  it('replays exactly from the same seed and action sequence', () => {
    const a = sealed(11);
    const b = sealed(11);
    for (const action of WIN_ROUTE) {
      expect(ids(a)).toEqual(ids(b));
      act(a, action);
      act(b, action);
      expect(a).toEqual(b);
    }
    expect(a.outcome).toBe('won');
    expect(a.ending).toBe('escaped');
    expect(GAME_VERSION).toBe('2.0.0');
  });

  it('moves only through declared exits and clears the current phenomenon', () => {
    const state = sealed();
    expect(activeRoom(state).id).toBe('lookout-deck');
    expect(ids(state)).toContain('move:monitor-hall');
    expect(ids(state)).not.toContain('move:archive-bay');

    act(state, 'inspect:left-window');
    expect(state.currentPhenomenon).not.toBeNull();
    act(state, 'move:monitor-hall');
    expect(state.roomId).toBe('monitor-hall');
    expect(state.currentPhenomenon).toBeNull();
    expect(ids(state)).toContain('move:archive-bay');

    expect(() => act(state, 'move:exit-lock')).toThrow(/Illegal action/);
    expect(() => act(state, 'inspect:left-window')).toThrow(/Illegal action/);
  });

  it('records a named phenomenon for evidence exactly once', () => {
    const state = sealed();
    act(state, 'inspect:left-window');
    const phenomenon = state.currentPhenomenon;
    expect(phenomenon).not.toBeNull();
    expect(ids(state)).toContain('record');

    const before = state.evidence;
    act(state, 'record');
    expect(state.evidence).toBe(before + 1);
    expect(state.recordedClues).toContain(phenomenon?.clueId);
    expect(state.findings).toContain(phenomenon?.title);
    expect(ids(state)).not.toContain('record');
    expect(() => act(state, 'record')).toThrow(/Illegal action|already in the archive/);

    const findingSection = definition
      .status(state)
      .sections.find((section) => section.title === '发现与目标');
    expect(findingSection?.lines.join('\n')).toContain('已记录 1 条');
  });

  it('lets brace recover focus and composure without firing an event', () => {
    const state = sealed();
    act(state, 'inspect:left-window');
    const before = { focus: state.focus, nerve: state.nerve, dread: state.dread };
    act(state, 'brace');
    expect(state.focus).toBeGreaterThan(before.focus);
    expect(state.nerve).toBeGreaterThan(before.nerve);
    expect(state.dread).toBeLessThan(before.dread);
  });

  it('extracts with a verified record as a win', () => {
    const state = sealed();
    for (const action of WIN_ROUTE) act(state, action);
    expect(state.objectiveCollected).toBe(true);
    expect(state.objectiveQuality).toBe('verified');
    expect(state.outcome).toBe('won');
    expect(state.ending).toBe('escaped');
    expect(definition.actions(state)).toHaveLength(0);
    expect(state.cause).toContain('verified');
  });

  it('extracts an uncertain record as a wrong-record loss', () => {
    const state = sealed();
    act(state, 'move:monitor-hall');
    act(state, 'move:archive-bay');
    act(state, 'interact:claim-record');
    expect(state.objectiveQuality).toBe('uncertain');
    act(state, 'move:exit-lock');
    act(state, 'extract');
    expect(state.outcome).toBe('lost');
    expect(state.ending).toBe('wrong-record');
    expect(state.cause).toContain('错误记录');
    expect(definition.actions(state)).toHaveLength(0);
  });

  it('upgrades an uncertain objective when later records reach the requirement', () => {
    const state = sealed();
    act(state, 'move:monitor-hall');
    act(state, 'move:archive-bay');
    act(state, 'interact:claim-record');
    expect(state.objectiveQuality).toBe('uncertain');

    for (let index = 0; index < 3; index += 1) {
      act(state, 'inspect:cab-seven');
      act(state, 'record');
      act(state, 'brace');
    }
    expect(state.evidence).toBeGreaterThanOrEqual(state.requiredEvidence);
    expect(state.objectiveQuality).toBe('verified');

    act(state, 'move:exit-lock');
    act(state, 'extract');
    expect(state.outcome).toBe('won');
  });

  it('refuses extraction before the objective and eventually loses to dread', () => {
    const refused = sealed();
    act(refused, 'move:monitor-hall');
    act(refused, 'move:archive-bay');
    act(refused, 'move:exit-lock');
    const dreadBefore = refused.dread;
    act(refused, 'extract');
    expect(refused.outcome).toBe('ongoing');
    expect(refused.dread).toBe(dreadBefore + 1);

    const lost = sealed();
    for (let index = 0; index < 30 && lost.outcome === 'ongoing'; index += 1) {
      const inspect = ids(lost).find((id) => id.startsWith('inspect:'));
      if (!inspect) throw new Error('no inspect action available while still ongoing');
      act(lost, inspect);
    }
    expect(lost.outcome).toBe('lost');
    expect(lost.ending).toBe('lost-dread');
    expect(lost.cause).toContain('恐惧封顶');
    expect(definition.actions(lost)).toHaveLength(0);
  });

  it('loses when an inspect event takes the last point of nerve', () => {
    const state = sealed();
    state.nerve = 1;
    act(state, 'inspect:left-window');
    expect(state.nerve).toBe(0);
    expect(state.outcome).toBe('lost');
    expect(state.ending).toBe('lost-nerve');
    expect(state.cause).toContain('神经归零');
  });

  it('aborts honestly and keeps the case context', () => {
    const state = sealed();
    act(state, 'inspect:left-window');
    definition.abort?.(state);
    expect(state.outcome).toBe('aborted');
    expect(state.ending).toBe('aborted');
    expect(state.cause).toContain('封潮观察站');
    expect(state.caseId).toBe('sealed-tide-station');
    expect(definition.actions(state)).toHaveLength(0);
  });

  it('keeps status sections anchored for agents', () => {
    const state = sealed();
    const status = definition.status(state);
    expect(status.metrics.map((metric) => metric.label)).toEqual([
      '专注',
      '神经',
      '恐惧',
      '证据',
    ]);
    const titles = status.sections.map((section) => section.title);
    expect(titles).toContain('房间 · Lookout Deck');
    expect(titles).toContain('侧视面板');
    expect(titles).toContain('当前现象');
    expect(titles).toContain('发现与目标');
    expect(titles).toContain('上一次结果');
    expect(caseOf(state)?.id).toBe('sealed-tide-station');
  });
});
