const CACHE_NAME = 'bms-ui-v2';
const PROTOCOL_CACHE_NAME = 'bms-protocol-api';
const PROTOCOL_API_ORIGINS = [
  'https://sql.hzxhhc.com',
  'https://api.bms.pub',
];

const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// 协议 API 缓存匹配
function isProtocolApiRequest(url) {
  return PROTOCOL_API_ORIGINS.includes(url.origin) && url.pathname.startsWith('/api/data');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== PROTOCOL_CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 协议 API 请求：网络优先，离线回退缓存（有网时更新本地缓存）
  if (isProtocolApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(PROTOCOL_CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || new Response(
            JSON.stringify({ error: 'offline', message: 'Protocol database not available offline' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          ))
        )
    );
    return;
  }

  // 只处理同源请求
  if (url.origin !== self.location.origin) return;

  // 导航请求：网络优先，离线回退缓存
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((r) => r || caches.match('/index.html'))
        )
    );
    return;
  }

  // 静态资源：缓存优先，后台更新（stale-while-revalidate）
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
