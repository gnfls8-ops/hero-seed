// 문단을 한 글자씩 보여 주는 연출. 자동으로 다음 단계로 넘어가지 않는다.
import type { TextSpeed } from '../core/types';
import { h } from './dom';

const MS_PER_CHAR: Record<TextSpeed, number> = { normal: 26, fast: 8, instant: 0 };

export class Typewriter {
  readonly el: HTMLDivElement;
  done = false;
  private raf = 0;
  private paras: Array<{ el: HTMLElement; text: string }> = [];
  private listeners: Array<() => void> = [];

  constructor(paragraphs: string[], speed: TextSpeed, cls = 'story') {
    this.el = h('div', { class: cls });
    // 화면 낭독기는 전체 문장을 바로 읽도록 숨은 사본을 둔다
    this.el.appendChild(h('div', { class: 'sr-only' }, paragraphs.map((p) => h('p', null, p))));
    for (const text of paragraphs) {
      const p = h('p', { 'aria-hidden': 'true' });
      this.paras.push({ el: p, text });
      this.el.appendChild(p);
    }
    this.el.addEventListener('click', () => this.revealAll());
    const ms = MS_PER_CHAR[speed];
    if (ms === 0 || typeof requestAnimationFrame === 'undefined') {
      this.revealAll();
      return;
    }
    const total = this.paras.reduce((n, p) => n + p.text.length, 0);
    const start = performance.now();
    const tick = (now: number) => {
      let n = Math.floor((now - start) / ms);
      for (const p of this.paras) {
        const show = Math.max(0, Math.min(p.text.length, n));
        if (p.el.textContent!.length !== show) p.el.textContent = p.text.slice(0, show);
        n -= p.text.length;
      }
      if ((now - start) / ms >= total) this.finish();
      else this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  onDone(fn: () => void) {
    if (this.done) fn();
    else this.listeners.push(fn);
  }

  revealAll() {
    for (const p of this.paras) p.el.textContent = p.text;
    this.finish();
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    cancelAnimationFrame(this.raf);
    const ls = this.listeners;
    this.listeners = [];
    ls.forEach((f) => f());
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.listeners = [];
  }
}
