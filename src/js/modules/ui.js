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

const DEFAULT_MAX_LEN = 72;

export function truncateUrl(url, maxLen = DEFAULT_MAX_LEN) {
  const s = String(url);
  if (s.length <= maxLen) return s;
  const keep = Math.floor((maxLen - 3) / 2);
  return s.slice(0, keep) + '…' + s.slice(-keep);
}

export function truncatedEl(text, maxLen = DEFAULT_MAX_LEN, className = '') {
  const s = String(text);
  if (s.length <= maxLen) return el('span', { class: className, text: s, title: s });
  const node = el('span', { class: `pc-truncated ${className}`, title: s, text: truncateUrl(s, maxLen) });
  let expanded = false;
  node.addEventListener('click', () => {
    expanded = !expanded;
    node.textContent = expanded ? s : truncateUrl(s, maxLen);
    node.classList.toggle('pc-truncated-expanded', expanded);
  });
  return node;
}

export function renderResult({ title, stats, rows, cleanText, cleanUrl, actions }) {
  const body = document.getElementById('result-body');
  body.innerHTML = '';

  if (rows && rows.length) {
    for (const r of rows) body.appendChild(r);
  }
  if (cleanUrl) {
    body.appendChild(el('div', { class: 'pc-clean-url' }, [truncatedEl(cleanUrl, DEFAULT_MAX_LEN, 'pc-clean-url-text')]));
  }
  if (cleanText != null) {
    body.appendChild(el('div', { class: 'pc-clean-url pc-clean-text', style: 'border-color:var(--c-primary);color:var(--c-text);white-space:pre-wrap' }, [truncatedEl(cleanText, DEFAULT_MAX_LEN, 'pc-clean-text-inner')]));
  }

  document.getElementById('result-title').textContent = title;
  const statsEl = document.getElementById('result-stats');
  statsEl.textContent = stats || '';
  statsEl.title = stats || '';
  if (stats && stats.length > DEFAULT_MAX_LEN) {
    statsEl.textContent = truncateUrl(stats, DEFAULT_MAX_LEN);
  }
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