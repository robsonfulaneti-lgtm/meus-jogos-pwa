// Liga o app Android (Capacitor) à sincronização. No site (navegador) nada daqui é usado.
import { createAppSync } from './app-sync.js';
import { storePrices } from './store-core.js';

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
    getExtra: () => nativeShared('data/extra.json'),
    log: (...a) => console.log('[sync]', ...a),
  });
  return syncer;
}

// dados que o app mostra: o mais novo entre o do aparelho (sincronizado no celular) e o do site
// (atualizado pelo PC). Antes ficava pra sempre com o do aparelho, mesmo sem a PSN conectada no app.
export async function nativeJson(path){
  if (path === 'data/psn.json') {
    const newer = (a, b) => a && (!b || (a.generatedAt || '') > (b.generatedAt || ''));
    const local = await kv.get('data:psn', null);
    // o do site é guardado se for mais novo, mesmo que chegue depois (aí vale na próxima abertura)
    const remote = fetchJson(REMOTE + path).then(async j => {
      if (newer(j, await kv.get('data:psn', null))) await kv.set('data:psn', j);
      return j;
    }).catch(() => null);
    // com dados no aparelho, espera o site no máximo 2,5 s (sem internet abre com o que tem)
    const site = await Promise.race([remote, new Promise(r => setTimeout(r, local ? 2500 : 20000))]);
    return newer(site, local) ? site : local || site || null;
  }
  const m = path.match(/^data\/t\/(.+)\.json$/);
  if (m) return (await appSync()).localList(decodeURIComponent(m[1]));
  return null;
}

// arquivos que eu mantenho no site (lista curada extra.json, tradução dos troféus): a versão do site,
// pra mudança chegar sem reinstalar o app. Espera a internet no máximo 2,5 s; senão usa a última
// que veio (ou a que vem dentro do app)
const SHARED_KEY = { 'data/extra.json': 'data:extra' };
export async function nativeShared(path){
  const key = SHARED_KEY[path] || 'shared:' + path;
  const remote = fetchJson(REMOTE + path).then(j => { kv.set(key, j); return j; }).catch(() => null);
  const quick = await Promise.race([remote, new Promise(r => setTimeout(r, 2500))]);
  return quick || (await kv.get(key, null)) || fetch(path).then(r => r.json()).catch(() => null);
}

// GARAPAS no app: preço direto da loja (pela rede nativa; o site não consegue, a loja recusa pedido vindo dele).
// Guarda o resultado e só busca de novo depois de 1 h (ou quando você pede)
export const cachedGarapas = () => isNative ? kv.get('garapas', null) : Promise.resolve(null);
export async function liveGarapas(list, force = false){
  if (!isNative || !list.length) return null;
  const cached = await kv.get('garapas', null);
  if (!force && cached && Date.now() - Date.parse(cached.at) < 3600e3) return cached;
  const getJson = async (url, headers) => {
    const r = await Http().request({ url, method: 'GET', headers, connectTimeout: 15000, readTimeout: 15000 });
    return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  };
  const fresh = await storePrices(list, getJson).catch(() => null);
  if (fresh?.items.some(i => i.price != null)) { await kv.set('garapas', fresh); return fresh; }
  return cached;
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
