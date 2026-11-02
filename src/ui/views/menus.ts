// 회고 기록, 저장 파일 이동, 설정 패널의 본문
import type { Ctx } from '../ctx';
import type { GameState, Settings } from '../../core/types';
import { h, btn } from '../dom';
import { ACTIVITY_BY_ID } from '../../data/activities';
import { eventForTurn, choiceById, MAP_BY_ID } from '../../core/registry';
import { contextAt, resolveBlocks } from '../../core/conditions';
import { buildExport, parseImport, MAX_IMPORT_BYTES, ValidationError } from '../../core/save';
import { UI } from '../../data/strings';
import { FINALE_CHOICE_LABELS } from '../../data/endings';
import { mgRecordList } from './phases';
import { PHASE_LABEL } from '../describe';

export function recordsBody(s: GameState): HTMLElement {
  const months = [...s.months].sort((a, b) => a.turn - b.turn);
  if (!months.some((m) => m.schedule.length)) return h('p', null, '아직 기록이 없습니다. 첫 달 일정을 마치면 여기에 남습니다.');
  return h('div', { class: 'records' }, months.map((m) => {
    const ev = eventForTurn(m.turn);
    const rec = ev ? s.eventHistory.find((r) => r.eventId === ev.id) : undefined;
    const ch = rec ? choiceById(rec.eventId, rec.choiceId) : undefined;
    const mg = s.minigameResults.find((x) => x.turn === m.turn);
    return h('article', { class: 'record' },
      h('h3', null, `${m.turn}월차${ev ? ` · ${ev.title}` : ''}`),
      m.schedule.length ? h('p', { class: 'muted' }, `일정: ${m.schedule.map((a) => ACTIVITY_BY_ID[a].name).join(', ')}`) : null,
      m.lines.length ? h('ul', { class: 'info-list small' }, m.lines.map((l) => h('li', null, ACTIVITY_BY_ID[l.activity].lines.find((x) => x.id === l.lineId)?.text ?? ''))) : null,
      mg ? h('details', null, h('summary', null, `구조 기록 (${MAP_BY_ID[mg.mapId]?.name ?? ''})`), mgRecordList(mg)) : null,
      ch && ev
        ? [
            h('blockquote', { class: 'said' }, h('span', { class: 'said-who' }, '당신'), ch.label),
            h('div', { class: 'story' }, resolveBlocks(ch.reaction, contextAt(s, m.turn)).map((p) => h('p', null, p))),
            h('p', { class: 'memory-inline' }, `하람이 기억한 말: ‘${ch.memory}’`),
          ]
        : h('p', { class: 'muted' }, '사건 진행 전'),
    );
  }), s.finaleChoice ? h('article', { class: 'record' }, h('h3', null, '몇 년 뒤'), h('blockquote', { class: 'said' }, h('span', { class: 'said-who' }, '당신'), FINALE_CHOICE_LABELS[s.finaleChoice])) : null);
}

function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSave(ctx: Ctx) {
  const s = ctx.store.get();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  download(`hero-seed-${s.turn}month-${stamp}.json`, buildExport(s));
  ctx.toast('저장 파일을 내보냈습니다.');
}

/** 파일 선택 → 검증 → 교체 확인 → 반영. 실패하면 현재 진행을 건드리지 않는다. */
export function importFlow(ctx: Ctx, onDone?: () => void): HTMLElement {
  const status = h('p', { class: 'import-status', role: 'status', dataset: { testid: 'import-status' } });
  const input = h('input', { type: 'file', accept: '.json,application/json', class: 'file-input', dataset: { testid: 'import-file' }, 'aria-label': '저장 파일 선택' });
  const apply = async (read: () => Promise<{ text: string; size: number }>) => {
    let state: GameState;
    try {
      const { text, size } = await read();
      if (size > MAX_IMPORT_BYTES) throw new ValidationError('파일이 1MB를 넘습니다');
      state = parseImport(text, size);
    } catch (e) {
      const msg = e instanceof ValidationError ? e.message : '파일을 읽을 수 없습니다';
      status.textContent = `가져오기 실패: ${msg}. 현재 진행은 그대로입니다.`;
      return;
    }
    const ok = await ctx.modals.confirm(
      '진행 교체',
      h('p', null, `가져온 파일(${state.turn}월차 · ${PHASE_LABEL[state.phase]})로 현재 진행을 바꿀까요? 지금 진행은 덮어써집니다.`),
      '바꾸기',
      '취소',
      'confirm-import',
    );
    if (!ok) {
      status.textContent = '가져오기를 취소했습니다.';
      return;
    }
    ctx.store.replace(state);
    ctx.toast('저장 파일을 가져왔습니다.');
    onDone?.();
  };
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    void apply(async () => ({ text: file.size > MAX_IMPORT_BYTES ? '' : await file.text(), size: file.size }));
  });
  const pick = btn('저장 파일 가져오기', () => input.click(), { class: 'btn', dataset: { testid: 'btn-import' } });
  // 파일 선택이 막힌 환경을 위한 대체 경로: 복사해 둔 JSON 텍스트 붙여넣기
  const area = h('textarea', { id: 'import-text', class: 'json-area', rows: '4', 'aria-label': '저장 JSON 붙여넣기', placeholder: '복사해 둔 저장 JSON을 붙여넣으세요', dataset: { testid: 'import-text' } });
  const pasteBtn = btn('붙여넣은 내용 가져오기', () => {
    const text = area.value;
    void apply(async () => ({ text, size: new Blob([text]).size }));
  }, { class: 'btn btn-small', dataset: { testid: 'btn-import-text' } });
  const paste = h('details', { class: 'paste-box' }, h('summary', null, '텍스트로 가져오기'), area, pasteBtn);
  return h('div', { class: 'import-box' }, pick, input, paste, status);
}

/** 다운로드가 막힌 환경을 위한 대체 경로: JSON 텍스트 복사 */
function copyExport(ctx: Ctx, out: HTMLTextAreaElement) {
  const text = buildExport(ctx.store.get());
  out.value = text;
  out.hidden = false;
  const fallback = () => {
    out.focus();
    out.select();
    ctx.toast('클립보드 복사가 막혀 있습니다. 표시된 텍스트를 직접 복사해 주세요.');
  };
  try {
    navigator.clipboard.writeText(text).then(() => ctx.toast('저장 JSON을 복사했습니다.'), fallback);
  } catch {
    fallback();
  }
}

export function saveBody(ctx: Ctx, close: () => void): HTMLElement {
  const ok = ctx.saver.available;
  const out = h('textarea', { id: 'export-text', class: 'json-area', rows: '4', readonly: true, hidden: true, 'aria-label': '저장 JSON', dataset: { testid: 'export-text' } });
  const copyBtn = btn('JSON 텍스트로 복사', () => copyExport(ctx, out), { class: 'btn', dataset: { testid: 'btn-copy-export' } });
  return h('div', { class: 'save-body' },
    h('p', { class: ok ? 'ok-line' : 'warn-line', dataset: { testid: 'save-status' } }, ok ? '자동 저장: 이 브라우저에 저장 중' : UI.storageUnavailable),
    btn('저장 파일 내보내기', () => exportSave(ctx), { class: 'btn btn-primary', dataset: { testid: 'btn-export' } }),
    copyBtn,
    out,
    h('p', { class: 'muted' }, UI.exportHint),
    importFlow(ctx, close),
  );
}

export function settingsBody(get: () => Settings, set: (p: Partial<Settings>) => void): HTMLElement {
  const s = get();
  const radio = <K extends keyof Settings>(key: K, label: string, options: Array<[Settings[K], string]>) =>
    h('fieldset', { class: 'setting' },
      h('legend', null, label),
      options.map(([v, t]) => {
        const id = `set-${String(key)}-${String(v)}`;
        const inp = h('input', { type: 'radio', name: `set-${String(key)}`, id, value: String(v), checked: s[key] === v, dataset: { testid: id } });
        inp.addEventListener('change', () => set({ [key]: v } as Partial<Settings>));
        return h('label', { for: id, class: 'radio' }, inp, t);
      }),
    );
  const mute = h('input', { type: 'checkbox', id: 'set-muted', checked: s.muted, dataset: { testid: 'set-muted' } });
  mute.addEventListener('change', () => set({ muted: mute.checked }));
  return h('div', { class: 'settings' },
    h('label', { class: 'check', for: 'set-muted' }, mute, '효과음 끄기 (음소거)'),
    radio('appearance', '하람의 모습', [['boy', '남자아이'], ['girl', '여자아이']]),
    radio('textSpeed', '연출 속도', [['normal', '보통'], ['fast', '빠르게'], ['instant', '즉시 표시']]),
    radio('touchControls', '터치 조작 버튼 표시', [['auto', '자동 (터치 기기에서 표시)'], ['on', '항상 표시'], ['off', '숨기기']]),
  );
}
