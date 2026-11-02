// 엔딩 결과 화면: 성인 외형, 결말, 대표 가르침 2개, 판정 근거, 미니게임 기록.
import type { Ctx, View } from '../ctx';
import type { GameState } from '../../core/types';
import { h, btn, sprite } from '../dom';
import { ENDINGS } from '../../data/endings';
import { classifyEnding, persuasionAccepted, representativeTeachings } from '../../core/ending';
import { choiceById, EVENT_BY_ID, MAP_BY_ID } from '../../core/registry';
import { spriteURL, heroSprite } from '../../game/sprites';
import { TRAIT_LABEL } from '../describe';
import { mgRecordList } from './phases';

export function endingView(ctx: Ctx, s: GameState): View {
  const j = classifyEnding(s.traits);
  const e = ENDINGS[j.type];
  const accepted = persuasionAccepted(s.stats.trust, s.finaleChoice);
  const reps = representativeTeachings(s.eventHistory, j.type);
  const newRun = btn('새 회차 시작', () => ctx.newGame(), { class: 'btn btn-primary', dataset: { testid: 'btn-new-run' } });
  const el = h('section', { class: 'panel ending', dataset: { testid: 'ending', ending: j.type } },
    h('p', { class: 'years-later' }, '엔딩'),
    h('div', { class: 'ending-hero' },
      sprite(`adult-${j.type}`, spriteURL(heroSprite(`adult-${j.type}`, s.settings.appearance)), 'adult-sprite big', `어른이 된 하람 (${e.name})`),
      h('div', null, h('h2', { class: 'panel-title ending-name', tabindex: '-1' }, e.name), h('p', null, e.base), accepted ? h('p', { class: 'persuasion' }, e.persuasionAccepted) : null),
    ),
    h('h3', null, '하람을 만든 가르침'),
    h('ol', { class: 'reps' }, reps.map((r) => {
      const ch = choiceById(r.eventId, r.choiceId);
      return h('li', null, h('span', { class: 'chip' }, `${r.turn}월차 · ${EVENT_BY_ID[r.eventId]?.title ?? ''}`), h('p', null, ch?.label ?? ''), h('p', { class: 'muted' }, `하람이 기억한 말: ‘${ch?.memory ?? ''}’`));
    })),
    h('h3', null, '성향 판정 근거'),
    h('ul', { class: 'trait-values' }, (Object.keys(s.traits) as Array<keyof typeof s.traits>).map((k) => h('li', null, h('span', null, TRAIT_LABEL[k]), h('strong', null, String(s.traits[k]))))),
    h('ol', { class: 'reasons' }, j.reasons.map((r) => h('li', null, r))),
    h('p', { class: 'muted' }, `보호자 신뢰 ${s.stats.trust} · 마지막 한마디: ${s.finaleChoice === 'reconsider' ? '“다른 방법도 생각해보자”' : '“네 판단을 믿겠다”'}${s.finaleChoice === 'reconsider' ? (accepted ? ' → 수용 (신뢰 65 이상)' : ' → 거절 (신뢰 65 미만)') : ''}`),
    h('p', { class: 'muted' }, '이 판정은 프로토타입용 규칙이며 성향의 우열이나 현실의 도덕성을 뜻하지 않습니다.'),
    h('h3', null, '구조 기록'),
    h('div', { class: 'mg-records' }, s.minigameResults.map((m) => h('div', { class: 'mg-record' }, h('h4', null, `${m.turn}월차 · ${MAP_BY_ID[m.mapId]?.name ?? ''}`), mgRecordList(m)))),
    h('div', { class: 'actions wrap' },
      btn('회고 기록', () => ctx.openRecords(), { class: 'btn' }),
      btn('저장 내보내기', () => ctx.openSave(), { class: 'btn' }),
      btn('타이틀로', () => ctx.goTitle(), { class: 'btn' }),
      newRun),
  );
  return { el, focus: el.querySelector('h2') as HTMLElement };
}
