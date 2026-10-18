import type { GameDefinition, Metric, RecapView, StatusView } from '@gameclaw/gamekit';

import { PROFILES, profileByKey } from './content';
import {
  abort,
  act,
  availableActions,
  briefingLines,
  createRun,
  finalNotes,
  forecastLines,
  GAME_ID,
  GAME_VERSION,
  type HeistState,
  lastResultLines,
  MAP_LEGEND,
  mapRows,
  missionOf,
  objectiveLines,
  outcomeHeadline,
  positionLabel,
  settlementScore,
} from './engine';

function metricsOf(state: HeistState): Metric[] {
  const profile = state.profile ? profileByKey(state.profile) : null;
  return [
    { label: '回合', value: state.turn },
    { label: '曝光', value: `${state.exposure}/${state.exposureLimit}` },
    { label: '警戒', value: state.alert },
    { label: '噪音', value: state.noise?.intensity ?? 0 },
    { label: '窗', value: state.lockdown ?? '--' },
    { label: '道具', value: `${state.gear}/${profile?.gearCharges ?? '-'}` },
  ];
}

function setupStatus(state: HeistState): StatusView {
  const { facility, objective } = missionOf(state);
  return {
    headline: `选择 profile · ${facility.title} · ${objective.title}`,
    metrics: [
      { label: '种子', value: state.seed },
      { label: '曝光上限', value: state.exposureLimit },
    ],
    sections: [
      { title: '任务简报', lines: briefingLines(state, true) },
      {
        title: '三条 profile',
        lines: PROFILES.map(
          (profile) =>
            `${profile.title}：${profile.gearName}×${profile.gearCharges}；被动 ${profile.passiveSummary}；撤离窗 +${profile.extractionBonus}`,
        ),
      },
      {
        title: '规则',
        lines: [
          '每个 act 只做 1 个动作：移动、观察、等待、交互或动 gear。',
          '视线、镜头、巡逻近线和响应者会推高曝光；掩体、暗格、蒸汽和墨幕能压回去。',
          '拿到目标后进入撤离段：带货噪音更高、响应者会切入、撤离窗开始倒数。',
        ],
      },
    ],
    outcome: state.outcome,
    turn: state.turn,
    phase: state.phase,
  };
}

function statusOf(state: HeistState): StatusView {
  if (state.phase === 'setup') return setupStatus(state);
  const { facility } = missionOf(state);
  const ended = state.outcome !== 'ongoing';
  const headline = `${outcomeHeadline(state)} · ${facility.title} · ${positionLabel(state.position)}`;
  if (ended) {
    return {
      headline,
      metrics: metricsOf(state),
      sections: [
        { title: '设施', lines: [...mapRows(state), ...MAP_LEGEND] },
        {
          title: '结算',
          lines: [
            state.cause,
            `账面 ${settlementScore(state)} · 回合 ${state.turn} · 曝光峰值 ${state.exposurePeak}`,
          ],
        },
        { title: '上一次结果', lines: lastResultLines(state) },
      ],
      outcome: state.outcome,
      turn: state.turn,
      phase: state.phase,
    };
  }
  return {
    headline,
    metrics: metricsOf(state),
    sections: [
      { title: '设施', lines: [...mapRows(state), ...MAP_LEGEND] },
      { title: '简报', lines: briefingLines(state, false) },
      { title: '目标', lines: objectiveLines(state) },
      { title: '预判', lines: forecastLines(state) },
      { title: '上一次结果', lines: lastResultLines(state) },
    ],
    outcome: state.outcome,
    turn: state.turn,
    phase: state.phase,
  };
}

function recapOf(state: HeistState): RecapView {
  const { facility, objective } = missionOf(state);
  const profile = state.profile ? profileByKey(state.profile) : null;
  const title =
    state.phase === 'setup'
      ? '尚未入场'
      : `${profile?.title ?? '未知 profile'} · ${facility.title} · ${objective.title}`;
  const memoryPrompt =
    state.outcome === 'won'
      ? '这轮不是白赢：把 1-3 条本局有效的潜入 / 撤离节奏写进 memory，并标明下局继续验证。'
      : state.outcome === 'lost'
        ? '这轮不是白输：把 1-3 条本局最伤的选择写进 memory，并标明下局继续验证。'
        : state.outcome === 'aborted'
          ? '这轮先收壳：把 1-3 条已经冒头的观察写进 memory，并注明这是一次中止结算。'
          : '这局还没结束，先不要下结论；记录当前最强的假设，下一局再验证。';
  const targetState = state.objectiveTaken
    ? '已到手'
    : state.objectiveKnown
      ? '已确认真目标'
      : '未确认';
  return {
    title,
    outcome: state.outcome,
    cause:
      state.cause ||
      (state.phase === 'setup'
        ? '还没有选择 profile，这只是一份尚未开始的简报。'
        : '这一局还没有结束，下面是当前局面。'),
    metrics: [
      { label: '种子', value: state.seed },
      { label: '回合', value: state.turn },
      { label: '账面', value: settlementScore(state) },
      { label: '曝光峰值', value: state.exposurePeak },
      { label: '警戒', value: state.alert },
      { label: '目标', value: targetState },
      { label: '道具', value: state.gear },
    ],
    timeline: state.timeline.slice(-10),
    lessons: state.outcome === 'ongoing' ? [] : finalNotes(state),
    memoryPrompt,
  };
}

export const definition: GameDefinition<HeistState> = {
  meta: {
    id: GAME_ID,
    name: '横着潜',
    englishName: 'Lobster CLI Heist',
    tagline: '只给龙虾玩的 CLI 潜行渗透',
    description:
      '你是一只龙虾渗透手，要在两排货架、镜头和巡逻蟹之间摸到目标，再在设施锁死前横着撤出去。每个 act 只做一个动作；取物后噪音、响应者和撤离窗会一起翻脸。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'new 之后先 act choose:shade|breaker|runner 选 profile。',
      '移动用 act move:n|s|e|w；n/s 只在爬升列可用，vent 同向滑潜，带货后失效。',
      '在终端 / 缓存 / 候选货格 / 出口分别用 interact:console|cache|objective|extract。',
      'observe 读下一拍；wait 压曝光；gear 是留给关键转角的翻盘资源。',
      '曝光达到上限、被响应者或巡逻蟹撞上、撤离窗归零都会输。',
      '--content cold-rack|galley-backline|dock-drain 可固定设施骨架。',
      '--difficulty easy|normal|hard 调整曝光上限与撤离窗。',
    ],
  },
  create: (options) => createRun(options),
  status: statusOf,
  actions: availableActions,
  act,
  abort,
  recap: recapOf,
};
