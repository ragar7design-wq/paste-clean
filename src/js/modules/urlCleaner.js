import { TRACKING_PARAMS, TRACKING_PATTERNS, DEFAULT_KEEP, REDIRECT_PARAMS, DOMAIN_RULES, classifyWithDomain } from '../data/trackers.js';

export function cleanUrl(input) {
  const raw = input.trim();
  let url;
  try {
    // Незакодированные # в значениях параметров ломают URL-парсинг (new URL считает всё после # — hash).
    // Но # может быть и реальным фрагментом (anchor). Различаем:
    // Если после # есть знак '=' или '&', значит это часть query, а не anchor.
    const qIdx = raw.indexOf('?');
    if (qIdx >= 0) {
      const queryAndHash = raw.slice(qIdx + 1);
      const hashIdx = queryAndHash.indexOf('#');
      if (hashIdx >= 0) {
        const afterHash = queryAndHash.slice(hashIdx + 1);
        // Если после # есть '=' или '&' — это не anchor, а незакодированный # в значении параметра
        if (afterHash.includes('=') || afterHash.includes('&')) {
          const before = raw.slice(0, qIdx + 1);
          const after = raw.slice(qIdx + 1).replace(/#/g, '%23');
          url = new URL(before + after);
        } else {
          url = new URL(raw);
        }
      } else {
        url = new URL(raw);
      }
    } else {
      url = new URL(raw);
    }
  }
  catch { return { ok: false, error: 'Невалидный URL' }; }

  const params = [...url.searchParams.entries()];
  const removed = [];
  const kept = [];
  let unwrapped = null;
  const domain = url.hostname;

  // Проверяем, есть ли параметр с вложенным URL (например continue=https%3A%2F%2F...)
  for (const [key, value] of params) {
    if (REDIRECT_PARAMS.has(key)) {
      try {
        const innerUrl = new URL(value);
        if (innerUrl.origin !== url.origin) {
          const innerClean = cleanUrl(innerUrl.toString());
          unwrapped = innerClean.ok ? innerClean.clean : innerUrl.toString();
        }
      } catch {
        // value не URL — игнорируем
      }
    }
  }

  for (const [key, value] of params) {
    const isTracker = classifyWithDomain(key, domain) === 'tracker';
    const isDefaultKeep = DEFAULT_KEEP.has(key);
    // Домен-специфичные правила имеют приоритет над DEFAULT_KEEP
    const isDomainSpecific = DOMAIN_RULES && Object.entries(DOMAIN_RULES).some(([dp, params]) => domain.includes(dp) && params.includes(key));
    const shouldRemove = isTracker && (!isDefaultKeep || isDomainSpecific);
    const isRedirect = REDIRECT_PARAMS.has(key) && unwrapped;
    if (shouldRemove) {
      const meta = TRACKING_PARAMS[key] || TRACKING_PATTERNS.find(p => p.re.test(key)) || { group: 'Tracking', desc: 'Tracking parameter.' };
      removed.push({ key, value, meta });
    } else if (isRedirect) {
      removed.push({ key, value, meta: { group: 'Redirect', desc: 'Вложенный URL-редирект — распакован.' } });
    } else {
      kept.push({ key, value });
    }
  }

  // Если был распакован URL и не осталось kept-параметров — результат = распакованный URL
  if (unwrapped && kept.length === 0) {
    const original = input.trim();
    const savedPct = original.length > 0 ? Math.round((1 - unwrapped.length / original.length) * 100) : 0;
    return {
      ok: true,
      clean: unwrapped,
      removed,
      kept: [],
      unwrapped: true,
      stats: {
        removedCount: removed.length,
        keptCount: 0,
        savedPct: Math.max(0, savedPct),
        originalLength: original.length,
        cleanLength: unwrapped.length
      }
    };
  }

  const cleanUrlObj = new URL(url.origin + url.pathname);
  for (const { key, value } of kept) cleanUrlObj.searchParams.set(key, value);
  if (url.hash) cleanUrlObj.hash = url.hash;

  const original = input.trim();
  const clean = cleanUrlObj.toString();
  const savedPct = original.length > 0 ? Math.round((1 - clean.length / original.length) * 100) : 0;

  return {
    ok: true,
    clean,
    removed,
    kept,
    unwrapped: false,
    stats: {
      removedCount: removed.length,
      keptCount: kept.length,
      savedPct: Math.max(0, savedPct),
      originalLength: original.length,
      cleanLength: clean.length
    }
  };
}

export function restoreParam(currentClean, key, value) {
  const u = new URL(currentClean);
  u.searchParams.set(key, value);
  return u.toString();
}