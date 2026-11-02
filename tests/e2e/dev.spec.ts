import { test, expect } from '@playwright/test';
import { presetSettings, state, tid, waitPhase, next } from './helpers';

test('개발용 패널은 dev=1에서만 보이고, 테스트 경로로 다크히어로 엔딩 도달', async ({ page }) => {
  await presetSettings(page);
  await page.goto('./');
  await expect(tid(page, 'dev-toggle')).toHaveCount(0);
  await page.goto('./?dev=1');
  await tid(page, 'btn-new-game').click();
  await tid(page, 'dev-toggle').click();
  await expect(tid(page, 'dev-panel')).toContainText('개발용 강제 이동');
  await tid(page, 'dev-path-outside').click();
  await tid(page, 'confirm-dev-ok').click();
  await waitPhase(page, 'finaleIntro', 6);
  await expect(tid(page, 'dev-ending')).toContainText('dark');
  await tid(page, 'dev-toggle').click();
  await expect(page.locator('.dev-chip')).toBeVisible();
  await next(page, 'mouse');
  await tid(page, 'finale-reconsider').click();
  await waitPhase(page, 'finaleReaction', 6);
  await next(page, 'mouse');
  await expect(tid(page, 'ending')).toHaveAttribute('data-ending', 'dark');
  const s = await state(page);
  expect(s.devModified).toBe(true);
});

test('개발용 수치 변경과 판정 근거', async ({ page }) => {
  await presetSettings(page);
  await page.goto('./?dev=1');
  await tid(page, 'btn-new-game').click();
  await tid(page, 'dev-toggle').click();
  await tid(page, 'dev-domination').fill('60');
  await tid(page, 'dev-empathy').fill('59');
  await tid(page, 'dev-apply').click();
  await tid(page, 'confirm-dev-ok').click();
  await expect(tid(page, 'dev-ending')).toContainText('villain');
  await tid(page, 'dev-domination').fill('59');
  await tid(page, 'dev-apply').click();
  await tid(page, 'confirm-dev-ok').click();
  await expect(tid(page, 'dev-ending')).toContainText('white');
});
