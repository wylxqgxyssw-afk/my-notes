/* DIY记录 V112 — same-scope PWA cache, no cloud API caching. */
'use strict';
const VERSION = '1.0.112';
const PREFIX = 'diyrecord-pwa-shell-';
const CACHE = PREFIX + VERSION;
const scope = new URL(self.registration.scope);
const shell = new URL('index.html', scope).href;
const assets = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icon-192.png', 'icon-512.png'].map(p => new URL(p, scope).href);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch(shell, {cache: 'reload'});
    if (!response.ok) throw new Error('Cannot cache app shell');
    await cache.put(shell, response);
    await Promise.allSettled(assets.map(async url => {
      const res = await fetch(url, {cache: 'reload'});
      if (res.ok) await cache.put(url, res);
    }));
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (url.pathname === new URL('version.json', scope).pathname) {
    event.respondWith(fetch(req, {cache:'no-store'}));
    return;
  }
  if (req.mode === 'navigate' && (url.pathname === scope.pathname || url.pathname === new URL(shell).pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req, {cache:'no-store'});
        if (res.ok) { await cache.put(shell, res.clone()); return res; }
        return (await cache.match(shell)) || res;
      } catch (err) {
        return (await cache.match(shell)) || new Response('Offline', {status:503});
      }
    })());
    return;
  }
  if (assets.includes(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) { await cache.put(url.href, res.clone()); return res; }
        return (await cache.match(url.href)) || res;
      } catch (err) { return (await cache.match(url.href)) || Response.error(); }
    })());
  }
});
