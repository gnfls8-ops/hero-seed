// 구조 미니게임 화면: 목표·행동력 HUD, 맵(캔버스), 방향 패드와 행동 버튼.
import type { Ctx, View } from '../ctx';
import type { Dir, GameState } from '../../core/types';
import { h, btn } from '../dom';
import { MAP_BY_ID } from '../../core/registry';
import { isFinished } from '../../core/rescue';

const DIR_LABEL: Record<Dir, [string, string]> = {
  up: ['▲', '위'],
  down: ['▼', '아래'],
  left: ['◀', '왼쪽'],
  right: ['▶', '오른쪽'],
};

/**
 * 터치·마우스는 pointerdown에서 한 번, 키보드(Enter/Space로 누른 버튼)는 click(detail=0)에서 한 번.
 * 같은 탭에서 이어지는 click은 무시하여 더블 입력을 막는다.
 */
export function bindPress(el: HTMLElement, fn: () => void) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    fn();
  });
  el.addEventListener('click', (e) => {
    if ((e as MouseEvent).detail === 0) fn();
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function minigameView(ctx: Ctx, s: GameState): View & { stage: HTMLElement } {
  const snap = s.minigameSnapshot!;
  const map = MAP_BY_ID[snap.mapId]!;
  const apBar = h('div', { class: 'bar' }, h('i'));
  const apText = h('strong', { dataset: { testid: 'mg-ap' } });
  const progress = h('span', { class: 'mg-progress', dataset: { testid: 'mg-progress' } });
  const message = h('p', { class: 'mg-message', 'aria-live': 'polite', dataset: { testid: 'mg-message' } });
  const order = h('p', { class: 'mg-order muted' });
  const endBanner = h('p', { class: 'mg-end', hidden: true, role: 'status' });
  const guideItems = [
    `목표: ${map.goal}`,
    ...map.rules,
    'PC: 방향키·WASD 이동, Space·E 행동, Esc 일시정지',
    '모바일: 방향 버튼으로 이동, 행동 버튼으로 잔해 제거·구조',
  ];
  const guide = h('ul', { class: 'mg-guide info-list' }, guideItems.map((g) => h('li', null, g)));
  const guideBtn = btn('안내', () => {
    ctx.modals.open({ title: map.name, body: h('ul', { class: 'info-list' }, guideItems.map((g) => h('li', null, g))) });
  }, { class: 'btn btn-small mg-guide-btn', 'aria-label': '규칙과 조작 안내 보기' });

  const resetBtn = btn('↺ 처음부터', async () => {
    if (await ctx.modals.confirm('처음부터 다시', '맵을 처음 상태로 되돌릴까요? 행동력도 다시 채워집니다.', '다시 하기', '취소', 'confirm-reset')) ctx.cmd.reset();
  }, { class: 'btn btn-small', dataset: { testid: 'mg-reset' } });
  const finishBtn = btn('결과 보기 ▶', () => ctx.cmd.finish(), { class: 'btn btn-small btn-primary', dataset: { testid: 'mg-finish' } });

  const stage = h('div', { class: 'mg-stage', dataset: { testid: 'mg-stage' } });
  const pad = h('div', { class: 'dpad', role: 'group', 'aria-label': '이동' });
  (['up', 'left', 'right', 'down'] as Dir[]).forEach((d) => {
    const b = h('button', { type: 'button', class: `pad-btn pad-${d}`, 'aria-label': `${DIR_LABEL[d][1]}로 이동`, dataset: { testid: `mg-${d}` } }, h('span', { 'aria-hidden': 'true' }, DIR_LABEL[d][0]), h('small', null, DIR_LABEL[d][1]));
    bindPress(b, () => ctx.cmd.dir(d));
    pad.appendChild(b);
  });
  const actBtn = h('button', { type: 'button', class: 'pad-btn act-btn-big', dataset: { testid: 'mg-act' }, 'aria-label': '행동: 잔해 제거 또는 구조' }, h('span', { 'aria-hidden': 'true' }, '✋'), h('small', null, '행동'));
  bindPress(actBtn, () => ctx.cmd.act());
  const controls = h('div', { class: 'mg-controls' }, pad, h('div', { class: 'mg-act' }, actBtn));

  const side = h('section', { class: 'mg-side', 'aria-label': '구조 정보' },
    h('div', { class: 'mg-title-row' }, h('h2', { class: 'mg-title', tabindex: '-1' }, map.name), guideBtn),
    h('div', { class: 'mg-hud' },
      h('div', { class: 'mg-ap' }, h('span', null, '행동력 '), apText, apBar),
      h('div', { class: 'mg-costs' }, `잔해 ${snap.debrisCost} · 구조 1`, progress),
    ),
    guide, message, order, endBanner,
  );
  const buttons = h('div', { class: 'mg-buttons' }, resetBtn, finishBtn);

  const el = h('div', { class: 'mg-layout' }, side, stage, controls, buttons);

  const update = (st: GameState) => {
    const sn = st.minigameSnapshot;
    if (!sn) return;
    apText.textContent = `${sn.ap} / ${sn.apMax}`;
    (apBar.firstChild as HTMLElement).style.width = `${(sn.ap / sn.apMax) * 100}%`;
    const people = sn.targets.filter((t) => t.kind !== 'evidence');
    const ev = sn.targets.find((t) => t.kind === 'evidence');
    progress.textContent = ` · 구조 ${people.filter((t) => t.rescued).length}/${people.length}${ev ? ` · 증거 ${ev.rescued ? 1 : 0}/1` : ''}`;
    message.textContent = sn.message ?? '';
    const name = (id: string) => map.targets.find((t) => t.id === id)?.label ?? id;
    order.textContent = sn.order.length ? `처리 순서: ${sn.order.map((id, i) => `${i + 1}. ${name(id)}`).join(' → ')}` : '';
    const finished = isFinished(sn);
    endBanner.hidden = !finished;
    endBanner.textContent = sn.targets.every((t) => t.rescued) ? '목표를 모두 완료했습니다. 결과 보기를 눌러 주세요.' : '행동력을 모두 썼습니다. 결과 보기를 눌러 주세요.';
    el.classList.toggle('mg-finished', finished);
  };
  update(s);
  return { el, stage, update, focus: side.querySelector('h2') as HTMLElement };
}
