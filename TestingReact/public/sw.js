// Service Worker for CAM ID PWA Installation
const CACHE_NAME = 'camid-cache-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NEVER intercept non-GET requests
  if (event.request.method !== 'GET') return;

  // NEVER intercept API requests, Next.js assets, or hot reloading
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.includes('__nextjs') ||
    url.pathname.includes('webpack') ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Pass through other GET requests cleanly.
  // Never swallow fetch errors into fake 200 responses!
  event.respondWith(
    fetch(event.request).catch((err) => {
      // Only for full document navigation when genuinely offline
      if (event.request.mode === 'navigate') {
        return new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h2>Offline</h2><p>Please check your connection and reload.</p></body></html>',
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }
        );
      }
      throw err;
    })
  );
});
