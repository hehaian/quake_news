/* Service Worker for 地震地质每日播报 PWA (健壮版) */
const CACHE_NAME = 'quake-broadcast-v3';

/* 只缓存确定的静态资源；导航请求 ./ 交由 fetch 的 network-first 处理，不进 addAll */
const CORE_ASSETS = [
  './manifest.json',
  './sw.js',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

/* install：逐个缓存，单个失败不影响整体，确保 install 永不 reject */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of CORE_ASSETS) {
      try {
        await cache.add(url);
      } catch (err) {
        console.warn('[sw] 缓存失败（跳过）：', url, err);
      }
    }
  })());
  self.skipWaiting();
});

/* activate：清掉旧版本缓存，并立即接管已打开的页面 */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
  })());
  self.clients.claim();
});

/* fetch：导航请求 network-first（在线拉最新、离线回退缓存）；静态资源 cache-first */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) =>
            cached || caches.match('./').then((c2) => c2 || Response.error())
          )
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      });
    })
  );
});
