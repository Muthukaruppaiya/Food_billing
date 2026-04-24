// Self-destructing service worker: clears all caches and unregisters itself
// so the browser always loads fresh JS from the dev server.
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.map(k => caches.delete(k))))
            .then(() => self.registration.unregister())
            .then(() => self.clients.matchAll())
            .then(clients => clients.forEach(c => c.navigate(c.url)))
    );
});

// Pass all fetch requests through without caching
self.addEventListener('fetch', () => {});
