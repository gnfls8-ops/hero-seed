import { test, expect } from '@playwright/test';
import { presetSettings, playThrough, state, tid, waitPhase } from './helpers';

// Playwright 모바일 터치 에뮬레이션(Pixel 7, Chromium). 실제 기기 검증이 아니다.
test.describe('모바일 터치 (에뮬레이션)', () => {
  test('일정·대화·미니게임·엔딩을 터치로 완주 (보호 경로 → 화이트히어로)', async ({ page }) => {
    await presetSettings(page, 'instant');
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-touch', 'on');
    await tid(page, 'btn-new-game').tap();
    await playThrough(page, 'touch', { teaching: 'protect', finale: 'trust', schedule: ['training', 'school', 'volunteer'] });
    const s = await state(page);
    await expect(tid(page, 'ending')).toHaveAttribute('data-ending', 'white');
    expect(s.minigameResults.map((m) => m.rescued)).toEqual([1, 1, 1]);
    // 미니게임 보상: 구조 1명당 제어 +2, 3회
    expect(s.minigameResults.reduce((n, m) => n + m.controlReward, 0)).toBe(6);
  });

  test('터치 1탭 = 1행동, 버튼 가장자리 탭도 정확히 인식', async ({ page }) => {
    await presetSettings(page, 'instant');
    await page.goto('./?dev=1');
    await tid(page, 'btn-new-game').tap();
    await tid(page, 'dev-toggle').tap();
    await tid(page, 'dev-map-2').tap();
    await tid(page, 'confirm-dev-ok').tap();
    await tid(page, 'dev-toggle').tap();
    await tid(page, 'btn-start-minigame').tap();
    await waitPhase(page, 'minigame', 2);
    const right = tid(page, 'mg-right');
    const box = (await right.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
    // 가운데 탭
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    // 가장자리(오른쪽 끝에서 3px 안쪽) 탭 — 모서리는 둥글게 깎여 있어 변의 가운데를 사용
    await page.touchscreen.tap(box.x + box.width - 3, box.y + box.height / 2);
    let s = await state(page);
    expect(s.minigameSnapshot!.x).toBe(3);
    expect(s.minigameSnapshot!.ap).toBe(22);
    // 버튼 사이 빈 곳 탭은 아무 일도 하지 않는다
    const up = (await tid(page, 'mg-up').boundingBox())!;
    await page.touchscreen.tap(up.x + up.width + 2, up.y + 2);
    s = await state(page);
    expect(s.minigameSnapshot!.ap).toBe(22);
    // 빠른 연속 탭은 각각 1번씩
    await right.tap();
    await right.tap();
    s = await state(page);
    expect(s.minigameSnapshot!.x).toBe(5);
    // 페이지 전체 스크롤·확대는 막지 않는다 (게임 영역에만 touch-action)
    const ta = await page.evaluate(() => [getComputedStyle(document.body).touchAction, getComputedStyle(document.querySelector('.mg-stage')!).touchAction]);
    expect(ta[0]).toBe('auto');
    expect(ta[1]).toBe('none');
  });
});
