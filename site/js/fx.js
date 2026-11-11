// Efeitos: papel de parede, animações de entrada, contadores, inclinação 3D, brilhos.
import { thumb } from './ui.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
// celular: mesmos efeitos, só que sem o que redesenha a tela inteira a cada quadro (ver app.css)
export const lite = matchMedia('(hover: none), (pointer: coarse)').matches;

// ---------- papel de parede com troca suave ----------
let wallFront = 'wallA', wallCurrent = '';
export function setWall(url){
  if (!url || url === wallCurrent) return;
  wallCurrent = url;
  const src = thumb(url, lite ? 320 : 1280);
  const img = new Image();
  img.onload = () => {
    if (wallCurrent !== url) return;
    const back = wallFront === 'wallA' ? 'wallB' : 'wallA';
    const el = document.getElementById(back);
    if (lite) el.replaceChildren(blurred(img));
    else el.style.backgroundImage = `url("${src}")`;
    el.classList.add('on');
    document.getElementById(wallFront).classList.remove('on');
    wallFront = back;
  };
  img.src = src;
}

// no celular o desfoque é feito uma vez só, numa cópia pequena da imagem (esticada ela fica lisa);
// filtro de desfoque na tela inteira custa a cada quadro enquanto rola
function blurred(img){
  const c = document.createElement('canvas'), w = 96;
  const h = Math.max(1, Math.round(w * img.naturalHeight / img.naturalWidth)) || 54;
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  if ('filter' in x) x.filter = 'blur(7px) saturate(1.35) brightness(.42)';
  x.drawImage(img, -14, -14, w + 28, h + 28);
  if (!('filter' in x)) { x.fillStyle = 'rgba(5,6,11,.58)'; x.fillRect(0, 0, w, h); }
  return c;
}

// ---------- animações quando o bloco aparece ----------
const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    io.unobserve(e.target);
    watched.delete(e.target);
    play(e.target);
  }
}, { rootMargin: '0px 0px -8% 0px' }) : null;
// o que ainda espera aparecer; blocos de telas que já saíram são soltos (senão ficavam presos na memória)
const watched = new Set();

function play(el){
  el.classList.add('in');
  el.querySelectorAll('[data-off]').forEach(c => c.style.strokeDashoffset = c.dataset.off);
  el.querySelectorAll('[data-w]').forEach(b => b.style.width = b.dataset.w + '%');
  el.querySelectorAll('[data-h]').forEach(b => b.style.height = b.dataset.h + '%');
  el.querySelectorAll('[data-count]').forEach(countUp);
}

// instant = redesenho da mesma tela: tudo já aparece no estado final, sem animar de novo
export function animate(root, instant = false){
  const targets = root.querySelectorAll('.reveal, .gcard, .ring, .pbar, [data-count], [data-w], [data-h]');
  for (const t of watched) if (!t.isConnected) { io.unobserve(t); watched.delete(t); }
  for (const t of targets) {
    if (instant || !io || reduce) play(t);
    else { io.observe(t); watched.add(t); }
  }
  if (finePointer && !reduce) tilt(root);
}

export function countUp(el){
  if (el.dataset.done) return;
  el.dataset.done = 1;
  const end = +el.dataset.count, dec = +(el.dataset.dec || 0);
  const fmt = v => v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (reduce || !end || el.closest('.instant')) { el.textContent = fmt(end); return; }
  const t0 = performance.now(), dur = 1200 + Math.min(800, end * 2);
  const step = t => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
    el.textContent = fmt(end * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- inclinação 3D com reflexo seguindo o mouse ----------
function tilt(root){
  root.querySelectorAll('.gcard:not([data-tilt])').forEach(card => {
    card.dataset.tilt = 1;
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--tx', `${(x - .5) * 14}deg`);
      card.style.setProperty('--ty', `${(.5 - y) * 14}deg`);
      card.style.setProperty('--gx', `${x * 100}%`);
      card.style.setProperty('--gy', `${y * 100}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--tx', '0deg');
      card.style.setProperty('--ty', '0deg');
    });
  });
}

// ---------- brilhos ao redor do troféu ----------
export function sparkles(host, n = 14){
  if (reduce) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.className = 'spark';
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 60;
    s.style.left = `calc(50% + ${Math.cos(a) * d}px)`;
    s.style.top = `calc(48% + ${Math.sin(a) * d}px)`;
    s.style.animationDelay = `${Math.random() * 2.4}s`;
    s.style.transform = `scale(${.5 + Math.random()})`;
    host.appendChild(s);
  }
}

// ---------- confete (jogo zerado) ----------
export function confetti(x = innerWidth / 2, y = innerHeight / 2){
  if (reduce) return;
  const colors = ['#3d8bff', '#00d1ff', '#ffffff', '#f2c14e', '#3ddc97', '#b388ff'];
  const layer = document.createElement('div');
  layer.className = 'confetti';
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('i');
    const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 260;
    p.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]};` +
      `--dx:${Math.cos(a) * v}px;--dy:${Math.sin(a) * v - 140}px;--r:${Math.random() * 720 - 360}deg;` +
      `animation-delay:${Math.random() * 80}ms;width:${6 + Math.random() * 6}px;height:${8 + Math.random() * 8}px`;
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1700);
}

// ---------- troca de tela com transição ----------
export function transition(fn){
  // no celular a troca de tela é na hora: a transição tira foto da tela inteira e engasga
  if (!document.startViewTransition || reduce || lite || document.hidden) return fn();
  let done = false;
  const run = () => { if (!done) { done = true; fn(); } };
  try {
    const vt = document.startViewTransition(run);
    // uma transição interrompida por outra navegação não é erro pra gente
    for (const p of [vt.ready, vt.finished, vt.updateCallbackDone]) p?.catch(() => {});
    // se o navegador não pintar a tempo (aparelho lento, aba em segundo plano), troca sem animar
    setTimeout(() => { if (!done) { vt.skipTransition?.(); run(); } }, 350);
  } catch { run(); }
}
