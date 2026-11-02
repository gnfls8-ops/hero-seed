import type { Store } from './store';
import type { SaveStore } from '../core/save';
import type { PixelView } from '../game/pixel';
import type { AudioFx } from './audio';
import type { Modals } from './modal';
import type { Dir, GameState } from '../core/types';

export interface Ctx {
  store: Store;
  saver: SaveStore;
  pixel: PixelView;
  audio: AudioFx;
  modals: Modals;
  dev: boolean;
  cmd: {
    dir(d: Dir): void;
    act(): void;
    reset(): void;
    finish(): void;
  };
  goTitle(): void;
  newGame(): void;
  openRecords(): void;
  openSave(): void;
  openSettings(): void;
  toast(msg: string): void;
}

export interface View {
  el: HTMLElement;
  update?(s: GameState, prev: GameState): void;
  destroy?(): void;
  /** 단계 진입 시 포커스할 요소 */
  focus?: HTMLElement | null;
}
