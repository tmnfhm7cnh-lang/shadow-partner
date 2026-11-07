/* Offline cache. Bump CACHE on every change, or installed copies keep the old version. */
const CACHE = 'shadow-partner-v1';
const FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icon.svg',
  './src/core/engine.js',
  './src/core/interp.js',
  './src/core/library.js',
  './src/core/math.js',
  './src/core/moves/capoeira.js',
  './src/core/pose.js',
  './src/core/scheduler.js',
  './src/core/skeleton.js',
  './src/core/tempo.js',
  './src/render/camera.js',
  './src/render/renderer.js',
  './src/ui/app.js',
  './src/ui/audio.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
