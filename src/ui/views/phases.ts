// 육성 화면의 단계별 패널. 모든 전환에는 명시적인 다음 버튼이 있다.
import type { Ctx, View } from '../ctx';
import type { ActivityId, GameState, Phase } from '../../core/types';
import { h, btn, sprite } from '../dom';
import { Typewriter } from '../typewriter';
import { ACTIVITIES, ACTIVITY_BY_ID } from '../../data/activities';
import { BALANCE } from '../../data/balance';
import { INTRO, MONTH_OPENING, NEXT_PREVIEW, UI, NAMES } from '../../data/strings';
import { ENDINGS, FINALE_INTRO, FINALE_CHOICE_LABELS } from '../../data/endings';
import { eventForTurn, mapForTurn, choiceById, MAP_BY_ID } from '../../core/registry';
import { contextAt, resolveBlocks } from '../../core/conditions';
import { canAddToSchedule, scheduleDelta } from '../../core/rules';
import { costsFor } from '../../core/rescue';
import { classifyEnding, persuasionAccepted } from '../../core/ending';
import { currentMonth, isMinigameTurn } from '../../core/game';
import { spriteURL, heroSprite } from '../../game/sprites';
import { STAT_LABEL, signed, statDiff, traitDescriptions } from '../describe';

// ───────── 공통 도우미

function header(title: string, sub?: string) {
  return h('header', { class: 'panel-head' }, h('h2', { class: 'panel-title', tabindex: '-1' }, title), sub ? h('p', { class: 'panel-sub' }, sub) : null);
}

/** 연출 중이면 첫 클릭은 전체 보기, 그다음 클릭이 다음 단계 */
function nextButton(ctx: Ctx, from: Phase, turn: number, tw: Typewriter | null, label: string = UI.next): HTMLButtonElement {
  let sent = false;
  const b = btn(tw && !tw.done ? UI.revealAll : label, () => {
    if (tw && !tw.done) {
      tw.revealAll();
      return;
    }
    if (sent) return;
    sent = true;
    b.disabled = true;
    ctx.audio.play('select');
    ctx.store.dispatch({ type: 'next', from, turn });
  }, { class: 'btn btn-primary btn-next', dataset: { testid: 'btn-next' } });
  tw?.onDone(() => (b.textContent = label));
  return b;
}

function story(ctx: Ctx, paragraphs: string[]): Typewriter {
  return new Typewriter(paragraphs, ctx.store.get().settings.textSpeed);
}

function portraitRow(cast: string[], look: GameState['settings']['appearance']) {
  const names: Record<string, string> = { child: NAMES.child, friend: NAMES.friend, teacher: NAMES.teacher, villain: NAMES.villain };
  const sprites: Record<string, string> = { child: 'child-neutral', friend: 'friend', teacher: 'teacher', villain: 'villain' };
  return h('ul', { class: 'cast' }, cast.map((c) => h('li', { class: 'cast-item' }, sprite(sprites[c]!, spriteURL(c === 'child' ? heroSprite(sprites[c]!, look) : sprites[c]!), c === 'child' ? 'portrait cast-child' : 'portrait'), h('span', null, names[c] ?? c))));
}

// ───────── 단계별 뷰

function introView(ctx: Ctx, s: GameState): View {
  const tw = story(ctx, INTRO);
  const next = nextButton(ctx, 'intro', s.turn, tw, '첫 달 시작 ▶');
  // 하람의 모습 고르기 (이야기 문장은 같고 그림만 달라진다. 설정에서도 바꿀 수 있다)
  const looks = [['boy', '남자아이'], ['girl', '여자아이']] as const;
  const buttons = looks.map(([v, label]) =>
    btn([sprite('child-happy', spriteURL(heroSprite('child-happy', v)), 'portrait look-sprite'), h('span', null, label)], () => {
      ctx.audio.play('select');
      ctx.store.dispatch({ type: 'setSettings', settings: { appearance: v } });
    }, { class: 'btn look-btn', 'aria-pressed': String(s.settings.appearance === v), dataset: { testid: `look-${v}` } }),
  );
  const picker = h('div', { class: 'look-picker', role: 'group', 'aria-label': '하람의 모습' }, h('p', { class: 'muted' }, '하람의 모습을 골라 주세요. 이야기는 같고, 나중에 설정에서 바꿀 수 있습니다.'), h('div', { class: 'look-row' }, buttons));
  const update = (st: GameState) => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(st.settings.appearance === looks[i]![0])));
  return { el: h('section', { class: 'panel' }, header('하람의 첫 염동력'), tw.el, picker, h('div', { class: 'actions' }, next)), update, destroy: () => tw.destroy(), focus: next };
}

function statusView(ctx: Ctx, s: GameState): View {
  const mg = isMinigameTurn(s.turn);
  const next = nextButton(ctx, 'status', s.turn, null, '일정 정하기 ▶');
  return {
    el: h('section', { class: 'panel' },
      header(`${s.turn}월차 상태 확인`, `${BALANCE.totalTurns}개월 중 ${s.turn}번째 달`),
      h('p', { class: 'lead' }, MONTH_OPENING[s.turn] ?? ''),
      h('ul', { class: 'info-list' },
        h('li', null, '이번 달 일정 3칸을 정합니다. 같은 활동은 최대 2번까지 고를 수 있습니다.'),
        mg ? h('li', { class: 'tag-line' }, h('span', { class: 'tag' }, '구조'), '이번 달에는 활동 뒤에 구조 미니게임이 있습니다.') : null,
        h('li', null, '활동 뒤에는 이번 달의 사건이 하나 일어납니다.'),
      ),
      h('div', { class: 'actions' }, next),
    ),
    focus: next,
  };
}

function scheduleView(ctx: Ctx, s: GameState): View {
  const slotsEl = h('ol', { class: 'slots', 'aria-label': '이번 달 일정 3칸' });
  const actsEl = h('div', { class: 'activities', role: 'group', 'aria-label': '활동 선택' });
  const preview = h('p', { class: 'preview', 'aria-live': 'polite' });
  const confirm = btn(UI.confirmSchedule, () => {
    const st = ctx.store.get();
    if (st.schedule.some((x) => x === null)) return;
    confirm.disabled = true;
    ctx.audio.play('select');
    ctx.store.dispatch({ type: 'confirmSchedule', turn: st.turn });
  }, { class: 'btn btn-primary', dataset: { testid: 'btn-confirm-schedule' } });

  const slotButtons = [0, 1, 2].map((i) =>
    btn('', () => {
      if (ctx.store.get().schedule[i] !== null) {
        ctx.audio.play('select');
        ctx.store.dispatch({ type: 'setSlot', slot: i, activity: null });
      }
    }, { class: 'btn slot', dataset: { testid: `slot-${i}` } }),
  );
  slotButtons.forEach((b) => slotsEl.appendChild(h('li', null, b)));

  const actButtons = ACTIVITIES.map((a) => {
    const count = h('span', { class: 'act-count' });
    const b = btn(
      [sprite(`icon-${a.icon}`, spriteURL(`icon-${a.icon}`), 'icon'), h('span', { class: 'act-name' }, a.name), h('span', { class: 'act-desc' }, `${a.description} · ${a.effectLabel}`), count],
      () => {
        const st = ctx.store.get();
        const slot = st.schedule.findIndex((x) => x === null);
        if (slot < 0 || !canAddToSchedule(st.schedule, a.id)) return;
        ctx.audio.play('select');
        ctx.store.dispatch({ type: 'setSlot', slot, activity: a.id });
      },
      { class: 'btn act-btn', dataset: { testid: `act-${a.id}` } },
    );
    actsEl.appendChild(b);
    return { b, count, id: a.id };
  });

  const update = (st: GameState) => {
    st.schedule.forEach((a, i) => {
      const b = slotButtons[i]!;
      b.textContent = '';
      b.appendChild(h('span', { class: 'slot-no' }, `${i + 1}칸`));
      if (a) {
        b.appendChild(h('span', { class: 'slot-name' }, ACTIVITY_BY_ID[a].name));
        b.appendChild(h('span', { class: 'slot-hint' }, '눌러서 비우기'));
        b.setAttribute('aria-label', `${i + 1}번째 칸: ${ACTIVITY_BY_ID[a].name}. 눌러서 비우기`);
        b.classList.add('filled');
      } else {
        b.appendChild(h('span', { class: 'slot-name empty' }, '비어 있음'));
        b.setAttribute('aria-label', `${i + 1}번째 칸: 비어 있음`);
        b.classList.remove('filled');
      }
    });
    const full = st.schedule.every((x) => x !== null);
    for (const { b, count, id } of actButtons) {
      const n = st.schedule.filter((x) => x === id).length;
      count.textContent = `${n}/${BALANCE.maxSameActivityPerMonth}`;
      b.disabled = full || !canAddToSchedule(st.schedule, id);
    }
    const filled = st.schedule.filter((x): x is ActivityId => x !== null);
    const d = scheduleDelta(filled);
    const parts = (Object.keys(d) as Array<keyof typeof d>).map((k) => `${STAT_LABEL[k]} ${signed(d[k] ?? 0)}`);
    preview.textContent = filled.length ? `예상 변화: ${parts.join(', ')}` : '활동을 눌러 빈 칸을 채우세요.';
    confirm.disabled = !full;
    // 마지막 칸이 차면 비활성화된 활동 버튼에서 실행 버튼으로 포커스를 옮긴다 (키보드 진행)
    const ae = document.activeElement;
    if (full && (ae === document.body || (ae instanceof HTMLButtonElement && ae.disabled) || actsEl.contains(ae))) confirm.focus();
  };
  update(s);
  return {
    el: h('section', { class: 'panel' },
      header(`${s.turn}월차 일정`, '활동을 누르면 빈 칸에 들어갑니다. 실행 전에는 자유롭게 바꿀 수 있습니다.'),
      slotsEl, actsEl, preview,
      h('div', { class: 'actions' }, confirm),
    ),
    update,
    focus: actButtons[0]!.b,
  };
}

function activityView(ctx: Ctx, s: GameState): View {
  const p = s.pendingResult?.kind === 'activity' ? s.pendingResult : null;
  const month = currentMonth(s);
  const lines = p?.lines ?? month?.lines ?? [];
  const list = h('ol', { class: 'results' }, lines.map((l) => {
    const a = ACTIVITY_BY_ID[l.activity];
    const text = a.lines.find((x) => x.id === l.lineId)?.text ?? '';
    return h('li', { class: 'result-item' }, sprite(`icon-${a.icon}`, spriteURL(`icon-${a.icon}`), 'icon'), h('div', null, h('strong', null, `${a.name} `, h('span', { class: 'chip' }, a.effectLabel)), h('p', null, text)));
  }));
  const before = month?.statsBefore ?? s.stats;
  const after = month?.statsAfterActivities ?? s.stats;
  const diff = statDiff(before, after).filter((d) => d.delta !== 0);
  const next = nextButton(ctx, 'activity', s.turn, null, isMinigameTurn(s.turn) ? '구조 준비 ▶' : '이번 달 사건 ▶');
  return {
    el: h('section', { class: 'panel' },
      header('활동 결과'), list,
      h('p', { class: 'delta-line' }, diff.length ? diff.map((d) => `${STAT_LABEL[d.key]} ${d.before}→${d.after} (${signed(d.delta)})`).join(' · ') : '능력 변화 없음 (최대치)'),
      h('div', { class: 'actions' }, next)),
    focus: next,
  };
}

function briefView(ctx: Ctx, s: GameState): View {
  const map = mapForTurn(s.turn)!;
  const c = costsFor(s.stats);
  const R = BALANCE.rescue;
  const start = btn('구조 시작 ▶', () => {
    start.disabled = true;
    ctx.audio.play('select');
    ctx.store.dispatch({ type: 'startMinigame', turn: s.turn });
  }, { class: 'btn btn-primary', dataset: { testid: 'btn-start-minigame' } });
  const people = map.targets.filter((t) => t.kind !== 'evidence');
  const ev = map.targets.find((t) => t.kind === 'evidence');
  return {
    el: h('section', { class: 'panel' },
      header(map.name, s.turn === 2 ? '연습' : s.turn === 4 ? '구조 훈련' : '실제 구조'),
      h('p', { class: 'lead' }, map.goal),
      h('dl', { class: 'cost-table' },
        h('dt', null, '목표'), h('dd', null, [people.map((p) => p.label).join(', '), ev ? ` + ${ev.label}` : '']),
        h('dt', null, '행동력'), h('dd', null, `${c.apMax}`, h('span', { class: 'muted' }, ` (기본 ${R.baseActionPoints}${c.controlBonus ? ` + 제어 보너스 ${R.controlBonusPoints} 적용` : ` · 제어 ${R.controlBonusThreshold} 이상이면 +${R.controlBonusPoints}`})`)),
        h('dt', null, '이동'), h('dd', null, `한 칸 ${R.moveCost} (벽 쪽은 방향만 바뀌고 무료)`),
        h('dt', null, '잔해 제거'), h('dd', null, `${c.debrisCost}`, h('span', { class: 'muted' }, c.powerBonus ? ' (힘 보너스 적용)' : ` (힘 ${R.powerThreshold} 이상이면 ${R.debrisCostStrong})`)),
        h('dt', null, '구조'), h('dd', null, `${R.rescueCost}${ev ? ` · 증거 회수 ${R.evidenceCost}` : ''}`),
        h('dt', null, '보상'), h('dd', null, `구조 대상 1명당 제어 +${R.controlRewardPerRescue} (최대 +${R.controlRewardMax})`),
      ),
      h('ul', { class: 'info-list' }, map.rules.map((r) => h('li', null, r))),
      h('details', { class: 'controls-help' },
        h('summary', null, '조작 방법'),
        h('ul', null,
          h('li', null, 'PC: 방향키 또는 WASD로 이동, Space 또는 E로 행동, Esc로 일시정지'),
          h('li', null, '모바일: 화면의 방향 버튼과 행동 버튼'),
          h('li', null, '실시간 제한은 없습니다. 행동력을 다 쓰거나 목표를 완료하면 끝납니다.'),
        ),
      ),
      h('div', { class: 'actions' }, start)),
    focus: start,
  };
}

const TIER_LABEL = { success: '성공', partial: '부분 성공', none: '구조 없음' } as const;

export function mgRecordList(rec: NonNullable<GameState['minigameResults'][number]>) {
  const map = MAP_BY_ID[rec.mapId]!;
  const name = (id: string) => map.targets.find((t) => t.id === id)?.label ?? id;
  return h('dl', { class: 'cost-table' },
    h('dt', null, '결과'), h('dd', null, TIER_LABEL[rec.tier]),
    h('dt', null, '구조'), h('dd', null, `${rec.rescued} / ${rec.totalPeople}`),
    rec.evidence !== null ? [h('dt', null, '증거'), h('dd', null, rec.evidence ? '확보' : '확보 못 함')] : null,
    h('dt', null, '처리 순서'), h('dd', null, rec.order.length ? rec.order.map((id, i) => `${i + 1}. ${name(id)}`).join('  ') : '없음'),
    h('dt', null, '남은 행동력'), h('dd', null, `${rec.apLeft} / ${rec.apMax}`),
    h('dt', null, '보상'), h('dd', null, rec.controlReward ? `제어 +${rec.controlReward}` : '없음'),
  );
}

function minigameResultView(ctx: Ctx, s: GameState): View {
  const rec = s.pendingResult?.kind === 'minigame' ? s.pendingResult.record : s.minigameResults.find((m) => m.turn === s.turn);
  const next = nextButton(ctx, 'minigameResult', s.turn, null, '이번 달 사건 ▶');
  const msg = !rec ? '' : rec.tier === 'none' ? '이번에는 대상에게 닿지 못했다. 본편은 그대로 이어진다.' : rec.tier === 'partial' ? '일부를 구조했다.' : '목표 구조를 모두 마쳤다!';
  return {
    el: h('section', { class: 'panel' }, header('구조 결과'), h('p', { class: 'lead' }, msg), rec ? mgRecordList(rec) : null, h('div', { class: 'actions' }, next)),
    focus: next,
  };
}

function eventView(ctx: Ctx, s: GameState): View {
  const ev = eventForTurn(s.turn)!;
  const situation = resolveBlocks(ev.textVariants, contextAt(s, s.turn - 1));
  const rec = s.minigameResults.find((m) => m.turn === s.turn);
  const intro = ev.minigameIntro && rec ? [ev.minigameIntro[rec.tier]] : [];
  const tw = story(ctx, [...intro, ...situation]);
  const choices = h('div', { class: 'choices', role: 'group', 'aria-label': '보호자의 말 고르기', hidden: true });
  let sent = false;
  const buttons = ev.choices.map((c, i) =>
    btn(c.label, () => {
      if (sent) return;
      sent = true;
      buttons.forEach((b) => (b.disabled = true));
      ctx.audio.play('select');
      ctx.store.dispatch({ type: 'choose', eventId: ev.id, choiceId: c.id });
    }, { class: 'btn choice', dataset: { testid: `choice-${i}`, choice: c.id } }),
  );
  buttons.forEach((b) => choices.appendChild(b));
  const reveal = btn(UI.revealAll, () => tw.revealAll(), { class: 'btn btn-ghost', dataset: { testid: 'btn-next' } });
  const actions = h('div', { class: 'actions' }, reveal);
  tw.onDone(() => {
    choices.hidden = false;
    reveal.remove();
    if (document.activeElement === reveal || document.activeElement === document.body) buttons[0]?.focus();
  });
  return {
    el: h('section', { class: 'panel' }, header(`${s.turn}월차 사건 · ${ev.title}`), portraitRow(ev.cast, s.settings.appearance), tw.el, h('p', { class: 'prompt' }, '하람에게 뭐라고 말해 줄까?'), choices, actions),
    destroy: () => tw.destroy(),
    focus: tw.done ? buttons[0] : reveal,
  };
}

function reactionView(ctx: Ctx, s: GameState): View {
  const ev = eventForTurn(s.turn)!;
  const rec = s.eventHistory.find((r) => r.eventId === ev.id);
  const ch = rec ? choiceById(ev.id, rec.choiceId) : undefined;
  const paras = ch ? resolveBlocks(ch.reaction, contextAt(s, s.turn)) : [];
  const tw = story(ctx, paras);
  const next = nextButton(ctx, 'reaction', s.turn, tw, '월말 요약 ▶');
  return {
    el: h('section', { class: 'panel' },
      header('하람의 반응'),
      ch ? h('blockquote', { class: 'said' }, h('span', { class: 'said-who' }, '당신'), ch.label) : null,
      tw.el,
      ch ? h('div', { class: 'memory-card' }, h('span', { class: 'memory-label' }, '하람이 기억한 말'), h('p', null, `‘${ch.memory}’`)) : null,
      h('div', { class: 'actions' }, next)),
    destroy: () => tw.destroy(),
    focus: next,
  };
}

function summaryView(ctx: Ctx, s: GameState): View {
  const month = currentMonth(s);
  const before = month?.statsBefore ?? s.stats;
  const diff = statDiff(before, s.stats);
  const ev = eventForTurn(s.turn);
  const rec = ev ? s.eventHistory.find((r) => r.eventId === ev.id) : undefined;
  const ch = rec ? choiceById(rec.eventId, rec.choiceId) : undefined;
  const oldDesc = new Set(traitDescriptions(month?.traitsBefore ?? s.traits));
  const newDesc = traitDescriptions(s.traits).filter((d) => !oldDesc.has(d));
  const mg = s.minigameResults.find((m) => m.turn === s.turn);
  const last = s.turn >= BALANCE.totalTurns;
  const next = nextButton(ctx, 'summary', s.turn, null, last ? '몇 년 뒤 ▶' : '다음 달로 ▶');
  return {
    el: h('section', { class: 'panel' },
      header(`${s.turn}월차 정리`),
      h('h3', null, '능력 변화'),
      h('ul', { class: 'diff-list' }, diff.map((d) => h('li', { class: d.delta > 0 ? 'up' : d.delta < 0 ? 'down' : '' }, h('span', null, STAT_LABEL[d.key]), h('span', null, `${d.before} → ${d.after}`), h('strong', null, signed(d.delta))))),
      h('h3', null, '아이가 기억한 말'),
      ch ? h('div', { class: 'memory-card' }, h('p', null, `‘${ch.memory}’`)) : h('p', null, '-'),
      h('h3', null, '관계 변화'),
      h('ul', { class: 'info-list' }, ch ? h('li', null, ch.relation) : null, h('li', null, `보호자 신뢰 ${signed((diff.find((d) => d.key === 'trust')?.delta) ?? 0)}`)),
      newDesc.length ? [h('h3', null, '새로 보이는 모습'), h('ul', { class: 'info-list' }, newDesc.map((d) => h('li', null, d)))] : null,
      mg ? h('p', { class: 'muted' }, `구조 기록: ${mg.rescued}/${mg.totalPeople}명${mg.evidence !== null ? `, 증거 ${mg.evidence ? '확보' : '없음'}` : ''}`) : null,
      h('p', { class: 'preview-next' }, NEXT_PREVIEW[s.turn] ?? ''),
      h('div', { class: 'actions' }, next)),
    focus: next,
  };
}

function finaleIntroView(ctx: Ctx, s: GameState): View {
  const tw = story(ctx, resolveBlocks(FINALE_INTRO, contextAt(s, 6)));
  const next = nextButton(ctx, 'finaleIntro', s.turn, tw);
  return {
    el: h('section', { class: 'panel panel-finale' }, h('p', { class: 'years-later' }, '몇 년 뒤'), header('어른이 된 하람'), tw.el, h('div', { class: 'actions' }, next)),
    destroy: () => tw.destroy(),
    focus: next,
  };
}

function finaleView(ctx: Ctx, s: GameState): View {
  const type = classifyEnding(s.traits).type;
  const e = ENDINGS[type];
  const tw = story(ctx, e.finaleScene);
  const choices = h('div', { class: 'choices', role: 'group', 'aria-label': '보호자의 한마디', hidden: true });
  let sent = false;
  const buttons = (['reconsider', 'trust'] as const).map((c) =>
    btn(FINALE_CHOICE_LABELS[c], () => {
      if (sent) return;
      sent = true;
      buttons.forEach((b) => (b.disabled = true));
      ctx.audio.play('select');
      ctx.store.dispatch({ type: 'finaleChoose', choice: c });
    }, { class: 'btn choice', dataset: { testid: `finale-${c}` } }),
  );
  buttons.forEach((b) => choices.appendChild(b));
  const reveal = btn(UI.revealAll, () => tw.revealAll(), { class: 'btn btn-ghost', dataset: { testid: 'btn-next' } });
  const notice = h('p', { class: 'notice', hidden: true }, UI.finaleNotice);
  tw.onDone(() => {
    choices.hidden = false;
    notice.hidden = false;
    reveal.remove();
    if (document.activeElement === reveal || document.activeElement === document.body) buttons[0]?.focus();
  });
  return {
    el: h('section', { class: 'panel panel-finale' },
      header('최종 사건 · 항복한 블랙아웃'),
      h('div', { class: 'adult-row' }, sprite(`hero-${type}`, spriteURL(heroSprite(`hero-${type}`, s.settings.appearance)), 'adult-sprite', '어른이 된 하람'), sprite('villain-kneel', spriteURL('villain-kneel'), 'kneel-sprite', '무릎 꿇은 블랙아웃')),
      tw.el, notice, choices, h('div', { class: 'actions' }, reveal)),
    destroy: () => tw.destroy(),
    focus: tw.done ? buttons[0] : reveal,
  };
}

function finaleReactionView(ctx: Ctx, s: GameState): View {
  const type = classifyEnding(s.traits).type;
  const e = ENDINGS[type];
  const accepted = persuasionAccepted(s.stats.trust, s.finaleChoice);
  const text = s.finaleChoice === 'trust' ? e.reactions.trusted : accepted ? e.reactions.accepted : e.reactions.rejected;
  const tw = story(ctx, [text]);
  const next = nextButton(ctx, 'finaleReaction', s.turn, tw, '결과 보기 ▶');
  return {
    el: h('section', { class: 'panel panel-finale' },
      header('하람의 대답'),
      s.finaleChoice ? h('blockquote', { class: 'said' }, h('span', { class: 'said-who' }, '당신'), FINALE_CHOICE_LABELS[s.finaleChoice]) : null,
      tw.el,
      s.finaleChoice === 'reconsider' ? h('p', { class: 'muted' }, accepted ? '하람이 당신의 말을 받아들였다.' : '하람은 당신의 말을 끝까지 듣지 않았다.') : null,
      h('div', { class: 'actions' }, next)),
    destroy: () => tw.destroy(),
    focus: next,
  };
}

export function phaseView(ctx: Ctx, s: GameState): View {
  switch (s.phase) {
    case 'intro': return introView(ctx, s);
    case 'status': return statusView(ctx, s);
    case 'schedule': return scheduleView(ctx, s);
    case 'activity': return activityView(ctx, s);
    case 'minigameBrief': return briefView(ctx, s);
    case 'minigameResult': return minigameResultView(ctx, s);
    case 'event': return eventView(ctx, s);
    case 'reaction': return reactionView(ctx, s);
    case 'summary': return summaryView(ctx, s);
    case 'finaleIntro': return finaleIntroView(ctx, s);
    case 'finale': return finaleView(ctx, s);
    case 'finaleReaction': return finaleReactionView(ctx, s);
    default: return { el: h('section', { class: 'panel' }, header('...')) };
  }
}
