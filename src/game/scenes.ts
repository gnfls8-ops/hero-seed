// Phaser 장면: 도트 방(육성)과 구조 미니게임. 상태는 읽기만 하고 명령은 UI 쪽 함수가 보낸다.
import Phaser from 'phaser';
import type { GameState, MinigameSnapshot, Mood, Teaching } from '../core/types';
import { MAP_BY_ID } from '../core/registry';
import { dominantTeaching, classifyEnding } from '../core/ending';
import { SPRITES, spriteCanvas, PALETTE } from './sprites';
import { DIR_VEC } from '../core/rescue';

export interface Bridge {
  get(): GameState;
  subscribe(fn: (s: GameState, prev: GameState) => void): () => void;
}

let bridge: Bridge | null = null;
export function setBridge(b: Bridge) {
  bridge = b;
}

const hex = (c: string) => Phaser.Display.Color.HexStringToColor(c).color;
const C = (k: string) => hex(PALETTE[k] ?? '#ff00ff');

function ensureTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('tex-ready')) return;
  for (const name of Object.keys(SPRITES)) {
    const tile = ['floor', 'wall', 'debris', 'exit', 'doll', 'doll-red', 'doll-blue', 'citizen', 'citizen-b', 'evidence'].includes(name) || name.startsWith('mini-');
    scene.textures.addCanvas(name, spriteCanvas(name, tile ? 2 : 1));
  }
  const dot = document.createElement('canvas');
  dot.width = dot.height = 2;
  const ctx = dot.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 2, 2);
  scene.textures.addCanvas('dot', dot);
  scene.textures.addCanvas('tex-ready', document.createElement('canvas'));
}

export const ROOM_SIZE = { w: 192, h: 128 };
export const RESCUE_SIZE = { w: 216, h: 216 };

// ───────────────────────────────── 방 장면
const SKY_BY_TURN = ['#9fd8ea', '#9fd8ea', '#b7d6e0', '#e8b98a', '#c9837a', '#5d4f7a'];

export class RoomScene extends Phaser.Scene {
  private unsub: (() => void) | null = null;
  private child!: Phaser.GameObjects.Image;
  private float!: Phaser.GameObjects.Rectangle;
  private deco!: Phaser.GameObjects.Container;
  private sky!: Phaser.GameObjects.Rectangle;
  private mood: Mood = 'neutral';
  private lean: Teaching | null = null;
  private adultMode = false;
  private t = 0;

  constructor() {
    super('room');
  }

  create() {
    ensureTextures(this);
    const s = bridge!.get();
    this.adultMode = isAdultPhase(s);
    if (this.adultMode) this.buildAdult(s);
    else this.buildRoom(s);
    this.unsub = bridge!.subscribe((ns) => this.sync(ns));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsub?.();
      this.unsub = null;
    });
  }

  private buildRoom(s: GameState) {
    const g = this.add.graphics();
    // 벽, 바닥
    g.fillStyle(C('w')).fillRect(0, 0, 192, 84);
    g.fillStyle(hex('#e9e1cf')).fillRect(0, 76, 192, 8);
    g.fillStyle(C('m')).fillRect(0, 84, 192, 44);
    g.fillStyle(C('M'));
    for (let x = 0; x < 192; x += 24) g.fillRect(x, 84, 1, 44);
    g.fillRect(0, 84, 192, 1);
    // 창문
    this.sky = this.add.rectangle(24, 14, 48, 34, hex(SKY_BY_TURN[s.turn - 1] ?? SKY_BY_TURN[0]!)).setOrigin(0);
    const wf = this.add.graphics();
    wf.lineStyle(2, C('M')).strokeRect(24, 14, 48, 34);
    wf.fillStyle(C('M')).fillRect(47, 14, 2, 34);
    // 침대
    g.fillStyle(C('M')).fillRect(138, 70, 50, 26);
    g.fillStyle(C('b')).fillRect(140, 66, 46, 18);
    g.fillStyle(C('w')).fillRect(170, 62, 16, 8);
    // 책상과 스탠드
    g.fillStyle(C('M')).fillRect(8, 64, 40, 6).fillRect(10, 70, 4, 26).fillRect(42, 70, 4, 26);
    g.fillStyle(C('y')).fillRect(14, 54, 8, 6);
    g.fillStyle(C('G')).fillRect(17, 60, 2, 4);
    // 화분
    g.fillStyle(C('o')).fillRect(112, 92, 12, 10);
    g.fillStyle(C('n')).fillRect(110, 80, 16, 12);
    g.fillStyle(C('N')).fillRect(116, 76, 4, 6);
    this.deco = this.add.container(0, 0);
    this.child = this.add.image(96, 104, `child-${s.mood}`).setOrigin(0.5, 1).setScale(2);
    this.float = this.add.rectangle(110, 70, 8, 2, C('g'));
    this.mood = s.mood;
    this.lean = dominantTeaching(s.eventHistory);
    this.drawDeco();
  }

  private drawDeco() {
    this.deco.removeAll(true);
    const add = (o: Phaser.GameObjects.GameObject) => this.deco.add(o);
    const g = this.add.graphics();
    add(g);
    // 성향에 따라 방 소품이 달라진다
    if (this.lean === 'protect') {
      g.fillStyle(C('w')).fillRect(90, 24, 22, 18);
      g.lineStyle(1, C('G')).strokeRect(90, 24, 22, 18);
      g.fillStyle(C('r')).fillRect(99, 27, 4, 12).fillRect(95, 31, 12, 4);
    } else if (this.lean === 'outside') {
      g.fillStyle(C('c')).fillRect(86, 22, 30, 22);
      g.lineStyle(1, C('G')).strokeRect(86, 22, 30, 22);
      g.lineStyle(1, C('r')).strokeCircle(96, 30, 4).strokeCircle(108, 37, 3);
      g.fillStyle(C('k')).fillRect(24, 58, 12, 6);
    } else if (this.lean === 'control') {
      g.fillStyle(C('y')).fillRect(96, 30, 12, 10).fillRect(100, 40, 4, 4).fillRect(97, 44, 10, 2);
      g.fillStyle(C('g')).fillRect(150, 58, 14, 4).fillRect(156, 54, 8, 4);
    }
  }

  private buildAdult(s: GameState) {
    const type = classifyEnding(s.traits).type;
    const g = this.add.graphics();
    const skyTop = type === 'white' ? '#6a8fd0' : type === 'dark' ? '#2a2440' : '#3a1622';
    g.fillStyle(hex(skyTop)).fillRect(0, 0, 192, 128);
    g.fillStyle(hex('#f6f2e6'));
    for (let i = 0; i < 18; i++) g.fillRect((i * 37) % 192, (i * 23) % 60, 1, 1);
    // 도시 실루엣
    const bld = type === 'villain' ? C('R') : C('G');
    g.fillStyle(bld);
    [[0, 70, 26], [24, 56, 20], [46, 74, 30], [80, 50, 18], [100, 66, 28], [130, 58, 22], [154, 72, 40]].forEach(([x, y, w]) => g.fillRect(x!, y!, w!, 128 - y!));
    g.fillStyle(type === 'villain' ? C('r') : C('y'));
    for (let i = 0; i < 26; i++) g.fillRect(4 + ((i * 29) % 184), 76 + ((i * 13) % 30), 2, 2);
    // 옥상
    g.fillStyle(C('k')).fillRect(0, 108, 192, 20);
    g.fillStyle(C('G')).fillRect(0, 106, 192, 2);
    this.add.image(150, 108, 'villain').setOrigin(0.5, 1).setScale(1.5).setAlpha(0.95);
    this.child = this.add.image(84, 108, `adult-${type}`).setOrigin(0.5, 1).setScale(2);
    this.float = this.add.rectangle(-10, -10, 1, 1, 0);
    this.deco = this.add.container(0, 0);
  }

  private sync(s: GameState) {
    const adult = isAdultPhase(s);
    if (adult !== this.adultMode) {
      this.scene.restart();
      return;
    }
    if (adult) return;
    this.sky.fillColor = hex(SKY_BY_TURN[s.turn - 1] ?? SKY_BY_TURN[0]!);
    if (s.mood !== this.mood) {
      this.mood = s.mood;
      this.child.setTexture(`child-${s.mood}`);
      // 표정 변화: 짧게 튀어 오르는 연출
      this.tweens.add({ targets: this.child, scaleY: 2.25, scaleX: 1.8, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
    }
    const lean = dominantTeaching(s.eventHistory);
    if (lean !== this.lean) {
      this.lean = lean;
      this.drawDeco();
    }
  }

  override update(_time: number, delta: number) {
    this.t += delta / 1000;
    if (!this.child) return;
    // 대기 애니메이션: 숨쉬기 + 염동력으로 뜬 숟가락
    const bob = Math.round(Math.sin(this.t * 2.2) * 1);
    this.child.y = (this.adultMode ? 108 : 104) + bob;
    if (!this.adultMode) {
      this.float.x = 112 + Math.round(Math.cos(this.t * 1.3) * 6);
      this.float.y = 62 + Math.round(Math.sin(this.t * 1.7) * 4);
      this.float.rotation = Math.sin(this.t) * 0.4;
    }
  }
}

export function isAdultPhase(s: GameState) {
  return s.phase === 'finaleIntro' || s.phase === 'finale' || s.phase === 'finaleReaction' || s.phase === 'ending';
}

// ───────────────────────────────── 구조 미니게임 장면
const TILE = 24;

export class RescueScene extends Phaser.Scene {
  private unsub: (() => void) | null = null;
  private player!: Phaser.GameObjects.Image;
  private arrow!: Phaser.GameObjects.Graphics;
  private debris = new Map<string, Phaser.GameObjects.Image>();
  private targets = new Map<string, Phaser.GameObjects.Image>();
  private lastSeq = -1;
  private mapId = '';
  private resets = -1;
  private exitPos = { x: 0, y: 0 };

  constructor() {
    super('rescue');
  }

  create() {
    ensureTextures(this);
    const s = bridge!.get().minigameSnapshot;
    if (s) this.build(s);
    this.unsub = bridge!.subscribe((ns) => {
      const snap = ns.minigameSnapshot;
      if (!snap) return;
      if (snap.mapId !== this.mapId || snap.resets !== this.resets) {
        this.children.removeAll(true);
        this.build(snap);
        return;
      }
      this.apply(snap);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsub?.();
      this.unsub = null;
      this.debris.clear();
      this.targets.clear();
    });
  }

  private build(s: MinigameSnapshot) {
    const map = MAP_BY_ID[s.mapId]!;
    this.mapId = s.mapId;
    this.resets = s.resets;
    this.debris.clear();
    this.targets.clear();
    map.rows.forEach((row, y) =>
      [...row].forEach((c, x) => {
        const key = c === '#' ? 'wall' : c === 'O' ? 'exit' : 'floor';
        this.add.image(x * TILE, y * TILE, key).setOrigin(0);
        if (c === 'O') this.exitPos = { x, y };
      }),
    );
    for (const d of s.debris) {
      const [x, y] = d.split(',').map(Number) as [number, number];
      this.debris.set(d, this.add.image(x * TILE + 12, y * TILE + 12, 'debris'));
    }
    for (const t of s.targets) {
      if (t.rescued) continue;
      const tex = t.kind === 'evidence' ? 'evidence' : t.id === 'doll-red' ? 'doll-red' : t.id === 'doll-blue' ? 'doll-blue' : t.id === 'citizen-b' ? 'citizen-b' : t.kind === 'citizen' ? 'citizen' : 'doll';
      const img = this.add.image(t.x * TILE + 12, t.y * TILE + 12, tex);
      this.targets.set(t.id, img);
      // 구조 대상은 살짝 흔들려 눈에 띄게
      this.tweens.add({ targets: img, y: img.y - 1, duration: 600 + (t.x % 3) * 90, yoyo: true, repeat: -1 });
    }
    this.arrow = this.add.graphics();
    this.player = this.add.image(s.x * TILE + 12, s.y * TILE + 12, `mini-${s.facing}`);
    this.lastSeq = s.lastEvent?.seq ?? 0;
    this.drawArrow(s.facing);
  }

  /** 바라보는 방향을 가리키는 작은 삼각형 (플레이어 현재 위치 기준) */
  private drawArrow(facing: MinigameSnapshot['facing']) {
    const v = DIR_VEC[facing];
    const cx = this.player.x + v.dx * 14;
    const cy = this.player.y + v.dy * 14;
    this.arrow.clear();
    this.arrow.fillStyle(C('y'), 1);
    if (facing === 'up') this.arrow.fillTriangle(cx - 4, cy + 2, cx + 4, cy + 2, cx, cy - 3);
    if (facing === 'down') this.arrow.fillTriangle(cx - 4, cy - 2, cx + 4, cy - 2, cx, cy + 3);
    if (facing === 'left') this.arrow.fillTriangle(cx + 2, cy - 4, cx + 2, cy + 4, cx - 3, cy);
    if (facing === 'right') this.arrow.fillTriangle(cx - 2, cy - 4, cx - 2, cy + 4, cx + 3, cy);
  }

  private apply(s: MinigameSnapshot) {
    const ev = s.lastEvent;
    this.player.setTexture(`mini-${s.facing}`);
    const px = s.x * TILE + 12;
    const py = s.y * TILE + 12;
    const fresh = ev && ev.seq !== this.lastSeq;
    this.lastSeq = ev?.seq ?? this.lastSeq;
    if (fresh && ev.kind === 'move') {
      this.tweens.killTweensOf(this.player);
      this.tweens.add({
        targets: this.player,
        x: px,
        y: py,
        duration: 90,
        ease: 'Quad.easeOut',
        onUpdate: () => this.drawArrow(s.facing),
        onComplete: () => this.drawArrow(s.facing),
      });
    } else {
      this.tweens.killTweensOf(this.player);
      this.player.setPosition(px, py);
      this.drawArrow(s.facing);
    }
    if (fresh && ev.kind === 'bump') {
      const v = DIR_VEC[s.facing];
      this.tweens.add({ targets: this.player, x: px + v.dx * 2, y: py + v.dy * 2, duration: 50, yoyo: true, onComplete: () => this.player.setPosition(px, py) });
    }
    if (fresh && ev.kind === 'denied') {
      this.player.setTint(C('r'));
      this.time.delayedCall(160, () => this.player.clearTint());
    }
    // 잔해 제거
    for (const [k, img] of this.debris) {
      if (!s.debris.includes(k)) {
        this.debris.delete(k);
        this.burst(img.x, img.y, C('m'));
        this.tweens.add({ targets: img, y: img.y - 10, alpha: 0, scale: 1.3, duration: 260, onComplete: () => img.destroy() });
      }
    }
    // 구조 완료
    for (const t of s.targets) {
      const img = this.targets.get(t.id);
      if (t.rescued && img) {
        this.targets.delete(t.id);
        this.tweens.killTweensOf(img);
        this.burst(img.x, img.y, C('y'));
        this.tweens.add({
          targets: img,
          y: img.y - 8,
          duration: 140,
          yoyo: true,
          onComplete: () =>
            this.tweens.add({
              targets: img,
              x: this.exitPos.x * TILE + 12,
              y: this.exitPos.y * TILE + 12,
              alpha: 0,
              scale: 0.5,
              duration: 380,
              onComplete: () => img.destroy(),
            }),
        });
      }
    }
  }

  private burst(x: number, y: number, color: number) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const d = this.add.image(x, y, 'dot').setTint(color);
      this.tweens.add({ targets: d, x: x + Math.cos(a) * 12, y: y + Math.sin(a) * 12, alpha: 0, duration: 300, onComplete: () => d.destroy() });
    }
  }
}
