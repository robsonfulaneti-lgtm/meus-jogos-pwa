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

  for (const g of games) {
    const o = ovr[g.key];
    g.diffAuto = g.difficulty;
    if (o?.diff != null) g.difficulty = o.diff;
    if (o?.hours != null) g.hoursPlat = o.hours;
  }

  // lista de desejos: aproveita preços/compras/remoções da versão antiga do app
  const prices = store.get('buy.prices.v1', {});
  const bought = new Set(store.get('buy.bought.v1', []));
  const removed = new Set(store.get('buy.deleted.v1', []));
  const info = Object.fromEntries((psn?.market?.watch || []).map(w => [w.id, w.info]));
  const custom = store.get('games.custom.buy.v1', []).map(c => ({ id: c.id, name: c.title, price: c.price, cover: c.img }));
  const watch = [...(extra?.watchlist || []), ...custom].map(w => ({
    ...w,
    price: w.id in prices ? prices[w.id] : (w.price || 0),
    info: info[w.id] || null,
    bought: bought.has(w.id),
    removed: removed.has(w.id),
  }));

  return {
    connected: !!psn,
    generatedAt: psn?.generatedAt || null,
    sources: psn?.sources || {},
    profile: psn?.profile || null,
    games,
    byKey: new Map(games.map(g => [g.key, g])),
    watch,
    top: psn?.market?.top || [],
  };
}

export function saveOverride(key, patch){
  const all = store.get('g.ovr.v1', {});
  all[key] = { ...(all[key] || {}), ...patch };
  for (const k of Object.keys(all[key])) if (all[key][k] == null) delete all[key][k];
  store.set('g.ovr.v1', all);
}

export function watchAction(id, action, value){
  if (action === 'price') {
    const p = store.get('buy.prices.v1', {}); p[id] = value; store.set('buy.prices.v1', p);
  } else {
    const k = action === 'bought' ? 'buy.bought.v1' : 'buy.deleted.v1';
    const s = new Set(store.get(k, [])); s.has(id) ? s.delete(id) : s.add(id); store.set(k, [...s]);
  }
}

export async function loadTrophies(id){
  return getJson(`data/t/${encodeURIComponent(id)}.json`);
}
