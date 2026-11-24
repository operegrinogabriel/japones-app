// Service worker: guarda o app e as aulas para funcionar sem internet.
// Ao mudar arquivos do app, aumente VERSION para forçar a atualização.
const VERSION = 'v2';
const CACHE = `japones-${VERSION}`;

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/util.js',
  'js/furigana.js',
  'js/store.js',
  'js/srs.js',
  'js/data.js',
  'js/tts.js',
  'js/ui.js',
  'js/review.js',
  'js/views.js',
  'js/browse.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'data/aulas/index.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      // Também guarda cada aula listada no índice.
      try {
        const idx = await (await fetch('data/aulas/index.json', { cache: 'no-cache' })).json();
        const files = Array.isArray(idx) ? idx : idx.aulas || [];
        await cache.addAll(files.map((f) => `data/aulas/${f}`));
      } catch (e) {
        /* sem rede: segue com o que tem */
      }
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url);

  // Aulas: tenta a rede primeiro (para pegar aulas novas), cai no cache sem internet.
  if (url.pathname.includes('/data/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch (e) {
          return (await cache.match(req, { ignoreSearch: true })) || Response.error();
        }
      })()
    );
    return;
  }

  // Resto do app: cache primeiro, atualizando em segundo plano.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const res = await network;
      if (res) return res;
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    })()
  );
});
