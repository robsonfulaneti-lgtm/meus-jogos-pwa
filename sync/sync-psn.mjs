// Sincroniza a conta PSN (via psn-api, não-oficial) e gera os dados estáticos do app.
//
//   node sync-psn.mjs            -> sincroniza tudo (usa cache onde dá)
//   node sync-psn.mjs --full     -> ignora o cache de troféus e baixa tudo de novo
//
// Credenciais ficam só em sync/.env.local e sync/.cache/ (ambos fora do git e do site).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as psn from 'psn-api';
import { collectPsn, tokensToStore } from '../site/js/psn-core.js';
const { exchangeNpssoForAccessCode, exchangeAccessCodeForAuthTokens, exchangeRefreshTokenForAuthTokens } = psn;

const ROOT  = path.dirname(fileURLToPath(import.meta.url));
const SITE  = path.resolve(ROOT, '../site');
const DATA  = path.join(SITE, 'data');
const TDIR  = path.join(DATA, 't');           // um arquivo de troféus por jogo
const CACHE = path.join(ROOT, '.cache');
const FULL  = process.argv.includes('--full');
const LANG  = { 'Accept-Language': 'pt-BR' };

// ---------- util ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('·', ...a);
const readJson = async (f, fb) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return fb; } };
const writeJson = async (f, v, pretty = false) => {
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, JSON.stringify(v, null, pretty ? 2 : 0));
};
const norm = s => (s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[™®©:'’\-–—_.,!?()]/g, ' ').replace(/\b(the|ps4|ps5|edition|remastered|remaster)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();

async function loadEnv(){
  const env = {};
  try {
    const txt = await fs.readFile(path.join(ROOT, '.env.local'), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
  return { ...env, ...process.env };
}

// ---------- autenticação ----------
async function authenticate(env){
  const f = path.join(CACHE, 'auth.json');
  const cached = await readJson(f, null);
  const now = Date.now();

  if (cached?.accessToken && cached.accessExp > now + 60_000) return cached;
  if (cached?.refreshToken && cached.refreshExp > now + 60_000) {
    try {
      const t = await exchangeRefreshTokenForAuthTokens(cached.refreshToken);
      return save(t);
    } catch (e) { log('refresh token expirou, usando NPSSO'); }
  }
  const npsso = env.PSN_NPSSO;
  if (!npsso || npsso.length < 30) {
    throw new Error('PSN_NPSSO ausente em sync/.env.local — veja sync/.env.local.example');
  }
  const code = await exchangeNpssoForAccessCode(npsso);
  return save(await exchangeAccessCodeForAuthTokens(code));

  async function save(t){
    const v = tokensToStore(t, now);
    await writeJson(f, v);
    return v;
  }
}

// no PC o cache fica em sync/.cache e as listas de troféus em site/data/t (publicadas no site)
const nodeStore = {
  get: (name, fb) => readJson(path.join(CACHE, `${name}.json`), fb),
  set: (name, v) => writeJson(path.join(CACHE, `${name}.json`), v),
  getList: id => readJson(path.join(TDIR, `${id}.json`), null),
  setList: (id, list) => writeJson(path.join(TDIR, `${id}.json`), list),
};

async function main(){
  const env = await loadEnv();
  await fs.mkdir(CACHE, { recursive: true });
  await fs.mkdir(TDIR, { recursive: true });

  log('autenticando…');
  const auth = await authenticate(env);
  const extra = await readJson(path.join(DATA, 'extra.json'), { watchlist: [] });
  const { data, separate, seed } = await collectPsn({ psn, auth, store: nodeStore, log, extra, full: FULL });

  // notas, tempo pra zerar e lançamentos (só no PC, que tem as chaves); jogos de nome repetido ficam de fora
  const lookupGames = data.games.filter(g => !separate[g.key]);
  const igdbOn = await enrichIgdb(env, lookupGames, extra.watchlist || []);
  const watchTtb = Object.fromEntries((extra.watchlist || []).filter(w => w.ttb).map(w => [w.id, w.ttb]));
  const market = await enrichRawg(env, lookupGames, (extra.watchlist || []).map(({ ttb, ...w }) => w));

  data.sources = { ...data.sources, rawg: !!market, igdb: igdbOn };
  data.watchTtb = watchTtb;
  data.market = market;
  await writeJson(path.join(DATA, 'psn.json'), data);
  // ponto de partida pro app do celular: só vínculos de IDs, nomes das partes e datas de atualização
  await writeJson(path.join(DATA, 'seed.json'), seed);
  log(`pronto: ${data.games.length} jogos · ${data.totals.platinums} platinas · ${Math.round(data.totals.minutes / 60)} h → site/data/psn.json`);
}

main().catch(e => { console.error('\n✖', e.message); process.exit(1); });

// ---------- IGDB (opcional): tempo pra zerar ----------
// hastily = só a história, normally = com alguns extras, completely = 100%  (a API devolve em segundos)
async function enrichIgdb(env, games, watch){
  if (!env.IGDB_CLIENT_ID || !env.IGDB_CLIENT_SECRET) { log('sem IGDB_CLIENT_ID/SECRET — pulando tempo pra zerar'); return false; }
  const tf = path.join(CACHE, 'igdb-token.json');
  let tok = await readJson(tf, null);
  if (!tok || tok.exp < Date.now() + 3600e3) {
    const r = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(env.IGDB_CLIENT_ID)}&client_secret=${encodeURIComponent(env.IGDB_CLIENT_SECRET)}&grant_type=client_credentials`, { method: 'POST' });
    if (!r.ok) { log('IGDB: chave recusada pela Twitch', r.status); return false; }
    const j = await r.json();
    tok = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
    await writeJson(tf, tok);
  }
  let lastCall = 0;
  const igdb = async (ep, body) => {
    const wait = 280 - (Date.now() - lastCall); if (wait > 0) await sleep(wait);   // limite: 4 por segundo
    lastCall = Date.now();
    const r = await fetch(`https://api.igdb.com/v4/${ep}`, {
      method: 'POST', body,
      headers: { 'Client-ID': env.IGDB_CLIENT_ID, Authorization: `Bearer ${tok.token}`, Accept: 'application/json' },
    });
    if (!r.ok) throw new Error(`IGDB ${ep} ${r.status}`);
    return r.json();
  };
  const f = path.join(CACHE, 'igdb.json');
  const cache = await readJson(f, {});
  const q = s => s.replace(/["\\]/g, ' ');
  const clean = s => s.replace(/\(playstation.?\d\)|ps4 ?& ?ps5|[™®©]/gi, ' ').replace(/\s+/g, ' ').trim();
  // "alan wake ii" == "alan wake 2"
  const ROM = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
  const nn = s => norm(s).split(' ').map(t => ROM[t] ?? t).join(' ');
  // nome compatível: igual, ou um contido no outro com tamanho parecido e sem número de sequência de diferença
  const close = (a, b) => {
    if (a === b) return true;
    const [s, l] = a.length < b.length ? [a, b] : [b, a];
    if (s.length < 5 || !l.includes(s) || s.length / l.length < 0.6) return false;
    return !/^(\d+|zero)$/.test(l.replace(s, ' ').trim().split(' ')[0]);
  };
  // acha o jogo no IGDB (só aceita nome compatível) e pega o tempo pra zerar; remaster sem dado usa o original
  async function lookup(name){
    const k = norm(name), kk = nn(name);
    if (k in cache && !FULL) return cache[k];
    let out = null;
    try {
      const games = await igdb('games', `search "${q(clean(name))}"; fields id,name,parent_game,version_parent; limit 10;`);
      const ranked = games.filter(g => close(nn(g.name), kk)).sort((a, b) => (nn(b.name) === kk) - (nn(a.name) === kk));
      const ids = ranked.flatMap(g => [g.id, g.version_parent, g.parent_game]).filter(Boolean).slice(0, 10);
      if (ids.length) {
        const ttb = await igdb('game_time_to_beats', `fields game_id,hastily,normally,completely,count; where game_id = (${ids.join(',')}); limit 10;`);
        const byId = new Map(ttb.map(t => [t.game_id, t]));
        const h = s => s ? Math.round(s / 360) / 10 : null;
        const sane = v => v != null && v > 0 && v < 400 ? v : null;   // descarta valores absurdos
        const hit = ids.map(id => byId.get(id)).find(t => t && (sane(h(t.hastily)) || sane(h(t.normally))));
        if (hit) out = {
          h: sane(h(hit.hastily)), n: sane(h(hit.normally)), c: sane(h(hit.completely)), count: hit.count || 0,
          src: ranked.find(g => [g.id, g.version_parent, g.parent_game].includes(hit.game_id))?.name,
        };
      }
    } catch (e) { log('IGDB falhou para', name, e.message); }
    cache[k] = out;
    return out;
  }
  let n = 0;
  for (const g of games) {
    if (g.status === 'platinum') continue;           // já foi zerado; economiza consulta
    const t = await lookup(g.name);
    if (t) { g.ttb = t; n++; }
  }
  for (const w of watch) { const t = await lookup(w.search || w.name); if (t) w.ttb = t; }
  await writeJson(f, cache);
  log(`IGDB: tempo pra zerar em ${n} jogos`);
  return true;
}

// ---------- RAWG (opcional): notas, lançamentos e hype ----------
async function rawg(env, pathAndQuery){
  const sep = pathAndQuery.includes('?') ? '&' : '?';
  const res = await fetch(`https://api.rawg.io/api/${pathAndQuery}${sep}key=${encodeURIComponent(env.RAWG_API_KEY)}`);
  if (!res.ok) throw new Error(`RAWG ${res.status}`);
  return res.json();
}

async function enrichRawg(env, games, watch){
  if (!env.RAWG_API_KEY) { log('sem RAWG_API_KEY — pulando notas/lançamentos'); return null; }
  const f = path.join(CACHE, 'rawg.json');
  const cache = await readJson(f, {});
  const pick = g => g && ({
    slug: g.slug, name: g.name, rating: g.rating, ratings: g.ratings_count, metacritic: g.metacritic,
    released: g.released, tba: g.tba, added: g.added, bg: g.background_image, playtime: g.playtime,
  });
  // só aceita resultado com nome igual ou contido no outro; a lista de desejos (curada) aceita o primeiro
  // nomes que o RAWG escreve diferente
  const ALIAS = { 'resident evil 0': 'Resident Evil Zero' };
  async function lookup(name, loose = false){
    if (ALIAS[norm(name)]) name = ALIAS[norm(name)];
    const k = norm(name);
    if (k in cache && !FULL) return cache[k];
    try {
      const r = await rawg(env, `games?search=${encodeURIComponent(name)}&search_precise=true&page_size=5`);
      const res = r.results || [];
      const exact = res.find(x => norm(x.name) === k);
      // "contido no outro" só vale se os nomes tiverem tamanho parecido
      // ("mafia iii" ~ "mafia iii definitive" sim; "tomb raider" ~ "tomb raider i iii starring lara croft" não)
      const close = res.find(x => {
        const n = norm(x.name), [s, l] = n.length < k.length ? [n, k] : [k, n];
        if (s.length < 5 || !l.includes(s) || s.length / l.length < 0.45) return false;
        // "tomb raider" x "tomb raider iv vi": a diferença é número de sequência -> outro jogo
        const extra = l.replace(s, ' ').trim().split(' ')[0];
        return !/^(\d+|i{1,3}|iv|v|vi{1,3}|ix|x|zero)$/.test(extra);
      });
      cache[k] = pick(exact || close || (loose ? res[0] : null) || null);
    } catch (e) { log('RAWG falhou para', name, e.message); cache[k] = cache[k] ?? null; }
    await sleep(120);
    return cache[k];
  }
  // nome do jogo original, pra ordem da série: "GTA III – The Definitive Edition" -> "GTA III"
  const baseName = n => n
    .replace(/\(playstation.?\d\)|ps4 ?& ?ps5|[™®©]/gi, ' ')
    .replace(/[–—:-]?\s*(the )?(definitive|classic|game of the year|goty|complete|deluxe|ultimate)( edition)?\b.*$/i, '')
    .replace(/\b(remastered|remaster|hd)\b/gi, '')
    .replace(/[\s–—:-]+$/, '').replace(/\s+/g, ' ').trim();
  for (const g of games) {
    const info = await lookup(g.name);
    if (info) g.rating = { score: info.rating, count: info.ratings, metacritic: info.metacritic, released: info.released };
    const base = baseName(g.name);
    if (base && norm(base) !== norm(g.name)) {
      const orig = await lookup(base);
      if (orig?.released) (g.rating ||= {}).orig = orig.released;
    }
  }
  const watchOut = [];
  for (const w of watch) {
    const info = await lookup(w.search || w.name);
    watchOut.push({ ...w, info });
  }
  // mais aguardados nos próximos 12 meses (PS5 = plataforma 187 no RAWG)
  let top = [];
  try {
    const today = new Date(), next = new Date(Date.now() + 365 * 864e5);
    const d = x => x.toISOString().slice(0, 10);
    const r = await rawg(env, `games?dates=${d(today)},${d(next)}&platforms=187&ordering=-added&page_size=20`);
    top = (r.results || []).map(pick);
  } catch (e) { log('RAWG lançamentos falhou:', e.message); }
  await writeJson(f, cache);
  return { watch: watchOut, top };
}

