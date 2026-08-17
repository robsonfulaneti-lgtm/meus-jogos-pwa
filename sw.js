const CACHE = 'zerar-v12';
const COVERS = ['alan-wake-2.jpg','re7.jpg','lara-croft-go.jpg','tr1.png','re-rev.jpg',
  'tr2.png','re0.jpg','uncharted-2.jpg','tr3.png','re1.jpg','uncharted-3.jpg','tr4.png',
  'gta3.jpg','re5.jpg','tr5.png','gta-vc.jpg','re6.jpg','tr6.png','mafia-3.jpg',
  'gta-sa.jpg','gta-5.jpg','rdr2.jpg',
  're-dc.png','re2c.png','re2r.jpg','re3c.jpg','re3r.jpg','recvx.jpg','re-veronica.jpg',
  're4c.jpg','re4r.jpg','rev2.jpg','village.jpg','requiem.jpg',
  'dlc-r4c-ada.jpg','dlc-r4r-sw.jpg','dlc-r5-lin.jpg','dlc-r5-de.jpg',
  'dlc-r7-bf1.jpg','dlc-r7-bf2.jpg','dlc-r7-nah.jpg','dlc-r7-eoz.jpg',
  'dlc-r8-sor.jpg',
  'buy-avatar-qfb.jpg','buy-tides.jpg','buy-gta6.jpg','buy-wolverine.jpg',
  'buy-sh-townfall.jpg','buy-sh-f.jpg','buy-gow-laufey.jpg','buy-avatar-legends.jpg',
  'buy-kena.jpg','buy-itt.jpg','buy-tr-legacy.jpg','buy-crash.jpg',
  'buy-apt-resonance.jpg','buy-yotei.jpg'].map(f => 'covers/' + f);

const ASSETS = [
  './','index.html','style.css','app.js','manifest.webmanifest',
  'icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','icons/favicon-32.png',
  ...COVERS
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    // só as versões antigas deste app: outros apps do mesmo domínio têm o cache deles
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith('zerar-')).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// shell do app (html/css/js): rede primeiro, cache só como fallback offline.
// capas e ícones não mudam: cache primeiro.
const SHELL = /\.(html|css|js|webmanifest)$|\/$/;

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (SHELL.test(url.pathname)) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() =>
        caches.match(e.request).then(hit => hit || caches.match('index.html'))
      )
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }))
    );
  }
});
