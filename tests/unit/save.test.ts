import { describe, expect, it } from 'vitest';
import { buildExport, parseImport, parseSave, SaveStore, SAVE_KEYS, serializeState, validateState, ValidationError, MAX_IMPORT_BYTES } from '../../src/core/save';
import { playRun } from '../../src/core/sim';
import { reduce } from '../../src/core/game';

class MemStorage {
  data = new Map<string, string>();
  failWrites = false;
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { if (this.failWrites) throw new DOMException('quota', 'QuotaExceededError'); this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

const mid = () => playRun({ teachings: () => 'outside', stopAt: { turn: 4, phase: 'minigame' } });

describe('직렬화·복원', () => {
  it('진행 중 상태(미니게임 포함)를 그대로 복원한다', () => {
    let s = mid();
    s = reduce(s, { type: 'mgDir', dir: 'up' });
    s = reduce(s, { type: 'mgDir', dir: 'left' });
    const back = parseSave(serializeState(s));
    expect(back).toEqual(s);
    expect(back.minigameSnapshot?.x).toBe(s.minigameSnapshot?.x);
  });

  it('엔딩까지 진행한 상태도 복원된다', () => {
    const s = playRun({ teachings: () => 'control', finale: 'reconsider' });
    expect(parseSave(serializeState(s))).toEqual(s);
  });

  it('저장 후 이어하기를 해도 보상이 다시 적용되지 않는다', () => {
    const s = playRun({ teachings: () => 'protect', stopAt: { turn: 2, phase: 'minigame' } });
    const done = reduce(s, { type: 'mgFinish', turn: 2 });
    const restored = parseSave(serializeState(done));
    expect(reduce(restored, { type: 'mgFinish', turn: 2 })).toBe(restored);
    expect(reduce(restored, { type: 'next', from: 'minigameResult', turn: 2 }).stats).toEqual(done.stats);
  });
});

describe('손상된 저장', () => {
  it('손상되면 백업을 제시한다', () => {
    const st = new MemStorage();
    const store = new SaveStore(st);
    const a = playRun({ teachings: [], stopAt: { turn: 1, phase: 'schedule' } });
    const b = reduce(a, { type: 'setSlot', slot: 0, activity: 'school' });
    store.save(a);
    store.save(b);
    expect(parseSave(st.getItem(SAVE_KEYS.backup)!)).toEqual(a);
    st.data.set(SAVE_KEYS.main, '{"schemaVersion":1, "turn": 9');
    const r = new SaveStore(st).load();
    expect(r.status).toBe('corrupt');
    if (r.status === 'corrupt') expect(r.backup).toEqual(a);
  });

  it('백업도 없으면 backup=null', () => {
    const st = new MemStorage();
    st.data.set(SAVE_KEYS.main, 'not json');
    const r = new SaveStore(st).load();
    expect(r).toMatchObject({ status: 'corrupt', backup: null });
  });

  it('저장소 쓰기 실패 시 false를 돌려주고 메모리로 계속', () => {
    const st = new MemStorage();
    st.failWrites = true;
    const store = new SaveStore(st);
    expect(store.save(playRun({ teachings: [], stopAt: { turn: 1, phase: 'status' } }))).toBe(false);
    expect(store.available).toBe(false);
    expect(new SaveStore(null).save(playRun({ teachings: [], stopAt: { turn: 1, phase: 'status' } }))).toBe(false);
  });
});

describe('가져오기 검증', () => {
  const good = () => playRun({ teachings: () => 'protect', stopAt: { turn: 3, phase: 'event' } });
  const wrap = (state: unknown, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ format: 'hero-seed-save', schemaVersion: 1, exportedAt: 'x', state, ...extra });

  it('정상 파일은 통과', () => {
    const s = good();
    expect(parseImport(buildExport(s))).toEqual(s);
  });

  it.each([
    ['JSON 아님', '{{{'],
    ['형식 표시 없음', JSON.stringify({ state: {} })],
    ['알 수 없는 버전', JSON.stringify({ format: 'hero-seed-save', schemaVersion: 99, state: {} })],
  ])('%s → 거절', (_n, text) => {
    expect(() => parseImport(text)).toThrow(ValidationError);
  });

  it('1MB 초과 거절', () => {
    expect(() => parseImport('{}', MAX_IMPORT_BYTES + 1)).toThrow(/1MB/);
  });

  const mutations: Array<[string, (s: Record<string, any>) => void]> = [
    ['능력 범위 밖', (s) => (s.stats.power = 101)],
    ['음수 성향', (s) => (s.traits.empathy = -1)],
    ['소수 수치', (s) => (s.stats.trust = 50.5)],
    ['턴 7', (s) => (s.turn = 7)],
    ['잘못된 단계', (s) => (s.phase = 'hack')],
    ['잘못된 활동', (s) => (s.schedule[0] = 'shop')],
    ['없는 사건 ID', (s) => (s.eventHistory[0].eventId = 'e99')],
    ['가르침 위조', (s) => (s.eventHistory[0].teaching = 'control')],
    ['신뢰 변화 위조', (s) => (s.eventHistory[0].trustDelta = 50)],
    ['적용 ID 형식 오류', (s) => s.appliedEffectIds.push('<img src=x onerror=alert(1)>')],
    ['runId에 HTML', (s) => (s.runId = '<script>alert(1)</script>')],
    ['설정 열거값 오류', (s) => (s.settings.textSpeed = 'turbo')],
    ['표정 열거값 오류', (s) => (s.mood = 'evil')],
    ['사건 중복', (s) => s.eventHistory.push({ ...s.eventHistory[0] })],
  ];
  it.each(mutations)('%s → 거절', (_n, mut) => {
    const s = JSON.parse(JSON.stringify(good()));
    mut(s);
    expect(() => parseImport(wrap(s))).toThrow(ValidationError);
  });

  it('알 수 없는 추가 필드는 버린다', () => {
    const s = JSON.parse(JSON.stringify(good()));
    s.evil = '<b>x</b>';
    const out = validateState(s) as unknown as Record<string, unknown>;
    expect(out.evil).toBeUndefined();
  });

  it('잘못된 파일을 거절해도 기존 저장은 그대로', () => {
    const st = new MemStorage();
    const store = new SaveStore(st);
    const s = good();
    store.save(s);
    const before = st.getItem(SAVE_KEYS.main);
    expect(() => parseImport('{"format":"hero-seed-save","schemaVersion":1,"state":{"turn":"x"}}')).toThrow();
    expect(st.getItem(SAVE_KEYS.main)).toBe(before);
  });
});
