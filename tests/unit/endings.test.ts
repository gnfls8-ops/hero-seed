import { describe, expect, it } from 'vitest';
import { classifyEnding, persuasionAccepted, representativeTeachings } from '../../src/core/ending';
import { playRun } from '../../src/core/sim';
import type { Teaching } from '../../src/core/types';

describe('세 가르침 경로', () => {
  it.each([
    ['protect', 'white'],
    ['outside', 'dark'],
    ['control', 'villain'],
  ] as const)('%s 6회 연속 → %s', (t, ending) => {
    const s = playRun({ teachings: () => t });
    expect(s.phase).toBe('ending');
    expect(classifyEnding(s.traits).type).toBe(ending);
    expect(s.eventHistory).toHaveLength(6);
  });
});

describe('혼합 경로와 판정 순서', () => {
  const mix = (arr: Teaching[]) => classifyEnding(playRun({ teachings: arr }).traits).type;
  it('통제 5 + 보호 1 → 빌런 (지배욕 60, 공감 28)', () => {
    expect(mix(['control', 'control', 'protect', 'control', 'control', 'control'])).toBe('villain');
  });
  it('통제 4 + 보호 2 → 지배욕 52라 빌런 아님', () => {
    expect(mix(['control', 'protect', 'control', 'protect', 'control', 'control'])).toBe('white');
  });
  it('제도 밖 4 + 통제 2 → 불신 58 → 다크히어로', () => {
    expect(mix(['outside', 'control', 'outside', 'outside', 'control', 'outside'])).toBe('dark');
  });
  it('제도 밖 3 + 통제 3 → 불신 53 → 화이트 (명세 판정 그대로)', () => {
    expect(mix(['outside', 'control', 'outside', 'control', 'outside', 'control'])).toBe('white');
  });
});

describe('경계값 55·60', () => {
  it('지배욕 60 & 공감보다 높음 → 빌런, 59 → 다음 단계', () => {
    expect(classifyEnding({ empathy: 40, principle: 20, distrust: 70, domination: 60 }).type).toBe('villain');
    expect(classifyEnding({ empathy: 40, principle: 20, distrust: 70, domination: 59 }).type).toBe('dark');
  });
  it('지배욕 60이어도 공감과 같거나 낮으면 빌런 아님', () => {
    expect(classifyEnding({ empathy: 60, principle: 20, distrust: 20, domination: 60 }).type).toBe('white');
    expect(classifyEnding({ empathy: 61, principle: 20, distrust: 55, domination: 60 }).type).toBe('dark');
  });
  it('불신 55 & 원칙보다 높음 → 다크, 54 → 화이트', () => {
    expect(classifyEnding({ empathy: 20, principle: 54, distrust: 55, domination: 20 }).type).toBe('dark');
    expect(classifyEnding({ empathy: 20, principle: 20, distrust: 54, domination: 20 }).type).toBe('white');
  });
  it('불신 55여도 원칙과 같으면 화이트', () => {
    expect(classifyEnding({ empathy: 20, principle: 55, distrust: 55, domination: 20 }).type).toBe('white');
  });
  it('빌런 조건이 다크 조건보다 먼저 판정된다', () => {
    expect(classifyEnding({ empathy: 10, principle: 10, distrust: 90, domination: 60 }).type).toBe('villain');
  });
  it('판정 근거 문장을 제공한다', () => {
    const j = classifyEnding({ empathy: 20, principle: 20, distrust: 54, domination: 20 });
    expect(j.reasons).toHaveLength(3);
    expect(j.reasons[1]).toContain('54 < 55');
  });
});

describe('최종 설득 신뢰 64·65', () => {
  it('신뢰 65 + 다른 방법 → 수용, 64 → 거절', () => {
    expect(persuasionAccepted(65, 'reconsider')).toBe(true);
    expect(persuasionAccepted(64, 'reconsider')).toBe(false);
    expect(persuasionAccepted(90, 'trust')).toBe(false);
  });
  it('엔딩 유형 자체는 설득으로 바뀌지 않는다', () => {
    const a = playRun({ teachings: () => 'control', finale: 'reconsider', schedule: () => ['family', 'family', 'training'] });
    const b = playRun({ teachings: () => 'control', finale: 'trust', schedule: () => ['family', 'family', 'training'] });
    expect(a.stats.trust).toBeGreaterThanOrEqual(65);
    expect(classifyEnding(a.traits).type).toBe('villain');
    expect(classifyEnding(b.traits).type).toBe('villain');
    expect(a.finaleChoice).toBe('reconsider');
  });
});

describe('대표 가르침', () => {
  it('엔딩과 같은 유형의 처음·마지막 2개를 고른다', () => {
    const s = playRun({ teachings: ['protect', 'control', 'protect', 'outside', 'protect', 'control'] });
    const reps = representativeTeachings(s.eventHistory, 'white');
    expect(reps.map((r) => r.turn)).toEqual([1, 5]);
  });
  it('부족하면 최근 선택으로 채운다', () => {
    const s = playRun({ teachings: ['protect', 'protect', 'protect', 'protect', 'protect', 'control'] });
    const reps = representativeTeachings(s.eventHistory, 'villain');
    expect(reps).toHaveLength(2);
    expect(reps.map((r) => r.turn)).toEqual([5, 6]);
  });
});
