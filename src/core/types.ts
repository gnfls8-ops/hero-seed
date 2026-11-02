// 공용 타입. Phaser·DOM에 의존하지 않는다.
export type StatKey = 'power' | 'control' | 'trust';
export type TraitKey = 'empathy' | 'principle' | 'distrust' | 'domination';
export type Stats = Record<StatKey, number>;
export type Traits = Record<TraitKey, number>;

export type ActivityId = 'school' | 'training' | 'volunteer' | 'family';
export const ACTIVITY_IDS: readonly ActivityId[] = ['school', 'training', 'volunteer', 'family'];

export type Teaching = 'protect' | 'outside' | 'control';
export const TEACHINGS: readonly Teaching[] = ['protect', 'outside', 'control'];

export type EndingType = 'white' | 'dark' | 'villain';
export const ENDING_TYPES: readonly EndingType[] = ['white', 'dark', 'villain'];

export type FinaleChoice = 'reconsider' | 'trust';
export const FINALE_CHOICES: readonly FinaleChoice[] = ['reconsider', 'trust'];

export type Phase =
  | 'intro'
  | 'status'
  | 'schedule'
  | 'activity'
  | 'minigameBrief'
  | 'minigame'
  | 'minigameResult'
  | 'event'
  | 'reaction'
  | 'summary'
  | 'finaleIntro'
  | 'finale'
  | 'finaleReaction'
  | 'ending';

export const PHASES: readonly Phase[] = [
  'intro', 'status', 'schedule', 'activity', 'minigameBrief', 'minigame', 'minigameResult',
  'event', 'reaction', 'summary', 'finaleIntro', 'finale', 'finaleReaction', 'ending',
];

export type Dir = 'up' | 'down' | 'left' | 'right';
export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];

export type Mood = 'neutral' | 'happy' | 'thinking' | 'sad' | 'fierce';
export const MOODS: readonly Mood[] = ['neutral', 'happy', 'thinking', 'sad', 'fierce'];

export type TextSpeed = 'normal' | 'fast' | 'instant';
export type TouchControls = 'auto' | 'on' | 'off';

export type Appearance = 'boy' | 'girl';
export const APPEARANCES: readonly Appearance[] = ['boy', 'girl'];

export interface Settings {
  muted: boolean;
  textSpeed: TextSpeed;
  touchControls: TouchControls;
  /** 하람의 모습. 이야기 문장은 성별 중립이며 그림만 바뀐다. */
  appearance: Appearance;
}

// ---------- 조건식 (eval 없이 허용된 연산자만) ----------
export type CompareOp = '>=' | '>' | '<=' | '<' | '==' | '!=';
export const COMPARE_OPS: readonly CompareOp[] = ['>=', '>', '<=', '<', '==', '!='];

export type Condition =
  | { type: 'teaching'; eventId: string; is: Teaching }
  | { type: 'stat'; key: StatKey; op: CompareOp; value: number }
  | { type: 'trait'; key: TraitKey; op: CompareOp; value: number }
  | { type: 'minigameTier'; turn: number; is: MinigameTier }
  | { type: 'minigameFirst'; turn: number; targetId: string }
  | { type: 'minigameRescued'; turn: number; targetId: string; is: boolean }
  | { type: 'dominantTeaching'; is: Teaching }
  | { type: 'eventSeen'; eventId: string }
  | { type: 'memoryTag'; tag: string };

export type MinigameTier = 'success' | 'partial' | 'none';

/** 문단 하나. 문자열이면 고정, variants면 조건이 맞는 첫 번째를 사용 (마지막은 기본값) */
export type TextBlock = string | { variants: Array<{ when?: Condition[]; text: string }> };

export interface ChoiceDef {
  id: string;
  teaching: Teaching;
  label: string;
  trust: number;
  memoryTags: string[];
  /** 아이가 기억한 말 (월말 요약·회고·후속 사건에서 인용) */
  memory: string;
  /** 관계 변화 한 줄 */
  relation: string;
  mood: Mood;
  reaction: TextBlock[];
}

export interface EventDef {
  id: string;
  turn: number;
  title: string;
  prerequisites: Condition[];
  /** 등장 인물 초상 */
  cast: Array<'child' | 'friend' | 'teacher' | 'villain' | 'instructor'>;
  /** 미니게임 성과별 도입 문구 (2·4·6턴) */
  minigameIntro?: Record<MinigameTier, string>;
  textVariants: TextBlock[];
  choices: ChoiceDef[];
  /** 실행 코드가 아니라 참조 정보: 인용하는 이전 사건과 다음 사건 ID */
  callbacks: { quotes: string[]; next: string | null };
}

// ---------- 미니게임 ----------
export type TargetKind = 'doll' | 'citizen' | 'evidence';

export interface MapTargetDef {
  id: string;
  kind: TargetKind;
  label: string;
  x: number;
  y: number;
}

export interface MapDef {
  id: string;
  turn: number;
  name: string;
  /** '#' 벽, '.' 바닥, 'x' 잔해, 'O' 출구(장식, 통과 가능), 'P' 시작 위치 */
  rows: string[];
  start: { x: number; y: number; facing: Dir };
  targets: MapTargetDef[];
  goal: string;
  rules: string[];
  /** 기록용 우선순위 설명 */
  priorityNote?: string;
}

export interface TargetState {
  id: string;
  kind: TargetKind;
  x: number;
  y: number;
  rescued: boolean;
}

export interface MinigameSnapshot {
  mapId: string;
  turn: number;
  x: number;
  y: number;
  facing: Dir;
  ap: number;
  apMax: number;
  debrisCost: number;
  debris: string[]; // "x,y"
  targets: TargetState[];
  order: string[];
  actions: number;
  resets: number;
  message: string | null;
  /** 연출용 마지막 이벤트 */
  lastEvent: null | { kind: 'move' | 'bump' | 'clear' | 'rescue' | 'denied' | 'none' | 'reset'; x: number; y: number; seq: number };
}

export interface MinigameRecord {
  turn: number;
  mapId: string;
  rescued: number;
  totalPeople: number;
  evidence: boolean | null; // 증거 대상이 없는 맵은 null
  order: string[];
  apLeft: number;
  apMax: number;
  tier: MinigameTier;
  controlReward: number;
}

export interface EventRecord {
  eventId: string;
  turn: number;
  choiceId: string;
  teaching: Teaching;
  trustDelta: number;
}

export interface ActivityLine {
  slot: number;
  activity: ActivityId;
  lineId: string;
}

export interface MonthRecord {
  turn: number;
  schedule: ActivityId[];
  lines: ActivityLine[];
  statsBefore: Stats;
  traitsBefore: Traits;
  statsAfterActivities: Stats;
}

export type PendingResult =
  | null
  | { kind: 'activity'; turn: number; lines: ActivityLine[]; delta: Partial<Stats> }
  | { kind: 'minigame'; record: MinigameRecord }
  | { kind: 'event'; eventId: string; choiceId: string }
  | { kind: 'finale'; choice: FinaleChoice };

export interface GameState {
  schemaVersion: number;
  runId: string;
  turn: number;
  phase: Phase;
  stats: Stats;
  traits: Traits;
  schedule: Array<ActivityId | null>;
  months: MonthRecord[];
  eventHistory: EventRecord[];
  memories: Array<{ turn: number; eventId: string; choiceId: string; tags: string[] }>;
  minigameSnapshot: MinigameSnapshot | null;
  minigameResults: MinigameRecord[];
  pendingResult: PendingResult;
  appliedEffectIds: string[];
  finaleChoice: FinaleChoice | null;
  mood: Mood;
  devModified: boolean;
  settings: Settings;
}
