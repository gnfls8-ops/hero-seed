import { test, expect } from '@playwright/test';
import { presetSettings, playThrough, state, tid, waitPhase, next, chooseSchedule, press, tabTo } from './helpers';

test.describe('PC 키보드', () => {
  test('새 게임부터 엔딩까지 키보드만으로 완주 (통제 경로 → 빌런, 설득 시도)', async ({ page }) => {
    await presetSettings(page, 'fast');
    await page.goto('./');
    // 설정 메뉴도 키보드로 조작: 연출 즉시 표시로 변경
    await tabTo(page, '[data-testid="btn-settings"]');
    await page.keyboard.press('Enter');
    await expect(tid(page, 'settings-dialog')).toBeVisible();
    // 라디오 그룹은 Tab으로 그룹에 들어가고 화살표로 옵션을 고른다
    await tabTo(page, '[data-testid="set-textSpeed-fast"]');
    await page.keyboard.press('ArrowRight');
    await expect(tid(page, 'set-textSpeed-instant')).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(tid(page, 'settings-dialog')).toBeHidden();
    await tabTo(page, '[data-testid="btn-new-game"]');
    await page.keyboard.press('Enter');
    await playThrough(page, 'keyboard', { teaching: 'control', finale: 'reconsider', schedule: ['family', 'family', 'training'] });
    const s = await state(page);
    expect(s.eventHistory.map((r) => r.teaching)).toEqual(Array(6).fill('control'));
    expect(s.minigameResults).toHaveLength(3);
    expect(s.traits.domination).toBe(68);
    await expect(tid(page, 'ending')).toHaveAttribute('data-ending', 'villain');
    await expect(page.getByText('하람을 만든 가르침')).toBeVisible();
    await expect(page.getByText('1단계 빌런')).toBeVisible();
    // 신뢰 65 이상 + 다른 방법 → 수용 문구
    expect(s.stats.trust).toBeGreaterThanOrEqual(65);
    await expect(page.getByText('통제에 기한과 예외를 두었다')).toBeVisible();
  });

  test('운영체제 키 반복은 무시하고 최초 1회만 이동', async ({ page }) => {
    await presetSettings(page);
    await page.goto('./?dev=1');
    await tid(page, 'btn-new-game').click();
    await tid(page, 'dev-toggle').click();
    await tid(page, 'dev-map-2').click();
    await tid(page, 'confirm-dev-ok').click();
    await tid(page, 'dev-toggle').click();
    await waitPhase(page, 'minigameBrief', 2);
    await tid(page, 'btn-start-minigame').click();
    await waitPhase(page, 'minigame', 2);
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('ArrowRight'); // repeat=true
    await page.keyboard.down('ArrowRight');
    await page.keyboard.up('ArrowRight');
    let s = await state(page);
    expect(s.minigameSnapshot!.x).toBe(2);
    expect(s.minigameSnapshot!.ap).toBe(23);
    // 벽 쪽 이동은 행동력 소모 없이 방향만
    await page.keyboard.press('ArrowUp');
    s = await state(page);
    expect(s.minigameSnapshot!.facing).toBe('up');
    expect(s.minigameSnapshot!.ap).toBe(23);
    // Esc 일시정지 중에는 입력이 막힌다
    await page.keyboard.press('Escape');
    await expect(tid(page, 'pause-dialog')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    expect((await state(page)).minigameSnapshot!.x).toBe(2);
    await tid(page, 'pause-continue').click();
    await page.keyboard.press('KeyD');
    expect((await state(page)).minigameSnapshot!.x).toBe(3);
  });

  test('다음 버튼 연타·선택지 더블클릭에도 한 번만 진행', async ({ page }) => {
    await presetSettings(page);
    await page.goto('./');
    await tid(page, 'btn-new-game').click();
    await waitPhase(page, 'intro', 1);
    await tid(page, 'btn-next').dblclick();
    await expect.poll(async () => (await state(page)).phase).toBe('status');
    await page.waitForTimeout(200);
    expect((await state(page)).phase).toBe('status');
    await next(page, 'mouse');
    await chooseSchedule(page, 'mouse', ['training', 'school', 'family']);
    const after = await state(page);
    expect(after.stats).toEqual({ power: 24, control: 24, trust: 54 });
    await next(page, 'mouse');
    await waitPhase(page, 'event', 1);
    await tid(page, 'choice-0').dblclick();
    await waitPhase(page, 'reaction', 1);
    const s = await state(page);
    expect(s.eventHistory).toHaveLength(1);
    expect(s.appliedEffectIds.filter((x) => x.includes('event'))).toHaveLength(1);
  });

  test('이전 가르침이 다음 사건에서 인용된다', async ({ page }) => {
    await presetSettings(page);
    await page.goto('./');
    await tid(page, 'btn-new-game').click();
    await next(page, 'mouse');
    await next(page, 'mouse');
    await chooseSchedule(page, 'mouse', ['school', 'school', 'family']);
    await next(page, 'mouse');
    await waitPhase(page, 'event', 1);
    await press(page, 'mouse', 'choice-0'); // 1턴 책임과 보호
    await next(page, 'mouse');
    await next(page, 'mouse');
    await waitPhase(page, 'status', 2);
    await next(page, 'mouse');
    await chooseSchedule(page, 'mouse', ['school', 'school', 'family']);
    await next(page, 'mouse');
    await press(page, 'mouse', 'btn-start-minigame');
    await press(page, 'mouse', 'mg-finish');
    await press(page, 'mouse', 'confirm-finish-ok');
    await next(page, 'mouse');
    await waitPhase(page, 'event', 2);
    await expect(page.getByText('힘을 쓴 사람이 먼저 책임진다고 했잖아').first()).toBeVisible();
    // 미니게임 성과(구조 없음) 도입 문구
    await expect(page.getByText('인형까지 닿지 못했다').first()).toBeVisible();
  });
});
