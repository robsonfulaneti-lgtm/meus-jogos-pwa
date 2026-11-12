import { loadModel, togglePlatWant, toggleWant, setZerado, toggleHidden, togglePart, applyFlags } from './data.js';
import * as V from './views.js';
import { animate, setWall, transition, confetti } from './fx.js';
import { wantLabel, platWantLabel } from './ui.js';
import { isNative, appSync, updateInfo } from './native.js';

const view = document.getElementById('view');
const sheet = document.getElementById('sheet');
const panel = document.getElementById('sheetPanel');
const ROUTES = { inicio: V.home, biblioteca: V.library, platinas: V.platinas, lancamentos: V.releases, perfil: V.profile, anos: V.retro, pasta: V.pasta, garapas: V.garapas };
const NAV_OF = { anos: 'perfil', pasta: 'biblioteca', garapas: 'platinas' };   // telas sem aba própria acendem a aba "mãe"

let M = null;
let main = null;           // rota principal desenhada por baixo do detalhe
let lastMainHash = '#/inicio';
let openedFromApp = false;
let mainWall = '';

// degradês usados pelos anéis de progresso
document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d8bff"/><stop offset="1" stop-color="#00d1ff"/></linearGradient>
  <linearGradient id="ringPlat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#9fb5d6"/></linearGradient>
</defs></svg>`);

const ctx = {
  toast,
  rerender: () => main && drawMain(main, true),
  reopen: () => { const r = parse(); if (r.name === 'jogo') openDetail(r.arg, true); },
  // relê os dados (depois de sincronizar ou importar um backup) e redesenha a tela atual
  reload: async () => { M = await loadModel(); refreshAll(); },
  sync: manual => runSync(manual),
};

function parse(){
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = h.split('?');
  const [name, ...rest] = path.split('/');
  return { name: name || 'inicio', arg: decodeURIComponent(rest.join('/')), params: Object.fromEntries(new URLSearchParams(qs)), raw: h || 'inicio' };
}

// force = redesenha a mesma tela (depois de marcar algo), sem animação de entrada e sem perder a rolagem
function drawMain(r, force = false){
  const name = ROUTES[r.name] ? r.name : 'inicio';
  if (!force && main?.raw === r.raw) return;
  const out = ROUTES[name](M, r.params, ctx, r.arg);
  const y = force ? scrollY : 0;
  const paint = () => {
    view.innerHTML = out.html;
    view.classList.toggle('instant', force);
    if (!force) { view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); }
    ctx.onWant = null;
    ctx.onPlatWant = null;
    out.mount?.(view, ctx);
    animate(view, force);
    window.scrollTo(0, y);
    if (force) requestAnimationFrame(() => requestAnimationFrame(() => view.classList.remove('instant')));
  };
  force ? paint() : transition(paint);
  mainWall = out.wall || mainWall;
  if (out.wall && sheet.hidden) setWall(out.wall);
  document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.route === (NAV_OF[name] || name)));
  main = r;
  lastMainHash = '#/' + r.raw;
}

function openDetail(key, refresh = false){
  const g = M.byKey.get(key);
  if (!g) { location.hash = lastMainHash; return; }
  const keep = refresh ? panel.scrollTop : 0;
  panel.innerHTML = V.detail(M, g);
  V.mountDetail(panel, M, g, ctx);
  animate(panel, refresh);
  if (!refresh) {
    sheet.hidden = false;
    sheet.classList.remove('closing');
    document.body.style.overflow = 'hidden';
  }
  panel.scrollTop = keep;
  setWall(g.hero || g.cover);
}

function closeDetail(){
  if (sheet.hidden) return;
  sheet.classList.add('closing');
  setTimeout(() => { sheet.hidden = true; sheet.classList.remove('closing'); panel.innerHTML = ''; }, 260);
  document.body.style.overflow = '';
  if (mainWall) setWall(mainWall);
}

function route(){
  const r = parse();
  if (r.name === 'jogo') {
    if (!main) drawMain({ name: 'inicio', params: {}, arg: '', raw: 'inicio' });
    openDetail(r.arg);
  } else {
    closeDetail();
    drawMain(r);
  }
}

// depois de zerar/ocultar: redesenha a tela de baixo e o detalhe aberto (se houver)
function refreshAll(){
  ctx.rerender();
  if (!sheet.hidden) ctx.reopen();
}

// fechar detalhe: volta no histórico se veio de dentro do app
sheet.addEventListener('click', e => {
  if (!e.target.closest('[data-close]')) return;
  if (openedFromApp) history.back(); else location.hash = lastMainHash;
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) sheet.querySelector('[data-close]')?.click(); });
document.addEventListener('click', e => {
  if (e.target.closest('a[href^="#/jogo/"]')) openedFromApp = true;
});

// "Quero platinar": adiciona/tira (aba da Biblioteca e tela do jogo)
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pw]');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  const g = M.byKey.get(b.dataset.pw);
  if (!g) return;
  g.platWantAt = togglePlatWant(g.key);
  g.platWant = !!g.platWantAt;
  document.querySelectorAll('.pw-big').forEach(el => {
    if (el.dataset.pw !== g.key) return;
    el.classList.toggle('on', g.platWant);
    el.setAttribute('aria-pressed', g.platWant);
    el.textContent = platWantLabel(g.platWant);
  });
  toast(g.platWant ? `🏆 ${g.name} em "Quero platinar"` : `${g.name} saiu de "Quero platinar"`);
  ctx.onPlatWant?.();
}, true);

// Ações nos jogos. Fase de captura pra rodar antes do link do card abrir o jogo.
document.addEventListener('click', e => {
  // modo "Organizar" da biblioteca: tocar no card oculta/mostra o jogo
  const editCard = e.target.closest('.lib-editing .gcard');
  const b = editCard || e.target.closest('[data-want],[data-zerar],[data-hide],[data-part]');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();

  // parte de um jogo (DLC ou jogo de coletânea): "parentKey|idDaParte"
  if (b.dataset.part) {
    const [pk, pid] = b.dataset.part.split('|');
    const parent = M.byKey.get(pk), part = parent?.parts?.find(p => p.id === pid);
    if (!part) return;
    const wasZerado = parent.zerado;
    togglePart(parent, part);
    applyFlags(M);
    if (part.zerado) {
      const r = b.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2);
      if (navigator.vibrate) navigator.vibrate([20, 40, 30]);
    }
    toast(part.zerado
      ? (!wasZerado && parent.zerado ? `🏁 ${part.name} zerado — e ${parent.name} completo!` : `✅ ${part.name} zerado!`)
      : `${part.name} voltou a ficar pendente`);
    refreshAll();
    return;
  }

  const key = editCard ? editCard.dataset.key : (b.dataset.want || b.dataset.zerar || b.dataset.hide);
  const g = M.byKey.get(key);
  if (!g) return;

  if (editCard || b.dataset.hide) {
    g.hiddenAt = toggleHidden(key);
    applyFlags(M);
    if (editCard) {
      // some na hora com animação; o redesenho completo vem em seguida
      editCard.classList.add('vanish');
      setTimeout(refreshAll, 260);
    } else refreshAll();
    toast(g.hidden ? `🙈 ${g.name} ocultado` : `👁 ${g.name} voltou pra biblioteca`);
    return;
  }

  if (b.dataset.zerar) {
    setZerado(g, !g.zerado);
    applyFlags(M);
    if (g.zerado) {
      const r = b.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2);
      if (navigator.vibrate) navigator.vibrate([20, 40, 30]);
    }
    toast(g.zerado ? `✅ ${g.name} zerado!` : `${g.name} voltou a ficar pendente`);
    refreshAll();
    return;
  }

  // "Quero zerar": atualiza no lugar, sem redesenhar a tela
  g.wantAt = toggleWant(g);
  g.want = !!g.wantAt;
  document.querySelectorAll('[data-want]').forEach(el => {
    if (el.dataset.want !== key) return;
    el.classList.toggle('on', g.want);
    el.setAttribute('aria-pressed', g.want);
    if (el.classList.contains('want-big')) el.textContent = wantLabel(g.want);
    el.closest('.gcard')?.classList.toggle('wanted', g.want);
  });
  if (g.want && navigator.vibrate) navigator.vibrate(18);
  toast(g.want ? `⭐ ${g.name} → Quero zerar` : `${g.name} saiu de Quero zerar`);
  ctx.onWant?.();
}, true);
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('span[data-want]')) { e.preventDefault(); e.target.click(); }
});

// papel de parede acompanha o jogo sob o mouse (no desktop)
if (matchMedia('(hover: hover)').matches) {
  let t;
  view.addEventListener('pointerover', e => {
    const el = e.target.closest('[data-wall]');
    if (!el || !el.dataset.wall) return;
    clearTimeout(t);
    t = setTimeout(() => setWall(el.dataset.wall), 260);
  });
}

let toastT;
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1900);
}

// ---------- app Android: atualização direto da PSN ----------
const bar = document.createElement('div');
bar.className = 'syncbar'; bar.hidden = true;
bar.innerHTML = '<span class="syncbar-txt"></span><i class="syncbar-fill"></i>';
document.body.appendChild(bar);
const setBar = p => {
  bar.hidden = false;
  bar.querySelector('.syncbar-txt').textContent = `Atualizando · ${p.step}${p.total ? ` ${p.done}/${p.total}` : ''}`;
  bar.querySelector('.syncbar-fill').style.width = p.total ? `${Math.round(p.done / p.total * 100)}%` : '100%';
  bar.classList.toggle('indet', !p.total);
};

async function runSync(manual){
  const s = await appSync();
  if (!s) return;
  if (s.isRunning()) { if (manual) toast('Já está atualizando…'); return; }
  document.querySelectorAll('[data-sync]').forEach(b => b.disabled = true);
  try {
    setBar({ step: 'Conectando', done: 0, total: 0 });
    await s.sync(setBar);
    M = await loadModel();
    refreshAll();
    ctx.onAccount?.();
    if (manual) toast('✅ Atualizado com a PSN');
  } catch (e) {
    if (e.code === 'NEED_LOGIN') {
      toast('🔗 Conecte a PSN pra atualizar');
      if (manual && !location.hash.startsWith('#/perfil')) location.hash = '#/perfil';
    } else if (manual) toast('Não deu pra atualizar agora: ' + (e.message || 'sem conexão').slice(0, 80));
  } finally {
    bar.hidden = true;
    document.querySelectorAll('[data-sync]').forEach(b => b.disabled = false);
  }
}
document.addEventListener('click', e => { if (e.target.closest('[data-sync]')) runSync(true); });

(async () => {
  if (isNative) document.documentElement.classList.add('native');
  M = await loadModel();
  window.addEventListener('hashchange', route);
  route();
  if (!isNative) return;
  // ao abrir: atualiza sozinho se passaram mais de 6 h (e avisa se tem versão nova do app)
  const s = await appSync(), st = await s.status();
  if (st.loggedIn && (!st.lastSync || Date.now() - st.lastSync > 6 * 3600e3)) runSync(false);
  if (!st.loggedIn && !M.connected) location.hash = '#/perfil';
  const up = await updateInfo();
  if (up) toast(`📦 Versão ${up.version} do app disponível — veja no Perfil`), (ctx.update = up);
  // voltando pro app depois de um tempo, atualiza também (sem a PSN conectada: pega o que o site tiver de mais novo)
  let siteCheck = Date.now();
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    const st2 = await s.status();
    if (st2.loggedIn && Date.now() - (st2.lastSync || 0) > 6 * 3600e3) runSync(false);
    else if (!st2.loggedIn && Date.now() - siteCheck > 10 * 60e3) { siteCheck = Date.now(); ctx.reload(); }
  });
})();

// service worker só no site (o app já tem tudo dentro dele)
if (!isNative && 'serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
