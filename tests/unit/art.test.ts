import { describe, expect, it } from 'vitest';
import { ART_SLOTS } from '../../src/data/art';
import { SPRITES } from '../../src/game/sprites';

describe('교체 아트 슬롯', () => {
  it('모든 슬롯은 기본 스프라이트가 있고, 크기는 기본 스프라이트의 정수배', () => {
    for (const s of ART_SLOTS) {
      const d = SPRITES[s.key];
      expect(d, s.key).toBeDefined();
      expect(s.w % d!.w, `${s.key} 너비`).toBe(0);
      expect(s.h % d!.h, `${s.key} 높이`).toBe(0);
      expect(s.w / d!.w, `${s.key} 배율`).toBe(s.h / d!.h);
    }
  });
  it('게임에서 쓰는 스프라이트는 모두 슬롯이 있다 (아이콘 포함)', () => {
    const keys = new Set(ART_SLOTS.map((s) => s.key));
    for (const name of Object.keys(SPRITES)) expect(keys.has(name), name).toBe(true);
  });
  it('남자아이·여자아이 모습의 하람 스프라이트가 짝을 이룬다', () => {
    const boy = Object.keys(SPRITES).filter((k) => /^(child|mini|adult)-/.test(k) && !k.endsWith('-girl'));
    expect(boy.length).toBe(12);
    for (const k of boy) {
      const g = SPRITES[`${k}-girl`];
      expect(g, `${k}-girl`).toBeDefined();
      expect([g!.w, g!.h]).toEqual([SPRITES[k]!.w, SPRITES[k]!.h]);
      expect(g!.rows.join('')).not.toBe(SPRITES[k]!.rows.join(''));
    }
  });
  it('타일·미니게임 스프라이트는 24px 타일 크기', () => {
    for (const s of ART_SLOTS.filter((x) => ['tile', 'target', 'mini'].includes(x.group))) expect([s.w, s.h]).toEqual([24, 24]);
  });
});
