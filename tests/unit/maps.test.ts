import { describe, expect, it } from 'vitest';
import { MAPS } from '../../src/data/maps';
import { MAP_BY_ID } from '../../src/core/registry';
import { act, costsFor, createSnapshot, finishRecord, minCostFor, resetSnapshot, stepDir } from '../../src/core/rescue';
import { validateMap } from '../../src/core/schema';
import { playRun, pathTo } from '../../src/core/sim';

const practice = MAP_BY_ID['map-practice']!;
const drill = MAP_BY_ID['map-drill']!;
const market = MAP_BY_ID['map-market']!;

describe('능력 보너스', () => {
  it('힘 40 미만 잔해 3, 이상 2 / 제어 40 이상 행동력 +4', () => {
    expect(costsFor({ power: 39, control: 39 })).toMatchObject({ debrisCost: 3, apMax: 24 });
    expect(costsFor({ power: 40, control: 39 })).toMatchObject({ debrisCost: 2, apMax: 24 });
    expect(costsFor({ power: 20, control: 40 })).toMatchObject({ debrisCost: 3, apMax: 28 });
    expect(costsFor({ power: 40, control: 40 })).toMatchObject({ debrisCost: 2, apMax: 28 });
  });
});

describe('맵 데이터', () => {
  it('3개 맵이 2·4·6턴에 하나씩, 9×9', () => {
    expect(MAPS.map((m) => m.turn)).toEqual([2, 4, 6]);
    for (const m of MAPS) {
      expect(m.rows).toHaveLength(9);
      m.rows.forEach((r) => expect(r).toHaveLength(9));
      expect(validateMap(m)).toEqual([]);
    }
  });

  it('정확한 좌표가 기록되어 있다', () => {
    expect(practice.start).toEqual({ x: 1, y: 1, facing: 'down' });
    expect(practice.targets.map((t) => [t.id, t.x, t.y])).toEqual([['doll-a', 4, 4]]);
    expect(drill.start).toEqual({ x: 4, y: 7, facing: 'up' });
    expect(drill.targets.map((t) => [t.id, t.x, t.y])).toEqual([['doll-red', 1, 1], ['doll-blue', 1, 3]]);
    expect(market.start).toEqual({ x: 1, y: 7, facing: 'up' });
    expect(market.targets.map((t) => [t.id, t.x, t.y])).toEqual([['citizen-a', 1, 3], ['citizen-b', 7, 3], ['evidence', 4, 1]]);
  });
});

describe('최단 행동 비용 (경로 계산기)', () => {
  // [맵, 잔해 비용, 대상, 순서, 기대 최소 비용]
  const table: Array<[string, number, string[], string[] | undefined, number]> = [
    ['map-practice', 3, ['doll-a'], undefined, 13],
    ['map-practice', 2, ['doll-a'], undefined, 12],
    ['map-drill', 3, ['doll-blue'], undefined, 7],
    ['map-drill', 3, ['doll-red'], undefined, 12],
    ['map-drill', 3, ['doll-red', 'doll-blue'], ['doll-blue', 'doll-red'], 20],
    ['map-drill', 3, ['doll-red', 'doll-blue'], ['doll-red', 'doll-blue'], 22],
    ['map-drill', 2, ['doll-red', 'doll-blue'], undefined, 18],
    ['map-market', 3, ['citizen-a'], undefined, 9],
    ['map-market', 3, ['citizen-b'], undefined, 13],
    ['map-market', 3, ['evidence'], undefined, 15],
    ['map-market', 3, ['citizen-a', 'citizen-b'], undefined, 19],
    ['map-market', 3, ['citizen-a', 'evidence'], undefined, 21],
    ['map-market', 3, ['citizen-a', 'citizen-b', 'evidence'], undefined, 30],
    ['map-market', 2, ['citizen-a', 'citizen-b', 'evidence'], undefined, 26],
  ];
  it.each(table)('%s 잔해%d %j 순서%j = %d', (id, dc, ids, order, cost) => {
    expect(minCostFor(MAP_BY_ID[id]!, dc, ids, order)).toBe(cost);
  });

  it('최저 능력(힘 20, 제어 20)으로 모든 맵에서 최소 1명 구조 가능', () => {
    const low = costsFor({ power: 20, control: 20 });
    for (const m of MAPS) {
      const people = m.targets.filter((t) => t.kind !== 'evidence');
      const best = Math.min(...people.map((p) => minCostFor(m, low.debrisCost, [p.id])));
      expect(best).toBeLessThanOrEqual(low.apMax);
    }
  });

  it('6턴: 기본 예산으로 전부 불가, 힘·제어 중 하나만 충분해도 불가, 둘 다 충분하면 가능', () => {
    const all = ['citizen-a', 'citizen-b', 'evidence'];
    const cases: Array<[number, number, boolean]> = [
      [20, 20, false],
      [40, 20, false],
      [20, 40, false],
      [40, 40, true],
    ];
    for (const [power, control, ok] of cases) {
      const c = costsFor({ power, control });
      expect(minCostFor(market, c.debrisCost, all) <= c.apMax).toBe(ok);
    }
    // 기본 예산으로도 시민 2명 또는 시민 1명+증거는 고를 수 있다
    expect(minCostFor(market, 3, ['citizen-a', 'citizen-b'])).toBeLessThanOrEqual(24);
    expect(minCostFor(market, 3, ['citizen-a', 'evidence'])).toBeLessThanOrEqual(24);
  });
});

describe('미니게임 조작 규칙', () => {
  const low = { power: 20, control: 20 };
  it('벽으로 이동하면 행동력은 그대로, 방향만 바뀐다', () => {
    const s = createSnapshot(practice, low);
    const s1 = stepDir(s, practice, 'up');
    expect(s1.ap).toBe(24);
    expect(s1.facing).toBe('up');
    expect([s1.x, s1.y]).toEqual([1, 1]);
    const s2 = stepDir(s1, practice, 'right');
    expect(s2.ap).toBe(23);
    expect([s2.x, s2.y]).toEqual([2, 1]);
  });

  it('잔해 제거 3(약) / 2(강), 구조 1, 빈 칸 행동은 무비용', () => {
    const play = (stats: { power: number; control: number }) => {
      let s = createSnapshot(practice, stats);
      for (const d of pathTo(practice.id, { x: 1, y: 1 }, { x: 4, y: 6 })) s = stepDir(s, practice, d);
      const moved = s.apMax - s.ap;
      s = act(s, practice); // 아래쪽(방향 down)은 빈 칸 → 비용 없음
      expect(s.apMax - s.ap).toBe(moved);
      s = stepDir(s, practice, 'up'); // 잔해에 막힘 → 방향만
      expect(s.facing).toBe('up');
      const before = s.ap;
      s = act(s, practice);
      const debrisCost = before - s.ap;
      s = stepDir(s, practice, 'up');
      s = stepDir(s, practice, 'up'); // 인형에 막힘
      const b2 = s.ap;
      s = act(s, practice);
      return { debrisCost, rescueCost: b2 - s.ap, rec: finishRecord(s, practice), total: s.apMax - s.ap };
    };
    const weak = play(low);
    expect(weak.debrisCost).toBe(3);
    expect(weak.rescueCost).toBe(1);
    expect(weak.total).toBe(13);
    expect(weak.rec).toMatchObject({ rescued: 1, tier: 'success', controlReward: 2 });
    expect(play({ power: 45, control: 20 }).debrisCost).toBe(2);
  });

  it('행동력이 부족한 행동은 실행되지 않는다', () => {
    let s = createSnapshot(practice, low);
    for (const d of pathTo(practice.id, { x: 1, y: 1 }, { x: 4, y: 6 })) s = stepDir(s, practice, d);
    s = { ...s, ap: 2 };
    s = stepDir(s, practice, 'up');
    const t = act(s, practice);
    expect(t.ap).toBe(2);
    expect(t.debris).toContain('4,5');
    expect(t.message).toContain('부족');
  });

  it('리셋은 맵을 처음부터, 비용 규칙은 유지', () => {
    let s = createSnapshot(practice, { power: 50, control: 50 });
    s = stepDir(s, practice, 'right');
    s = resetSnapshot(s, practice);
    expect([s.x, s.y, s.ap, s.apMax, s.debrisCost, s.resets]).toEqual([1, 1, 28, 28, 2, 1]);
  });

  it('미니게임 보상은 구조 대상당 제어 +2, 최대 +4이며 증거는 보상 없음', () => {
    const s = createSnapshot(market, { power: 60, control: 60 });
    const all = { ...s, targets: s.targets.map((t) => ({ ...t, rescued: true })), order: ['evidence', 'citizen-a', 'citizen-b'] };
    const r = finishRecord(all, market);
    expect(r).toMatchObject({ rescued: 2, evidence: true, controlReward: 4, tier: 'success' });
  });
});

describe('미니게임 결과는 성향을 직접 바꾸지 않는다', () => {
  it('구조 0명과 구조 성공 경로의 성향이 같다', () => {
    const fail = playRun({ teachings: () => 'protect' });
    const drillPath = (turn: number) => {
      if (turn !== 2) return [];
      return [...pathTo('map-practice', { x: 1, y: 1 }, { x: 4, y: 6 }), 'up', 'act', 'up', 'up', 'act'] as Array<'up' | 'act'>;
    };
    const ok = playRun({ teachings: () => 'protect', minigame: drillPath });
    expect(ok.minigameResults.find((m) => m.turn === 2)?.rescued).toBe(1);
    expect(fail.minigameResults.find((m) => m.turn === 2)?.rescued).toBe(0);
    expect(ok.traits).toEqual(fail.traits);
    expect(ok.stats.control).toBe(fail.stats.control + 2);
  });
});
