/* Service Worker — AK Al Momaiza Driver PWA
   Provides offline support by caching the app shell and recent API data.
   Install: Register this in index.html or App.js */

const CACHE_NAME = 'ak-driver-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
];

// Cache-first for app shell, network-first for API calls
const API_CACHE = 'ak-api-cache-v1';

// Install — cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(APP_SHELL).catch(() => {
          // Fail silently for any missing resources
          console.log('[SW] Some app shell resources unavailable');
        });
      })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network first for API, cache first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API calls: network-first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful API responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then(cache => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline — return cached API response
          return caches.match(request).then(cached => {
            if (cached) {
              console.log('[SW] Serving cached API:', url.pathname);
              return cached;
            }
            // Return offline JSON
            return new Response(
              JSON.stringify({ error: 'offline', message: 'No network — showing cached data' }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        // Cache static assets on first fetch
        if (response.ok && (url.pathname.startsWith('/static/') || url.pathname === '/')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Return index.html for navigation requests (SPA)
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Background sync — queue offline delivery completions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-deliveries') {
    event.waitUntil(syncDeliveries());
  }
});

async function syncDeliveries() {
  // Get queued offline completions from IndexedDB
  console.log('[SW] Syncing offline deliveries...');
  // Implementation: Read from IndexedDB queue, POST to API, clear on success
}

// Push notifications (future)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: 'New Delivery', body: 'You have a new delivery assignment' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/manifest.json',
      badge: '/manifest.json',
      vibrate: [200, 100, 200],
    })
  );
});
