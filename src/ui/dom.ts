// 안전한 DOM 생성 도우미: 문자열 자식은 항상 텍스트 노드로 들어간다 (HTML로 해석하지 않음).
export type Child = Node | string | number | null | undefined | false | Child[];
type Handler = (e: Event) => void;
export interface Props {
  class?: string;
  text?: string;
  dataset?: Record<string, string>;
  style?: Partial<CSSStyleDeclaration> | Record<string, string>;
  [attr: string]: unknown;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'text') el.textContent = String(v);
      else if (k === 'dataset') Object.assign(el.dataset, v as Record<string, string>);
      else if (k === 'style') {
        for (const [sk, sv] of Object.entries(v as Record<string, string>)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else (el.style as unknown as Record<string, string>)[sk] = sv;
        }
      } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as Handler);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el: Element) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function btn(label: Child, onClick: (e: MouseEvent) => void, props: Props = {}): HTMLButtonElement {
  const b = h('button', { type: 'button', class: 'btn', ...props }, label);
  b.addEventListener('click', (e) => onClick(e as MouseEvent));
  return b;
}

export function sprite(name: string, url: string, cls = 'sprite', alt = ''): HTMLImageElement {
  return h('img', { class: cls, src: url, alt, draggable: 'false', dataset: { sprite: name } });
}
