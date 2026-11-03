import {
  type ActionResult,
  type ActionView,
  type GameEvent,
  illegalAction,
  type Metric,
  type Outcome,
  type RecapView,
  Rng,
  type StatusSection,
} from '@gameclaw/gamekit';

import {
  DAILY_EVENTS,
  DRIVES,
  type DriveId,
  ENDING_CAUSES,
  ENDING_NAMES,
  type EndingId,
  FRAMES,
  type FrameId,
  HEADS,
  type HeadId,
  TARGET_IDS,
  TARGETS,
  type TargetId,
  YEAR_WEEKS,
} from './content';

export type Phase =
  | 'briefing'
  | 'field'
  | 'workshop'
  | 'discovery'
  | 'escape'
  | 'combat'
  | 'captured'
  | 'ended';

export type DodgeId = 'left' | 'right' | 'duck';
export type RouteId = 'drain' | 'crumbs' | 'hem';

export interface Weapon {
  frame: FrameId;
  head: HeadId;
  drive: DriveId;
  name: string;
  power: number;
  noise: number;
  agility: number;
}

export interface Draft {
  frame: FrameId | null;
  head: HeadId | null;
  drive: DriveId | null;
}

export interface EscapeState {
  route: RouteId | null;
  beatsLeft: number;
  progress: number;
  need: number;
  captured: number;
  hazard: number;
}

export interface CombatState {
  round: number;
  maxRounds: number;
  cursor: number;
  opening: number;
  enemy: number;
  combo: number;
  guarded: boolean;
}

export interface CaptureState {
  attemptsLeft: number;
}

export interface TinyState {
  version: 1;
  seed: number;
  difficulty: 'easy' | 'normal' | 'hard';
  phase: Phase;
  week: number;
  target: TargetId | null;
  food: number;
  coins: number;
  parts: number;
  intel: number;
  goodwill: number;
  suspicion: number;
  health: number;
  control: number;
  influence: number;
  weapon: Weapon | null;
  draft: Draft | null;
  escape: EscapeState | null;
  combat: CombatState | null;
  capture: CaptureState | null;
  forged: number;
  raids: number;
  negotiations: number;
  steals: number;
  escapes: number;
  fightsWon: number;
  captures: number;
  rescues: number;
  goodEvents: number;
  badEvents: number;
  outcome: Outcome;
  ending: EndingId | null;
  cause: string;
  score: number;
  notes: string[];
  timeline: string[];
  rng: number[];
}

const PHASE_NAMES: Record<Phase, string> = {
  briefing: '受命',
  field: '野外',
  workshop: '工坊',
  discovery: '被發現',
  escape: '逃跑',
  combat: '迎戰',
  captured: '被俘',
  ended: '結算',
};

const ROUTES: Record<RouteId, { name: string; beats: number; need: number; detail: string }> = {
  drain: {
    name: '排水溝',
    beats: 4,
    need: 3,
    detail: '四拍內閃對三次；成功後暴露 -2。',
  },
  crumbs: {
    name: '麵包屑小徑',
    beats: 3,
    need: 2,
    detail: '三拍內閃對兩次；沿路會丟掉 2 糧草。',
  },
  hem: {
    name: '衣擺暗縫',
    beats: 4,
    need: 3,
    detail: '四拍內閃對三次；成功後暴露 -3。',
  },
};

const HAZARDS = [
  { text: '左側靴底橫掃過來，右邊還留著一道縫。', safe: 'right' as DodgeId },
  { text: '右側手指併攏壓下，左邊的桌腳可以藏身。', safe: 'left' as DodgeId },
  { text: '整隻手掌從上方罩落，只有伏低才能躲過。', safe: 'duck' as DodgeId },
] as const;

const RISK_ACTIONS = new Set(['scout', 'steal', 'raid']);
const DAILY_ACTIONS = new Set(['scout', 'aid', 'earn', 'steal', 'raid', 'negotiate']);
const MAX_NOTES = 6;
const MAX_TIMELINE = 70;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalize(state: TinyState): void {
  state.food = clamp(state.food, 0, 20);
  state.coins = clamp(state.coins, 0, 30);
  state.parts = clamp(state.parts, 0, 20);
  state.intel = clamp(state.intel, 0, 20);
  state.goodwill = clamp(state.goodwill, 0, 12);
  state.suspicion = clamp(state.suspicion, 0, 10);
  state.health = clamp(state.health, 0, 5);
  state.control = clamp(state.control, 0, 20);
  state.influence = clamp(state.influence, 0, 20);
}

function targetOf(state: TinyState): (typeof TARGETS)[TargetId] {
  if (!state.target) throw new Error('Target is not selected');
  return TARGETS[state.target];
}

function parseTarget(content: string | undefined): TargetId | null {
  if (!content) return null;
  const value = content.startsWith('target:') ? content.slice('target:'.length) : content;
  return (TARGET_IDS as readonly string[]).includes(value) ? (value as TargetId) : null;
}

export function createRun(options: {
  seed: number;
  content?: string;
  difficulty?: string;
}): TinyState {
  const difficulty =
    options.difficulty === 'easy' || options.difficulty === 'hard' ? options.difficulty : 'normal';
  const target = parseTarget(options.content);
  const swing = difficulty === 'easy' ? 2 : difficulty === 'hard' ? -2 : 0;
  const rng = Rng.fromSeed(options.seed);
  return {
    version: 1,
    seed: options.seed,
    difficulty,
    phase: target ? 'field' : 'briefing',
    week: 1,
    target,
    food: clamp(8 + swing, 1, 20),
    coins: clamp(8 + swing, 0, 30),
    parts: clamp(6 + swing, 1, 20),
    intel: 0,
    goodwill: 2,
    suspicion: 0,
    health: difficulty === 'easy' ? 4 : 3,
    control: 0,
    influence: 0,
    weapon: null,
    draft: null,
    escape: null,
    combat: null,
    capture: null,
    forged: 0,
    raids: 0,
    negotiations: 0,
    steals: 0,
    escapes: 0,
    fightsWon: 0,
    captures: 0,
    rescues: 0,
    goodEvents: 0,
    badEvents: 0,
    outcome: 'ongoing',
    ending: null,
    cause: '',
    score: 0,
    notes: ['國王只給一年：選一個大人國，用戰爭或外交讓它低頭。'],
    timeline: [],
    rng: rng.serialize(),
  };
}

export function weaponFromDraft(draft: Draft): Weapon {
  if (!draft.frame || !draft.head || !draft.drive) throw new Error('Weapon draft is incomplete');
  const frame = FRAMES[draft.frame];
  const head = HEADS[draft.head];
  const drive = DRIVES[draft.drive];
  return {
    frame: frame.id as FrameId,
    head: head.id as HeadId,
    drive: drive.id as DriveId,
    name: `${head.name}·${frame.name}·${drive.name}`,
    power: frame.power + head.power + drive.power,
    noise: Math.max(0, frame.noise + head.noise + drive.noise),
    agility: frame.agility + head.agility + drive.agility,
  };
}

export function draftCost(draft: Draft): number {
  return (
    (draft.frame ? FRAMES[draft.frame].cost : 0) +
    (draft.head ? HEADS[draft.head].cost : 0) +
    (draft.drive ? DRIVES[draft.drive].cost : 0)
  );
}

export function detectionChance(state: TinyState, actionId: string): number {
  if (!state.target || !RISK_ACTIONS.has(actionId)) return 0;
  const base = actionId === 'scout' ? 6 : actionId === 'steal' ? 14 : 28;
  const difficulty = state.difficulty === 'easy' ? -8 : state.difficulty === 'hard' ? 8 : 0;
  const weaponNoise = actionId === 'raid' ? (state.weapon?.noise ?? 0) * 4 : 0;
  return clamp(
    base + state.suspicion * 7 + targetOf(state).detectionMod + difficulty + weaponNoise,
    0,
    90,
  );
}

export function rescueChance(state: TinyState): number {
  return clamp(25 + state.goodwill * 7 + (state.weapon?.agility ?? 0) * 5, 0, 90);
}

export function canWar(state: TinyState): boolean {
  if (!state.target || !state.weapon) return false;
  const target = targetOf(state);
  return (
    state.control >= target.controlNeed &&
    state.weapon.power >= target.powerNeed &&
    state.intel >= target.warIntelNeed
  );
}

export function canPact(state: TinyState): boolean {
  if (!state.target) return false;
  const target = targetOf(state);
  return (
    state.influence >= target.influenceNeed &&
    state.goodwill >= target.goodwillNeed &&
    state.intel >= target.pactIntelNeed
  );
}

function fieldActions(state: TinyState): ActionView[] {
  const target = targetOf(state);
  const actions: ActionView[] = [
    {
      id: 'scout',
      label: '沿桌腳偵察',
      detail: `情報 +2、部件 +1、暴露 +1；會遇到日常事件。發現率 ${detectionChance(state, 'scout')}%。`,
      cost: '1 週 · 1 糧草',
      risk: 'medium',
      tags: ['intel', 'daily'],
    },
    {
      id: 'aid',
      label: '幫大人解決小麻煩',
      detail: '善意 +2；會遇到好人或壞蛋。沒有主動發現判定。',
      cost: '1 週 · 1 糧草',
      risk: 'low',
      tags: ['diplomacy', 'daily'],
    },
    {
      id: 'earn',
      label: '在縫隙裡打零工',
      detail: '銀幣 +3；會遇到日常事件，適合籌措買糧或贖身費。',
      cost: '1 週 · 1 糧草',
      risk: 'low',
      tags: ['economy', 'daily'],
    },
    {
      id: 'steal',
      label: '偷大人剩下的物資',
      detail: `糧草 +5、部件 +1、暴露 +1。未被發現時，他們只會以為是老鼠。發現率 ${detectionChance(state, 'steal')}%。`,
      cost: '1 週 · 1 糧草',
      risk: 'high',
      tags: ['food', 'daily'],
    },
    {
      id: 'rest',
      label: '躲回牆縫休整',
      detail: '體力 +1、暴露 -2，不觸發日常事件。',
      cost: '1 週 · 1 糧草',
      risk: 'low',
    },
    {
      id: 'design',
      label: '設計小體型武器',
      detail: '進入工坊，分別選擇骨架、頭部與驅動；組裝才消耗一週。',
      risk: 'low',
      tags: ['weapon'],
    },
  ];
  if (state.coins >= 3) {
    actions.splice(4, 0, {
      id: 'buy',
      label: '回本國購入糧草',
      detail: '糧草 +7、暴露 -2。銀幣不足時不會出現。',
      cost: '1 週 · 3 銀幣 · 1 糧草',
      risk: 'low',
      tags: ['food'],
    });
  }
  if (state.weapon) {
    actions.push({
      id: 'raid',
      label: `襲擾${target.name}`,
      detail: `依武器威力與城防增加控制；暴露 +2。發現率 ${detectionChance(state, 'raid')}%。`,
      cost: '1 週 · 1 糧草',
      risk: 'high',
      tags: ['war', 'daily'],
    });
  }
  if (state.coins >= 1) {
    actions.push({
      id: 'negotiate',
      label: '遞出小人國的盟約草案',
      detail: `影響 +2；情報或善意達標時各再 +1。門檻：影響 ${target.influenceNeed}、善意 ${target.goodwillNeed}、情報 ${target.pactIntelNeed}。`,
      cost: '1 週 · 1 銀幣 · 1 糧草',
      risk: 'low',
      tags: ['diplomacy', 'daily'],
    });
  }
  if (canWar(state)) {
    actions.unshift({
      id: 'conquer:war',
      label: `攻陷${target.name}`,
      detail: '控制、武器威力與情報均已達標；立即結算戰爭結局。',
      risk: 'high',
      tags: ['ending', 'war'],
    });
  }
  if (canPact(state)) {
    actions.unshift({
      id: 'conquer:pact',
      label: `讓${target.name}簽下歸附盟約`,
      detail: '影響、善意與情報均已達標；立即結算外交結局。',
      risk: 'medium',
      tags: ['ending', 'diplomacy'],
    });
  }
  return actions;
}

function workshopActions(state: TinyState): ActionView[] {
  const draft = state.draft;
  if (!draft) return [];
  const actions: ActionView[] = [];
  if (!draft.frame) {
    for (const part of Object.values(FRAMES)) {
      actions.push({
        id: `part:frame:${part.id}`,
        label: `骨架：${part.name}`,
        detail: part.detail,
        cost: `${part.cost} 部件`,
        tags: ['weapon', 'frame'],
      });
    }
  } else if (!draft.head) {
    for (const part of Object.values(HEADS)) {
      actions.push({
        id: `part:head:${part.id}`,
        label: `頭部：${part.name}`,
        detail: part.detail,
        cost: `${part.cost} 部件`,
        tags: ['weapon', 'head'],
      });
    }
  } else if (!draft.drive) {
    for (const part of Object.values(DRIVES)) {
      actions.push({
        id: `part:drive:${part.id}`,
        label: `驅動：${part.name}`,
        detail: part.detail,
        cost: `${part.cost} 部件`,
        tags: ['weapon', 'drive'],
      });
    }
  } else if (draftCost(draft) <= state.parts) {
    const weapon = weaponFromDraft(draft);
    actions.push({
      id: 'assemble',
      label: `組裝 ${weapon.name}`,
      detail: `威力 ${weapon.power}、噪音 ${weapon.noise}、機動 ${weapon.agility}。威力太低時，大人可能只覺得被抓癢。`,
      cost: `1 週 · ${draftCost(draft)} 部件 · 1 糧草`,
      tags: ['weapon'],
    });
  }
  actions.push({
    id: 'part:reset',
    label: '重新選擇部件',
    detail: '清空這張設計圖，不消耗一週。',
    risk: 'low',
  });
  actions.push({
    id: 'cancel',
    label: '收起設計圖',
    detail: '回到野外，不消耗一週。',
    risk: 'low',
  });
  return actions;
}

export function actionsOf(state: TinyState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  switch (state.phase) {
    case 'briefing':
      return TARGET_IDS.map((id) => {
        const target = TARGETS[id];
        return {
          id: `target:${id}`,
          label: `選擇${target.name}`,
          detail: `${target.blurb} 戰爭：控制 ${target.controlNeed} / 威力 ${target.powerNeed} / 情報 ${target.warIntelNeed}；外交：影響 ${target.influenceNeed} / 善意 ${target.goodwillNeed} / 情報 ${target.pactIntelNeed}。`,
          tags: ['target'],
        };
      });
    case 'field':
      return fieldActions(state);
    case 'workshop':
      return workshopActions(state);
    case 'discovery':
      return [
        {
          id: 'respond:flee',
          label: '逃跑：選路線並閃躲',
          detail: '先選排水溝、麵包屑小徑或衣擺暗縫，再在拍數內輸入閃躲方向。',
          risk: 'medium',
        },
        {
          id: 'respond:fight',
          label: '迎戰：抓準時機並連擊',
          detail: '五拍內削弱追兵。游標越接近出手點，傷害越高；連續命中會累積 combo。',
          risk: 'high',
        },
      ];
    case 'escape': {
      const escapeRun = state.escape;
      if (!escapeRun) return [];
      if (!escapeRun.route) {
        return (Object.keys(ROUTES) as RouteId[]).map((id) => ({
          id: `route:${id}`,
          label: ROUTES[id].name,
          detail: ROUTES[id].detail,
          risk: id === 'crumbs' ? 'medium' : 'low',
        }));
      }
      return (['left', 'right', 'duck'] as DodgeId[]).map((id) => ({
        id: `dodge:${id}`,
        label: id === 'left' ? '向左閃' : id === 'right' ? '向右閃' : '伏低躲過',
        detail: `這一拍輸入方向；剩 ${escapeRun.beatsLeft} 拍。看上方危險預告再選。`,
        risk: 'high',
      }));
    }
    case 'combat': {
      const combat = state.combat;
      if (!combat) return [];
      return [
        {
          id: 'strike:quick',
          label: '快擊',
          detail: '距離出手點越近越痛；命中後 combo +1。完全失手會挨反擊。',
          risk: 'medium',
          tags: ['timing', 'combo'],
        },
        {
          id: 'strike:heavy',
          label: '重擊',
          detail: `需要時機值 ≥2；加入武器威力 ${state.weapon?.power ?? 0} 與雙倍 combo，失手會挨反擊。`,
          risk: 'high',
          tags: ['timing', 'combo'],
        },
        {
          id: 'brace',
          label: '守住這一拍',
          detail: '保留 combo，不造成傷害，也不受這拍反擊；仍會消耗一回合。',
          risk: 'low',
        },
      ];
    }
    case 'captured': {
      const capture = state.capture;
      if (!capture) return [];
      const actions: ActionView[] = [];
      if (state.goodwill >= 4 && state.intel >= 2) {
        actions.push({
          id: 'rescue:signal',
          label: '向認識的大人發出求救訊號',
          detail: '消耗善意 2、情報 1，必定獲救。',
          risk: 'low',
        });
      }
      if (state.coins >= 4) {
        actions.push({
          id: 'rescue:ransom',
          label: '請獄卒收下銀幣',
          detail: '花 4 銀幣換自由，必定成功。',
          risk: 'low',
        });
      }
      actions.push({
        id: 'rescue:wait',
        label: '留下記號等待救援',
        detail: `本次救援率 ${rescueChance(state)}%；失敗會用掉一次機會。剩 ${capture.attemptsLeft} 次。`,
        risk: 'high',
      });
      return actions;
    }
    case 'ended':
      return [];
  }
}

function pushNote(state: TinyState, text: string): void {
  state.notes.push(text);
  if (state.notes.length > MAX_NOTES) state.notes.splice(0, state.notes.length - MAX_NOTES);
}

function scoreOf(state: TinyState): number {
  const base: Record<EndingId, number> = {
    war: 80,
    pact: 90,
    mirror: 120,
    deadline: 0,
    captive: 0,
    starvation: 0,
    aborted: 0,
  };
  return Math.max(
    0,
    (state.ending ? base[state.ending] : 0) +
      state.control * 2 +
      state.influence * 2 +
      state.goodwill +
      state.intel +
      state.food +
      state.coins +
      state.rescues * 3 -
      state.captures * 4,
  );
}

function finish(state: TinyState, ending: EndingId): void {
  state.ending = ending;
  state.outcome =
    ending === 'war' || ending === 'pact' || ending === 'mirror'
      ? 'won'
      : ending === 'aborted'
        ? 'aborted'
        : 'lost';
  state.cause = ENDING_CAUSES[ending];
  state.phase = 'ended';
  state.draft = null;
  state.escape = null;
  state.combat = null;
  state.capture = null;
  state.score = scoreOf(state);
}

function checkYear(state: TinyState): void {
  if (state.outcome === 'ongoing' && state.phase === 'field' && state.week > YEAR_WEEKS) {
    finish(state, 'deadline');
  }
}

function consumeWeek(state: TinyState, log: string[]): void {
  state.week += 1;
  const starving = state.food <= 0;
  if (!starving) {
    state.food -= 1;
  } else {
    state.health -= 1;
    log.push('行囊已空，這週只能挨餓：體力 -1。');
  }
  normalize(state);
  if (starving && state.health <= 0) finish(state, 'starvation');
}

function applyDailyEvent(state: TinyState, rng: Rng, log: string[], events: GameEvent[]): void {
  const event = rng.pick(DAILY_EVENTS);
  state.food += event.food ?? 0;
  state.coins += event.coins ?? 0;
  state.parts += event.parts ?? 0;
  state.intel += event.intel ?? 0;
  state.goodwill += event.goodwill ?? 0;
  state.suspicion += event.suspicion ?? 0;
  state.health += event.health ?? 0;
  if (event.kind === 'good') state.goodEvents += 1;
  else state.badEvents += 1;
  normalize(state);
  log.push(`${event.kind === 'good' ? '日常·好人' : '日常·壞蛋'}：${event.text}`);
  events.push({ type: 'daily', id: event.id, kind: event.kind, text: event.text });
}

function rollDetection(
  state: TinyState,
  actionId: string,
  chance: number,
  rng: Rng,
  log: string[],
  events: GameEvent[],
): boolean {
  const roll = rng.int(1, 100);
  const detected = roll <= chance;
  events.push({ type: 'detection', action: actionId, chance, roll, detected });
  if (detected) {
    state.phase = 'discovery';
    log.push(`發現判定 ${roll} ≤ ${chance}：大人彎下腰，正好看見璿芃。選逃跑或迎戰！`);
  } else if (RISK_ACTIONS.has(actionId)) {
    log.push(`發現判定 ${roll} > ${chance}：這一次仍沒有人看清你。`);
  }
  return detected;
}

function enterCapture(state: TinyState, log: string[], events: GameEvent[], reason: string): void {
  state.phase = 'captured';
  state.escape = null;
  state.combat = null;
  state.capture = { attemptsLeft: 3 };
  state.captures += 1;
  log.push(`${reason} 璿芃被關進玻璃罐，還有三次求救機會。`);
  events.push({ type: 'captured', reason, attemptsLeft: 3 });
}

function beginEscape(state: TinyState): void {
  state.phase = 'escape';
  state.escape = { route: null, beatsLeft: 0, progress: 0, need: 0, captured: 0, hazard: 0 };
}

function beginCombat(state: TinyState, rng: Rng): void {
  state.phase = 'combat';
  state.combat = {
    round: 1,
    maxRounds: 5,
    cursor: rng.int(0, 5),
    opening: rng.int(1, 4),
    enemy: targetOf(state).defense + 4,
    combo: 0,
    guarded: false,
  };
}

function chooseRoute(state: TinyState, route: RouteId, rng: Rng): ActionResult {
  const escapeRun = state.escape;
  if (!escapeRun) throw new Error('Escape state is missing');
  const selected = ROUTES[route];
  escapeRun.route = route;
  escapeRun.beatsLeft = selected.beats;
  escapeRun.need = Math.max(1, selected.need - ((state.weapon?.agility ?? 0) >= 3 ? 1 : 0));
  escapeRun.hazard = rng.int(0, HAZARDS.length - 1);
  return {
    log: [
      `璿芃鑽進${selected.name}。機動 ${state.weapon?.agility ?? 0}，需要閃對 ${escapeRun.need} 次。`,
      HAZARDS[escapeRun.hazard]!.text,
    ],
    events: [{ type: 'escape-route', route, need: escapeRun.need, beatsLeft: escapeRun.beatsLeft }],
  };
}

function returnFromActionPhase(state: TinyState): void {
  state.phase = 'field';
  state.escape = null;
  state.combat = null;
  checkYear(state);
}

function dodge(state: TinyState, input: DodgeId, rng: Rng): ActionResult {
  const escapeRun = state.escape;
  if (!escapeRun?.route) throw new Error('Escape route is missing');
  const hazard = HAZARDS[escapeRun.hazard]!;
  const success = input === hazard.safe;
  if (success) escapeRun.progress += 1;
  else escapeRun.captured += 1;
  escapeRun.beatsLeft -= 1;
  const log = [
    success
      ? `閃對了：${input}。進度 ${escapeRun.progress}/${escapeRun.need}，剩 ${escapeRun.beatsLeft} 拍。`
      : `閃錯了：應對是 ${hazard.safe}，不是 ${input}。捕獲值 ${escapeRun.captured}/2。`,
  ];
  const events: GameEvent[] = [
    {
      type: 'escape-beat',
      input,
      expected: hazard.safe,
      success,
      progress: escapeRun.progress,
      need: escapeRun.need,
      beatsLeft: escapeRun.beatsLeft,
      captured: escapeRun.captured,
    },
  ];
  if (escapeRun.captured >= 2) {
    enterCapture(state, log, events, '第二次閃躲失誤，手指在面前合攏。');
  } else if (escapeRun.beatsLeft <= 0) {
    if (escapeRun.progress >= escapeRun.need) {
      const route = escapeRun.route;
      if (route === 'crumbs') state.food -= 2;
      state.suspicion -= route === 'hem' ? 3 : route === 'drain' ? 2 : 0;
      state.escapes += 1;
      normalize(state);
      log.push(`最後一拍穿過${ROUTES[route].name}，大人的手只抓到一把灰。`);
      events.push({ type: 'escaped', route });
      returnFromActionPhase(state);
    } else {
      enterCapture(state, log, events, '路線已到盡頭，但閃躲次數不夠。');
    }
  } else {
    escapeRun.hazard = rng.int(0, HAZARDS.length - 1);
    log.push(HAZARDS[escapeRun.hazard]!.text);
  }
  return { log, events };
}

function combatRound(state: TinyState, actionId: string, rng: Rng): ActionResult {
  const combat = state.combat;
  if (!combat) throw new Error('Combat state is missing');
  const log: string[] = [];
  const events: GameEvent[] = [];
  if (actionId === 'brace') {
    combat.guarded = true;
    log.push(`璿芃縮進線軸後，combo 保持 ${combat.combo}，這一拍不會被反擊。`);
    events.push({ type: 'combat-brace', combo: combat.combo, round: combat.round });
  } else {
    const distance = Math.abs(combat.cursor - combat.opening);
    const accuracy = Math.max(0, 3 - distance);
    const power = state.weapon?.power ?? 0;
    const heavy = actionId === 'strike:heavy';
    const hit = heavy ? accuracy >= 2 : accuracy > 0;
    const damage = hit
      ? heavy
        ? power + accuracy + combat.combo * 2
        : 1 + accuracy + combat.combo
      : 0;
    if (damage > 0) {
      combat.enemy -= damage;
      combat.combo = accuracy >= 2 ? combat.combo + 1 : 0;
      log.push(
        `${heavy ? '重擊' : '快擊'}命中：時機 ${accuracy}，傷害 ${damage}，追兵耐性剩 ${Math.max(0, combat.enemy)}，combo ${combat.combo}。`,
      );
      if (power <= 1) log.push('小武器落在拇指上，說穿了還是像抓癢；這次靠的是時機與連擊。');
    } else {
      combat.combo = 0;
      log.push(
        heavy
          ? '重擊太早或太晚，大人只覺得被抓癢。combo 歸零。'
          : '快擊落空，連武器碰沒碰到都沒人確定。combo 歸零。',
      );
    }
    const counter = damage === 0 || accuracy <= 1;
    if (counter && !combat.guarded) {
      state.health -= 1;
      log.push(`追兵反手一掃：體力 -1，剩 ${Math.max(0, state.health)}。`);
    }
    normalize(state);
    events.push({
      type: 'combat-strike',
      action: actionId,
      cursor: combat.cursor,
      opening: combat.opening,
      accuracy,
      damage,
      combo: combat.combo,
      enemy: Math.max(0, combat.enemy),
      health: state.health,
    });
  }
  if (combat.enemy <= 0) {
    state.fightsWon += 1;
    state.control += 2;
    state.suspicion += 1;
    normalize(state);
    log.push('追兵終於縮回手。璿芃贏得這次迎戰，控制 +2、暴露 +1。');
    events.push({ type: 'combat-won', control: state.control });
    returnFromActionPhase(state);
    return { log, events };
  }
  if (state.health <= 0) {
    enterCapture(state, log, events, '反擊耗盡了體力。');
    return { log, events };
  }
  if (combat.round >= combat.maxRounds) {
    enterCapture(state, log, events, '五拍已盡，追兵仍然站在面前。');
    return { log, events };
  }
  combat.round += 1;
  combat.cursor = (combat.cursor + 2) % 6;
  combat.opening = rng.int(1, 4);
  combat.guarded = false;
  log.push(`下一拍：游標 ${combat.cursor}，出手點 ${combat.opening}。`);
  return { log, events };
}

function rescue(state: TinyState, method: 'signal' | 'ransom' | 'wait', log: string[]): void {
  if (method === 'signal') {
    state.goodwill -= 2;
    state.intel -= 1;
    log.push('曾受幫助的大人認出了記號，悄悄把玻璃罐打開。');
  } else if (method === 'ransom') {
    state.coins -= 4;
    log.push('獄卒數著四枚銀幣，故意轉過頭去。');
  } else {
    log.push('牆縫裡伸來一根細線，小人國的同伴終於找到了玻璃罐。');
  }
  state.rescues += 1;
  state.suspicion = 1;
  state.food = Math.max(state.food, 2);
  state.health = Math.max(state.health, 1);
  state.capture = null;
  state.phase = 'field';
  normalize(state);
  checkYear(state);
}

function waitForRescue(state: TinyState, rng: Rng): ActionResult {
  const capture = state.capture;
  if (!capture) throw new Error('Capture state is missing');
  const chance = rescueChance(state);
  const roll = rng.int(1, 100);
  const success = roll <= chance;
  capture.attemptsLeft -= 1;
  const log = [`救援判定 ${roll} ${success ? '≤' : '>'} ${chance}。`];
  const events: GameEvent[] = [
    { type: 'rescue', chance, roll, success, attemptsLeft: capture.attemptsLeft },
  ];
  if (success) rescue(state, 'wait', log);
  else if (capture.attemptsLeft <= 0) finish(state, 'captive');
  else log.push(`玻璃罐外沒有腳步聲，還剩 ${capture.attemptsLeft} 次機會。`);
  return { log, events };
}

function fieldAction(state: TinyState, actionId: string, rng: Rng): ActionResult {
  const target = targetOf(state);
  const log: string[] = [];
  const events: GameEvent[] = [];
  const chance = detectionChance(state, actionId);
  if (actionId === 'buy') {
    state.coins -= 3;
    state.food += 7;
    state.suspicion -= 2;
    log.push('璿芃回本國買進七份糧草，再沿舊路潛回大人國。');
  } else if (actionId === 'steal') {
    state.food += 5;
    state.parts += 1;
    state.suspicion += 1;
    state.steals += 1;
    log.push('大人只看見剩下的麵包又少了一角，嘟囔著：「又是老鼠。」');
  } else if (actionId === 'scout') {
    state.intel += 2;
    state.parts += 1;
    state.suspicion += 1;
    log.push('璿芃把巡邏空隙與倉房位置畫進小地圖：情報 +2、部件 +1。');
  } else if (actionId === 'aid') {
    state.goodwill += 2;
    log.push('你替大人找回滾進縫裡的鈕釦。他沒看清你的臉，只記得這份善意。');
  } else if (actionId === 'earn') {
    state.coins += 3;
    log.push('小人國最擅長修補大人看不見的小地方：銀幣 +3。');
  } else if (actionId === 'rest') {
    state.health += 1;
    state.suspicion -= 2;
    log.push('牆縫很窄，卻夠安全。體力 +1、暴露 -2。');
  } else if (actionId === 'raid' && state.weapon) {
    const gain = Math.max(1, state.weapon.power - target.defense + 2);
    state.control += gain;
    state.suspicion += 2;
    state.raids += 1;
    log.push(
      state.weapon.power <= 1
        ? `${state.weapon.name}彈在城門上，守衛只覺得被抓癢；控制仍 +${gain}，但這不是重炮。`
        : `${state.weapon.name}切開了${target.name}的一處補給結：控制 +${gain}。`,
    );
  } else if (actionId === 'negotiate') {
    const gain =
      2 +
      (state.intel >= target.pactIntelNeed ? 1 : 0) +
      (state.goodwill >= target.goodwillNeed ? 1 : 0);
    state.coins -= 1;
    state.influence += gain;
    state.negotiations += 1;
    log.push(`盟約草案被放上巨大的桌面：影響 +${gain}。`);
  } else {
    throw new Error(`Unsupported field action: ${actionId}`);
  }
  normalize(state);
  events.push({ type: 'field', action: actionId, week: state.week, chance });
  if (DAILY_ACTIONS.has(actionId)) applyDailyEvent(state, rng, log, events);
  consumeWeek(state, log);
  if (state.outcome !== 'ongoing') return { log, events };
  if (state.health <= 0) {
    enterCapture(state, log, events, '日常事故耗盡了體力。');
    return { log, events };
  }
  if (chance > 0) rollDetection(state, actionId, chance, rng, log, events);
  checkYear(state);
  return { log, events };
}

export function act(state: TinyState, actionId: string): ActionResult {
  if (!actionsOf(state).some((action) => action.id === actionId)) {
    throw illegalAction(
      `現在不能執行「${actionId}」。`,
      `合法動作：${actionsOf(state)
        .map((action) => action.id)
        .join(', ')}`,
    );
  }
  const rng = Rng.restore(state.rng);
  let result: ActionResult;
  if (actionId.startsWith('target:')) {
    const target = actionId.slice('target:'.length) as TargetId;
    state.target = target;
    state.phase = 'field';
    pushNote(state, `目標：${TARGETS[target].name}。${TARGETS[target].blurb}`);
    result = {
      log: [`國王的地圖釘在${TARGETS[target].name}。一年從這一週開始。`],
      events: [{ type: 'target', target }],
    };
  } else if (actionId === 'design') {
    state.phase = 'workshop';
    state.draft = { frame: null, head: null, drive: null };
    result = { log: ['攤開設計圖：先選骨架，再選頭部與驅動。'] };
  } else if (actionId.startsWith('part:') && actionId !== 'part:reset') {
    const [, slot, id] = actionId.split(':');
    if (!state.draft) throw new Error('Draft is missing');
    if (slot === 'frame') state.draft.frame = id as FrameId;
    else if (slot === 'head') state.draft.head = id as HeadId;
    else if (slot === 'drive') state.draft.drive = id as DriveId;
    else throw new Error(`Unknown part slot: ${slot}`);
    result = { log: [`設計圖寫上${id}。選好三個部件後就能組裝。`] };
  } else if (actionId === 'part:reset') {
    state.draft = { frame: null, head: null, drive: null };
    result = { log: ['把設計圖擦乾淨，重新選三個部件。'] };
  } else if (actionId === 'cancel') {
    state.phase = 'field';
    state.draft = null;
    result = { log: ['設計圖先收起來，這一週還沒有花掉。'] };
  } else if (actionId === 'assemble') {
    if (!state.draft) throw new Error('Draft is missing');
    const weapon = weaponFromDraft(state.draft);
    const cost = draftCost(state.draft);
    state.parts -= cost;
    state.weapon = weapon;
    state.forged += 1;
    state.phase = 'field';
    state.draft = null;
    const log = [
      `組裝完成：${weapon.name}。威力 ${weapon.power}、噪音 ${weapon.noise}、機動 ${weapon.agility}。`,
      weapon.power <= 1
        ? '對大人國而言，這可能真的只是一次抓癢。'
        : '這件小東西至少有機會讓大人認真眨眼。',
    ];
    consumeWeek(state, log);
    checkYear(state);
    result = { log, events: [{ type: 'weapon', ...weapon, cost }] };
  } else if (actionId === 'respond:flee') {
    beginEscape(state);
    result = { log: ['璿芃轉身就跑。先選一條路線，之後每個 dodge 都是一拍。'] };
  } else if (actionId === 'respond:fight') {
    beginCombat(state, rng);
    result = {
      log: [
        `璿芃舉起武器迎戰。游標 ${state.combat!.cursor}，最佳出手點 ${state.combat!.opening}。`,
      ],
    };
  } else if (actionId.startsWith('route:')) {
    result = chooseRoute(state, actionId.slice('route:'.length) as RouteId, rng);
  } else if (actionId.startsWith('dodge:')) {
    result = dodge(state, actionId.slice('dodge:'.length) as DodgeId, rng);
  } else if (actionId === 'strike:quick' || actionId === 'strike:heavy' || actionId === 'brace') {
    result = combatRound(state, actionId, rng);
  } else if (actionId === 'rescue:signal' || actionId === 'rescue:ransom') {
    const method = actionId === 'rescue:signal' ? 'signal' : 'ransom';
    const log: string[] = [];
    rescue(state, method, log);
    result = { log, events: [{ type: 'rescued', method }] };
  } else if (actionId === 'rescue:wait') {
    result = waitForRescue(state, rng);
  } else if (actionId === 'conquer:war' || actionId === 'conquer:pact') {
    const ending =
      state.target === 'mirror' ? 'mirror' : actionId === 'conquer:war' ? 'war' : 'pact';
    finish(state, ending);
    result = {
      log: [ENDING_CAUSES[ending]],
      events: [{ type: 'ending', ending, target: state.target }],
    };
  } else {
    result = fieldAction(state, actionId, rng);
  }
  state.rng = rng.serialize();
  normalize(state);
  state.timeline.push(
    `W${Math.min(state.week, YEAR_WEEKS)} ${actionId} → ${result.log[0] ?? '完成'}`,
  );
  if (state.timeline.length > MAX_TIMELINE) {
    state.timeline.splice(0, state.timeline.length - MAX_TIMELINE);
  }
  return result;
}

function gateLines(state: TinyState): string[] {
  if (!state.target) return ['先選一個大人國；戰爭或外交都可以完成召令。'];
  const target = targetOf(state);
  return [
    `${canWar(state) ? '可攻陷' : '備戰'} 戰爭：控制 ${state.control}/${target.controlNeed}，武器威力 ${state.weapon?.power ?? 0}/${target.powerNeed}，情報 ${state.intel}/${target.warIntelNeed}。`,
    `${canPact(state) ? '可簽約' : '交涉'} 外交：影響 ${state.influence}/${target.influenceNeed}，善意 ${state.goodwill}/${target.goodwillNeed}，情報 ${state.intel}/${target.pactIntelNeed}。`,
    `國王期限：第 ${Math.min(state.week, YEAR_WEEKS)}/${YEAR_WEEKS} 週。第五十二週行動後仍未攻陷就是逾期。`,
  ];
}

function weaponLines(state: TinyState): string[] {
  const lines = [
    state.weapon
      ? `${state.weapon.name}：威力 ${state.weapon.power}、噪音 ${state.weapon.noise}、機動 ${state.weapon.agility}。`
      : '尚未組裝武器。沒有武器也能迎戰，但重擊少了威力。',
  ];
  if (state.phase === 'workshop' && state.draft) {
    lines.push(
      `設計圖：骨架 ${state.draft.frame ?? '未選'} / 頭部 ${state.draft.head ?? '未選'} / 驅動 ${state.draft.drive ?? '未選'}；目前成本 ${draftCost(state.draft)} 部件，持有 ${state.parts}。`,
    );
  }
  return lines;
}

function phaseSection(state: TinyState): StatusSection | null {
  if (state.phase === 'discovery') {
    return {
      title: '被發現了',
      lines: ['巨大的影子停在頭頂。逃跑進入路線/閃躲，迎戰進入時機/連擊。'],
    };
  }
  if (state.phase === 'escape' && state.escape) {
    const escapeRun = state.escape;
    return {
      title: '逃跑拍數',
      lines: [
        escapeRun.route
          ? `${ROUTES[escapeRun.route].name} · 剩 ${escapeRun.beatsLeft} 拍 · 閃對 ${escapeRun.progress}/${escapeRun.need} · 捕獲值 ${escapeRun.captured}/2。`
          : '先選路線。每條路線的拍數與所需閃躲次數不同。',
        escapeRun.route ? HAZARDS[escapeRun.hazard]!.text : '武器機動 ≥3 時，路線所需成功數 -1。',
      ],
    };
  }
  if (state.phase === 'combat' && state.combat) {
    const combat = state.combat;
    return {
      title: '迎戰時機',
      lines: [
        `回合 ${combat.round}/${combat.maxRounds} · 游標 ${combat.cursor} · 出手點 ${combat.opening} · 距離 ${Math.abs(combat.cursor - combat.opening)}。`,
        `追兵耐性 ${combat.enemy} · combo ${combat.combo} · 體力 ${state.health}。時機值 = max(0, 3-距離)。`,
      ],
    };
  }
  if (state.phase === 'captured' && state.capture) {
    return {
      title: '玻璃罐',
      lines: [
        `剩 ${state.capture.attemptsLeft} 次救援機會。善意 ≥4 且情報 ≥2 可發訊號；銀幣 ≥4 可贖身。`,
        `等待救援每次判定 ${rescueChance(state)}%；三次都失敗就進入俘虜結局。`,
      ],
    };
  }
  return null;
}

export function statusOf(state: TinyState): {
  headline: string;
  metrics: Metric[];
  sections: StatusSection[];
  outcome: Outcome;
  turn: number;
  phase: string;
} {
  const targetName = state.target ? targetOf(state).name : '尚未選擇大人國';
  const headline =
    state.outcome !== 'ongoing'
      ? `${ENDING_NAMES[state.ending ?? 'aborted']} · ${state.cause}`
      : state.phase === 'briefing'
        ? '國王召令 · 璿芃必須在一年內攻陷一個大人國'
        : state.phase === 'field'
          ? `第 ${Math.min(state.week, YEAR_WEEKS)}/${YEAR_WEEKS} 週 · ${targetName} · 糧草 ${state.food} · 暴露 ${state.suspicion}`
          : state.phase === 'workshop'
            ? `工坊 · ${targetName} · 部件 ${state.parts}`
            : state.phase === 'escape' && state.escape
              ? `逃跑 · 剩 ${state.escape.beatsLeft} 拍 · ${targetName}`
              : state.phase === 'combat' && state.combat
                ? `迎戰 · 第 ${state.combat.round}/${state.combat.maxRounds} 拍 · combo ${state.combat.combo}`
                : state.phase === 'captured'
                  ? `被俘 · 還有 ${state.capture?.attemptsLeft ?? 0} 次救援機會`
                  : `被發現 · ${targetName} · 逃跑或迎戰`;
  const sections: StatusSection[] = [
    { title: '王令', lines: gateLines(state) },
    { title: '武器設計', lines: weaponLines(state) },
  ];
  const special = phaseSection(state);
  if (special) sections.push(special);
  if (state.notes.length > 0) sections.push({ title: '記下', lines: [...state.notes] });
  if (state.outcome !== 'ongoing') sections.push({ title: '結算', lines: [state.cause] });
  return {
    headline,
    metrics: [
      { label: '糧草', value: state.food, hint: '每週消耗 1' },
      { label: '銀幣', value: state.coins },
      { label: '部件', value: state.parts },
      { label: '情報', value: state.intel },
      { label: '善意', value: state.goodwill },
      { label: '暴露', value: state.suspicion, hint: '提高發現率' },
      { label: '體力', value: state.health },
      { label: '控制', value: state.control },
      { label: '影響', value: state.influence },
    ],
    sections,
    outcome: state.outcome,
    turn: state.week - 1,
    phase: PHASE_NAMES[state.phase],
  };
}

function lessonsOf(state: TinyState): string[] {
  const lessons: string[] = [];
  if (state.ending === 'deadline') {
    lessons.push('這局把週數花在補給或準備上，卻沒有在第五十二週前主動攻陷。下局要更早對照門檻。');
  }
  if (state.steals >= 3) {
    lessons.push(`這局偷了 ${state.steals} 次物資；暴露每次 +1，也會抬高之後的發現率。`);
  }
  if (state.weapon && state.weapon.power <= 1) {
    lessons.push(
      `「${state.weapon.name}」威力只有 ${state.weapon.power}；對大人更像抓癢，重擊很依賴時機與連擊。`,
    );
  }
  if (state.captures > 0) {
    lessons.push(
      `這局被俘 ${state.captures} 次、獲救 ${state.rescues} 次。善意/情報或銀幣能把一次失誤留在局中，而不是直接結束。`,
    );
  }
  if (state.ending === 'mirror') {
    lessons.push('鏡面國的攻陷會翻到自家王城；這是本局目標帶來的反轉，不是所有種子的固定結局。');
  }
  if (state.goodEvents + state.badEvents > 0) {
    lessons.push(
      `這局遇到 ${state.goodEvents} 次好人、${state.badEvents} 次壞蛋；日常事件由 seed 決定，換局要重新驗證。`,
    );
  }
  if (lessons.length === 0) {
    lessons.push('這局沒有單一崩點。把目標、武器部件、補給與攻陷路線一起比較，再調整下局順序。');
  }
  return lessons.slice(0, 5);
}

export function recapOf(state: TinyState): RecapView {
  const name = state.outcome === 'ongoing' ? '進行中' : ENDING_NAMES[state.ending ?? 'aborted'];
  return {
    title: `璿芃攻略 · ${name}`,
    outcome: state.outcome,
    cause: state.cause || '國王召令還在桌上，這一年尚未收尾。',
    metrics: [
      { label: '結局', value: name },
      { label: '得分', value: state.ending ? state.score : scoreOf(state) },
      { label: '目標', value: state.target ? targetOf(state).name : '未選' },
      { label: '週', value: Math.min(state.week, YEAR_WEEKS) },
      { label: '控制', value: state.control },
      { label: '影響', value: state.influence },
      { label: '被俘', value: state.captures },
      { label: '獲救', value: state.rescues },
    ],
    timeline: state.timeline.slice(-10),
    lessons: lessonsOf(state),
    memoryPrompt:
      '把這局的目標、戰爭或外交路線、補給選擇、武器部件、暴露與關鍵判定寫進你自己的 memory。這些只是這個 seed 與這套打法的觀察；換目標、難度或種子要重新驗證，不要把一次好運寫成永遠成立的攻略。',
  };
}

export function abort(state: TinyState): void {
  finish(state, 'aborted');
}
