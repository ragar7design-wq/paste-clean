const CACHE = 'pasteclean-v1';
const ASSETS = [
  '/', '/index.html', '/manifest.json', '/favicon/icon.svg', '/robots.txt',
  '/css/main.css', '/css/components.css', '/css/animations.css',
  '/js/app.js',
  '/js/modules/urlCleaner.js', '/js/modules/textInspector.js', '/js/modules/xray.js',
  '/js/modules/clipboard.js', '/js/modules/ui.js', '/js/modules/analytics.js',
  '/js/data/trackers.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});