/* DIY记录 PWA Service Worker。更新此版本号时会替换旧的离线壳缓存。 */
const CACHE_PREFIX = 'graph-notes-shell-';
const CACHE_NAME = CACHE_PREFIX + "2026.11.23.92";
const SHELL = ['./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type==='SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  // 不拦截云服务、账号/数据库请求；绝不缓存私人笔记、密码或 Token。
  if(url.origin!==self.location.origin) return;
  // 版本文件永远走网络，以便检测新版本。
  if(url.pathname.endsWith('/version.json') || url.pathname.endsWith('/service-worker.js')) return;
  if(req.mode==='navigate' || url.pathname.endsWith('/index.html')) {
    event.respondWith((async () => {
      const cache=await caches.open(CACHE_NAME);
      try {
        const online=await fetch(req, {cache:'no-store'});
        if(online.ok && online.type==='basic') await cache.put('./index.html',online.clone());
        return online;
      } catch(error) {
        const offline=await cache.match('./index.html');
        if(offline) return offline;
        return Response.error();
      }
    })());
    return;
  }
  if(url.pathname.includes('/icons/') || url.pathname.endsWith('/manifest.webmanifest')) {
    event.respondWith((async () => {
      const cache=await caches.open(CACHE_NAME);
      const hit=await cache.match(req);
      if(hit) return hit;
      const resp=await fetch(req);
      if(resp.ok && resp.type==='basic') await cache.put(req,resp.clone());
      return resp;
    })());
  }
});
