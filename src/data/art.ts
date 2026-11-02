// 교체 가능한 아트 슬롯. PNG를 public/assets/art/<key>.png 에 넣고
// `npm run art:manifest`로 목록을 만들면 코드로 그린 기본 스프라이트 대신 사용된다.
// 파일이 없거나 불러오지 못하면 기본 스프라이트를 그대로 쓴다 (외부 에셋 없이도 완성).
//
// w·h는 화면에 그려지는 크기(게임 월드 픽셀)이며, 생성 이미지도 이 크기로 맞춘다.
// prompt는 이미지 생성 도구(PixelLab 등)에 넣을 설명이다.

export type ArtGroup = 'child' | 'mini' | 'tile' | 'target' | 'portrait' | 'adult' | 'icon';

export interface ArtSlot {
  key: string;
  group: ArtGroup;
  w: number;
  h: number;
  /** 배경 투명 여부 */
  transparent: boolean;
  prompt: string;
}

const STYLE = 'clean pixel art, 16-bit era, limited bright palette, crisp 1px dark outline, no anti-aliasing';
const CHILD = 'an 8-year-old child named Haram with short messy brown hair, yellow t-shirt, navy shorts, gender-neutral look';

const child = (mood: string, face: string): ArtSlot => ({
  key: `child-${mood}`,
  group: 'child',
  w: 24,
  h: 32,
  transparent: true,
  prompt: `${STYLE}. Full body front view of ${CHILD}, standing, ${face}.`,
});

const mini = (dir: string, view: string): ArtSlot => ({
  key: `mini-${dir}`,
  group: 'mini',
  w: 24,
  h: 24,
  transparent: true,
  prompt: `${STYLE}. Tiny top-down RPG sprite of ${CHILD}, ${view}, fits a 24px tile.`,
});

const tile = (key: string, desc: string, transparent = false): ArtSlot => ({ key, group: 'tile', w: 24, h: 24, transparent, prompt: `${STYLE}. Top-down 24x24 game tile: ${desc}.` });
const target = (key: string, desc: string): ArtSlot => ({ key, group: 'target', w: 24, h: 24, transparent: true, prompt: `${STYLE}. Top-down 24x24 sprite: ${desc}.` });

export const ART_SLOTS: ArtSlot[] = [
  child('neutral', 'calm neutral face'),
  child('happy', 'big smile, eyes closed happily'),
  child('thinking', 'looking up to the side, thoughtful'),
  child('sad', 'downcast eyes, small frown'),
  child('fierce', 'furrowed brows, determined clenched mouth'),
  mini('down', 'facing the viewer'),
  mini('up', 'seen from behind'),
  mini('left', 'facing left, side view'),
  mini('right', 'facing right, side view'),
  tile('floor', 'light stone floor tiles of a training hall, subtle grout lines, seamless'),
  tile('wall', 'dark grey brick wall block, seamless'),
  tile('exit', 'green emergency exit floor marker with an arrow'),
  target('debris', 'pile of broken wooden planks and grey rubble, clearly an obstacle'),
  target('doll', 'brown teddy bear doll sitting'),
  target('doll-red', 'teddy bear doll wearing a red vest with a red priority marker above it'),
  target('doll-blue', 'teddy bear doll in a blue shirt, crying with small tear drops'),
  target('citizen', 'trapped adult market vendor in an orange apron, waving for help'),
  target('citizen-b', 'injured teenage student in a green hoodie with a bandaged leg'),
  target('evidence', 'small wooden evidence crate with a yellow lock and a red tag'),
  { key: 'friend', group: 'portrait', w: 32, h: 32, transparent: true, prompt: `${STYLE}. Head-and-shoulders portrait of Minjae, an 8-year-old boy with black hair and a green shirt, timid friendly face.` },
  { key: 'teacher', group: 'portrait', w: 32, h: 32, transparent: true, prompt: `${STYLE}. Head-and-shoulders portrait of Ms. Yoon, an elementary school teacher with shoulder-length brown hair, round glasses, purple cardigan.` },
  { key: 'villain', group: 'portrait', w: 32, h: 32, transparent: true, prompt: `${STYLE}. Head-and-shoulders portrait of Blackout, an adult supervillain in a dark grey full-face helmet with glowing yellow eyes and a lightning emblem.` },
  { key: 'adult-white', group: 'adult', w: 32, h: 48, transparent: true, prompt: `${STYLE}. Full body front view of adult Haram as a heroic superhero in a white suit with gold trim and a flowing gold cape, confident open stance.` },
  { key: 'adult-dark', group: 'adult', w: 32, h: 48, transparent: true, prompt: `${STYLE}. Full body front view of adult Haram as a vigilante antihero in a black hooded long coat with purple lining, face half in shadow.` },
  { key: 'adult-villain', group: 'adult', w: 32, h: 48, transparent: true, prompt: `${STYLE}. Full body front view of adult Haram as an authoritarian villain in black armor with a red cape and a yellow visor, imposing stance.` },
  { key: 'icon-school', group: 'icon', w: 20, h: 20, transparent: true, prompt: `${STYLE}. 20x20 UI icon: small school building with a red roof.` },
  { key: 'icon-training', group: 'icon', w: 20, h: 20, transparent: true, prompt: `${STYLE}. 20x20 UI icon: yellow burst star representing psychic power training.` },
  { key: 'icon-volunteer', group: 'icon', w: 20, h: 20, transparent: true, prompt: `${STYLE}. 20x20 UI icon: red heart with a small white highlight.` },
  { key: 'icon-family', group: 'icon', w: 20, h: 20, transparent: true, prompt: `${STYLE}. 20x20 UI icon: cozy small house with lit windows.` },
];

export const ART_BY_KEY: Record<string, ArtSlot> = Object.fromEntries(ART_SLOTS.map((s) => [s.key, s]));

/** 배포 경로 기준 아트 폴더와 목록 파일 */
export const ART_DIR = 'assets/art/';
export const ART_MANIFEST = `${ART_DIR}manifest.json`;
