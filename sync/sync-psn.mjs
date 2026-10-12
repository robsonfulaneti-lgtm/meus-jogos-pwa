// Sincroniza a conta PSN (via psn-api, não-oficial) e gera os dados estáticos do app.
//
//   node sync-psn.mjs            -> sincroniza tudo (usa cache onde dá)
//   node sync-psn.mjs --full     -> ignora o cache de troféus e baixa tudo de novo
//
// Credenciais ficam só em sync/.env.local e sync/.cache/ (ambos fora do git e do site).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  exchangeNpssoForAccessCode, exchangeAccessCodeForAuthTokens, exchangeRefreshTokenForAuthTokens,
  getUserTrophyProfileSummary, getProfileFromAccountId, getUserTitles, getUserPlayedGames,
  getPurchasedGames, getUserTrophiesForSpecificTitle, getUserTrophiesEarnedForTitle, getTitleTrophies,
  getTitleTrophyGroups,
} from 'psn-api';

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

// chamada com intervalo mínimo e nova tentativa em caso de limite de requisições
let last = 0;
async function api(label, fn, tries = 4){
  for (let i = 0; i < tries; i++) {
    const wait = 220 - (Date.now() - last);
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try { return await fn(); }
    catch (e) {
      const msg = String(e?.message || e);
      const retriable = /429|rate|too many|ECONNRESET|ETIMEDOUT|fetch failed|50\d/i.test(msg);
      if (!retriable || i === tries - 1) throw new Error(`${label}: ${msg.slice(0, 300)}`);
      const back = 1500 * 2 ** i;
      log(`${label} — limite/erro temporário, tentando de novo em ${back / 1000}s`);
      await sleep(back);
    }
  }
}

// "PT12H3M7S" -> minutos
function isoDurToMin(d){
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/.exec(d || '');
  if (!m) return 0;
  return Math.round((+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0) + (+m[4] || 0) / 60);
}

// dificuldade estimada (1–10) a partir da % de jogadores com a platina.
// A % da Sony conta todo mundo que abriu o jogo, então é baixa: 0,1% ≈ 9, 1% ≈ 6, 10% ≈ 3.
export function difficultyFromRate(rate){
  if (rate == null || isNaN(rate)) return null;
  const r = Math.min(Math.max(rate, 0.05), 80);
  const lo = Math.log10(0.05), hi = Math.log10(40);
  const d = 10 - 9 * (Math.log10(r) - lo) / (hi - lo);
  return Math.round(Math.min(10, Math.max(1, d)) * 10) / 10;
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
    const v = {
      accessToken: t.accessToken, refreshToken: t.refreshToken,
      accessExp: now + t.expiresIn * 1000, refreshExp: now + t.refreshTokenExpiresIn * 1000,
    };
    await writeJson(f, v);
    return v;
  }
}

// ---------- coleta ----------
async function fetchAllTitles(auth){
  const out = [];
  for (let offset = 0; ; ) {
    const r = await api('troféus', () => getUserTitles(auth, 'me', { limit: 800, offset, headerOverrides: LANG }));
    out.push(...r.trophyTitles);
    if (!r.nextOffset || r.nextOffset >= r.totalItemCount) break;
    offset = r.nextOffset;
  }
  return out;
}

async function fetchPlayed(auth){
  const out = [];
  for (let offset = 0; ; ) {
    const r = await api('jogados', () => getUserPlayedGames(auth, 'me', {
      limit: 200, offset, categories: 'ps4_game,ps5_native_game,pspc_game,unknown',
    }));
    out.push(...r.titles);
    if (!r.nextOffset || r.titles.length === 0 || out.length >= r.totalItemCount) break;
    offset = r.nextOffset;
  }
  return out;
}

async function fetchPurchased(auth){
  const out = [];
  try {
    for (let start = 0; ; start += 200) {
      const r = await api('comprados', () => getPurchasedGames(auth, { size: 200, start, isActive: true }));
      const games = r.data.purchasedTitlesRetrieve.games || [];
      out.push(...games);
      if (games.length < 200) break;
    }
    return { ok: true, games: out };
  } catch (e) {
    log('não consegui ler a lista de comprados (a Sony pode ter mudado a consulta):', String(e.message).slice(0, 160));
    return { ok: false, games: [] };
  }
}

// liga titleId (CUSA/PPSA) -> npCommunicationId, com cache permanente
async function linkTitleIds(auth, titleIds){
  const f = path.join(CACHE, 'title-links.json');
  const links = await readJson(f, {});
  const todo = [...new Set(titleIds)].filter(id => /^(CUSA|PPSA)/.test(id) && !(id in links));
  for (let i = 0; i < todo.length; i += 5) {
    const batch = todo.slice(i, i + 5);
    try {
      const r = await api('vínculos', () => getUserTrophiesForSpecificTitle(auth, 'me', { npTitleIds: batch.join(',') }));
      for (const id of batch) links[id] = null;
      for (const t of r.titles || []) links[t.npTitleId] = t.trophyTitles?.[0]?.npCommunicationId || null;
    } catch (e) { log('vínculo falhou para', batch.join(','), String(e.message).slice(0, 120)); }
  }
  await writeJson(f, links);
  return links;
}

// lista completa de troféus de um jogo (metadados + o que você já pegou)
async function trophyDetail(auth, title, metaCache){
  const svc = title.trophyTitlePlatform?.includes('PS5') ? 'trophy2' : 'trophy';
  const id = title.npCommunicationId;
  const metaKey = `${id}@${title.trophySetVersion}`;
  let meta = metaCache[metaKey];
  if (!meta) {
    const r = await api(`lista ${title.trophyTitleName}`, () =>
      getTitleTrophies(auth, id, 'all', { npServiceName: svc, headerOverrides: LANG }));
    meta = r.trophies.map(t => ({
      i: t.trophyId, n: t.trophyName, d: t.trophyDetail, ic: t.trophyIconUrl,
      ty: t.trophyType, g: t.trophyGroupId, h: t.trophyHidden,
    }));
    metaCache[metaKey] = meta;
  }
  const mine = await api(`progresso ${title.trophyTitleName}`, () =>
    getUserTrophiesEarnedForTitle(auth, 'me', id, 'all', { npServiceName: svc }));
  const byId = new Map(mine.trophies.map(t => [t.trophyId, t]));
  return meta.map(m => {
    const u = byId.get(m.i) || {};
    return { ...m, r: u.trophyEarnedRate != null ? +u.trophyEarnedRate : null, e: !!u.earned, at: u.earnedDateTime || null };
  });
}

// ---------- pistas de "zerado" ----------
// Troféu de fim de história: "Complete o jogo", "Conclua a história principal", "Termine a campanha"...
// Não vale: capítulo N, missão entre aspas ("Você concluiu "Jogo limpo""), "Vença a Final da Champions",
// capítulo com nome ("Conclua a História - O ACIDENTE"), fita/DLC ("a história da fita") e Novo Jogo+.
const STORY = new RegExp(
  '\\b(conclua|concluiu|complete|completou|completed|termine|terminou|finalize|finalizou|zere|zerou|finish|finished|beat)\\s+' +
  '(\\S+\\s+)?' +
  '(o jogo|a hist[óo]ria( principal)?|a campanha( principal)?|a aventura|o modo hist[óo]ria|o cap[íi]tulo final|' +
  'the game|the story|the main story|the campaign|the main campaign)\\b' +
  '(?!\\s*[-–:])(?! da fita)(?! do dlc)', 'i');
function zeroHints(trophies){
  const earned = trophies.filter(t => t.e && t.at);
  const lastTrophyAt = earned.map(t => t.at).sort().at(-1) || null;
  const stories = earned.filter(t => t.ty !== 'platinum' && STORY.test(`${t.n || ''} ${t.d || ''}`)).sort((a, b) => a.at.localeCompare(b.at));
  // por parte (grupo de troféus): numa coletânea, cada jogo tem o seu troféu de fim
  const storyByPart = {};
  for (const t of stories) storyByPart[t.g || 'default'] ||= t.at;
  const lastByPart = {};
  for (const t of earned) { const k = t.g || 'default'; if (!lastByPart[k] || t.at > lastByPart[k]) lastByPart[k] = t.at; }
  const story = stories[0];
  return {
    lastTrophyAt, lastByPart,
    storyTrophy: story ? { name: story.n, detail: story.d, at: story.at, part: story.g || 'default' } : null,
    storyByPart: stories.length ? storyByPart : null,
  };
}

// ---------- retrospectiva por ano ----------
const yearOf = iso => iso ? new Intl.DateTimeFormat('en', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(new Date(iso)) : null;

// Troféus por ano: data exata da Sony. Horas por ano: a Sony só informa o total de
// cada jogo, então o total é dividido entre os anos — metade espalhada pelo período
// em que você jogou, metade proporcional aos troféus que ganhou em cada ano.
function buildYears(items){
  const Y = {};
  const year = y => Y[y] ||= {
    year: +y, minutes: 0, trophies: { platinum: 0, gold: 0, silver: 0, bronze: 0 },
    games: new Set(), started: 0, plats: [], rarest: null, perGame: {},
  };
  for (const it of items) {
    const byYear = {};
    for (const t of it.earned) {
      const y = yearOf(t.at), Yr = year(y);
      Yr.trophies[t.ty] = (Yr.trophies[t.ty] || 0) + 1;
      Yr.games.add(it.key);
      byYear[y] = (byYear[y] || 0) + 1;
      if (t.r != null && (!Yr.rarest || t.r < Yr.rarest.rate)) Yr.rarest = { name: t.n, rate: t.r, type: t.ty, icon: t.ic, game: it.key };
    }
    const y0 = yearOf(it.firstPlayed), y1 = yearOf(it.lastPlayed);
    const span = [];
    if (y0 && y1) for (let y = +y0; y <= +y1; y++) span.push(String(y));
    const startY = y0 || yearOf(it.earned.map(t => t.at).sort()[0]);
    if (startY) year(startY).started++;
    if (it.playMinutes > 0) { if (y0) year(y0).games.add(it.key); if (y1) year(y1).games.add(it.key); }

    const n = Object.values(byYear).reduce((s, c) => s + c, 0);
    const share = {};
    if (it.playMinutes > 0) {
      const wSpan = span.length ? (n >= 3 ? .5 : 1) : 0, wTro = n ? 1 - wSpan : 0;
      for (const y of span) share[y] = (share[y] || 0) + it.playMinutes * wSpan / span.length;
      for (const [y, c] of Object.entries(byYear)) share[y] = (share[y] || 0) + it.playMinutes * wTro * c / n;
    }
    for (const [y, m] of Object.entries(share)) year(y).minutes += m;
    for (const y of new Set([...Object.keys(share), ...Object.keys(byYear)])) {
      year(y).perGame[it.key] = { min: Math.round(share[y] || 0), tro: byYear[y] || 0 };
    }
    for (const p of it.plats) {
      const y = yearOf(p.at);
      if (y) year(y).plats.push({ key: it.key, platform: p.platform, at: p.at, rate: p.rate });
    }
  }
  return Object.values(Y).sort((a, b) => b.year - a.year).map(Yr => ({
    year: Yr.year, minutes: Math.round(Yr.minutes), trophies: Yr.trophies,
    total: Object.values(Yr.trophies).reduce((s, c) => s + c, 0),
    games: Yr.games.size, started: Yr.started, rarest: Yr.rarest,
    plats: Yr.plats.sort((a, b) => a.at.localeCompare(b.at)),
    top: Object.entries(Yr.perGame).map(([key, v]) => ({ key, ...v })).sort((a, b) => b.min - a.min || b.tro - a.tro).slice(0, 8),
  }));
}

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
  // acha o jogo no IGDB (prefere nome igual) e pega o tempo pra zerar; remaster sem dado usa o original
  async function lookup(name){
    const k = norm(name);
    if (k in cache && !FULL) return cache[k];
    let out = null;
    try {
      for (const term of [...new Set([clean(name), clean(name).replace(/[:–—-].*$/, '').trim()])]) {
        const games = await igdb('games', `search "${q(term)}"; fields id,name,parent_game,version_parent; limit 8;`);
        const ranked = games.sort((a, b) => (norm(b.name) === k) - (norm(a.name) === k));
        const ids = ranked.flatMap(g => [g.id, g.version_parent, g.parent_game]).filter(Boolean).slice(0, 10);
        if (!ids.length) continue;
        const ttb = await igdb('game_time_to_beats', `fields game_id,hastily,normally,completely,count; where game_id = (${ids.join(',')}); limit 10;`);
        const byId = new Map(ttb.map(t => [t.game_id, t]));
        const hit = ids.map(id => byId.get(id)).find(t => t && (t.hastily || t.normally));
        if (hit) {
          const h = s => s ? Math.round(s / 360) / 10 : null;
          out = { h: h(hit.hastily), n: h(hit.normally), c: h(hit.completely), count: hit.count || 0, src: ranked.find(g => [g.id, g.version_parent, g.parent_game].includes(hit.game_id))?.name };
          break;
        }
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

// ---------- montagem ----------
function bestImage(images, types){
  for (const t of types) {
    const hit = images?.find(i => i.type === t);
    if (hit) return hit.url;
  }
  return null;
}

async function main(){
  const env = await loadEnv();
  await fs.mkdir(CACHE, { recursive: true });
  await fs.mkdir(TDIR, { recursive: true });

  log('autenticando…');
  const auth = await authenticate(env);

  log('perfil…');
  const summary = await api('resumo', () => getUserTrophyProfileSummary(auth, 'me'));
  let prof = {};
  try { prof = await api('perfil', () => getProfileFromAccountId(auth, summary.accountId)); }
  catch (e) { log('perfil detalhado indisponível:', e.message); }

  log('lista de troféus…');
  const titles = await fetchAllTitles(auth);
  log(`${titles.length} listas de troféus`);

  log('tempo de jogo…');
  const played = await fetchPlayed(auth);
  log(`${played.length} jogos com tempo registrado`);

  log('biblioteca comprada…');
  const purchased = await fetchPurchased(auth);
  log(purchased.ok ? `${purchased.games.length} itens comprados/resgatados` : 'biblioteca indisponível');

  log('ligando jogos aos troféus…');
  const links = await linkTitleIds(auth, played.flatMap(p => [p.titleId, ...(p.concept?.titleIds || [])]));

  // detalhes por lista de troféus (cache pelo lastUpdatedDateTime)
  log('detalhes de troféus (primeira vez demora, depois só o que mudou)…');
  const metaCache = await readJson(path.join(CACHE, 'trophy-meta.json'), {});
  const seen = FULL ? {} : await readJson(path.join(CACHE, 'trophy-seen.json'), {});
  const trophyInfo = {};
  const lists = {};   // troféus de cada lista, usados na retrospectiva por ano
  // nomes das partes (jogos de uma coletânea, DLCs): grupos da lista de troféus
  const groupCache = await readJson(path.join(CACHE, 'trophy-groups.json'), {});
  const groupsOf = {};
  for (const t of titles.filter(t => t.hasTrophyGroups)) {
    const gk = `${t.npCommunicationId}@${t.trophySetVersion}`;
    if (!groupCache[gk]) {
      try {
        const r = await api(`partes ${t.trophyTitleName}`, () => getTitleTrophyGroups(auth, t.npCommunicationId, {
          npServiceName: t.trophyTitlePlatform?.includes('PS5') ? 'trophy2' : 'trophy', headerOverrides: LANG,
        }));
        groupCache[gk] = r.trophyGroups.map(g => ({ id: g.trophyGroupId, name: g.trophyGroupName, icon: g.trophyGroupIconUrl }));
      } catch (e) { log('partes falhou', t.trophyTitleName, e.message); }
    }
    if (groupCache[gk]) groupsOf[t.npCommunicationId] = groupCache[gk];
  }
  await writeJson(path.join(CACHE, 'trophy-groups.json'), groupCache);
  let n = 0;
  for (const t of titles) {
    const id = t.npCommunicationId;
    const file = path.join(TDIR, `${id}.json`);
    let list = null;
    if (seen[id] === t.lastUpdatedDateTime) list = await readJson(file, null);
    if (!list) {
      try {
        list = await trophyDetail(auth, t, metaCache);
        await writeJson(file, list);
        seen[id] = t.lastUpdatedDateTime;
      } catch (e) { log('falhou', t.trophyTitleName, e.message); list = []; }
      if (++n % 20 === 0) {
        log(`  ${n} listas baixadas…`);
        await writeJson(path.join(CACHE, 'trophy-meta.json'), metaCache);
        await writeJson(path.join(CACHE, 'trophy-seen.json'), seen);
      }
    }
    lists[id] = list;
    const plat = list.find(x => x.ty === 'platinum');
    const earned = list.filter(x => x.e && x.r != null);
    const rarest = earned.sort((a, b) => a.r - b.r)[0] || null;
    trophyInfo[id] = {
      plat: plat ? { rate: plat.r, earned: plat.e, at: plat.at, icon: plat.ic, name: plat.n } : null,
      rarest: rarest ? { name: rarest.n, rate: rarest.r, type: rarest.ty, icon: rarest.ic } : null,
    };
  }
  await writeJson(path.join(CACHE, 'trophy-meta.json'), metaCache);
  await writeJson(path.join(CACHE, 'trophy-seen.json'), seen);

  // agrupa versões do mesmo jogo pelo "concept" da Sony
  const games = new Map();
  const titleToConcept = {};
  const get = (key, name) => {
    if (!games.has(key)) games.set(key, {
      key, name, platforms: new Set(), titleIds: new Set(), cover: null, hero: null, logo: null,
      playMinutes: 0, playCount: 0, firstPlayed: null, lastPlayed: null,
      owned: false, plus: false, preorder: false, trophySets: [], genres: [],
    });
    return games.get(key);
  };
  const minDate = (a, b) => (!a || (b && b < a)) ? b : a;
  const maxDate = (a, b) => (!a || (b && b > a)) ? b : a;

  for (const p of played) {
    const key = p.concept?.id ? `c${p.concept.id}` : `p${p.titleId}`;
    for (const tid of [p.titleId, ...(p.concept?.titleIds || [])]) titleToConcept[tid] = key;
    const g = get(key, p.concept?.name || p.localizedName || p.name);
    const imgs = p.concept?.media?.images || [];
    g.cover ||= bestImage(imgs, ['MASTER', 'PORTRAIT_BANNER', 'GAMEHUB_COVER_ART']) || p.localizedImageUrl || p.imageUrl;
    g.hero  ||= bestImage(imgs, ['GAMEHUB_COVER_ART', 'BACKGROUND_LAYER_ART', 'FOUR_BY_THREE_BANNER', 'SCREENSHOT']);
    g.logo  ||= bestImage(imgs, ['LOGO']);
    g.platforms.add(p.category === 'ps5_native_game' ? 'PS5' : p.category === 'ps4_game' ? 'PS4' : p.category === 'pspc_game' ? 'PC' : '?');
    g.titleIds.add(p.titleId);
    g.playMinutes += isoDurToMin(p.playDuration);
    g.playCount += p.playCount || 0;
    g.firstPlayed = minDate(g.firstPlayed, p.firstPlayedDateTime);
    g.lastPlayed = maxDate(g.lastPlayed, p.lastPlayedDateTime);
    if (p.service === 'ps_plus') g.plus = true;
    if (p.concept?.genres) g.genres = p.concept.genres;
  }

  for (const b of purchased.games) {
    const key = titleToConcept[b.titleId] || (b.conceptId ? `c${b.conceptId}` : `p${b.titleId}`);
    const g = get(key, b.name);
    g.owned = true;
    g.cover ||= b.image?.url;
    g.platforms.add(b.platform);
    g.titleIds.add(b.titleId);
    if (b.membership === 'PS_PLUS') g.plus = true;
    if (b.isPreOrder) g.preorder = true;
  }

  const npToKey = {};
  for (const [tid, np] of Object.entries(links)) if (np && titleToConcept[tid]) npToKey[np] = titleToConcept[tid];
  for (const t of titles) {
    const key = npToKey[t.npCommunicationId] || `t${t.npCommunicationId}`;
    const g = get(key, t.trophyTitleName);
    g.cover ||= t.trophyTitleIconUrl;
    for (const pl of t.trophyTitlePlatform.split(',')) g.platforms.add(pl);
    g.trophySets.push({
      id: t.npCommunicationId, name: t.trophyTitleName, platform: t.trophyTitlePlatform,
      icon: t.trophyTitleIconUrl, progress: t.progress, defined: t.definedTrophies, earned: t.earnedTrophies,
      updated: t.lastUpdatedDateTime, ...trophyInfo[t.npCommunicationId],
    });
  }

  // junta entradas do mesmo jogo: versões PS4/PS5 com "concept" diferente,
  // ou lista de troféus que a Sony não ligou ao registro de horas
  // ("Troféus do EA SPORTS FC™ 26" é a lista de troféus do "EA Sports FC™ 26")
  const nameKey = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^(trofeus d[aoe]s?|trophies)\s+/, '')
    .replace(/[™®©]/g, '').replace(/\b(ps4|ps5)\b/g, '').replace(/[^a-z0-9]+/g, '');
  const merged = new Map();
  for (const g of games.values()) {
    const k = nameKey(g.name);
    const m = merged.get(k);
    if (!m) { merged.set(k, g); continue; }
    g.platforms.forEach(p => m.platforms.add(p));
    g.titleIds.forEach(t => m.titleIds.add(t));
    m.cover ||= g.cover; m.hero ||= g.hero; m.logo ||= g.logo;
    m.playMinutes += g.playMinutes; m.playCount += g.playCount;
    m.firstPlayed = minDate(m.firstPlayed, g.firstPlayed);
    m.lastPlayed = maxDate(m.lastPlayed, g.lastPlayed);
    m.owned ||= g.owned; m.plus ||= g.plus; m.preorder ||= g.preorder;
    if (!m.genres?.length) m.genres = g.genres;
    for (const s of g.trophySets) if (!m.trophySets.some(x => x.id === s.id)) m.trophySets.push(s);
  }

  const PLAT_LABEL = { PSVITA: 'Vita', PSPC: 'PC' };
  const ROMAN = /^(i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3})$/i;
  const ACRONYM = new Set(['EA', 'FC', 'FIFA', 'GTA', 'NBA', 'NFL', 'NHL', 'MLB', 'WWE', 'UFC', 'PES', 'DLC', 'VR', 'HD', 'PGA', 'WRC', 'LEGO', 'DC', 'TMNT', 'NBA2K']);
  // "RESIDENT EVIL 3" -> "Resident Evil 3", "EA SPORTS FC™ 24" -> "EA Sports FC™ 24"
  // (só quando o nome vem todo em maiúsculas)
  const pretty = s => /[a-z].*[a-z]/.test(s) ? s : s.split(' ').map(w => {
    const core = w.replace(/[™®©:,.!?'’]/g, '');
    return ROMAN.test(core) || /\d/.test(core) || ACRONYM.has(core) ? w : w.charAt(0) + w.slice(1).toLowerCase();
  }).join(' ');

  const out = [];
  const yearInput = [];
  for (const g of merged.values()) {
    // lista principal = a com mais progresso (empate: a de PS5)
    g.trophySets.sort((a, b) => b.progress - a.progress || (b.platform.includes('PS5') - a.platform.includes('PS5')));
    const main = g.trophySets[0] || null;
    const hasPlat = g.trophySets.some(s => s.plat?.earned);
    const platRate = main?.plat?.rate ?? null;
    const anyProgress = g.trophySets.some(s => s.progress > 0);
    const status = hasPlat ? 'platinum'
      : main && main.progress === 100 ? 'complete'
      : (g.playMinutes > 0 || anyProgress) ? 'playing'
      : g.trophySets.length ? 'started' : 'never';
    out.push({
      key: g.key, name: pretty(g.name),
      platforms: [...new Set([...g.platforms].filter(p => p !== '?').map(p => PLAT_LABEL[p] || p))],
      platCount: g.trophySets.filter(s => s.plat?.earned).length,
      // cada platina separada: PS4 e PS5 do mesmo jogo podem ter sido feitas em anos diferentes
      plats: g.trophySets.filter(s => s.plat?.earned).map(s => ({
        set: s.id, at: s.plat.at, rate: s.plat.rate,
        platform: s.platform.split(',').map(p => PLAT_LABEL[p] || p).join('/'),
      })).sort((a, b) => (a.at || '').localeCompare(b.at || '')),
      cover: g.cover, hero: g.hero, logo: g.logo, genres: g.genres,
      owned: g.owned, plus: g.plus, preorder: g.preorder,
      playMinutes: g.playMinutes, playCount: g.playCount, firstPlayed: g.firstPlayed, lastPlayed: g.lastPlayed,
      status, trophies: main && {
        id: main.id, progress: main.progress, defined: main.defined, earned: main.earned,
        plat: main.plat, rarest: main.rarest, updated: main.updated,
      },
      platEarnedAt: g.trophySets.find(s => s.plat?.earned)?.plat.at || null,
      difficulty: difficultyFromRate(platRate),
      otherSets: g.trophySets.slice(1).map(s => ({ id: s.id, platform: s.platform, progress: s.progress, plat: !!s.plat?.earned })),
      // pra sugerir "zerado": data do último troféu e o troféu de história concluída, se você ganhou
      ...zeroHints(g.trophySets.flatMap(s => lists[s.id] || [])),
      // partes do jogo (coletânea ou DLCs), com o progresso de troféus de cada uma
      parts: main && groupsOf[main.id]?.length > 1 ? groupsOf[main.id].map(p => {
        const ts = (lists[main.id] || []).filter(t => (t.g || 'default') === p.id && t.ty !== 'platinum');
        return { id: p.id, name: p.name, icon: p.icon, defined: ts.length, earned: ts.filter(t => t.e).length };
      }) : null,
    });
    yearInput.push({
      key: g.key, playMinutes: g.playMinutes, firstPlayed: g.firstPlayed, lastPlayed: g.lastPlayed,
      plats: out.at(-1).plats,
      earned: g.trophySets.flatMap(s => (lists[s.id] || []).filter(t => t.e && t.at)),
    });
  }
  const years = buildYears(yearInput);
  const firstTrophy = yearInput.flatMap(i => i.earned.map(t => t.at)).sort()[0] || null;
  out.sort((a, b) => (b.lastPlayed || b.trophies?.updated || '').localeCompare(a.lastPlayed || a.trophies?.updated || ''));

  const extra = await readJson(path.join(DATA, 'extra.json'), { watchlist: [] });
  const igdbOn = await enrichIgdb(env, out, extra.watchlist || []);
  const watchTtb = Object.fromEntries((extra.watchlist || []).filter(w => w.ttb).map(w => [w.id, w.ttb]));
  const market = await enrichRawg(env, out, (extra.watchlist || []).map(({ ttb, ...w }) => w));

  const totalMin = out.reduce((s, g) => s + g.playMinutes, 0);
  const data = {
    generatedAt: new Date().toISOString(),
    sources: { purchased: purchased.ok, rawg: !!market, igdb: igdbOn },
    watchTtb,
    profile: {
      onlineId: prof.onlineId || null,
      avatar: prof.avatars?.find(a => a.size === 'xl')?.url || prof.avatars?.at(-1)?.url || null,
      aboutMe: prof.aboutMe || '',
      isPlus: !!prof.isPlus,
      level: +summary.trophyLevel, levelProgress: summary.progress, tier: summary.tier,
      earned: summary.earnedTrophies,
    },
    totals: {
      games: out.length, minutes: totalMin,
      never: out.filter(g => g.status === 'never').length,
      platinums: out.filter(g => g.status === 'platinum').length,
    },
    games: out,
    years, firstTrophy,
    market,
  };
  await writeJson(path.join(DATA, 'psn.json'), data);
  log(`pronto: ${out.length} jogos · ${data.totals.platinums} platinas · ${Math.round(totalMin / 60)} h → site/data/psn.json`);
}

main().catch(e => { console.error('\n✖', e.message); process.exit(1); });
