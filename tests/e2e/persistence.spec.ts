import { test, expect } from '@playwright/test';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { presetSettings, state, tid, waitPhase, next, chooseSchedule, rescuePlan, mgCommand } from './helpers';

test.describe('저장·복원', () => {
  test('대화 중 새로고침 → 같은 단계로 복원, 선택 후 새로고침해도 중복 적용 없음', async ({ page }) => {
    await presetSettings(page);
    await page.goto('./');
    await tid(page, 'btn-new-game').click();
    await next(page, 'mouse');
    await next(page, 'mouse');
    await chooseSchedule(page, 'mouse', ['training', 'training', 'family']);
    await next(page, 'mouse');
    await waitPhase(page, 'event', 1);
    await page.reload();
    await tid(page, 'btn-continue').click();
    await waitPhase(page, 'event', 1);
    await expect(page.getByText('깨진 유리창')).toBeVisible();
    await tid(page, 'choice-2').click();
    await waitPhase(page, 'reaction', 1);
    const s1 = await state(page);
    await page.reload();
    await tid(page, 'btn-continue').click();
    await waitPhase(page, 'reaction', 1);
    const s2 = await state(page);
    expect(s2.eventHistory).toHaveLength(1);
    expect(s2.traits).toEqual(s1.traits);
    expect(s2.stats).toEqual(s1.stats);
    expect(s2.stats).toEqual({ power: 28, control: 24, trust: 54 });
  });

  test('미니게임 중 새로고침 → 좌표·방향·잔해·행동력 복원, 결과 화면 새로고침 시 보상 1회', async ({ page }) => {
    await presetSettings(page);
    await page.goto('./?dev=1');
    await tid(page, 'btn-new-game').click();
    await tid(page, 'dev-toggle').click();
    await tid(page, 'dev-map-2').click();
    await tid(page, 'confirm-dev-ok').click();
    await tid(page, 'dev-toggle').click();
    await tid(page, 'btn-start-minigame').click();
    await waitPhase(page, 'minigame', 2);
    const plan = rescuePlan(2);
    // 잔해 제거까지 진행
    for (const c of plan.slice(0, plan.length - 3)) await mgCommand(page, 'keyboard', c);
    const before = (await state(page)).minigameSnapshot!;
    expect(before.debris).toHaveLength(0);
    await page.reload();
    await tid(page, 'btn-continue').click();
    await waitPhase(page, 'minigame', 2);
    const after = (await state(page)).minigameSnapshot!;
    expect({ x: after.x, y: after.y, facing: after.facing, ap: after.ap, debris: after.debris }).toEqual({ x: before.x, y: before.y, facing: before.facing, ap: before.ap, debris: before.debris });
    for (const c of plan.slice(plan.length - 3)) await mgCommand(page, 'keyboard', c);
    const control0 = (await state(page)).stats.control;
    await tid(page, 'mg-finish').click();
    await waitPhase(page, 'minigameResult', 2);
    expect((await state(page)).stats.control).toBe(control0 + 2);
    await page.reload();
    await tid(page, 'btn-continue').click();
    await waitPhase(page, 'minigameResult', 2);
    await next(page, 'mouse');
    await waitPhase(page, 'event', 2);
    expect((await state(page)).stats.control).toBe(control0 + 2);
    expect((await state(page)).minigameResults).toHaveLength(1);
  });

  test('저장 내보내기 → 새 브라우저 컨텍스트에서 가져오기', async ({ page, browser }) => {
    await presetSettings(page);
    await page.goto('./');
    await tid(page, 'btn-new-game').click();
    await next(page, 'mouse');
    await next(page, 'mouse');
    await chooseSchedule(page, 'mouse', ['volunteer', 'school', 'family']);
    await next(page, 'mouse');
    await tid(page, 'choice-1').click();
    await waitPhase(page, 'reaction', 1);
    const original = await state(page);
    await tid(page, 'btn-save').click();
    const [download] = await Promise.all([page.waitForEvent('download'), tid(page, 'btn-export').click()]);
    // 파일 선택 경로에 비ASCII 문자가 있으면 Chromium이 파일을 넘기지 않으므로 임시 폴더 사용
    const path = join(await mkdtemp(join(tmpdir(), 'hero-seed-')), 'save.json');
    await download.saveAs(path);
    const text = await readFile(path, 'utf8');
    expect(JSON.parse(text).format).toBe('hero-seed-save');

    const ctx2 = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const p2 = await ctx2.newPage();
    await p2.goto('./');
    await expect(tid(p2, 'btn-continue')).toHaveCount(0);
    await tid(p2, 'import-file').setInputFiles(path);
    await tid(p2, 'confirm-import-ok').click();
    await waitPhase(p2, 'reaction', 1);
    const imported = await state(p2);
    expect(imported.eventHistory).toEqual(original.eventHistory);
    expect(imported.stats).toEqual(original.stats);
    await ctx2.close();
  });

  test('잘못된 파일 가져오기는 거절하고 현재 진행을 유지', async ({ page }) => {
    await presetSettings(page);
    await page.goto('./');
    await tid(page, 'btn-new-game').click();
    await next(page, 'mouse');
    const before = await state(page);
    await tid(page, 'btn-save').click();
    const bad = JSON.stringify({ format: 'hero-seed-save', schemaVersion: 1, state: { ...before, stats: { power: 999, control: 0, trust: 0 }, runId: '<img src=x onerror=alert(1)>' } });
    await tid(page, 'import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(bad) });
    await expect(tid(page, 'import-status')).toContainText('가져오기 실패');
    await tid(page, 'import-file').setInputFiles({ name: 'v9.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'hero-seed-save', schemaVersion: 9, state: {} })) });
    await expect(tid(page, 'import-status')).toContainText('지원하지 않는 저장 버전');
    await tid(page, 'import-file').setInputFiles({ name: 'big.json', mimeType: 'application/json', buffer: Buffer.alloc(1024 * 1024 + 10, 32) });
    await expect(tid(page, 'import-status')).toContainText('1MB');
    expect(await state(page)).toEqual(before);
    expect(await page.locator('img[src="x"]').count()).toBe(0);
  });

  test('손상된 저장 → 안내 후 백업 복원', async ({ page }) => {
    await presetSettings(page);
    await page.goto('./');
    await tid(page, 'btn-new-game').click();
    await next(page, 'mouse');
    await next(page, 'mouse');
    await tid(page, 'act-school').click();
    await page.evaluate(() => localStorage.setItem('heroSeed.save.v1', '{"schemaVersion":1,"turn":'));
    await page.reload();
    await expect(tid(page, 'corrupt-dialog')).toBeVisible();
    await tid(page, 'corrupt-restore').click();
    await tid(page, 'btn-continue').click();
    await waitPhase(page, 'schedule', 1);
  });

  test('localStorage 차단 시 메모리로 진행하고 경고 표시', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
    });
    await page.goto('./');
    await expect(tid(page, 'storage-warning')).toContainText('자동 저장이 불가능합니다');
    await tid(page, 'btn-new-game').click();
    await waitPhase(page, 'intro', 1);
    await expect(tid(page, 'save-warning')).toBeVisible();
    await tid(page, 'btn-save').click();
    await expect(tid(page, 'save-status')).toContainText('자동 저장이 불가능합니다');
    const [download] = await Promise.all([page.waitForEvent('download'), tid(page, 'btn-export').click()]);
    expect(download.suggestedFilename()).toMatch(/hero-seed-.*\.json/);
  });

  test('새 회차 시작 전 덮어쓰기 확인', async ({ page }) => {
    await presetSettings(page);
    await page.goto('./');
    await tid(page, 'btn-new-game').click();
    await next(page, 'mouse');
    await page.reload();
    await tid(page, 'btn-new-game').click();
    await expect(tid(page, 'confirm-new')).toBeVisible();
    await tid(page, 'confirm-new-cancel').click();
    await expect(tid(page, 'btn-continue')).toBeVisible();
    expect((await state(page)).phase).toBe('status');
  });
});
