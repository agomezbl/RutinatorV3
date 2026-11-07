/* Rutineitor v3 — service worker. Cachea la app para que funcione sin internet. */
const CACHE = 'rutineitor-v3.5.1';
const ARCHIVOS = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './apple-touch-icon.png', './favicon-32.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET') return;
  // Lo de Supabase nunca se cachea: siempre a la red.
  if (url.origin !== self.location.origin) return;
  ev.respondWith(
    caches.match(ev.request).then((enCache) => {
      const red = fetch(ev.request)
        .then((res) => {
          if (res && res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(ev.request, copia));
          }
          return res;
        })
        .catch(() => enCache);
      return enCache || red;
    }),
  );
});
