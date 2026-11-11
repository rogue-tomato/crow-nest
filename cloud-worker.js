'use strict';
/* Public application shell only. Account, adventure and auth responses are NEVER cached here. */
const CACHE = 'crow-nest-shell-protocol-1-v4';
const SHELL = ['/', '/index.html', '/server-config.js', '/app.js', '/inventory.js', '/inventory.css', '/data.js', '/rules.js', '/sync.js', '/game-rules.js', '/journey-rules.js', '/hexicons.js', '/hexmap.js', '/hexmap.css', '/hexart.js', '/hexgl.js', '/hexedit.js', '/hexedit.css', '/journey.js', '/journey.css', '/cloud-store.js', '/cloud-sync.js', '/account.js', '/account.css', '/icons/icon_x32.png', '/icons/icon_x64.png', '/icons/icon_x256.png', '/icons/item-art-v2.png'];
self.addEventListener('install', event => {
  // a new shell takes over at once: fetches are network-first, so an open page keeps working, and offline it has every file
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('crow-nest-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (!SHELL.includes(url.pathname) && event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && SHELL.includes(url.pathname)) {
      const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(url.pathname,copy)));
    }
    return response;
  }).catch(async () => {
    const cached=await caches.match(event.request.mode==='navigate'?'/':url.pathname);
    return cached || Response.error();
  }));
});
