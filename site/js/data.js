// Carrega o snapshot gerado pelo sync (data/psn.json) + dados curados (data/extra.json)
// e aplica o que o usuário ajustou no aparelho (localStorage).

const store = {
  get(k, fb){ try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
export { store };

async function getJson(url){
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

export const norm = s => (s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[™®©:'’\-–—_.,!?()]/g, ' ').replace(/\b(the|ps4|ps5|edition|remastered|remaster)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();

const SEQUEL = /^(\d+|i{1,3}|iv|v|vi{0,3}|ix|x)$/;
// "mafia iii" casa com "mafia iii definitive", mas "resident evil" não casa com "resident evil 2"
function sameGame(a, b){
  if (a === b) return true;
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  if (short.length < 6 || !long.startsWith(short + ' ')) return false;
  const next = long.slice(short.length + 1).split(' ')[0];
  return !SEQUEL.test(next);
}

export async function loadModel(){
  const [psn, extra] = await Promise.all([getJson('data/psn.json'), getJson('data/extra.json')]);
  const ovr = store.get('g.ovr.v1', {});
  const games = (psn?.games || []).map(g => ({ ...g, source: 'psn' }));
  const keyed = games.map(g => [norm(g.name), g]);

  for (const b of extra?.backlog || []) {
    const n = norm(b.name);
    const hit = keyed.find(([k]) => sameGame(k, n))?.[1];
    if (hit) {
      hit.hoursEst ??= b.hours;
      if (b.note) hit.note = b.note;
      hit.cover ||= b.cover;
    } else {
      games.push({
        key: `l-${b.id}`, name: b.name, cover: b.cover, hero: b.cover, platforms: [], status: 'never',
        playMinutes: 0, source: 'lista', hoursEst: b.hours, note: b.note || '', trophies: null, difficulty: null,
      });
    }
  }

  for (const [name, date] of Object.entries(extra?.releaseOverride || {})) {
    const g = games.find(x => x.name === name);
    if (g) g.rating = { ...(g.rating || {}), orig: date };
  }

  // partes: grupos de troféus da PSN (DLCs ou jogos de uma coletânea) + jogos que moram dentro de uma coletânea
  const byName = n => games.find(x => x.name.trim() === n.trim());
  const sum = o => o ? (o.bronze || 0) + (o.silver || 0) + (o.gold || 0) : 0;
  for (const [name, cfg] of Object.entries(extra?.collections || {})) {
    const parent = typeof cfg === 'object' && byName(name);
    if (!parent) continue;
    parent.collection = true;
    const isGame = new Set(cfg.games || []);
    const linked = (cfg.include || []).map(byName).filter(Boolean).map(c => {
      c.parentKey = parent.key;
      return { id: 'g:' + c.key, link: c.key, name: c.name.replace(/[™®]/g, '').trim(), icon: c.cover,
               defined: sum(c.trophies?.defined), earned: sum(c.trophies?.earned), kind: 'jogo' };
    });
    const groups = (parent.parts || []).map(p => ({ ...p, name: cfg.names?.[p.id] || p.name, kind: isGame.has(p.id) ? 'jogo' : 'extra' }));
    parent.parts = [...linked, ...groups];
  }
  for (const g of games) if (g.parts && !g.collection) g.parts = g.parts.map(p => ({ ...p, kind: p.id === 'default' ? 'base' : 'dlc' }));

  const want = store.get('g.want.v1', {});
  const zer = store.get('g.zerado.v1', {});
  const hid = store.get('g.hidden.v1', {});
  for (const g of games) {
    g.want = !!want[g.key];
    g.wantAt = want[g.key] || 0;
    g.zeradoAt = zer[g.key] || 0;
    g.hiddenAt = hid[g.key] || 0;
    const o = ovr[g.key];
    g.diffAuto = g.difficulty;
    if (o?.diff != null) g.difficulty = o.diff;
    if (o?.hours != null) g.hoursPlat = o.hours;
    zerarEstimate(g, o);
  }

  // lista de desejos: aproveita preços/compras/remoções da versão antiga do app
  const prices = store.get('buy.prices.v1', {});
  const bought = new Set(store.get('buy.bought.v1', []));
  const removed = new Set(store.get('buy.deleted.v1', []));
  const info = Object.fromEntries((psn?.market?.watch || []).map(w => [w.id, w.info]));
  const custom = store.get('games.custom.buy.v1', []).map(c => ({ id: c.id, name: c.title, price: c.price, cover: c.img }));
  const hist = store.get('buy.pricehist.v1', {});
  const watch = [...(extra?.watchlist || []), ...custom].map(w => {
    const price = w.id in prices ? prices[w.id] : (w.price || 0);
    // histórico: começa com o preço que já estava salvo, e cada edição acrescenta um ponto
    if (!hist[w.id] && price) hist[w.id] = [{ p: price, t: Date.now() }];
    return {
      ...w, price,
      info: info[w.id] || null,
      ttb: psn?.watchTtb?.[w.id] || null,
      hist: hist[w.id] || [],
      bought: bought.has(w.id),
      removed: removed.has(w.id),
    };
  });
  store.set('buy.pricehist.v1', hist);

  const byKey = new Map(games.map(g => [g.key, g]));
  recompute(games, byKey);

  return {
    connected: !!psn,
    generatedAt: psn?.generatedAt || null,
    sources: psn?.sources || {},
    profile: psn?.profile || null,
    all: games,                                                // tudo (números da conta, estante, retrospectiva)
    games: games.filter(g => !g.hidden && !g.parentKey),       // o que aparece nas listas (partes moram dentro do jogo grande)
    hiddenGames: games.filter(g => g.hidden),
    byKey,
    watch,
    top: psn?.market?.top || [],
    years: psn?.years || [],
    firstTrophy: psn?.firstTrophy || null,
  };
}

export function saveOverride(key, patch){
  const all = store.get('g.ovr.v1', {});
  all[key] = { ...(all[key] || {}), ...patch };
  for (const k of Object.keys(all[key])) if (all[key][k] == null) delete all[key][k];
  store.set('g.ovr.v1', all);
}

// "Quero zerar": guarda a hora em que foi marcado, pra manter a ordem da sua escolha
export function toggleWant(key){
  const w = store.get('g.want.v1', {});
  if (w[key]) delete w[key]; else w[key] = Date.now();
  store.set('g.want.v1', w);
  return w[key] || 0;
}

// zerado = marcado por você, ou platinado / 100% (esses contam sozinhos).
// Partes: zeradas por você, ou com todos os troféus. Coletânea zera sozinha quando todos os jogos dela zeram.
// Também conta como zerado (até você tirar): jogo com troféu de fim de história, ou com mais de 3 h.
// A data é a do troféu de fim de história, senão a do último troféu.
const SUG_MIN = 180;
function recompute(all, byKey){
  const ps = store.get('g.parts.v1', {});
  const no = store.get('g.zerado.no.v1', {});
  for (const g of all) {
    g.zeradoWhy = g.status === 'platinum' ? 'platina' : g.status === 'complete' ? '100%' : null;
    g.zeradoAuto = !!g.zeradoWhy;
    // coletânea não entra pela regra das horas: ela zera quando todos os jogos dela zerarem
    g.zeradoSug = !g.zeradoAuto && !g.collection && g.source === 'psn' && (!!g.storyTrophy || g.playMinutes >= SUG_MIN);
    g.zeradoSugAt = Date.parse(g.storyTrophy?.at || g.lastTrophyAt || '') || 0;
    g.zeradoNo = !!no[g.key];
    g.zerado = g.zeradoAuto || !!g.zeradoAt || (g.zeradoSug && !g.zeradoNo);
    g.zeradoDate = g.zeradoAt || (g.zeradoSug && !g.zeradoNo ? g.zeradoSugAt : 0) || Date.parse(g.platEarnedAt || '') || 0;
    g.hidden = !!g.hiddenAt;
  }
  for (const g of all) {
    if (!g.parts) continue;
    for (const p of g.parts) {
      const child = p.link && byKey.get(p.link);
      if (child) {
        // jogo que mora dentro da coletânea: segue o "zerado" dele mesmo
        p.auto = child.zeradoAuto;
        p.zerado = child.zerado;
        p.canUndo = child.zerado && !child.zeradoAuto;
        p.date = child.zeradoDate;
        continue;
      }
      // grupo de troféus: 100% dos troféus, troféu de fim de história nessa parte, ou marcado por você
      const st = ps[g.key]?.[p.id];                 // >0 = marcado por você; -1 = "não zerei"
      p.auto = p.defined > 0 && p.earned === p.defined;
      p.sug = !!g.storyByPart?.[p.id];
      p.zerado = p.auto || st > 0 || (p.sug && st !== -1);
      p.canUndo = p.zerado && !p.auto;
      p.date = st > 0 ? st : (p.sug ? Date.parse(g.storyByPart[p.id]) : 0);
    }
    const counted = g.collection ? g.parts.filter(p => p.kind === 'jogo') : g.parts;
    g.partsDone = counted.filter(p => p.zerado).length;
    g.partsTotal = counted.length;
    if (g.collection && counted.length && g.partsDone === counted.length && !g.zerado) {
      g.zerado = g.zeradoAuto = true;
      g.zeradoWhy = 'todos os jogos';
    }
  }
}
export function applyFlags(M){
  recompute(M.all, M.byKey);
  M.games = M.all.filter(x => !x.hidden && !x.parentKey);
  M.hiddenGames = M.all.filter(x => x.hidden);
}
// alterna o "zerado" de uma parte. Tirar uma que entrou sozinha (troféu de fim) grava -1 = "não zerei".
export function togglePart(g, p){
  const m = store.get('g.parts.v1', {});
  m[g.key] ||= {};
  if (p.zerado) { if (p.sug) m[g.key][p.id] = -1; else delete m[g.key][p.id]; }
  else m[g.key][p.id] = Date.parse(g.lastByPart?.[p.id] || '') || Date.now();   // data do último troféu daquela parte
  store.set('g.parts.v1', m);
}
function toggleIn(storeKey, key){
  const m = store.get(storeKey, {});
  if (m[key]) delete m[key]; else m[key] = Date.now();
  store.set(storeKey, m);
  return m[key] || 0;
}
// marcar/desmarcar zerado. Desmarcar um que entrou sozinho (horas/troféu de história) fica guardado
// como "não zerei", pra não voltar no próximo sync.
export function setZerado(g, on){
  const zer = store.get('g.zerado.v1', {}), no = store.get('g.zerado.no.v1', {});
  if (on) {
    delete no[g.key];
    if (!g.zeradoSug) zer[g.key] = Date.parse(g.storyTrophy?.at || g.lastTrophyAt || '') || Date.now();
  } else {
    delete zer[g.key];
    if (g.zeradoSug) no[g.key] = Date.now();
  }
  store.set('g.zerado.v1', zer);
  store.set('g.zerado.no.v1', no);
  g.zeradoAt = zer[g.key] || 0;
}
export const toggleHidden = key => toggleIn('g.hidden.v1', key);

// tempo pra zerar: o que você digitou > IGDB (só a história) > estimativa da sua lista antiga
export function zerarEstimate(g, o = store.get('g.ovr.v1', {})[g.key]){
  const t = g.ttb;
  if (o?.zerar != null) { g.zerarH = o.zerar; g.zerarSrc = 'você'; }
  else if (t?.h || t?.n) { g.zerarH = t.h || t.n; g.zerarSrc = 'IGDB'; }
  else if (g.hoursEst) { g.zerarH = g.hoursEst; g.zerarSrc = 'sua lista'; }
  else { g.zerarH = null; g.zerarSrc = null; }
  // quanto falta, descontando o que você já jogou
  g.zerarFalta = g.zerarH == null ? null : Math.max(0, Math.round((g.zerarH - (g.playMinutes || 0) / 60) * 10) / 10);
}

export function watchAction(id, action, value){
  if (action === 'price') {
    const p = store.get('buy.prices.v1', {}); p[id] = value; store.set('buy.prices.v1', p);
    const h = store.get('buy.pricehist.v1', {});
    (h[id] ||= []).push({ p: value, t: Date.now() });
    store.set('buy.pricehist.v1', h);
  } else {
    const k = action === 'bought' ? 'buy.bought.v1' : 'buy.deleted.v1';
    const s = new Set(store.get(k, [])); s.has(id) ? s.delete(id) : s.add(id); store.set(k, [...s]);
  }
}

export async function loadTrophies(id){
  return getJson(`data/t/${encodeURIComponent(id)}.json`);
}
