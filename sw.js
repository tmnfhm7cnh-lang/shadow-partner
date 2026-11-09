/* Offline cache. Bump CACHE on every change, or installed copies keep the old version. */
const PREFIX = 'shadow-partner-';
const CACHE = `${PREFIX}v3`;

/* Without these the app does not run: if one is missing the install must fail loudly. */
const CORE = [
  './',
  './index.html',
  './styles.css',
  './src/core/engine.js',
  './src/core/interp.js',
  './src/core/library.js',
  './src/core/math.js',
  './src/core/moves/capoeira.js',
  './src/core/pose.js',
  './src/core/scheduler.js',
  './src/core/secondary.js',
  './src/core/skeleton.js',
  './src/core/tempo.js',
  './src/render/camera.js',
  './src/render/renderer.js',
  './src/ui/app.js',
  './src/ui/audio.js',
];
/* Cosmetic: a missing icon must never cost the offline cache (addAll rejects on a single 404). */
const EXTRAS = ['./manifest.webmanifest', './icon.svg', './icon-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE).then(() => Promise.all(EXTRAS.map((u) => c.add(u).catch(() => {})))))
      .then(() => self.skipWaiting()),
  );
});

/* Only delete OUR OWN old generations: angle-lab and dryland-test-logger share this origin
   (tmnfhm7cnh-lang.github.io) and keep their own caches there. */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
