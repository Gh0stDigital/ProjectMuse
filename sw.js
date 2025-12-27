const CACHE_NAME = 'muse-proto-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/js/game.js',
  '/js/core.js',
  '/js/ui.js',
  '/js/battle.js',
  '/assets/PlayerBust.png',
  '/assets/Mantra-Weaver.png',
  '/assets/SwordAttack.gif'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => { if (k !== CACHE_NAME) return caches.delete(k); })
    ))
  );
  self.clients.claim();
});

// Listen for messages from the page (e.g., SKIP_WAITING to immediately activate)
self.addEventListener('message', (e) => {
  try {
    if (!e.data) return;
    if (e.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  } catch (err) {}
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // only handle GET requests
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(net => {
      // update cache for same-origin resources
      try {
        const url = new URL(req.url);
        if (url.origin === location.origin) {
          const copy = net.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
      } catch (err) {}
      return net;
    }).catch(() => caches.match('/index.html')))
  );
});
