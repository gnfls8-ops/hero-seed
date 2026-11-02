// 단순 모달: 한 번에 하나. Escape로 닫기, 포커스는 첫 버튼으로 이동하고 닫으면 원래 자리로 돌아간다.
import { h, type Child } from './dom';

export interface ModalAction {
  label: string;
  primary?: boolean;
  testid?: string;
  onClick: () => void | boolean; // false를 돌려주면 닫지 않음
}

export interface ModalOptions {
  title: string;
  body: Child;
  actions?: ModalAction[];
  closable?: boolean;
  onClose?: () => void;
  wide?: boolean;
  testid?: string;
}

export class Modals {
  private root: HTMLElement;
  private current: { el: HTMLElement; opts: ModalOptions; returnFocus: Element | null } | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    document.addEventListener('keydown', (e) => {
      if (!this.current) return;
      if (e.key === 'Escape' && this.current.opts.closable !== false) {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      } else if (e.key === 'Tab') this.trapTab(e);
    }, true);
  }

  isOpen(): boolean {
    return this.current !== null;
  }

  open(opts: ModalOptions): { close: () => void } {
    this.close();
    const titleId = `modal-title-${Math.random().toString(36).slice(2, 8)}`;
    const actions = (opts.actions ?? [{ label: '닫기', onClick: () => undefined }]).map((a) =>
      h('button', {
        type: 'button',
        class: `btn ${a.primary ? 'btn-primary' : ''}`,
        dataset: a.testid ? { testid: a.testid } : undefined,
        onClick: () => {
          if (a.onClick() !== false) this.close();
        },
      }, a.label),
    );
    const dialog = h('div', {
      class: `modal ${opts.wide ? 'modal-wide' : ''}`,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
      dataset: opts.testid ? { testid: opts.testid } : undefined,
    },
      h('h2', { id: titleId, class: 'modal-title' }, opts.title),
      h('div', { class: 'modal-body' }, opts.body),
      h('div', { class: 'modal-actions' }, actions),
    );
    const backdrop = h('div', { class: 'modal-backdrop' }, dialog);
    backdrop.addEventListener('pointerdown', (e) => {
      if (e.target === backdrop && opts.closable !== false) this.close();
    });
    this.current = { el: backdrop, opts, returnFocus: document.activeElement };
    this.root.appendChild(backdrop);
    const first = (dialog.querySelector('.modal-body button, .modal-body input, .modal-body summary') as HTMLElement | null) ?? actions[actions.length - 1];
    (actions.find((_, i) => opts.actions?.[i]?.primary) ?? first)?.focus();
    return { close: () => this.close() };
  }

  close() {
    const c = this.current;
    if (!c) return;
    this.current = null;
    c.el.remove();
    c.opts.onClose?.();
    if (c.returnFocus instanceof HTMLElement && document.contains(c.returnFocus)) c.returnFocus.focus();
  }

  confirm(title: string, message: Child, okLabel = '확인', cancelLabel = '취소', testid = 'confirm'): Promise<boolean> {
    return new Promise((resolve) => {
      let result = false;
      this.open({
        title,
        body: h('div', null, message),
        testid,
        onClose: () => resolve(result),
        actions: [
          { label: cancelLabel, testid: `${testid}-cancel`, onClick: () => { result = false; } },
          { label: okLabel, primary: true, testid: `${testid}-ok`, onClick: () => { result = true; } },
        ],
      });
    });
  }

  private trapTab(e: KeyboardEvent) {
    const els = [...this.current!.el.querySelectorAll<HTMLElement>('button, input, summary, [tabindex="0"]')].filter((x) => !x.hasAttribute('disabled'));
    if (!els.length) return;
    const first = els[0]!;
    const last = els[els.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
