// 하나의 상태 저장소. UI(DOM)와 Phaser 장면이 같은 상태를 구독한다.
import { reduce, type Action } from '../core/game';
import type { GameState } from '../core/types';
import type { SaveStore } from '../core/save';

type Listener = (s: GameState, prev: GameState) => void;

export class Store {
  private listeners = new Set<Listener>();
  /** 자동 저장 상태 변화 알림 */
  onSaveStatus: (ok: boolean) => void = () => {};

  constructor(private state: GameState, private saver: SaveStore) {}

  get(): GameState {
    return this.state;
  }

  dispatch(action: Action): GameState {
    const prev = this.state;
    const next = reduce(prev, action);
    if (next !== prev) this.commit(next, prev);
    return next;
  }

  /** 검증을 통과한 외부 상태로 교체 (이어하기·가져오기·개발용) */
  replace(next: GameState): void {
    const prev = this.state;
    this.commit(next, prev);
  }

  /** 게임 시작 전(저장 없음) 설정 변경: 진행 저장은 만들지 않고 설정만 저장 */
  patchSettingsLocal(p: Partial<GameState['settings']>): void {
    const prev = this.state;
    this.state = { ...prev, settings: { ...prev.settings, ...p } };
    this.saver.saveSettings(this.state.settings);
    for (const l of [...this.listeners]) l(this.state, prev);
  }

  private commit(next: GameState, prev: GameState) {
    this.state = next;
    // 단계 전환·선택 확정·미니게임 유효 행동마다 작은 단일 스냅샷으로 저장
    const ok = this.saver.save(next);
    this.onSaveStatus(ok);
    this.saver.saveSettings(next.settings);
    for (const l of [...this.listeners]) l(next, prev);
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}
