const MAX_HOPS = 10;
const TIMEOUT_MS = 5000;
const CORS_PROXIES = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`
];

function isIp(host) { return /^(\d{1,3}\.){3}\d{1,3}$/.test(host); }

async function fetchWithTimeout(url, opts = {}, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

async function resolveViaApi(url) {
  try {
    const res = await fetchWithTimeout(`/api/xray?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ok ? data : null;
  } catch {
    return null;
  }
}

async function resolveHop(url) {
  try {
    const res = await fetchWithTimeout(url, { redirect: 'manual' });
    const status = res.status;
    const location = res.headers.get('location');
    if (status >= 300 && status < 400 && location) {
      const next = new URL(location, url).toString();
      return { url, status, next, safe: true };
    }
    return { url, status, next: null, safe: true };
  } catch {
    for (const proxy of CORS_PROXIES) {
      try {
        const res = await fetchWithTimeout(proxy(url));
        const text = await res.text();
        const m = text.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"'>]+)/i);
        if (m) return { url, status: res.status, next: new URL(m[1], url).toString(), safe: true };
        return { url, status: res.status, next: null, safe: true };
      } catch {}
    }
    return { url, status: 0, next: null, safe: false };
  }
}

export async function xray(input) {
  let url;
  try { url = new URL(input.trim()).toString(); }
  catch { return { ok: false, error: 'Невалидный URL' }; }

  const apiResult = await resolveViaApi(url);
  if (apiResult) return apiResult;

  const chain = [];
  let current = url;
  let suspicious = false;

  for (let i = 0; i < MAX_HOPS; i++) {
    const hop = await resolveHop(current);
    let domain = '';
    try { domain = new URL(current).hostname; } catch {}
    const safe = hop.safe && !isIp(domain);
    if (isIp(domain)) suspicious = true;
    chain.push({ url: current, status: hop.status, domain, safe });
    if (!hop.next || hop.next === current) break;
    current = hop.next;
  }

  if (chain.length > 5) suspicious = true;

  return {
    ok: true,
    chain,
    finalUrl: chain[chain.length - 1].url,
    totalHops: chain.length,
    suspicious
  };
}
