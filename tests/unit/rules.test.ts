import { describe, expect, it } from 'vitest';
import { createInitialState, reduce } from '../../src/core/game';
import { clamp, addStats, addTraits, scheduleDelta } from '../../src/core/rules';
import { BALANCE } from '../../src/data/balance';
import { playRun } from '../../src/core/sim';
import { eventForTurn } from '../../src/core/registry';
import { validateData } from '../../src/core/schema';

describe('데이터 스키마', () => {
  it('초기화 검증에서 오류가 없다', () => {
    expect(validateData()).toEqual([]);
  });
});

describe('능력·성향 범위', () => {
  it('0~100으로 제한된다', () => {
    expect(clamp(-5)).toBe(0);
    expect(clamp(130)).toBe(100);
    expect(clamp(Number.NaN)).toBe(0);
    expect(addStats({ power: 98, control: 1, trust: 50 }, { power: 4, control: -3 })).toEqual({ power: 100, control: 0, trust: 50 });
    expect(addTraits({ empathy: 96, principle: 0, distrust: 99, domination: 50 }, { empathy: 8, distrust: 8 })).toEqual({
      empathy: 100, principle: 0, distrust: 100, domination: 50,
    });
  });

  it('초기값은 명세와 같다', () => {
    const s = createInitialState('t');
    expect(s.stats).toEqual({ power: 20, control: 20, trust: 50 });
    expect(s.traits).toEqual({ empathy: 20, principle: 20, distrust: 20, domination: 20 });
  });

  it('6턴 내내 같은 선택을 반복해도 범위를 넘지 않는다', () => {
    const s = playRun({ teachings: () => 'control', schedule: () => ['training', 'training', 'family'] });
    for (const v of [...Object.values(s.stats), ...Object.values(s.traits)]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe('활동 효과', () => {
  it('활동별 1회당 변화가 정확하다', () => {
    expect(scheduleDelta(['school'])).toEqual({ control: 2 });
    expect(scheduleDelta(['training'])).toEqual({ power: 4, control: 2 });
    expect(scheduleDelta(['volunteer'])).toEqual({ power: 1, control: 1 });
    expect(scheduleDelta(['family'])).toEqual({ trust: 4 });
    expect(scheduleDelta(['training', 'training', 'family'])).toEqual({ power: 8, control: 4, trust: 4 });
  });

  it('같은 활동은 한 달에 최대 2회', () => {
    let s = reduce(reduce(createInitialState('t'), { type: 'next', from: 'intro', turn: 1 }), { type: 'next', from: 'status', turn: 1 });
    s = reduce(s, { type: 'setSlot', slot: 0, activity: 'training' });
    s = reduce(s, { type: 'setSlot', slot: 1, activity: 'training' });
    s = reduce(s, { type: 'setSlot', slot: 2, activity: 'training' });
    expect(s.schedule).toEqual(['training', 'training', null]);
    // 같은 칸을 같은 활동으로 바꾸는 것은 허용
    s = reduce(s, { type: 'setSlot', slot: 1, activity: 'training' });
    expect(s.schedule).toEqual(['training', 'training', null]);
  });

  it('활동만으로는 성향이 변하지 않는다', () => {
    let s = reduce(reduce(createInitialState('t'), { type: 'next', from: 'intro', turn: 1 }), { type: 'next', from: 'status', turn: 1 });
    ['volunteer', 'school', 'family'].forEach((a, i) => (s = reduce(s, { type: 'setSlot', slot: i, activity: a as never })));
    const before = s.traits;
    s = reduce(s, { type: 'confirmSchedule', turn: 1 });
    expect(s.traits).toEqual(before);
    expect(s.stats).toEqual({ power: 21, control: 23, trust: 54 });
  });

  it('실행 후에는 일정을 바꿀 수 없다', () => {
    let s = reduce(reduce(createInitialState('t'), { type: 'next', from: 'intro', turn: 1 }), { type: 'next', from: 'status', turn: 1 });
    ['school', 'school', 'family'].forEach((a, i) => (s = reduce(s, { type: 'setSlot', slot: i, activity: a as never })));
    s = reduce(s, { type: 'confirmSchedule', turn: 1 });
    const after = reduce(s, { type: 'setSlot', slot: 0, activity: 'training' });
    expect(after).toBe(s);
  });

  it('빈 칸이 있으면 실행되지 않는다', () => {
    let s = reduce(reduce(createInitialState('t'), { type: 'next', from: 'intro', turn: 1 }), { type: 'next', from: 'status', turn: 1 });
    s = reduce(s, { type: 'setSlot', slot: 0, activity: 'school' });
    expect(reduce(s, { type: 'confirmSchedule', turn: 1 }).phase).toBe('schedule');
  });
});

describe('선택 효과', () => {
  const toEvent = () => playRun({ teachings: [], stopAt: { turn: 1, phase: 'event' } });
  it.each([
    ['protect', { empathy: 28, principle: 26, distrust: 20, domination: 20 }],
    ['outside', { empathy: 25, principle: 20, distrust: 28, domination: 20 }],
    ['control', { empathy: 20, principle: 20, distrust: 23, domination: 28 }],
  ] as const)('%s 가르침의 성향 변화가 정확하다', (teaching, expected) => {
    const s0 = toEvent();
    const ev = eventForTurn(1)!;
    const ch = ev.choices.find((c) => c.teaching === teaching)!;
    const s1 = reduce(s0, { type: 'choose', eventId: ev.id, choiceId: ch.id });
    expect(s1.traits).toEqual(expected);
    expect(s1.stats.trust).toBe(s0.stats.trust + ch.trust);
    expect(s1.memories.at(-1)?.tags).toEqual(ch.memoryTags);
  });

  it('모든 선택지의 신뢰 변화는 -2~+3', () => {
    for (let t = 1; t <= 6; t++) for (const c of eventForTurn(t)!.choices) {
      expect(c.trust).toBeGreaterThanOrEqual(BALANCE.choiceTrustRange.min);
      expect(c.trust).toBeLessThanOrEqual(BALANCE.choiceTrustRange.max);
    }
  });
});
