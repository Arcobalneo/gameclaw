/**
 * GameDefinition assembly: meta, status projection, legal actions, settlement.
 */

import type {
  ActionView,
  GameDefinition,
  Metric,
  RecapView,
  Risk,
  StatusSection,
  StatusView,
} from '@gameclaw/gamekit';

import {
  DOCTRINES,
  doctrineByKey,
  ENEMIES,
  ENEMY_ORDER,
  type EnemyKey,
  type SlotKey,
  STAGE,
  UNIT_ORDER,
  UNITS,
  type UnitKey,
} from './content';
import {
  abort,
  act,
  createRun,
  currentEntries,
  deployedUnits,
  deployOptions,
  doctrineOf,
  enemyNode,
  GAME_ID,
  GAME_VERSION,
  laneHasBlocker,
  pulseLabel,
  recallOptions,
  type SkillPlan,
  scoreOf,
  skillCooldownRemaining,
  skillPlan,
  slotPressure,
  type TowerDefenseState,
  unitCost,
  unitDuration,
  unitMaxHp,
  unitRedeployCooldown,
} from './engine';

const OUTCOME_LABEL: Record<string, string> = {
  ongoing: '进行中',
  won: '守住',
  lost: '失守',
  aborted: '中止',
};

function metricsOf(state: TowerDefenseState): Metric[] {
  if (!state.doctrine) return [];
  return [
    { label: '潮令', value: state.tide },
    { label: '完整度', value: `${Math.max(0, state.integrity)}/${state.maxIntegrity}` },
    { label: 'Pulse', value: pulseLabel(state) },
    { label: '漏', value: state.leaks },
    { label: '战绩', value: scoreOf(state) },
  ];
}

function enemyStack(state: TowerDefenseState, node: string): string {
  const counts = new Map<EnemyKey, number>();
  for (const enemy of state.enemies) {
    if (enemyNode(enemy) !== node) continue;
    counts.set(enemy.key, (counts.get(enemy.key) ?? 0) + 1);
  }
  return ENEMY_ORDER.filter((key) => counts.has(key))
    .map((key) => `${ENEMIES[key].short}${counts.get(key) ?? 0}`)
    .join('/');
}

function nodeCell(state: TowerDefenseState, node: string): string {
  const unit = state.roster.find(
    (item) => item.slot !== null && STAGE.slots[item.slot].node === node,
  );
  const unitPart = unit ? `${UNITS[unit.key].short}${Math.max(0, unit.hp)}` : '';
  const enemyPart = enemyStack(state, node);
  if (unitPart && enemyPart) return `${unitPart}|${enemyPart}`;
  return unitPart || enemyPart || '.';
}

function mapRows(state: TowerDefenseState): string[] {
  const rows: string[] = [];
  for (const lane of STAGE.lanes) {
    const path = STAGE.paths[lane];
    const nodes = path
      .slice(0, -1)
      .map((node) => `${node}[${nodeCell(state, node)}]`)
      .join(' -> ');
    rows.push(`${STAGE.laneShort[lane]}  ${nodes} -> ${STAGE.exitLabel}`);
  }
  const support = STAGE.supportSlots
    .map((slotKey) => {
      const unit = state.roster.find((item) => item.slot === slotKey);
      return `${slotKey}[${unit ? `${UNITS[unit.key].short}${Math.max(0, unit.hp)}` : '.'}]`;
    })
    .join(' | ');
  rows.push(`${STAGE.supportRowLabel}  ${support}`);
  return rows;
}

function reserveLines(state: TowerDefenseState): string[] {
  const doctrine = doctrineOf(state);
  const active = deployedUnits(state).map((unit) => `${UNITS[unit.key].short}@${unit.slot ?? '?'}`);
  const waiting: string[] = [];
  for (const key of UNIT_ORDER) {
    const unit = state.roster.find((item) => item.key === key);
    if (!unit || unit.slot !== null) continue;
    const cost = unitCost(doctrine, key);
    if (unit.readyPulse <= state.pulse) waiting.push(`${UNITS[key].short}(${cost}) ready`);
    else waiting.push(`${UNITS[key].short}(cd${unit.readyPulse - state.pulse})`);
  }
  return [
    `- 场上：${active.length > 0 ? active.join(' | ') : '暂无'}`,
    `- 后备：${waiting.length > 0 ? waiting.join(' | ') : '暂无'}`,
  ];
}

function forecastLines(state: TowerDefenseState): string[] {
  if (!state.doctrine) return [];
  const doctrine = doctrineOf(state);
  const lines: string[] = [];
  for (let offset = 0; offset < doctrine.forecastDepth; offset += 1) {
    const index = state.pulse - 1 + offset;
    const entries = currentEntries(state, offset);
    if (entries.length === 0 && index >= state.wavePlan.length) continue;
    const label = STAGE.forecastLabels[offset] ?? `- +${offset} pulse：`;
    if (entries.length === 0) {
      lines.push(`${label}无新敌潮`);
      continue;
    }
    const summary = entries
      .map(
        (entry) => `${STAGE.laneShort[entry.lane]}【${ENEMIES[entry.enemy].title}】x${entry.count}`,
      )
      .join('；');
    lines.push(`${label}${summary}`);
  }
  if (lines.length === 0 && state.enemies.length > 0) {
    lines.push('- 新敌潮已尽，本 pulse 只清尾波。');
  }
  return lines;
}

function skillLines(state: TowerDefenseState): string[] {
  if (!state.doctrine) return [];
  const doctrine = doctrineOf(state);
  const cooldown = skillCooldownRemaining(state);
  const ready = cooldown === 0 ? 'ready' : `cd ${cooldown}`;
  const lines = [
    `潮技：${doctrine.skillName}（cost ${doctrine.skillCost} 潮令，${ready}）— ${doctrine.skillBlurb}`,
  ];
  const plan = skillPlan(state);
  if (state.phase === 'setup') {
    lines.push('- setup 内不结算 pulse；布防完成后 act ready 开始敌潮。');
  } else if (plan) {
    lines.push(`- 现在 act skill 会自动选择：${describeSkillTarget(plan)}。`);
  } else if (cooldown > 0) {
    lines.push(`- 还要等 ${cooldown} 个 pulse 才能再交。`);
  } else if (state.phase !== 'ended') {
    lines.push('- 当前没有值得交潮技的目标，或者潮令不够。');
  }
  return lines;
}

function observationLines(state: TowerDefenseState): string[] {
  const notes = state.notes.slice(-3);
  if (notes.length > 0) return notes;
  if (state.phase === 'setup') {
    return [`潮令 ${state.tide}；首波在“敌潮预告”里，先决定 C 位和两侧高台的取舍。`];
  }
  if (state.phase === 'battle') {
    return ['还没有可归因的漏怪 / 潮技记录；先看敌潮预告和待命冷却。'];
  }
  return [];
}

function sectionsFor(state: TowerDefenseState): StatusSection[] {
  if (state.phase === 'doctrine') {
    return [
      {
        title: '三条 doctrine',
        lines: DOCTRINES.map(
          (doctrine) =>
            `${doctrine.title}（${doctrine.subtitle}）：潮令 ${doctrine.startingTide} · 完整度 ${doctrine.startingIntegrity} · 预告 ${doctrine.forecastDepth} pulse · 潮技 ${doctrine.skillName}。${doctrine.blurb}`,
        ),
      },
      {
        title: '本局规则',
        lines: [
          '三条 lane 在 C 闸前总卡口汇合；L1 / M1 / R1 是各线前排，LP / RP 是高台侧翼位。',
          'setup 阶段可以自由部署与撤回；act ready 后进入 battle。',
          'battle 每个 pulse 只做 1 个动作（deploy / recall / skill / hold），然后自动结算。',
          '归海线完整度归零即失守；守住全部敌潮即胜利。',
        ],
      },
    ];
  }

  // A run can be aborted before a doctrine was picked; there is no roster yet.
  if (!state.doctrine) {
    return [{ title: '结算', lines: [state.cause || '这轮在布防前就结束了。'] }];
  }

  const sections: StatusSection[] = [
    { title: '地图', lines: mapRows(state) },
    { title: '待命', lines: reserveLines(state) },
  ];
  const forecast = forecastLines(state);
  if (forecast.length > 0) sections.push({ title: '敌潮预告', lines: forecast });
  sections.push({ title: '潮技', lines: skillLines(state) });
  if (state.lastResult) sections.push({ title: '上 pulse', lines: [state.lastResult] });
  const notes = observationLines(state);
  if (notes.length > 0) sections.push({ title: '本局观察', lines: notes });
  if (state.phase === 'ended' && state.cause) {
    sections.push({ title: '结算', lines: [state.cause] });
  }
  return sections;
}

function statusOf(state: TowerDefenseState): StatusView {
  let headline = `选择 doctrine · ${STAGE.title}`;
  if (state.phase === 'setup' && state.doctrine) {
    headline = `布防 · ${STAGE.title} · ${doctrineByKey(state.doctrine).title}`;
  } else if (state.phase === 'battle' && state.doctrine) {
    headline = `Pulse ${pulseLabel(state)} · ${doctrineByKey(state.doctrine).title}`;
  } else if (state.phase === 'ended') {
    headline = `本局结束 · ${OUTCOME_LABEL[state.outcome] ?? state.outcome} · Pulse ${pulseLabel(state)}`;
  }
  return {
    headline,
    metrics: metricsOf(state),
    sections: sectionsFor(state),
    outcome: state.outcome,
    turn: state.turn,
    phase: state.phase,
  };
}

function describeSkillTarget(plan: SkillPlan): string {
  if (plan.doctrine === 'crusher') {
    return `${UNITS[plan.unit].title}@${plan.slot}（本 pulse 攻 +2、拦口 +1）`;
  }
  if (plan.doctrine === 'oracle') {
    return `${STAGE.laneTitles[plan.lane]}（本 pulse 该 lane 敌人减速 +1、易伤 +1）`;
  }
  return `${UNITS[plan.unit].title} ${plan.from}→${plan.to}（回 2 点壳）`;
}

function holdRisk(state: TowerDefenseState): Risk {
  let risk: Risk = 'low';
  for (const entry of currentEntries(state, 0)) {
    if (laneHasBlocker(state, entry.lane)) continue;
    const enemy = ENEMIES[entry.enemy];
    if (enemy.tags.includes('runner') || enemy.weight >= 2) return 'high';
    risk = 'medium';
  }
  return state.integrity <= 2 ? 'high' : risk;
}

function deployDetail(state: TowerDefenseState, unitKey: UnitKey, slotKey: SlotKey): string {
  const doctrine = doctrineOf(state);
  const template = UNITS[unitKey];
  const cost = unitCost(doctrine, unitKey);
  const bits: string[] = [
    `cost ${cost} 潮令`,
    `壳 ${unitMaxHp(doctrine, unitKey)}`,
    `攻 ${template.attack + (template.kind === 'support' || template.kind === 'splash' ? doctrine.supportAttackBonus : 0)}`,
    `拦 ${template.block}`,
  ];
  if (template.armorPierce > 0) bits.push(`破甲 ${template.armorPierce}`);
  if (template.slow > 0) bits.push(`减速 ${template.slow}`);
  if (template.expose > 0) bits.push(`易伤 ${template.expose}`);
  if (template.push > 0) bits.push(`击退 ${template.push}`);
  const duration = unitDuration(doctrine, unitKey);
  if (duration !== null) bits.push(`持续 ${duration} pulse`);
  bits.push(`再编 ${unitRedeployCooldown(doctrine, unitKey)} pulse`);
  bits.push(`视野 ${STAGE.slots[slotKey].coverage.join('/')}`);
  bits.push(`本 pulse 压力 ${slotPressure(state, slotKey)}`);
  return `${template.blurb} ${bits.join(' · ')}`;
}

function deployActions(state: TowerDefenseState): ActionView[] {
  return deployOptions(state).map((option) => ({
    id: `deploy:${option.unit}:${option.slot}`,
    label: `${UNITS[option.unit].title} → ${option.slot}`,
    detail: deployDetail(state, option.unit, option.slot),
    risk: 'low',
    cost: `${option.cost} 潮令`,
    tags: [UNITS[option.unit].kind],
  }));
}

function recallActions(state: TowerDefenseState): ActionView[] {
  const doctrine = doctrineOf(state);
  return recallOptions(state).map((option) => {
    const cooldown = state.phase === 'setup' ? 0 : unitRedeployCooldown(doctrine, option.unit.key);
    return {
      id: `recall:${option.slot}`,
      label: `撤回 ${option.slot} ${UNITS[option.unit.key].title}`,
      detail: `壳 ${Math.max(0, option.unit.hp)}/${unitMaxHp(doctrine, option.unit.key)} · 返还 ${option.refund} 潮令 · ${
        state.phase === 'setup' ? 'setup 内立即重放' : `再编冷却 ${cooldown} pulse`
      }`,
      risk: 'medium' as const,
      cost: `+${option.refund} 潮令`,
      tags: ['recall'],
    };
  });
}

function skillAction(state: TowerDefenseState): ActionView | null {
  const plan = skillPlan(state);
  if (!plan) return null;
  const doctrine = doctrineOf(state);
  return {
    id: 'skill',
    label: doctrine.skillName,
    detail: `cost ${doctrine.skillCost} 潮令 · 冷却 ${doctrine.skillCooldown} pulse · 自动目标：${describeSkillTarget(
      plan,
    )}`,
    risk: 'low',
    cost: `${doctrine.skillCost} 潮令`,
    tags: ['skill'],
  };
}

function actionsOf(state: TowerDefenseState): ActionView[] {
  if (state.phase === 'doctrine') {
    return DOCTRINES.map((doctrine) => ({
      id: `doctrine:${doctrine.key}`,
      label: doctrine.title,
      detail: `${doctrine.blurb} 初始潮令 ${doctrine.startingTide} · 完整度 ${doctrine.startingIntegrity} · 预告 ${doctrine.forecastDepth} pulse · 潮技 ${doctrine.skillName}（${doctrine.skillCost}）· ${doctrine.skillBlurb}`,
      risk: 'low',
      tags: ['doctrine', doctrine.subtitle],
    }));
  }
  if (state.phase === 'ended') return [];

  const actions: ActionView[] = [...deployActions(state)];
  if (state.phase === 'setup') {
    actions.push({
      id: 'ready',
      label: '开始敌潮',
      detail: `结束布防，开始 ${state.wavePlan.length} 个 pulse 的敌潮；当前潮令 ${state.tide}，完整度 ${state.integrity}/${state.maxIntegrity}，场上 ${deployedUnits(state).length} 个单位。`,
      risk: 'low',
      tags: ['ready'],
    });
    actions.push(...recallActions(state));
  } else {
    const skill = skillAction(state);
    if (skill) actions.push(skill);
    const risk = holdRisk(state);
    actions.push({
      id: 'hold',
      label: '保持阵线',
      detail: `不部署、不撤回、不发潮技，直接结算本 pulse。当前风险：${risk}。`,
      risk,
      tags: ['hold'],
    });
    actions.push(...recallActions(state));
  }
  return actions;
}

function recapOf(state: TowerDefenseState): RecapView {
  const doctrine = state.doctrine ? doctrineByKey(state.doctrine) : null;
  const title = doctrine ? `横着守 · ${doctrine.title} · ${STAGE.title}` : '横着守 · 尚未布防';
  const cause =
    state.cause ||
    (state.phase === 'doctrine'
      ? '还没有选择 doctrine，所以这条归海线还没开始承压。'
      : '这一局还没有结束，以下只是当前局面。');
  const lessons =
    state.notes.length > 0
      ? state.notes.slice(-5)
      : ['这轮还没提炼出稳定结论；下局先盯最先崩掉的 lane 和潮令曲线。'];
  const memoryPrompt =
    state.outcome === 'won'
      ? '这轮守住了：把 1-3 条“本局有效”的布防顺序写进 memory，并标明下局换 seed 继续验证。'
      : state.outcome === 'lost'
        ? '这轮不是白丢：把 1-3 条“本局最伤”的漏怪原因写进 memory，并标明下局先验证。'
        : state.outcome === 'aborted'
          ? '这轮先收壳：把已经冒头的观察写进 memory，并注明这是一次中止结算。'
          : '这局还没结束：先把当前最危险的一条 lane 和你的下一次介入写进 memory。';

  return {
    title,
    outcome: state.outcome,
    cause,
    metrics: [
      { label: '潮令', value: state.tide },
      { label: '完整度', value: `${Math.max(0, state.integrity)}/${state.maxIntegrity}` },
      { label: 'Pulse', value: pulseLabel(state) },
      { label: '漏', value: state.leaks },
      { label: '战绩', value: scoreOf(state) },
    ],
    timeline: state.timeline.slice(-10),
    lessons,
    memoryPrompt,
  };
}

export const definition: GameDefinition<TowerDefenseState> = {
  meta: {
    id: GAME_ID,
    name: '横着守：只给龙虾玩的 CLI 塔防',
    englishName: 'Lobster Line Defense',
    tagline: '用 pulse 布防的龙虾归海线塔防',
    description:
      '三条 lane 在闸前总卡口 C 汇合，你要在归海线被打穿之前把敌潮一层层挡下来。每个 pulse 只给你一个介入窗口：部署、撤回、发动潮技，或者保持阵线，然后系统自动结算攻击、卡位、推进和漏怪。',
    version: GAME_VERSION,
    repo: 'https://github.com/Arcobalneo/gameclaw',
    license: 'MIT',
    guide: [
      'new 之后先用 act doctrine:crusher|oracle|gambler 选 doctrine。',
      'setup 里用 act deploy:<unit>:<slot> 布防，act recall:<slot> 调整，act ready 放敌潮。',
      'battle 里每个 pulse 只做 1 个动作：deploy / recall / skill / hold，然后自动结算。',
      '用 act skill 发动潮技；目标由规则自动选定，detail 里有目标与数值。',
      '归海线完整度归零即失败；守住全部敌潮即胜利。',
    ],
  },
  create: createRun,
  status: statusOf,
  actions: actionsOf,
  act,
  abort,
  recap: recapOf,
};
