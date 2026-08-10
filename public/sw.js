self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Empty fetch handler to satisfy PWA installation requirements.
  // In a full offline PWA, you would handle cache strategies here.
});
