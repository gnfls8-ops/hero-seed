// URL에 dev=1이 있을 때만 붙는 개발용 패널. 일반 화면에는 나타나지 않는다.
import type { Ctx } from '../ctx';
import type { GameState, StatKey, Teaching, TraitKey } from '../../core/types';
import { h, btn, clear } from '../dom';
import { devJump, devPatch, createInitialState } from '../../core/game';
import { classifyEnding, persuasionAccepted } from '../../core/ending';
import { playRun } from '../../core/sim';
import { UI } from '../../data/strings';
import { STAT_LABEL, TRAIT_LABEL, PHASE_LABEL } from '../describe';

export function mountDevPanel(ctx: Ctx, root: HTMLElement) {
  const panel = h('aside', { class: 'dev-panel', hidden: true, dataset: { testid: 'dev-panel' }, 'aria-label': '개발용 패널' });
  const toggle = btn('DEV', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) render(ctx.store.get());
  }, { class: 'btn dev-toggle', dataset: { testid: 'dev-toggle' } });
  root.append(toggle, panel);

  const warn = () => ctx.toast(UI.devWarning);
  const confirmForce = async () => ctx.modals.confirm('개발용 강제 이동', UI.devWarning, '변경', '취소', 'confirm-dev');

  const render = (s: GameState) => {
    if (panel.hidden) return;
    clear(panel);
    const j = classifyEnding(s.traits);
    const inputs = new Map<string, HTMLInputElement>();
    const num = (key: string, label: string, value: number) => {
      const i = h('input', { type: 'number', min: '0', max: '100', value: String(value), dataset: { testid: `dev-${key}` } });
      inputs.set(key, i);
      return h('label', { class: 'dev-field' }, label, i);
    };
    panel.append(
      h('h2', null, '개발용'),
      h('p', { class: 'warn-line' }, UI.devWarning),
      h('p', null, `턴 ${s.turn} · ${PHASE_LABEL[s.phase]} (${s.phase})${s.devModified ? ' · 개발용 변경됨' : ''}`),
      h('div', { class: 'dev-grid' },
        (['power', 'control', 'trust'] as StatKey[]).map((k) => num(k, STAT_LABEL[k], s.stats[k])),
        (['empathy', 'principle', 'distrust', 'domination'] as TraitKey[]).map((k) => num(k, TRAIT_LABEL[k], s.traits[k])),
      ),
      btn('수치 적용', async () => {
        if (!(await confirmForce())) return;
        const stats: Record<string, number> = {};
        const traits: Record<string, number> = {};
        for (const [k, i] of inputs) (['power', 'control', 'trust'].includes(k) ? stats : traits)[k] = Number(i.value);
        ctx.store.replace(devPatch(ctx.store.get(), { stats, traits }));
        warn();
      }, { class: 'btn btn-small', dataset: { testid: 'dev-apply' } }),
      h('h3', null, '현재 엔딩 판정'),
      h('p', { dataset: { testid: 'dev-ending' } }, `${j.type} · 설득 수용(다른 방법 선택 시): ${persuasionAccepted(s.stats.trust, 'reconsider') ? '예' : '아니오'}`),
      h('ol', { class: 'small' }, j.reasons.map((r) => h('li', null, r))),
      h('h3', null, '사건 실행'),
      h('div', { class: 'dev-row' }, [1, 2, 3, 4, 5, 6].map((t) => btn(`${t}턴 사건`, async () => {
        if (!(await confirmForce())) return;
        ctx.store.replace(devJump(ctx.store.get(), t, 'event'));
        warn();
      }, { class: 'btn btn-small', dataset: { testid: `dev-event-${t}` } }))),
      h('h3', null, '미니게임 실행'),
      h('div', { class: 'dev-row' }, [2, 4, 6].map((t) => btn(`${t}턴 맵`, async () => {
        if (!(await confirmForce())) return;
        ctx.store.replace(devJump(ctx.store.get(), t, 'minigame'));
        warn();
      }, { class: 'btn btn-small', dataset: { testid: `dev-map-${t}` } }))),
      h('h3', null, '테스트용 경로 (6턴 최종 사건 직전)'),
      h('div', { class: 'dev-row' }, ([['protect', '화이트 경로'], ['outside', '다크 경로'], ['control', '빌런 경로']] as Array<[Teaching, string]>).map(([t, label]) =>
        btn(label, async () => {
          if (!(await confirmForce())) return;
          const st = playRun({ runId: `dev-${t}`, teachings: () => t, schedule: () => ['training', 'school', 'family'], stopAt: { turn: 6, phase: 'finaleIntro' } });
          ctx.store.replace({ ...st, devModified: true, settings: ctx.store.get().settings });
          warn();
        }, { class: 'btn btn-small', dataset: { testid: `dev-path-${t}` } }))),
      h('h3', null, '저장'),
      btn('저장 초기화 (새 게임 상태로)', async () => {
        if (!(await ctx.modals.confirm('저장 초기화', '브라우저에 저장된 진행과 백업을 지웁니다.', '초기화', '취소', 'confirm-dev-reset'))) return;
        ctx.saver.clear();
        ctx.store.replace({ ...createInitialState(`run-${Date.now().toString(36)}`, ctx.store.get().settings), devModified: true });
        warn();
      }, { class: 'btn btn-small', dataset: { testid: 'dev-reset' } }),
    );
  };
  ctx.store.subscribe((s) => render(s));
}
