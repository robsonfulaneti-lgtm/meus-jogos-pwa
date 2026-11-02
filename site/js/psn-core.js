// Núcleo da sincronização com a PSN — o mesmo código roda no PC (sync/sync-psn.mjs, Node)
// e no app Android (js/native.js). Não tem nada de Node nem de navegador aqui dentro:
//   psn   = funções da biblioteca psn-api
//   store = onde guardar o cache  { get(nome, padrão), set(nome, valor), getList(id), setList(id, lista) }
//   log   = função de log;  onProgress({ step, done, total }) = barra de progresso (opcional)
// Só lê da Sony; nunca escreve nada na sua conta.

export const LANG = { 'Accept-Language': 'pt-BR' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

export const norm = s => (s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[™®©:'’\-–—_.,!?()]/g, ' ').replace(/\b(the|ps4|ps5|edition|remastered|remaster)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();

// chamada com intervalo mínimo e nova tentativa em caso de limite de requisições
let last = 0;
export async function api(label, fn, log = () => {}, tries = 4){
  for (let i = 0; i < tries; i++) {
    const wait = 220 - (Date.now() - last);
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try { return await fn(); }
    catch (e) {
      const msg = String(e?.message || e);
      const retriable = /429|rate|too many|ECONNRESET|ETIMEDOUT|fetch failed|network|50\d/i.test(msg);
      if (!retriable || i === tries - 1) throw new Error(`${label}: ${msg.slice(0, 300)}`);
      const back = 1500 * 2 ** i;
      log(`${label} — limite/erro temporário, tentando de novo em ${back / 1000}s`);
      await sleep(back);
    }
  }
}

// "PT12H3M7S" -> minutos
export function isoDurToMin(d){
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

// tokens no formato guardado (com a hora em que vencem)
export const tokensToStore = (t, now = Date.now()) => ({
  accessToken: t.accessToken, refreshToken: t.refreshToken,
  accessExp: now + t.expiresIn * 1000, refreshExp: now + t.refreshTokenExpiresIn * 1000,
});

// ---------- coleta ----------
async function fetchAllTitles(psn, auth, log){
  const out = [];
  for (let offset = 0; ; ) {
    const r = await api('troféus', () => psn.getUserTitles(auth, 'me', { limit: 800, offset, headerOverrides: LANG }), log);
    out.push(...r.trophyTitles);
    if (!r.nextOffset || r.nextOffset >= r.totalItemCount) break;
    offset = r.nextOffset;
  }
  return out;
}

async function fetchPlayed(psn, auth, log){
  const out = [];
  for (let offset = 0; ; ) {
    const r = await api('jogados', () => psn.getUserPlayedGames(auth, 'me', {
      limit: 200, offset, categories: 'ps4_game,ps5_native_game,pspc_game,unknown',
    }), log);
    out.push(...r.titles);
    if (!r.nextOffset || r.titles.length === 0 || out.length >= r.totalItemCount) break;
    offset = r.nextOffset;
  }
  return out;
}

async function fetchPurchased(psn, auth, log){
  const out = [];
  try {
    for (let start = 0; ; start += 200) {
      const r = await api('comprados', () => psn.getPurchasedGames(auth, { size: 200, start, isActive: true }), log);
      const games = r.data.purchasedTitlesRetrieve.games || [];
      out.push(...games);
      if (games.length < 200) break;
    }
    return { ok: true, games: out };
  } catch (e) {
    log('não consegui ler a lista de comprados (a Sony pode ter mudado a consulta): ' + String(e.message).slice(0, 160));
    return { ok: false, games: [] };
  }
}

// liga titleId (CUSA/PPSA) -> npCommunicationId, com cache permanente
async function linkTitleIds(psn, auth, store, titleIds, log){
  const links = await store.get('title-links', {});
  const todo = [...new Set(titleIds)].filter(id => /^(CUSA|PPSA)/.test(id) && !(id in links));
  for (let i = 0; i < todo.length; i += 5) {
    const batch = todo.slice(i, i + 5);
    try {
      const r = await api('vínculos', () => psn.getUserTrophiesForSpecificTitle(auth, 'me', { npTitleIds: batch.join(',') }), log);
      for (const id of batch) links[id] = null;
      for (const t of r.titles || []) links[t.npTitleId] = t.trophyTitles?.[0]?.npCommunicationId || null;
    } catch (e) { log('vínculo falhou para ' + batch.join(',') + ': ' + String(e.message).slice(0, 120)); }
  }
  await store.set('title-links', links);
  return links;
}

// lista completa de troféus de um jogo (metadados + o que você já pegou)
async function trophyDetail(psn, auth, title, metaCache, log){
  const svc = title.trophyTitlePlatform?.includes('PS5') ? 'trophy2' : 'trophy';
  const id = title.npCommunicationId;
  const metaKey = `${id}@${title.trophySetVersion}`;
  let meta = metaCache[metaKey];
  if (!meta) {
    const r = await api(`lista ${title.trophyTitleName}`, () =>
      psn.getTitleTrophies(auth, id, 'all', { npServiceName: svc, headerOverrides: LANG }), log);
    meta = r.trophies.map(t => ({
      i: t.trophyId, n: t.trophyName, d: t.trophyDetail, ic: t.trophyIconUrl,
      ty: t.trophyType, g: t.trophyGroupId, h: t.trophyHidden,
    }));
    metaCache[metaKey] = meta;
  }
  const mine = await api(`progresso ${title.trophyTitleName}`, () =>
    psn.getUserTrophiesEarnedForTitle(auth, 'me', id, 'all', { npServiceName: svc }), log);
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
export function zeroHints(trophies){
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
export function buildYears(items){
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

function bestImage(images, types){
  for (const t of types) {
    const hit = images?.find(i => i.type === t);
    if (hit) return hit.url;
  }
  return null;
}

// ---------- sincronização completa ----------
// Devolve os dados do app (sem notas/tempo pra zerar/lançamentos, que vêm do RAWG/IGDB à parte).
export async function collectPsn({ psn, auth, store, log = () => {}, onProgress = () => {}, extra = {}, full = false }){
  const step = (s, done = 0, total = 0) => onProgress({ step: s, done, total });

  step('Perfil');
  log('perfil…');
  const summary = await api('resumo', () => psn.getUserTrophyProfileSummary(auth, 'me'), log);
  let prof = {};
  try { prof = await api('perfil', () => psn.getProfileFromAccountId(auth, summary.accountId), log); }
  catch (e) { log('perfil detalhado indisponível: ' + e.message); }

  step('Lista de troféus');
  log('lista de troféus…');
  const titles = await fetchAllTitles(psn, auth, log);
  log(`${titles.length} listas de troféus`);

  step('Tempo de jogo');
  log('tempo de jogo…');
  const played = await fetchPlayed(psn, auth, log);
  log(`${played.length} jogos com tempo registrado`);

  step('Biblioteca');
  log('biblioteca comprada…');
  const purchased = await fetchPurchased(psn, auth, log);
  log(purchased.ok ? `${purchased.games.length} itens comprados/resgatados` : 'biblioteca indisponível');

  step('Ligando jogos aos troféus');
  log('ligando jogos aos troféus…');
  const links = await linkTitleIds(psn, auth, store, played.flatMap(p => [p.titleId, ...(p.concept?.titleIds || [])]), log);

  // detalhes por lista de troféus (cache pelo lastUpdatedDateTime)
  log('detalhes de troféus (primeira vez demora, depois só o que mudou)…');
  const metaCache = await store.get('trophy-meta', {});
  const seen = full ? {} : await store.get('trophy-seen', {});
  const trophyInfo = {};
  const lists = {};   // troféus de cada lista, usados na retrospectiva por ano
  // nomes das partes (jogos de uma coletânea, DLCs): grupos da lista de troféus
  const groupCache = await store.get('trophy-groups', {});
  const groupsOf = {};
  const withGroups = titles.filter(t => t.hasTrophyGroups);
  let gi = 0;
  for (const t of withGroups) {
    step('Partes dos jogos', ++gi, withGroups.length);
    const gk = `${t.npCommunicationId}@${t.trophySetVersion}`;
    if (!groupCache[gk]) {
      try {
        const r = await api(`partes ${t.trophyTitleName}`, () => psn.getTitleTrophyGroups(auth, t.npCommunicationId, {
          npServiceName: t.trophyTitlePlatform?.includes('PS5') ? 'trophy2' : 'trophy', headerOverrides: LANG,
        }), log);
        groupCache[gk] = r.trophyGroups.map(g => ({ id: g.trophyGroupId, name: g.trophyGroupName, icon: g.trophyGroupIconUrl }));
      } catch (e) { log('partes falhou ' + t.trophyTitleName + ': ' + e.message); }
    }
    if (groupCache[gk]) groupsOf[t.npCommunicationId] = groupCache[gk];
  }
  await store.set('trophy-groups', groupCache);
  let n = 0, ti = 0;
  for (const t of titles) {
    step('Troféus', ++ti, titles.length);
    const id = t.npCommunicationId;
    let list = null;
    if (seen[id] === t.lastUpdatedDateTime) list = await store.getList(id);
    if (!list) {
      try {
        list = await trophyDetail(psn, auth, t, metaCache, log);
        await store.setList(id, list);
        seen[id] = t.lastUpdatedDateTime;
      } catch (e) { log('falhou ' + t.trophyTitleName + ': ' + e.message); list = []; }
      if (++n % 20 === 0) {
        log(`  ${n} listas baixadas…`);
        await store.set('trophy-meta', metaCache);
        await store.set('trophy-seen', seen);
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
  await store.set('trophy-meta', metaCache);
  await store.set('trophy-seen', seen);

  step('Montando');
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
  // exceções (extra.json "separate"): jogo diferente com o mesmo nome — ex.: o RE2 clássico do PS Plus
  // e o remake se chamam os dois "Resident Evil 2". Nunca junta por nome e pode ganhar nome próprio.
  const separate = extra.separate || {};
  const merged = new Map();
  const conceptMerges = [];
  for (const g of games.values()) {
    if (separate[g.key]) {
      if (typeof separate[g.key] === 'string') g.name = separate[g.key];
      merged.set('sep:' + g.key, g);
      continue;
    }
    const k = nameKey(g.name);
    const m = merged.get(k);
    if (!m) { merged.set(k, g); continue; }
    if (m.key.startsWith('c') && g.key.startsWith('c')) conceptMerges.push(`${m.name} [${m.key}] + ${g.name} [${g.key}]`);
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
  if (conceptMerges.length) log(`juntei pelo nome ${conceptMerges.length} jogos que a Sony separa (confira se são o mesmo):\n    ` + conceptMerges.join('\n    '));

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

  const totalMin = out.reduce((s, g) => s + g.playMinutes, 0);
  return {
    data: {
      generatedAt: new Date().toISOString(),
      sources: { purchased: purchased.ok },
      profile: {
        onlineId: prof.onlineId || null,
        // a Sony manda o avatar em http; o app Android não carrega imagem http
        avatar: (prof.avatars?.find(a => a.size === 'xl')?.url || prof.avatars?.at(-1)?.url || '').replace(/^http:/, 'https:') || null,
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
    },
    separate,
    // o que o app no celular aproveita pra não baixar tudo de novo na primeira vez (só IDs e datas)
    seed: { links, groups: groupCache, seen },
  };
}
