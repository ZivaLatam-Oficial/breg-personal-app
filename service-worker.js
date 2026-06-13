const CACHE_NAME = 'breg-shell-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

const API_BASE = 'https://ziva-core-backend-production-fb94.up.railway.app';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => key !== CACHE_NAME && caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ⚡ API (network first)
  if (event.request.method === 'GET' && url.href.startsWith(API_BASE)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // ⚡ APP SHELL (cache first)
  if (url.origin === location.origin) {
    event.respondWith(cacheFirst(event.request));
  }
});

function cacheFirst(request) {
  return caches.match(request).then(res => res || fetch(request));
}

function networkFirst(request) {
  return fetch(request)
    .then(res => {
      if (res && res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
      }
      return res;
    })
    .catch(() => caches.match(request));
}
