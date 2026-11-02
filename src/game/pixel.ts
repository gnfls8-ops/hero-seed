// Phaser 게임 하나를 만들고, 캔버스를 방 패널과 미니게임 영역 사이로 옮긴다.
// 반복 생성하지 않으므로 장면 전환 시 누수가 생기지 않는다.
import Phaser from 'phaser';
import { RoomScene, RescueScene, ROOM_SIZE, RESCUE_SIZE } from './scenes';

export type PixelMode = 'room' | 'rescue' | 'none';

export class PixelView {
  private game: Phaser.Game | null = null;
  private host: HTMLDivElement;
  private mode: PixelMode = 'none';
  private fitTarget: HTMLElement | null = null;
  private ro: ResizeObserver;
  private ready: Promise<void>;
  failed = false;

  constructor() {
    this.host = document.createElement('div');
    this.host.className = 'pixel-host';
    this.host.setAttribute('aria-hidden', 'true');
    this.ro = new ResizeObserver(() => this.fit());
    this.ready = new Promise((resolve) => {
      try {
        this.game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: this.host,
          width: ROOM_SIZE.w,
          height: ROOM_SIZE.h,
          pixelArt: true,
          backgroundColor: '#1d1b2c',
          scale: { mode: Phaser.Scale.NONE },
          input: { keyboard: false, mouse: false, touch: false, gamepad: false },
          audio: { noAudio: true },
          banner: false,
          fps: { target: 60, smoothStep: true },
          scene: [],
          callbacks: { postBoot: () => resolve() },
        });
        this.game.scene.add('room', RoomScene, false);
        this.game.scene.add('rescue', RescueScene, false);
      } catch (e) {
        console.error(e);
        this.failed = true;
        resolve();
      }
    });
  }

  get element(): HTMLElement {
    return this.host;
  }

  /** 지정한 컨테이너에 캔버스를 붙이고 장면을 바꾼다 */
  async attach(container: HTMLElement | null, mode: PixelMode): Promise<void> {
    await this.ready;
    if (!this.game) return;
    if (container && this.host.parentElement !== container) container.appendChild(this.host);
    if (this.fitTarget !== container) {
      if (this.fitTarget) this.ro.unobserve(this.fitTarget);
      this.fitTarget = container;
      if (container) this.ro.observe(container);
    }
    if (mode === this.mode) {
      this.fit();
      return;
    }
    const sm = this.game.scene;
    if (this.mode !== 'none') sm.stop(this.mode);
    this.mode = mode;
    if (mode === 'none') {
      this.game.pause();
      return;
    }
    const size = mode === 'room' ? ROOM_SIZE : RESCUE_SIZE;
    this.game.scale.resize(size.w, size.h);
    sm.start(mode);
    this.game.resume();
    this.fit();
  }

  /** 화면이 보이지 않을 때 렌더링을 멈춘다 */
  setVisible(visible: boolean) {
    if (!this.game || this.mode === 'none') return;
    if (visible) this.game.resume();
    else this.game.pause();
  }

  /** 종횡비를 유지한 채 컨테이너에 맞춘다. 2배 이상이면 정수 배율, 작으면 비정수 허용. */
  fit() {
    if (!this.game || !this.fitTarget || this.mode === 'none') return;
    const size = this.mode === 'room' ? ROOM_SIZE : RESCUE_SIZE;
    const r = this.fitTarget.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    let s = Math.min(r.width / size.w, r.height / size.h);
    if (s >= 2) s = Math.floor(s);
    s = Math.max(0.5, s);
    this.host.style.setProperty('--canvas-w', `${Math.floor(size.w * s)}px`);
    this.host.style.setProperty('--canvas-h', `${Math.floor(size.h * s)}px`);
    this.host.dataset.scale = s.toFixed(2);
  }
}
