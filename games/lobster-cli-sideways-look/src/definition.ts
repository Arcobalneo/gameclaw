import type {
  ActionView,
  GameDefinition,
  Metric,
  RecapView,
  Risk,
  StatusView,
} from '@gameclaw/gamekit';

import { CASES, type CaseConfig, type Interactable, type RoomConfig } from './content';
import {
  abort,
  act,
  activeRoom,
  caseOf,
  createRun,
  GAME_ID,
  GAME_VERSION,
  MAX_DREAD,
  MAX_FOCUS,
  MAX_NERVE,
  roomOf,
} from './engine';
import type { LookState } from './model';

const ENDING_LABELS: Record<LookState['ending'], string> = {
  none: '仍在观察',
  escaped: '成功撤离',
  'wrong-record': '错误记录',
  'lost-nerve': '神经崩溃',
  'lost-dread': '恐惧封顶',
  aborted: '主动中止',
};

function endingLabel(state: LookState): string {
  if (state.outcome === 'ongoing') return '仍在观察';
  return ENDING_LABELS[state.ending];
}

function objectiveLabel(state: LookState): string {
  if (!state.objectiveCollected) return '未取得';
  if (state.objectiveQuality === 'verified') return 'verified';
  if (state.objectiveQuality === 'uncertain') return 'uncertain';
  return 'unknown';
}

function metricsOf(state: LookState): Metric[] {
  return [
    { label: '专注', value: state.focus },
    { label: '神经', value: state.nerve },
    { label: '恐惧', value: state.dread },
    {
      label: '证据',
      value: state.caseId ? `${state.evidence}/${state.requiredEvidence}` : state.evidence,
    },
  ];
}

function caseTagline(caseConfig: CaseConfig): string {
  return `${caseConfig.chineseName}（${caseConfig.id}）：${caseConfig.summary} 需要 ${caseConfig.requiredEvidence} 条证据，${caseConfig.rooms.length} 个房间。`;
}

function inspectRisk(state: LookState): Risk {
  if (state.focus <= 1 || state.dread >= 7) return 'high';
  if (state.focus <= 3 || state.dread >= 4) return 'medium';
  return 'low';
}

function moveRisk(state: LookState): Risk {
  return state.nerve <= 3 || state.dread >= 7 ? 'medium' : 'low';
}

function interactRisk(state: LookState, item: Interactable): Risk {
  if (item.effect === 'objective' && state.evidence < state.requiredEvidence) return 'high';
  if (state.dread >= 7) return 'medium';
  return 'low';
}

function inspectActions(state: LookState, room: RoomConfig): ActionView[] {
  return room.inspectTargets.map((target) => ({
    id: `inspect:${target.id}`,
    label: `检查 ${target.label}`,
    detail: `观察 ${target.label}：触发 inspect 事件，可能改变专注/神经/恐惧/证据，并把当前现象命名。每次消耗 ${target.focusCost ?? 1} 专注；专注为 0 时继续观察会额外 +1 恐惧。`,
    risk: inspectRisk(state),
    cost: `专注 ${target.focusCost ?? 1}`,
    tags: ['inspect'],
  }));
}

function interactActions(state: LookState, room: RoomConfig): ActionView[] {
  const actions: ActionView[] = [];
  for (const item of room.interactables) {
    if (item.effect === 'objective' && state.objectiveCollected) continue;
    const detail =
      item.effect === 'objective'
        ? `取得目标档案（${item.label}）：证据达到 ${state.requiredEvidence} 条时目标为 verified，否则为 uncertain；撤离时未验证会变成错误记录。取得时恐惧 +2。`
        : item.effect === 'stabilize'
          ? `操作${item.label}：触发 interact 事件，并恢复专注 +1、神经 +1、恐惧 -1。`
          : `操作${item.label}：触发 interact 事件，并揭露一个可 record 的现象。`;
    actions.push({
      id: `interact:${item.id}`,
      label: item.effect === 'objective' ? '取得目标档案' : `操作 ${item.label}`,
      detail,
      risk: interactRisk(state, item),
      ...(item.effect === 'objective' ? { cost: '恐惧 +2' } : {}),
      tags: ['interact', item.effect],
    });
  }
  return actions;
}

function moveActions(state: LookState, caseConfig: CaseConfig, room: RoomConfig): ActionView[] {
  return room.exits.map((exitId) => {
    const target = caseConfig.rooms.find((candidate) => candidate.id === exitId);
    const name = target?.name ?? exitId;
    return {
      id: `move:${exitId}`,
      label: `移向 ${name}`,
      detail: `移动到 ${name}：触发该房间的 move 事件，并清空当前现象。`,
      risk: moveRisk(state),
      tags: ['move'],
    };
  });
}

function recordAction(state: LookState): ActionView[] {
  const phenomenon = state.currentPhenomenon;
  if (!phenomenon || state.recordedClues.includes(phenomenon.clueId)) return [];
  return [
    {
      id: 'record',
      label: '记录当前现象',
      detail: `把「${phenomenon.title}」写入档案：证据 +1，当前 ${state.evidence}/${state.requiredEvidence}。记录本身不掷骰、不触发事件。`,
      risk: 'low',
      tags: ['record'],
    },
  ];
}

function braceAction(): ActionView {
  return {
    id: 'brace',
    label: '稳住呼吸',
    detail: '专注 +2、神经 +1、恐惧 -1（按上限截断），不触发事件。',
    risk: 'low',
    tags: ['brace'],
  };
}

function extractAction(state: LookState): ActionView[] {
  if (!state.objectiveCollected) {
    return [
      {
        id: 'extract',
        label: '尝试撤离',
        detail: '出口只接受档案；现在还没有取得目标，尝试会被拒绝并增加恐惧。',
        risk: 'high',
        tags: ['extract'],
      },
    ];
  }
  return [
    {
      id: 'extract',
      label: '尝试撤离',
      detail:
        state.objectiveQuality === 'verified'
          ? '带着 verified 档案离开，结束本局并记作成功撤离。'
          : '带着 uncertain 档案离开：会结束本局，但结局是错误记录。',
      risk: state.objectiveQuality === 'verified' ? 'low' : 'high',
      tags: ['extract'],
    },
  ];
}

function exploreActions(state: LookState): ActionView[] {
  const caseConfig = caseOf(state);
  if (!caseConfig) return [];
  const room = activeRoom(state);
  return [
    ...inspectActions(state, room),
    ...interactActions(state, room),
    ...moveActions(state, caseConfig, room),
    ...recordAction(state),
    braceAction(),
    ...(room.isExit ? extractAction(state) : []),
  ];
}

function actionsOf(state: LookState): ActionView[] {
  if (state.phase === 'case-select') {
    return CASES.map((caseConfig) => ({
      id: `choose:${caseConfig.id}`,
      label: caseConfig.chineseName,
      detail: `${caseConfig.summary} 需要 ${caseConfig.requiredEvidence} 条证据；入口 ${caseConfig.startingRoom}，共 ${caseConfig.rooms.length} 个房间。`,
      risk: 'low',
      tags: ['case'],
    }));
  }
  if (state.phase === 'ended') return [];
  return exploreActions(state);
}

function asciiOf(state: LookState, caseConfig: CaseConfig | null): string[] {
  if (state.currentPhenomenon) return state.currentPhenomenon.ascii;
  if (state.latestAscii.length > 0) return state.latestAscii;
  return caseConfig?.defaultAscii ?? [];
}

function caseSelectStatus(state: LookState): StatusView {
  return {
    headline: '选择要进入的副本',
    metrics: [],
    sections: [
      {
        title: '四个副本入口',
        lines: CASES.map(caseTagline),
      },
      {
        title: '怎么玩',
        lines: [
          'act choose:<case-id> 进入一个副本；之后每个动作都是一条 CLI 命令。',
          'inspect 命名现象，record 把它写成证据；证据足够后取得目标并 extract。',
          '神经归零或恐惧达到 10 即失败；abort 随时可以诚实中止。',
        ],
      },
    ],
    outcome: state.outcome,
    turn: state.turn,
    phase: state.phase,
  };
}

function exploringStatus(state: LookState): StatusView {
  const caseConfig = caseOf(state);
  const room = roomOf(state);
  const phenomenon = state.currentPhenomenon;
  const ascii = asciiOf(state, caseConfig);
  const sections: StatusView['sections'] = [];

  if (state.phase === 'ended') {
    sections.push({
      title: `结算 · ${endingLabel(state)}`,
      lines: [state.cause],
    });
  }

  if (caseConfig && room) {
    sections.push(
      {
        title: `房间 · ${room.name}`,
        lines: [
          `${caseConfig.chineseName} / ${room.id} · tags: ${room.tags.join(' / ')}`,
          ...room.panels,
          `出口：${room.exits.join(' / ')}`,
        ],
      },
      {
        title: '侧视面板',
        lines: ascii,
      },
      {
        title: '当前现象',
        lines: phenomenon
          ? [
              `${phenomenon.title}${state.recordedClues.includes(phenomenon.clueId) ? '（已记录）' : ''}`,
              `线索 ${phenomenon.clueId}：${phenomenon.clueText}`,
              `目击：${phenomenon.witness}`,
            ]
          : ['没有可命名的现象。inspect 一个目标，让它先看见你。'],
      },
      {
        title: '发现与目标',
        lines: [
          `目标：${objectiveLabel(state)} · 证据 ${state.evidence}/${state.requiredEvidence} · 已记录 ${state.recordedClues.length} 条`,
          ...(state.findings.length > 0
            ? state.findings.slice(-5).map((finding) => `· ${finding}`)
            : ['· 还没有留下任何发现。']),
        ],
      },
    );
  }

  sections.push({
    title: '上一次结果',
    lines: [state.latestResult || '刚进入副本，还没有动作。'],
  });

  return {
    headline:
      state.phase === 'ended'
        ? `${state.caseName || '未选副本'} · ${endingLabel(state)}`
        : `${state.caseName} · ${room?.name ?? '未知房间'} · 回合 ${state.turn}`,
    metrics: metricsOf(state),
    sections,
    outcome: state.outcome,
    turn: state.turn,
    phase: state.phase,
  };
}

function statusOf(state: LookState): StatusView {
  if (state.phase === 'case-select') return caseSelectStatus(state);
  return exploringStatus(state);
}

function shorten(text: string, limit = 120): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

function lessonsOf(state: LookState): string[] {
  const lessons: string[] = [];
  if (state.caseId) {
    lessons.push(
      `本局在${state.caseName}用了 ${state.turn} 回合，记录 ${state.recordedClues.length} 条线索，证据 ${state.evidence}/${state.requiredEvidence}。`,
    );
  }

  switch (state.ending) {
    case 'escaped':
      lessons.push(
        '有效路线：先 inspect 命名现象、record 攒证据，再取得目标并撤离；这条路线值得写进 memory。',
      );
      break;
    case 'wrong-record':
      lessons.push(
        `证据 ${state.evidence}/${state.requiredEvidence} 时取档并撤离会得到错误记录；下次先攒够证据再 claim，或者 claim 后继续 record 把 uncertain 升到 verified。`,
      );
      break;
    case 'lost-nerve':
      lessons.push(
        '神经归零即失败：inspect/move/interact 的事件都可能扣神经，brace 只回 1 点，撤离路线要更早规划。',
      );
      break;
    case 'lost-dread':
      lessons.push(
        '恐惧到 10 即失败：inspect/move/interact 的事件多数会加恐惧，brace 能压回 1 点，别把它留到最后一回合。',
      );
      break;
    case 'aborted':
      lessons.push(
        '中止既不是胜利也不是失败：这份侦察笔记可以保留，下次用 --content <case-id> 直接进入。',
      );
      break;
    case 'none':
      lessons.push('本局还没结束；目前的结论只是阶段性观察，不要当成规则。');
      break;
  }

  lessons.push(
    `专注上限 ${MAX_FOCUS}，每回合 inspect 消耗 1 点；专注为 0 后继续 inspect 会额外 +1 恐惧。神经上限 ${MAX_NERVE}，恐惧上限 ${MAX_DREAD}。`,
  );
  if (state.findings.length > 0) {
    lessons.push(`本局看见过：${state.findings.slice(-3).join('；')}。`);
  }
  return lessons;
}

function recapOf(state: LookState): RecapView {
  const caseConfig = caseOf(state);
  const title = caseConfig ? `${caseConfig.chineseName} · ${endingLabel(state)}` : '尚未进入副本';
  const cause = state.cause
    ? state.cause
    : state.caseId
      ? `本局仍在进行中：${state.caseName} / ${state.roomId}，证据 ${state.evidence}/${state.requiredEvidence}。`
      : '还没有选择副本；这份结算只记录了一个空的开场。';
  const memoryPrompt =
    state.ending === 'escaped'
      ? '这轮不是白看：把 1-3 条“本局有效”的观察写进你自己的 memory，并标明下局继续验证。'
      : state.ending === 'wrong-record'
        ? '这轮不是白走：把“证据不足就取档”的教训写进 memory，下次在 claim 前先数证据。'
        : state.outcome === 'lost'
          ? '这轮不是白怕：把 1-3 条“本局最伤”的教训写进 memory，并标明下局继续验证。'
          : state.outcome === 'ongoing'
            ? '这轮还在继续：把已经确认的现象写进 memory，但要标明它还没有经过撤离验证。'
            : '这轮先收壳：把已经冒头的观察写进 memory，并注明这是一次中止结算。';

  return {
    title,
    outcome: state.outcome,
    cause,
    metrics: [
      { label: '专注', value: state.focus },
      { label: '神经', value: state.nerve },
      { label: '恐惧', value: state.dread },
      { label: '证据', value: state.evidence },
      { label: '目标', value: objectiveLabel(state) },
      { label: '记录', value: state.recordedClues.length },
    ],
    timeline: state.history
      .slice(-12)
      .map((entry) => `T${entry.turn} ${entry.action} → ${shorten(entry.result)}`),
    lessons: lessonsOf(state),
    memoryPrompt,
  };
}

export const definition: GameDefinition<LookState> = {
  meta: {
    id: GAME_ID,
    name: '横着看：只给龙虾玩的 CLI 视觉恐怖',
    englishName: 'Lobster Sideways Look',
    tagline: '用一条条命令侧眼观察，直到档案承认你看见的东西',
    description:
      '一款单步命令式的 CLI 视觉恐怖：每个动作都是一条命令，每次 inspect 都会让侧视面板多看你一眼。四个短副本入口，记录、取证、撤离，或者带着错误记录走出门。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      '省略 --content 时先进入副本选择，用 act choose:<case-id> 进入；--content <case-id> 可直接开局。',
      'inspect:<target-id> 命名当前现象；record 把现象写成证据。',
      '证据达到 requiredEvidence 后取得目标才是 verified；未验证就 extract 会得到错误记录。',
      'move:<room-id> 横移，interact:<id> 操作稳定/揭露/取证，brace 恢复专注与神经。',
      '神经归零或恐惧达到 10 即失败；abort 可以随时诚实中止。',
    ],
  },
  create: createRun,
  status: statusOf,
  actions: actionsOf,
  act,
  abort,
  recap: recapOf,
};
