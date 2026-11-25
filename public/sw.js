/**
 * Chalo NorthEast — Service Worker
 * Cache-first static assets, network-first API calls, offline fallback
 */

const CACHE_VERSION = 'chalonne-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const OFFLINE_PACK_CACHE = `${CACHE_VERSION}-offline-pack`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/data.js',
  '/js/map.js',
  '/js/planner.js',
  '/js/app.js',
  '/manifest.json'
];

// ── Install: pre-cache static shell ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache partial failure (non-fatal):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter(k => k.startsWith('chalonne-') && ![STATIC_CACHE, API_CACHE, OFFLINE_PACK_CACHE].includes(k))
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch strategy ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API calls → network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
    return;
  }

  // HTML navigation requests → network-first so users immediately see updates
  if (request.mode === 'navigate' || request.destination === 'document' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(networkFirstWithCache(request, STATIC_CACHE));
    return;
  }

  // Offline pack check
  if (url.pathname === '/offline-pack') {
    event.respondWith(caches.match(request, { cacheName: OFFLINE_PACK_CACHE }));
    return;
  }

  // On localhost / 127.0.0.1, always fetch fresh from network to prevent dev caching issues
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    event.respondWith(networkFirstWithCache(request, STATIC_CACHE));
    return;
  }

  // Static assets → cache-first
  event.respondWith(cacheFirstWithNetwork(request));
});

async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request, { ignoreSearch: false });
  if (cached) return cached;
  try {
    const networkRes = await fetch(request);
    if (networkRes && networkRes.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch {
    // For HTML navigation requests, return cached index.html as fallback
    if (request.destination === 'document') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline — please reconnect to load this resource.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function networkFirstWithCache(request, cacheName) {
  try {
    const networkRes = await fetch(request);
    if (networkRes && networkRes.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch {
    const cached = await caches.match(request, { cacheName });
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ── Offline Pack: message handler ─────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'STORE_OFFLINE_PACK') {
    const { key, data } = event.data;
    storeOfflinePack(key, data).then(() => {
      event.ports[0] && event.ports[0].postMessage({ success: true, key });
    });
  }

  if (event.data.type === 'CLEAR_OFFLINE_PACK') {
    caches.delete(OFFLINE_PACK_CACHE).then(() => {
      event.ports[0] && event.ports[0].postMessage({ success: true });
    });
  }

  if (event.data.type === 'GET_CACHE_STATUS') {
    getCacheStatus().then((status) => {
      event.ports[0] && event.ports[0].postMessage(status);
    });
  }
});

async function storeOfflinePack(key, data) {
  const cache = await caches.open(OFFLINE_PACK_CACHE);
  const response = new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'X-Offline-Pack-Key': key }
  });
  await cache.put(`/offline-pack/${key}`, response);
}

async function getCacheStatus() {
  const [staticKeys, apiKeys, packKeys] = await Promise.all([
    caches.open(STATIC_CACHE).then(c => c.keys()),
    caches.open(API_CACHE).then(c => c.keys()),
    caches.open(OFFLINE_PACK_CACHE).then(c => c.keys())
  ]);
  return {
    staticAssets: staticKeys.length,
    apiResponses: apiKeys.length,
    offlinePacks: packKeys.length,
    version: CACHE_VERSION
  };
}

// ── Background sync: queue failed reports ─────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(syncQueuedReports());
  }
});

async function syncQueuedReports() {
  // Reports queued in localStorage are sent when back online
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_REPORTS' }));
}

// ── Push notification handler ─────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Chalo NorthEast', {
      body: data.body || 'New update available',
      icon: '/images/icon-192.png',
      badge: '/images/icon-192.png',
      tag: data.tag || 'chalonne-update',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
