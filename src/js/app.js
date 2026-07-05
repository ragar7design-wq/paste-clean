import { cleanUrl, restoreParam, removeParam, rebuildCleanUrl } from './modules/urlCleaner.js';
import { inspectText } from './modules/textInspector.js';
import { xray } from './modules/xray.js';
import { copyText, readClipboard } from './modules/clipboard.js';
import { el, renderResult, truncatedEl, truncateUrl } from './modules/ui.js';
import { track, trackSummary } from './modules/analytics.js';

let mode = 'url';
let lastClean = null;

const input = document.getElementById('paste-input');
const tabs = document.querySelectorAll('.pc-tab');

function setMode(m) {
  mode = m;
  tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === m));
  const labels = { url: 'URL Cleaner', text: 'Text Inspector', xray: 'X-Ray Redirects' };
  input.placeholder = {
    url: 'Вставьте URL с трекерами... [Ctrl+V]',
    text: 'Вставьте текст для проверки на невидимые символы... [Ctrl+V]',
    xray: 'Вставьте URL для разворота редиректов... [Ctrl+V]'
  }[m];
}
tabs.forEach(t => t.addEventListener('click', () => { setMode(t.dataset.mode); process(); }));
setMode('url');

async function handlePaste() {
  const text = await readClipboard();
  if (text) { input.value = text; process(); }
}

let currentUrlParams = [];
let currentBaseUrl = '';
let currentUnwrapped = false;

function makeUrlRow({ key, value, state, meta }, onToggle) {
  const row = el('div', { class: `pc-row ${state}` });
  const keySpan = truncatedEl(`${key}=${value}`, 48, 'pc-key');
  row.appendChild(keySpan);
  const right = el('div', { style: 'display:flex;gap:8px;align-items:center;flex-shrink:0' });
  if (meta) right.appendChild(el('span', { class: 'pc-mono', style: 'color:var(--c-text-muted);font-size:11px', title: meta.desc, text: meta.group }));
  right.appendChild(el('span', { class: `pc-tag ${state}`, text: state === 'removed' ? 'REMOVED' : 'KEPT' }));
  const btnText = state === 'removed' ? '↩ восстановить' : '✕ удалить';
  right.appendChild(el('button', { class: 'pc-undo', text: btnText, onclick: onToggle }));
  row.appendChild(right);
  return row;
}

function updateCleanUrlDisplay(clean) {
  lastClean = clean;
  const cleanEl = document.querySelector('.pc-clean-url-text') || document.querySelector('.pc-clean-url');
  if (cleanEl) {
    cleanEl.title = clean;
    cleanEl.textContent = clean.length > 72 ? truncateUrl(clean, 72) : clean;
    cleanEl.classList.remove('pc-truncated-expanded');
  }
}

function renderUrlState() {
  const kept = currentUrlParams.filter(p => p.state === 'kept');
  const removed = currentUrlParams.filter(p => p.state === 'removed');
  lastClean = rebuildCleanUrl(currentBaseUrl, kept);
  updateCleanUrlDisplay(lastClean);

  const body = document.getElementById('result-body');
  body.innerHTML = '';
  const rows = removed.map(item => makeUrlRow(item, () => toggleParam(item.key))).concat(kept.map(item => makeUrlRow(item, () => toggleParam(item.key))));
  for (const r of rows) body.appendChild(r);

  const total = currentUrlParams.length;
  const savedPct = total > 0 ? Math.round((removed.length / total) * 100) : 0;
  const stats = `${currentUnwrapped ? '🔗 URL распакован · ' : ''}Удалено ${removed.length}, сохранено ${kept.length}, URL короче на ${savedPct}%`;
  const statsEl = document.getElementById('result-stats');
  statsEl.textContent = stats;
  statsEl.title = stats;

  trackSummary('url', { removedCount: removed.length, keptCount: kept.length, savedPct });
}

function toggleParam(key) {
  const p = currentUrlParams.find(x => x.key === key);
  if (!p) return;
  p.state = p.state === 'removed' ? 'kept' : 'removed';
  renderUrlState();
}

function processUrl(value) {
  const r = cleanUrl(value);
  if (!r.ok) { renderResult({ title: 'Ошибка', stats: r.error }); return; }

  let url;
  try {
    const raw = value.trim();
    const qIdx = raw.indexOf('?');
    if (qIdx >= 0) {
      const queryAndHash = raw.slice(qIdx + 1);
      const hashIdx = queryAndHash.indexOf('#');
      if (hashIdx >= 0 && (queryAndHash.slice(hashIdx + 1).includes('=') || queryAndHash.slice(hashIdx + 1).includes('&'))) {
        url = new URL(raw.slice(0, qIdx + 1) + raw.slice(qIdx + 1).replace(/#/g, '%23'));
      } else {
        url = new URL(raw);
      }
    } else {
      url = new URL(raw);
    }
  } catch { renderResult({ title: 'Ошибка', stats: 'Невалидный URL' }); return; }

  currentBaseUrl = url.origin + url.pathname + (url.hash || '');
  currentUnwrapped = r.unwrapped || false;

  currentUrlParams = [
    ...r.removed.map(item => ({ key: item.key, value: item.value, state: 'removed', meta: item.meta })),
    ...r.kept.map(item => ({ key: item.key, value: item.value, state: 'kept', meta: null }))
  ];

  renderResult({
    title: 'URL Cleaner',
    stats: '',
    rows: [],
    cleanUrl: r.clean,
    actions: {
      onCopy: async () => { await copyText(lastClean); flashCopy(); },
      onOpen: () => { if (lastClean) window.open(lastClean, '_blank', 'noopener'); },
      onSweep: () => { input.value = ''; document.getElementById('result-panel').classList.add('hidden'); }
    }
  });
  renderUrlState();
}

function processText(value) {
  const r = inspectText(value);
  if (!r.ok) { renderResult({ title: 'Ошибка', stats: r.error }); return; }
  const rows = r.findings.map(f => {
    const row = el('div', { class: 'pc-row removed' });
    row.appendChild(el('span', { class: 'pc-key', text: `${f.name} (${f.code}) @ pos ${f.index}${f.sample ? `: «${f.sample}»` : ''}` }));
    row.appendChild(el('span', { class: 'pc-tag removed', text: 'FOUND' }));
    return row;
  });
  renderResult({
    title: 'Text Inspector',
    stats: r.findings.length ? `Найдено ${r.stats.count}: ${r.stats.invisible} невидимых, ${r.stats.homoglyphs} homoglyphs` : 'Чисто — невидимых символов нет',
    rows: rows.length ? rows : [el('div', { class: 'pc-row kept', text: 'Текст чистый ✅' })],
    cleanText: r.cleaned,
    actions: {
      onCopy: async () => { await copyText(r.cleaned); flashCopy(); },
      onOpen: () => {}, onSweep: () => { input.value = ''; document.getElementById('result-panel').classList.add('hidden'); }
    }
  });
  trackSummary('text', r.stats);
}

async function processXray(value) {
  renderResult({ title: 'X-Ray', stats: 'Разворачиваю редиректы...' });
  const r = await xray(value);
  if (!r.ok) { renderResult({ title: 'Ошибка', stats: r.error }); return; }
  const rows = r.chain.map((h, i) => {
    const row = el('div', { class: 'pc-hop' });
    row.appendChild(el('span', { class: 'pc-hop-num', text: `${i + 1}.` }));
    row.appendChild(truncatedEl(h.url, 64, 'pc-hop-url'));
    const st = el('span', { class: 'pc-hop-status', text: `${h.status} ${h.safe ? 'OK' : '⚠'}` });
    st.style.color = h.safe ? 'var(--c-success)' : 'var(--c-danger)';
    st.style.background = h.safe ? 'color-mix(in srgb,var(--c-success) 12%,transparent)' : 'color-mix(in srgb,var(--c-danger) 12%,transparent)';
    row.appendChild(st);
    return row;
  });
  renderResult({
    title: 'X-Ray Redirects',
    stats: `Хопов: ${r.totalHops}${r.suspicious ? ' · ⚠ подозрительно' : ' · OK'} · final: ${r.finalUrl}`,
    rows,
    actions: {
      onCopy: async () => { await copyText(r.finalUrl); flashCopy(); },
      onOpen: () => { window.open(r.finalUrl, '_blank', 'noopener'); },
      onSweep: () => { input.value = ''; document.getElementById('result-panel').classList.add('hidden'); }
    }
  });
  trackSummary('xray', { hops: r.totalHops, suspicious: r.suspicious });
}

function process() {
  const value = input.value.trim();
  if (!value) { document.getElementById('result-panel').classList.add('hidden'); return; }
  if (mode === 'url') processUrl(value);
  else if (mode === 'text') processText(value);
  else if (mode === 'xray') processXray(value);
}

function flashCopy() {
  const btn = document.getElementById('copy-btn');
  const old = btn.textContent;
  btn.textContent = '✓ Скопировано!';
  btn.classList.add('pc-copied');
  setTimeout(() => { btn.textContent = old; btn.classList.remove('pc-copied'); }, 2000);
}

document.getElementById('paste-btn').addEventListener('click', handlePaste);
document.getElementById('clear-btn').addEventListener('click', () => {
  input.value = ''; document.getElementById('result-panel').classList.add('hidden');
});
let t;
input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(process, 150); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
