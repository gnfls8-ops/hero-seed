import './style.css';
import { validateData } from './core/schema';
import { SaveStore, browserStorage } from './core/save';
import { App } from './ui/app';

function boot() {
  const root = document.getElementById('app')!;
  const errors = validateData();
  if (errors.length) {
    // 데이터 오류는 초기화 단계에서 바로 보여 준다
    root.textContent = '';
    const pre = document.createElement('pre');
    pre.className = 'data-errors';
    pre.textContent = `데이터 검증 오류 ${errors.length}건\n\n${errors.join('\n')}`;
    root.appendChild(pre);
    console.error(errors);
    return;
  }
  const saver = new SaveStore(browserStorage());
  const load = saver.load();
  const dev = new URLSearchParams(location.search).get('dev') === '1';
  const app = new App(root, saver, load, dev);
  (window as unknown as { __heroSeed: unknown }).__heroSeed = { snapshot: () => app.snapshot() };
  document.documentElement.dataset.ready = '1';
  document.getElementById('boot')?.remove();
}

boot();
