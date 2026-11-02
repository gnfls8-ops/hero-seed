import { test, expect } from '@playwright/test';
import { deflateSync } from 'node:zlib';
import { presetSettings, tid } from './helpers';

// 단색 RGBA PNG를 만든다 (외부 이미지 없이 교체 경로를 검증)
function png(w: number, h: number, rgba: [number, number, number, number]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: w }, () => Buffer.from(rgba)))]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('교체 아트: 목록에 있는 PNG는 쓰고, 크기가 틀린 파일은 기본 스프라이트로 대체', async ({ page }) => {
  await presetSettings(page);
  await page.route('**/assets/art/manifest.json', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, files: { 'child-happy': 'child-happy.png', 'icon-school': 'icon-school.png' } }) }),
  );
  await page.route('**/assets/art/child-happy.png', (r) => r.fulfill({ contentType: 'image/png', body: png(24, 32, [220, 40, 40, 255]) }));
  // 슬롯은 20x20인데 16x16 → 거절되어야 함
  await page.route('**/assets/art/icon-school.png', (r) => r.fulfill({ contentType: 'image/png', body: png(16, 16, [40, 40, 220, 255]) }));
  await page.goto('./');
  await expect(page.locator('.title-sprite')).toHaveAttribute('src', /assets\/art\/child-happy\.png$/);
  await tid(page, 'btn-new-game').click();
  await tid(page, 'btn-next').click();
  await tid(page, 'btn-next').click();
  await expect(page.locator('[data-testid="act-school"] img')).toHaveAttribute('src', /^data:image\/png/);
});

test('교체 아트 목록이 없거나 깨져도 게임은 기본 스프라이트로 시작', async ({ page }) => {
  await presetSettings(page);
  await page.route('**/assets/art/manifest.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{broken' }));
  await page.goto('./');
  await expect(tid(page, 'btn-new-game')).toBeVisible();
  await expect(page.locator('.title-sprite')).toHaveAttribute('src', /^data:image\/png/);
});
