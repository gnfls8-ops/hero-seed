// 턴 진행 상태 기계. 모든 함수는 순수 함수이며 같은 입력에 같은 결과를 낸다.
import { BALANCE } from '../data/balance';
import { ACTIVITY_BY_ID } from '../data/activities';
import type {
  ActivityId,
  ActivityLine,
  Dir,
  FinaleChoice,
  GameState,
  MonthRecord,
  Phase,
  Settings,
  Stats,
  Traits,
} from './types';
import { addStats, addTraits, canAddToSchedule, scheduleDelta, teachingDelta, clamp } from './rules';
import { eventForTurn, mapForTurn, MAP_BY_ID, choiceById } from './registry';
import { act, createSnapshot, finishRecord, resetSnapshot, stepDir } from './rescue';
import { dominantTeaching } from './ending';

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = { muted: false, textSpeed: 'normal', touchControls: 'auto' };

export type Action =
  | { type: 'newGame'; runId: string; settings?: Settings }
  | { type: 'next'; from: Phase; turn: number }
  | { type: 'setSlot'; slot: number; activity: ActivityId | null }
  | { type: 'confirmSchedule'; turn: number }
  | { type: 'startMinigame'; turn: number }
  | { type: 'mgDir'; dir: Dir }
  | { type: 'mgAct' }
  | { type: 'mgReset' }
  | { type: 'mgFinish'; turn: number }
  | { type: 'choose'; eventId: string; choiceId: string }
  | { type: 'finaleChoose'; choice: FinaleChoice }
  | { type: 'setSettings'; settings: Partial<Settings> }
  | { type: 'setMood'; mood: GameState['mood'] };

export function isMinigameTurn(turn: number): boolean {
  return BALANCE.minigameTurns.includes(turn);
}

function monthRecord(turn: number, stats: Stats, traits: Traits): MonthRecord {
  return { turn, schedule: [], lines: [], statsBefore: { ...stats }, traitsBefore: { ...traits }, statsAfterActivities: { ...stats } };
}

export function createInitialState(runId: string, settings: Settings = DEFAULT_SETTINGS): GameState {
  const stats = { ...BALANCE.initialStats };
  const traits = { ...BALANCE.initialTraits };
  return {
    schemaVersion: SCHEMA_VERSION,
    runId,
    turn: 1,
    phase: 'intro',
    stats,
    traits,
    schedule: Array.from({ length: BALANCE.slotsPerMonth }, () => null),
    months: [monthRecord(1, stats, traits)],
    eventHistory: [],
    memories: [],
    minigameSnapshot: null,
    minigameResults: [],
    pendingResult: null,
    appliedEffectIds: [],
    finaleChoice: null,
    mood: 'neutral',
    devModified: false,
    settings: { ...settings },
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 활동 결과 문구 선택: 결정적이며 같은 회차 안에서는 반복을 피한다. */
export function pickActivityLines(state: GameState, schedule: ActivityId[]): ActivityLine[] {
  const used = new Set(state.months.flatMap((m) => m.lines.map((l) => l.lineId)));
  const lean = dominantTeaching(state.eventHistory);
  const out: ActivityLine[] = [];
  schedule.forEach((activity, slot) => {
    const def = ACTIVITY_BY_ID[activity];
    const h = hashStr(`${state.runId}:${state.turn}:${slot}`);
    const leanLine = lean ? def.lines.find((l) => l.lean === lean && !used.has(l.id)) : undefined;
    let chosen = leanLine && (h % 3 === 0 || slot === 0) ? leanLine : undefined;
    if (!chosen) {
      const neutral = def.lines.filter((l) => !l.lean);
      const start = h % neutral.length;
      for (let i = 0; i < neutral.length; i++) {
        const cand = neutral[(start + i) % neutral.length]!;
        if (!used.has(cand.id)) {
          chosen = cand;
          break;
        }
      }
      chosen ??= neutral[start]!;
    }
    used.add(chosen.id);
    out.push({ slot, activity, lineId: chosen.id });
  });
  return out;
}

function applied(state: GameState, id: string): boolean {
  return state.appliedEffectIds.includes(id);
}

function withApplied(state: GameState, id: string): GameState {
  return { ...state, appliedEffectIds: [...state.appliedEffectIds, id] };
}

function updateMonth(state: GameState, fn: (m: MonthRecord) => MonthRecord): MonthRecord[] {
  return state.months.map((m) => (m.turn === state.turn ? fn(m) : m));
}

export function currentMonth(state: GameState): MonthRecord | undefined {
  return state.months.find((m) => m.turn === state.turn);
}

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'newGame':
      return createInitialState(action.runId, action.settings ?? state.settings);

    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.settings } };

    case 'setMood':
      return state.mood === action.mood ? state : { ...state, mood: action.mood };

    case 'setSlot': {
      if (state.phase !== 'schedule') return state;
      if (action.slot < 0 || action.slot >= state.schedule.length) return state;
      const schedule = [...state.schedule];
      if (action.activity !== null) {
        const without = schedule.map((s, i) => (i === action.slot ? null : s));
        if (!canAddToSchedule(without, action.activity)) return state;
      }
      schedule[action.slot] = action.activity;
      return { ...state, schedule };
    }

    case 'confirmSchedule': {
      if (state.phase !== 'schedule' || action.turn !== state.turn) return state;
      if (state.schedule.some((s) => s === null)) return state;
      const id = `t${state.turn}:activities`;
      if (applied(state, id)) return state;
      const schedule = state.schedule as ActivityId[];
      const delta = scheduleDelta(schedule);
      const lines = pickActivityLines(state, schedule);
      const stats = addStats(state.stats, delta);
      const next = withApplied(state, id);
      return {
        ...next,
        stats,
        phase: 'activity',
        pendingResult: { kind: 'activity', turn: state.turn, lines, delta },
        months: updateMonth(next, (m) => ({ ...m, schedule: [...schedule], lines, statsAfterActivities: { ...stats } })),
      };
    }

    case 'startMinigame': {
      if (state.phase !== 'minigameBrief' || action.turn !== state.turn) return state;
      const map = mapForTurn(state.turn);
      if (!map) return { ...state, phase: 'event', pendingResult: null };
      return { ...state, phase: 'minigame', minigameSnapshot: createSnapshot(map, state.stats) };
    }

    case 'mgDir':
    case 'mgAct':
    case 'mgReset': {
      if (state.phase !== 'minigame' || !state.minigameSnapshot) return state;
      const map = MAP_BY_ID[state.minigameSnapshot.mapId];
      if (!map) return state;
      const s = state.minigameSnapshot;
      const ns = action.type === 'mgDir' ? stepDir(s, map, action.dir) : action.type === 'mgAct' ? act(s, map) : resetSnapshot(s, map);
      return ns === s ? state : { ...state, minigameSnapshot: ns };
    }

    case 'mgFinish': {
      if (state.phase !== 'minigame' || !state.minigameSnapshot || action.turn !== state.turn) return state;
      const map = MAP_BY_ID[state.minigameSnapshot.mapId];
      if (!map) return state;
      const id = `t${state.turn}:minigame`;
      if (applied(state, id)) return state;
      const record = finishRecord(state.minigameSnapshot, map);
      const next = withApplied(state, id);
      return {
        ...next,
        stats: addStats(state.stats, { control: record.controlReward }),
        minigameResults: [...state.minigameResults.filter((m) => m.turn !== record.turn), record],
        minigameSnapshot: null,
        pendingResult: { kind: 'minigame', record },
        phase: 'minigameResult',
      };
    }

    case 'choose': {
      if (state.phase !== 'event') return state;
      const ev = eventForTurn(state.turn);
      if (!ev || ev.id !== action.eventId) return state;
      const choice = ev.choices.find((c) => c.id === action.choiceId);
      if (!choice) return state;
      const id = `t${state.turn}:event:${ev.id}`;
      if (applied(state, id) || state.eventHistory.some((r) => r.eventId === ev.id)) return state;
      const next = withApplied(state, id);
      return {
        ...next,
        traits: addTraits(state.traits, teachingDelta(choice.teaching)),
        stats: addStats(state.stats, { trust: choice.trust }),
        eventHistory: [
          ...state.eventHistory,
          { eventId: ev.id, turn: state.turn, choiceId: choice.id, teaching: choice.teaching, trustDelta: choice.trust },
        ],
        memories: [...state.memories, { turn: state.turn, eventId: ev.id, choiceId: choice.id, tags: [...choice.memoryTags] }],
        pendingResult: { kind: 'event', eventId: ev.id, choiceId: choice.id },
        mood: choice.mood,
        phase: 'reaction',
      };
    }

    case 'finaleChoose': {
      if (state.phase !== 'finale' || state.finaleChoice !== null) return state;
      const id = 'finale:choice';
      if (applied(state, id)) return state;
      return {
        ...withApplied(state, id),
        finaleChoice: action.choice,
        pendingResult: { kind: 'finale', choice: action.choice },
        phase: 'finaleReaction',
      };
    }

    case 'next':
      return advance(state, action.from, action.turn);

    default:
      return state;
  }
}

function advance(state: GameState, from: Phase, turn: number): GameState {
  // 이중 입력 방지: 화면이 본 단계와 실제 단계가 다르면 무시한다.
  if (from !== state.phase || turn !== state.turn) return state;
  switch (state.phase) {
    case 'intro':
      return { ...state, phase: 'status' };
    case 'status':
      return { ...state, phase: 'schedule' };
    case 'activity':
      return { ...state, phase: isMinigameTurn(state.turn) && mapForTurn(state.turn) ? 'minigameBrief' : 'event', pendingResult: null };
    case 'minigameResult':
      return { ...state, phase: 'event', pendingResult: null };
    case 'reaction':
      return { ...state, phase: 'summary', pendingResult: null };
    case 'summary': {
      if (state.turn >= BALANCE.totalTurns) return { ...state, phase: 'finaleIntro' };
      const id = `t${state.turn}:advance`;
      if (applied(state, id)) return state;
      const nextTurn = Math.min(BALANCE.totalTurns, state.turn + 1);
      const next = withApplied(state, id);
      return {
        ...next,
        turn: nextTurn,
        phase: 'status',
        schedule: Array.from({ length: BALANCE.slotsPerMonth }, () => null),
        months: [...state.months.filter((m) => m.turn !== nextTurn), monthRecord(nextTurn, state.stats, state.traits)],
      };
    }
    case 'finaleIntro':
      return { ...state, phase: 'finale' };
    case 'finaleReaction':
      return { ...state, phase: 'ending', pendingResult: null };
    default:
      return state;
  }
}

/** 개발용: 수치 직접 변경 (범위 제한 유지) */
export function devPatch(state: GameState, patch: { stats?: Partial<Stats>; traits?: Partial<Traits> }): GameState {
  const stats = { ...state.stats };
  const traits = { ...state.traits };
  for (const [k, v] of Object.entries(patch.stats ?? {})) stats[k as keyof Stats] = clamp(Number(v));
  for (const [k, v] of Object.entries(patch.traits ?? {})) traits[k as keyof Traits] = clamp(Number(v));
  return { ...state, stats, traits, devModified: true };
}

/** 개발용: 특정 턴의 사건 또는 미니게임으로 이동. 기존 진행이 바뀐다. */
export function devJump(state: GameState, turn: number, target: 'event' | 'minigame'): GameState {
  const t = Math.max(1, Math.min(BALANCE.totalTurns, Math.round(turn)));
  const ev = eventForTurn(t);
  const history = state.eventHistory.filter((r) => r.turn < t);
  const months = state.months.filter((m) => m.turn < t);
  months.push({ ...monthRecord(t, state.stats, state.traits) });
  const base: GameState = {
    ...state,
    turn: t,
    eventHistory: history,
    memories: state.memories.filter((m) => m.turn < t),
    minigameResults: state.minigameResults.filter((m) => m.turn < t),
    appliedEffectIds: state.appliedEffectIds.filter((id) => {
      const m = /^t(\d+):/.exec(id);
      return m ? Number(m[1]) < t : false;
    }),
    finaleChoice: null,
    months,
    schedule: Array.from({ length: BALANCE.slotsPerMonth }, () => null),
    pendingResult: null,
    minigameSnapshot: null,
    devModified: true,
  };
  if (target === 'minigame') {
    const map = mapForTurn(t);
    if (!map) return { ...base, phase: ev ? 'event' : 'summary' };
    return { ...base, phase: 'minigameBrief' };
  }
  return { ...base, phase: 'event' };
}

export function choiceOf(state: GameState, eventId: string) {
  const r = state.eventHistory.find((h) => h.eventId === eventId);
  return r ? choiceById(r.eventId, r.choiceId) : undefined;
}
