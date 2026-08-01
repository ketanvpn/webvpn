// KETANTECH VPN — Service Worker
// Network-first for HTML, stale-while-revalidate for same-origin static assets

const CACHE_NAME = "ketantech-v2";
const OFFLINE_FALLBACK = "/";

// Install: pre-cache offline fallback
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_FALLBACK))
  );
  self.skipWaiting();
});

// Activate: delete old ketantech-* caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("ketantech-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip non-http(s) protocols
  if (!url.protocol.startsWith("http")) return;

  // Same-origin API calls: network-only, never cache
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: "Tidak ada koneksi internet" }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );
    return;
  }

  // Navigation requests: network-first
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh HTML for offline fallback
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(OFFLINE_FALLBACK, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline: serve cached root HTML or fallback offline page
          return caches.match(OFFLINE_FALLBACK).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response(
              '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Offline</title></head><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0a;color:#fff"><div style="text-align:center"><h1>Tidak Ada Koneksi</h1><p>Periksa koneksi internet Anda dan coba lagi.</p></div></body></html>',
              {
                status: 503,
                headers: { "Content-Type": "text/html; charset=utf-8" },
              }
            );
          });
        })
    );
    return;
  }

  // Cross-origin requests: network-only, never cache
  if (url.origin !== self.location.origin) {
    return;
  }

  // Same-origin static assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        // Only cache valid same-origin responses
        if (response && response.status === 200 && response.type === "basic") {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });

      return cached || fetchPromise;
    })
  );
});
