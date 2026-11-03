/**
 * The single action dispatcher: one call mutates one serialisable state step.
 *
 * Action ids are stable and prefix-friendly. The runtime resolves prefixes
 * before calling this function, so `act` only ever sees a legal listed id.
 */
import type { ActionResult, GameEvent } from '@gameclaw/gamekit';
import { Rng } from '@gameclaw/gamekit';

import {
  enterAbyss,
  resolveAbyssBattleEnd,
  retreatAbyss,
  startAbyssFloor,
  WIN_FLOOR,
} from './abyss';
import { attemptCapture, capturePreview } from './capture';
import {
  activeCreatureOf,
  availableMoves,
  type BattleAction,
  battleTurn,
  enemyFreeAttack,
} from './combat';
import { bestCaptureItem, itemCount, itemName, itemOf, potionInventory } from './items';
import {
  curePlague,
  healParty,
  learnSkill,
  plagueCandidates,
  releaseToBox,
  swapWithBox,
} from './party';
import { displayName, speciesOf } from './species';
import type { Creature, Phase, TamerState } from './state';
import {
  firstAliveIndex,
  hasAliveParty,
  nextUid,
  note,
  pushLog,
  returnPhase,
  timeline,
} from './state';
import { costLabel, type WorkshopOp, workshopAction } from './workshop';
import {
  beginExplore,
  checkUnlocks,
  exploreStep,
  findWildEncounter,
  fleeWildEncounter,
  resolveWildBattleEnd,
  startWildBattle,
  subAreaById,
  unlockedZoneList,
  zoneById,
  zoneDisplayName,
} from './world';

function illegal(state: TamerState, actionId: string): never {
  throw new Error(`Illegal action "${actionId}" in phase ${state.phase}`);
}

function numberTail(actionId: string, prefix: string): number {
  const raw = actionId.slice(prefix.length);
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 0) throw new Error(`Bad numeric action: ${actionId}`);
  return value;
}

function mapBattleResult(result: string): 'win' | 'lose' | 'retreat' {
  if (result === 'win') return 'win';
  if (result === 'retreat') return 'retreat';
  return 'lose';
}

function resolveBattleEnd(state: TamerState, rng: Rng, result: string): string[] {
  if (state.battle?.mode === 'abyss') {
    return resolveAbyssBattleEnd(state, rng, mapBattleResult(result));
  }
  return resolveWildBattleEnd(
    state,
    rng,
    result === 'caught' ? 'caught' : result === 'win' ? 'win' : result === 'fled' ? 'fled' : 'lose',
  );
}

function battleActionIn(actionId: string): BattleAction | null {
  if (actionId.startsWith('move:')) {
    return { kind: 'move', index: numberTail(actionId, 'move:') };
  }
  if (actionId.startsWith('swap:')) {
    return { kind: 'swap', index: numberTail(actionId, 'swap:') };
  }
  if (actionId.startsWith('item:')) {
    const itemId = actionId.slice('item:'.length);
    const item = itemOf(itemId);
    if (item?.type === 'heal') return { kind: 'potion', itemId };
    return null;
  }
  if (actionId === 'run') return { kind: 'run' };
  return null;
}

function handleBattle(state: TamerState, rng: Rng, actionId: string): string[] {
  const battle = state.battle;
  if (!battle) throw new Error('No active battle');

  if (actionId.startsWith('item:')) {
    const itemId = actionId.slice('item:'.length);
    const item = itemOf(itemId);
    if (item?.type === 'capture') {
      if (battle.mode === 'abyss') {
        return ['深渊生物无法捕捉，只能用技能或撤退。'];
      }
      if (!state.wild) return ['没有可捕捉的野生虾米。'];
      if (itemCount(state, itemId) <= 0) return [`没有 ${itemName(itemId)} 了。`];
      const attempt = attemptCapture(state, rng, itemId);
      const lines = [`投出 ${item.name}！捕捉率 ${(attempt.rate * 100).toFixed(1)}%`];
      if (attempt.success) {
        battle.result = 'caught';
        lines.push(`捕捉成功！${state.wild ? displayName(state.wild) : '野生虾米'} 加入了队伍。`);
        lines.push(...resolveBattleEnd(state, rng, 'caught'));
        return lines;
      }
      lines.push('捕捉失败！虾米挣脱了。');
      const free = enemyFreeAttack(state, rng);
      lines.push(...free.log);
      if (free.ended) lines.push(...resolveBattleEnd(state, rng, battle.result));
      return lines;
    }
  }

  const action = battleActionIn(actionId);
  if (!action) throw illegal(state, actionId);
  if (action.kind === 'move') {
    const moves = availableMoves(state);
    if (action.index >= moves.length) {
      return [`无效的技能序号：${action.index}（可用 ${moves.length} 个）`];
    }
  }
  if (action.kind === 'swap') {
    const target = state.party[action.index];
    if (!target) return [`队伍槽 ${action.index} 是空的。`];
  }

  const turn = battleTurn(state, rng, action);
  const lines = [...turn.log];
  if (turn.ended) {
    lines.push(...resolveBattleEnd(state, rng, battle.result));
  }
  return lines;
}

function handleMenu(state: TamerState, rng: Rng, actionId: string): string[] {
  if (actionId === 'menu:explore') {
    state.phase = 'zone';
    return ['选择探索区域。'];
  }
  if (actionId === 'menu:battle') {
    if (!hasAliveParty(state)) return ['队伍里没有能战斗的虾米。'];
    return findWildEncounter(state, rng);
  }
  if (actionId === 'menu:abyss') {
    if (!hasAliveParty(state)) return ['队伍里没有能战斗的虾米。'];
    state.phase = 'abyss-gate';
    return [`深渊入口：最深 ${state.deepestFloor} 层。战斗内 HP 归零 = 永久死亡。`];
  }
  if (actionId === 'menu:workshop') {
    if (state.party.every((creature) => creature === null))
      return ['队伍为空，工坊没有可强化的虾米。'];
    state.phase = 'workshop';
    state.selectedCreature = null;
    return ['词条工坊：选择要处理的虾米。'];
  }
  if (actionId === 'menu:party') {
    state.phase = 'party';
    return ['队伍与仓库：可调换、治疗或把成员退回仓库。'];
  }
  if (actionId === 'menu:items') {
    state.phase = 'items';
    return ['道具：治疗药与净疫盐。'];
  }
  if (actionId === 'menu:save') {
    return ['进度已在每回合自动写入存档；此动作只做一次明确的记录。'];
  }
  return illegal(state, actionId);
}

function handleZone(state: TamerState, rng: Rng, actionId: string): string[] {
  if (actionId === 'choice:back') {
    state.phase = 'menu';
    return ['回到主菜单。'];
  }
  if (!actionId.startsWith('zone:')) return illegal(state, actionId);
  const zoneId = actionId.slice('zone:'.length);
  const zone = zoneById(zoneId);
  if (!zone) return [`未知区域：${zoneId}`];
  if (!state.unlockedZones.includes(zoneId)) return [`区域 ${zone.name} 尚未解锁。`];
  state.currentZone = zoneId;
  if (zone.sub_areas.length <= 1) {
    const sub = zone.sub_areas[0];
    if (!sub) return ['该区域没有子区域。'];
    return beginExplore(state, rng, zoneId, sub.id);
  }
  state.currentSubArea = zone.sub_areas[0]?.id ?? '';
  state.phase = 'subarea';
  return zone.sub_areas.map(
    (sub) => `${sub.name}（Lv${sub.level_range[0]}-${sub.level_range[1]}）`,
  );
}

function handleSubArea(state: TamerState, rng: Rng, actionId: string): string[] {
  if (actionId === 'choice:back' || actionId === 'choice:zone') {
    state.phase = 'zone';
    return ['重新选择区域。'];
  }
  if (!actionId.startsWith('choice:sub:')) return illegal(state, actionId);
  const subId = actionId.slice('choice:sub:'.length);
  const zone = zoneById(state.currentZone);
  if (!zone || !subAreaById(zone, subId)) return [`未知子区域：${subId}`];
  return beginExplore(state, rng, zone.id, subId);
}

function handleExplore(state: TamerState, rng: Rng, actionId: string): string[] {
  if (actionId === 'choice:leave') {
    state.explore = null;
    state.phase = 'menu';
    return ['离开野外，回到主菜单。'];
  }
  if (actionId !== 'choice:step') return illegal(state, actionId);
  return exploreStep(state, rng);
}

function handleEncounter(state: TamerState, rng: Rng, actionId: string): string[] {
  if (!state.wild) return ['遭遇已经结束。'];
  if (actionId === 'encounter:fight') {
    return startWildBattle(state, false);
  }
  if (actionId === 'encounter:catch') {
    const ball = bestCaptureItem(state);
    if (!ball) return ['没有捕捉工具了，只能战斗或逃跑。'];
    state.phase = 'catch';
    return [`准备投出 ${ball.name}。可选择甲网或诱饵。`];
  }
  if (actionId === 'encounter:flee') {
    const escaped = fleeWildEncounter(state, rng);
    if (escaped) {
      state.wild = null;
      state.phase = 'explore';
      return ['你悄悄退开，野生虾米没有追上来。'];
    }
    const lines = ['逃跑失败，它挡住了退路！'];
    lines.push(...startWildBattle(state, true));
    return lines;
  }
  return illegal(state, actionId);
}

function handleCatch(state: TamerState, rng: Rng, actionId: string): string[] {
  if (!state.wild) return ['遭遇已经结束。'];
  if (actionId === 'choice:back') {
    state.phase = 'encounter';
    return ['回到遭遇选择。'];
  }
  if (actionId === 'catch:bait') {
    if (state.catchBait) return ['这一场遭遇已经用过诱饵了。'];
    state.catchBait = true;
    return ['你撒下诱饵：本次捕捉率 +20%。但如果这一球失败，敌方会先手。'];
  }
  if (actionId !== 'catch:ball') return illegal(state, actionId);
  const ball = bestCaptureItem(state);
  if (!ball) return ['没有捕捉工具了。'];
  const attempt = attemptCapture(state, rng, ball.id);
  const wildName = displayName(state.wild);
  const lines = [`你投出 ${ball.name}：捕捉率 ${(attempt.rate * 100).toFixed(1)}%`];
  if (attempt.success) {
    state.wild = null;
    state.catchBait = false;
    state.phase = state.explore ? 'explore' : 'menu';
    lines.push(`捕捉成功！${wildName} 加入了队伍。`);
    note(state, `观察：${wildName} 在遭遇阶段被直接收下，没有经过战斗。`);
    timeline(state, `捕获 ${wildName}`);
    return lines;
  }
  lines.push('捕捉失败！虾米挣脱并进入战斗。');
  lines.push(...startWildBattle(state, state.catchBait));
  state.catchBait = false;
  return lines;
}

function resolveSkillChoice(state: TamerState, actionId: string): string[] {
  const pending = state.pendingSkills[0];
  if (!pending) {
    state.phase = returnPhase(state);
    return ['没有待选的技能。'];
  }
  const lines: string[] = [];
  if (actionId.startsWith('choice:skill:')) {
    const raw = actionId.slice('choice:skill:'.length);
    if (raw !== 'skip') {
      const index = Number.parseInt(raw, 10);
      const offer = Number.isInteger(index) ? pending.offers[index] : undefined;
      if (offer) {
        const creature = state.party[pending.partyIndex];
        if (creature && creature.uid === pending.uid && learnSkill(creature, offer)) {
          lines.push(`${displayName(creature)} 学会了 【${offer}】`);
        } else {
          lines.push('技能栏已满或目标不在队伍中，本次未学习。');
        }
      } else {
        lines.push('无效的技能序号，跳过本次学习。');
      }
    } else {
      lines.push('跳过了技能学习。');
    }
  } else {
    return illegal(state, actionId);
  }
  state.pendingSkills.shift();
  if (state.pendingSkills.length === 0) state.phase = returnPhase(state);
  return lines;
}

function handleParty(state: TamerState, actionId: string): string[] {
  if (actionId === 'choice:menu') {
    state.phase = 'menu';
    return ['回到主菜单。'];
  }
  if (actionId.startsWith('party:heal:')) {
    const index = numberTail(actionId, 'party:heal:');
    const creature = state.party[index];
    if (!creature) return [`队伍槽 ${index} 是空的。`];
    const potion = potionInventory(state)[0];
    if (!potion) return ['没有治疗药了。'];
    if ((state.items[potion.id] ?? 0) <= 0) return [`没有 ${potion.name} 了。`];
    state.items[potion.id] = (state.items[potion.id] ?? 0) - 1;
    if ((state.items[potion.id] ?? 0) <= 0) delete state.items[potion.id];
    const before = creature.hp;
    creature.hp = Math.min(
      creature.stats.hp,
      creature.hp + creature.stats.hp * (potion.heal_ratio ?? 0.25),
    );
    return [
      `${displayName(creature)} 使用 ${potion.name}，回复 ${Math.round(creature.hp - before)} HP。`,
    ];
  }
  if (actionId.startsWith('party:release:')) {
    const index = numberTail(actionId, 'party:release:');
    const name = releaseToBox(state, index);
    if (!name) return [`队伍槽 ${index} 是空的。`];
    timeline(state, `${name} 退回仓库`);
    return [`${name} 退回了仓库。`];
  }
  if (actionId.startsWith('party:swap:')) {
    const parts = actionId.slice('party:swap:'.length).split(':');
    if (parts.length !== 2) return ['换位格式：party:swap:<队伍槽>:<仓库序号>'];
    const slot = Number.parseInt(parts[0] ?? '', 10);
    const boxIndex = Number.parseInt(parts[1] ?? '', 10);
    if (!Number.isInteger(slot) || !Number.isInteger(boxIndex)) return ['换位序号必须是整数。'];
    const result = swapWithBox(state, slot, boxIndex);
    if (result.ok) timeline(state, result.message);
    return [result.message];
  }
  return illegal(state, actionId);
}

function handleItems(state: TamerState, actionId: string): string[] {
  if (actionId === 'choice:menu') {
    state.phase = 'menu';
    return ['回到主菜单。'];
  }
  if (actionId === 'item:cure_plague') {
    if (plagueCandidates(state).length === 0) return ['没有需要净化的虾米。'];
    if ((state.items.cure_plague ?? 0) <= 0) return ['没有净疫盐了。'];
    state.phase = 'items-cure';
    return ['选择要净化的虾米。'];
  }
  if (actionId.startsWith('item:')) {
    const itemId = actionId.slice('item:'.length);
    const item = itemOf(itemId);
    if (item?.type !== 'heal') return ['这个道具不能在这里使用。'];
    if ((state.items[itemId] ?? 0) <= 0) return [`没有 ${item.name} 了。`];
    state.items[itemId] = (state.items[itemId] ?? 0) - 1;
    if ((state.items[itemId] ?? 0) <= 0) delete state.items[itemId];
    const result = healParty(state, item.heal_ratio ?? 0.25);
    return [`使用 ${item.name}，${result.healed} 只虾米回复了 HP。`, ...result.lines];
  }
  return illegal(state, actionId);
}

function handleItemsCure(state: TamerState, actionId: string): string[] {
  if (actionId === 'choice:back' || actionId === 'choice:items') {
    state.phase = 'items';
    return ['回到道具菜单。'];
  }
  if (!actionId.startsWith('choice:cure:')) return illegal(state, actionId);
  const index = numberTail(actionId, 'choice:cure:');
  const creature = state.party[index];
  if (!creature) return [`队伍槽 ${index} 是空的。`];
  if (!creature.hasPlague && creature.taint <= 0) return ['这只虾米不需要净化。'];
  if ((state.items.cure_plague ?? 0) <= 0) return ['没有净疫盐了。'];
  state.items.cure_plague = (state.items.cure_plague ?? 0) - 1;
  if ((state.items.cure_plague ?? 0) <= 0) delete state.items.cure_plague;
  curePlague(creature);
  return [`${displayName(creature)} 的疫病与深渊污染被净化了。`];
}

function handleWorkshop(state: TamerState, actionId: string): string[] {
  if (actionId === 'workshop:back' || actionId === 'choice:menu') {
    state.selectedCreature = null;
    state.phase = 'menu';
    return ['离开词条工坊。'];
  }
  if (!actionId.startsWith('choice:target:')) return illegal(state, actionId);
  const index = numberTail(actionId, 'choice:target:');
  const creature = state.party[index];
  if (!creature) return [`队伍槽 ${index} 是空的。`];
  state.selectedCreature = index;
  state.phase = 'workshop-slot';
  return [`选中 ${displayName(creature)}（Lv${creature.level}），选择词条槽与操作。`];
}

function handleWorkshopSlot(state: TamerState, rng: Rng, actionId: string): string[] {
  if (actionId === 'workshop:back') {
    state.selectedCreature = null;
    state.phase = 'workshop';
    return ['重新选择虾米。'];
  }
  const ops: { prefix: string; op: WorkshopOp }[] = [
    { prefix: 'workshop:reroll:', op: 'reroll' },
    { prefix: 'workshop:upgrade:', op: 'upgrade' },
    { prefix: 'workshop:seal:', op: 'seal' },
    { prefix: 'workshop:unseal:', op: 'unseal' },
  ];
  for (const entry of ops) {
    if (!actionId.startsWith(entry.prefix)) continue;
    const slot = numberTail(actionId, entry.prefix);
    const result = workshopAction(state, rng, entry.op, slot);
    return [result.message];
  }
  return illegal(state, actionId);
}

function handleAbyssGate(state: TamerState, actionId: string): string[] {
  if (actionId === 'choice:menu') {
    state.phase = 'menu';
    return ['退回主菜单。'];
  }
  if (actionId !== 'abyss:enter') return illegal(state, actionId);
  return enterAbyss(state);
}

function handleAbyss(state: TamerState, rng: Rng, actionId: string): string[] {
  if (actionId === 'abyss:next') {
    return startAbyssFloor(state, rng);
  }
  if (actionId === 'abyss:retreat') {
    return retreatAbyss(state, rng);
  }
  if (actionId.startsWith('item:')) {
    const itemId = actionId.slice('item:'.length);
    const item = itemOf(itemId);
    if (item?.type !== 'heal') return ['深渊里只能使用治疗药。'];
    if ((state.items[itemId] ?? 0) <= 0) return [`没有 ${item.name} 了。`];
    state.items[itemId] = (state.items[itemId] ?? 0) - 1;
    if ((state.items[itemId] ?? 0) <= 0) delete state.items[itemId];
    const result = healParty(state, item.heal_ratio ?? 0.25);
    return [`使用 ${item.name}，${result.healed} 只虾米回复了 HP。`, ...result.lines];
  }
  return illegal(state, actionId);
}

export function act(state: TamerState, actionId: string): ActionResult {
  const rng = Rng.restore(state.rng);
  state.turn += 1;
  const events: GameEvent[] = [];
  let log: string[] = [];

  try {
    switch (state.phase) {
      case 'menu':
        log = handleMenu(state, rng, actionId);
        break;
      case 'zone':
        log = handleZone(state, rng, actionId);
        break;
      case 'subarea':
        log = handleSubArea(state, rng, actionId);
        break;
      case 'explore':
        log = handleExplore(state, rng, actionId);
        break;
      case 'encounter':
        log = handleEncounter(state, rng, actionId);
        break;
      case 'catch':
        log = handleCatch(state, rng, actionId);
        break;
      case 'battle':
        log = handleBattle(state, rng, actionId);
        break;
      case 'skill':
        log = resolveSkillChoice(state, actionId);
        break;
      case 'party':
        log = handleParty(state, actionId);
        break;
      case 'items':
        log = handleItems(state, actionId);
        break;
      case 'items-cure':
        log = handleItemsCure(state, actionId);
        break;
      case 'workshop':
        log = handleWorkshop(state, actionId);
        break;
      case 'workshop-slot':
        log = handleWorkshopSlot(state, rng, actionId);
        break;
      case 'abyss-gate':
        log = handleAbyssGate(state, actionId);
        break;
      case 'abyss':
        log = handleAbyss(state, rng, actionId);
        break;
      case 'ended':
        throw new Error('This run has already ended.');
      default:
        illegal(state, actionId);
    }
  } finally {
    state.rng = rng.serialize();
  }

  const newlyUnlocked = checkUnlocks(state);
  for (const zoneId of newlyUnlocked) {
    log.push(`✦ 新区域已解锁：${zoneDisplayName(zoneId)}`);
  }

  if (state.battle) {
    events.push({
      type: 'battle',
      mode: state.battle.mode,
      round: state.battle.round,
      result: state.battle.result,
      enemy: displayName(state.battle.enemy),
    });
  }
  if (state.wild) {
    events.push({
      type: 'encounter',
      species: state.wild.speciesId,
      level: state.wild.level,
      shiny: state.wild.shiny,
    });
  }
  if (state.phase === 'abyss' || state.abyssActive) {
    events.push({ type: 'abyss', floor: state.abyssFloor });
  }
  events.push({ type: 'phase', phase: state.phase });

  if (log.length > 0) state.lastResult = log[log.length - 1] ?? state.lastResult;
  pushLog(state, log);
  if (state.pendingSkills.length > 0 && state.phase !== 'skill' && state.outcome === 'ongoing') {
    state.phase = 'skill';
  }
  return { log, events };
}

export function abort(state: TamerState): void {
  state.outcome = 'aborted';
  state.phase = 'ended';
  state.abyssActive = false;
  state.abyssFloor = 0;
  state.explore = null;
  state.wild = null;
  state.battle = null;
  state.catchBait = false;
  state.cause = '这轮先在这里收手：进度已经记录，深渊与野外都停在当前状态。';
  note(state, '观察：本局是主动中止，不是死亡，也不是通关。');
}

export type { Creature, Phase, TamerState };
/* Re-export a few helpers so definition.ts and tests can stay on one import. */
export {
  activeCreatureOf,
  availableMoves,
  capturePreview,
  checkUnlocks,
  costLabel,
  enterAbyss,
  firstAliveIndex,
  itemCount,
  itemName,
  nextUid,
  plagueCandidates,
  resolveAbyssBattleEnd,
  retreatAbyss,
  speciesOf,
  startAbyssFloor,
  unlockedZoneList,
  WIN_FLOOR,
};
