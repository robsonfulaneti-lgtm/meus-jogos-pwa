// Sincronização feita pelo próprio app no celular. Não depende de Capacitor nem do navegador
// (tudo é passado de fora), então dá pra testar no PC com o Node.
//   kv             = armazenamento do aparelho { get(chave, padrão), set(chave, valor), del(chave) }
//   psn            = biblioteca psn-api
//   httpNoRedirect = GET que NÃO segue redirecionamento e devolve { status, location } (login com npsso)
//   fetchJson      = baixa um JSON de uma URL
//   remote         = endereço do site (de onde vêm notas, tempo pra zerar, lançamentos e o ponto de partida)
//   getExtra       = devolve o data/extra.json (que vai dentro do app)
import { collectPsn, tokensToStore } from './psn-core.js';

const K = { auth: 'auth', data: 'data:psn', last: 'lastSync' };

export function createAppSync({ kv, psn, httpNoRedirect, fetchJson, remote, getExtra, log = () => {} }){
  // Troca o npsso por um código de acesso. É o mesmo pedido que a psn-api faz, mas aqui com HTTP nativo:
  // o navegador não deixa mandar o cookie nem ler o redirecionamento.
  async function codeFromNpsso(npsso){
    const qs = new URLSearchParams({
      access_type: 'offline',
      client_id: '09515159-7237-4370-9b40-3806e67c0891',      // o mesmo da psn-api (app oficial da PlayStation)
      redirect_uri: 'com.scee.psxandroid.scecompcall://redirect',
      response_type: 'code',
      scope: 'psn:mobile.v2.core psn:clientapp',
    });
    const r = await httpNoRedirect(`https://ca.account.sony.com/api/authz/v3/oauth/authorize?${qs}`, { Cookie: `npsso=${npsso}` });
    const loc = r.location || '';
    const code = new URLSearchParams(loc.split('redirect/')[1] || '').get('code');
    if (!code) throw Object.assign(new Error('Esse código npsso não funcionou — pegue um novo e tente de novo.'), { code: 'BAD_NPSSO' });
    return code;
  }

  // aceita o código puro ou o texto inteiro {"npsso":"…"} copiado da página da Sony
  const cleanNpsso = s => (String(s || '').match(/[A-Za-z0-9]{64}/) || [])[0] || null;

  // O npsso não fica guardado: só os tokens de acesso (o de renovação vale ~2 meses).
  async function login(raw){
    const npsso = cleanNpsso(raw);
    if (!npsso) throw Object.assign(new Error('Cole o código npsso (64 letras e números).'), { code: 'BAD_NPSSO' });
    const code = await codeFromNpsso(npsso);
    const t = await psn.exchangeAccessCodeForAuthTokens(code);
    if (!t?.accessToken) throw Object.assign(new Error('A Sony recusou o login. Pegue um código novo.'), { code: 'BAD_NPSSO' });
    await kv.set(K.auth, tokensToStore(t));
  }

  async function ensureAuth(){
    const a = await kv.get(K.auth, null), now = Date.now();
    if (a?.accessToken && a.accessExp > now + 60_000) return a;
    if (a?.refreshToken && a.refreshExp > now + 60_000) {
      try {
        const t = await psn.exchangeRefreshTokenForAuthTokens(a.refreshToken);
        if (t?.accessToken) { const v = tokensToStore(t); await kv.set(K.auth, v); return v; }
      } catch (e) { log('renovação falhou: ' + e.message); }
    }
    throw Object.assign(new Error(a ? 'O login da PSN venceu — cole um código npsso novo.' : 'Conecte sua conta PSN aqui no Perfil pra atualizar pelo celular.'), { code: 'NEED_LOGIN' });
  }

  // cache da sincronização dentro do aparelho; lista de troféus que ainda não tem aqui vem do site
  const store = {
    get: (n, fb) => kv.get('cache:' + n, fb),
    set: (n, v) => kv.set('cache:' + n, v),
    getList: async id => {
      const local = await kv.get('list:' + id, null);
      if (local) return local;
      const r = await fetchJson(`${remote}data/t/${encodeURIComponent(id)}.json`).catch(() => null);
      if (r) await kv.set('list:' + id, r);
      return r;
    },
    setList: (id, list) => kv.set('list:' + id, list),
  };

  // primeira vez: começa do que o site já tem (vínculos, partes, datas), pra só baixar o que mudou
  async function seedFromRemote(onProgress){
    try {
      const s = await fetchJson(`${remote}data/seed.json`);
      if (s?.links) await store.set('title-links', s.links);
      if (s?.groups) await store.set('trophy-groups', s.groups);
      // listas de troféus do site, 8 de cada vez (uma por uma demora minutos no celular)
      const ids = Object.keys(s?.seen || {});
      let next = 0, done = 0;
      const worker = async () => {
        while (next < ids.length) {
          const id = ids[next++];
          if (!(await kv.get('list:' + id, null))) await store.getList(id);
          onProgress({ step: 'Baixando troféus do site', done: ++done, total: ids.length });
        }
      };
      await Promise.all(Array.from({ length: 8 }, worker));
      // só marca como visto depois das listas: se cair no meio, a próxima vez recomeça daqui
      if (s?.seen) await store.set('trophy-seen', s.seen);
      log('ponto de partida do site carregado');
    } catch (e) { log('sem ponto de partida do site (vai baixar tudo): ' + e.message); }
  }

  // notas, tempo pra zerar e lançamentos vêm do site (o PC é quem tem as chaves do RAWG/IGDB)
  async function enrich(data){
    let src = await fetchJson(`${remote}data/psn.json`).catch(() => null);
    if (!src) src = await kv.get(K.data, null);        // sem internet pro site: mantém o que já tinha
    if (!src) return;
    const byKey = new Map((src.games || []).map(g => [g.key, g]));
    for (const g of data.games) {
      const s = byKey.get(g.key);
      if (s?.rating) g.rating = s.rating;
      if (s?.ttb) g.ttb = s.ttb;
    }
    data.market = src.market || null;
    data.garapas = src.garapas || null;
    data.watchTtb = src.watchTtb || {};
    data.sources = { ...data.sources, rawg: !!src.sources?.rawg, igdb: !!src.sources?.igdb };
  }

  let running = null;
  function sync(onProgress = () => {}){
    // um toque a mais em "Atualizar" no meio de uma atualização não começa outra
    running ||= (async () => {
      try {
        const auth = await ensureAuth();
        if (!(await store.get('trophy-seen', null))) { onProgress({ step: 'Preparando', done: 0, total: 0 }); await seedFromRemote(onProgress); }
        const extra = await getExtra();
        const { data } = await collectPsn({ psn, auth, store, log, onProgress, extra });
        onProgress({ step: 'Notas e lançamentos', done: 0, total: 0 });
        await enrich(data);
        await kv.set(K.data, data);
        await kv.set(K.last, Date.now());
        return data;
      } finally { running = null; }
    })();
    return running;
  }

  return {
    login, sync, ensureAuth,
    isRunning: () => !!running,
    async status(){
      const a = await kv.get(K.auth, null);
      return {
        loggedIn: !!a?.refreshToken && a.refreshExp > Date.now(),
        loginExpires: a?.refreshExp || null,
        lastSync: await kv.get(K.last, null),
      };
    },
    async logout(){ await kv.del(K.auth); },
    localData: () => kv.get(K.data, null),
    saveData: data => kv.set(K.data, data),
    localList: id => store.getList(id),
  };
}
