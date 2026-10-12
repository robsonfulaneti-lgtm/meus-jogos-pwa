import { loadModel } from './data.js';
import * as V from './views.js';
import { animate, setWall, transition } from './fx.js';

const view = document.getElementById('view');
const sheet = document.getElementById('sheet');
const panel = document.getElementById('sheetPanel');
const ROUTES = { inicio: V.home, biblioteca: V.library, platinas: V.platinas, lancamentos: V.releases, perfil: V.profile };

let M = null;
let shown = '';            // rota principal desenhada (ex.: "biblioteca?f=never")
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
  rerender: () => drawMain(parse(), true),
  reopen: () => { const r = parse(); if (r.name === 'jogo') openDetail(r.arg, true); },
};

function parse(){
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = h.split('?');
  const [name, ...rest] = path.split('/');
  return { name: name || 'inicio', arg: decodeURIComponent(rest.join('/')), params: Object.fromEntries(new URLSearchParams(qs)), raw: h || 'inicio' };
}

function drawMain(r, force = false){
  const name = ROUTES[r.name] ? r.name : 'inicio';
  if (!force && shown === r.raw) return;
  const out = ROUTES[name](M, r.params, ctx);
  const y = force ? scrollY : 0;
  transition(() => {
    view.innerHTML = out.html;
    if (!force) { view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); }
    out.mount?.(view, ctx);
    animate(view);
    window.scrollTo(0, y);
  });
  mainWall = out.wall || mainWall;
  if (out.wall) setWall(out.wall);
  document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.route === name));
  shown = r.raw;
  lastMainHash = '#/' + r.raw;
}

function openDetail(key, refresh = false){
  const g = M.byKey.get(key);
  if (!g) { location.hash = lastMainHash; return; }
  const keep = refresh ? panel.scrollTop : 0;
  panel.innerHTML = V.detail(M, g);
  V.mountDetail(panel, M, g, ctx);
  animate(panel);
  if (!refresh) {
    sheet.hidden = false;
    sheet.classList.remove('closing');
    document.body.style.overflow = 'hidden';
    panel.focus?.();
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
    if (!shown) drawMain({ name: 'inicio', params: {}, raw: 'inicio' });
    openDetail(r.arg);
  } else {
    closeDetail();
    drawMain(r);
  }
}

// fechar detalhe: volta no histórico se veio de dentro do app
sheet.addEventListener('click', e => {
  if (!e.target.closest('[data-close]')) return;
  if (openedFromApp) history.back(); else location.hash = lastMainHash;
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) sheet.querySelector('[data-close]')?.click(); });
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#/jogo/"]');
  if (a) openedFromApp = true;
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
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800);
}

(async () => {
  M = await loadModel();
  window.addEventListener('hashchange', route);
  route();
})();

if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
