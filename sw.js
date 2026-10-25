/* Travel Buddy service worker: offline app shell. Bump VERSION on every deploy. */
const VERSION = 'tb-v1', SHELL = ['/', '/assets/css/app.css', '/assets/js/config.js', '/assets/js/data.js', '/assets/js/i18n.js', '/assets/js/ui.js', '/assets/js/api.js', '/assets/js/views-public.js', '/assets/js/views-user.js', '/assets/js/app.js', '/assets/js/lang/en.js', '/assets/js/lang/ar.js', '/assets/js/lang/ru.js', '/assets/js/lang/de.js', '/assets/img/favicon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSION).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;   // never cache cross-origin / API calls
  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(() => caches.match('/'))); return; }       // SPA: always the same shell
  e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(VERSION).then(c => c.put(r, cp)); return res; }).catch(() => caches.match(r)));
});
