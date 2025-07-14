const CACHE_NAME = "abcsnoob-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/styles.css",
  "/assets/image/abcsnoobpointleft.png",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/apple-touch-icon.png",
  "/site.webmanifest",
  "/assets/music/Tobu-Hope(Original Mix).mp3"
];

// Cài đặt service worker và cache trước các file
self.addEventListener("install", event => {
  self.skipWaiting(); // Kích hoạt ngay
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Kích hoạt và xóa cache cũ (nếu có)
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      )
    )
  );
  return self.clients.claim();
});

// Intercept fetch requests
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
