// GARAPAS: preço de agora na PS Store do Brasil dos jogos da lista (extra.json → garapas).
// Usado pelo sync do PC (Node) e pelo app Android. getJson(url, headers) faz o GET com a rede de cada um.
// É a mesma busca pública que a loja usa no site dela (store.playstation.com/pt-br/search) — só consulta.

const SEARCH_HASH = '4df6284f982e57bec70f23c77e2c219dc792eb19af7fb3d3a81767aa3f1958aa';   // getSearchResults
export const STORE_HEADERS = { 'x-psn-store-locale-override': 'pt-BR', 'content-type': 'application/json' };
const COVER = ['MASTER', 'GAMEHUB_COVER_ART', 'PORTRAIT_BANNER', 'FOUR_BY_THREE_BANNER', 'BACKGROUND', 'PREVIEW', 'SCREENSHOT'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

// "R$74,75" -> 74.75
const brlNum = s => s == null ? null : +String(s).replace(/[^\d,]/g, '').replace(',', '.') || 0;

const searchUrl = term => 'https://web.np.playstation.com/api/graphql/v1/op?operationName=getSearchResults' +
  '&variables=' + encodeURIComponent(JSON.stringify({ countryCode: 'BR', languageCode: 'pt', nextCursor: '', pageOffset: 0, pageSize: 10, searchTerm: term })) +
  '&extensions=' + encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: SEARCH_HASH } }));

// list = [{ t: 'CUSA09747_00', name: 'MINIT' }]  (t = código do jogo na loja; o nome só serve pra buscar)
export async function storePrices(list, getJson, log = () => {}){
  const items = [];
  for (const g of list) {
    try {
      const j = await getJson(searchUrl(g.name), STORE_HEADERS);
      const rs = j?.data?.universalSearch?.results || [];
      const hit = rs.find(r => r.npTitleId === g.t) || rs.find(r => r.id?.includes(g.t));
      if (!hit) { items.push({ t: g.t, missing: true }); log(`loja: ${g.name} não está à venda agora`); continue; }
      const p = hit.price || {}, media = hit.media || [];
      items.push({
        t: g.t, name: hit.name, product: hit.id, platforms: hit.platforms || [],
        price: p.isFree ? 0 : brlNum(p.discountedPrice), base: brlNum(p.basePrice),
        off: p.discountText || null, plusOnly: !!p.isTiedToSubscription,
        cover: COVER.map(role => media.find(m => m.role === role && m.type === 'IMAGE')?.url).find(Boolean) || null,
      });
    } catch (e) {
      items.push({ t: g.t, error: true });
      log(`loja: falhou ${g.name}: ${e.message}`);
    }
    await sleep(250);
  }
  return { at: new Date().toISOString(), items };
}
