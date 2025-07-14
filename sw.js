self.addEventListener('install', event => {
  self.skipWaiting(); // Kích hoạt ngay
});

self.addEventListener('fetch', event => {
  // Không cache, chỉ để kích hoạt khả năng PWA
});
