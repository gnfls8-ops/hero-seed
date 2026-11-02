// 데이터 색인. 순수 모듈 (Phaser·DOM 의존 없음)
import { EVENTS } from '../data/events';
import { MAPS } from '../data/maps';
import type { EventDef, MapDef } from './types';

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
export const MAP_BY_ID: Record<string, MapDef> = Object.fromEntries(MAPS.map((m) => [m.id, m]));

export function eventForTurn(turn: number): EventDef | undefined {
  return EVENTS.find((e) => e.turn === turn);
}

export function mapForTurn(turn: number): MapDef | undefined {
  return MAPS.find((m) => m.turn === turn);
}

export function choiceById(eventId: string, choiceId: string) {
  return EVENT_BY_ID[eventId]?.choices.find((c) => c.id === choiceId);
}
