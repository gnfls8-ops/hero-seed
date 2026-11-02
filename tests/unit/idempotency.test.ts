import { describe, expect, it } from 'vitest';
import { reduce } from '../../src/core/game';
import { playRun } from '../../src/core/sim';
import { eventForTurn } from '../../src/core/registry';

describe('중복 적용 차단', () => {
  it('일정 실행을 두 번 보내도 한 번만 적용', () => {
    let s = playRun({ teachings: [], stopAt: { turn: 1, phase: 'schedule' } });
    ['training', 'training', 'family'].forEach((a, i) => (s = reduce(s, { type: 'setSlot', slot: i, activity: a as never })));
    const a = reduce(s, { type: 'confirmSchedule', turn: 1 });
    const b = reduce(a, { type: 'confirmSchedule', turn: 1 });
    expect(b).toBe(a);
    expect(a.stats).toEqual({ power: 28, control: 24, trust: 54 });
  });

  it('같은 사건 선택을 두 번 보내도 한 번만 적용', () => {
    const s = playRun({ teachings: [], stopAt: { turn: 1, phase: 'event' } });
    const ev = eventForTurn(1)!;
    const a = reduce(s, { type: 'choose', eventId: ev.id, choiceId: ev.choices[0]!.id });
    const b = reduce(a, { type: 'choose', eventId: ev.id, choiceId: ev.choices[1]!.id });
    expect(b).toBe(a);
    expect(a.eventHistory).toHaveLength(1);
  });

  it('단계를 되돌려도(이전 저장 재적용) 적용 ID로 차단', () => {
    const s = playRun({ teachings: [], stopAt: { turn: 1, phase: 'event' } });
    const ev = eventForTurn(1)!;
    const a = reduce(s, { type: 'choose', eventId: ev.id, choiceId: ev.choices[0]!.id });
    // 단계만 event로 되돌린 비정상 상태에서도 다시 적용되지 않는다
    const tampered = { ...a, phase: 'event' as const };
    expect(reduce(tampered, { type: 'choose', eventId: ev.id, choiceId: ev.choices[0]!.id })).toBe(tampered);
  });

  it('미니게임 결과 보상은 한 번만', () => {
    const s = playRun({ teachings: () => 'protect', stopAt: { turn: 2, phase: 'minigame' } });
    const a = reduce(s, { type: 'mgFinish', turn: 2 });
    const b = reduce({ ...a, phase: 'minigame', minigameSnapshot: s.minigameSnapshot }, { type: 'mgFinish', turn: 2 });
    expect(b.stats).toEqual(a.stats);
    expect(b.minigameResults).toHaveLength(1);
  });

  it('다음 버튼 연타: 화면이 본 단계와 다르면 무시', () => {
    const s = playRun({ teachings: [], stopAt: { turn: 1, phase: 'status' } });
    const a = reduce(s, { type: 'next', from: 'status', turn: 1 });
    const b = reduce(a, { type: 'next', from: 'status', turn: 1 });
    expect(a.phase).toBe('schedule');
    expect(b).toBe(a);
  });

  it('월말 진행은 턴당 한 번, 6턴 이후 추가 턴 없음', () => {
    const s = playRun({ teachings: () => 'protect', stopAt: { turn: 6, phase: 'summary' } });
    const a = reduce(s, { type: 'next', from: 'summary', turn: 6 });
    expect(a.turn).toBe(6);
    expect(a.phase).toBe('finaleIntro');
    const end = playRun({ teachings: () => 'protect' });
    expect(end.turn).toBe(6);
    expect(end.phase).toBe('ending');
    for (const p of ['summary', 'status', 'ending'] as const) {
      expect(reduce({ ...end, phase: p === 'ending' ? 'ending' : end.phase }, { type: 'next', from: 'ending', turn: 6 }).turn).toBe(6);
    }
    // 6턴 월말에서 advance ID가 이미 있어도 7턴으로 가지 않는다
    expect(end.appliedEffectIds.filter((id) => id.endsWith(':advance'))).toHaveLength(5);
  });

  it('최종 선택은 한 번만', () => {
    const s = playRun({ teachings: () => 'protect', stopAt: { turn: 6, phase: 'finale' } });
    const a = reduce(s, { type: 'finaleChoose', choice: 'reconsider' });
    const b = reduce({ ...a, phase: 'finale' }, { type: 'finaleChoose', choice: 'trust' });
    expect(b.finaleChoice).toBe('reconsider');
  });
});
