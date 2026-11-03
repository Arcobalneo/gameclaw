/**
 * Run state machine for 虾闹 / Shrimp Rampage.
 *
 * Four nights, six actions each. Every action is a real trade: the field wants
 * three actions per pumpkin, the monsters want two or three soothes, and both
 * compete for the same six slots.
 */

import { type GameEvent, Rng } from '@gameclaw/gamekit';
import type { Approach, MonsterKind, Mood } from './content';
import {
  APPROACH_FIT,
  APPROACHES,
  CROP_STAGES,
  FLAVOR,
  MONSTER_KINDS,
  MOODS,
  PLOT_IDS,
  PLOT_NAMES,
} from './content';

export type Outcome = 'ongoing' | 'won' | 'lost' | 'aborted';

export interface PumpkinPlot {
  id: string;
  name: string;
  /** Index into CROP_STAGES: 0 empty, 1 growing, 2 ready. */
  stage: number;
  durability: number;
}

export interface PumpkinMonster {
  id: string;
  kind: MonsterKind;
  mood: Mood;
  /** Index into state.plots. */
  plot: number;
  /** Successful soothes still needed. */
  calm: number;
  need: number;
  agitation: number;
  revealed: boolean;
  hinted: boolean;
  /** Plot indexes it can hop to on its next move. */
  moves: number[];
}

export interface PumpkinState {
  seed: number;
  difficulty: string;
  night: number;
  actionCap: number;
  actionsUsed: number;
  stamina: number;
  staminaCap: number;
  candy: number;
  seeds: number;
  pumpkins: number;
  variants: number;
  plots: PumpkinPlot[];
  monsters: PumpkinMonster[];
  monsterSeq: number;
  captured: number;
  trampled: number;
  probes: number;
  soothes: number;
  failedSoothes: number;
  blindSoothes: number;
  rests: number;
  rallies: number;
  score: number;
  notes: string[];
  timeline: string[];
  outcome: Outcome;
  cause: string;
  rng: number[];
}

export const NIGHT_LIMIT = 4;
export const RAMPAGE_NIGHT = 3;
export const PLOT_DURABILITY = 3;
export const BASE_STAMINA = 16;
export const NIGHT_REGEN = 6;
export const ACTION_CAP = 6;
export const WIN_PUMPKINS = 4;
export const WIN_CAPTURED = 3;

const SPAWNS = [0, 2, 3, 4, 3];
const MAX_MONSTERS = 6;

const COST = {
  probe: 1,
  soothe: 2,
  water: 1,
  plant: 1,
  harvest: 1,
  rally: 2,
} as const;

const NOTES_LIMIT = 6;
const TIMELINE_LIMIT = 40;

function pushNote(state: PumpkinState, line: string): void {
  state.notes.push(line);
  while (state.notes.length > NOTES_LIMIT) state.notes.shift();
}

function pushTimeline(state: PumpkinState, line: string): void {
  state.timeline.push(`第 ${state.night} 夜 · ${line}`);
  while (state.timeline.length > TIMELINE_LIMIT) state.timeline.shift();
}

function spend(state: PumpkinState, cost: number): void {
  state.stamina -= cost;
  state.actionsUsed += 1;
}

function plotIndex(state: PumpkinState, id: string): number {
  const index = state.plots.findIndex((plot) => plot.id === id);
  if (index < 0) throw new Error(`Unknown plot: ${id}`);
  return index;
}

function monsterAt(state: PumpkinState, index: number): PumpkinMonster | undefined {
  return state.monsters.find((monster) => monster.plot === index);
}

function moveSet(index: number, kind: MonsterKind, rng: Rng): number[] {
  const total = state_plot_total();
  if (kind === 'floater') {
    const others = Array.from({ length: total }, (_, i) => i).filter((i) => i !== index);
    return rng.sample(others, 3);
  }
  const step = kind === 'roller' ? 1 : kind === 'runner' ? 2 : 3;
  return [index - step, index + step].filter((i) => i >= 0 && i < total);
}

function state_plot_total(): number {
  return PLOT_IDS.length;
}

function tramplePlot(state: PumpkinState, index: number): string | null {
  const plot = state.plots[index];
  if (!plot || plot.durability <= 0) return null;
  plot.durability -= 1;
  state.trampled += 1;
  if (plot.durability > 0) return null;
  if (plot.stage > 0) {
    plot.stage = 0;
    return `${plot.name}被踩塌了，藤蔓断成两截。`;
  }
  return `${plot.name}被踏成一片硬土。`;
}

function makeMonster(state: PumpkinState, rng: Rng): PumpkinMonster {
  const kinds: MonsterKind[] = ['roller', 'runner', 'bouncer', 'floater'];
  const moods: Mood[] = ['grumpy', 'playful', 'shy'];
  const kind = rng.pick(kinds);
  const mood = rng.pick(moods);
  const free = state.plots.map((_, i) => i).filter((i) => !monsterAt(state, i));
  const plot = free.length > 0 ? rng.pick(free) : rng.int(0, state.plots.length - 1);
  const spec = MONSTER_KINDS[kind];
  state.monsterSeq += 1;
  return {
    id: `m${state.monsterSeq}`,
    kind,
    mood,
    plot,
    calm: spec.need,
    need: spec.need,
    agitation: 0,
    revealed: false,
    hinted: false,
    moves: moveSet(plot, kind, rng),
  };
}

function spawnNight(state: PumpkinState, rng: Rng): void {
  const target = SPAWNS[state.night] ?? 2;
  let added = 0;
  while (added < target && state.monsters.length < MAX_MONSTERS) {
    state.monsters.push(makeMonster(state, rng));
    added += 1;
  }
}

export function createRun(options: { seed: number; difficulty?: string }): PumpkinState {
  const rng = Rng.fromSeed(options.seed);
  const difficulty = options.difficulty ?? 'normal';
  const actionCap =
    difficulty === 'easy' ? ACTION_CAP + 1 : difficulty === 'hard' ? ACTION_CAP - 1 : ACTION_CAP;
  const staminaCap =
    difficulty === 'easy'
      ? BASE_STAMINA + 2
      : difficulty === 'hard'
        ? BASE_STAMINA - 2
        : BASE_STAMINA;

  const plots: PumpkinPlot[] = PLOT_NAMES.map((name, i) => ({
    id: PLOT_IDS[i] ?? `p${i + 1}`,
    name,
    // Half the field is already vining: the first harvests are cheap, the rest
    // need a full plant/water/harvest cycle.
    stage: i % 2 === 0 ? 1 : 0,
    durability: PLOT_DURABILITY,
  }));

  const state: PumpkinState = {
    seed: options.seed,
    difficulty,
    night: 1,
    actionCap,
    actionsUsed: 0,
    stamina: staminaCap,
    staminaCap,
    candy: 2,
    seeds: 2,
    pumpkins: 0,
    variants: 0,
    plots,
    monsters: [],
    monsterSeq: 0,
    captured: 0,
    trampled: 0,
    probes: 0,
    soothes: 0,
    failedSoothes: 0,
    blindSoothes: 0,
    rests: 0,
    rallies: 0,
    score: 0,
    notes: [],
    timeline: [],
    outcome: 'ongoing',
    cause: '',
    rng: rng.serialize(),
  };

  spawnNight(state, rng);
  state.rng = rng.serialize();
  pushNote(state, '田里进了南瓜怪。先弄清它在哪，再想怎么安抚。');
  pushTimeline(state, '第一夜开始：六畦田，两三个南瓜怪。');
  return state;
}

/* ------------------------------------------------------------------ moves */

function tickMonsters(state: PumpkinState, rng: Rng, eager: boolean): string[] {
  const log: string[] = [];
  const movers = eager
    ? [...state.monsters]
    : [...state.monsters]
        .filter((monster) => monster.agitation > 0)
        .sort((a, b) => b.agitation - a.agitation)
        .slice(0, 1);

  for (const monster of movers) {
    const options = monster.moves.filter(
      (index) => !state.monsters.some((other) => other !== monster && other.plot === index),
    );
    if (options.length === 0) {
      monster.agitation = Math.max(0, monster.agitation - 1);
      continue;
    }
    const next = options.length === 1 ? options[0]! : rng.pick(options);
    const spec = MONSTER_KINDS[monster.kind];
    const from = state.plots[monster.plot]?.name ?? '田里';
    const to = state.plots[next]?.name ?? '田里';
    monster.plot = next;
    monster.moves = moveSet(next, monster.kind, rng);
    monster.agitation = Math.max(0, monster.agitation - 1);
    monster.hinted = monster.hinted && false;
    log.push(`${spec.name}从${from}${spec.verb}到${to}。`);
    const line = tramplePlot(state, next);
    if (line) log.push(line);
  }
  return log;
}

/* ------------------------------------------------------------------ night */

function endRun(state: PumpkinState, outcome: Outcome, cause: string): void {
  state.outcome = outcome;
  state.cause = cause;
  state.notes = [];
  pushTimeline(state, cause);
}

function finishNight(state: PumpkinState, rng: Rng): string[] {
  const log: string[] = [];

  for (const monster of state.monsters) {
    const line = tramplePlot(state, monster.plot);
    if (line) log.push(line);
  }

  if (state.stamina <= 0) {
    endRun(state, 'lost', '体力耗尽，你倒在田埂上，天亮也没起来。');
    pushNote(state, '体力见底就是终局：每个动作前先算清还能撑几次。');
    return log;
  }

  if (state.night >= NIGHT_LIMIT) {
    if (state.pumpkins >= WIN_PUMPKINS && state.captured >= WIN_CAPTURED) {
      endRun(state, 'won', `四个南瓜全收了，${state.captured} 只南瓜怪也安静下来，这一季守住了。`);
    } else if (state.captured < WIN_CAPTURED) {
      endRun(state, 'lost', `只安抚了 ${state.captured}/3 只南瓜怪，剩下的还在田里闹。`);
    } else {
      endRun(state, 'lost', `只收了 ${state.pumpkins}/4 个南瓜，冬天没有存粮。`);
    }
    return log;
  }

  state.night += 1;
  state.actionsUsed = 0;
  state.stamina = Math.min(state.staminaCap, state.stamina + NIGHT_REGEN);
  for (const plot of state.plots) plot.durability = PLOT_DURABILITY;
  spawnNight(state, rng);
  log.push(`天亮了：体力回 ${NIGHT_REGEN}，田埂重新垒好，新的南瓜怪摸进田里。`);
  pushTimeline(state, `第 ${state.night} 夜开始。`);
  if (state.night === RAMPAGE_NIGHT) {
    pushNote(state, '今夜大暴走：每做一个动作，所有南瓜怪都会换畦。');
  }
  return log;
}

/* ----------------------------------------------------------------- status */

export function statusOf(state: PumpkinState): {
  headline: string;
  metrics: { label: string; value: string; hint?: string }[];
  sections: { title: string; lines: string[] }[];
  outcome: Outcome;
  turn: number;
  phase?: string;
} {
  const headline =
    state.outcome === 'ongoing'
      ? `第 ${state.night}/${NIGHT_LIMIT} 夜 · 动作 ${state.actionsUsed}/${state.actionCap} · 体力 ${state.stamina}/${state.staminaCap}`
      : `${state.outcome === 'won' ? '守住了这一季' : '这一季没守住'} · ${state.cause}`;

  const plotLines = state.plots.map((plot) => {
    const monster = monsterAt(state, state.plots.indexOf(plot));
    const crop = CROP_STAGES[plot.stage] ?? '空畦';
    const parts = [`${plot.name}：${crop}，田埂 ${plot.durability}/${PLOT_DURABILITY}`];
    if (monster) parts.push('有动静');
    return parts.join(' · ');
  });

  const monsterLines =
    state.monsters.length === 0
      ? ['田里暂时安静。']
      : state.monsters.map((monster) => {
          const plot = state.plots[monster.plot]?.name ?? '田里';
          const spec = MONSTER_KINDS[monster.kind];
          const identifier = monster.revealed
            ? `${spec.name}（${MOODS[monster.mood].name}）`
            : monster.hinted
              ? `看不清，只知道在${plot}附近`
              : '还没找到';
          const extra = monster.revealed ? `还需 ${monster.calm} 次成功安抚` : '情绪未知';
          const agitation = monster.agitation > 0 ? ` · 躁动 ${monster.agitation}` : '';
          return `${plot}：${identifier} · ${extra}${agitation}`;
        });

  const sections = [
    { title: '田地', lines: plotLines },
    { title: '南瓜怪', lines: monsterLines },
    { title: '动静', lines: state.notes.length > 0 ? [...state.notes] : ['只有风。'] },
  ];

  if (state.night === RAMPAGE_NIGHT && state.outcome === 'ongoing') {
    sections.push({ title: '今夜', lines: ['大暴走：每个动作之后，所有南瓜怪都会换畦。'] });
  }

  return {
    headline,
    metrics: [
      { label: '收成', value: `${state.pumpkins}/${WIN_PUMPKINS}`, hint: '第四夜结束前要凑够' },
      { label: '安抚', value: `${state.captured}/${WIN_CAPTURED}`, hint: '第四夜结束前要凑够' },
      { label: '糖果', value: String(state.candy), hint: '递糖果用' },
      { label: '南瓜籽', value: String(state.seeds), hint: '种植或吃掉' },
      { label: '体力', value: `${state.stamina}/${state.staminaCap}` },
    ],
    sections,
    outcome: state.outcome,
    turn: state.actionsUsed,
    phase: `第 ${state.night} 夜`,
  };
}

/* ---------------------------------------------------------------- actions */

export function actionsOf(state: PumpkinState): {
  id: string;
  label: string;
  detail?: string;
  risk?: 'low' | 'medium' | 'high';
  cost?: string;
  tags?: string[];
}[] {
  if (state.outcome !== 'ongoing') return [];
  const list: {
    id: string;
    label: string;
    detail?: string;
    risk?: 'low' | 'medium' | 'high';
    cost?: string;
    tags?: string[];
  }[] = [];

  state.plots.forEach((plot, index) => {
    const monster = monsterAt(state, index);

    if (state.stamina >= COST.probe) {
      list.push({
        id: `probe:${plot.id}`,
        label: `查看${plot.name}`,
        detail: monster
          ? '这里有东西在动。花 1 体力看清它是什么、什么情绪。'
          : '花 1 体力翻一遍叶子，确认这里没有南瓜怪。',
        risk: 'low',
        cost: '1 体力',
        tags: ['找怪'],
      });
    }

    if (monster && state.stamina >= COST.soothe) {
      const identity = monster.revealed
        ? `${MONSTER_KINDS[monster.kind].name}（${MOODS[monster.mood].name}）`
        : '情绪未知的南瓜怪';
      for (const approach of Object.keys(APPROACHES) as Approach[]) {
        const extra = approach === 'pat' ? COST.soothe + 1 : COST.soothe;
        if (state.stamina < extra) continue;
        if (approach === 'candy' && state.candy < 1) continue;
        const fit = monster.revealed ? APPROACH_FIT[monster.mood][approach] : 0;
        const insight = monster.revealed ? 2 : 0;
        const dc = MONSTER_KINDS[monster.kind].base + monster.agitation;
        // The engine rolls 1d6 and adds fit + insight; exposing the threshold
        // lets an agent do the arithmetic instead of guessing.
        const need = dc - fit - insight;
        const odds = Math.max(0, Math.min(6, 7 - need));
        list.push({
          id: `soothe:${approach}:${plot.id}`,
          label: `对${plot.name}的南瓜怪${APPROACHES[approach].name}`,
          detail: `${identity}；还需 ${monster.calm} 次成功${monster.revealed ? `，契合 ${fit >= 0 ? '+' : ''}${fit}` : '，没探明情绪就没有契合加成；先 probe 能 +2'}；成功线 ${need}+（约 ${odds}/6）`,
          risk: monster.calm <= 1 ? 'low' : 'medium',
          cost: `${extra} 体力${approach === 'candy' ? ' + 1 糖果' : ''}`,
          tags: ['安抚'],
        });
      }
    }

    if (plot.stage === 2) {
      list.push({
        id: `harvest:${plot.id}`,
        label: `收${plot.name}的南瓜`,
        detail: '进 1 个南瓜、回 1 把南瓜籽；小概率是特殊南瓜（分值更高）。',
        risk: 'low',
        cost: '1 体力',
        tags: ['种田'],
      });
    } else if (plot.stage === 1 && state.stamina >= COST.water) {
      list.push({
        id: `water:${plot.id}`,
        label: `给${plot.name}浇水`,
        detail: '这一畦就能收了。',
        risk: 'low',
        cost: '1 体力',
        tags: ['种田'],
      });
    } else if (plot.stage === 0 && state.seeds > 0 && state.stamina >= COST.plant) {
      list.push({
        id: `plant:${plot.id}`,
        label: `在${plot.name}种下南瓜籽`,
        detail: '种下之后还要浇一次水才能收。',
        risk: 'low',
        cost: '1 体力 + 1 南瓜籽',
        tags: ['种田'],
      });
    }
  });

  if (state.stamina >= COST.rally) {
    list.push({
      id: 'rally',
      label: '喊人巡田',
      detail: '花 2 体力：最多 3 只南瓜怪暴露位置，但都会被惊到（躁动 +1，下一动作后会乱跑）。',
      risk: 'medium',
      cost: '2 体力',
      tags: ['找怪'],
    });
  }

  if (state.pumpkins > 0) {
    list.push({
      id: 'cook',
      label: '煮南瓜',
      detail: `消耗 1 个南瓜：体力上限 +2（现 ${state.staminaCap}），并回 4 体力。`,
      risk: 'low',
      cost: '1 南瓜',
      tags: ['恢复'],
    });
  }

  if (state.seeds > 0) {
    list.push({
      id: 'eat-seed',
      label: '吃掉一把南瓜籽',
      detail: '消耗 1 南瓜籽，回 1 体力。',
      risk: 'low',
      cost: '1 南瓜籽',
      tags: ['恢复'],
    });
  }

  list.push({
    id: 'rest',
    label: '在田埂上歇一会',
    detail: '回 3 体力，但占掉一个动作。',
    risk: 'low',
    cost: '1 动作',
    tags: ['恢复'],
  });

  list.push({
    id: 'end-night',
    label: `收工，提前结束第 ${state.night} 夜`,
    detail: '剩下的动作作废，体力带到明晚（明晚还会再回 4）。',
    risk: 'medium',
    tags: ['节奏'],
  });

  return list.sort((a, b) => actionRank(state, a.id) - actionRank(state, b.id));
}

/**
 * Orders actions by expected value for the `NEXT` hint: a soaked, revealed
 * monster first, then anything that moves the win condition forward, and
 * recovery / pacing last. Ties keep plot order, so the list stays deterministic.
 */
function actionRank(state: PumpkinState, id: string): number {
  const [head = '', arg1 = '', arg2 = ''] = id.split(':');
  if (head === 'soothe') {
    const index = state.plots.findIndex((plot) => plot.id === arg2);
    const monster = monsterAt(state, index);
    if (!monster?.revealed) return 2.5;
    // Best mood fit first: a playful monster wants a song, not candy.
    return (2 - APPROACH_FIT[monster.mood][arg1 as Approach]) * 0.1;
  }
  if (head === 'probe') {
    const index = state.plots.findIndex((plot) => plot.id === arg1);
    return monsterAt(state, index) ? 1 : 5;
  }
  if (head === 'harvest') return 2;
  if (head === 'water') return 3;
  if (head === 'plant') return 4;
  if (head === 'rally') return 6;
  if (head === 'cook') return 7;
  if (head === 'eat-seed') return 8;
  if (head === 'rest') return 9;
  return 10;
}

/* -------------------------------------------------------------------- act */

function probe(state: PumpkinState, rng: Rng, plotId: string): string[] {
  const index = plotIndex(state, plotId);
  const plot = state.plots[index]!;
  state.probes += 1;
  spend(state, COST.probe);
  const monster = monsterAt(state, index);
  if (!monster) {
    const line = rng.pick(FLAVOR.probeMiss);
    pushNote(state, `${plot.name}：什么都没有。`);
    return [`查看${plot.name}：${line}`];
  }
  monster.revealed = true;
  monster.hinted = true;
  const spec = MONSTER_KINDS[monster.kind];
  const mood = MOODS[monster.mood];
  pushNote(state, `${plot.name}有${spec.name}，${mood.name}。`);
  return [
    `查看${plot.name}：${spec.name}，${mood.name}。${mood.line}`,
    spec.tell,
    `还需 ${monster.calm} 次成功安抚。`,
  ];
}

function soothe(state: PumpkinState, rng: Rng, approach: Approach, plotId: string): string[] {
  const index = plotIndex(state, plotId);
  const monster = monsterAt(state, index);
  if (!monster) throw new Error(`No monster on ${plotId}`);

  const cost = COST.soothe + (approach === 'pat' ? 1 : 0);
  if (approach === 'candy' && state.candy < 1) throw new Error('No candy left');

  state.soothes += 1;
  if (!monster.revealed) state.blindSoothes += 1;
  if (approach === 'candy') state.candy -= 1;
  spend(state, cost);

  const spec = MONSTER_KINDS[monster.kind];
  const fit = monster.revealed ? APPROACH_FIT[monster.mood][approach] : 0;
  const insight = monster.revealed ? 2 : 0;
  const dc = spec.base + monster.agitation;
  const roll = rng.int(1, 6);
  const total = roll + fit + insight;
  const label = `${APPROACHES[approach].name}`;

  if (total >= dc) {
    monster.calm -= 1;
    if (monster.calm <= 0) {
      state.monsters = state.monsters.filter((other) => other !== monster);
      state.captured += 1;
      state.candy += 1;
      state.score += 4;
      pushNote(state, `安抚成功：${spec.name}安静了，还留下一颗糖。`);
      pushTimeline(state, `安抚住一只${spec.name}。`);
      return [
        `${label} · 掷骰 ${roll}${fit !== 0 ? ` + 契合 ${fit}` : ''}${insight ? ' + 已探明 1' : ''} = ${total} ≥ ${dc}，成功。`,
        rng.pick(FLAVOR.capture),
        `${spec.name}被你带走，糖果 +1。`,
      ];
    }
    monster.agitation = Math.max(0, monster.agitation - 1);
    return [
      `${label} · 掷骰 ${roll}${fit !== 0 ? ` + 契合 ${fit}` : ''}${insight ? ' + 已探明 1' : ''} = ${total} ≥ ${dc}，成功。`,
      `${spec.name}松了一点，还需 ${monster.calm} 次。`,
    ];
  }

  state.failedSoothes += 1;
  monster.agitation += 1;
  return [
    `${label} · 掷骰 ${roll}${fit !== 0 ? ` + 契合 ${fit}` : ''}${insight ? ' + 已探明 1' : ''} = ${total} < ${dc}，失败。`,
    rng.pick(FLAVOR.sootheFail),
    `它更躁了（躁动 ${monster.agitation}），下个动作之后会换畦。`,
  ];
}

function water(state: PumpkinState, plotId: string): string[] {
  const index = plotIndex(state, plotId);
  const plot = state.plots[index]!;
  if (plot.stage !== 1) throw new Error(`${plotId} cannot be watered now`);
  spend(state, COST.water);
  plot.stage = 2;
  return [`给${plot.name}浇了水，可以收了。`];
}

function plant(state: PumpkinState, plotId: string): string[] {
  const index = plotIndex(state, plotId);
  const plot = state.plots[index]!;
  if (plot.stage !== 0) throw new Error(`${plotId} is not empty`);
  if (state.seeds < 1) throw new Error('No seeds left');
  spend(state, COST.plant);
  state.seeds -= 1;
  plot.stage = 1;
  return [`在${plot.name}种下一颗南瓜籽。`];
}

function harvest(state: PumpkinState, rng: Rng, plotId: string): string[] {
  const index = plotIndex(state, plotId);
  const plot = state.plots[index]!;
  if (plot.stage !== 2) throw new Error(`${plotId} is not ready`);
  spend(state, COST.harvest);
  const chance = state.night === RAMPAGE_NIGHT ? 0.35 : 0.18;
  const variant = rng.chance(chance);
  plot.stage = 0;
  state.pumpkins += 1;
  state.seeds += 1;
  const lines = [`从${plot.name}收下一个南瓜。`];
  if (variant) {
    state.variants += 1;
    state.seeds += 1;
    state.score += 6;
    lines.push('这个南瓜的纹路是旋的——特殊南瓜，能换造型家具，南瓜籽也多一把。');
    pushNote(state, `${plot.name}出了特殊南瓜。`);
    pushTimeline(state, `收到一个特殊南瓜。`);
  } else {
    state.score += 3;
    pushTimeline(state, `收了${plot.name}的南瓜。`);
  }
  lines.push(`南瓜籽 +1${variant ? '（特殊南瓜再 +1）' : ''}。`);
  return lines;
}

function rally(state: PumpkinState, rng: Rng): string[] {
  spend(state, COST.rally);
  state.rallies += 1;
  const targets = rng.sample(state.monsters, 3);
  if (targets.length === 0) return ['你喊了一声，田里没人应——本来就没有南瓜怪。'];
  const lines = ['你沿着田埂喊了一嗓子。'];
  for (const monster of targets) {
    monster.hinted = true;
    monster.agitation += 1;
    const plot = state.plots[monster.plot]?.name ?? '田里';
    const next = monster.moves.map((i) => state.plots[i]?.name ?? '田').join('、');
    lines.push(`有人在${plot}报了动静，接下来它可能去${next}。`);
  }
  return lines;
}

function cook(state: PumpkinState): string[] {
  if (state.pumpkins < 1) throw new Error('No pumpkins to cook');
  spend(state, 0);
  state.pumpkins -= 1;
  state.staminaCap += 2;
  state.stamina = Math.min(state.staminaCap, state.stamina + 4);
  pushNote(state, `煮了一锅南瓜汤，体力上限到 ${state.staminaCap}。`);
  return [`把南瓜切块下锅。体力上限 +2（现 ${state.staminaCap}），回 4 体力。`];
}

function eatSeed(state: PumpkinState): string[] {
  if (state.seeds < 1) throw new Error('No seeds left');
  spend(state, 0);
  state.seeds -= 1;
  state.stamina = Math.min(state.staminaCap, state.stamina + 1);
  return ['嚼了一把生南瓜籽，回 1 体力。'];
}

function rest(state: PumpkinState): string[] {
  spend(state, 0);
  state.rests += 1;
  const before = state.stamina;
  state.stamina = Math.min(state.staminaCap, state.stamina + 3);
  return [`在田埂上坐了一会：体力 ${before} → ${state.stamina}。`];
}

/** Everything the engine tracks that an action can move. Used to derive events. */
interface Snapshot {
  night: number;
  used: number;
  stamina: number;
  pumpkins: number;
  seeds: number;
  candy: number;
  captured: number;
  failedSoothes: number;
  trampled: number;
  outcome: Outcome;
  monsters: Map<string, { plot: number; revealed: boolean; kind: MonsterKind; mood: Mood }>;
}

function snapshotOf(state: PumpkinState): Snapshot {
  return {
    night: state.night,
    used: state.actionsUsed,
    stamina: state.stamina,
    pumpkins: state.pumpkins,
    seeds: state.seeds,
    candy: state.candy,
    captured: state.captured,
    failedSoothes: state.failedSoothes,
    trampled: state.trampled,
    outcome: state.outcome,
    monsters: new Map(
      state.monsters.map((monster) => [
        monster.id,
        { plot: monster.plot, revealed: monster.revealed, kind: monster.kind, mood: monster.mood },
      ]),
    ),
  };
}

/**
 * Derives machine-readable events from the state delta, so an agent never has
 * to regex the Chinese log to know what an action actually did.
 */
function eventsOf(before: Snapshot, state: PumpkinState, actionId: string): GameEvent[] {
  const events: GameEvent[] = [
    { type: 'act', action: actionId, night: state.night, used: state.actionsUsed },
  ];

  if (state.stamina !== before.stamina) {
    events.push({ type: 'stamina', delta: state.stamina - before.stamina, stamina: state.stamina });
  }
  if (state.pumpkins > before.pumpkins) {
    events.push({
      type: 'harvest',
      pumpkins: state.pumpkins,
      delta: state.pumpkins - before.pumpkins,
    });
  }
  if (state.captured > before.captured) {
    events.push({ type: 'soothe', captured: state.captured, need: WIN_CAPTURED });
  }
  if (state.failedSoothes > before.failedSoothes) {
    events.push({ type: 'soothe-failed', failed: state.failedSoothes });
  }
  if (state.trampled > before.trampled) {
    events.push({ type: 'trample', trampled: state.trampled });
  }

  for (const monster of state.monsters) {
    const prev = before.monsters.get(monster.id);
    if (!prev) {
      events.push({
        type: 'monster-spawn',
        monster: monster.id,
        kind: monster.kind,
        plot: state.plots[monster.plot]?.id ?? null,
      });
      continue;
    }
    if (prev.revealed !== monster.revealed && monster.revealed) {
      events.push({
        type: 'monster-revealed',
        monster: monster.id,
        kind: monster.kind,
        mood: monster.mood,
        plot: state.plots[monster.plot]?.id ?? null,
      });
    }
    if (prev.plot !== monster.plot) {
      events.push({
        type: 'monster-move',
        monster: monster.id,
        from: state.plots[prev.plot]?.id ?? null,
        to: state.plots[monster.plot]?.id ?? null,
      });
    }
  }
  for (const id of before.monsters.keys()) {
    if (!state.monsters.some((monster) => monster.id === id)) {
      events.push({ type: 'monster-soothed', monster: id });
    }
  }

  if (state.night !== before.night) events.push({ type: 'night', night: state.night });
  if (state.outcome !== before.outcome) {
    events.push({ type: 'outcome', outcome: state.outcome, cause: state.cause });
  }
  return events;
}

export function act(state: PumpkinState, actionId: string): { log: string[]; events: GameEvent[] } {
  if (state.outcome !== 'ongoing') throw new Error('Run is over');
  const rng = Rng.restore(state.rng);
  const before = snapshotOf(state);
  let log: string[] = [];

  if (actionId === 'end-night') {
    log = finishNight(state, rng);
  } else {
    const [head = '', arg1 = '', arg2 = ''] = actionId.split(':');
    switch (head) {
      case 'probe':
        log = probe(state, rng, arg1);
        break;
      case 'soothe':
        log = soothe(state, rng, arg1 as Approach, arg2);
        break;
      case 'water':
        log = water(state, arg1);
        break;
      case 'plant':
        log = plant(state, arg1);
        break;
      case 'harvest':
        log = harvest(state, rng, arg1);
        break;
      case 'rally':
        log = rally(state, rng);
        break;
      case 'cook':
        log = cook(state);
        break;
      case 'eat-seed':
        log = eatSeed(state);
        break;
      case 'rest':
        log = rest(state);
        break;
      default:
        throw new Error(`Unknown action: ${actionId}`);
    }

    const moveLog = tickMonsters(state, rng, state.night === RAMPAGE_NIGHT);
    if (moveLog.length > 0) log.push(...moveLog);

    if (state.outcome === 'ongoing' && state.actionsUsed >= state.actionCap) {
      log.push(`第 ${state.night} 夜的 ${state.actionCap} 个动作做完了。`);
      log.push(...finishNight(state, rng));
    }
  }

  state.rng = rng.serialize();
  return { log, events: eventsOf(before, state, actionId) };
}

export function abort(state: PumpkinState): void {
  endRun(state, 'aborted', '你放下手电，走回屋裡——这一季先不管了。');
}

/* ------------------------------------------------------------------ recap */

export function recapOf(state: PumpkinState): {
  title: string;
  outcome: Outcome;
  cause: string;
  metrics: { label: string; value: string; hint?: string }[];
  timeline: string[];
  lessons: string[];
  memoryPrompt: string;
} {
  const lessons: string[] = [];

  if (state.blindSoothes > 3) {
    lessons.push(`盲抚 ${state.blindSoothes} 次：没探明情绪就上手，契合加成白白丢掉。`);
  }
  if (state.failedSoothes >= 4) {
    lessons.push(
      `安抚失败 ${state.failedSoothes} 次，每次都让它更躁、跑得更远。先看清种属再选手段。`,
    );
  }
  if (state.rests >= 3) {
    lessons.push(`在田埂上歇了 ${state.rests} 次：体力规划偏晚，休息本身也吃动作。`);
  }
  if (state.pumpkins < WIN_PUMPKINS) {
    lessons.push(
      `收成 ${state.pumpkins}/${WIN_PUMPKINS}：种植到收成要占 3 个动作，前期不铺田就来不及。`,
    );
  }
  if (state.captured < WIN_CAPTURED && state.night >= NIGHT_LIMIT) {
    lessons.push(
      `安抚 ${state.captured}/${WIN_CAPTURED}：滚筒和疾跑只要 2 次成功，弹跳和飞天要 3 次。`,
    );
  }
  if (state.trampled >= 5) {
    lessons.push(`田埂被踩 ${state.trampled} 次：夜里不清理的南瓜怪，天亮前一定会踩一脚。`);
  }
  if (state.variants > 0) {
    lessons.push(`收到 ${state.variants} 个特殊南瓜：暴走夜收成，出特殊南瓜的概率更高。`);
  }
  if (lessons.length === 0) {
    lessons.push('动作分配基本对上了：找怪、安抚、铺田三条线都没有断。');
  }

  return {
    title: state.outcome === 'won' ? '这一季守住了' : '这一季没守住',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '收成', value: `${state.pumpkins}/${WIN_PUMPKINS}` },
      { label: '安抚', value: `${state.captured}/${WIN_CAPTURED}` },
      { label: '特殊南瓜', value: String(state.variants) },
      { label: '体力上限', value: String(state.staminaCap) },
      { label: '得分', value: String(state.score) },
    ],
    timeline: [...state.timeline],
    lessons,
    memoryPrompt:
      '写下这局你把六个动作分给了“找怪 / 安抚 / 种田”的哪几条，以及下一次第一夜会先做什么。',
  };
}
