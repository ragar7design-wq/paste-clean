export function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) { if (c) n.append(c); }
  return n;
}

export function renderResult({ title, stats, rows, cleanText, cleanUrl, actions }) {
  const body = document.getElementById('result-body');
  body.innerHTML = '';

  if (rows && rows.length) {
    for (const r of rows) body.appendChild(r);
  }
  if (cleanUrl) {
    body.appendChild(el('div', { class: 'pc-clean-url', text: cleanUrl }));
  }
  if (cleanText != null) {
    body.appendChild(el('div', { class: 'pc-clean-url', style: 'border-color:var(--c-primary);color:var(--c-text);white-space:pre-wrap', text: cleanText }));
  }

  document.getElementById('result-title').textContent = title;
  document.getElementById('result-stats').textContent = stats || '';
  const panel = document.getElementById('result-panel');
  panel.classList.remove('hidden');
  panel.classList.add('pc-sweep');
  setTimeout(() => panel.classList.remove('pc-sweep'), 400);

  if (actions) {
    document.getElementById('copy-btn').onclick = actions.onCopy || (() => {});
    document.getElementById('open-btn').onclick = actions.onOpen || (() => {});
    document.getElementById('sweep-btn').onclick = actions.onSweep || (() => {});
  }

  return panel;
}
