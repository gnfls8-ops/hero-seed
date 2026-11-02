import { test, expect } from '@playwright/test';
import { presetSettings, state, tid, next, chooseSchedule, waitPhase } from './helpers';

test('도입 화면에서 하람의 모습(여자아이)을 고르면 그림이 바뀌고 새로고침 후에도 유지', async ({ page }) => {
  await presetSettings(page);
  await page.goto('./');
  await tid(page, 'btn-new-game').click();
  await waitPhase(page, 'intro', 1);
  const portrait = page.locator('.status-portrait');
  const boySrc = await portrait.getAttribute('src');
  await expect(tid(page, 'look-boy')).toHaveAttribute('aria-pressed', 'true');
  await tid(page, 'look-girl').click();
  await expect(tid(page, 'look-girl')).toHaveAttribute('aria-pressed', 'true');
  expect((await state(page)).settings.appearance).toBe('girl');
  await expect(portrait).not.toHaveAttribute('src', boySrc!);
  const girlSrc = await portrait.getAttribute('src');
  // 이야기 진행은 그대로
  await next(page, 'mouse');
  await next(page, 'mouse');
  await chooseSchedule(page, 'mouse', ['school', 'school', 'family']);
  await page.reload();
  await tid(page, 'btn-continue').click();
  await expect(page.locator('.status-portrait')).toHaveAttribute('src', girlSrc!);
  // 설정에서도 바꿀 수 있다
  await tid(page, 'btn-settings-top').click();
  await tid(page, 'set-appearance-boy').check();
  await page.keyboard.press('Escape');
  await expect(page.locator('.status-portrait')).toHaveAttribute('src', boySrc!);
});
