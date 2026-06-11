const CACHE_NAME = 'breg-personal-shell-v1';
const APP_SHELL = [
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];
const API_BASE = 'https://ziva-core-backend-production-fb94.up.railway.app';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => {
      if (key !== CACHE_NAME) return caches.delete(key);
    })))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin === location.origin) {
    event.respondWith(cacheFirst(event.request));
    return;
  }
  if (event.request.method === 'GET' && event.request.url.startsWith(API_BASE)) {
    event.respondWith(networkFirst(event.request));
  }
});

function cacheFirst(request) {
  return caches.match(request).then(cached => cached || fetch(request));
}

function networkFirst(request) {
  return caches.open(CACHE_NAME).then(cache => {
    return fetch(request).then(response => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    }).catch(() => caches.match(request));
  });
}
