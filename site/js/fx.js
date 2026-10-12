// Efeitos: papel de parede, animações de entrada, contadores, inclinação 3D, brilhos.
import { thumb } from './ui.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

// ---------- papel de parede com troca suave ----------
let wallFront = 'wallA', wallCurrent = '';
export function setWall(url){
  if (!url || url === wallCurrent) return;
  wallCurrent = url;
  const src = thumb(url, 1280);
  const img = new Image();
  img.onload = () => {
    if (wallCurrent !== url) return;
    const back = wallFront === 'wallA' ? 'wallB' : 'wallA';
    const el = document.getElementById(back);
    el.style.backgroundImage = `url("${src}")`;
    el.classList.add('on');
    document.getElementById(wallFront).classList.remove('on');
    wallFront = back;
  };
  img.src = src;
}

// ---------- animações quando o bloco aparece ----------
const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    io.unobserve(e.target);
    play(e.target);
  }
}, { rootMargin: '0px 0px -8% 0px' }) : null;

function play(el){
  el.classList.add('in');
  el.querySelectorAll('[data-off]').forEach(c => c.style.strokeDashoffset = c.dataset.off);
  el.querySelectorAll('[data-w]').forEach(b => b.style.width = b.dataset.w + '%');
  el.querySelectorAll('[data-h]').forEach(b => b.style.height = b.dataset.h + '%');
  el.querySelectorAll('[data-count]').forEach(countUp);
}

export function animate(root){
  const targets = root.querySelectorAll('.reveal, .gcard, .ring, .pbar, [data-count], [data-w], [data-h]');
  for (const t of targets) io && !reduce ? io.observe(t) : play(t);
  if (finePointer && !reduce) tilt(root);
}

export function countUp(el){
  if (el.dataset.done) return;
  el.dataset.done = 1;
  const end = +el.dataset.count, dec = +(el.dataset.dec || 0);
  const fmt = v => v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (reduce || !end) { el.textContent = fmt(end); return; }
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

// ---------- troca de tela com transição ----------
export function transition(fn){
  if (!document.startViewTransition || reduce || document.hidden) return fn();
  try {
    const vt = document.startViewTransition(fn);
    // uma transição interrompida por outra navegação não é erro pra gente
    for (const p of [vt.ready, vt.finished, vt.updateCallbackDone]) p?.catch(() => {});
  } catch { fn(); }
}
