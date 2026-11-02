import { expect, type Page, type Locator } from '@playwright/test';
import type { GameState, Teaching, Dir } from '../../src/core/types';
import { eventForTurn } from '../../src/core/registry';
import { pathTo } from '../../src/core/sim';

export type Mode = 'keyboard' | 'touch' | 'mouse';

export async function presetSettings(page: Page, speed: 'normal' | 'fast' | 'instant' = 'instant') {
  await page.addInitScript((sp) => {
    try {
      if (!localStorage.getItem('heroSeed.settings.v1'))
        localStorage.setItem('heroSeed.settings.v1', JSON.stringify({ muted: true, textSpeed: sp, touchControls: 'auto' }));
    } catch {
      /* 저장소 차단 테스트 */
    }
  }, speed);
}

export async function state(page: Page): Promise<GameState> {
  return page.evaluate(() => (window as unknown as { __heroSeed: { snapshot(): GameState } }).__heroSeed.snapshot());
}

export async function waitPhase(page: Page, phase: GameState['phase'], turn?: number) {
  await expect.poll(async () => {
    const s = await state(page);
    return s.phase === phase && (turn === undefined || s.turn === turn);
  }, { timeout: 15_000 }).toBe(true);
}

export function tid(page: Page, id: string): Locator {
  return page.locator(`[data-testid="${id}"]`).first();
}

/** 키보드만으로 대상에 포커스를 옮긴다 (Tab 반복) */
export async function tabTo(page: Page, selector: string, max = 40) {
  for (let i = 0; i < max; i++) {
    const ok = await page.evaluate((sel) => {
      const a = document.activeElement;
      return !!a && a.matches(sel);
    }, selector);
    if (ok) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab으로 ${selector}에 도달하지 못함`);
}

export async function press(page: Page, mode: Mode, id: string) {
  const el = tid(page, id);
  await expect(el).toBeVisible();
  await expect(el).toBeEnabled();
  if (mode === 'keyboard') {
    await tabTo(page, `[data-testid="${id}"]`);
    await page.keyboard.press('Enter');
  } else if (mode === 'touch') await el.tap();
  else await el.click();
}

/** 다음 버튼: 연출 중이면 전체 보기 후 진행 */
export async function next(page: Page, mode: Mode) {
  const s0 = await state(page);
  for (let i = 0; i < 3; i++) {
    await press(page, mode, 'btn-next');
    await page.waitForTimeout(60);
    const s1 = await state(page);
    if (s1.phase !== s0.phase || s1.turn !== s0.turn) return;
  }
  throw new Error(`다음 단계로 넘어가지 않음: ${s0.phase}`);
}

export const DIR_KEY: Record<Dir, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

export async function mgCommand(page: Page, mode: Mode, cmd: Dir | 'act') {
  if (mode === 'keyboard') {
    const alt: Record<string, string> = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', act: 'KeyE' };
    await page.keyboard.press(Math.random() < 0.5 ? (cmd === 'act' ? 'Space' : DIR_KEY[cmd as Dir]) : alt[cmd]!);
  } else {
    const el = tid(page, cmd === 'act' ? 'mg-act' : `mg-${cmd}`);
    if (mode === 'touch') await el.tap();
    else await el.click();
  }
}

/** 각 맵에서 대상 하나를 구조하는 명령 열 */
export function rescuePlan(turn: number): Array<Dir | 'act'> {
  if (turn === 2) return [...pathTo('map-practice', { x: 1, y: 1 }, { x: 4, y: 6 }), 'up', 'act', 'up', 'up', 'act'];
  if (turn === 4) return [...pathTo('map-drill', { x: 4, y: 7 }, { x: 1, y: 4 }), 'up', 'act'];
  return [...pathTo('map-market', { x: 1, y: 7 }, { x: 2, y: 5 }), 'up', 'act', 'up', 'left', 'up', 'act'];
}

export async function chooseSchedule(page: Page, mode: Mode, acts: string[]) {
  for (const a of acts) await press(page, mode, `act-${a}`);
  await press(page, mode, 'btn-confirm-schedule');
}

export async function chooseTeaching(page: Page, mode: Mode, teaching: Teaching) {
  const s = await state(page);
  const ev = eventForTurn(s.turn)!;
  const idx = ev.choices.findIndex((c) => c.teaching === teaching);
  // 연출이 남아 있으면 전체 보기
  const reveal = tid(page, 'btn-next');
  if (await reveal.isVisible().catch(() => false)) await press(page, mode, 'btn-next');
  await press(page, mode, `choice-${idx}`);
  await waitPhase(page, 'reaction', s.turn);
}

/** 새 게임부터 엔딩까지 진행 */
export async function playThrough(page: Page, mode: Mode, opts: { teaching: Teaching; finale: 'reconsider' | 'trust'; schedule?: string[]; onTurn?: (turn: number) => Promise<void> }) {
  await waitPhase(page, 'intro', 1);
  await next(page, mode);
  for (let turn = 1; turn <= 6; turn++) {
    await waitPhase(page, 'status', turn);
    await opts.onTurn?.(turn);
    await next(page, mode);
    await chooseSchedule(page, mode, opts.schedule ?? ['training', 'training', 'family']);
    await waitPhase(page, 'activity', turn);
    await next(page, mode);
    if (turn % 2 === 0) {
      await waitPhase(page, 'minigameBrief', turn);
      await press(page, mode, 'btn-start-minigame');
      await waitPhase(page, 'minigame', turn);
      for (const c of rescuePlan(turn)) await mgCommand(page, mode, c);
      const s = await state(page);
      expect(s.minigameSnapshot!.order.length).toBeGreaterThan(0);
      await press(page, mode, 'mg-finish');
      if (await tid(page, 'confirm-finish-ok').isVisible().catch(() => false)) await press(page, mode, 'confirm-finish-ok');
      await waitPhase(page, 'minigameResult', turn);
      await next(page, mode);
    }
    await waitPhase(page, 'event', turn);
    await chooseTeaching(page, mode, opts.teaching);
    await next(page, mode);
    await waitPhase(page, 'summary', turn);
    await next(page, mode);
  }
  await waitPhase(page, 'finaleIntro', 6);
  await next(page, mode);
  await waitPhase(page, 'finale', 6);
  if (await tid(page, 'btn-next').isVisible().catch(() => false)) await press(page, mode, 'btn-next');
  await press(page, mode, `finale-${opts.finale}`);
  await waitPhase(page, 'finaleReaction', 6);
  await next(page, mode);
  await waitPhase(page, 'ending', 6);
}

/** 가로 스크롤 없음 + 요소가 화면 안에 있고 다른 요소에 가려지지 않음 */
export async function expectReachable(page: Page, loc: Locator, label: string) {
  await loc.scrollIntoViewIfNeeded();
  const box = await loc.boundingBox();
  expect(box, `${label} 박스`).not.toBeNull();
  const vp = page.viewportSize()!;
  expect(box!.x, `${label} 왼쪽`).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width, `${label} 오른쪽`).toBeLessThanOrEqual(vp.width + 1);
  expect(box!.y + box!.height, `${label} 아래`).toBeLessThanOrEqual(vp.height + 1);
  expect(box!.y, `${label} 위`).toBeGreaterThanOrEqual(-1);
  const hit = await loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!t && (t === el || el.contains(t));
  });
  expect(hit, `${label} 가려짐 없음`).toBe(true);
}

export async function noHorizontalScroll(page: Page) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(r.sw, '가로 스크롤 없음').toBeLessThanOrEqual(r.cw);
}
