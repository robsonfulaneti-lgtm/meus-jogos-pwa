// Liga o app Android (Capacitor) à sincronização. No site (navegador) nada daqui é usado.
import { createAppSync } from './app-sync.js';

export const isNative = !!window.Capacitor?.isNativePlatform?.();
export const REMOTE = 'https://meus-jogos-app.netlify.app/';

// ---------- armazenamento no aparelho (IndexedDB, dentro da área privada do app) ----------
let dbp;
const db = () => dbp ||= new Promise((res, rej) => {
  const r = indexedDB.open('games-app', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('kv', mode), req = fn(t.objectStore('kv'));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  });
};
export const kv = {
  get: async (k, fb) => { const v = await tx('readonly', s => s.get(k)); return v === undefined ? fb : v; },
  set: (k, v) => tx('readwrite', s => s.put(v, k)),
  del: k => tx('readwrite', s => s.delete(k)),
};

// ---------- rede ----------
const Http = () => window.Capacitor?.Plugins?.CapacitorHttp;

// GET sem seguir redirecionamento (pro login com npsso: o cookie e o endereço de volta só funcionam no nativo)
async function httpNoRedirect(url, headers){
  const r = await Http().request({ url, method: 'GET', headers, disableRedirects: true, connectTimeout: 20000, readTimeout: 20000 });
  const h = r.headers || {};
  const location = Object.entries(h).find(([k]) => k.toLowerCase() === 'location')?.[1];
  return { status: r.status, location: Array.isArray(location) ? location[0] : location };
}

// JSON do site, sem cache (o fetch do app passa pela rede nativa)
async function fetchJson(url){
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

let syncer = null;
export async function appSync(){
  if (!isNative) return null;
  if (syncer) return syncer;
  const psn = await import('./vendor/psn-api.js');
  syncer = createAppSync({
    kv, psn, httpNoRedirect, fetchJson, remote: REMOTE,
    getExtra: nativeExtra,
    log: (...a) => console.log('[sync]', ...a),
  });
  return syncer;
}

// dados que o app mostra: os do aparelho; na primeira abertura, os do site (e já guarda)
export async function nativeJson(path){
  if (path === 'data/psn.json') {
    const local = await kv.get('data:psn', null);
    if (local) return local;
    const remote = await fetchJson(REMOTE + path).catch(() => null);
    if (remote) await kv.set('data:psn', remote);
    return remote;
  }
  const m = path.match(/^data\/t\/(.+)\.json$/);
  if (m) return (await appSync()).localList(decodeURIComponent(m[1]));
  return null;
}

// lista curada (extra.json): a do site, pra jogo que eu adicionar lá chegar sem reinstalar o app.
// Espera a internet no máximo 2,5 s; senão usa a última que veio (ou a que vem dentro do app)
export async function nativeExtra(){
  const remote = fetchJson(REMOTE + 'data/extra.json').then(j => { kv.set('data:extra', j); return j; }).catch(() => null);
  const quick = await Promise.race([remote, new Promise(r => setTimeout(r, 2500))]);
  return quick || (await kv.get('data:extra', null)) || fetch('data/extra.json').then(r => r.json()).catch(() => null);
}

// versão do app instalada x a mais nova publicada no site
export async function updateInfo(){
  try {
    const [mine, latest] = await Promise.all([
      fetch('app-version.json').then(r => r.json()),
      fetchJson(REMOTE + 'app/latest.json'),
    ]);
    return latest.version !== mine.version ? { ...latest, current: mine.version } : null;
  } catch { return null; }
}
