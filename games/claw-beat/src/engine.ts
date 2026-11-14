/**
 * 虾节 / Claw Beat.
 *
 * A four-beat phrase that stays with you. Each round you may rewrite two
 * beats, then commit them against the next four visible intents. Two jabs is
 * the cap, jabs cannot touch, and one beat has to rest.
 */

import {
  type ActionResult,
  type ActionView,
  illegalAction,
  Rng,
  type StatusView,
} from '@gameclaw/gamekit';
import { CHUNKS, INTENT_LABEL, type Intent, MOVE_LABEL, MOVES, type Move } from './content';

export type Outcome = 'ongoing' | 'won' | 'lost' | 'aborted';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Exchange {
  you: number;
  them: number;
  kind: 'hit' | 'riposte' | 'block' | 'hurt' | 'heal' | 'clash' | 'whiff';
}

export interface BeatState {
  seed: number;
  difficulty: Difficulty;
  rng: number[];
  phrase: Move[];
  tape: Intent[];
  edits: number;
  editCap: number;
  commits: number;
  commitCap: number;
  breath: number;
  breathCap: number;
  enemy: number;
  hits: number;
  ripostes: number;
  blocks: number;
  taken: number;
  timeline: string[];
  notes: string[];
  outcome: Outcome;
  cause: string;
}

function difficultyOf(value: string | undefined): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

function rules(difficulty: Difficulty): {
  enemy: number;
  editCap: number;
  commitCap: number;
  breath: number;
} {
  if (difficulty === 'easy') return { enemy: 10, editCap: 3, commitCap: 6, breath: 10 };
  if (difficulty === 'hard') return { enemy: 14, editCap: 2, commitCap: 5, breath: 8 };
  return { enemy: 12, editCap: 2, commitCap: 5, breath: 10 };
}

export function exchange(you: Move, them: Intent): Exchange {
  if (you === 'jab' && them === 'strike') return { you: 1, them: 1, kind: 'clash' };
  if (you === 'jab' && them === 'grab') return { you: 2, them: 0, kind: 'hurt' };
  if (you === 'jab' && them === 'feint') return { you: 1, them: 1, kind: 'clash' };
  if (you === 'jab' && them === 'rest') return { you: 0, them: 2, kind: 'hit' };
  if (you === 'guard' && them === 'strike') return { you: 0, them: 0, kind: 'block' };
  if (you === 'guard' && them === 'grab') return { you: 1, them: 0, kind: 'hurt' };
  if (you === 'slip' && them === 'strike') return { you: 0, them: 2, kind: 'riposte' };
  if (you === 'slip' && them === 'grab') return { you: 0, them: 1, kind: 'hit' };
  if (you === 'slip' && them === 'feint') return { you: 2, them: 0, kind: 'hurt' };
  if (you === 'rest' && them === 'strike') return { you: 2, them: 0, kind: 'hurt' };
  if (you === 'rest' && them === 'grab') return { you: 1, them: 0, kind: 'hurt' };
  if (you === 'rest' && (them === 'feint' || them === 'rest'))
    return { you: -1, them: 0, kind: 'heal' };
  return { you: 0, them: 0, kind: 'whiff' };
}

export function legalPhrase(phrase: readonly Move[]): boolean {
  let jabs = 0;
  let rests = 0;
  for (let i = 0; i < phrase.length; i += 1) {
    if (phrase[i] === 'jab') jabs += 1;
    if (phrase[i] === 'rest') rests += 1;
    if (phrase[i] === 'jab' && phrase[i + 1] === 'jab') return false;
  }
  return jabs <= 2 && rests >= 1;
}

export function phraseText(phrase: readonly Move[]): string {
  return phrase.map((move) => MOVE_LABEL[move]).join(' · ');
}

export function tapeText(tape: readonly Intent[]): string {
  return tape.map((intent) => INTENT_LABEL[intent]).join(' · ');
}

interface CommitPreview {
  dmgYou: number;
  dmgThem: number;
  ripostes: number;
  blocks: number;
  hits: number;
  breath: number;
  enemy: number;
  ko: boolean;
  down: boolean;
}

export function previewCommit(
  state: BeatState,
  phrase: readonly Move[] = state.phrase,
): CommitPreview {
  let breath = state.breath;
  let enemy = state.enemy;
  let dmgYou = 0;
  let dmgThem = 0;
  let ripostes = 0;
  let blocks = 0;
  let hits = 0;
  for (let i = 0; i < 4; i += 1) {
    const beat = exchange(phrase[i] ?? 'rest', state.tape[i] ?? 'rest');
    if (beat.you < 0) breath = Math.min(state.breathCap, breath + 1);
    else {
      breath -= beat.you;
      dmgYou += beat.you;
    }
    enemy -= beat.them;
    dmgThem += beat.them;
    if (beat.kind === 'riposte') ripostes += 1;
    if (beat.kind === 'block') blocks += 1;
    if (beat.kind === 'hit' || beat.kind === 'clash') hits += 1;
    if (breath <= 0 || enemy <= 0) break;
  }
  return {
    dmgYou,
    dmgThem,
    ripostes,
    blocks,
    hits,
    breath,
    enemy,
    ko: enemy <= 0,
    down: breath <= 0,
  };
}

function commitValue(preview: CommitPreview): number {
  if (preview.down && !preview.ko) return -1_000 + preview.dmgThem;
  if (preview.ko) return 800 + preview.breath;
  return preview.dmgThem * 3 - preview.dmgYou * 5 + preview.ripostes * 4 + preview.breath;
}

export function suggest(state: BeatState): string {
  const editsLeft = state.editCap - state.edits;
  let bestId = 'commit';
  let bestValue = -Infinity;
  const visit = (phrase: Move[], edits: number, first: string): void => {
    const value = commitValue(previewCommit(state, phrase));
    if (value > bestValue) {
      bestValue = value;
      bestId = first;
    }
    if (edits <= 0) return;
    for (let i = 0; i < 4; i += 1) {
      for (const move of MOVES) {
        if (move === phrase[i]) continue;
        const next = phrase.slice();
        next[i] = move;
        if (!legalPhrase(next)) continue;
        visit(next, edits - 1, first === 'commit' ? `set:${i}:${move}` : first);
      }
    }
  };
  visit(state.phrase.slice(), editsLeft, 'commit');
  return bestId;
}

function drawChunk(rng: Rng): Intent[] {
  return [...(rng.pick(CHUNKS) ?? CHUNKS[0])];
}

export function createRun(options: { seed: number; difficulty?: string }): BeatState {
  const difficulty = difficultyOf(options.difficulty);
  const rng = Rng.fromSeed(options.seed);
  const rule = rules(difficulty);
  const tape = [...drawChunk(rng), ...drawChunk(rng)];
  return {
    seed: options.seed >>> 0,
    difficulty,
    rng: rng.serialize(),
    phrase: ['rest', 'rest', 'rest', 'rest'],
    tape,
    edits: 0,
    editCap: rule.editCap,
    commits: 0,
    commitCap: rule.commitCap,
    breath: rule.breath,
    breathCap: rule.breath,
    enemy: rule.enemy,
    hits: 0,
    ripostes: 0,
    blocks: 0,
    taken: 0,
    timeline: [],
    notes: [],
    outcome: 'ongoing',
    cause: '比试进行中',
  };
}

export function statusOf(state: BeatState): StatusView {
  const ended = state.outcome !== 'ongoing';
  return {
    headline: ended
      ? `比试结束 · ${state.cause}`
      : `第 ${state.commits + 1}/${state.commitCap} 轮 · 气息 ${state.breath} · 对方 ${state.enemy}`,
    phase: ended ? '收尾' : '对句',
    outcome: state.outcome,
    turn: state.commits,
    metrics: [
      { label: '气息', value: `${state.breath}/${state.breathCap}` },
      { label: '对方', value: state.enemy },
      { label: '可改', value: Math.max(0, state.editCap - state.edits) },
      { label: '命中', value: state.hits },
      { label: '拆招', value: state.ripostes },
      { label: '格挡', value: state.blocks },
      { label: '受击', value: state.taken },
    ],
    sections: [
      {
        title: '短语',
        lines: [phraseText(state.phrase), `还可改 ${Math.max(0, state.editCap - state.edits)} 拍`],
      },
      {
        title: '来势',
        lines: [tapeText(state.tape.slice(0, 4)), tapeText(state.tape.slice(4, 8))],
      },
      {
        title: '句式',
        lines: ['点最多两下，且不能相邻。', '至少歇一拍。', '闪吃劈，架吃劈，点吃停，虚吃闪。'],
      },
      { title: '记录', lines: state.notes.length ? [...state.notes] : ['短语还是四下歇'] },
    ],
  };
}

export function actionsOf(state: BeatState): ActionView[] {
  if (state.outcome !== 'ongoing') return [];
  const preview = previewCommit(state);
  const actions: ActionView[] = [
    {
      id: 'commit',
      label: '交锋',
      detail: `交锋预览：你受 ${preview.dmgYou}，对方掉 ${preview.dmgThem}，拆招 ${preview.ripostes}，格挡 ${preview.blocks}。`,
      risk: preview.down ? 'high' : preview.ko ? 'low' : 'medium',
    },
  ];
  if (state.edits < state.editCap) {
    for (let i = 0; i < 4; i += 1) {
      for (const move of MOVES) {
        if (move === state.phrase[i]) continue;
        const next = state.phrase.slice();
        next[i] = move;
        if (!legalPhrase(next)) continue;
        actions.push({
          id: `set:${i}:${move}`,
          label: `第 ${i + 1} 拍改${MOVE_LABEL[move]}`,
          detail: `这一拍现在是${MOVE_LABEL[state.phrase[i] ?? 'rest']}。改完短语：${phraseText(next)}。`,
          risk: 'low',
        });
      }
    }
  }
  const pick = suggest(state);
  const first = actions.find((action) => action.id === pick);
  const rest = actions.filter((action) => action.id !== pick);
  return first ? [first, ...rest] : actions;
}

export function act(state: BeatState, actionId: string): ActionResult {
  if (state.outcome !== 'ongoing') throw illegalAction('这一局已经收尾。', '用 recap 看结算。');
  if (!actionsOf(state).some((action) => action.id === actionId)) {
    throw illegalAction('这句改不了。', '点不能相邻，也不能超过两下，而且要留一个歇。');
  }
  const rng = Rng.restore(state.rng);
  if (actionId.startsWith('set:')) {
    const parts = actionId.split(':');
    const slot = Number(parts[1]);
    const move = parts[2] as Move;
    state.phrase[slot] = move;
    state.edits += 1;
    const line = `第 ${slot + 1} 拍改成${MOVE_LABEL[move]}。短语 ${phraseText(state.phrase)}。`;
    state.notes.unshift(line);
    state.notes.splice(3);
    state.rng = rng.serialize();
    return { log: [line], events: [{ type: 'set', slot, move }] };
  }

  const preview = previewCommit(state);
  state.breath = Math.max(0, preview.breath);
  state.enemy = Math.max(0, preview.enemy);
  state.hits += preview.hits;
  state.ripostes += preview.ripostes;
  state.blocks += preview.blocks;
  state.taken += preview.dmgYou;
  state.commits += 1;
  state.edits = 0;
  state.tape = state.tape.slice(4);
  state.tape.push(...drawChunk(rng));
  const line = `交锋结束。你受 ${preview.dmgYou}，对方掉 ${preview.dmgThem}，气息 ${state.breath}，对方剩余 ${state.enemy}。`;
  state.notes.unshift(line);
  state.notes.splice(3);
  state.timeline.push(line);
  const log = [line];
  if (state.enemy <= 0) {
    state.outcome = 'won';
    state.cause = '击倒';
  } else if (state.breath <= 0) {
    state.outcome = 'lost';
    state.cause = '气息尽了';
  } else if (state.commits >= state.commitCap) {
    state.outcome = 'lost';
    state.cause = '轮次用尽';
  }
  if (state.outcome !== 'ongoing') log.push(`比试结束：${state.cause}`);
  state.rng = rng.serialize();
  return {
    log,
    events: [
      {
        type: 'commit',
        dmgYou: preview.dmgYou,
        dmgThem: preview.dmgThem,
        ripostes: preview.ripostes,
        blocks: preview.blocks,
      },
    ],
  };
}

export function abort(state: BeatState): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = 'aborted';
  state.cause = '已中止';
}

export function ladderScore(state: BeatState): number {
  if (state.outcome === 'ongoing' || state.outcome === 'aborted') return 0;
  const body =
    state.hits * 12 + state.ripostes * 30 + state.blocks * 10 + state.breath * 8 - state.taken * 28;
  const raw =
    state.outcome === 'won' ? body + 420 : Math.floor((state.hits * 12 + state.ripostes * 30) / 3);
  return Math.max(0, Math.min(999_999, raw));
}

function endingWord(outcome: Outcome): string {
  if (outcome === 'won') return '胜利';
  if (outcome === 'lost') return '失败';
  if (outcome === 'aborted') return '已中止';
  return '进行中';
}

export function recapOf(state: BeatState) {
  return {
    title: '虾节 · 对句结算',
    outcome: state.outcome,
    cause: state.cause,
    metrics: [
      { label: '命中', value: state.hits },
      { label: '拆招', value: state.ripostes },
      { label: '格挡', value: state.blocks },
      { label: '受击', value: state.taken },
      { label: '气息', value: state.breath },
      { label: '结局', value: endingWord(state.outcome) },
    ],
    timeline: state.timeline.length ? [...state.timeline] : ['还没有交锋'],
    lessons: [
      `本局命中 ${state.hits}，拆招 ${state.ripostes}，格挡 ${state.blocks}，受击 ${state.taken}。`,
      `每轮只能改 ${state.editCap} 拍。短语要留一个歇，点不能相邻，点也不能超过两下。`,
      '闪吃劈，架也吃劈。点吃停。虚专吃闪。没有一拍能回答全部来势。',
    ],
    memoryPrompt:
      '把本局短语最后的四拍、受击和拆招写进你自己的 memory。来势每轮会换。只把这些当作这个 seed 的观察，换种子后重新验证。',
    score: ladderScore(state),
  };
}
