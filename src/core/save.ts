// 저장·복원·가져오기 검증. 브라우저 저장소는 주입받는 어댑터로 다룬다.
import { BALANCE } from '../data/balance';
import { ACTIVITY_BY_ID } from '../data/activities';
import { EVENT_BY_ID, MAP_BY_ID } from './registry';
import { SCHEMA_VERSION } from './game';
import { initialDebris } from './rescue';
import type {
  ActivityLine,
  EventRecord,
  GameState,
  MinigameRecord,
  MinigameSnapshot,
  MonthRecord,
  PendingResult,
  Settings,
  Stats,
  Traits,
} from './types';
import { ACTIVITY_IDS, APPEARANCES, DIRS, FINALE_CHOICES, MOODS, PHASES } from './types';

export const SAVE_KEYS = {
  main: 'heroSeed.save.v1',
  backup: 'heroSeed.save.v1.backup',
  settings: 'heroSeed.settings.v1',
} as const;

export const MAX_IMPORT_BYTES = 1024 * 1024;
export const EXPORT_FORMAT = 'hero-seed-save';

export class ValidationError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function fail(msg: string): never {
  throw new ValidationError(msg);
}
function obj(v: unknown, where: string): Obj {
  if (!isObj(v)) fail(`${where}: 객체가 아님`);
  return v;
}
function arr(v: unknown, where: string, max: number): unknown[] {
  if (!Array.isArray(v)) fail(`${where}: 배열이 아님`);
  if (v.length > max) fail(`${where}: 항목이 너무 많음`);
  return v;
}
function int(v: unknown, where: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) fail(`${where}: ${min}~${max} 정수가 아님`);
  return v;
}
function bool(v: unknown, where: string): boolean {
  if (typeof v !== 'boolean') fail(`${where}: 참/거짓 값이 아님`);
  return v;
}
function oneOf<T extends string>(v: unknown, list: readonly T[], where: string): T {
  if (typeof v !== 'string' || !(list as readonly string[]).includes(v)) fail(`${where}: 허용되지 않은 값`);
  return v as T;
}
function str(v: unknown, where: string, max: number, pattern?: RegExp): string {
  if (typeof v !== 'string' || v.length > max) fail(`${where}: 문자열이 아니거나 너무 김`);
  if (pattern && !pattern.test(v)) fail(`${where}: 형식 오류`);
  return v;
}

const R = BALANCE.statRange;
function stats(v: unknown, where: string): Stats {
  const o = obj(v, where);
  return {
    power: int(o.power, `${where}.power`, R.min, R.max),
    control: int(o.control, `${where}.control`, R.min, R.max),
    trust: int(o.trust, `${where}.trust`, R.min, R.max),
  };
}
function traits(v: unknown, where: string): Traits {
  const o = obj(v, where);
  return {
    empathy: int(o.empathy, `${where}.empathy`, R.min, R.max),
    principle: int(o.principle, `${where}.principle`, R.min, R.max),
    distrust: int(o.distrust, `${where}.distrust`, R.min, R.max),
    domination: int(o.domination, `${where}.domination`, R.min, R.max),
  };
}
function settings(v: unknown): Settings {
  const o = obj(v, 'settings');
  return {
    muted: bool(o.muted, 'settings.muted'),
    textSpeed: oneOf(o.textSpeed, ['normal', 'fast', 'instant'] as const, 'settings.textSpeed'),
    touchControls: oneOf(o.touchControls, ['auto', 'on', 'off'] as const, 'settings.touchControls'),
    // 모습 선택 이전 저장 파일에는 없으므로 기본값(남자아이)
    appearance: o.appearance === undefined ? 'boy' : oneOf(o.appearance, APPEARANCES, 'settings.appearance'),
  };
}
const T = BALANCE.totalTurns;

function line(v: unknown, where: string): ActivityLine {
  const o = obj(v, where);
  const activity = oneOf(o.activity, ACTIVITY_IDS, `${where}.activity`);
  const lineId = str(o.lineId, `${where}.lineId`, 32);
  if (!ACTIVITY_BY_ID[activity].lines.some((l) => l.id === lineId)) fail(`${where}: 알 수 없는 문구 ID`);
  return { slot: int(o.slot, `${where}.slot`, 0, BALANCE.slotsPerMonth - 1), activity, lineId };
}

function month(v: unknown, where: string): MonthRecord {
  const o = obj(v, where);
  return {
    turn: int(o.turn, `${where}.turn`, 1, T),
    schedule: arr(o.schedule, `${where}.schedule`, BALANCE.slotsPerMonth).map((a, i) => oneOf(a, ACTIVITY_IDS, `${where}.schedule[${i}]`)),
    lines: arr(o.lines, `${where}.lines`, BALANCE.slotsPerMonth).map((l, i) => line(l, `${where}.lines[${i}]`)),
    statsBefore: stats(o.statsBefore, `${where}.statsBefore`),
    traitsBefore: traits(o.traitsBefore, `${where}.traitsBefore`),
    statsAfterActivities: stats(o.statsAfterActivities, `${where}.statsAfterActivities`),
  };
}

function eventRecord(v: unknown, where: string): EventRecord {
  const o = obj(v, where);
  const eventId = str(o.eventId, `${where}.eventId`, 64);
  const ev = EVENT_BY_ID[eventId] ?? fail(`${where}: 알 수 없는 사건 ID`);
  const choiceId = str(o.choiceId, `${where}.choiceId`, 64);
  const ch = ev.choices.find((c) => c.id === choiceId) ?? fail(`${where}: 알 수 없는 선택지 ID`);
  const turn = int(o.turn, `${where}.turn`, 1, T);
  if (turn !== ev.turn) fail(`${where}: 사건 턴 불일치`);
  if (o.teaching !== ch.teaching) fail(`${where}: 가르침 유형 불일치`);
  if (o.trustDelta !== ch.trust) fail(`${where}: 신뢰 변화 불일치`);
  return { eventId, turn, choiceId, teaching: ch.teaching, trustDelta: ch.trust };
}

function mgRecord(v: unknown, where: string): MinigameRecord {
  const o = obj(v, where);
  const mapId = str(o.mapId, `${where}.mapId`, 64);
  const map = MAP_BY_ID[mapId] ?? fail(`${where}: 알 수 없는 맵`);
  const ids = map.targets.map((t) => t.id);
  const order = arr(o.order, `${where}.order`, ids.length).map((x, i) => oneOf(x, ids, `${where}.order[${i}]`));
  if (new Set(order).size !== order.length) fail(`${where}: 구조 순서 중복`);
  const people = map.targets.filter((t) => t.kind !== 'evidence');
  const rescued = int(o.rescued, `${where}.rescued`, 0, people.length);
  if (rescued !== order.filter((id) => people.some((p) => p.id === id)).length) fail(`${where}: 구조 수 불일치`);
  const hasEv = map.targets.some((t) => t.kind === 'evidence');
  const evidence = o.evidence === null ? null : bool(o.evidence, `${where}.evidence`);
  if (hasEv !== (evidence !== null)) fail(`${where}: 증거 값 불일치`);
  const apMax = int(o.apMax, `${where}.apMax`, 1, 99);
  return {
    turn: int(o.turn, `${where}.turn`, 1, T),
    mapId,
    rescued,
    totalPeople: int(o.totalPeople, `${where}.totalPeople`, people.length, people.length),
    evidence,
    order,
    apLeft: int(o.apLeft, `${where}.apLeft`, 0, apMax),
    apMax,
    tier: oneOf(o.tier, ['success', 'partial', 'none'] as const, `${where}.tier`),
    controlReward: int(o.controlReward, `${where}.controlReward`, 0, BALANCE.rescue.controlRewardMax),
  };
}

function snapshot(v: unknown): MinigameSnapshot | null {
  if (v === null) return null;
  const o = obj(v, 'minigameSnapshot');
  const mapId = str(o.mapId, 'snapshot.mapId', 64);
  const map = MAP_BY_ID[mapId] ?? fail('snapshot: 알 수 없는 맵');
  const N = BALANCE.rescue.gridSize;
  const apMax = int(o.apMax, 'snapshot.apMax', 1, 99);
  const allowedDebris = new Set(initialDebris(map));
  const debris = arr(o.debris, 'snapshot.debris', allowedDebris.size).map((d, i) => {
    const s = str(d, `snapshot.debris[${i}]`, 8, /^\d,\d$/);
    if (!allowedDebris.has(s)) fail('snapshot: 맵에 없는 잔해');
    return s;
  });
  const tlist = arr(o.targets, 'snapshot.targets', map.targets.length);
  if (tlist.length !== map.targets.length) fail('snapshot: 대상 수 불일치');
  const targets = tlist.map((t, i) => {
    const to = obj(t, `snapshot.targets[${i}]`);
    const def = map.targets[i]!;
    if (to.id !== def.id || to.kind !== def.kind || to.x !== def.x || to.y !== def.y) fail('snapshot: 대상 정보 불일치');
    return { id: def.id, kind: def.kind, x: def.x, y: def.y, rescued: bool(to.rescued, 'snapshot.rescued') };
  });
  const ids = map.targets.map((t) => t.id);
  const order = arr(o.order, 'snapshot.order', ids.length).map((x, i) => oneOf(x, ids, `snapshot.order[${i}]`));
  if (new Set(order).size !== order.length) fail('snapshot: 순서 중복');
  for (const t of targets) if (t.rescued !== order.includes(t.id)) fail('snapshot: 구조 상태와 순서 불일치');
  const x = int(o.x, 'snapshot.x', 0, N - 1);
  const y = int(o.y, 'snapshot.y', 0, N - 1);
  if ((map.rows[y]?.[x] ?? '#') === '#') fail('snapshot: 벽 위의 위치');
  let lastEvent: MinigameSnapshot['lastEvent'] = null;
  if (o.lastEvent !== null) {
    const le = obj(o.lastEvent, 'snapshot.lastEvent');
    lastEvent = {
      kind: oneOf(le.kind, ['move', 'bump', 'clear', 'rescue', 'denied', 'none', 'reset'] as const, 'lastEvent.kind'),
      x: int(le.x, 'lastEvent.x', -1, N),
      y: int(le.y, 'lastEvent.y', -1, N),
      seq: int(le.seq, 'lastEvent.seq', 0, 1e9),
    };
  }
  return {
    mapId,
    turn: int(o.turn, 'snapshot.turn', map.turn, map.turn),
    x,
    y,
    facing: oneOf(o.facing, DIRS, 'snapshot.facing'),
    ap: int(o.ap, 'snapshot.ap', 0, apMax),
    apMax,
    debrisCost: int(o.debrisCost, 'snapshot.debrisCost', 1, 9),
    debris,
    targets,
    order,
    actions: int(o.actions, 'snapshot.actions', 0, 1e6),
    resets: int(o.resets, 'snapshot.resets', 0, 1e6),
    message: o.message === null ? null : str(o.message, 'snapshot.message', 200),
    lastEvent,
  };
}

function pending(v: unknown): PendingResult {
  if (v === null) return null;
  const o = obj(v, 'pendingResult');
  const kind = oneOf(o.kind, ['activity', 'minigame', 'event', 'finale'] as const, 'pendingResult.kind');
  switch (kind) {
    case 'activity': {
      const d = obj(o.delta, 'pending.delta');
      const delta: Partial<Stats> = {};
      for (const k of ['power', 'control', 'trust'] as const) if (d[k] !== undefined) delta[k] = int(d[k], `delta.${k}`, -100, 100);
      return {
        kind,
        turn: int(o.turn, 'pending.turn', 1, T),
        lines: arr(o.lines, 'pending.lines', BALANCE.slotsPerMonth).map((l, i) => line(l, `pending.lines[${i}]`)),
        delta,
      };
    }
    case 'minigame':
      return { kind, record: mgRecord(o.record, 'pending.record') };
    case 'event': {
      const eventId = str(o.eventId, 'pending.eventId', 64);
      const ev = EVENT_BY_ID[eventId] ?? fail('pending: 알 수 없는 사건');
      const choiceId = str(o.choiceId, 'pending.choiceId', 64);
      if (!ev.choices.some((c) => c.id === choiceId)) fail('pending: 알 수 없는 선택지');
      return { kind, eventId, choiceId };
    }
    case 'finale':
      return { kind, choice: oneOf(o.choice, FINALE_CHOICES, 'pending.choice') };
  }
}

const APPLIED_RE = /^(t[1-6]:(activities|minigame|advance|event:[a-z0-9-]{1,48})|finale:choice)$/;

/** 저장 데이터 검증. 통과하면 알려진 필드만으로 새로 만든 상태를 돌려준다. */
export function validateState(input: unknown): GameState {
  const o = obj(input, 'state');
  if (o.schemaVersion !== SCHEMA_VERSION) fail(`알 수 없는 저장 버전 (${String(o.schemaVersion)})`);
  const eventHistory = arr(o.eventHistory, 'eventHistory', T).map((r, i) => eventRecord(r, `eventHistory[${i}]`));
  if (new Set(eventHistory.map((r) => r.eventId)).size !== eventHistory.length) fail('eventHistory: 같은 사건이 두 번 기록됨');
  const turn = int(o.turn, 'turn', 1, T);
  const phase = oneOf(o.phase, PHASES, 'phase');
  const minigameSnapshot = snapshot(o.minigameSnapshot);
  if (phase === 'minigame' && !minigameSnapshot) fail('미니게임 단계인데 스냅샷이 없음');
  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    runId: str(o.runId, 'runId', 64, /^[A-Za-z0-9_-]+$/),
    turn,
    phase,
    stats: stats(o.stats, 'stats'),
    traits: traits(o.traits, 'traits'),
    schedule: (() => {
      const s = arr(o.schedule, 'schedule', BALANCE.slotsPerMonth);
      if (s.length !== BALANCE.slotsPerMonth) fail('schedule: 칸 수 불일치');
      return s.map((a, i) => (a === null ? null : oneOf(a, ACTIVITY_IDS, `schedule[${i}]`)));
    })(),
    months: arr(o.months, 'months', T).map((m, i) => month(m, `months[${i}]`)),
    eventHistory,
    memories: (() => {
      const list = arr(o.memories, 'memories', T);
      if (list.length !== eventHistory.length) fail('memories: 사건 기록과 개수 불일치');
      list.forEach((m, i) => {
        const mo = obj(m, `memories[${i}]`);
        const r = eventHistory[i]!;
        if (mo.eventId !== r.eventId || mo.choiceId !== r.choiceId || mo.turn !== r.turn) fail(`memories[${i}]: 사건 기록과 불일치`);
        arr(mo.tags, `memories[${i}].tags`, 8).forEach((t, j) => str(t, `memories[${i}].tags[${j}]`, 32));
      });
      return [];
    })(),
    minigameSnapshot,
    minigameResults: arr(o.minigameResults, 'minigameResults', BALANCE.minigameTurns.length).map((m, i) => mgRecord(m, `minigameResults[${i}]`)),
    pendingResult: pending(o.pendingResult),
    appliedEffectIds: arr(o.appliedEffectIds, 'appliedEffectIds', 64).map((x, i) => str(x, `appliedEffectIds[${i}]`, 64, APPLIED_RE)),
    finaleChoice: o.finaleChoice === null ? null : oneOf(o.finaleChoice, FINALE_CHOICES, 'finaleChoice'),
    mood: oneOf(o.mood, MOODS, 'mood'),
    devModified: bool(o.devModified, 'devModified'),
    settings: settings(o.settings),
  };
  // 기억은 사건 기록에서 다시 만든다 (가져온 문자열을 그대로 신뢰하지 않음)
  state.memories = eventHistory.map((r) => ({
    turn: r.turn,
    eventId: r.eventId,
    choiceId: r.choiceId,
    tags: [...(EVENT_BY_ID[r.eventId]!.choices.find((c) => c.id === r.choiceId)!.memoryTags)],
  }));
  if (state.appliedEffectIds.length !== new Set(state.appliedEffectIds).size) fail('appliedEffectIds: 중복');
  for (const r of eventHistory) if (r.turn > turn) fail('eventHistory: 현재 턴 이후 기록');
  return state;
}

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function parseSave(json: string): GameState {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new ValidationError('JSON 형식이 아닙니다');
  }
  return validateState(data);
}

// ---------------- 내보내기 / 가져오기 ----------------

export function buildExport(state: GameState, now: Date = new Date()): string {
  return JSON.stringify({ format: EXPORT_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), state }, null, 2);
}

export function parseImport(text: string, byteSize: number = new Blob([text]).size): GameState {
  if (byteSize > MAX_IMPORT_BYTES) throw new ValidationError('파일이 1MB를 넘습니다');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ValidationError('JSON 형식이 아닙니다');
  }
  if (!isObj(data) || data.format !== EXPORT_FORMAT) throw new ValidationError('히어로의 씨앗 저장 파일이 아닙니다');
  if (data.schemaVersion !== SCHEMA_VERSION) throw new ValidationError(`지원하지 않는 저장 버전입니다 (${String(data.schemaVersion)})`);
  return validateState(data.state);
}

// ---------------- 로컬 저장소 ----------------

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; state: GameState }
  | { status: 'corrupt'; error: string; backup: GameState | null };

export class SaveStore {
  available: boolean;
  private lastGood: string | null = null;

  constructor(private storage: StorageLike | null) {
    this.available = storage !== null;
  }

  load(): LoadResult {
    if (!this.storage) return { status: 'empty' };
    let main: string | null;
    try {
      main = this.storage.getItem(SAVE_KEYS.main);
    } catch {
      this.available = false;
      return { status: 'empty' };
    }
    if (main === null) return { status: 'empty' };
    try {
      const state = parseSave(main);
      this.lastGood = main;
      return { status: 'ok', state };
    } catch (e) {
      return { status: 'corrupt', error: (e as Error).message, backup: this.loadBackup() };
    }
  }

  loadBackup(): GameState | null {
    if (!this.storage) return null;
    try {
      const b = this.storage.getItem(SAVE_KEYS.backup);
      return b === null ? null : parseSave(b);
    } catch {
      return null;
    }
  }

  /** 정상 저장 직전 값을 백업 1개로 유지한다. 실패하면 false (메모리 모드로 계속). */
  save(state: GameState): boolean {
    if (!this.storage) return false;
    const json = serializeState(state);
    if (json === this.lastGood) return true;
    try {
      if (this.lastGood !== null) this.storage.setItem(SAVE_KEYS.backup, this.lastGood);
      this.storage.setItem(SAVE_KEYS.main, json);
      this.lastGood = json;
      this.available = true;
      return true;
    } catch {
      this.available = false;
      return false;
    }
  }

  clear(): void {
    if (!this.storage) return;
    try {
      this.storage.removeItem(SAVE_KEYS.main);
      this.storage.removeItem(SAVE_KEYS.backup);
    } catch {
      /* 무시 */
    }
    this.lastGood = null;
  }

  saveSettings(s: Settings): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(SAVE_KEYS.settings, JSON.stringify(s));
    } catch {
      /* 설정 저장 실패는 진행에 영향 없음 */
    }
  }

  loadSettings(): Settings | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(SAVE_KEYS.settings);
      return raw ? settings(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }
}

export function browserStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const k = '__heroSeed_probe';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}
