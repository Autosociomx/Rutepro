/*
 * RoutePro Elite — Service Worker
 * Estrategia: network-first con fallback a caché para que la app
 * abra y opere en ruta sin señal (el repartidor en zona muerta).
 * Las escrituras de datos las maneja Firestore con su cola offline.
 */
const CACHE_NAME = 'routepro-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Solo GET del mismo origen — Firestore/Gemini/API pasan directo
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  // No interceptar el API propio del backend
  if (new URL(request.url).pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // Navegación sin red y sin caché exacto → shell de la app
          if (request.mode === 'navigate') return caches.match('/index.html');
          return Response.error();
        })
      )
  );
});
