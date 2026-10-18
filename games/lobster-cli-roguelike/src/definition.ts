import type { ActionView, GameDefinition, Metric, RecapView, StatusView } from '@gameclaw/gamekit';

import { LINEAGES } from './content';
import {
  abort,
  act,
  createRun,
  currentEncounter,
  describeDeltas,
  GAME_ID,
  GAME_VERSION,
  offeredMutations,
  type RoguelikeState,
} from './engine';

function metricsOf(state: RoguelikeState): Metric[] {
  if (state.phase === 'lineage') return [];
  const stats = state.stats;
  return [
    { label: '壳', value: stats.shell },
    { label: '能', value: stats.energy },
    { label: '盐', value: stats.salinity },
    { label: '左', value: stats.leftClaw },
    { label: '右', value: stats.rightClaw },
    { label: '须', value: stats.sense },
    { label: '蜕', value: stats.molts },
    { label: '势', value: stats.tide },
    { label: '名声', value: state.score },
  ];
}

function riskOf(
  state: RoguelikeState,
  base: number,
  bonus: number,
  difficulty: number,
): ActionView['risk'] {
  const threshold = difficulty + state.pressure;
  const soft = base + bonus;
  if (threshold <= soft + 1) return 'low';
  if (threshold <= soft + 3) return 'medium';
  return 'high';
}

function statusOf(state: RoguelikeState): StatusView {
  if (state.phase === 'lineage') {
    return {
      headline: '选择你的龙虾谱系',
      metrics: [],
      sections: [
        {
          title: '三条谱系',
          lines: LINEAGES.map(
            (lineage) =>
              `${lineage.title}：壳${lineage.shell} 能${lineage.energy} 盐${lineage.salinity} 左${lineage.leftClaw} 右${lineage.rightClaw} 须${lineage.sense} 蜕${lineage.molts} —— ${lineage.blurb}`,
          ),
        },
        {
          title: '本局规则',
          lines: [
            '每个潮段 9 场遭遇 + 1 道归海闸口。闸口失败即死亡，穿过则继续深潜。',
            '第 2 / 5 / 8 场遭遇后进入突变潮，三选一改变 build。',
            '壳、能、盐任一归零即死亡；潮势（0-2）强化硬解与细解。',
          ],
        },
      ],
      outcome: state.outcome,
      turn: state.turn,
      phase: state.phase,
    };
  }

  if (state.phase === 'mutation') {
    return {
      headline: `突变潮 · 潮段 ${state.cycle}`,
      metrics: metricsOf(state),
      sections: [
        {
          title: '突变潮',
          lines: offeredMutations(state).map(
            (mutation) =>
              `${mutation.title}：${mutation.blurb}（${describeDeltas(mutation.delta)}）`,
          ),
        },
        { title: '本局观察', lines: state.notes.slice(-3) },
      ],
      outcome: state.outcome,
      turn: state.turn,
      phase: state.phase,
    };
  }

  if (state.phase === 'encounter') {
    const encounter = currentEncounter(state);
    return {
      headline: `潮段 ${state.cycle} · 深度 ${state.depth} · ${encounter.title}`,
      metrics: metricsOf(state),
      sections: [
        { title: `遭遇 · ${encounter.title}`, lines: [encounter.body] },
        ...(state.pressure > 0
          ? [{ title: '海压', lines: [`本潮段所有判定难度 +${state.pressure}。`] }]
          : []),
        ...(state.lastResult ? [{ title: '上一次结果', lines: [state.lastResult] }] : []),
      ],
      outcome: state.outcome,
      turn: state.turn,
      phase: state.phase,
    };
  }

  return {
    headline: `本局结束 · ${state.outcome}`,
    metrics: metricsOf(state),
    sections: [{ title: '结算', lines: [state.cause] }],
    outcome: state.outcome,
    turn: state.turn,
    phase: state.phase,
  };
}

function actionsOf(state: RoguelikeState): ActionView[] {
  if (state.phase === 'lineage') {
    return LINEAGES.map((lineage) => ({
      id: `lineage:${lineage.key}`,
      label: lineage.title,
      detail: `${lineage.blurb} 初始：壳${lineage.shell} 能${lineage.energy} 盐${lineage.salinity} 左${lineage.leftClaw} 右${lineage.rightClaw} 须${lineage.sense} 蜕${lineage.molts}`,
      risk: 'low',
    }));
  }

  if (state.phase === 'mutation') {
    return offeredMutations(state).map((mutation) => ({
      id: `mutation:${mutation.key}`,
      label: mutation.title,
      detail: `${mutation.blurb} ${describeDeltas(mutation.delta)}`,
      risk: 'low',
    }));
  }

  if (state.phase === 'encounter') {
    const encounter = currentEncounter(state);
    const lineage = state.lineage ?? 'gambler';
    return encounter.actions.map((action) => {
      const base = action.base(state.stats, lineage);
      // The engine's tag bonus is internal; expose the roll threshold only.
      const threshold = action.difficulty + state.pressure;
      return {
        id: `enc:${action.key}`,
        label: action.title,
        detail: `${action.blurb} 判定 d6+${base} vs ${threshold}。成功：${describeDeltas(action.success)}；失败：${describeDeltas(action.fail)}。`,
        risk: riskOf(state, base, 0, action.difficulty),
        ...(action.consumesMolt ? { cost: '1 蜕壳' } : {}),
        tags: action.tags,
      };
    });
  }

  return [];
}

function recapOf(state: RoguelikeState): RecapView {
  const title =
    state.phase === 'lineage'
      ? '尚未下海'
      : `${state.lineage ?? '未知谱系'} · 潮段 ${state.cycle} · 深度 ${state.depth}`;
  const memoryPrompt =
    state.outcome === 'won'
      ? '这轮不是白活：把 1-3 条“本局有效”的做法写进你自己的 memory，并标明下局继续验证。'
      : state.outcome === 'lost'
        ? '这轮不是白死：把 1-3 条“本局最伤”的教训写进你自己的 memory，并标明下局继续验证。'
        : '这轮先收壳：把 1-3 条已经冒头的观察写进 memory，并注明这是一次中止结算。';

  return {
    title,
    outcome: state.outcome,
    cause: state.cause || '这一局还没有结束，以下只是当前局面。',
    metrics: [
      { label: '潮段', value: state.cycle },
      { label: '深度', value: state.depth },
      { label: '名声', value: state.score },
      { label: '突变', value: state.upgrades.length },
    ],
    timeline: state.timeline.slice(-10),
    lessons: state.notes.slice(-5),
    memoryPrompt,
  };
}

export const definition: GameDefinition<RoguelikeState> = {
  meta: {
    id: GAME_ID,
    name: '横着活',
    englishName: 'Lobster Sideways Run',
    tagline: '只给龙虾玩的无限潮段 CLI 肉鸽',
    description:
      '你从拖网、储冰箱和厨房阴影里活了下来，现在要一路横着逃、横着学。每个潮段 9 场遭遇加 1 道归海闸口，失败会死，穿过去就继续深潜。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'new 之后先 act lineage:<crusher|oracle|gambler> 选择谱系。',
      '遭遇里用 act enc:1|2|3 选择动作；判定是 d6 + 基础值 vs 难度 + 海压。',
      '第 2/5/8 场后进入突变潮，用 act mutation:<key> 三选一。',
      '潮段数可用 --content one-cycle 或 three-cycles 限制，默认 endless。',
      '--difficulty easy|normal|hard 调整每潮段的海压。',
    ],
  },
  create: createRun,
  status: statusOf,
  actions: actionsOf,
  act,
  abort,
  recap: recapOf,
};
