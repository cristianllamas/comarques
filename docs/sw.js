// Offline cache. Everything is precached on install so the first tap after
// "add to home screen" works on the bus with no signal.
const CACHE = 'comarques-v2';
const FILES = [
  '.', 'index.html', 'styles.css', 'app.js', 'map.js', 'quiz.js', 'scheduler.js',
  'answer.js', 'store.js', 'geo.js', 'hints.js', 'photos.js', 'manifest.json', 'icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(FILES))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache-first, but always refresh in the background so a push to Pages reaches him.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => {
    const net = fetch(e.request).then((res) => {
      if (res && res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
