// 조건식 평가와 문단 변형 선택. 문자열 eval 없이 허용된 연산자만 처리한다.
import type { CompareOp, Condition, GameState, TextBlock, Teaching, EventRecord } from './types';
import { dominantTeaching } from './ending';
import { EVENT_BY_ID } from './registry';

export function compare(a: number, op: CompareOp, b: number): boolean {
  switch (op) {
    case '>=':
      return a >= b;
    case '>':
      return a > b;
    case '<=':
      return a <= b;
    case '<':
      return a < b;
    case '==':
      return a === b;
    case '!=':
      return a !== b;
    default:
      return false;
  }
}

/** 평가 시점 컨텍스트: asOfTurn보다 이전(또는 이하) 기록만 본다 → 회고에서 다시 읽어도 같은 문장 */
export interface EvalContext {
  state: GameState;
  history: EventRecord[];
}

export function contextAt(state: GameState, maxTurnInclusive: number): EvalContext {
  return { state, history: state.eventHistory.filter((r) => r.turn <= maxTurnInclusive) };
}

export function evalCondition(c: Condition, ctx: EvalContext): boolean {
  const s = ctx.state;
  switch (c.type) {
    case 'teaching':
      return ctx.history.some((r) => r.eventId === c.eventId && r.teaching === c.is);
    case 'stat':
      return compare(s.stats[c.key], c.op, c.value);
    case 'trait':
      return compare(s.traits[c.key], c.op, c.value);
    case 'minigameTier':
      return s.minigameResults.some((m) => m.turn === c.turn && m.tier === c.is);
    case 'minigameFirst':
      return s.minigameResults.some((m) => m.turn === c.turn && m.order[0] === c.targetId);
    case 'minigameRescued':
      return s.minigameResults.some((m) => m.turn === c.turn && m.order.includes(c.targetId) === c.is);
    case 'dominantTeaching':
      return dominantTeaching(ctx.history) === c.is;
    case 'eventSeen':
      return ctx.history.some((r) => r.eventId === c.eventId);
    case 'memoryTag':
      return ctx.history.some((r) => {
        const ch = EVENT_BY_ID[r.eventId]?.choices.find((x) => x.id === r.choiceId);
        return !!ch && ch.memoryTags.includes(c.tag);
      });
    default:
      return false;
  }
}

export function evalAll(conds: Condition[] | undefined, ctx: EvalContext): boolean {
  return (conds ?? []).every((c) => evalCondition(c, ctx));
}

export function memoryOf(rec: EventRecord): string {
  const ch = EVENT_BY_ID[rec.eventId]?.choices.find((x) => x.id === rec.choiceId);
  return ch?.memory ?? '';
}

/** 가장 많이 쌓인 가르침의 첫 기억 (6턴 회수용) */
export function firstMemoryOfDominant(history: EventRecord[]): { turn: number; text: string; teaching: Teaching } | null {
  const t = dominantTeaching(history);
  if (!t) return null;
  const first = history.find((r) => r.teaching === t);
  if (!first) return null;
  return { turn: first.turn, text: memoryOf(first), teaching: t };
}

function fillTokens(text: string, ctx: EvalContext): string {
  if (!text.includes('{')) return text;
  const first = firstMemoryOfDominant(ctx.history);
  const last = ctx.history[ctx.history.length - 1];
  return text
    .replaceAll('{firstmem}', first?.text ?? '')
    .replaceAll('{firstturn}', String(first?.turn ?? 1))
    .replaceAll('{lastmem}', last ? memoryOf(last) : '');
}

export function resolveBlocks(blocks: TextBlock[], ctx: EvalContext): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    if (typeof b === 'string') {
      out.push(fillTokens(b, ctx));
      continue;
    }
    const v = b.variants.find((x) => evalAll(x.when, ctx));
    if (v) out.push(fillTokens(v.text, ctx));
  }
  return out;
}
