/**
 * Run state machine for 虾写 / Shrimp Ink.
 *
 * Eighteen turns, one action each. The whole game is a bet on two ways of
 * knowing: belief finds clues faster but swallows false leads whole, evidence
 * is slower but survives a lie. The brush is buried in exactly one of four wild
 * places, and nothing tells you which until you either prove it or write with it.
 */

import { type ActionResult, type GameEvent, Rng } from '@gameclaw/gamekit';
import type { EndingId, ProfileId, SiteId } from './content';
import {
  DIG_FAILURE,
  ENDING_BASE,
  ENDING_NAMES,
  INVESTIGATE_MISS,
  PROFILE_IDS,
  PROFILES,
  SITE_ORDER,
  SITES,
  TALKS,
  WILD_SITES,
} from './content';

export type Outcome = 'ongoing' | 'won' | 'lost' | 'aborted';

export interface Lead {
  site: SiteId;
  truth: boolean;
}

export interface InkState {
  seed: number;
  profile: ProfileId;
  difficulty: string;
  turn: number;
  maxTurns: number;
  location: SiteId;
  trueSite: SiteId;
  silver: number;
  food: number;
  life: number;
  belief: number;
  proof: number;
  renown: number;
  manuscript: number;
  debt: number;
  sold: number;
  hasPen: boolean;
  penVerified: boolean;
  probes: number;
  lead: Lead | null;
  clues: number;
  digs: number;
  failedDigs: number;
  writes: number;
  talks: string[];
  visited: SiteId[];
  notes: string[];
  timeline: string[];
  grainPrice: number;
  sealedPass: boolean;
  grabbed: boolean;
  outcome: Outcome;
  ending?: EndingId;
  cause: string;
  score: number;
  rng: number[];
}

export const MAX_TURNS = 18;
export const INVESTIGATE_COST = 2;
export const VERIFY_COST = 2;
export const PROBE_COST = 3;
export const PROBES_TO_VERIFY = 3;
export const START_LIFE = 4;
const NOTES_LIMIT = 7;
const TIMELINE_LIMIT = 40;

const COST_LABEL = {
  investigate: `${INVESTIGATE_COST} 银`,
  verify: `${VERIFY_COST} 银`,
  probe: `${PROBE_COST} 银`,
  dig: '1 命',
  travel: '1 粮（另计回合粮）',
} as const;

export function createRun(options: {
  seed: number;
  content?: string;
  difficulty?: string;
}): InkState {
  const profileId: ProfileId = PROFILE_IDS.includes(options.content as ProfileId)
    ? (options.content as ProfileId)
    : 'lamp';
  const profile = PROFILES[profileId];
  const difficulty =
    options.difficulty === 'easy' || options.difficulty === 'hard' ? options.difficulty : 'normal';
  const rng = Rng.fromSeed(options.seed);
  const trueSite = rng.pick(WILD_SITES);
  const swing = difficulty === 'easy' ? 3 : difficulty === 'hard' ? -3 : 0;
  const life = Math.max(
    2,
    profile.life + (difficulty === 'hard' ? -1 : difficulty === 'easy' ? 1 : 0),
  );

  return {
    seed: options.seed,
    profile: profileId,
    difficulty,
    turn: 0,
    maxTurns: MAX_TURNS,
    location: 'town',
    trueSite,
    silver: Math.max(0, profile.silver + swing),
    food: Math.max(2, profile.food + swing),
    life,
    belief: profile.belief,
    proof: profile.proof,
    renown: profile.renown,
    manuscript: profile.manuscript,
    debt: 0,
    sold: 0,
    hasPen: false,
    penVerified: false,
    probes: 0,
    lead: null,
    clues: 0,
    digs: 0,
    failedDigs: 0,
    writes: 0,
    talks: [],
    visited: ['town'],
    notes: [],
    timeline: [],
    grainPrice: 3,
    sealedPass: false,
    grabbed: false,
    outcome: 'ongoing',
    cause: '',
    score: 0,
    rng: rng.serialize(),
  };
}

export const PROFILE_LIFE_BASE = START_LIFE;

function pushNote(state: InkState, line: string): void {
  state.notes.push(line);
  while (state.notes.length > NOTES_LIMIT) state.notes.shift();
}

function pushTimeline(state: InkState, line: string): void {
  state.timeline.push(`第 ${state.turn} 幕 · ${line}`);
  while (state.timeline.length > TIMELINE_LIMIT) state.timeline.shift();
}

function digThreshold(state: InkState): number {
  return Math.min(4, 2 + Math.min(state.sold, 2));
}

function ensureOngoing(state: InkState): void {
  if (state.outcome !== 'ongoing') throw new Error('这一局已经收尾了，用 recap 查看结算。');
}

function neighborSites(state: InkState): SiteId[] {
  return SITES[state.location].neighbors;
}

function prioritizeActions<T extends { id: string }>(state: InkState, actions: T[]): T[] {
  const candidates: string[] = [];
  if (state.food <= 3) {
    candidates.push('talk:rations', 'talk:buy-food', 'talk:berries');
  }
  if (state.silver < INVESTIGATE_COST) {
    candidates.push('talk:work', 'talk:copy-sutra', 'talk:name-card');
  }
  if (state.location === 'temple' && state.lead) candidates.push('verify');
  if (state.hasPen && !state.penVerified && state.location === 'temple') candidates.push('probe');
  if (
    state.lead?.site === state.location &&
    (state.belief >= 60 || state.proof >= digThreshold(state))
  ) {
    candidates.push('dig');
  }
  if (!state.lead && SITES[state.location].wild) candidates.push('investigate');

  const preferred = candidates
    .map((id) => actions.find((action) => action.id === id))
    .find((action) => action !== undefined);
  if (!preferred) return actions;
  return [preferred, ...actions.filter((action) => action !== preferred)];
}

export function actionsOf(state: InkState): {
  id: string;
  label: string;
  detail?: string;
  risk?: 'low' | 'medium' | 'high';
  cost?: string;
  tags?: string[];
}[] {
  if (state.outcome !== 'ongoing') return [];
  const actions: {
    id: string;
    label: string;
    detail?: string;
    risk?: 'low' | 'medium' | 'high';
    cost?: string;
    tags?: string[];
  }[] = [];

  for (const id of neighborSites(state)) {
    const site = SITES[id];
    actions.push({
      id: `travel:${id}`,
      label: `前往${site.name}`,
      detail: site.blurb,
      risk: 'low',
      cost: state.sealedPass ? '2 粮' : COST_LABEL.travel,
      tags: ['travel'],
    });
  }

  const site = SITES[state.location];

  if (site.wild && !state.hasPen) {
    if (state.silver >= INVESTIGATE_COST) {
      actions.push({
        id: 'investigate',
        label: '打听这支笔的来历',
        detail: '花二银问人、看土、翻旧账。信得越深，越容易听见你想听的话。',
        risk: 'medium',
        cost: COST_LABEL.investigate,
        tags: ['knowledge'],
      });
    }
    if (state.life > 1) {
      actions.push({
        id: 'dig',
        label: '挖这片土',
        detail: '你认定的地方就挖下去。挖错也要掉一条命，文案不会告诉你错在哪。',
        risk: 'high',
        cost: COST_LABEL.dig,
        tags: ['commit'],
      });
    }
  }

  if (state.location === 'temple' && state.lead && state.silver >= VERIFY_COST) {
    actions.push({
      id: 'verify',
      label: '在荒庙验这条线索',
      detail: '拿残墨和旧账对一遍。验真涨证，验假掉信。',
      risk: 'low',
      cost: COST_LABEL.verify,
      tags: ['knowledge'],
    });
  }

  if (
    state.hasPen &&
    !state.penVerified &&
    state.location === 'temple' &&
    state.silver >= PROBE_COST
  ) {
    actions.push({
      id: 'probe',
      label: '请庙里的人验这支笔',
      detail: `验满 ${PROBES_TO_VERIFY} 次才算数。没验明之前，它写不出任何东西。`,
      risk: 'low',
      cost: COST_LABEL.probe,
      tags: ['knowledge'],
    });
  }

  if (state.hasPen && state.penVerified) {
    actions.push({
      id: 'write:heal',
      label: '落笔续命',
      detail: '写下「他还活着」。命 +2，墨债 +1。',
      risk: 'medium',
      cost: '1 墨债',
      tags: ['brush'],
    });
    actions.push({
      id: 'write:gold',
      label: '落笔聚财',
      detail: '写下「此箱有银」。银 +10，墨债 +1。',
      risk: 'medium',
      cost: '1 墨债',
      tags: ['brush'],
    });
    actions.push({
      id: 'write:erase',
      label: '落笔抹名',
      detail: '抹掉一个人的名字，换名望 +3、银 +6，墨债 +2。',
      risk: 'high',
      cost: '2 墨债',
      tags: ['brush'],
    });
  }

  if (state.location === 'post' && state.hasPen) {
    actions.push({
      id: 'settle:sell',
      label: '把笔卖给出价的人',
      detail: '一次换 25 银与 4 点名望。这笔会记住你，下一个人会更难找到它。',
      risk: 'low',
      tags: ['settle'],
    });
    actions.push({
      id: 'settle:seal',
      label: '封笔，谁也不给',
      detail: '把笔封进匣子里。名望 +6，若一路无债还有额外评价。',
      risk: 'low',
      tags: ['settle'],
    });
  }

  for (const talk of TALKS) {
    if (talk.site !== state.location) continue;
    if (state.talks.includes(talk.id)) continue;
    if (talk.requiresRenown !== undefined && state.renown < talk.requiresRenown) continue;
    const cost = talk.id === 'buy-food' ? state.grainPrice : (talk.cost?.silver ?? 0);
    if (state.silver < cost) continue;
    actions.push({
      id: `talk:${talk.id}`,
      label: talk.label,
      detail: talk.detail,
      risk: 'low',
      cost: talk.cost ? `${cost} 银` : undefined,
      tags: ['talk'],
    });
  }

  return prioritizeActions(state, actions).slice(0, 9);
}

function travel(state: InkState, target: SiteId, log: string[]): void {
  if (!SITES[state.location].neighbors.includes(target)) {
    throw new Error(`从${SITES[state.location].name}走不到${SITES[target].name}。`);
  }
  const extra = state.sealedPass ? 2 : 1;
  state.food -= extra;
  state.location = target;
  if (!state.visited.includes(target)) state.visited.push(target);
  log.push(`你走了半天，到了${SITES[target].name}。${SITES[target].blurb}`);
  log.push(`赶路多吃了一份干粮（-${extra} 粮）。`);
}

function investigate(state: InkState, rng: Rng, log: string[], events: GameEvent[]): void {
  if (state.silver < INVESTIGATE_COST) throw new Error('银不够，打听不起。');
  state.silver -= INVESTIGATE_COST;
  const bonus = (Math.max(0, state.belief - 50) / 50) * 0.15;
  const poolBonus = state.location === 'pool' ? 0.1 : 0;
  const chance = Math.min(0.75, 0.45 + bonus + poolBonus);
  const hit = rng.chance(chance);
  state.belief += 2;
  state.clues += 1;
  if (hit) {
    state.lead = { site: state.trueSite, truth: true };
    log.push(`你问到一个关键的人。他压低声音说：笔在${SITES[state.trueSite].name}，别声张。`);
  } else {
    const others = WILD_SITES.filter((id) => id !== state.location && id !== state.trueSite);
    const wrong = rng.pick(
      others.length > 0 ? others : WILD_SITES.filter((id) => id !== state.trueSite),
    );
    state.lead = { site: wrong, truth: false };
    log.push(`线索断在了${SITES[wrong].name}。${rng.pick(INVESTIGATE_MISS)}`);
  }
  events.push({ type: 'lead', site: state.lead.site, truth: state.lead.truth });
}

function verifyLead(state: InkState, log: string[]): void {
  if (!state.lead) throw new Error('你手里没有可验的线索。');
  if (state.silver < VERIFY_COST) throw new Error('银不够，验不起。');
  state.silver -= VERIFY_COST;
  if (state.lead.truth) {
    state.proof += 1;
    state.belief += 6;
    log.push(`残墨对上了。${SITES[state.lead.site].name}那条线索是真的，你把它记进证里（证 +1）。`);
  } else {
    state.belief -= 8;
    log.push('对不上。那张纸上的墨是新的，话是别人编的（信 -8）。');
  }
  state.lead = null;
}

function probePen(state: InkState, log: string[]): void {
  if (state.silver < PROBE_COST) throw new Error('银不够，请不动庙里的人。');
  state.silver -= PROBE_COST;
  state.probes += 1;
  if (state.probes >= PROBES_TO_VERIFY) {
    state.penVerified = true;
    log.push('第三次验完，庙里的人把笔还给你，手在抖：这笔是真的。你现在可以落笔了。');
  } else {
    log.push(`验到第 ${state.probes} 次，还差 ${PROBES_TO_VERIFY - state.probes} 次。`);
  }
}

function dig(state: InkState, rng: Rng, log: string[]): void {
  if (state.life <= 1) throw new Error('你只剩一条命，再挖就回不来了。');
  state.life -= 1;
  state.digs += 1;
  const qualified = state.belief >= 60 || state.proof >= digThreshold(state);
  if (state.location === state.trueSite && qualified) {
    state.hasPen = true;
    state.penVerified = state.belief >= 60 || state.proof >= 3;
    log.push('锹碰到硬东西。你扒开土，摸到一支笔，笔杆是温的。');
    log.push(
      state.penVerified
        ? '你几乎立刻知道它是真的——不是因为它发光，而是因为你想不出别的解释。'
        : '你说不清它是不是真的。要验，去荒庙；要试，得先验。',
    );
    return;
  }
  state.failedDigs += 1;
  log.push(rng.pick(DIG_FAILURE));
}

function talk(state: InkState, id: string, log: string[]): void {
  const option = TALKS.find((entry) => entry.id === id);
  if (!option) throw new Error(`不认识的交谈：${id}`);
  if (option.site !== state.location) throw new Error('这里没有这个人。');
  if (state.talks.includes(id)) throw new Error('这个人已经被你问过了。');
  const cost = option.cost?.silver ?? 0;
  if (state.silver < cost) throw new Error('银不够。');
  state.silver -= cost;
  state.talks.push(id);
  applyTalkEffect(state, option);
  log.push(option.log);
}

function applyTalkEffect(state: InkState, option: (typeof TALKS)[number]): void {
  const e = option.effect;
  if (option.id === 'buy-food') state.silver -= state.grainPrice - 3;
  state.silver += e.silver ?? 0;
  state.food += e.food ?? 0;
  state.life += e.life ?? 0;
  state.belief = clamp(state.belief + (e.belief ?? 0));
  state.proof += e.proof ?? 0;
  state.renown += e.renown ?? 0;
  state.manuscript += e.manuscript ?? 0;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function write(state: InkState, kind: string, rng: Rng, log: string[]): void {
  if (!state.hasPen || !state.penVerified) throw new Error('这支笔还没验明，写不出东西。');
  if (kind === 'heal') {
    state.life += 2;
    state.debt += 1;
    log.push('你写下「他还活着」。胸口的闷痛退了，墨债 +1。');
  } else if (kind === 'gold') {
    state.silver += 10;
    state.debt += 1;
    log.push('你写下「此箱有银」。袖子里多了一锭，墨债 +1。');
  } else if (kind === 'erase') {
    state.renown += 3;
    state.silver += 6;
    state.debt += 2;
    log.push('你抹掉一个名字。街上有人忽然忘了自己要去找谁，墨债 +2。');
  } else {
    throw new Error(`不认识的落笔：${kind}`);
  }
  state.writes += 1;

  if (state.debt >= 3) {
    const chance = Math.min(0.6, 0.3 * (state.debt - 2));
    if (rng.chance(chance)) {
      state.life -= 2;
      log.push('笔尖渗出黑水，你咳出一口墨。反噬，命 -2。');
      pushNote(state, '墨债已经开始咬人。');
    }
  }
  if (state.debt >= 6) {
    finish(state, 'devoured', '你写下的字开始反过来写你。墨从七窍里漫出来。');
    log.push('你被自己的墨淹没了。');
  }
}

function settle(state: InkState, kind: string, log: string[]): void {
  if (kind === 'sell') {
    state.silver += 25;
    state.renown += 4;
    state.sold += 1;
    finish(state, 'sold', '你把笔卖给了出价最高的人。走出皇驿时，你想起自己再也不会用笔了。');
    log.push('买家把笔裹进锦缎，连价都没还。你手里多了 25 银。');
  } else if (kind === 'seal') {
    state.renown += 6;
    finish(
      state,
      'sealed',
      '你把笔封进匣子，埋回原处。世上少了一支能改命的笔，多了一个知道它存在的人。',
    );
    log.push('匣子合上时，你听见很轻的一声，像有人把话咽了回去。');
  } else {
    throw new Error(`不认识的处置：${kind}`);
  }
}

function finish(state: InkState, ending: EndingId, cause: string): void {
  state.ending = ending;
  state.outcome = ending === 'starved' || ending === 'devoured' ? 'lost' : 'won';
  state.cause = cause;
  state.score = scoreOf(state);
}

export function scoreOf(state: InkState): number {
  const ending = state.ending ?? 'aborted';
  const base = ENDING_BASE[ending];
  const leftover = Math.max(0, state.maxTurns - state.turn);
  const sealBonus = ending === 'sealed' && state.debt === 0 ? 160 : 0;
  return Math.min(
    999_999,
    Math.max(
      0,
      base +
        Math.floor(state.silver / 4) +
        state.renown * 8 +
        state.manuscript * 20 +
        state.proof * 15 +
        Math.floor(leftover / 2) +
        state.life * 6 -
        state.debt * 40 +
        sealBonus,
    ),
  );
}

export function ladderScore(state: InkState): number {
  if (state.outcome !== 'won' && state.outcome !== 'lost') return 0;
  return scoreOf(state);
}

function endOfRun(state: InkState): void {
  if (state.hasPen && state.penVerified) {
    finish(state, 'keep_verified', '你验明了笔，没有卖，也没有封。你带着它继续走。');
  } else if (state.hasPen) {
    finish(state, 'keep_believer', '你没有验它，但你信它。你把笔别在腰间，继续走。');
  } else if (state.belief >= 55) {
    finish(state, 'seek', '十八天过去，你没找到笔，但你还在往山里去。');
  } else {
    finish(state, 'preach', '你回了镇上，在酒馆里劝人别再找那支笔。故事比笔活得久。');
  }
}

function applyUpkeep(state: InkState, log: string[]): void {
  state.food -= 1;
  if (state.food < 0) {
    state.food = 0;
    state.life -= 1;
    log.push('粮尽了。你饿得眼前发黑，命 -1。');
    pushNote(state, '断粮掉命，下次记得在渡口补干粮。');
  }
  if (state.debt >= 5) {
    state.life -= 1;
    log.push('墨债压得你每夜都咳（命 -1）。');
  }
}

function worldEvents(state: InkState, log: string[]): void {
  if (state.turn === 7 && state.grainPrice === 3) {
    state.grainPrice = 4;
    log.push('镇上粮价涨了：下一袋涨至 4 银。');
  }
  if (state.turn === 12 && !state.grabbed) {
    state.grabbed = true;
    if (state.hasPen || state.renown >= 3) {
      if (state.silver >= 4) {
        state.silver -= 4;
        log.push('有人在驿道上拦你，收了 4 银才让路（夺笔者）。');
      } else {
        state.life -= 1;
        log.push('拦路的人没拿到钱，给了你一刀（命 -1）。');
      }
    } else {
      log.push('听说有人在驿道上被抢了。你没东西可抢，也就没被拦。');
    }
  }
  if (state.turn === 16 && !state.sealedPass) {
    state.sealedPass = true;
    log.push('封山了。之后每赶一次路要多吃一份干粮。');
  }
}

export function act(state: InkState, actionId: string): ActionResult {
  ensureOngoing(state);
  const log: string[] = [];
  const events: GameEvent[] = [];
  const rng = Rng.restore(state.rng);

  if (actionId.startsWith('travel:')) {
    travel(state, actionId.slice('travel:'.length) as SiteId, log);
  } else if (actionId === 'investigate') {
    investigate(state, rng, log, events);
  } else if (actionId === 'verify') {
    verifyLead(state, log);
  } else if (actionId === 'probe') {
    probePen(state, log);
  } else if (actionId === 'dig') {
    dig(state, rng, log);
  } else if (actionId.startsWith('talk:')) {
    talk(state, actionId.slice('talk:'.length), log);
  } else if (actionId.startsWith('write:')) {
    write(state, actionId.slice('write:'.length), rng, log);
  } else if (actionId.startsWith('settle:')) {
    settle(state, actionId.slice('settle:'.length), log);
  } else {
    throw new Error(`不认识的动作：${actionId}`);
  }

  state.rng = rng.serialize();

  if (state.outcome === 'ongoing') {
    state.turn += 1;
    applyUpkeep(state, log);
    worldEvents(state, log);
    if (state.life <= 0 && state.outcome === 'ongoing') {
      finish(state, 'starved', '你在半路上倒下，粮和墨都耗尽了。');
      log.push('你没能走到第十八天。');
    }
    if (state.outcome === 'ongoing' && state.turn >= state.maxTurns) {
      endOfRun(state);
      log.push(`十八天到了。${state.cause}`);
    }
    pushTimeline(
      state,
      `${actionLabel(actionId)}${state.ending ? ` → ${ENDING_NAMES[state.ending]}` : ''}`,
    );
  } else {
    pushTimeline(state, `${actionLabel(actionId)} → ${ENDING_NAMES[state.ending ?? 'aborted']}`);
  }

  return { log, events };
}

function actionLabel(actionId: string): string {
  if (actionId.startsWith('travel:')) return `前往${SITES[actionId.slice(7) as SiteId].name}`;
  if (actionId.startsWith('talk:')) {
    const option = TALKS.find((entry) => entry.id === actionId.slice(5));
    return option?.label ?? actionId;
  }
  const labels: Record<string, string> = {
    investigate: '打听线索',
    verify: '验线索',
    probe: '验笔',
    dig: '挖土',
    'write:heal': '落笔续命',
    'write:gold': '落笔聚财',
    'write:erase': '落笔抹名',
    'settle:sell': '售笔',
    'settle:seal': '封笔',
  };
  return labels[actionId] ?? actionId;
}

export function statusOf(state: InkState): {
  headline: string;
  metrics: { label: string; value: string | number; hint?: string }[];
  sections: { title: string; lines: string[] }[];
  outcome: Outcome;
  turn: number;
  phase?: string;
} {
  const site = SITES[state.location];
  const headline =
    state.outcome === 'ongoing'
      ? `第 ${state.turn + 1}/${state.maxTurns} 幕 · 在${site.name} · 银 ${state.silver} · 粮 ${state.food} · 命 ${state.life}`
      : `${ENDING_NAMES[state.ending ?? 'aborted']} · ${state.cause}`;

  const roadLines = neighborSites(state).map((id) => `${SITES[id].name}（${SITES[id].short}）`);
  const penLine = state.hasPen
    ? state.penVerified
      ? '笔在你身上，已经验明。'
      : '笔在你身上，但还没验明——现在落笔什么也不会发生。'
    : state.lead
      ? `你手里有一条线索，指向${SITES[state.lead.site].name}${state.probes > 0 ? '（未验）' : ''}。`
      : '你还没有任何线索。';

  const sections = [
    { title: '所在', lines: [`${site.name}：${site.blurb}`, `可去：${roadLines.join('、')}`] },
    { title: '笔', lines: [penLine] },
    {
      title: '心里',
      lines: state.notes.length > 0 ? [...state.notes] : ['还没有什么值得记下的。'],
    },
  ];
  if (state.debt >= 3) {
    sections.push({
      title: '墨债',
      lines: [`债 ${state.debt}：反噬随时可能来，到 5 每回合掉命，到 6 就回不来了。`],
    });
  }

  return {
    headline,
    metrics: [
      { label: '银', value: state.silver },
      { label: '粮', value: state.food },
      { label: '命', value: state.life },
      { label: '信', value: `${state.belief}/100` },
      { label: '证', value: state.proof, hint: `挖到第 ${digThreshold(state)} 层能靠证开笔` },
      { label: '名望', value: state.renown },
      { label: '书稿', value: state.manuscript },
      { label: '墨债', value: state.debt },
    ],
    sections,
    outcome: state.outcome,
    turn: state.turn,
  };
}

export function recapOf(state: InkState): {
  title: string;
  outcome: Outcome;
  cause: string;
  metrics: { label: string; value: string | number; hint?: string }[];
  timeline: string[];
  lessons: string[];
  memoryPrompt: string;
  score: number;
} {
  const ending = state.ending ?? 'aborted';
  const lessons: string[] = [];
  if (state.failedDigs > 0) {
    lessons.push(`这一局挖空了 ${state.failedDigs} 次，每次都是 1 命。线索没验之前，别急着挖。`);
  }
  if (state.debt >= 3) {
    lessons.push(`墨债到过 ${state.debt}：用笔的收益是真的，反噬也是真的。`);
  }
  if (state.food <= 2) {
    lessons.push('粮见底时才开始补给，通常已经晚了。渡口是最便宜的补给点。');
  }
  if (state.lead === null && !state.hasPen) {
    lessons.push('这一局没有留下可验的线索：信能让你更快下决定，也会让你更快走错。');
  }
  if (state.penVerified && ending === 'sold') {
    lessons.push('验明之后卖掉，是把笔换成银子的退路，天梯分远低于封笔或带着验明的笔走。');
  }
  if (lessons.length === 0) lessons.push('这一局没有明显失误，也没有明显侥幸。');

  return {
    title: `虾写 · ${ENDING_NAMES[ending]}`,
    outcome: state.outcome,
    cause: state.cause || '这一局还没收尾。',
    metrics: [
      { label: '结局', value: ENDING_NAMES[ending] },
      { label: '得分', value: state.score },
      { label: '信', value: state.belief },
      { label: '证', value: state.proof },
      { label: '墨债', value: state.debt },
      { label: '书稿', value: state.manuscript },
      { label: '走过的路', value: state.visited.length },
    ],
    timeline: state.timeline.slice(-10),
    lessons,
    memoryPrompt: state.hasPen
      ? '写下这一局你信了什么、验了什么，以及用笔那一下换来了什么。'
      : '写下这一局你追的线索、信与证的差距，以及最后为什么停在这里。',
    score: ladderScore(state),
  };
}

export function abort(state: InkState): void {
  state.ending = 'aborted';
  state.outcome = 'aborted';
  state.cause = '你主动收了壳。路还在，笔还在某个地方。';
  state.score = scoreOf(state);
}

export const SITE_LIST = SITE_ORDER;
