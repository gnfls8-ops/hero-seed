// 구조 미니게임의 순수 규칙. 행동 횟수 기반이며 실시간 요소가 없다.
import { BALANCE } from '../data/balance';
import type { Dir, MapDef, MinigameRecord, MinigameSnapshot, MinigameTier, Stats, TargetState } from './types';

const R = BALANCE.rescue;

export const DIR_VEC: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export interface RescueCosts {
  debrisCost: number;
  apMax: number;
  powerBonus: boolean;
  controlBonus: boolean;
}

export function costsFor(stats: Pick<Stats, 'power' | 'control'>): RescueCosts {
  const powerBonus = stats.power >= R.powerThreshold;
  const controlBonus = stats.control >= R.controlBonusThreshold;
  return {
    debrisCost: powerBonus ? R.debrisCostStrong : R.debrisCostWeak,
    apMax: R.baseActionPoints + (controlBonus ? R.controlBonusPoints : 0),
    powerBonus,
    controlBonus,
  };
}

const key = (x: number, y: number) => `${x},${y}`;

export function initialDebris(map: MapDef): string[] {
  const out: string[] = [];
  map.rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === 'x') out.push(key(x, y));
    });
  });
  return out;
}

export function createSnapshot(map: MapDef, stats: Pick<Stats, 'power' | 'control'>, resets = 0): MinigameSnapshot {
  const c = costsFor(stats);
  return {
    mapId: map.id,
    turn: map.turn,
    x: map.start.x,
    y: map.start.y,
    facing: map.start.facing,
    ap: c.apMax,
    apMax: c.apMax,
    debrisCost: c.debrisCost,
    debris: initialDebris(map),
    targets: map.targets.map((t) => ({ id: t.id, kind: t.kind, x: t.x, y: t.y, rescued: false })),
    order: [],
    actions: 0,
    resets,
    message: null,
    lastEvent: null,
  };
}

export function resetSnapshot(s: MinigameSnapshot, map: MapDef): MinigameSnapshot {
  // 맵 시작 시점의 비용 규칙을 유지한 채 처음 상태로 되돌린다.
  return {
    ...s,
    x: map.start.x,
    y: map.start.y,
    facing: map.start.facing,
    ap: s.apMax,
    debris: initialDebris(map),
    targets: map.targets.map((t) => ({ id: t.id, kind: t.kind, x: t.x, y: t.y, rescued: false })),
    order: [],
    actions: 0,
    resets: s.resets + 1,
    message: '맵을 처음 상태로 되돌렸습니다.',
    lastEvent: { kind: 'reset', x: map.start.x, y: map.start.y, seq: (s.lastEvent?.seq ?? 0) + 1 },
  };
}

export function tileAt(map: MapDef, x: number, y: number): string {
  const row = map.rows[y];
  if (!row || x < 0 || x >= row.length) return '#';
  return row[x] ?? '#';
}

function targetAt(s: MinigameSnapshot, x: number, y: number): TargetState | undefined {
  return s.targets.find((t) => !t.rescued && t.x === x && t.y === y);
}

export function isBlocked(map: MapDef, s: MinigameSnapshot, x: number, y: number): boolean {
  if (tileAt(map, x, y) === '#') return true;
  if (s.debris.includes(key(x, y))) return true;
  if (targetAt(s, x, y)) return true;
  return false;
}

export function isFinished(s: MinigameSnapshot): boolean {
  return s.ap <= 0 || s.targets.every((t) => t.rescued);
}

function withEvent(s: MinigameSnapshot, kind: NonNullable<MinigameSnapshot['lastEvent']>['kind'], x: number, y: number) {
  return { kind, x, y, seq: (s.lastEvent?.seq ?? 0) + 1 };
}

/** 방향 입력: 바라보는 방향을 바꾸고, 앞이 비어 있으면 한 칸 이동한다. */
export function stepDir(s: MinigameSnapshot, map: MapDef, dir: Dir): MinigameSnapshot {
  if (isFinished(s)) return s;
  const v = DIR_VEC[dir];
  const nx = s.x + v.dx;
  const ny = s.y + v.dy;
  if (isBlocked(map, s, nx, ny)) {
    if (s.facing === dir && s.lastEvent?.kind === 'bump' && s.message === null) return s;
    return { ...s, facing: dir, message: null, lastEvent: withEvent(s, 'bump', nx, ny) };
  }
  if (s.ap < R.moveCost) {
    return { ...s, facing: dir, message: '행동력이 부족합니다.', lastEvent: withEvent(s, 'denied', s.x, s.y) };
  }
  return {
    ...s,
    x: nx,
    y: ny,
    facing: dir,
    ap: s.ap - R.moveCost,
    actions: s.actions + 1,
    message: null,
    lastEvent: withEvent(s, 'move', nx, ny),
  };
}

/** 행동: 바라보는 칸의 잔해 제거 또는 대상 구조. 대상이 없으면 비용 없음. */
export function act(s: MinigameSnapshot, map: MapDef): MinigameSnapshot {
  if (isFinished(s)) return s;
  const v = DIR_VEC[s.facing];
  const fx = s.x + v.dx;
  const fy = s.y + v.dy;
  const k = key(fx, fy);
  if (s.debris.includes(k)) {
    if (s.ap < s.debrisCost) {
      return { ...s, message: `행동력이 부족합니다. (잔해 제거 ${s.debrisCost} 필요)`, lastEvent: withEvent(s, 'denied', fx, fy) };
    }
    return {
      ...s,
      debris: s.debris.filter((d) => d !== k),
      ap: s.ap - s.debrisCost,
      actions: s.actions + 1,
      message: '염동력으로 잔해를 들어 올려 치웠다.',
      lastEvent: withEvent(s, 'clear', fx, fy),
    };
  }
  const t = targetAt(s, fx, fy);
  if (t) {
    const cost = t.kind === 'evidence' ? R.evidenceCost : R.rescueCost;
    if (s.ap < cost) {
      return { ...s, message: `행동력이 부족합니다. (${cost} 필요)`, lastEvent: withEvent(s, 'denied', fx, fy) };
    }
    const label = map.targets.find((m) => m.id === t.id)?.label ?? t.id;
    return {
      ...s,
      targets: s.targets.map((x) => (x.id === t.id ? { ...x, rescued: true } : x)),
      order: [...s.order, t.id],
      ap: s.ap - cost,
      actions: s.actions + 1,
      message: t.kind === 'evidence' ? `${label}을(를) 확보했다.` : `${label}을(를) 구조했다!`,
      lastEvent: withEvent(s, 'rescue', fx, fy),
    };
  }
  return { ...s, message: '앞에 치울 것도, 구할 대상도 없다.', lastEvent: withEvent(s, 'none', fx, fy) };
}

export function tierFor(rescued: number, total: number): MinigameTier {
  if (rescued <= 0) return 'none';
  if (rescued >= total) return 'success';
  return 'partial';
}

export function finishRecord(s: MinigameSnapshot, map: MapDef): MinigameRecord {
  const people = s.targets.filter((t) => t.kind !== 'evidence');
  const rescued = people.filter((t) => t.rescued).length;
  const ev = s.targets.find((t) => t.kind === 'evidence');
  const reward = Math.min(R.controlRewardMax, rescued * R.controlRewardPerRescue);
  return {
    turn: map.turn,
    mapId: map.id,
    rescued,
    totalPeople: people.length,
    evidence: ev ? ev.rescued : null,
    order: [...s.order],
    apLeft: s.ap,
    apMax: s.apMax,
    tier: tierFor(rescued, people.length),
    controlReward: reward,
  };
}

// ---------------- 경로 비용 계산기 (맵 검증용) ----------------

export interface SolveResult {
  /** 대상 부분집합(비트마스크) → 그 대상들을 모두 처리하는 최소 비용 */
  minCostByMask: Map<number, number>;
  targetIds: string[];
}

/**
 * 다익스트라: 상태 = (위치, 남은 잔해 집합, 처리한 대상 집합).
 * 막힌 칸을 향한 방향 전환은 비용이 없으므로 위치만으로 충분하다.
 */
export function solveMap(map: MapDef, debrisCost: number, order?: string[]): SolveResult {
  const debrisList = initialDebris(map).map((k) => k.split(',').map(Number) as [number, number]);
  const targets = map.targets;
  const W = map.rows[0]!.length;
  const H = map.rows.length;
  const nT = targets.length;
  const nD = debrisList.length;
  const DM = 1 << nD;
  const TM = 1 << nT;
  const idx = (x: number, y: number, dm: number, tm: number) => ((y * W + x) * DM + dm) * TM + tm;
  const dist = new Float64Array(W * H * DM * TM).fill(Infinity);
  const best = new Map<number, number>();
  // 이진 힙 우선순위 큐: [비용, 상태 인덱스]
  const hc: number[] = [];
  const hs: number[] = [];
  const push = (c: number, st: number) => {
    hc.push(c);
    hs.push(st);
    let i = hc.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hc[p]! <= hc[i]!) break;
      [hc[p], hc[i]] = [hc[i]!, hc[p]!];
      [hs[p], hs[i]] = [hs[i]!, hs[p]!];
      i = p;
    }
  };
  const pop = (): [number, number] => {
    const top: [number, number] = [hc[0]!, hs[0]!];
    const lc = hc.pop()!;
    const ls = hs.pop()!;
    if (hc.length) {
      hc[0] = lc;
      hs[0] = ls;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < hc.length && hc[l]! < hc[m]!) m = l;
        if (r < hc.length && hc[r]! < hc[m]!) m = r;
        if (m === i) break;
        [hc[m], hc[i]] = [hc[i]!, hc[m]!];
        [hs[m], hs[i]] = [hs[i]!, hs[m]!];
        i = m;
      }
    }
    return top;
  };
  const allDebris = DM - 1;
  // order가 주어지면 그 순서대로만 처리할 수 있다 (순서 목록에 없는 대상은 자유)
  const orderIdx = (order ?? []).map((id) => targets.findIndex((t) => t.id === id));
  const orderAllows = (ti: number, tm: number) => {
    const pos = orderIdx.indexOf(ti);
    if (pos < 0) return true;
    for (let i = 0; i < pos; i++) if (!(tm & (1 << orderIdx[i]!))) return false;
    return true;
  };
  const debrisAt = new Int32Array(W * H).fill(-1);
  debrisList.forEach(([x, y], i) => (debrisAt[y * W + x] = i));
  const targetAtCell = new Int32Array(W * H).fill(-1);
  targets.forEach((t, i) => (targetAtCell[t.y * W + t.x] = i));
  const wall = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) wall[y * W + x] = tileAt(map, x, y) === '#' ? 1 : 0;
  const s0 = idx(map.start.x, map.start.y, allDebris, 0);
  dist[s0] = 0;
  push(0, s0);
  const dirs = Object.values(DIR_VEC);
  while (hc.length) {
    const [c, st] = pop();
    if (dist[st]! < c) continue;
    const tm = st % TM;
    const dm = Math.floor(st / TM) % DM;
    const cell = Math.floor(st / (TM * DM));
    const x = cell % W;
    const y = Math.floor(cell / W);
    const prev = best.get(tm);
    if (prev === undefined || c < prev) best.set(tm, c);
    const relax = (nc: number, ns: number) => {
      if (nc < dist[ns]!) {
        dist[ns] = nc;
        push(nc, ns);
      }
    };
    for (const d of dirs) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nc = ny * W + nx;
      if (wall[nc]) continue;
      const di = debrisAt[nc]!;
      if (di >= 0 && dm & (1 << di)) {
        relax(c + debrisCost, idx(x, y, dm & ~(1 << di), tm));
        continue;
      }
      const ti = targetAtCell[nc]!;
      if (ti >= 0 && !(tm & (1 << ti))) {
        if (orderAllows(ti, tm)) {
          const cost = targets[ti]!.kind === 'evidence' ? R.evidenceCost : R.rescueCost;
          relax(c + cost, idx(x, y, dm, tm | (1 << ti)));
        }
        continue;
      }
      relax(c + R.moveCost, idx(nx, ny, dm, tm));
    }
  }
  // 상위집합 최소값으로 정리: mask를 "적어도 이 대상들" 의미로
  const minCostByMask = new Map<number, number>();
  const full = (1 << targets.length) - 1;
  for (let m = 0; m <= full; m++) {
    let v = Infinity;
    for (const [tm, c] of best) if ((tm & m) === m && c < v) v = c;
    minCostByMask.set(m, v);
  }
  return { minCostByMask, targetIds: targets.map((t) => t.id) };
}

export function minCostFor(map: MapDef, debrisCost: number, ids: string[], order?: string[]): number {
  const r = solveMap(map, debrisCost, order);
  let mask = 0;
  ids.forEach((id) => {
    const i = r.targetIds.indexOf(id);
    if (i < 0) throw new Error(`unknown target ${id}`);
    mask |= 1 << i;
  });
  return r.minCostByMask.get(mask) ?? Infinity;
}
