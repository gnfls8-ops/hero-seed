// 규칙 검증·개발용 경로 불러오기에 쓰는 결정적 시뮬레이터 (UI 없이 reduce만 사용)
import type { ActivityId, Dir, FinaleChoice, GameState, Teaching } from './types';
import { createInitialState, reduce, type Action } from './game';
import { eventForTurn, MAP_BY_ID } from './registry';

export interface RunPlan {
  runId?: string;
  teachings: Teaching[] | ((turn: number) => Teaching);
  schedule?: (turn: number) => ActivityId[];
  /** 미니게임에서 입력할 명령. 없으면 바로 결과 보기 */
  minigame?: (turn: number) => Array<Dir | 'act'>;
  finale?: FinaleChoice;
  /** 이 단계에 도달하면 멈춤 */
  stopAt?: { turn: number; phase: GameState['phase'] };
}

export const DEFAULT_SCHEDULE: ActivityId[] = ['training', 'school', 'family'];

export function step(state: GameState, a: Action): GameState {
  return reduce(state, a);
}

export function playRun(plan: RunPlan, initial?: GameState): GameState {
  let s = initial ?? createInitialState(plan.runId ?? 'sim');
  const teach = (t: number) => (typeof plan.teachings === 'function' ? plan.teachings(t) : plan.teachings[t - 1]!);
  for (let guard = 0; guard < 400; guard++) {
    if (plan.stopAt && s.turn === plan.stopAt.turn && s.phase === plan.stopAt.phase) return s;
    switch (s.phase) {
      case 'schedule': {
        const sch = plan.schedule?.(s.turn) ?? DEFAULT_SCHEDULE;
        sch.forEach((a, i) => (s = reduce(s, { type: 'setSlot', slot: i, activity: a })));
        s = reduce(s, { type: 'confirmSchedule', turn: s.turn });
        break;
      }
      case 'minigameBrief':
        s = reduce(s, { type: 'startMinigame', turn: s.turn });
        break;
      case 'minigame': {
        for (const cmd of plan.minigame?.(s.turn) ?? []) {
          s = reduce(s, cmd === 'act' ? { type: 'mgAct' } : { type: 'mgDir', dir: cmd });
        }
        s = reduce(s, { type: 'mgFinish', turn: s.turn });
        break;
      }
      case 'event': {
        const ev = eventForTurn(s.turn)!;
        const want = teach(s.turn);
        const ch = ev.choices.find((c) => c.teaching === want)!;
        s = reduce(s, { type: 'choose', eventId: ev.id, choiceId: ch.id });
        break;
      }
      case 'finale':
        s = reduce(s, { type: 'finaleChoose', choice: plan.finale ?? 'trust' });
        break;
      case 'ending':
        return s;
      default:
        s = reduce(s, { type: 'next', from: s.phase, turn: s.turn });
    }
  }
  throw new Error('playRun: 진행이 끝나지 않음');
}

/** 시작점에서 목표 칸 옆까지 이동하는 명령 열 (테스트·개발용 단순 BFS, 잔해는 통과 불가로 취급) */
export function pathTo(mapId: string, from: { x: number; y: number }, to: { x: number; y: number }, openDebris: string[] = []): Dir[] {
  const map = MAP_BY_ID[mapId]!;
  const key = (x: number, y: number) => `${x},${y}`;
  const passable = (x: number, y: number) => {
    const c = map.rows[y]?.[x] ?? '#';
    if (c === '#' || /[DRBCE]/.test(c)) return false;
    if (c === 'x' && !openDebris.includes(key(x, y))) return false;
    return true;
  };
  const prev = new Map<string, { k: string; d: Dir }>();
  const q: Array<[number, number]> = [[from.x, from.y]];
  const seen = new Set([key(from.x, from.y)]);
  const dirs: Array<[Dir, number, number]> = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
  while (q.length) {
    const [x, y] = q.shift()!;
    if (x === to.x && y === to.y) break;
    for (const [d, dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      const k = key(nx, ny);
      if (seen.has(k) || !passable(nx, ny)) continue;
      seen.add(k);
      prev.set(k, { k: key(x, y), d });
      q.push([nx, ny]);
    }
  }
  const out: Dir[] = [];
  let cur = key(to.x, to.y);
  while (cur !== key(from.x, from.y)) {
    const p = prev.get(cur);
    if (!p) throw new Error(`pathTo: 경로 없음 ${mapId} → ${key(to.x, to.y)}`);
    out.unshift(p.d);
    cur = p.k;
  }
  return out;
}
