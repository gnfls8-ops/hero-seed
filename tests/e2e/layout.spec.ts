import { test, expect, type Browser } from '@playwright/test';
import { presetSettings, state, tid, waitPhase, expectReachable, noHorizontalScroll, next } from './helpers';

const SIZES: Array<{ w: number; h: number; touch: boolean }> = [
  { w: 360, h: 640, touch: true },
  { w: 390, h: 844, touch: true },
  { w: 844, h: 390, touch: true },
  { w: 768, h: 1024, touch: true },
  { w: 1366, h: 768, touch: false },
];

async function open(browser: Browser, w: number, h: number, touch: boolean) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 900, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await presetSettings(page);
  return { ctx, page };
}

for (const { w, h, touch } of SIZES) {
  test(`레이아웃 ${w}×${h}: 육성·미니게임 주요 버튼 접근 가능, 가로 스크롤 없음`, async ({ browser }) => {
    const { ctx, page } = await open(browser, w, h, touch);
    await page.goto('./?dev=1');
    await expectReachable(page, tid(page, 'btn-new-game'), '새 게임');
    await noHorizontalScroll(page);
    await tid(page, 'btn-new-game').click();
    await next(page, 'mouse');
    await next(page, 'mouse');
    await waitPhase(page, 'schedule', 1);
    await noHorizontalScroll(page);
    for (const id of ['act-school', 'act-training', 'act-volunteer', 'act-family', 'slot-0', 'btn-records', 'btn-save', 'btn-settings-top', 'btn-pause']) {
      await expectReachable(page, tid(page, id), id);
    }
    // 글자 크기: 본문 16px 이상, 보조 14px 이상
    const sizes = await page.evaluate(() => {
      const fs = (sel: string) => parseFloat(getComputedStyle(document.querySelector(sel)!).fontSize);
      return { body: fs('body'), desc: fs('.act-desc'), muted: fs('.panel-sub') };
    });
    expect(sizes.body).toBeGreaterThanOrEqual(16);
    expect(sizes.desc).toBeGreaterThanOrEqual(14);
    expect(sizes.muted).toBeGreaterThanOrEqual(14);
    // 터치 대상 44px 이상
    for (const id of ['act-school', 'slot-0', 'btn-records']) {
      const b = (await tid(page, id).boundingBox())!;
      expect(b.height, `${id} 높이`).toBeGreaterThanOrEqual(44);
      expect(b.width, `${id} 너비`).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: test.info().outputPath(`nurture-${w}x${h}.png`), fullPage: true });

    // 미니게임 화면 (6턴 맵: 가장 큰 HUD)
    await tid(page, 'dev-toggle').click();
    await tid(page, 'dev-map-6').click();
    await tid(page, 'confirm-dev-ok').click();
    await tid(page, 'dev-toggle').click();
    await expectReachable(page, tid(page, 'btn-start-minigame'), '구조 시작');
    await tid(page, 'btn-start-minigame').click();
    await waitPhase(page, 'minigame', 6);
    await page.waitForTimeout(250);
    // 플레이 영역은 스크롤 없이 한 화면에 맞는다
    const scroll = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight }));
    expect(scroll.sh, '세로 스크롤 없음').toBeLessThanOrEqual(scroll.ch);
    await noHorizontalScroll(page);
    const canvas = page.locator('.mg-stage canvas');
    await expect(canvas).toBeVisible();
    const cb = (await canvas.boundingBox())!;
    expect(Math.abs(cb.width - cb.height), '맵은 정사각형 (찌그러짐 없음)').toBeLessThanOrEqual(1);
    expect(cb.width, '맵 크기').toBeGreaterThanOrEqual(200);
    expect(cb.y + cb.height).toBeLessThanOrEqual(h + 1);
    const ids = ['mg-finish', 'mg-reset', ...(touch ? ['mg-up', 'mg-down', 'mg-left', 'mg-right', 'mg-act'] : [])];
    for (const id of ids) await expectReachable(page, tid(page, id), id);
    if (touch) {
      for (const id of ['mg-up', 'mg-act']) {
        const b = (await tid(page, id).boundingBox())!;
        expect(b.height).toBeGreaterThanOrEqual(48);
        expect(b.width).toBeGreaterThanOrEqual(48);
      }
    }
    await page.screenshot({ path: test.info().outputPath(`minigame-${w}x${h}.png`) });
    await ctx.close();
  });
}

test('회전(세로→가로→세로) 중에도 미니게임 상태 유지', async ({ browser }) => {
  const { ctx, page } = await open(browser, 390, 844, true);
  await page.goto('./?dev=1');
  await tid(page, 'btn-new-game').click();
  await tid(page, 'dev-toggle').click();
  await tid(page, 'dev-map-4').click();
  await tid(page, 'confirm-dev-ok').click();
  await tid(page, 'dev-toggle').click();
  await tid(page, 'btn-start-minigame').click();
  await waitPhase(page, 'minigame', 4);
  await tid(page, 'mg-up').tap();
  await tid(page, 'mg-up').tap();
  const before = (await state(page)).minigameSnapshot!;
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(250);
  let after = (await state(page)).minigameSnapshot!;
  expect(after).toEqual(before);
  await expectReachable(page, tid(page, 'mg-act'), '가로 행동 버튼');
  await expectReachable(page, tid(page, 'mg-left'), '가로 방향 패드');
  await tid(page, 'mg-down').tap();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  after = (await state(page)).minigameSnapshot!;
  expect(after.y).toBe(before.y + 1);
  await expectReachable(page, tid(page, 'mg-finish'), '세로 결과 보기');
  await ctx.close();
});

test('하위 경로 배포: JS·CSS·아이콘이 상대 경로로 로드됨', async ({ page }) => {
  const failed: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(r.url());
  });
  await page.goto('./');
  await expect(tid(page, 'btn-new-game')).toBeVisible();
  const icon = await page.evaluate(() => (document.querySelector('link[rel=icon]') as HTMLLinkElement).href);
  expect(icon).toContain('/sub/path/assets/icon.svg');
  const res = await page.request.get(icon);
  expect(res.ok()).toBe(true);
  expect(failed).toEqual([]);
});
