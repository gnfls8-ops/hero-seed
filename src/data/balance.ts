// 프로토타입 초기 설계값. 모든 수치는 여기서 조정한다.
export const BALANCE = {
  totalTurns: 6,
  slotsPerMonth: 3,
  maxSameActivityPerMonth: 2,
  statRange: { min: 0, max: 100 },
  initialStats: { power: 20, control: 20, trust: 50 },
  initialTraits: { empathy: 20, principle: 20, distrust: 20, domination: 20 },
  /** 미니게임이 들어가는 턴 */
  minigameTurns: [2, 4, 6] as readonly number[],
  teachingEffects: {
    protect: { empathy: 8, principle: 6 },
    outside: { empathy: 5, distrust: 8 },
    control: { domination: 8, distrust: 3 },
  },
  choiceTrustRange: { min: -2, max: 3 },
  rescue: {
    gridSize: 9,
    tileSize: 24,
    baseActionPoints: 24,
    controlBonusThreshold: 40,
    controlBonusPoints: 4,
    powerThreshold: 40,
    debrisCostWeak: 3,
    debrisCostStrong: 2,
    rescueCost: 1,
    evidenceCost: 1,
    moveCost: 1,
    controlRewardPerRescue: 2,
    controlRewardMax: 4,
  },
  ending: {
    villainDomination: 60,
    darkDistrust: 55,
    persuasionTrust: 65,
  },
} as const;

export type Balance = typeof BALANCE;
