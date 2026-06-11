self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("mayyat-v1").then((cache) => cache.addAll(["/", "/public", "/login", "/manifest.webmanifest"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/public")))
  );
});
