import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const PUBLIC_DIR = resolve('public');
const PORT = Number(process.env.PORT || process.env.INTERNAL_PORT || 8080);
const MAX_HOPS = 10;
const TIMEOUT_MS = 5000;
const USER_AGENT = 'PasteClean/1.0 (+https://github.com/ragar7design-wq/paste-clean)';

const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.txt', 'text/plain; charset=utf-8'], ['.webmanifest', 'application/manifest+json']
]);

function isIp(host) { return /^(\d{1,3}\.){3}\d{1,3}$/.test(host); }
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function fetchHop(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': USER_AGENT } });
    if ([405, 403].includes(response.status)) {
      response = await fetch(url, { method: 'GET', redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-4096' } });
    }
    const location = response.headers.get('location');
    const next = response.status >= 300 && response.status < 400 && location ? new URL(location, url).toString() : null;
    return { status: response.status, next };
  } finally {
    clearTimeout(timer);
  }
}

async function handleXray(req, res) {
  const requested = new URL(req.url, 'http://localhost').searchParams.get('url');
  let current;
  try {
    current = new URL((requested || '').trim()).toString();
    if (!['http:', 'https:'].includes(new URL(current).protocol)) throw new Error('unsupported protocol');
  } catch {
    json(res, 400, { ok: false, error: 'Невалидный URL' });
    return;
  }

  const chain = [];
  let suspicious = false;
  const seen = new Set();
  for (let i = 0; i < MAX_HOPS; i += 1) {
    if (seen.has(current)) { suspicious = true; break; }
    seen.add(current);
    let domain = '';
    try { domain = new URL(current).hostname; } catch {}
    try {
      const hop = await fetchHop(current);
      const safe = !isIp(domain);
      if (!safe) suspicious = true;
      chain.push({ url: current, status: hop.status, domain, safe });
      if (!hop.next) break;
      current = hop.next;
    } catch {
      chain.push({ url: current, status: 0, domain, safe: false });
      suspicious = true;
      break;
    }
  }
  if (chain.length > 5) suspicious = true;
  json(res, 200, { ok: true, chain, finalUrl: chain.at(-1).url, totalHops: chain.length, suspicious });
}

function serveStatic(req, res) {
  const rawPath = new URL(req.url, 'http://localhost').pathname;
  const safePath = normalize(decodeURIComponent(rawPath)).replace(/^(\.\.[/\\])+/, '');
  let file = resolve(join(PUBLIC_DIR, safePath));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403).end(); return; }
  try { if (statSync(file).isDirectory()) file = join(file, 'index.html'); } catch {}
  try {
    const st = statSync(file);
    res.writeHead(200, { 'Content-Type': types.get(extname(file)) || 'application/octet-stream', 'Content-Length': st.size });
    createReadStream(file).pipe(res);
  } catch {
    createReadStream(join(PUBLIC_DIR, 'index.html')).pipe(res);
  }
}

createServer((req, res) => {
  if (req.url?.startsWith('/api/xray')) handleXray(req, res).catch(() => json(res, 500, { ok: false, error: 'Ошибка сервера X-Ray' }));
  else serveStatic(req, res);
}).listen(PORT, '127.0.0.1', () => console.log(`PasteClean listening on 127.0.0.1:${PORT}`));
