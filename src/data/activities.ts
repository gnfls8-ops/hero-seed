import type { ActivityId, Teaching } from '../core/types';

/** 월간 1회당 변화. 활동만으로는 성향을 올리지 않는다. */
export const ACTIVITY_EFFECTS = {
  school: { control: 2 },
  training: { power: 4, control: 2 },
  volunteer: { power: 1, control: 1 },
  family: { trust: 4 },
} as const satisfies Record<ActivityId, { power?: number; control?: number; trust?: number }>;

export interface ActivityLineDef {
  id: string;
  text: string;
  /** 해당 가르침이 가장 많이 쌓였을 때만 등장하는 문구 */
  lean?: Teaching;
}

export interface ActivityDef {
  id: ActivityId;
  name: string;
  short: string;
  description: string;
  effectLabel: string;
  icon: 'school' | 'training' | 'volunteer' | 'family';
  lines: ActivityLineDef[];
}

export const ACTIVITIES: ActivityDef[] = [
  {
    id: 'school',
    name: '학교',
    short: '학교',
    description: '규칙과 또래 관계',
    effectLabel: '제어 +2',
    icon: 'school',
    lines: [
      { id: 'sc1', text: '받아쓰기 시험에서 처음으로 만점을 받았다. 연필이 저절로 굴러가지 않게 꾹 쥐고 썼다고 한다.' },
      { id: 'sc2', text: '쉬는 시간에 민재와 딱지치기를 했다. 염동력은 쓰지 않기로 둘이 약속했다.' },
      { id: 'sc3', text: '급식 당번을 했다. 국통을 손으로만 드느라 팔이 아프다고 투덜댔다.' },
      { id: 'sc4', text: '피구 시간에 공을 피하다가, 공이 아주 살짝 휘었다. 아무도 눈치채지 못했다.' },
      { id: 'sc5', text: '윤 선생님이 칠판 높은 곳을 지워 달라고 했다. 손이 닿지 않아도 지우개가 움직였다.' },
      { id: 'sc6', text: '줄넘기 대회 연습. 줄이 발에 걸릴 때마다 줄을 노려보았다.' },
      { id: 'sc-p', lean: 'protect', text: '짝꿍이 넘어지자 하람이 제일 먼저 달려가 보건실로 데려갔다.' },
      { id: 'sc-o', lean: 'outside', text: '반 아이들의 말다툼을 선생님 몰래 정리해 주었다며 자랑했다.' },
      { id: 'sc-c', lean: 'control', text: '모둠 활동에서 하람이 역할을 전부 정해 버렸다. 아무도 반대하지 않았다.' },
    ],
  },
  {
    id: 'training',
    name: '초능력 훈련',
    short: '훈련',
    description: '능력 사용 연습',
    effectLabel: '힘 +4, 제어 +2',
    icon: 'training',
    lines: [
      { id: 'tr1', text: '물컵을 쏟지 않고 들어 올리는 연습. 세 번 중 두 번 성공했다.' },
      { id: 'tr2', text: '깃털과 책을 동시에 띄우는 훈련. 깃털이 자꾸 천장에 붙었다.' },
      { id: 'tr3', text: '모래주머니를 들어 올렸다가 천천히 내렸다. 땀이 이마를 타고 흘렀다.' },
      { id: 'tr4', text: '눈을 감고 블록 다섯 개를 쌓았다. 마지막 하나에서 탑이 무너졌다.' },
      { id: 'tr5', text: '공원 벤치를 들어 올려 보았다. 생각보다 무거웠지만 해냈다.' },
      { id: 'tr6', text: '휴지 한 장을 찢지 않고 접는 정밀 훈련. 손보다 염동력이 더 섬세해졌다.' },
      { id: 'tr-p', lean: 'protect', text: '훈련 중에 비둘기가 날아들자, 하람은 하던 것을 멈추고 비둘기부터 비켜 가게 했다.' },
      { id: 'tr-o', lean: 'outside', text: '훈련 기록과 상관없이 혼자 남아 더 연습했다. ‘진짜 위급할 때’를 위해서라고 했다.' },
      { id: 'tr-c', lean: 'control', text: '훈련용 철판을 구겨 버렸다. 하람은 구겨진 철판을 한참 자랑스럽게 바라보았다.' },
    ],
  },
  {
    id: 'volunteer',
    name: '봉사',
    short: '봉사',
    description: '주변 사람과 만남',
    effectLabel: '힘 +1, 제어 +1',
    icon: 'volunteer',
    lines: [
      { id: 'vo1', text: '동네 도서관에서 책을 정리했다. 높은 선반의 책은 염동력으로 꽂았다.' },
      { id: 'vo2', text: '경로당 할머니들께 노래를 불러 드렸다. 사탕을 한 주머니 받아 왔다.' },
      { id: 'vo3', text: '공원 쓰레기 줍기. 집게 대신 염동력을 쓰고 싶었지만 꾹 참았다.' },
      { id: 'vo4', text: '유기견 보호소에서 산책 봉사를 했다. 제일 겁 많은 강아지가 하람 옆에 붙어 다녔다.' },
      { id: 'vo5', text: '무료 급식소에서 컵을 날랐다. 한 번에 열 개까지는 무리였다.' },
      { id: 'vo6', text: '시장 상인회의 짐 나르기를 도왔다. 상인 아주머니가 하람에게 호떡을 쥐여 주었다.' },
      { id: 'vo-p', lean: 'protect', text: '길을 잃은 꼬마를 발견하고 끝까지 옆에 있어 주었다. 부모님이 오자 그제야 손을 놓았다.' },
      { id: 'vo-o', lean: 'outside', text: '담당자가 자리를 비운 사이, 하람은 고장 난 수레를 몰래 고쳐 두었다.' },
      { id: 'vo-c', lean: 'control', text: '봉사하는 아이들에게 하람이 이것저것 지시했다. 일은 빨리 끝났지만 몇몇은 표정이 굳었다.' },
    ],
  },
  {
    id: 'family',
    name: '가족 시간',
    short: '가족',
    description: '보호자와 대화',
    effectLabel: '신뢰 +4',
    icon: 'family',
    lines: [
      { id: 'fa1', text: '함께 김밥을 말았다. 하람의 김밥은 옆구리가 다 터졌다.' },
      { id: 'fa2', text: '이불 속에서 손전등을 켜고 무서운 이야기를 나눴다. 하람이 먼저 잠들었다.' },
      { id: 'fa3', text: '뒷산에 올랐다. 정상에서 하람이 도시를 내려다보며 “다 작아 보여”라고 말했다.' },
      { id: 'fa4', text: '보드게임을 했다. 하람이 주사위를 염동력으로 굴리려다 들켰다.' },
      { id: 'fa5', text: '오래된 사진첩을 같이 넘겼다. 하람은 자기 아기 때 사진을 보고 한참 웃었다.' },
      { id: 'fa6', text: '비 오는 날 창가에서 코코아를 마셨다. 하람이 오늘 있었던 일을 하나도 빼놓지 않고 이야기했다.' },
      { id: 'fa-p', lean: 'protect', text: '하람이 오늘 친구가 슬퍼 보였다며, 어떻게 위로하면 좋을지 물었다.' },
      { id: 'fa-o', lean: 'outside', text: '하람이 “이건 우리 둘만 아는 거야”라며 학교에서 있었던 일을 털어놓았다.' },
      { id: 'fa-c', lean: 'control', text: '하람이 동네 아이들 서열을 설명해 주었다. 자기 이름은 맨 위에 있었다.' },
    ],
  },
];

export const ACTIVITY_BY_ID: Record<ActivityId, ActivityDef> = Object.fromEntries(
  ACTIVITIES.map((a) => [a.id, a]),
) as Record<ActivityId, ActivityDef>;
