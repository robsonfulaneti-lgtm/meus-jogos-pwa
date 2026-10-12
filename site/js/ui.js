// Componentes visuais e formatadores compartilhados.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function fmtH(min){
  if (!min) return '0 h';
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return h >= 100 ? `${Math.round(h).toLocaleString('pt-BR')} h` : `${(Math.round(h * 10) / 10).toLocaleString('pt-BR')} h`;
}
export const fmtDate = (iso, opts = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', opts).replace('.', '') : '—';
export function fmtPct(r){
  if (r == null || isNaN(r)) return '—';
  const v = r < 10 ? r.toFixed(1) : String(Math.round(r));
  return v.replace('.', ',') + '%';
}
export const brl = n => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function relTime(iso){
  if (!iso) return '';
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 90) return 'agora há pouco';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  if (d < 30) return `há ${d} dia${d > 1 ? 's' : ''}`;
  const m = Math.round(d / 30);
  if (m < 12) return `há ${m} ${m > 1 ? 'meses' : 'mês'}`;
  const y = Math.round(d / 365);
  return `há ${y} ano${y > 1 ? 's' : ''}`;
}

// faixas de raridade iguais às da PSN
export function rarity(r){
  if (r == null) return null;
  if (r < 5) return { k: 'ultra', label: 'Ultra rara' };
  if (r < 15) return { k: 'very', label: 'Muito rara' };
  if (r < 50) return { k: 'rare', label: 'Rara' };
  return { k: 'common', label: 'Comum' };
}
export function diffInfo(d){
  if (d == null) return { color: 'var(--muted)', label: 'sem dados' };
  if (d <= 3) return { color: 'var(--good)', label: 'Tranquila' };
  if (d <= 5.5) return { color: 'var(--warn)', label: 'Moderada' };
  if (d <= 7.5) return { color: '#ff8a3d', label: 'Difícil' };
  return { color: 'var(--hot)', label: 'Muito difícil' };
}

// imagens da PSN aceitam redimensionamento por ?w=
export function thumb(url, w = 440){
  if (!url) return url;
  if (url.includes('image.api.playstation.com') && !url.includes('?')) return `${url}?w=${w}`;
  return url;
}

// arte com fundo desfocado (troféus de PS4 são paisagem, capas de PS5 são quadradas)
export function art(src, { alt = '', w = 440, cls = '', inner = '' } = {}){
  if (!src) return `<div class="art ${cls}"><div class="blur" style="background:linear-gradient(135deg,#1b2650,#0b0f1e)"></div>${inner}</div>`;
  const u = esc(thumb(src, w));
  return `<div class="art ${cls}"><div class="blur" style="background-image:url('${u}')"></div>` +
    `<img src="${u}" alt="${esc(alt)}" loading="lazy" decoding="async" onload="window.__artFit&&__artFit(this)" onerror="this.remove()">${inner}</div>`;
}
window.__artFit = img => { if (img.naturalWidth / img.naturalHeight > 1.25) img.classList.add('contain'); };

// ---------- troféu desenhado ----------
const METAL = {
  platinum: ['#ffffff', '#cfdcf2', '#7f95b9', '#eef4ff'],
  gold:     ['#fff4c7', '#f2c14e', '#a8741a', '#ffe08a'],
  silver:   ['#ffffff', '#cdd5e0', '#7d8796', '#eef2f7'],
  bronze:   ['#ffd9b8', '#d38b52', '#7a4320', '#f0b083'],
};
const CUP  = 'M14 6H50V22C50 34 42 42 32 42C22 42 14 34 14 22Z';
const STEM = 'M28 41h8l1.6 11H26.4Z';
const BASE = 'M18 52h28v7H18Z M14 59h36v8H14Z';
let uid = 0;
export function trophySVG(type = 'platinum', { shine = false } = {}){
  const [a, b, c, d] = METAL[type] || METAL.platinum;
  const id = `tr${++uid}`;
  return `<svg viewBox="0 0 64 72" aria-hidden="true">
  <defs>
    <linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".45" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>
    <linearGradient id="${id}h" x1="0" x2="1"><stop offset="0" stop-color="${c}"/><stop offset=".5" stop-color="${d}"/><stop offset="1" stop-color="${c}"/></linearGradient>
    ${shine ? `<linearGradient id="${id}s" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="${id}c"><path d="${CUP} ${STEM} ${BASE}"/></clipPath>` : ''}
  </defs>
  <path d="M15 11H8a4 4 0 0 0-4 4v2.5A12.5 12.5 0 0 0 16 30" fill="none" stroke="url(#${id}h)" stroke-width="4.2" stroke-linecap="round"/>
  <path d="M49 11h7a4 4 0 0 1 4 4v2.5A12.5 12.5 0 0 1 48 30" fill="none" stroke="url(#${id}h)" stroke-width="4.2" stroke-linecap="round"/>
  <path d="${CUP}" fill="url(#${id}m)"/>
  <rect x="14" y="6" width="36" height="3.6" rx="1.8" fill="${a}" opacity=".85"/>
  <path d="M20.5 13v9c0 7 3.4 12 8.5 14.5" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.6" stroke-linecap="round"/>
  <path d="${STEM}" fill="url(#${id}m)"/>
  <path d="M18 52h28v7H18Z" fill="url(#${id}m)"/>
  <path d="M14 59h36v8H14Z" fill="url(#${id}h)"/>
  ${type === 'platinum' ? `<path d="M32 15.5l2.1 5.2 5.2 2.1-5.2 2.1-2.1 5.2-2.1-5.2-5.2-2.1 5.2-2.1Z" fill="#fff" opacity=".95"/>` : ''}
  ${shine ? `<g clip-path="url(#${id}c)"><rect x="-40" y="0" width="20" height="72" fill="url(#${id}s)" transform="skewX(-20)"><animate attributeName="x" values="-40;100" dur="3.4s" repeatCount="indefinite"/></rect></g>` : ''}
</svg>`;
}

// ---------- anel de progresso ----------
export function ring(pct, { size = 46, th = 5, label = true, plat = false } = {}){
  const t = th / size * 100, R = 50 - t / 2, C = 2 * Math.PI * R;
  const off = C * (1 - Math.max(0, Math.min(100, pct || 0)) / 100);
  return `<div class="ring" style="--size:${size}px"><svg viewBox="0 0 100 100">` +
    `<circle class="bg" cx="50" cy="50" r="${R}" stroke-width="${t}"/>` +
    `<circle class="fg" cx="50" cy="50" r="${R}" stroke-width="${t}" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${off}" ${plat ? 'style="stroke:url(#ringPlat)"' : ''}/>` +
    `</svg>${label ? `<b>${Math.round(pct || 0)}%</b>` : ''}</div>`;
}

// ---------- card de jogo ----------
export function gameCard(g){
  const tro = g.trophies;
  const pct = tro?.progress ?? 0;
  const isPlat = g.status === 'platinum';
  const tags = [];
  const canWant = g.status === 'never' || g.status === 'started';
  if (canWant) tags.push(`<span class="tag wanttag">QUERO JOGAR</span>`);
  if (g.status === 'never') tags.push(`<span class="tag never">NUNCA JOGADO</span>`);
  else if (g.source === 'lista') tags.push(`<span class="tag list">MINHA LISTA</span>`);
  if (g.plus) tags.push(`<span class="tag plus">PLUS</span>`);
  const corner = isPlat
    ? `<span style="width:30px;height:34px;display:block;filter:drop-shadow(0 2px 6px rgba(0,0,0,.7))">${trophySVG('platinum')}</span>`
    : tro ? ring(pct, { size: 34, th: 4, label: false }) : '';
  const sub = [g.platforms?.slice(0, 2).join(' · ')];
  if (g.difficulty != null) sub.push(`<span style="color:${diffInfo(g.difficulty).color}">◆ ${String(g.difficulty).replace('.', ',')}</span>`);
  return `<a class="gcard ${isPlat ? 'is-plat' : ''} ${canWant && g.want ? 'wanted' : ''}" href="#/jogo/${encodeURIComponent(g.key)}" data-key="${esc(g.key)}" data-wall="${esc(g.hero || g.cover || '')}">
    ${art(g.cover, { alt: g.name, inner: `
      <div class="shade"></div>
      <div class="tl">${tags.join('')}</div>
      <div class="tr">${corner}</div>
      <div class="bl">${g.playMinutes ? `<span class="hrs">⏱ ${fmtH(g.playMinutes)}</span>` : g.hoursEst ? `<span class="hrs" style="opacity:.8">~${String(g.hoursEst).replace('.', ',')} h</span>` : ''}</div>
      ${canWant ? `<div class="br">${wantBtn(g)}</div>` : ''}` })}
    <div class="gname">${esc(g.name)}</div>
    <div class="gsub">${sub.filter(Boolean).join(' · ') || '&nbsp;'}</div>
    ${tro ? `<div class="pbar"><i data-w="${pct}"></i></div>` : ''}
  </a>`;
}

// botão "quero jogar" (é um span porque fica dentro do link do card)
export function wantBtn(g){
  return `<span class="want-btn ${g.want ? 'on' : ''}" role="button" tabindex="0" aria-pressed="${g.want}" title="Quero jogar" aria-label="Quero jogar ${esc(g.name)}" data-want="${esc(g.key)}">
    <svg class="i-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
    <svg class="i-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>`;
}
export const wantLabel = on => on ? '✓ Na lista "Quero jogar"' : '＋ Quero jogar';

// ícones de linha usados em vários lugares
export const ICON = {
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>',
  yt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9A28 28 0 0 0 2 12a28 28 0 0 0 .4 4.8 2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9A28 28 0 0 0 22 12a28 28 0 0 0-.4-4.8zM10 15.2V8.8l5.2 3.2z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2s5 4.5 5 10a5 5 0 0 1-10 0c0-2 1-3.6 2-4.6 0 2 1 3 2 3 0-3 1-5.8 1-8.4z"/></svg>',
};
