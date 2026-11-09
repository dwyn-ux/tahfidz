/* ============================================================
   Tahfidzku — Service Worker (PWA & Offline & Notifications)
   ============================================================ */

const CACHE_NAME = 'tahfidzku-cache-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/js/surah.js',
  './assets/js/pageData.js',
  './assets/js/store.js',
  './assets/js/ui.js',
  './assets/js/auth.js',
  './assets/js/views_shared.js',
  './assets/js/views_admin.js',
  './assets/js/views_ustadz.js',
  './assets/js/views_wali.js',
  './assets/js/views_quran.js',
  './assets/js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/icon.svg'
];

// Install: Cache core assets and take over immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[SW] Caching warning (non-fatal):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up older cache versions and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-while-revalidate for static files, Network-only/Network-first for API
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Always bypass caching for API requests or mutations
  if (url.pathname.includes('/api/') || req.method !== 'GET') {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(
          JSON.stringify({ ok: false, msg: 'Sedang offline. Periksa koneksi internet Anda.' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Google Fonts or CDN: Network-first with cache fallback
  if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetched = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || fetched;
      })
    );
    return;
  }

  // App shell / static assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Push notification received from server
self.addEventListener('push', (event) => {
  let data = {
    title: 'Tahfidzku',
    body: 'Ada pembaruan data hafalan/absensi di Tahfidzku.',
    icon: 'assets/icons/icon-192.png',
    badge: 'assets/icons/icon-192.png',
    data: './index.html'
  };

  if (event.data) {
    try {
      const json = event.data.json();
      data = Object.assign(data, json);
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || 'assets/icons/icon-192.png',
    badge: data.badge || 'assets/icons/icon-192.png',
    vibrate: [150, 80, 150],
    data: data.data || './index.html',
    actions: [
      { action: 'open', title: 'Buka Aplikasi' },
      { action: 'dismiss', title: 'Tutup' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data || './index.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (client.navigate) client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Message listener from web app
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Trigger notification via Service Worker
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const payload = event.data.payload || {};
    const title = payload.title || 'Tahfidzku';
    const options = {
      body: payload.body || 'Pemberitahuan dari Tahfidzku',
      icon: payload.icon || 'assets/icons/icon-192.png',
      badge: payload.badge || 'assets/icons/icon-192.png',
      vibrate: [150, 80, 150],
      data: payload.url || './index.html',
      tag: payload.tag || 'tahfidzku-notif-' + Date.now()
    };
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});
