const VER = 'games-v4';
const IMG = 'games-img-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/data.js', 'js/ui.js', 'js/fx.js', 'js/views.js', 'js/folders.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      // só caches deste app (inclui os "zerar-" da versão antiga, que morava no mesmo endereço)
      .then(keys => Promise.all(keys
        .filter(k => (k.startsWith('games-') || k.startsWith('zerar-')) && k !== VER && k !== IMG)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // imagens (capas da PSN, ícones de troféu, capas locais): cache primeiro
  if (req.destination === 'image') {
    e.respondWith(caches.open(IMG).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      } catch { return hit || Response.error(); }
    }));
    return;
  }

  // fontes do Google: cache primeiro
  if (url.host.includes('fonts.g')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(VER).then(c => c.put(req, copy)); return res;
    })));
    return;
  }

  // app e dados: rede primeiro (pega sync novo), cache se estiver offline
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VER).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('index.html'))));
  }
});
