const CACHE_NAME = "abc-cache-v1";
const urlsToCache = ["/", "/index.html", "/styles.css", "/assets/image/abcsnoobpointleft.png"];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
