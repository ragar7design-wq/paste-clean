import { createServer, request as httpRequest } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const PUBLIC_DIR = resolve('public');
const PORT = Number(process.env.PORT || 5173);
const API_PORT = Number(process.env.API_PORT || PORT + 1);

const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.txt', 'text/plain; charset=utf-8'], ['.webmanifest', 'application/manifest+json']
]);

function serve(req, res) {
  const rawPath = new URL(req.url, 'http://localhost').pathname;

  if (rawPath.startsWith('/api/')) {
    const proxyReq = httpRequest(
      { hostname: '127.0.0.1', port: API_PORT, path: req.url, method: req.method, headers: req.headers },
      (proxyRes) => { res.writeHead(proxyRes.statusCode, proxyRes.headers); proxyRes.pipe(res); }
    );
    proxyReq.on('error', () => { res.writeHead(502).end('API unavailable'); });
    req.pipe(proxyReq);
    return;
  }

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

createServer(serve).listen(PORT, () => console.log(`PasteClean dev → http://localhost:${PORT}  (API on :${API_PORT})`));