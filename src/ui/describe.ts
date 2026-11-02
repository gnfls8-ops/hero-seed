// 화면에 보이는 설명 문구 계산 (숫자 대신 성향 설명 등)
import type { GameState, Phase, Stats, StatKey, TraitKey, Traits } from '../core/types';
import { TRAIT_DESCRIPTIONS, TRAIT_NONE, IDLE_LINES } from '../data/strings';
import { dominantTeaching } from '../core/ending';
import { memoryOf } from '../core/conditions';
import { BALANCE } from '../data/balance';

export const STAT_LABEL: Record<StatKey, string> = { power: '힘', control: '제어', trust: '보호자 신뢰' };
export const TRAIT_LABEL: Record<TraitKey, string> = { empathy: '공감', principle: '원칙', distrust: '불신', domination: '지배욕' };

export const PHASE_LABEL: Record<Phase, string> = {
  intro: '도입',
  status: '월간 상태',
  schedule: '일정 정하기',
  activity: '활동 결과',
  minigameBrief: '구조 준비',
  minigame: '구조 중',
  minigameResult: '구조 결과',
  event: '사건',
  reaction: '아이의 반응',
  summary: '월말 요약',
  finaleIntro: '몇 년 뒤',
  finale: '최종 사건',
  finaleReaction: '최종 사건',
  ending: '엔딩',
};

/** 성향 설명: 초기값보다 많이 오른 순으로 최대 3개 */
export function traitDescriptions(t: Traits): string[] {
  const keys = (Object.keys(t) as TraitKey[])
    .map((k) => ({ k, gain: t[k] - BALANCE.initialTraits[k] }))
    .filter((x) => x.gain > 0)
    .sort((a, b) => b.gain - a.gain);
  const out: string[] = [];
  for (const { k } of keys) {
    const d = TRAIT_DESCRIPTIONS[k].find((x) => t[k] >= x.min);
    if (d) out.push(d.text);
    if (out.length >= 3) break;
  }
  return out.length ? out : [TRAIT_NONE];
}

export function idleLine(s: GameState, index: number): string {
  const lean = dominantTeaching(s.eventHistory);
  const pool = IDLE_LINES[lean ?? 'none'];
  const last = s.eventHistory[s.eventHistory.length - 1];
  const line = pool[(index + s.turn) % pool.length]!;
  return line.replaceAll('{lastmem}', last ? memoryOf(last) : '');
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `${n}` : '±0';
}

export function statDiff(before: Stats, after: Stats): Array<{ key: StatKey; before: number; after: number; delta: number }> {
  return (Object.keys(after) as StatKey[]).map((key) => ({ key, before: before[key], after: after[key], delta: after[key] - before[key] }));
}
