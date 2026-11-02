import { BALANCE } from '../data/balance';
import type { EndingType, EventRecord, Teaching, Traits } from './types';

export interface EndingJudgement {
  type: EndingType;
  /** 사람이 읽는 판정 근거 */
  reasons: string[];
}

const NAMES: Record<keyof Traits, string> = {
  empathy: '공감',
  principle: '원칙',
  distrust: '불신',
  domination: '지배욕',
};

/** 명세의 판정 순서를 그대로 사용한다. */
export function classifyEnding(t: Traits): EndingJudgement {
  const { villainDomination, darkDistrust } = BALANCE.ending;
  const reasons: string[] = [];
  const v1 = t.domination >= villainDomination;
  const v2 = t.domination > t.empathy;
  reasons.push(
    `1단계 빌런: ${NAMES.domination} ${t.domination} ${v1 ? '≥' : '<'} ${villainDomination}, ` +
      `${NAMES.domination} ${t.domination} ${v2 ? '>' : '≤'} ${NAMES.empathy} ${t.empathy} → ${v1 && v2 ? '충족' : '불충족'}`,
  );
  if (v1 && v2) return { type: 'villain', reasons };
  const d1 = t.distrust >= darkDistrust;
  const d2 = t.distrust > t.principle;
  reasons.push(
    `2단계 다크히어로: ${NAMES.distrust} ${t.distrust} ${d1 ? '≥' : '<'} ${darkDistrust}, ` +
      `${NAMES.distrust} ${t.distrust} ${d2 ? '>' : '≤'} ${NAMES.principle} ${t.principle} → ${d1 && d2 ? '충족' : '불충족'}`,
  );
  if (d1 && d2) return { type: 'dark', reasons };
  reasons.push('3단계: 앞의 조건에 해당하지 않아 화이트히어로');
  return { type: 'white', reasons };
}

export const ENDING_TEACHING: Record<EndingType, Teaching> = {
  white: 'protect',
  dark: 'outside',
  villain: 'control',
};

/** 가장 자주 고른 가르침. 동률이면 가장 최근에 고른 쪽. */
export function dominantTeaching(history: EventRecord[], uptoTurn = Infinity): Teaching | null {
  const h = history.filter((r) => r.turn <= uptoTurn);
  if (h.length === 0) return null;
  const count: Record<Teaching, number> = { protect: 0, outside: 0, control: 0 };
  const last: Record<Teaching, number> = { protect: -1, outside: -1, control: -1 };
  h.forEach((r, i) => {
    count[r.teaching] += 1;
    last[r.teaching] = i;
  });
  const order = (Object.keys(count) as Teaching[]).sort((a, b) => count[b] - count[a] || last[b] - last[a]);
  return order[0] ?? null;
}

/** 엔딩에 표시할 대표 가르침 2개: 엔딩과 같은 유형의 처음·마지막, 부족하면 최근 선택으로 채움 */
export function representativeTeachings(history: EventRecord[], type: EndingType): EventRecord[] {
  const want = ENDING_TEACHING[type];
  const match = history.filter((r) => r.teaching === want);
  const picked: EventRecord[] = [];
  if (match.length >= 2) {
    picked.push(match[0]!, match[match.length - 1]!);
  } else {
    if (match[0]) picked.push(match[0]);
    const rest = [...history].reverse().filter((r) => !picked.includes(r));
    while (picked.length < 2 && rest.length) picked.push(rest.shift()!);
  }
  return picked.sort((a, b) => a.turn - b.turn);
}

export function persuasionAccepted(trust: number, choice: 'reconsider' | 'trust' | null): boolean {
  return choice === 'reconsider' && trust >= BALANCE.ending.persuasionTrust;
}
