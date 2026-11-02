// 자체 제작 픽셀 스프라이트. 문자 하나가 픽셀 하나이며 고정 팔레트를 사용한다.
// Phaser 텍스처와 DOM 초상(data URL) 모두 같은 정의에서 만든다.
import type { Appearance, Mood } from '../core/types';
import { ART_BY_KEY } from '../data/art';

export const PALETTE: Record<string, string> = {
  k: '#1d1b2c', // 윤곽
  w: '#f6f2e6', // 흰색
  g: '#9096a6', // 회색
  G: '#4d5166', // 진회색
  s: '#f3c9a3', // 피부
  S: '#d29a74', // 피부 그늘
  h: '#5a3a2a', // 머리(갈색)
  H: '#2f2a3a', // 머리(검정)
  r: '#dd5a52', // 빨강
  R: '#8f2f3c', // 진빨강
  y: '#f5c84a', // 노랑
  o: '#e98a3c', // 주황
  b: '#4e8fd8', // 파랑
  B: '#2b4c8a', // 남색
  n: '#62b06d', // 초록
  N: '#2f6c45', // 진초록
  p: '#8b62bb', // 보라
  P: '#4a2e6c', // 진보라
  c: '#9fd8ea', // 하늘
  m: '#b47c50', // 나무
  M: '#6f4a30', // 진나무
};

export interface SpriteDef {
  w: number;
  h: number;
  rows: string[];
}

function def(rows: string[]): SpriteDef {
  const w = rows[0]!.length;
  rows.forEach((r, i) => {
    if (r.length !== w) throw new Error(`sprite row ${i} width ${r.length} != ${w}`);
  });
  return { w, h: rows.length, rows };
}

// ───── 유년 하람 (12×16) 정면, 표정은 눈(4행)·입(6행)만 바꾼다
const CHILD_BASE = [
  '....hhhh....',
  '...hhhhhh...',
  '..hhhhhhhh..',
  '..hssssssh..',
  '..ssksskss..',
  '..ssssssss..',
  '...ssSSss...',
  '....ssss....',
  '...yyyyyy...',
  '..yyyyyyyy..',
  '.syyyyyyyys.',
  '.s.yyyyyy.s.',
  '...BBBBBB...',
  '...BB..BB...',
  '...BB..BB...',
  '...kk..kk...',
];

// 표정: 눈(4행)·입(6행)·눈썹(3행)만 바꾼다
const FACES: Record<Mood, { eyes: string; mouth: string; brow?: string }> = {
  neutral: { eyes: '..ssksskss..', mouth: '...ssSSss...' },
  happy: { eyes: '..ssSssSss..', mouth: '...srrrrs...' },
  thinking: { eyes: '..sskssskS..', mouth: '....sSss....', brow: '..hssssksh..' },
  sad: { eyes: '..ssksskss..', mouth: '...sskkss...', brow: '..hksssskh..' },
  fierce: { eyes: '..ssksskss..', mouth: '...skkkks...', brow: '..hskssksh..' },
};

export function childSprite(mood: Mood): SpriteDef {
  const f = FACES[mood];
  const rows = [...CHILD_BASE];
  rows[4] = f.eyes;
  rows[6] = f.mouth;
  if (f.brow) rows[3] = f.brow;
  return def(rows);
}

// ───── 미니게임용 하람 (12×12) 방향별
const MINI_DOWN = [
  '...hhhhhh...',
  '..hhhhhhhh..',
  '..hssssssh..',
  '..skssssks..',
  '..ssssssss..',
  '...yyyyyy...',
  '..yyyyyyyy..',
  '.syyyyyyyys.',
  '...yyyyyy...',
  '...BB..BB...',
  '...BB..BB...',
  '...kk..kk...',
];
const MINI_UP = [
  '...hhhhhh...',
  '..hhhhhhhh..',
  '..hhhhhhhh..',
  '..hhhhhhhh..',
  '..Shhhhhhs..',
  '...yyyyyy...',
  '..yyyyyyyy..',
  '.syyyyyyyys.',
  '...yyyyyy...',
  '...BB..BB...',
  '...BB..BB...',
  '...kk..kk...',
];
const MINI_RIGHT = [
  '...hhhhh....',
  '..hhhhhhh...',
  '..hhhsssss..',
  '..hhssssks..',
  '..hsssssss..',
  '...yyyyy....',
  '...yyyyyy...',
  '...yyyyyys..',
  '...yyyyy....',
  '....BBB.....',
  '....B.BB....',
  '....k..kk...',
];
const mirror = (rows: string[]) => rows.map((r) => [...r].reverse().join(''));

export const SPRITES: Record<string, SpriteDef> = {
  'mini-down': def(MINI_DOWN),
  'mini-up': def(MINI_UP),
  'mini-right': def(MINI_RIGHT),
  'mini-left': def(mirror(MINI_RIGHT)),

  // ───── 타일 (12×12, 24px로 2배 표시)
  floor: def([
    'gggggggggggg',
    'gwwwwwgwwwww',
    'gwwwwwgwwwww',
    'gwwwwwgwwwww',
    'gwwwwwgwwwww',
    'gggggggggggg',
    'wwwgwwwwwgww',
    'wwwgwwwwwgww',
    'wwwgwwwwwgww',
    'wwwgwwwwwgww',
    'wwwgwwwwwgww',
    'gggggggggggg',
  ]),
  wall: def([
    'GGGGGGGGGGGG',
    'GkkkkkGkkkkk',
    'GkGGGGGkGGGG',
    'GkGGGGGkGGGG',
    'GGGGGGGGGGGG',
    'kkkGkkkkkGkk',
    'GGGkGGGGGkGG',
    'GGGkGGGGGkGG',
    'GGGGGGGGGGGG',
    'GkkkkkGkkkkk',
    'GkGGGGGkGGGG',
    'kkkkkkkkkkkk',
  ]),
  debris: def([
    '............',
    '.....MM.....',
    '....MmmM....',
    '...MmmmM.g..',
    '..MmmMmmMgg.',
    '.MmmmMmmmMG.',
    '.MMmmmmMMgG.',
    'gGMMmmMMgGG.',
    'ggGGMMggGGGg',
    'GggGGgGgGGgG',
    '.GGGggGGGGG.',
    '............',
  ]),
  exit: def([
    'nnnnnnnnnnnn',
    'nNNNNNNNNNNn',
    'nNwwwwwwwwNn',
    'nNwNNwwwwwNn',
    'nNwNNNwwwwNn',
    'nNwNNNNwwwNn',
    'nNwNNNNwwwNn',
    'nNwNNNwwwwNn',
    'nNwNNwwwwwNn',
    'nNwwwwwwwwNn',
    'nNNNNNNNNNNn',
    'nnnnnnnnnnnn',
  ]),
  doll: def([
    '............',
    '..mm....mm..',
    '..mMm..mMm..',
    '...mmmmmm...',
    '..mmkmmkmm..',
    '..mmmMMmmm..',
    '...mmmmmm...',
    '..mmmwwmmm..',
    '.mmmwwwwmmm.',
    '..mmmwwmmm..',
    '..mm....mm..',
    '............',
  ]),
  'doll-red': def([
    '.....rr.....',
    '..mm.rr.mm..',
    '..mMm..mMm..',
    '...mmmmmm...',
    '..mmkmmkmm..',
    '..mmmMMmmm..',
    '...mmmmmm...',
    '..mrrrrrrm..',
    '.mmrrwwrrmm.',
    '..mrrrrrrm..',
    '..mm....mm..',
    '............',
  ]),
  'doll-blue': def([
    '.c........c.',
    '..mm.c..mm..',
    '..mMm..mMm..',
    '...mmmmmm...',
    '..mmkmmkmm..',
    '..mmcmmcmm..',
    '...mmkkmm...',
    '..mbbbbbbm..',
    '.mmbbwwbbmm.',
    '..mbbbbbbm..',
    '..mm....mm..',
    '............',
  ]),
  citizen: def([
    '....HHHH....',
    '...HHHHHH...',
    '...HssssH...',
    '...skssks...',
    '...ssSSss...',
    '..ooooooo...',
    '.oooooooooo.',
    '.soooooooos.',
    '..ooooooo...',
    '...GG..GG...',
    '...GG..GG...',
    '...kk..kk...',
  ]),
  'citizen-b': def([
    '....hhhh....',
    '...hhhhhh...',
    '...hsssshh..',
    '...skssks...',
    '...ssrrss...',
    '..nnnnnnn...',
    '.nnnnwnnnnn.',
    '.snnnwnnnns.',
    '..nnnnnnn...',
    '...BB..BB...',
    '...BB..wB...',
    '...kk..kk...',
  ]),
  evidence: def([
    '............',
    '............',
    '.MMMMMMMMMM.',
    '.MmmmmmmmmM.',
    '.MmmmyymmmM.',
    '.MMMMyyMMMM.',
    '.MmmmmmmmmM.',
    '.MmmrmmrmmM.',
    '.MmmmrrmmmM.',
    '.MmmmmmmmmM.',
    '.MMMMMMMMMM.',
    '............',
  ]),

  // ───── 초상 (16×16)
  friend: def([
    '................',
    '.....HHHHHH.....',
    '....HHHHHHHH....',
    '...HHHHHHHHHH...',
    '...HHssssssHH...',
    '...Hssssssss....',
    '...sskksskkss...',
    '...sswksswkss...',
    '...ssssssssss...',
    '....sssSSsss....',
    '.....ssrrss.....',
    '......ssss......',
    '....nnnnnnnn....',
    '...nnnnwwnnnn...',
    '..nnnnnwwnnnnn..',
    '..nnnnnnnnnnnn..',
  ]),
  teacher: def([
    '................',
    '....hhhhhhhh....',
    '...hhhhhhhhhh...',
    '..hhhhhhhhhhhh..',
    '..hhssssssssh...',
    '..hssssssssss...',
    '..hsGGGssGGGs...',
    '..hsGkGssGkGs...',
    '..hsGGGssGGGs...',
    '..hhssssSsss....',
    '..hh.ssRRss.....',
    '..hh..ssss......',
    '....ppppppppp...',
    '...pppwwwwwppp..',
    '..ppppwwwwwpppp.',
    '..ppppppppppppp.',
  ]),
  villain: def([
    '................',
    '.....kkkkkk.....',
    '....kGGGGGGk....',
    '...kGGGGGGGGk...',
    '...kGGGGGGGGk...',
    '...kGyyGGyyGk...',
    '...kGyyGGyyGk...',
    '...kGGGGGGGGk...',
    '...kGGGkkGGGk...',
    '....kGGGGGGk....',
    '.....kkkkkk.....',
    '....kkkyykkk....',
    '...kkkkyykkkk...',
    '..kkGkkyykkGkk..',
    '..kGGkkkkkkGGk..',
    '..kGGkkkkkkGGk..',
  ]),
  // ───── 성인 하람 엔딩 변형 (16×24)
  'adult-white': def([
    '......hhhh......',
    '.....hhhhhh.....',
    '....hhhhhhhh....',
    '....hssssssh....',
    '....skssskss....',
    '....ssssssss....',
    '.....ssSSss.....',
    '......ssss......',
    '...yyywwwwyyy...',
    '..ywwwwwwwwwwy..',
    '.ywwwwwyywwwwwy.',
    '.ywwwwyyyywwwwy.',
    '.yswwwwyywwwwsy.',
    '.y.swwwwwwwws.y.',
    'yy..bbbbbbbb..yy',
    'y...wwwwwwww...y',
    'y...wwwwwwww...y',
    'y...www..www...y',
    'y...www..www...y',
    '....www..www....',
    '....www..www....',
    '....bbb..bbb....',
    '....bbb..bbb....',
    '...kkkk..kkkk...',
  ]),
  'adult-dark': def([
    '.....PPPPPP.....',
    '....PPPPPPPP....',
    '...PPPhhhhPPP...',
    '...PPhssssPPP...',
    '...PPkssskPPP...',
    '...PPssssssPP...',
    '...PP.sSSs.PP...',
    '...PPP.ss.PPP...',
    '..PPkkkkkkkkPP..',
    '.PkkkkkpkkkkkkP.',
    '.PkkkkpppkkkkkP.',
    '.PkkkkkpkkkkkkP.',
    'PPskkkkkkkkkksPP',
    'PP.skkkkkkkks.PP',
    'P...GGGGGGGG...P',
    'P...kkkkkkkk...P',
    'P...kkkkkkkk...P',
    'PP..kkk..kkk..PP',
    '.P..kkk..kkk..P.',
    '....kkk..kkk....',
    '....kkk..kkk....',
    '....GGG..GGG....',
    '....GGG..GGG....',
    '...kkkk..kkkk...',
  ]),
  'adult-villain': def([
    '.....rrrrrr.....',
    '....rRRRRRRr....',
    '....RRRRRRRR....',
    '....RkyyyykR....',
    '....RssssssR....',
    '....RssssssR....',
    '.....RsSSsR.....',
    '......RRRR......',
    '..RRRkkkkkkRRR..',
    '.RRkkkkrrkkkkRR.',
    'RRkkkkrRRrkkkkRR',
    'RRkkkkkrrkkkkkRR',
    'RRskkkkkkkkkksRR',
    'RR.skkkkkkkks.RR',
    'RR..yyyyyyyy..RR',
    'RR..kkkkkkkk..RR',
    'RR..kkkkkkkk..RR',
    'RR..kkk..kkk..RR',
    'R...kkk..kkk...R',
    'R...kkk..kkk...R',
    '....kkk..kkk....',
    '....RRR..RRR....',
    '....RRR..RRR....',
    '...kkkk..kkkk...',
  ]),
  // ───── 활동 아이콘 (10×10)
  'icon-school': def([
    '....rr....',
    '...rrrr...',
    '..rrrrrr..',
    '.mmmmmmmm.',
    '.mwwmmwwm.',
    '.mwwmmwwm.',
    '.mmmmmmmm.',
    '.mwwMMwwm.',
    '.mwwMMwwm.',
    'nnnnnnnnnn',
  ]),
  'icon-training': def([
    '....yy....',
    '...yyyy...',
    'yyyyyyyyyy',
    '.yyyooyyy.',
    '..yyooyy..',
    '..yyyyyy..',
    '.yyy..yyy.',
    '.yy....yy.',
    'yy......yy',
    '..........',
  ]),
  'icon-volunteer': def([
    '..........',
    '.rr....rr.',
    'rrrr..rrrr',
    'rrrrrrrrrr',
    'rrrrwrrrrr',
    '.rrrrrrrr.',
    '..rrrrrr..',
    '...rrrr...',
    '....rr....',
    '..........',
  ]),
  'icon-family': def([
    '....MM....',
    '...MMMM...',
    '..MMMMMM..',
    '.MMMMMMMM.',
    '.mmmmmmmm.',
    '.mccmmyym.',
    '.mccmmyym.',
    '.mmmmmmmm.',
    '.mmmMMmmm.',
    '.mmmMMmmm.',
  ]),
};

for (const m of ['neutral', 'happy', 'thinking', 'sad', 'fierce'] as Mood[]) SPRITES[`child-${m}`] = childSprite(m);

// ───── 여자아이 모습: 기본 스프라이트에 양갈래 머리·리본(아이), 긴 머리(어른)를 덧그린다
type Spot = [x: number, y: number, c: string];
function paint(d: SpriteDef, spots: Spot[], onlyOn = '.'): SpriteDef {
  const rows = d.rows.map((r) => [...r]);
  for (const [x, y, c] of spots) if (rows[y]?.[x] !== undefined && onlyOn.includes(rows[y]![x]!)) rows[y]![x] = c;
  return def(rows.map((r) => r.join('')));
}
const PIGTAILS: Spot[] = [[1, 2, 'r'], [10, 2, 'r'], [1, 3, 'h'], [1, 4, 'h'], [1, 5, 'h'], [10, 3, 'h'], [10, 4, 'h'], [10, 5, 'h']];
const MINI_TAILS: Spot[] = [[1, 1, 'r'], [10, 1, 'r'], [1, 2, 'h'], [1, 3, 'h'], [10, 2, 'h'], [10, 3, 'h']];
const LONG_HAIR: Spot[] = [2, 3, 4, 5, 6, 7, 8].flatMap((y) => [[3, y, 'h'], [12, y, 'h']] as Spot[]);
for (const m of ['neutral', 'happy', 'thinking', 'sad', 'fierce'] as Mood[]) SPRITES[`child-${m}-girl`] = paint(SPRITES[`child-${m}`]!, PIGTAILS);
SPRITES['mini-down-girl'] = paint(SPRITES['mini-down']!, MINI_TAILS);
SPRITES['mini-up-girl'] = paint(SPRITES['mini-up']!, MINI_TAILS);
SPRITES['mini-right-girl'] = paint(SPRITES['mini-right']!, [[1, 1, 'r'], [1, 2, 'h'], [1, 3, 'h'], [0, 3, 'h']]);
SPRITES['mini-left-girl'] = def(mirror(SPRITES['mini-right-girl']!.rows));
SPRITES['adult-white-girl'] = paint(SPRITES['adult-white']!, LONG_HAIR);
SPRITES['adult-villain-girl'] = paint(SPRITES['adult-villain']!, LONG_HAIR);
// 다크 버전은 후드에 머리가 가려지므로 가슴께로 흘러내린 머리카락으로 구분
SPRITES['adult-dark-girl'] = paint(SPRITES['adult-dark']!, [[4, 8, 'h'], [4, 9, 'h'], [4, 10, 'h'], [11, 8, 'h'], [11, 9, 'h'], [11, 10, 'h']], 'k.');

// ───── 마지막 영웅 장면용 큰 그림: 교체 PNG가 없으면 기존 어른·블랙아웃 도트를 정수배로 키워 쓴다
for (const t of ['white', 'dark', 'villain']) {
  SPRITES[`hero-${t}`] = SPRITES[`adult-${t}`]!;
  SPRITES[`hero-${t}-girl`] = SPRITES[`adult-${t}-girl`]!;
}
SPRITES['villain-kneel'] = SPRITES['villain']!;

/** 하람 스프라이트 이름에 모습(남자아이/여자아이)을 반영 */
export function heroSprite(base: string, appearance: Appearance | undefined): string {
  return appearance === 'girl' ? `${base}-girl` : base;
}

export function drawSprite(ctx: CanvasRenderingContext2D, s: SpriteDef, ox = 0, oy = 0, scale = 1): void {
  for (let y = 0; y < s.h; y++) {
    const row = s.rows[y]!;
    for (let x = 0; x < s.w; x++) {
      const c = row[x]!;
      if (c === '.' ) continue;
      const col = PALETTE[c];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  }
}

export function spriteCanvas(name: string, scale = 1): HTMLCanvasElement {
  const s = SPRITES[name];
  if (!s) throw new Error(`unknown sprite ${name}`);
  const c = document.createElement('canvas');
  c.width = s.w * scale;
  c.height = s.h * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  drawSprite(ctx, s, 0, 0, scale);
  return c;
}

// ───── 교체 아트 (PNG). 없으면 위의 코드 스프라이트를 쓴다.
const overrides = new Map<string, { img: HTMLImageElement; src: string }>();

export function setArtOverride(key: string, img: HTMLImageElement, src: string): void {
  overrides.set(key, { img, src });
}

export function hasArtOverride(key: string): boolean {
  return overrides.has(key);
}

/** 화면에 그려지는 크기 (아트 슬롯 크기, 슬롯이 없으면 원본 크기) */
export function displaySize(name: string): { w: number; h: number } {
  const slot = ART_BY_KEY[name];
  if (slot) return { w: slot.w, h: slot.h };
  const d = SPRITES[name];
  if (!d) throw new Error(`unknown sprite ${name}`);
  return { w: d.w, h: d.h };
}

/** Phaser 텍스처용: 표시 크기 그대로의 캔버스. 교체 PNG가 있으면 그것을, 없으면 코드 스프라이트를 정수배로 그린다. */
/** 교체 PNG가 없을 때 먼저 쓸 다른 슬롯 (예: 큰 영웅 그림이 없으면 작은 어른 그림을 2배로) */
const FALLBACK_OF: Record<string, string> = { 'villain-kneel': 'villain' };
for (const t of ['white', 'dark', 'villain']) {
  FALLBACK_OF[`hero-${t}`] = `adult-${t}`;
  FALLBACK_OF[`hero-${t}-girl`] = `adult-${t}-girl`;
}

export function textureCanvas(name: string): HTMLCanvasElement {
  const { w, h } = displaySize(name);
  const o = overrides.get(name) ?? (FALLBACK_OF[name] ? overrides.get(FALLBACK_OF[name]!) : undefined);
  if (!o) return spriteCanvas(name, Math.max(1, Math.round(w / SPRITES[name]!.w)));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(o.img, 0, 0, w, h);
  return c;
}

const urlCache = new Map<string, string>();
/** DOM 이미지용 주소 (작은 원본을 CSS pixelated로 확대). 교체 PNG가 있으면 그 파일. */
export function spriteURL(name: string): string {
  const o = overrides.get(name);
  if (o) return o.src;
  let u = urlCache.get(name);
  if (!u) {
    u = spriteCanvas(name, 1).toDataURL('image/png');
    urlCache.set(name, u);
  }
  return u;
}
