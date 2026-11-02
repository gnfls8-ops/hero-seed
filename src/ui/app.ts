// 화면 전환(타이틀 ↔ 게임), 레이아웃 재배치, 입력·메뉴 연결.
import type { Ctx, View } from './ctx';
import type { Dir, GameState, Settings } from '../core/types';
import { Store } from './store';
import { SaveStore, type LoadResult } from '../core/save';
import { createInitialState, DEFAULT_SETTINGS } from '../core/game';
import { isFinished } from '../core/rescue';
import { PixelView } from '../game/pixel';
import { setBridge } from '../game/scenes';
import { spriteURL } from '../game/sprites';
import { AudioFx } from './audio';
import { Modals } from './modal';
import { h, btn, clear, sprite } from './dom';
import { phaseView } from './views/phases';
import { minigameView } from './views/minigame';
import { endingView } from './views/ending';
import { recordsBody, saveBody, settingsBody, importFlow } from './views/menus';
import { mountDevPanel } from './views/dev';
import { GAME_TITLE, GAME_SUBTITLE, UI, NAMES } from '../data/strings';
import { BALANCE } from '../data/balance';
import { PHASE_LABEL, STAT_LABEL, idleLine, traitDescriptions } from './describe';

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
};

type Screen = 'title' | 'game';
type Mode = 'nurture' | 'mg';

export class App {
  private ctx: Ctx;
  private store: Store;
  private screen: Screen = 'title';
  private mode: Mode | null = null;
  private view: View | null = null;
  private viewKey = '';
  private hasSave: boolean;
  private paused = false;
  private idleIndex = 0;
  private main: HTMLElement;
  private overlay: HTMLElement;
  private toastEl: HTMLElement;
  private parts: {
    topbar?: HTMLElement;
    month?: HTMLElement;
    saveChip?: HTMLElement;
    devChip?: HTMLElement;
    status?: { bars: Record<string, HTMLElement>; nums: Record<string, HTMLElement>; traits: HTMLElement; month: HTMLElement };
    roomStage?: HTMLElement;
    bubble?: HTMLElement;
    phase?: HTMLElement;
  } = {};

  constructor(private root: HTMLElement, saver: SaveStore, private load: LoadResult, private dev: boolean) {
    const settings: Settings = (load.status === 'ok' ? load.state.settings : null) ?? saver.loadSettings() ?? DEFAULT_SETTINGS;
    const initial = load.status === 'ok' ? load.state : createInitialState(newRunId(), settings);
    this.hasSave = load.status === 'ok';
    this.store = new Store(initial, saver);
    this.main = h('main', { class: 'app-main' });
    this.overlay = h('div', { class: 'overlay-root' });
    this.toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite', hidden: true });
    clear(root);
    root.append(this.main, this.overlay, this.toastEl);
    const pixel = new PixelView();
    const audio = new AudioFx();
    audio.muted = settings.muted;
    const modals = new Modals(this.overlay);
    setBridge({ get: () => this.store.get(), subscribe: (fn) => this.store.subscribe(fn) });

    this.ctx = {
      store: this.store,
      saver,
      pixel,
      audio,
      modals,
      dev,
      cmd: {
        dir: (d) => this.cmdDir(d),
        act: () => this.cmdAct(),
        reset: () => this.store.dispatch({ type: 'mgReset' }),
        finish: () => void this.cmdFinish(),
      },
      goTitle: () => this.showTitle(),
      newGame: () => void this.newGame(),
      openRecords: () => this.openRecords(),
      openSave: () => this.openSave(),
      openSettings: () => this.openSettings(),
      toast: (m) => this.toast(m),
    };

    this.store.subscribe((s, prev) => this.onState(s, prev));
    this.store.onSaveStatus = () => this.updateSaveChip();
    this.applySettings(settings);
    this.bindKeys();
    document.addEventListener('visibilitychange', () => pixel.setVisible(!document.hidden));
    if (dev) mountDevPanel(this.ctx, this.overlay);
    this.showTitle();
    if (load.status === 'corrupt') this.showCorrupt(load);
  }

  // ───────── 타이틀

  private showTitle() {
    this.screen = 'title';
    this.mode = null;
    this.destroyView();
    this.paused = false;
    void this.ctx.pixel.attach(null, 'none');
    clear(this.main);
    this.main.className = 'app-main title-screen';
    document.body.dataset.screen = 'title';
    const s = this.store.get();
    const cont = this.hasSave
      ? btn([h('span', null, '이어하기'), h('small', null, `${s.turn}월차 · ${PHASE_LABEL[s.phase]}`)], () => this.enterGame(), { class: 'btn btn-primary btn-big', dataset: { testid: 'btn-continue' } })
      : null;
    const newBtn = btn('새 게임', () => void this.newGame(), { class: `btn btn-big ${this.hasSave ? '' : 'btn-primary'}`, dataset: { testid: 'btn-new-game' } });
    this.main.append(
      h('div', { class: 'title-card' },
        h('div', { class: 'title-art' }, sprite('child-happy', spriteURL('child-happy'), 'title-sprite', ''), sprite('icon-training', spriteURL('icon-training'), 'title-spark', '')),
        h('h1', { class: 'game-title' }, GAME_TITLE),
        h('p', { class: 'game-sub' }, GAME_SUBTITLE),
        h('div', { class: 'title-buttons' },
          cont, newBtn,
          importFlow(this.ctx, () => {
            this.hasSave = true;
            this.enterGame();
          }),
          btn('설정', () => this.openSettings(), { class: 'btn', dataset: { testid: 'btn-settings' } }),
        ),
        !this.ctx.saver.available ? h('p', { class: 'warn-line', dataset: { testid: 'storage-warning' } }, UI.storageUnavailable) : null,
        h('p', { class: 'muted small' }, 'PC: 키보드·마우스 / 모바일: 터치 · 한 회차 약 10~15분 · 진행은 이 브라우저에 자동 저장됩니다.'),
      ),
    );
    (cont ?? newBtn).focus();
  }

  private showCorrupt(load: Extract<LoadResult, { status: 'corrupt' }>) {
    const actions = [
      { label: '새 게임으로 시작', testid: 'corrupt-new', onClick: () => { this.startFresh(); } },
    ];
    if (load.backup) {
      const b = load.backup;
      actions.push({ label: `백업 복원 (${b.turn}월차)`, testid: 'corrupt-restore', onClick: () => { this.store.replace(b); this.hasSave = true; this.showTitle(); } });
    }
    this.ctx.modals.open({
      title: '저장 데이터를 읽을 수 없습니다',
      closable: false,
      testid: 'corrupt-dialog',
      body: h('div', null,
        h('p', null, '자동 저장된 진행이 손상되었습니다.'),
        h('p', { class: 'muted small' }, `사유: ${load.error}`),
        h('p', null, load.backup ? '이전 정상 저장(백업)으로 복원하거나 새 게임을 시작할 수 있습니다.' : '복원할 백업이 없습니다. 새 게임을 시작해 주세요.'),
      ),
      actions: actions.map((a, i) => ({ ...a, primary: i === actions.length - 1 })),
    });
  }

  private startFresh() {
    const settings = this.store.get().settings;
    this.store.replace(createInitialState(newRunId(), settings));
    this.hasSave = true;
    this.enterGame();
  }

  private async newGame() {
    if (this.hasSave) {
      const ok = await this.ctx.modals.confirm('새 회차 시작', '기존 진행을 덮어쓰고 처음부터 시작할까요? 필요하면 먼저 저장 파일을 내보내 두세요.', '덮어쓰고 시작', '취소', 'confirm-new');
      if (!ok) return;
    }
    this.startFresh();
  }

  // ───────── 게임 화면

  private enterGame() {
    this.screen = 'game';
    this.mode = null;
    this.viewKey = '';
    this.render(this.store.get(), this.store.get());
  }

  private onState(s: GameState, prev: GameState) {
    if (s.settings !== prev.settings) this.applySettings(s.settings);
    if (this.screen === 'game') this.render(s, prev);
  }

  private render(s: GameState, prev: GameState) {
    const mode: Mode = s.phase === 'minigame' && s.minigameSnapshot ? 'mg' : 'nurture';
    if (mode !== this.mode) this.buildSkeleton(mode);
    this.updateTopbar(s);
    if (mode === 'nurture') this.updateStatus(s, prev);
    const key = `${s.phase}:${s.turn}:${s.runId}`;
    if (key !== this.viewKey) {
      this.destroyView();
      this.viewKey = key;
      if (mode === 'mg') {
        const v = minigameView(this.ctx, s);
        this.view = v;
        this.main.querySelector('.mg-host')!.appendChild(v.el);
        void this.ctx.pixel.attach(v.stage, 'rescue');
      } else {
        const v = s.phase === 'ending' ? endingView(this.ctx, s) : phaseView(this.ctx, s);
        this.view = v;
        this.parts.phase!.appendChild(v.el);
        void this.ctx.pixel.attach(this.parts.roomStage!, 'room');
      }
      if (prev.turn !== s.turn) this.idleIndex = 0;
      this.updateBubble(s);
      const f = this.view.focus;
      if (f) requestAnimationFrame(() => f.focus({ preventScroll: false }));
    } else {
      this.view?.update?.(s, prev);
      if (prev.eventHistory !== s.eventHistory) this.updateBubble(s);
    }
  }

  private destroyView() {
    this.view?.destroy?.();
    this.view?.el.remove();
    this.view = null;
    this.viewKey = '';
  }

  private buildSkeleton(mode: Mode) {
    this.destroyView();
    this.mode = mode;
    clear(this.main);
    this.parts = {};
    document.body.dataset.screen = mode === 'mg' ? 'minigame' : 'nurture';
    this.main.className = `app-main game-screen mode-${mode}`;
    const topbar = this.buildTopbar();
    if (mode === 'mg') {
      this.main.append(topbar, h('div', { class: 'mg-host' }));
      return;
    }
    const bars: Record<string, HTMLElement> = {};
    const nums: Record<string, HTMLElement> = {};
    const statRows = (['power', 'control', 'trust'] as const).map((k) => {
      bars[k] = h('i');
      nums[k] = h('strong', { dataset: { testid: `stat-${k}` } });
      return h('li', { class: `stat stat-${k}` }, h('span', { class: 'stat-name' }, STAT_LABEL[k]), h('span', { class: 'bar' }, bars[k]), nums[k]);
    });
    const traits = h('ul', { class: 'trait-desc', 'aria-label': '하람의 성향', dataset: { testid: 'trait-desc' } });
    const monthEl = h('span', { class: 'status-month' });
    const status = h('section', { class: 'card status-card', 'aria-label': `${NAMES.child}의 상태` },
      h('div', { class: 'status-head' }, sprite('child-neutral', spriteURL('child-neutral'), 'portrait small'), h('div', null, h('h2', { class: 'status-name' }, `${NAMES.child} · 여덟 살`), monthEl)),
      h('ul', { class: 'stat-list' }, statRows),
      traits,
    );
    this.parts.status = { bars, nums, traits, month: monthEl };
    const stage = h('div', { class: 'room-stage' });
    const bubble = h('p', { class: 'bubble', 'aria-live': 'polite', dataset: { testid: 'idle-line' } });
    const talk = btn('말 걸기', () => {
      this.idleIndex += 1;
      this.ctx.audio.play('select');
      this.updateBubble(this.store.get());
    }, { class: 'btn btn-small talk-btn', dataset: { testid: 'btn-talk' } });
    const room = h('section', { class: 'card room-card', 'aria-label': '하람의 방' }, stage, h('div', { class: 'bubble-row' }, bubble, talk));
    const phase = h('div', { class: 'phase-host' });
    this.parts.roomStage = stage;
    this.parts.bubble = bubble;
    this.parts.phase = phase;
    this.main.append(topbar, h('div', { class: 'nurture-grid' }, status, room, phase));
  }

  private buildTopbar(): HTMLElement {
    const month = h('span', { class: 'chip month-chip', dataset: { testid: 'month-chip' } });
    const saveChip = btn('자동 저장 불가', () => this.openSave(), { class: 'chip warn-chip', hidden: true, dataset: { testid: 'save-warning' } });
    const devChip = h('span', { class: 'chip dev-chip', hidden: true }, '개발용 변경됨');
    const bar = h('header', { class: 'topbar' },
      h('span', { class: 'brand' }, GAME_TITLE),
      month, saveChip, devChip,
      h('nav', { class: 'top-actions', 'aria-label': '메뉴' },
        btn('기록', () => this.openRecords(), { class: 'btn btn-small', dataset: { testid: 'btn-records' } }),
        btn('저장', () => this.openSave(), { class: 'btn btn-small', dataset: { testid: 'btn-save' } }),
        btn('설정', () => this.openSettings(), { class: 'btn btn-small', dataset: { testid: 'btn-settings-top' } }),
        btn('일시정지', () => this.openPause(), { class: 'btn btn-small', dataset: { testid: 'btn-pause' }, 'aria-label': '일시정지 (Esc)' }),
      ),
    );
    this.parts.topbar = bar;
    this.parts.month = month;
    this.parts.saveChip = saveChip;
    this.parts.devChip = devChip;
    return bar;
  }

  private updateTopbar(s: GameState) {
    if (this.parts.month) this.parts.month.textContent = s.phase.startsWith('finale') || s.phase === 'ending' ? `몇 년 뒤 · ${PHASE_LABEL[s.phase]}` : `${s.turn}/${BALANCE.totalTurns}월차 · ${PHASE_LABEL[s.phase]}`;
    if (this.parts.devChip) this.parts.devChip.hidden = !s.devModified;
    this.updateSaveChip();
  }

  private updateSaveChip() {
    if (this.parts.saveChip) this.parts.saveChip.hidden = this.ctx.saver.available;
  }

  private updateStatus(s: GameState, prev: GameState) {
    const st = this.parts.status;
    if (!st) return;
    for (const k of ['power', 'control', 'trust'] as const) {
      st.nums[k]!.textContent = String(s.stats[k]);
      st.bars[k]!.style.width = `${s.stats[k]}%`;
      if (prev.stats[k] !== s.stats[k]) st.nums[k]!.classList.add('flash');
      else st.nums[k]!.classList.remove('flash');
    }
    clear(st.traits);
    for (const d of traitDescriptions(s.traits)) st.traits.appendChild(h('li', null, d));
    st.month.textContent = s.phase.startsWith('finale') || s.phase === 'ending' ? '몇 년 뒤' : `${s.turn}월차 / ${BALANCE.totalTurns}`;
  }

  private updateBubble(s: GameState) {
    if (!this.parts.bubble) return;
    this.parts.bubble.textContent = s.phase.startsWith('finale') || s.phase === 'ending' ? '…' : `“${idleLine(s, this.idleIndex)}”`;
  }

  // ───────── 입력

  private inputBlocked(): boolean {
    return this.screen !== 'game' || this.paused || this.ctx.modals.isOpen() || document.hidden || this.store.get().phase !== 'minigame';
  }

  private cmdDir(d: Dir) {
    if (this.inputBlocked()) return;
    const s = this.store.dispatch({ type: 'mgDir', dir: d });
    const k = s.minigameSnapshot?.lastEvent?.kind;
    this.ctx.audio.play(k === 'move' ? 'step' : k === 'denied' ? 'denied' : 'bump');
  }

  private cmdAct() {
    if (this.inputBlocked()) return;
    const before = this.store.get().minigameSnapshot?.lastEvent?.seq;
    const s = this.store.dispatch({ type: 'mgAct' });
    const le = s.minigameSnapshot?.lastEvent;
    if (!le || le.seq === before) return;
    this.ctx.audio.play(le.kind === 'clear' ? 'action' : le.kind === 'rescue' ? 'rescue' : le.kind === 'denied' ? 'denied' : 'bump');
  }

  private async cmdFinish() {
    const s = this.store.get();
    const sn = s.minigameSnapshot;
    if (s.phase !== 'minigame' || !sn) return;
    if (!isFinished(sn)) {
      const ok = await this.ctx.modals.confirm('결과 확정', `아직 행동력이 ${sn.ap} 남았습니다. 지금 결과를 확정할까요? 보상은 확정한 결과로 한 번만 반영됩니다.`, '결과 확정', '계속 구조하기', 'confirm-finish');
      if (!ok) return;
    }
    this.ctx.audio.play('result');
    this.store.dispatch({ type: 'mgFinish', turn: this.store.get().turn });
  }

  private bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (this.ctx.modals.isOpen()) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.key === 'Escape' && this.screen === 'game') {
        e.preventDefault();
        this.openPause();
        return;
      }
      if (this.store.get().phase !== 'minigame' || this.screen !== 'game') return;
      const dir = KEY_DIR[e.code] ?? KEY_DIR[e.key];
      const isAct = e.code === 'Space' || e.code === 'KeyE' || e.key === ' ' || e.key === 'e' || e.key === 'E';
      if (!dir && !isAct) return;
      e.preventDefault();
      // 운영체제 키 반복은 무시: 누른 최초 1회만 실행
      if (e.repeat) return;
      if (dir) this.cmdDir(dir);
      else this.cmdAct();
    });
    window.addEventListener('keyup', (e) => {
      if (this.store.get().phase === 'minigame' && (e.code === 'Space' || e.key === ' ') && !this.ctx.modals.isOpen()) e.preventDefault();
    });
  }

  // ───────── 메뉴

  private openPause() {
    if (this.ctx.modals.isOpen()) return;
    this.paused = true;
    this.ctx.pixel.setVisible(false);
    this.ctx.modals.open({
      title: '일시정지',
      testid: 'pause-dialog',
      body: h('p', null, '진행 상태는 자동 저장되어 있습니다.'),
      onClose: () => {
        this.paused = false;
        this.ctx.pixel.setVisible(true);
      },
      actions: [
        { label: '타이틀로', testid: 'pause-title', onClick: () => { setTimeout(() => this.showTitle(), 0); } },
        { label: '설정', onClick: () => { setTimeout(() => this.openSettings(), 0); } },
        { label: '기록', onClick: () => { setTimeout(() => this.openRecords(), 0); } },
        { label: '계속하기', primary: true, testid: 'pause-continue', onClick: () => undefined },
      ],
    });
  }

  private openRecords() {
    this.ctx.modals.open({ title: '회고 기록', wide: true, testid: 'records-dialog', body: recordsBody(this.store.get()) });
  }

  private openSave() {
    let handle: { close: () => void } | null = null;
    handle = this.ctx.modals.open({
      title: '저장 파일',
      testid: 'save-dialog',
      body: saveBody(this.ctx, () => {
        handle?.close();
        this.hasSave = true;
        if (this.screen !== 'game') this.enterGame();
      }),
    });
  }

  private openSettings() {
    this.ctx.modals.open({
      title: '설정',
      testid: 'settings-dialog',
      body: settingsBody(() => this.store.get().settings, (p) => {
        if (this.screen === 'game' || this.hasSave) this.store.dispatch({ type: 'setSettings', settings: p });
        // 아직 게임을 시작하지 않았으면 진행 저장 없이 설정만 따로 저장
        else this.store.patchSettingsLocal(p);
      }),
    });
  }

  private applySettings(s: Settings) {
    this.ctx.audio.muted = s.muted;
    const touch = s.touchControls === 'on' || (s.touchControls === 'auto' && hasTouch());
    document.documentElement.dataset.touch = touch ? 'on' : 'off';
    document.documentElement.dataset.speed = s.textSpeed;
  }

  private toast(msg: string) {
    this.toastEl.textContent = msg;
    this.toastEl.hidden = false;
    clearTimeout((this.toastEl as unknown as { _t?: number })._t);
    (this.toastEl as unknown as { _t?: number })._t = window.setTimeout(() => (this.toastEl.hidden = true), 2600);
  }

  /** 테스트·디버그용 읽기 전용 접근 */
  snapshot(): GameState {
    return structuredClone(this.store.get());
  }
}

function hasTouch(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints ?? 0) > 0;
  } catch {
    return false;
  }
}

function newRunId(): string {
  return `run-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
