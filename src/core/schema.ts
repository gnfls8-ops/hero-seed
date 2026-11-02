// 초기화 단계 데이터 검증: 잘못된 이벤트 ID, 누락된 후속 사건, 맵 경로 오류를 찾는다.
import { BALANCE } from '../data/balance';
import { ACTIVITIES } from '../data/activities';
import { EVENTS } from '../data/events';
import { MAPS } from '../data/maps';
import { ENDINGS } from '../data/endings';
import type { Condition, EventDef, MapDef, TextBlock } from './types';
import { COMPARE_OPS, TEACHINGS, ACTIVITY_IDS, ENDING_TYPES, MOODS } from './types';
import { costsFor, minCostFor } from './rescue';

const TARGET_LETTERS: Record<string, string[]> = {
  doll: ['D', 'R', 'B'],
  citizen: ['C'],
  evidence: ['E'],
};

function checkCondition(c: Condition, where: string, errors: string[], eventIds: Set<string>, maxTurn: number, mgMaxTurn = maxTurn) {
  switch (c.type) {
    case 'teaching':
    case 'eventSeen': {
      if (!eventIds.has(c.eventId)) errors.push(`${where}: 존재하지 않는 사건 ID '${c.eventId}'`);
      const ev = EVENTS.find((e) => e.id === c.eventId);
      if (ev && ev.turn > maxTurn) errors.push(`${where}: 미래 사건 '${c.eventId}' 참조`);
      if (c.type === 'teaching' && !TEACHINGS.includes(c.is)) errors.push(`${where}: 잘못된 가르침 '${String(c.is)}'`);
      break;
    }
    case 'stat':
    case 'trait':
      if (!COMPARE_OPS.includes(c.op)) errors.push(`${where}: 허용되지 않은 연산자 '${String(c.op)}'`);
      if (typeof c.value !== 'number') errors.push(`${where}: 비교값은 숫자여야 함`);
      break;
    case 'minigameTier':
    case 'minigameFirst':
    case 'minigameRescued': {
      const map = MAPS.find((m) => m.turn === c.turn);
      if (!map) errors.push(`${where}: ${c.turn}턴 맵이 없음`);
      else if (c.type !== 'minigameTier' && !map.targets.some((t) => t.id === c.targetId))
        errors.push(`${where}: 맵 '${map.id}'에 대상 '${c.targetId}' 없음`);
      if (c.turn > mgMaxTurn) errors.push(`${where}: 미래 미니게임 참조`);
      break;
    }
    case 'dominantTeaching':
      if (!TEACHINGS.includes(c.is)) errors.push(`${where}: 잘못된 가르침`);
      break;
    case 'memoryTag':
      if (!EVENTS.some((e) => e.choices.some((ch) => ch.memoryTags.includes(c.tag)))) errors.push(`${where}: 알 수 없는 기억 태그 '${c.tag}'`);
      break;
    default:
      errors.push(`${where}: 알 수 없는 조건 타입 '${(c as { type: string }).type}'`);
  }
}

function checkBlocks(blocks: TextBlock[], where: string, errors: string[], eventIds: Set<string>, maxTurn: number, mgMaxTurn = maxTurn) {
  blocks.forEach((b, i) => {
    if (typeof b === 'string') {
      if (!b.trim()) errors.push(`${where}[${i}]: 빈 문단`);
      return;
    }
    if (!b.variants.length) errors.push(`${where}[${i}]: 변형 없음`);
    const last = b.variants[b.variants.length - 1];
    if (last?.when && last.when.length) errors.push(`${where}[${i}]: 마지막 변형은 조건 없는 기본값이어야 함`);
    b.variants.forEach((v, j) => (v.when ?? []).forEach((c) => checkCondition(c, `${where}[${i}].${j}`, errors, eventIds, maxTurn, mgMaxTurn)));
  });
}

export function validateEvents(events: EventDef[] = EVENTS): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const turns = new Set<number>();
  for (const e of events) {
    if (ids.has(e.id)) errors.push(`사건 ID 중복: ${e.id}`);
    ids.add(e.id);
    if (turns.has(e.turn)) errors.push(`${e.turn}턴에 사건이 둘 이상`);
    turns.add(e.turn);
  }
  for (let t = 1; t <= BALANCE.totalTurns; t++) if (!turns.has(t)) errors.push(`${t}턴 사건 누락`);
  for (const e of events) {
    const w = `사건 ${e.id}`;
    const paraCount = e.textVariants.length;
    if (paraCount < 2 || paraCount > 4) errors.push(`${w}: 상황 문단은 2~4개 (${paraCount})`);
    // 상황 문단: 이전 턴 사건과 같은 턴 미니게임까지 참조 가능
    checkBlocks(e.textVariants, `${w}.textVariants`, errors, ids, e.turn - 1, e.turn);
    e.prerequisites.forEach((c) => checkCondition(c, `${w}.prerequisites`, errors, ids, e.turn - 1));
    if (e.choices.length !== 3) errors.push(`${w}: 선택지는 3개여야 함`);
    const teach = new Set(e.choices.map((c) => c.teaching));
    if (teach.size !== 3) errors.push(`${w}: 세 가르침 유형이 하나씩 있어야 함`);
    const cids = new Set<string>();
    for (const c of e.choices) {
      if (cids.has(c.id)) errors.push(`${w}: 선택지 ID 중복 ${c.id}`);
      cids.add(c.id);
      if (c.trust < BALANCE.choiceTrustRange.min || c.trust > BALANCE.choiceTrustRange.max)
        errors.push(`${w}.${c.id}: 신뢰 변화 범위 밖 (${c.trust})`);
      if (!c.memoryTags.length) errors.push(`${w}.${c.id}: 기억 태그 없음`);
      if (!c.memory) errors.push(`${w}.${c.id}: 기억 문장 없음`);
      if (!MOODS.includes(c.mood)) errors.push(`${w}.${c.id}: 표정 값 오류`);
      if (c.reaction.length < 1 || c.reaction.length > 3) errors.push(`${w}.${c.id}: 반응 문단은 1~3개`);
      checkBlocks(c.reaction, `${w}.${c.id}.reaction`, errors, ids, e.turn);
      if (/화이트|다크|빌런|선함|악함/.test(c.label)) errors.push(`${w}.${c.id}: 선택지에 엔딩·선악 라벨 금지`);
    }
    if (BALANCE.minigameTurns.includes(e.turn)) {
      const mi = e.minigameIntro;
      if (!mi || !mi.success || !mi.partial || !mi.none) errors.push(`${w}: 미니게임 성과별 도입 문구(성공/부분/없음) 필요`);
    }
    if (e.callbacks.next !== null) {
      const nx = events.find((x) => x.id === e.callbacks.next);
      if (!nx) errors.push(`${w}: 후속 사건 '${e.callbacks.next}' 누락`);
      else if (nx.turn !== e.turn + 1) errors.push(`${w}: 후속 사건 턴 불일치`);
    } else if (e.turn !== BALANCE.totalTurns) errors.push(`${w}: 마지막 턴이 아닌데 후속 사건이 없음`);
    for (const q of e.callbacks.quotes) {
      const qe = events.find((x) => x.id === q);
      if (!qe) errors.push(`${w}: 인용 사건 '${q}' 없음`);
      else if (qe.turn >= e.turn) errors.push(`${w}: 인용 사건은 이전 턴이어야 함`);
    }
  }
  // 표시 순서는 사건마다 달라야 한다
  const orders = events.map((e) => e.choices.map((c) => c.teaching).join(','));
  for (let i = 1; i < orders.length; i++) if (orders[i] === orders[i - 1]) errors.push(`연속된 사건의 선택지 순서가 같음: ${events[i]!.id}`);
  return errors;
}

export function validateMap(m: MapDef): string[] {
  const errors: string[] = [];
  const w = `맵 ${m.id}`;
  const N = BALANCE.rescue.gridSize;
  if (m.rows.length !== N) errors.push(`${w}: 행 수 ${m.rows.length} ≠ ${N}`);
  m.rows.forEach((r, y) => {
    if (r.length !== N) errors.push(`${w}: ${y}행 길이 ${r.length} ≠ ${N}`);
    if (!/^[#.xOPDRBCE]+$/.test(r)) errors.push(`${w}: ${y}행에 허용되지 않은 문자`);
    if (y === 0 || y === N - 1) {
      if (!/^#+$/.test(r)) errors.push(`${w}: 외곽은 벽이어야 함`);
    } else if (r[0] !== '#' || r[N - 1] !== '#') errors.push(`${w}: ${y}행 외곽 벽 누락`);
  });
  const startCh = m.rows[m.start.y]?.[m.start.x];
  if (startCh !== 'P') errors.push(`${w}: 시작 위치 표시 'P' 불일치`);
  const letters: Array<[number, number]> = [];
  m.rows.forEach((r, y) => [...r].forEach((c, x) => /[DRBCE]/.test(c) && letters.push([x, y])));
  if (letters.length !== m.targets.length) errors.push(`${w}: 대상 표시 글자 수와 targets 수가 다름`);
  for (const t of m.targets) {
    const ch = m.rows[t.y]?.[t.x] ?? '';
    if (!TARGET_LETTERS[t.kind]?.includes(ch)) errors.push(`${w}: 대상 ${t.id} 좌표 (${t.x},${t.y})의 글자 '${ch}' 불일치`);
  }
  if (!BALANCE.minigameTurns.includes(m.turn)) errors.push(`${w}: 미니게임 턴이 아님`);
  // 최저 능력(초기값)으로 최소 1명 구조 가능해야 한다
  const low = costsFor(BALANCE.initialStats);
  const people = m.targets.filter((t) => t.kind !== 'evidence');
  const bestOne = Math.min(...people.map((p) => minCostFor(m, low.debrisCost, [p.id])));
  if (!(bestOne <= low.apMax)) errors.push(`${w}: 최저 능력으로 구조 불가 (최소 ${bestOne} > ${low.apMax})`);
  return errors;
}

export function validateData(): string[] {
  const errors: string[] = [...validateEvents()];
  const mapTurns = new Set<number>();
  for (const m of MAPS) {
    errors.push(...validateMap(m));
    if (mapTurns.has(m.turn)) errors.push(`${m.turn}턴 맵 중복`);
    mapTurns.add(m.turn);
  }
  for (const t of BALANCE.minigameTurns) if (!mapTurns.has(t)) errors.push(`${t}턴 맵 누락`);
  const actIds = new Set(ACTIVITIES.map((a) => a.id));
  for (const id of ACTIVITY_IDS) if (!actIds.has(id)) errors.push(`활동 '${id}' 누락`);
  const lineIds = new Set<string>();
  for (const a of ACTIVITIES) {
    if (a.lines.length < 8) errors.push(`활동 ${a.id}: 문구 8개 이상 필요 (${a.lines.length})`);
    for (const l of a.lines) {
      if (lineIds.has(l.id)) errors.push(`활동 문구 ID 중복 ${l.id}`);
      lineIds.add(l.id);
    }
    if (a.lines.filter((l) => !l.lean).length < BALANCE.totalTurns)
      errors.push(`활동 ${a.id}: 중립 문구가 턴 수보다 적음`);
  }
  for (const t of ENDING_TYPES) if (!ENDINGS[t]) errors.push(`엔딩 ${t} 누락`);
  return errors;
}
