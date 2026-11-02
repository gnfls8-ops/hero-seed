// 교체 가능한 아트 슬롯. PNG를 public/assets/art/<key>.png 에 넣고
// `npm run art:manifest`로 목록을 만들면 코드로 그린 기본 스프라이트 대신 사용된다.
// 파일이 없거나 불러오지 못하면 기본 스프라이트를 그대로 쓴다 (외부 에셋 없이도 완성).
//
// w·h는 화면에 그려지는 크기(게임 월드 픽셀)이며, 생성 이미지도 이 크기로 맞춘다.
// prompt는 이미지 생성 도구(PixelLab 등)에 넣을 설명이다.

export type ArtGroup = 'child' | 'mini' | 'tile' | 'target' | 'portrait' | 'adult' | 'icon' | 'hero' | 'scene';

export interface ArtSlot {
  key: string;
  group: ArtGroup;
  w: number;
  h: number;
  /** 배경 투명 여부 */
  transparent: boolean;
  prompt: string;
  /** 같은 캐릭터로 보이도록 참고할 슬롯 (이미 고른 PNG) */
  ref?: string;
  /** 그림체 기준(style.png)을 쓰지 않음 (큰 배경 일러스트 등) */
  noStyle?: boolean;
}

const STYLE = 'clean pixel art, 16-bit era, limited bright palette, crisp 1px dark outline, no anti-aliasing';
// 하람은 남자아이·여자아이 모습 중 고를 수 있다. 여자아이 슬롯은 키 끝에 -girl이 붙는다.
const KIDS = {
  boy: { suffix: '', desc: 'an 8-year-old boy named Haram with short messy brown hair, yellow t-shirt, navy shorts' },
  girl: { suffix: '-girl', desc: 'an 8-year-old girl named Haram with brown hair in two short pigtails, yellow t-shirt, navy shorts' },
} as const;
type Kid = keyof typeof KIDS;

const child = (kid: Kid, mood: string, face: string): ArtSlot => ({
  key: `child-${mood}${KIDS[kid].suffix}`,
  group: 'child',
  w: 24,
  h: 32,
  transparent: true,
  prompt: `${STYLE}. Full body front view facing the viewer, small character with a few pixels of empty space above the head, of ${KIDS[kid].desc}, standing, ${face}.`,
  ref: mood === 'neutral' ? undefined : `child-neutral${KIDS[kid].suffix}`,
});

const mini = (kid: Kid, dir: string, view: string): ArtSlot => ({
  key: `mini-${dir}${KIDS[kid].suffix}`,
  group: 'mini',
  w: 24,
  h: 24,
  transparent: true,
  prompt: `${STYLE}. Tiny top-down RPG sprite of ${KIDS[kid].desc}, ${view}, fits a 24px tile.`,
  ref: `child-neutral${KIDS[kid].suffix}`,
});

const kidSlots = (kid: Kid): ArtSlot[] => [
  child(kid, 'neutral', 'calm neutral face'),
  child(kid, 'happy', 'big smile, eyes closed happily'),
  child(kid, 'thinking', 'thoughtful, eyes looking up, one finger on the chin'),
  child(kid, 'sad', 'downcast eyes, small frown'),
  child(kid, 'fierce', 'serious, brave and determined expression'),
  mini(kid, 'down', 'facing the viewer'),
  mini(kid, 'up', 'seen from behind'),
  mini(kid, 'left', 'facing left, side view'),
  mini(kid, 'right', 'facing right, side view'),
];

const ADULT = {
  white: 'a heroic superhero in a white suit with gold trim and a flowing gold cape, confident open stance',
  dark: 'a vigilante antihero in a black hooded long coat with purple lining, face half in shadow',
  villain: 'an authoritarian villain in black armor with a red cape and a yellow visor, imposing stance',
} as const;
const adult = (kid: Kid, type: keyof typeof ADULT): ArtSlot => ({
  key: `adult-${type}${KIDS[kid].suffix}`,
  group: 'adult',
  w: 32,
  h: 48,
  transparent: true,
  prompt: `${STYLE}. Full body front view of adult Haram (grown-up ${kid === 'girl' ? 'woman' : 'man'} with brown hair${kid === 'girl' ? ' tied back' : ''}) as ${ADULT[type]}.`,
  ref: `child-neutral${KIDS[kid].suffix}`,
});

const tile = (key: string, desc: string, transparent = false): ArtSlot => ({ key, group: 'tile', w: 24, h: 24, transparent, prompt: `${STYLE}. Top-down 24x24 game tile: ${desc}.` });
const target = (key: string, desc: string): ArtSlot => ({ key, group: 'target', w: 24, h: 24, transparent: true, prompt: `${STYLE}. Top-down 24x24 sprite: ${desc}.` });

const SCENE = 'detailed cinematic pixel art illustration, 16-bit era, rich atmospheric lighting, no characters, no people, no text';
const scene = (type: keyof typeof ADULT, desc: string): ArtSlot => ({
  key: `finale-bg-${type}`,
  group: 'scene',
  w: 192,
  h: 128,
  transparent: false,
  noStyle: true,
  prompt: `${SCENE}. Wide view from a city rooftop: ${desc}. The bottom quarter is an empty flat rooftop ledge where characters will stand.`,
});
// 마지막 장면 인물: 배경 일러스트와 어울리도록 현실적인 7~8등신 비율, 배경 건물·난간에 맞는 크기(키 약 48px)
const REAL = 'realistic proportions pixel art, adult human anatomy about 7.5 heads tall, small head, long legs, not chibi, not super-deformed, detailed muted realistic colors, soft shading, crisp 1px outline';
const hero = (kid: Kid, type: keyof typeof ADULT): ArtSlot => ({
  key: `hero-${type}${KIDS[kid].suffix}`,
  group: 'hero',
  w: 32,
  h: 52,
  transparent: true,
  noStyle: true,
  prompt: `${REAL}. Full body, standing on the ground, front three-quarter view, calm confident stance, of an adult ${kid === 'girl' ? 'woman with long brown hair tied back' : 'man with short brown hair'} as ${ADULT[type]}.`,
  ref: `adult-${type}${KIDS[kid].suffix}`,
});
function finaleSlots(): ArtSlot[] {
  return [
    scene('white', 'a sunrise over the city skyline, golden dawn light breaking through clouds, warm hopeful rays, glittering windows'),
    scene('dark', 'the city skyline at night in heavy rain, purple and teal neon signs, wet rooftop with puddles reflecting the lights, moody fog'),
    scene('villain', 'a city under a blood-red sky, a giant broadcast tower with red searchlights sweeping the clouds, darkened buildings, ominous'),
    hero('boy', 'white'),
    hero('boy', 'dark'),
    hero('boy', 'villain'),
    hero('girl', 'white'),
    hero('girl', 'dark'),
    hero('girl', 'villain'),
    {
      key: 'villain-kneel',
      group: 'hero',
      w: 32,
      h: 36,
      transparent: true,
      noStyle: true,
      prompt: `${REAL}. Full body side three-quarter view of an adult supervillain called Blackout kneeling on one knee in surrender with both hands behind the head, sleek dark grey armored suit, full-face helmet with glowing yellow eyes and a small lightning emblem.`,
      ref: 'villain',
    },
  ];
}

export const ART_SLOTS: ArtSlot[] = [
  ...kidSlots('boy'),
  ...kidSlots('girl'),
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
  adult('boy', 'white'),
  adult('boy', 'dark'),
  adult('boy', 'villain'),
  adult('girl', 'white'),
  adult('girl', 'dark'),
  adult('girl', 'villain'),
  { key: 'icon-school', group: 'icon', w: 20, h: 20, transparent: true, prompt: `${STYLE}. 20x20 UI icon: small school building with a red roof.` },
  { key: 'icon-training', group: 'icon', w: 20, h: 20, transparent: true, prompt: `${STYLE}. 20x20 UI icon: yellow burst star representing psychic power training.` },
  { key: 'icon-volunteer', group: 'icon', w: 20, h: 20, transparent: true, prompt: `${STYLE}. 20x20 UI icon: red heart with a small white highlight.` },
  { key: 'icon-family', group: 'icon', w: 20, h: 20, transparent: true, prompt: `${STYLE}. 20x20 UI icon: cozy small house with lit windows.` },
  // ───── 마지막 영웅 장면 (몇 년 뒤 ~ 엔딩): 엔딩별 배경 + 크게 그린 영웅 + 항복한 블랙아웃
  ...finaleSlots(),
];

export const ART_BY_KEY: Record<string, ArtSlot> = Object.fromEntries(ART_SLOTS.map((s) => [s.key, s]));

/** 배포 경로 기준 아트 폴더와 목록 파일 */
export const ART_DIR = 'assets/art/';
export const ART_MANIFEST = `${ART_DIR}manifest.json`;
