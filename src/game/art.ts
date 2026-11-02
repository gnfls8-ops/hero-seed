// 교체 아트 불러오기: assets/art/manifest.json에 적힌 PNG만 읽는다. 실패하면 기본 스프라이트 유지.
import { ART_BY_KEY, ART_DIR, ART_MANIFEST } from '../data/art';
import { setArtOverride } from './sprites';

const FILE_RE = /^[a-z0-9-]+\.png$/;

function loadImage(src: string, timeoutMs: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const t = setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => {
      clearTimeout(t);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(t);
      resolve(null);
    };
    img.src = src;
  });
}

/** 불러온 교체 아트 수를 돌려준다. 네트워크·형식 오류는 조용히 무시하고 기본 아트를 쓴다. */
export async function loadArtOverrides(timeoutMs = 4000): Promise<number> {
  let files: Record<string, unknown>;
  try {
    const r = await fetch(ART_MANIFEST, { cache: 'no-cache' });
    if (!r.ok) return 0;
    const m = (await r.json()) as { version?: unknown; files?: unknown };
    if (m.version !== 1 || typeof m.files !== 'object' || m.files === null) return 0;
    files = m.files as Record<string, unknown>;
  } catch {
    return 0;
  }
  const jobs = Object.entries(files)
    .filter(([key, file]) => ART_BY_KEY[key] && typeof file === 'string' && FILE_RE.test(file))
    .map(async ([key, file]) => {
      const src = `${ART_DIR}${file as string}`;
      const img = await loadImage(src, timeoutMs);
      const slot = ART_BY_KEY[key]!;
      // 크기가 슬롯과 다르면 쓰지 않는다 (화면 배치가 깨지지 않도록)
      if (!img || img.naturalWidth !== slot.w || img.naturalHeight !== slot.h) {
        if (img) console.warn(`[art] ${key}: ${img.naturalWidth}x${img.naturalHeight} ≠ ${slot.w}x${slot.h}, 기본 아트 사용`);
        return 0;
      }
      setArtOverride(key, img, src);
      return 1;
    });
  const results = await Promise.all(jobs);
  return results.reduce<number>((a, b) => a + b, 0);
}
