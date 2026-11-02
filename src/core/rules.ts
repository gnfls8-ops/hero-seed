import { BALANCE } from '../data/balance';
import type { ActivityId, Stats, Teaching, Traits, TraitKey, StatKey } from './types';
import { ACTIVITY_EFFECTS } from '../data/activities';

export function clamp(v: number, min: number = BALANCE.statRange.min, max: number = BALANCE.statRange.max): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.round(v)));
}

export function addStats(stats: Stats, delta: Partial<Stats>): Stats {
  const out = { ...stats };
  for (const k of Object.keys(delta) as StatKey[]) {
    out[k] = clamp(out[k] + (delta[k] ?? 0));
  }
  return out;
}

export function addTraits(traits: Traits, delta: Partial<Traits>): Traits {
  const out = { ...traits };
  for (const k of Object.keys(delta) as TraitKey[]) {
    out[k] = clamp(out[k] + (delta[k] ?? 0));
  }
  return out;
}

/** 일정 3칸의 합산 능력 변화 (범위 제한 전) */
export function scheduleDelta(schedule: ActivityId[]): Partial<Stats> {
  const d: Stats = { power: 0, control: 0, trust: 0 };
  for (const a of schedule) {
    const e: { power?: number; control?: number; trust?: number } = ACTIVITY_EFFECTS[a];
    d.power += e.power ?? 0;
    d.control += e.control ?? 0;
    d.trust += e.trust ?? 0;
  }
  const out: Partial<Stats> = {};
  (Object.keys(d) as StatKey[]).forEach((k) => {
    if (d[k] !== 0) out[k] = d[k];
  });
  return out;
}

export function teachingDelta(t: Teaching): Partial<Traits> {
  return { ...BALANCE.teachingEffects[t] };
}

export function canAddToSchedule(schedule: Array<ActivityId | null>, activity: ActivityId): boolean {
  const count = schedule.filter((s) => s === activity).length;
  return count < BALANCE.maxSameActivityPerMonth;
}
