import type {
  ActionView,
  GameDefinition,
  Metric,
  RecapView,
  StatusSection,
  StatusView,
} from '@gameclaw/gamekit';

import { floorKind, floorKindLabel, plagueDeathChance, WIN_FLOOR } from './engine/abyss';
import { capturePreview } from './engine/capture';
import { activeCreatureOf, availableMoves, battleSideSummary } from './engine/combat';
import { abort, act } from './engine/index';
import {
  bestCaptureItem,
  itemCount,
  itemName,
  materialRows,
  potionInventory,
} from './engine/items';
import { plagueCandidates } from './engine/party';
import { AFFIX_BY_ID, displayName, expToNext, skillOf, speciesOf } from './engine/species';
import { alivePartyIndices, createState, hpRatio, maxHp, type TamerState } from './engine/state';
import {
  affixShortSymbols,
  affixSlotLabel,
  costLabel,
  rerollCost,
  sealCost,
  TIER_ORDER,
  tierIndex,
  unsealCost,
  upgradeCost,
} from './engine/workshop';
import { subAreaDisplayName, unlockedZoneList, zoneById, zoneDisplayName } from './engine/world';

const REPO = 'https://github.com/Arcobalneo/gameclaw';

function percent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function metricsOf(state: TamerState): Metric[] {
  const alive = alivePartyIndices(state).length;
  let current = 0;
  let maximum = 0;
  for (const creature of state.party) {
    if (!creature) continue;
    current += Math.max(0, creature.hp);
    maximum += maxHp(creature);
  }
  return [
    { label: '存活', value: `${alive}/6` },
    { label: '队伍HP', value: `${Math.round(current)}/${Math.round(maximum)}` },
    { label: '甲核', value: itemCount(state, 'jihe_core') },
    { label: '灵晶', value: itemCount(state, 'spirit_crystal') },
    { label: '最深', value: state.deepestFloor },
  ];
}

function headlineOf(state: TamerState): string {
  const zone = zoneDisplayName(state.currentZone);
  const sub = subAreaDisplayName(state.currentZone, state.currentSubArea);
  switch (state.phase) {
    case 'menu':
      return `营地 · ${zone}/${sub} · 深渊最深 ${state.deepestFloor} 层`;
    case 'zone':
      return `选择探索区域 · 已解锁 ${state.unlockedZones.length} 片海域`;
    case 'subarea':
      return `选择子区域 · ${zone}`;
    case 'explore':
      return state.explore
        ? `探索 ${zone}/${sub} · 第 ${state.explore.steps}/${state.explore.target} 步`
        : `探索 ${zone}/${sub}`;
    case 'encounter':
      return state.wild
        ? `遭遇 · ${displayName(state.wild)} Lv${state.wild.level} · ${speciesOf(state.wild.speciesId).type}`
        : '遭遇';
    case 'catch':
      return state.wild
        ? `捕捉 · ${displayName(state.wild)} · HP ${percent(hpRatio(state.wild))}`
        : '捕捉';
    case 'battle': {
      const active = activeCreatureOf(state);
      const battle = state.battle;
      const where = battle?.mode === 'abyss' ? `深渊第 ${state.abyssFloor} 层` : `${zone}/${sub}`;
      return `战斗 · ${where} · ${active ? displayName(active) : '?'} vs ${
        battle ? displayName(battle.enemy) : '?'
      }`;
    }
    case 'skill':
      return `升级 · ${state.pendingSkills[0]?.creatureName ?? '虾米'} 选择技能`;
    case 'party':
      return `队伍与仓库 · 队伍 ${state.party.filter(Boolean).length}/6 · 仓库 ${state.box.length}`;
    case 'items':
      return '道具 · 治疗与净化';
    case 'items-cure':
      return '净化 · 选择目标';
    case 'workshop':
      return '词条工坊 · 选择虾米';
    case 'workshop-slot': {
      const creature = state.selectedCreature !== null ? state.party[state.selectedCreature] : null;
      return `词条工坊 · ${creature ? displayName(creature) : '?'} · ${creature?.affixSlots.length ?? 0} 槽`;
    }
    case 'abyss-gate':
      return `深渊入口 · 最深 ${state.deepestFloor} 层 · 通关目标 ${WIN_FLOOR} 层`;
    case 'abyss':
      return `深渊第 ${state.abyssFloor + 1} 层待命 · 已通过 ${state.abyssFloor} 层 · 最深 ${state.deepestFloor}`;
    case 'ended':
      return `本局结束 · ${state.outcome}`;
    default:
      return '横着抓';
  }
}

function partyLines(state: TamerState): string[] {
  const lines: string[] = [];
  state.party.forEach((creature, index) => {
    if (!creature) return;
    const species = speciesOf(creature.speciesId);
    const moves = creature.moves.slice(0, 2).join('/');
    const extra = creature.moves.length > 2 ? '…' : '';
    lines.push(
      `${index} ${displayName(creature)} Lv${creature.level} ${species.type} HP${Math.ceil(creature.hp)}/${Math.ceil(maxHp(creature))} 词条${affixShortSymbols(creature)} 技能${moves}${extra}`,
    );
  });
  if (lines.length === 0) lines.push('队伍为空');
  if (state.box.length > 0) {
    const names = state.box
      .slice(0, 5)
      .map((creature) => `${displayName(creature)}Lv${creature.level}`)
      .join('、');
    lines.push(`仓库 ${state.box.length} 只：${names}${state.box.length > 5 ? '…' : ''}`);
  }
  return lines;
}

function zoneLines(state: TamerState): string[] {
  return unlockedZoneList(state).map((zone) => {
    const ranges = zone.sub_areas
      .map((sub) => `${sub.name} Lv${sub.level_range[0]}-${sub.level_range[1]}`)
      .join(' / ');
    return `${zone.name}：${ranges}`;
  });
}

function subAreaLines(state: TamerState): string[] {
  const zone = zoneById(state.currentZone);
  if (!zone) return [];
  return zone.sub_areas.map((sub) => {
    const species = sub.encounter_table
      .slice(0, 4)
      .map((entry) => speciesOf(entry.species_id).name)
      .join('、');
    return `${sub.name} Lv${sub.level_range[0]}-${sub.level_range[1]} · ${species}`;
  });
}

function encounterLines(state: TamerState): string[] {
  const wild = state.wild;
  if (!wild) return ['没有野生虾米。'];
  const species = speciesOf(wild.speciesId);
  const lines = [
    `${species.name} Lv${wild.level} · ${species.type} · ${species.rarity}${wild.shiny ? ' · ✦灵光' : ''} · HP ${Math.ceil(wild.hp)}/${Math.ceil(maxHp(wild))}`,
  ];
  const preview = capturePreview(state, wild);
  if (preview.length > 0) {
    lines.push(
      `捕捉率：${preview.map((entry) => `${entry.name} ${percent(entry.rate, 1)}`).join(' / ')}`,
    );
  } else {
    lines.push('没有捕捉工具，只能战斗或逃跑。');
  }
  return lines;
}

function battleLines(state: TamerState): string[] {
  const battle = state.battle;
  if (!battle) return ['没有战斗。'];
  const lines = battleSideSummary(state, battle);
  const moves = availableMoves(state).join(' / ');
  lines.push(`可用技能：${moves || '无'}`);
  lines.push(
    `回合 ${battle.round} · ${battle.mode === 'abyss' ? '深渊（HP归零=永久死亡）' : '野外（战败后队伍苏醒）'}`,
  );
  const tail = battle.log.slice(-4);
  lines.push(...tail);
  return lines;
}

function skillLines(state: TamerState): string[] {
  const pending = state.pendingSkills[0];
  if (!pending) return ['没有待选技能。'];
  const creature = state.party[pending.partyIndex];
  const lines = [
    `${pending.creatureName} 当前技能：${creature?.moves.join(' / ') ?? '无'}（${creature?.moves.length ?? 0}/4）`,
  ];
  pending.offers.forEach((name, index) => {
    const skill = skillOf(name);
    lines.push(
      `[${index}] ${skill?.name ?? name} · ${skill?.type ?? '?'} · 威力${skill?.power ?? 0} · ${skill?.description ?? ''}`,
    );
  });
  return lines;
}

function partyDetailLines(state: TamerState): string[] {
  const lines: string[] = [];
  state.party.forEach((creature, index) => {
    if (!creature) return;
    lines.push(
      `${index} ${displayName(creature)} Lv${creature.level} EXP ${creature.exp}/${expToNext(creature.level)} 技能 ${creature.moves.join('/')}`,
    );
    lines.push(
      `  词条：${creature.affixSlots.map((slot, slotIndex) => `${slotIndex}:${affixSlotLabel(slot)}`).join(' ')}`,
    );
  });
  if (state.box.length > 0) {
    lines.push('仓库：');
    state.box.forEach((creature, index) => {
      lines.push(
        `${index} ${displayName(creature)} Lv${creature.level} HP${Math.ceil(creature.hp)}/${Math.ceil(maxHp(creature))} 词条${affixShortSymbols(creature)}`,
      );
    });
  }
  return lines;
}

function itemLines(state: TamerState): string[] {
  const ids = [
    ...new Set([...materialRows(state).map((row) => row.id), ...Object.keys(state.items)]),
  ];
  return ids
    .filter((id) => itemCount(state, id) > 0)
    .map((id) => `${itemName(id)}×${itemCount(state, id)}`);
}

function workshopSlotLines(state: TamerState): string[] {
  const creature = state.selectedCreature !== null ? state.party[state.selectedCreature] : null;
  if (!creature) return ['未选择虾米。'];
  const lines = creature.affixSlots.map((slot, index) => {
    const affix = slot.affixId ? AFFIX_BY_ID.get(slot.affixId) : undefined;
    return `槽${index} ${affixSlotLabel(slot)}${affix ? ` · ${affix.description}` : ''}`;
  });
  lines.push(
    `费用：重投 ${costLabel(rerollCost())} / 升阶 ${costLabel(upgradeCost('common'))} 起 / 封印 ${costLabel(sealCost())} / 解封 ${costLabel(unsealCost())}`,
  );
  return lines;
}

function abyssLines(state: TamerState): string[] {
  const next = state.abyssFloor + 1;
  const kind = floorKind(next);
  const lines = [
    `下一层：第 ${next} 层 [${floorKindLabel(kind)}] · 敌人等级约 Lv${Math.max(1, Math.round(5 + next * 0.4))}`,
    '污染满 5 转化为疫病；撤退时每层疫病 3% 死亡率（上限 25%）。',
  ];
  for (const creature of state.party) {
    if (!creature) continue;
    const flags: string[] = [];
    if (creature.hasPlague) {
      flags.push(
        `疫病${creature.plagueFloors}层 死亡率${Math.round(plagueDeathChance(creature) * 100)}%`,
      );
    }
    if (creature.taint > 0) flags.push(`污染${creature.taint}`);
    if (flags.length > 0) lines.push(`${displayName(creature)}：${flags.join(' · ')}`);
  }
  const heals = potionInventory(state);
  if (heals.length > 0) {
    lines.push(
      `可用药：${heals.map((item) => `${item.name}×${state.items[item.id] ?? 0}`).join(' / ')}`,
    );
  }
  return lines;
}

function sectionsOf(state: TamerState): StatusSection[] {
  const sections: StatusSection[] = [{ title: '队伍', lines: partyLines(state) }];
  switch (state.phase) {
    case 'menu':
      sections.push({
        title: '档案',
        lines: [
          `图鉴 ${state.dexCaught.length}/111 已捕 · ${state.dexSeen.length}/111 已见 · 灵光 ${state.shinyCaught.length}`,
          `捕获 ${state.totalCaptures} · 战斗 ${state.totalBattles} · 深渊 ${state.totalRuns} 次 · 永久死亡 ${state.totalDeaths}`,
        ],
      });
      break;
    case 'zone':
      sections.push({ title: '可选区域', lines: zoneLines(state) });
      break;
    case 'subarea':
      sections.push({ title: '子区域', lines: subAreaLines(state) });
      break;
    case 'explore':
      sections.push({
        title: '探索',
        lines: [
          state.explore
            ? `再走 ${Math.max(0, state.explore.target - state.explore.steps)} 步可能遭遇野生虾米。`
            : '探索状态异常。',
        ],
      });
      break;
    case 'encounter':
      sections.push({ title: '遭遇', lines: encounterLines(state) });
      break;
    case 'catch':
      sections.push({ title: '捕捉', lines: encounterLines(state) });
      break;
    case 'battle':
      sections.push({ title: '战斗', lines: battleLines(state) });
      break;
    case 'skill':
      sections.push({ title: '技能候选', lines: skillLines(state) });
      break;
    case 'party':
      sections.push({ title: '队伍详情', lines: partyDetailLines(state) });
      break;
    case 'items':
      sections.push({ title: '持有道具', lines: itemLines(state) });
      break;
    case 'items-cure':
      sections.push({
        title: '净化目标',
        lines: plagueCandidates(state).map(
          ({ creature, index }) =>
            `${index} ${displayName(creature)} · 疫病${creature.hasPlague ? ` ${creature.plagueFloors}层` : '无'} · 污染${creature.taint}`,
        ),
      });
      break;
    case 'workshop':
      sections.push({
        title: '材料',
        lines: materialRows(state).map((row) => `${row.name}×${row.count}`),
      });
      break;
    case 'workshop-slot':
      sections.push({ title: '词条槽', lines: workshopSlotLines(state) });
      break;
    case 'abyss-gate':
      sections.push({
        title: '深渊规则',
        lines: [
          `每 10 层 BOSS，每 5 层精英；战斗内 HP 归零永久死亡。通关目标：第 ${WIN_FLOOR} 层。`,
          `当前最深 ${state.deepestFloor} 层；撤退会按疫病层数掷死亡骰。`,
        ],
      });
      break;
    case 'abyss':
      sections.push({ title: '深渊', lines: abyssLines(state) });
      break;
    case 'ended':
      sections.push({ title: '结算', lines: [state.cause || '本局结束。'] });
      break;
    default:
      break;
  }
  if (state.log.length > 0) {
    sections.push({ title: '最近', lines: state.log.slice(-3) });
  }
  return sections;
}

function statusOf(state: TamerState): StatusView {
  return {
    headline: headlineOf(state),
    metrics: metricsOf(state),
    sections: sectionsOf(state),
    outcome: state.outcome,
    turn: state.turn,
    phase: state.phase,
  };
}

function moveRisk(state: TamerState, power: number): ActionView['risk'] {
  const enemy = state.battle?.enemy;
  if (!enemy || power <= 0) return 'low';
  return power >= 80 ? 'medium' : 'low';
}

function actionsOf(state: TamerState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const actions: ActionView[] = [];
  const push = (action: ActionView): void => {
    actions.push(action);
  };
  const zone = zoneDisplayName(state.currentZone);
  const sub = subAreaDisplayName(state.currentZone, state.currentSubArea);

  switch (state.phase) {
    case 'menu':
      push({
        id: 'menu:explore',
        label: '探索野外',
        detail: `从 ${zone}/${sub} 开始按步数推进，遇野生虾米后进入遭遇。`,
        risk: 'low',
      });
      push({
        id: 'menu:battle',
        label: '直接寻找野生遭遇',
        detail: `跳过步数，在当前区域 ${zone}/${sub} 直接抽一次遭遇（可能落空）。`,
        risk: 'low',
      });
      push({
        id: 'menu:abyss',
        label: `进入深渊（最深 ${state.deepestFloor} 层）`,
        detail: '战斗内 HP 归零 = 永久死亡；污染会转疫病，撤退按疫病层数掷死亡骰。',
        risk: 'high',
      });
      push({
        id: 'menu:workshop',
        label: '词条工坊',
        detail: `重投 ${costLabel(rerollCost())}；升阶 ${costLabel(upgradeCost('common'))} 起；封印 ${costLabel(sealCost())}。`,
        risk: 'low',
      });
      push({
        id: 'menu:party',
        label: '队伍 / 仓库',
        detail: `队伍 ${state.party.filter(Boolean).length}/6，仓库 ${state.box.length} 只；可换位、治疗、退回仓库。`,
        risk: 'low',
      });
      push({
        id: 'menu:items',
        label: '使用道具',
        detail: itemLines(state).join(' / ') || '没有可用道具。',
        risk: 'low',
      });
      push({
        id: 'menu:save',
        label: '保存 / 整理',
        detail: '每回合已经自动写盘；这里做一次明确的保存动作。',
        risk: 'low',
      });
      break;

    case 'zone':
      for (const entry of unlockedZoneList(state)) {
        push({
          id: `zone:${entry.id}`,
          label: entry.name,
          detail: entry.sub_areas
            .map((area) => `${area.name} Lv${area.level_range[0]}-${area.level_range[1]}`)
            .join(' / '),
          risk: 'low',
        });
      }
      push({ id: 'choice:back', label: '返回主菜单', risk: 'low' });
      break;

    case 'subarea': {
      const current = zoneById(state.currentZone);
      if (current) {
        for (const area of current.sub_areas) {
          push({
            id: `choice:sub:${area.id}`,
            label: area.name,
            detail: `Lv${area.level_range[0]}-${area.level_range[1]} · ${area.encounter_table
              .slice(0, 3)
              .map((entry) => speciesOf(entry.species_id).name)
              .join('、')}`,
            risk: 'low',
          });
        }
      }
      push({ id: 'choice:back', label: '返回区域选择', risk: 'low' });
      break;
    }

    case 'explore': {
      const explore = state.explore;
      const remain = explore ? Math.max(0, explore.target - explore.steps) : 0;
      push({
        id: 'choice:step',
        label: '前进一步',
        detail: `当前 ${explore?.steps ?? 0}/${explore?.target ?? 0}，再走 ${remain} 步可能遭遇。`,
        risk: 'low',
      });
      push({ id: 'choice:leave', label: '离开探索', risk: 'low' });
      break;
    }

    case 'encounter': {
      const wild = state.wild;
      if (wild) {
        const preview = capturePreview(state, wild);
        const best = preview[0];
        push({
          id: 'encounter:fight',
          label: '进入战斗',
          detail: `对手 ${displayName(wild)} Lv${wild.level} HP${Math.ceil(wild.hp)}/${Math.ceil(maxHp(wild))}。战斗胜利给 EXP 与掉落。`,
          risk: 'medium',
        });
        push({
          id: 'encounter:catch',
          label: '尝试捕捉',
          detail: best
            ? `预计 ${best.name} ${percent(best.rate, 1)}；失败会进入战斗。`
            : '没有捕捉工具。',
          risk: 'medium',
          ...(best ? { cost: `${best.name}×1` } : {}),
        });
        push({
          id: 'encounter:flee',
          label: '溜走',
          detail: '按速度判定；失败会被迫进入战斗且敌方先手。',
          risk: 'low',
        });
      }
      break;
    }

    case 'catch': {
      const wild = state.wild;
      if (!wild) break;
      const best = bestCaptureItem(state);
      if (best) {
        const rate =
          capturePreview(state, wild).find((entry) => entry.itemId === best.id)?.rate ?? 0;
        push({
          id: 'catch:ball',
          label: `投出 ${best.name}`,
          detail: `捕捉率 ${percent(rate, 1)}；消耗 ${best.name}×1，失败后进入战斗。`,
          risk: 'medium',
          cost: `${best.name}×1`,
        });
      }
      if (!state.catchBait) {
        push({
          id: 'catch:bait',
          label: '撒诱饵',
          detail: '捕捉率 +20%；若这一球失败，野生虾米先手。',
          risk: 'medium',
        });
      }
      push({ id: 'choice:back', label: '返回遭遇选择', risk: 'low' });
      break;
    }

    case 'battle': {
      const battle = state.battle;
      if (!battle) break;
      const moves = availableMoves(state);
      moves.forEach((name, index) => {
        const skill = skillOf(name);
        push({
          id: `move:${index}`,
          label: skill?.name ?? name,
          detail: `${skill?.type ?? '?'} · 威力${skill?.power ?? 0} · 命中${Math.round((skill?.accuracy ?? 1) * 100)}% · ${skill?.description ?? ''}`,
          risk: moveRisk(state, skill?.power ?? 0),
        });
      });
      state.party.forEach((creature, index) => {
        if (!creature || index === battle.playerIndex || creature.dead || creature.hp <= 0) return;
        push({
          id: `swap:${index}`,
          label: `换上 ${displayName(creature)}`,
          detail: `Lv${creature.level} HP${Math.ceil(creature.hp)}/${Math.ceil(maxHp(creature))}；换手后敌方自由攻击。`,
          risk: 'medium',
        });
      });
      for (const item of potionInventory(state)) {
        push({
          id: `item:${item.id}`,
          label: `使用 ${item.name}`,
          detail: `为当前出战虾米回复 ${Math.round((item.heal_ratio ?? 0.25) * 100)}% 最大 HP；敌方随后攻击。`,
          risk: 'low',
          cost: `${item.name}×1`,
        });
      }
      if (battle.mode === 'wild') {
        const ball = bestCaptureItem(state);
        if (ball && state.wild) {
          const rate =
            capturePreview(state, state.wild).find((entry) => entry.itemId === ball.id)?.rate ?? 0;
          push({
            id: `item:${ball.id}`,
            label: `投 ${ball.name}`,
            detail: `捕捉率 ${percent(rate, 1)}；失败会被敌方反击。`,
            risk: 'medium',
            cost: `${ball.name}×1`,
          });
        }
      }
      push({
        id: 'run',
        label: battle.mode === 'abyss' ? '放弃本局深渊（结算疫病）' : '逃跑',
        detail:
          battle.mode === 'abyss'
            ? '立即离开深渊，按当前疫病层数结算死亡骰。'
            : '按速度判定逃跑；失败会被敌方攻击。',
        risk: battle.mode === 'abyss' ? 'high' : 'medium',
      });
      break;
    }

    case 'skill': {
      const pending = state.pendingSkills[0];
      if (!pending) break;
      pending.offers.forEach((name, index) => {
        const skill = skillOf(name);
        push({
          id: `choice:skill:${index}`,
          label: skill?.name ?? name,
          detail: `${skill?.type ?? '?'} · 威力${skill?.power ?? 0} · ${skill?.description ?? ''}`,
          risk: 'low',
        });
      });
      push({ id: 'choice:skill:skip', label: '跳过学习', risk: 'low' });
      break;
    }

    case 'party': {
      const healItem = potionInventory(state)[0];
      state.party.forEach((creature, index) => {
        if (!creature) return;
        if (healItem && creature.hp < maxHp(creature) && !creature.dead) {
          push({
            id: `party:heal:${index}`,
            label: `治疗 ${displayName(creature)}`,
            detail: `回复 25% 最大 HP（小潮药）；当前 ${Math.ceil(creature.hp)}/${Math.ceil(maxHp(creature))}。`,
            risk: 'low',
            cost: '小潮药×1',
          });
        }
      });
      const targetSlot =
        state.party.indexOf(null) >= 0 ? state.party.indexOf(null) : weakestPartySlot(state);
      state.box.slice(0, 12).forEach((creature, index) => {
        if (targetSlot < 0) return;
        const current = state.party[targetSlot];
        push({
          id: `party:swap:${targetSlot}:${index}`,
          label: `换入 ${displayName(creature)} Lv${creature.level}`,
          detail: current
            ? `替换 ${displayName(current)} Lv${current.level}（队伍槽 ${targetSlot}）。`
            : `填入空槽 ${targetSlot}。`,
          risk: 'low',
        });
      });
      state.party.forEach((creature, index) => {
        if (!creature) return;
        push({
          id: `party:release:${index}`,
          label: `退回仓库 ${displayName(creature)}`,
          detail: `把队伍槽 ${index} 的虾米放回仓库。`,
          risk: 'low',
        });
      });
      push({ id: 'choice:menu', label: '返回主菜单', risk: 'low' });
      break;
    }

    case 'items': {
      for (const item of potionInventory(state)) {
        if (itemCount(state, item.id) <= 0) continue;
        push({
          id: `item:${item.id}`,
          label: `使用 ${item.name}`,
          detail: `全队回复 ${Math.round((item.heal_ratio ?? 0.25) * 100)}% 最大 HP。`,
          risk: 'low',
          cost: `${item.name}×${itemCount(state, item.id)}`,
        });
      }
      if (plagueCandidates(state).length > 0 && itemCount(state, 'cure_plague') > 0) {
        push({
          id: 'item:cure_plague',
          label: '使用净疫盐',
          detail: `净化一只虾米的疫病与深渊污染；持有 ${itemCount(state, 'cure_plague')}。`,
          risk: 'low',
          cost: `净疫盐×${itemCount(state, 'cure_plague')}`,
        });
      }
      push({ id: 'choice:menu', label: '返回主菜单', risk: 'low' });
      break;
    }

    case 'items-cure': {
      for (const { creature, index } of plagueCandidates(state)) {
        push({
          id: `choice:cure:${index}`,
          label: `净化 ${displayName(creature)}`,
          detail: `疫病${creature.hasPlague ? ` ${creature.plagueFloors}层` : '无'} · 污染${creature.taint}`,
          risk: 'low',
          cost: '净疫盐×1',
        });
      }
      push({ id: 'choice:back', label: '返回道具菜单', risk: 'low' });
      break;
    }

    case 'workshop': {
      state.party.forEach((creature, index) => {
        if (!creature) return;
        push({
          id: `choice:target:${index}`,
          label: `${displayName(creature)} Lv${creature.level}`,
          detail: `词条 ${creature.affixSlots.map((slot) => affixSlotLabel(slot)).join(' / ')}；材料 甲核${itemCount(state, 'jihe_core')} 灵晶${itemCount(state, 'spirit_crystal')} 潮石${itemCount(state, 'tide_stone')}`,
          risk: 'low',
        });
      });
      push({ id: 'workshop:back', label: '返回主菜单', risk: 'low' });
      break;
    }

    case 'workshop-slot': {
      const creature = state.selectedCreature !== null ? state.party[state.selectedCreature] : null;
      if (!creature) break;
      creature.affixSlots.forEach((slot, index) => {
        const affix = slot.affixId ? AFFIX_BY_ID.get(slot.affixId) : undefined;
        if (!slot.affixId) return;
        if (!slot.locked) {
          push({
            id: `workshop:reroll:${index}`,
            label: `重投槽${index}`,
            detail: `保持 ${affix?.tier ?? '?'} 品阶随机换词条；当前 ${affix?.name ?? '?'}。`,
            risk: 'medium',
            cost: costLabel(rerollCost()),
          });
        }
        const canUpgrade = affix ? tierIndex(affix.tier) < TIER_ORDER.length - 1 : false;
        if (canUpgrade) {
          push({
            id: `workshop:upgrade:${index}`,
            label: `升阶槽${index}`,
            detail: `把 ${affix?.name ?? '?'}（${affix?.tier ?? '?'}）升到下一品阶。`,
            risk: 'low',
            cost: costLabel(upgradeCost(affix?.tier ?? 'common')),
          });
        }
        if (!slot.locked) {
          push({
            id: `workshop:seal:${index}`,
            label: `封印槽${index}`,
            detail: '锁定词条，防止重投覆盖。',
            risk: 'low',
            cost: costLabel(sealCost()),
          });
        } else {
          push({
            id: `workshop:unseal:${index}`,
            label: `解封槽${index}`,
            detail: '解除封印后可以重投或升阶。',
            risk: 'low',
            cost: costLabel(unsealCost()),
          });
        }
      });
      push({ id: 'workshop:back', label: '返回选择虾米', risk: 'low' });
      break;
    }

    case 'abyss-gate':
      push({
        id: 'abyss:enter',
        label: '进入深渊',
        detail: `从第 1 层开始，目标第 ${WIN_FLOOR} 层；战斗内 HP 归零永久死亡。`,
        risk: 'high',
      });
      push({ id: 'choice:menu', label: '返回主菜单', risk: 'low' });
      break;

    case 'abyss': {
      const next = state.abyssFloor + 1;
      const kind = floorKind(next);
      push({
        id: 'abyss:next',
        label: `前往第 ${next} 层 [${floorKindLabel(kind)}]`,
        detail: `敌人等级约 Lv${Math.max(1, Math.round(5 + next * 0.4))}；HP 归零=永久死亡。`,
        risk: kind === 'boss' ? 'high' : kind === 'elite' ? 'medium' : 'low',
      });
      for (const item of potionInventory(state)) {
        push({
          id: `item:${item.id}`,
          label: `使用 ${item.name}`,
          detail: `全队回复 ${Math.round((item.heal_ratio ?? 0.25) * 100)}% 最大 HP；深渊内不回血，只能靠药。`,
          risk: 'low',
          cost: `${item.name}×${itemCount(state, item.id)}`,
        });
      }
      push({
        id: 'abyss:retreat',
        label: '撤退',
        detail: '按每只虾米的疫病层数掷死亡骰；污染未满 5 会保留。',
        risk: 'high',
      });
      break;
    }
    default:
      break;
  }
  return actions;
}

function weakestPartySlot(state: TamerState): number {
  let weakest = -1;
  let level = Number.POSITIVE_INFINITY;
  state.party.forEach((creature, index) => {
    if (!creature) return;
    if (creature.level < level) {
      level = creature.level;
      weakest = index;
    }
  });
  return weakest;
}

function recapOf(state: TamerState): RecapView {
  const outcome = state.outcome;
  const memoryPrompt =
    outcome === 'won'
      ? '这轮不是运气：把 1-3 条“什么配置/路线真的撑住了深层深渊”写进 memory，并标明下次继续验证。'
      : outcome === 'lost'
        ? '这轮不是白输：把 1-3 条“队伍哪里被深渊打穿”的教训写进 memory，并标明下局继续验证。'
        : outcome === 'aborted'
          ? '这轮先收手：把已经冒头的 1-3 条观察写进 memory，并注明这是中止结算。'
          : '这一局还在进行中；以下只是当前局面，不是最终结论。';

  const lessons = state.notes.slice(-5);
  if (lessons.length === 0) {
    lessons.push('首次记录：优先把队伍练到与深渊层数接近，再考虑深入。');
  }

  return {
    title: `最深 ${state.deepestFloor} 层 · 图鉴 ${state.dexCaught.length}/111`,
    outcome,
    cause:
      state.cause ||
      `本局尚未结束：当前最深 ${state.deepestFloor} 层，队伍 ${state.party.filter(Boolean).length}/6，仓库 ${state.box.length} 只。`,
    metrics: [
      { label: '最深', value: state.deepestFloor },
      { label: '捕获', value: state.totalCaptures },
      { label: '战斗', value: state.totalBattles },
      { label: '永久死亡', value: state.totalDeaths },
      { label: '图鉴', value: `${state.dexCaught.length}/111` },
      { label: '通关目标', value: `第 ${WIN_FLOOR} 层` },
    ],
    timeline: state.timeline.slice(-10),
    lessons,
    memoryPrompt,
  };
}

export const definition: GameDefinition<TamerState> = {
  meta: {
    id: 'lobster-cli-tamer',
    name: '横着抓',
    englishName: 'Lobster Sideways Catch',
    tagline: '只给龙虾玩的 CLI 捕兽养成',
    description:
      '你是一名甲录师，在潮礁海域捕捉、培养与编队虾米：野外抓宠、词条工坊洗词条、无尽深渊刷材料。深渊里 HP 归零就是永久死亡，撤退时疫病还要掷死亡骰。',
    version: '2.0.0',
    repo: REPO,
    license: 'MIT',
    guide: [
      'new 之后处于 menu；act menu:explore 选区域，act zone:<id> 进入。',
      '野外遭遇用 encounter:fight / encounter:catch / encounter:flee；捕捉可先 catch:bait 再 catch:ball。',
      '战斗用 move:<0-3> / swap:<队伍槽> / item:<道具id> / run；野外战败不会永久死亡。',
      '深渊用 menu:abyss → abyss:enter → abyss:next / abyss:retreat；战斗内 HP 归零 = 永久死亡。',
      '工坊用 menu:workshop → choice:target:<槽> → workshop:reroll|upgrade|seal|unseal:<词条槽>。',
      '--difficulty easy 会降低敌方伤害并压低敌人等级。',
    ],
  },
  create: ({ seed, content, difficulty, now }) => createState({ seed, content, difficulty, now }),
  status: statusOf,
  actions: actionsOf,
  act,
  abort,
  recap: recapOf,
};
