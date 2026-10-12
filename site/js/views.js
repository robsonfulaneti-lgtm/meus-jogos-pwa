// Telas do app. Cada uma devolve { html, wall, mount? }.
import { esc, fmtH, fmtDate, fmtPct, brl, relTime, rarity, diffInfo, art, trophySVG, ring, gameCard, ICON, thumb } from './ui.js';
import { saveOverride, watchAction, loadTrophies } from './data.js';
import { sparkles, animate, setWall } from './fx.js';

const num = n => String(n).replace('.', ',');
const by = {
  recent:   (a, b) => (b.lastPlayed || b.trophies?.updated || '').localeCompare(a.lastPlayed || a.trophies?.updated || ''),
  hours:    (a, b) => (b.playMinutes || 0) - (a.playMinutes || 0),
  progress: (a, b) => (b.trophies?.progress ?? -1) - (a.trophies?.progress ?? -1),
  rare:     (a, b) => (a.trophies?.plat?.rate ?? 999) - (b.trophies?.plat?.rate ?? 999),
  diff:     (a, b) => (b.difficulty ?? -1) - (a.difficulty ?? -1),
  name:     (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
};
const hasPlatDef = g => g.trophies?.defined?.platinum > 0;
const played = M => M.games.filter(g => g.source === 'psn' && g.status !== 'never');
const plats  = M => M.games.filter(g => g.status === 'platinum').sort((a, b) => (b.platEarnedAt || '').localeCompare(a.platEarnedAt || ''));
const isNear = g => g.status !== 'platinum' && hasPlatDef(g) && g.trophies.progress >= 50;
const near   = M => M.games.filter(isNear).sort(by.progress);
const queue  = M => M.games.filter(g => g.status === 'never').sort((a, b) => (a.source === 'lista') - (b.source === 'lista') || by.name(a, b));
const totalMinutes = M => M.games.reduce((s, g) => s + (g.playMinutes || 0), 0);
const pill = (icon, text) => `<span class="pill">${icon}${text}</span>`;

function avatar(p, cls = ''){
  return `<div class="avatar ${cls}">${p?.avatar ? `<img src="${esc(p.avatar)}" alt="">` : esc((p?.onlineId || '?')[0].toUpperCase())}</div>`;
}
function section(title, body, { count, href, cls = '' } = {}){
  return `<section class="section reveal ${cls}"><div class="section-head">
    <h2 class="section-title">${title}${count != null ? ` <span class="count">${count}</span>` : ''}</h2>
    ${href ? `<a class="see-all" href="${href}">Ver tudo →</a>` : ''}</div>${body}</section>`;
}
const rail = (title, list, href) => list.length
  ? section(title, `<div class="rail-row">${list.slice(0, 16).map(gameCard).join('')}</div>`, { count: list.length, href })
  : '';

function connectCard(){
  return `<section class="glass connect reveal" style="margin-top:22px">
    <h2 style="font-size:20px">Conecte sua PSN</h2>
    <ol>
      <li>No PC, entre em <b>playstation.com</b> com sua conta</li>
      <li>Na mesma aba, abra <code>ca.account.sony.com/api/v1/ssocookie</code> e copie o valor <b>npsso</b></li>
      <li>Cole em <code>sync/.env.local</code> e rode <code>npm run sync</code> dentro da pasta <code>sync</code></li>
    </ol>
    <div class="warn-box">Só leitura: o código fica no seu computador e nunca vai pro site. Enquanto isso, aparecem aqui sua lista antiga e os desejos.</div>
  </section>`;
}

// ================= INÍCIO =================
export function home(M){
  const p = M.profile;
  const pl = played(M).sort(by.recent);
  const feat = pl[0] || queue(M)[0];
  const e = p?.earned;
  const totalTro = e ? e.bronze + e.silver + e.gold + e.platinum : 0;
  const platCount = e?.platinum ?? plats(M).length;
  const never = M.games.filter(g => g.status === 'never').length;

  const hello = `<header class="hello reveal">${avatar(p)}<div>
    <div class="hello-name">Olá, ${esc(p?.onlineId || 'jogador')}</div>
    <div class="hello-sub">
      ${p ? `<span class="lvl"><i>★</i>Nível ${p.level}</span>` : ''}
      ${p?.isPlus ? '<span class="plus-badge">PLUS</span>' : ''}
      <span>${M.generatedAt ? `sincronizado ${relTime(M.generatedAt)}` : 'PSN ainda não conectada'}</span>
    </div></div></header>`;

  const stat = (ico, val, lbl, glow) => `<div class="glass stat reveal" style="--glow:${glow}">
    <div class="stat-ico">${ico}</div><div class="stat-num" data-count="${val}">0</div><div class="stat-lbl">${lbl}</div></div>`;

  return {
    wall: feat?.hero || feat?.cover,
    html: `
      ${hello}
      ${M.connected ? '' : connectCard()}
      ${feat ? heroCard(feat) : ''}
      <div class="stats">
        ${stat(trophySVG('platinum', { shine: true }), platCount, 'Platinas', 'rgba(200,220,255,.3)')}
        ${stat(trophySVG('gold'), totalTro, 'Troféus', 'rgba(242,193,78,.28)')}
        ${stat(`<span style="color:var(--accent-2);display:block;width:40px;height:40px">${ICON.clock}</span>`, Math.round(totalMinutes(M) / 60), 'Horas jogadas', 'rgba(0,209,255,.25)')}
        ${stat(`<span style="color:var(--warn);display:block;width:40px;height:40px">${ICON.book}</span>`, never, 'Nunca jogados', 'rgba(255,181,71,.28)')}
      </div>
      ${rail('Jogados recentemente', pl, '#/biblioteca?f=playing')}
      ${rail('Quase platinando', near(M), '#/biblioteca?f=near')}
      ${rail('Nunca jogados', queue(M), '#/biblioteca?f=never')}
      ${rail('Platinas recentes', plats(M), '#/platinas')}
    `,
  };
}

function heroCard(g){
  const t = g.trophies, di = diffInfo(g.difficulty);
  const eyebrow = g.status === 'never' ? 'Comece por aqui' : g.status === 'platinum' ? 'Platinado' : 'Continuar jogando';
  return `<a class="hero reveal" href="#/jogo/${encodeURIComponent(g.key)}">
    <div class="hero-bg" style="background-image:url('${esc(thumb(g.hero || g.cover, 1600))}')"></div>
    <div class="hero-shine"></div>
    <div class="hero-body">
      <div class="eyebrow"><span class="pulse"></span>${eyebrow}</div>
      ${g.logo ? `<img class="hero-logo" src="${esc(thumb(g.logo, 760))}" alt="${esc(g.name)}" onerror="this.nextElementSibling.hidden=false;this.remove()"><h1 class="hero-title" hidden>${esc(g.name)}</h1>`
               : `<h1 class="hero-title">${esc(g.name)}</h1>`}
      <div class="hero-meta">
        ${g.playMinutes ? pill(ICON.clock, `${fmtH(g.playMinutes)} jogadas`) : ''}
        ${t ? pill('', `${t.progress}% dos troféus`) : ''}
        ${g.difficulty != null ? pill('', `<span style="color:${di.color}">◆</span> Dificuldade ${num(g.difficulty)}/10`) : ''}
        ${t?.plat?.rate != null ? pill('', `${fmtPct(t.plat.rate)} platinaram`) : ''}
        ${g.status === 'never' && g.hoursEst ? pill(ICON.clock, `~${num(g.hoursEst)} h de campanha`) : ''}
      </div>
      <span class="btn">${ICON.play} ${g.status === 'platinum' ? 'Ver troféus' : 'Rumo à platina'}</span>
    </div>
    ${t ? `<div class="hero-ring">${ring(t.progress, { size: 96, th: 8, plat: g.status === 'platinum' })}</div>` : ''}
  </a>`;
}

// ================= BIBLIOTECA =================
const LIB = { f: 'all', q: '', s: 'recent', p: '' };
const FILTERS = [
  ['all',      'Todos',             () => true],
  ['never',    'Nunca jogados',     g => g.status === 'never'],
  ['playing',  'Em andamento',      g => g.status === 'playing' || g.status === 'started'],
  ['near',     'Quase platinando',  isNear],
  ['platinum', 'Platinados',        g => g.status === 'platinum'],
  ['complete', '100% sem platina',  g => g.status === 'complete'],
];
const SORTS = [['recent', 'Recentes'], ['hours', 'Mais jogados'], ['progress', 'Progresso'], ['rare', 'Platina mais rara'], ['diff', 'Mais difíceis'], ['name', 'Nome (A–Z)']];

function libList(M){
  const f = (FILTERS.find(x => x[0] === LIB.f) || FILTERS[0])[2];
  const q = LIB.q.trim().toLowerCase();
  return M.games
    .filter(f)
    .filter(g => !q || g.name.toLowerCase().includes(q))
    .filter(g => !LIB.p || g.platforms?.includes(LIB.p))
    .sort(by[LIB.s] || by.recent);
}

export function library(M, params){
  if (params.f) LIB.f = params.f;
  const plats = [...new Set(M.games.flatMap(g => g.platforms || []))].sort();
  const list = libList(M);
  return {
    wall: list[0]?.hero || list[0]?.cover,
    html: `
      <div class="page-head reveal"><div>
        <h1 class="page-title">Biblioteca</h1>
        <div class="page-sub">${M.games.length} jogos · ${fmtH(totalMinutes(M))} de jogo registradas</div>
      </div></div>
      <div class="glass toolbar">
        <label class="search">${ICON.search}<input id="libQ" type="search" placeholder="Buscar jogo…" value="${esc(LIB.q)}" autocomplete="off"></label>
        <select class="select" id="libS" aria-label="Ordenar">${SORTS.map(([v, l]) => `<option value="${v}" ${v === LIB.s ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select class="select" id="libP" aria-label="Plataforma"><option value="">Todas plataformas</option>${plats.map(p => `<option ${p === LIB.p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
        <div class="chips" id="libF">${FILTERS.map(([v, l, fn]) => `<button class="chip ${v === LIB.f ? 'on' : ''}" data-f="${v}">${l} <span>${M.games.filter(fn).length}</span></button>`).join('')}</div>
      </div>
      <div class="grid" id="libGrid"></div>`,
    mount(root){
      const grid = root.querySelector('#libGrid');
      const draw = () => {
        const l = libList(M);
        grid.innerHTML = l.length ? l.map(gameCard).join('') : `<div class="empty" style="grid-column:1/-1">Nada por aqui 👀</div>`;
        animate(grid);
        if (l[0]) setWall(l[0].hero || l[0].cover);
      };
      let t;
      root.querySelector('#libQ').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { LIB.q = e.target.value; draw(); }, 140); });
      root.querySelector('#libS').addEventListener('change', e => { LIB.s = e.target.value; draw(); });
      root.querySelector('#libP').addEventListener('change', e => { LIB.p = e.target.value; draw(); });
      root.querySelector('#libF').addEventListener('click', e => {
        const b = e.target.closest('.chip'); if (!b) return;
        LIB.f = b.dataset.f;
        root.querySelectorAll('#libF .chip').forEach(c => c.classList.toggle('on', c === b));
        history.replaceState(null, '', `#/biblioteca?f=${LIB.f}`);
        draw();
      });
      draw();
    },
  };
}

// ================= PLATINAS =================
export function platinas(M){
  const list = plats(M);
  const withRate = list.filter(g => g.trophies?.plat?.rate != null);
  const rarest = [...withRate].sort((a, b) => a.trophies.plat.rate - b.trophies.plat.rate)[0];
  const buckets = { ultra: 0, very: 0, rare: 0, common: 0 };
  withRate.forEach(g => buckets[rarity(g.trophies.plat.rate).k]++);
  const max = Math.max(1, ...Object.values(buckets));
  const labels = { ultra: 'Ultra raras <5%', very: 'Muito raras 5–15%', rare: 'Raras 15–50%', common: 'Comuns >50%' };
  const timed = list.filter(g => g.playMinutes > 0);
  const avgMin = timed.length ? timed.reduce((s, g) => s + g.playMinutes, 0) / timed.length : 0;
  const count = M.profile?.earned?.platinum ?? list.length;

  const years = {};
  for (const g of list) (years[(g.platEarnedAt || '').slice(0, 4) || '—'] ||= []).push(g);

  const pcard = g => {
    const r = g.trophies?.plat?.rate, rk = rarity(r);
    return `<a class="glass pcard reveal" href="#/jogo/${encodeURIComponent(g.key)}" data-wall="${esc(g.hero || g.cover || '')}">
      ${art(g.cover, { alt: g.name, w: 200 })}
      <div><div class="pcard-name">${esc(g.name)}${g.platCount > 1 ? ` <span class="tag" title="Platinado em ${g.platCount} versões" style="background:linear-gradient(135deg,#fff,#a9bddb);color:#0a0f1f;border:0;vertical-align:2px">×${g.platCount}</span>` : ''}</div>
      <div class="pcard-sub">${fmtDate(g.platEarnedAt)}${g.playMinutes ? ` · ${fmtH(g.playMinutes)}` : ''}${g.difficulty != null ? ` · ◆ ${num(g.difficulty)}` : ''}</div></div>
      <div class="rate ${rk ? 'r-' + rk.k : ''}">${fmtPct(r)}<small>${rk?.label || ''}</small></div></a>`;
  };

  return {
    wall: list[0]?.hero || list[0]?.cover,
    html: `
      <div class="page-head reveal"><div><h1 class="page-title">Estante de platinas</h1>
        <div class="page-sub">Cada platina com a % de jogadores no mundo que também conseguiram</div></div></div>
      <section class="glass trophy-hero reveal">
        <div class="big-trophy" id="bigTrophy">${trophySVG('platinum', { shine: true })}</div>
        <div>
          <div class="plat-count" data-count="${count}">0</div>
          <div style="color:var(--muted);font-weight:600;margin-top:4px">platinas conquistadas${count > list.length ? ` em ${list.length} jogos` : ''}${avgMin ? ` · média de ${fmtH(Math.round(avgMin))} por jogo` : ''}</div>
          ${count > list.length ? `<div style="color:var(--dim);font-size:12.5px;margin-top:4px">${list.filter(g => g.platCount > 1).length} jogos platinados no PS4 e no PS5 (marcados com ×2)</div>` : ''}
          ${rarest ? `<div style="margin-top:12px;font-size:14px">A mais rara: <b>${esc(rarest.name)}</b> — <span class="r-${rarity(rarest.trophies.plat.rate).k}" style="font-weight:800">${fmtPct(rarest.trophies.plat.rate)}</span> dos jogadores</div>` : ''}
          ${withRate.length ? `<div class="rarity-bars">${Object.keys(buckets).map(k => `
            <div class="rb"><span>${labels[k]}</span><div class="rb-track"><i class="bg-${k}" data-w="${buckets[k] / max * 100}"></i></div><b>${buckets[k]}</b></div>`).join('')}</div>` : ''}
        </div>
      </section>
      ${list.length ? Object.keys(years).sort().reverse().map(y => `
        <div class="year reveal">${y} · ${years[y].length}</div>
        <div class="plist">${years[y].map(pcard).join('')}</div>`).join('')
        : `<div class="empty">${M.connected ? 'Nenhuma platina ainda — bora começar!' : 'Conecte a PSN pra ver sua estante.'}</div>`}`,
    mount(root){ sparkles(root.querySelector('#bigTrophy'), 16); },
  };
}

// ================= LANÇAMENTOS =================
export function releases(M, params, ctx){
  const active = M.watch.filter(w => !w.removed && !w.bought);
  const total = active.reduce((s, w) => s + (w.price || 0), 0);
  const maxAdded = Math.max(1, ...M.watch.map(w => w.info?.added || 0), ...M.top.map(t => t.added || 0));
  const hype = added => added ? Math.max(4, Math.round(100 * Math.log10(added + 1) / Math.log10(maxAdded + 1))) : 0;
  const now = Date.now();
  const when = i => i?.released ? new Date(i.released).getTime() : (i?.tba ? 9e15 : 8e15);
  active.sort((a, b) => {
    const fa = when(a.info) > now, fb = when(b.info) > now;
    return (fb - fa) || when(a.info) - when(b.info);
  });

  const dateLine = i => {
    if (!i) return `<span>Data: ative o RAWG no sync</span>`;
    if (i.tba || !i.released) return `<span>Data a confirmar</span>`;
    const t = new Date(i.released).getTime(), days = Math.ceil((t - now) / 864e5);
    return days > 0
      ? `<span>Lança em ${fmtDate(i.released)}</span><span class="countdown">faltam ${days} dia${days > 1 ? 's' : ''}</span>`
      : `<span>Lançou em ${fmtDate(i.released)}</span><span class="countdown out">disponível</span>`;
  };
  const hypeBar = added => added ? `<div class="hype"><div class="hype-top"><span>${ICON.flame.replace('<svg', '<svg width="12" height="12" style="vertical-align:-1px"')} Hype</span><span>${hype(added)}/100</span></div>
    <div class="hype-track"><i data-w="${hype(added)}"></i></div></div>` : '';
  const score = i => i?.rating && i.released && new Date(i.released) < new Date()
    ? `<div class="wcard-date" style="margin-top:6px"><span style="color:var(--gold)">${ICON.star.replace('<svg', '<svg width="12" height="12" style="vertical-align:-1px"')} ${num(i.rating)}</span>${i.metacritic ? `<span>Metacritic ${i.metacritic}</span>` : ''}</div>` : '';

  const wcard = w => `<div class="glass wcard reveal" data-id="${esc(w.id)}" data-wall="${esc(w.info?.bg || w.cover || '')}">
    ${art(w.info?.bg && !w.cover ? w.info.bg : w.cover, { alt: w.name, w: 260 })}
    <div>
      <div class="wcard-name">${esc(w.name)}</div>
      <div class="wcard-date">${dateLine(w.info)}</div>
      ${score(w.info)}
      ${hypeBar(w.info?.added)}
      <div class="price ${w.price ? '' : 'none'}">${w.price ? brl(w.price) : 'sem preço definido'}</div>
      <div class="wactions">
        <button class="mini-btn" data-act="price">✏️ Preço</button>
        <button class="mini-btn good" data-act="bought">✔ Comprei</button>
        <button class="mini-btn bad" data-act="removed" aria-label="Remover">🗑</button>
      </div>
    </div></div>`;

  const topCard = (t, i) => `<div class="glass wcard reveal" data-wall="${esc(t.bg || '')}">
    <span class="rank">#${i + 1}</span>
    ${art(t.bg, { alt: t.name, w: 260 })}
    <div><div class="wcard-name">${esc(t.name)}</div>
      <div class="wcard-date">${dateLine(t)}</div>${hypeBar(t.added)}</div></div>`;

  const done = M.watch.filter(w => w.bought || w.removed);
  return {
    wall: active[0]?.info?.bg || active[0]?.cover,
    html: `
      <div class="page-head reveal"><div><h1 class="page-title">Lançamentos & desejos</h1>
        <div class="page-sub">O que vem por aí, quanto custa e quanto a internet está esperando</div></div></div>
      <section class="glass invest reveal">
        <div><div style="color:var(--muted);font-size:13px;font-weight:600">Total pra investir</div>
          <div class="invest-num">${brl(total)}</div></div>
        <div style="color:var(--muted);font-size:13px">${active.length} jogos na lista${active.filter(w => !w.price).length ? ` · ${active.filter(w => !w.price).length} sem preço` : ''}</div>
      </section>
      ${M.sources.rawg ? '' : `<div class="glass note reveal" style="margin-top:14px">
        <b>Ative datas, notas e hype:</b> crie uma chave grátis em <b>rawg.io/apidocs</b>, cole em <code>sync/.env.local</code> como <code>RAWG_API_KEY=</code> e rode o sync de novo.</div>`}
      ${section('Sua lista de desejos', `<div class="wl" id="wl">${active.map(wcard).join('')}</div>`, { count: active.length })}
      ${M.top.length ? section('Mais aguardados no PS5', `<div class="wl">${M.top.slice(0, 12).map(topCard).join('')}</div>`) : ''}
      ${done.length ? section('Comprados ou removidos', `<div class="kv">${done.map(w => `<button class="chip" data-undo="${esc(w.id)}" data-act="${w.bought ? 'bought' : 'removed'}">${w.bought ? '✔' : '🗑'} ${esc(w.name)} <span>desfazer</span></button>`).join('')}</div>`) : ''}`,
    mount(root){
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const id = b.dataset.undo || b.closest('[data-id]')?.dataset.id;
        const w = M.watch.find(x => x.id === id); if (!w) return;
        const act = b.dataset.act;
        if (act === 'price') {
          const raw = prompt(`Preço de ${w.name} (R$):`, w.price ? String(w.price).replace('.', ',') : '');
          if (raw == null) return;
          const v = parseFloat(raw.replace(/[R$\s.]/g, '').replace(',', '.'));
          if (isNaN(v) || v < 0) return ctx.toast('Valor inválido');
          watchAction(id, 'price', v); w.price = v; ctx.toast(`💰 ${w.name}: ${brl(v)}`);
        } else {
          if (!b.dataset.undo && act === 'removed' && !confirm(`Remover ${w.name} da lista?`)) return;
          watchAction(id, act); w[act] = !w[act];
          ctx.toast(b.dataset.undo ? 'Desfeito' : act === 'bought' ? `🛒 ${w.name} comprado!` : `${w.name} removido`);
        }
        ctx.rerender();
      });
    },
  };
}

// ================= PERFIL =================
const TIERS = ['', 'Bronze I', 'Bronze II', 'Bronze III', 'Prata I', 'Prata II', 'Prata III', 'Ouro I', 'Ouro II', 'Ouro III', 'Platina'];
export function profile(M){
  const p = M.profile;
  if (!p) return { html: `<div class="page-head"><h1 class="page-title">Perfil</h1></div>${connectCard()}` };
  const e = p.earned;
  const pl = played(M);
  const top = [...pl].sort(by.hours).filter(g => g.playMinutes > 0).slice(0, 8);
  const maxMin = top[0]?.playMinutes || 1;
  const withPlat = pl.filter(hasPlatDef);
  const platRate = withPlat.length ? Math.round(plats(M).length / withPlat.length * 100) : 0;
  const first = pl.map(g => g.firstPlayed).filter(Boolean).sort()[0];
  const byPlat = {};
  for (const g of pl) for (const x of g.platforms || []) byPlat[x] = (byPlat[x] || 0) + 1;
  const totalMin = totalMinutes(M);

  const tbox = (type, n, lbl) => `<div class="glass tbox reveal">${trophySVG(type, { shine: type === 'platinum' })}<div class="num" data-count="${n}">0</div><div class="lbl">${lbl}</div></div>`;
  const kv = (label, val) => `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);font-size:13.5px"><span style="color:var(--muted)">${label}</span><b>${val}</b></div>`;

  return {
    wall: top[0]?.hero || top[0]?.cover,
    html: `
      <section class="glass profile-top reveal">
        ${avatar(p, 'xl')}
        <div>
          <h1 class="pname">${esc(p.onlineId || 'Jogador')}</h1>
          <div class="hello-sub" style="margin-top:8px;justify-content:inherit">
            ${p.isPlus ? '<span class="plus-badge">PLUS</span>' : ''}<span>${esc(TIERS[p.tier] || '')}</span>
            ${M.generatedAt ? `<span>· sincronizado ${relTime(M.generatedAt)}</span>` : ''}
          </div>
          ${p.aboutMe ? `<p style="color:var(--muted);margin:10px 0 0;font-size:14px">${esc(p.aboutMe)}</p>` : ''}
          <div class="level-box">
            <div class="level-row"><span>Nível de troféus</span><b>${p.level}</b></div>
            <div class="level-track"><i data-w="${p.levelProgress}"></i></div>
            <div style="color:var(--dim);font-size:11.5px;margin-top:6px">${p.levelProgress}% para o nível ${p.level + 1}</div>
          </div>
        </div>
      </section>
      <div class="trophy-row">
        ${tbox('platinum', e.platinum, 'Platina')}${tbox('gold', e.gold, 'Ouro')}${tbox('silver', e.silver, 'Prata')}${tbox('bronze', e.bronze, 'Bronze')}
      </div>
      <div class="two section">
        <div class="glass panel reveal"><h3>${ICON.clock.replace('<svg', '<svg width="18" height="18"')} Mais jogados</h3>
          <div class="bars">${top.map(g => `<a class="bar-row" href="#/jogo/${encodeURIComponent(g.key)}">${art(g.cover, { w: 120 })}
            <div style="min-width:0"><div class="bar-name">${esc(g.name)}</div><div class="bar-track"><i data-w="${g.playMinutes / maxMin * 100}"></i></div></div>
            <div class="bar-val">${fmtH(g.playMinutes)}</div></a>`).join('') || '<div class="empty">Sem tempo registrado</div>'}</div></div>
        <div class="glass panel reveal"><h3>📊 Seus números</h3>
          ${kv('Horas jogadas (PS4/PS5)', fmtH(totalMin))}
          ${kv('Jogos na conta', M.games.filter(g => g.source === 'psn').length)}
          ${kv('Jogos iniciados', pl.length)}
          ${kv('Nunca jogados', M.games.filter(g => g.status === 'never').length)}
          ${kv('Taxa de platina', `${platRate}% dos jogos com platina`)}
          ${kv('Média por jogo', pl.length ? fmtH(Math.round(totalMin / Math.max(1, pl.filter(g => g.playMinutes).length))) : '—')}
          ${first ? kv('Jogando desde', fmtDate(first, { month: 'long', year: 'numeric' })) : ''}
          <div class="kv" style="margin-top:14px">${Object.entries(byPlat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="pill">${esc(k)} · ${v}</span>`).join('')}</div>
        </div>
      </div>`,
  };
}

// ================= DETALHE: RUMO À PLATINA =================
export function detail(M, g){
  const t = g.trophies, di = diffInfo(g.difficulty);
  const rate = t?.plat?.rate;
  const meter = Array.from({ length: 10 }, (_, i) => `<i style="${g.difficulty != null && i < Math.round(g.difficulty) ? `background:${di.color}` : ''}"></i>`).join('');
  const q = encodeURIComponent(g.name);
  const tags = [
    ...(g.platforms || []).map(p => `<span class="tag">${esc(p)}</span>`),
    g.status === 'never' ? '<span class="tag never">NUNCA JOGADO</span>' : '',
    g.status === 'platinum' ? '<span class="tag" style="background:linear-gradient(135deg,#fff,#a9bddb);color:#0a0f1f;border:0">PLATINADO</span>' : '',
    g.plus ? '<span class="tag plus">PLUS</span>' : '',
    g.source === 'lista' ? '<span class="tag list">MINHA LISTA</span>' : '',
  ].join('');

  return `
    <div class="d-banner"><div class="bg" style="background-image:url('${esc(thumb(g.hero || g.cover, 1600))}')"></div>
      <button class="d-close" data-close aria-label="Fechar">${ICON.close.replace('<svg', '<svg stroke="#fff" stroke-width="2.4"')}</button></div>
    <div class="d-head">${art(g.cover, { alt: g.name, w: 400 })}
      <div><h2 class="d-title">${esc(g.name)}</h2><div class="d-tags">${tags}</div></div></div>
    <div class="d-body">
      <div class="index">
        <div class="glass ix" id="ixDiff">
          <button class="ix-edit" data-edit="diff">editar</button>
          <div class="ix-lbl">Dificuldade</div>
          <div class="ix-val" style="color:${di.color}">${g.difficulty != null ? num(g.difficulty) : '—'}<small>/10</small></div>
          <div class="ix-meter">${meter}</div>
          <div class="ix-foot">${g.difficulty == null ? 'sem platina ou sem dados' : g.diffAuto != null && g.difficulty !== g.diffAuto ? `ajustada por você · estimativa ${num(g.diffAuto)}` : `${di.label} · estimada pela raridade da platina`}</div>
        </div>
        <div class="glass ix">
          <div class="ix-lbl">Jogadores com a platina</div>
          <div class="ix-val ${rate != null ? 'r-' + rarity(rate).k : ''}">${fmtPct(rate)}</div>
          <div class="ix-foot">${rate != null ? `${rarity(rate).label} · dado oficial da PSN, conta todo mundo que abriu o jogo` : t ? 'este jogo não tem platina' : 'aparece depois que você abrir o jogo'}</div>
        </div>
        <div class="glass ix" id="ixHours">
          <button class="ix-edit" data-edit="hours">editar</button>
          <div class="ix-lbl">Horas para platinar</div>
          <div class="ix-val">${g.hoursPlat != null ? num(g.hoursPlat) : '—'}<small>h</small></div>
          <div class="ix-foot">${g.hoursPlat != null ? 'sua estimativa' : 'defina olhando o guia abaixo'}${g.playMinutes ? ` · você já jogou ${fmtH(g.playMinutes)}` : ''}</div>
        </div>
      </div>

      ${t ? `<div class="glass journey">
        ${ring(t.progress, { size: 92, th: 8, plat: g.status === 'platinum' })}
        <div>
          <div class="tcounts">
            ${['platinum', 'gold', 'silver', 'bronze'].filter(k => t.defined?.[k]).map(k => `<span class="tc">${trophySVG(k)}${t.earned[k]}<small>/${t.defined[k]}</small></span>`).join('')}
          </div>
          <div class="jmeta">
            ${g.playMinutes ? `<span>Jogado <b>${fmtH(g.playMinutes)}</b></span>` : ''}
            ${g.firstPlayed ? `<span>Desde <b>${fmtDate(g.firstPlayed)}</b></span>` : ''}
            ${g.lastPlayed ? `<span>Última vez <b>${relTime(g.lastPlayed)}</b></span>` : ''}
            ${g.platEarnedAt ? `<span>Platinado em <b>${fmtDate(g.platEarnedAt)}</b></span>` : ''}
            ${t.rarest ? `<span>Troféu mais raro: <b>${esc(t.rarest.name)}</b> (${fmtPct(t.rarest.rate)})</span>` : ''}
          </div>
        </div></div>`
      : `<div class="glass note" style="margin-top:14px">${g.status === 'never'
          ? `Você ainda não abriu esse jogo${g.hoursEst ? ` — a campanha leva uns <b>${num(g.hoursEst)} h</b>` : ''}. Quando jogar e sincronizar, a lista de troféus e o caminho da platina aparecem aqui.`
          : 'Sem dados de troféus para este jogo.'}</div>`}

      <div class="guides">
        <a class="guide" target="_blank" rel="noopener" href="https://www.powerpyx.com/?s=${q}">${ICON.book} Guia PowerPyx</a>
        <a class="guide" target="_blank" rel="noopener" href="https://psnprofiles.com/search/guides?q=${q}">${ICON.book} Guias PSNProfiles</a>
        <a class="guide" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${q}+platinum+trophy+guide">${ICON.yt} Vídeo-guia</a>
      </div>

      <div class="road" id="road">${t ? '<div class="loading" style="margin-top:26px"></div>' : ''}</div>
    </div>`;
}

export function mountDetail(panel, M, g, ctx){
  const banner = panel.querySelector('.d-banner .bg');
  panel.addEventListener('scroll', () => banner && banner.style.setProperty('--par', `${panel.scrollTop * .35}px`), { passive: true });

  panel.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
    const kind = b.dataset.edit, box = b.parentElement;
    if (box.querySelector('.ix-form')) return;
    const cur = kind === 'diff' ? (g.difficulty ?? 5) : (g.hoursPlat ?? '');
    const f = document.createElement('div');
    f.className = 'ix-form';
    f.innerHTML = kind === 'diff'
      ? `<input type="range" min="1" max="10" step="0.5" value="${cur}"><b style="min-width:30px">${num(cur)}</b><button class="mini-btn">OK</button><button class="mini-btn" data-reset title="Voltar à estimativa">↺</button>`
      : `<input type="number" min="0" step="1" inputmode="numeric" placeholder="ex: 40" value="${cur}"><button class="mini-btn">OK</button><button class="mini-btn" data-reset title="Limpar">↺</button>`;
    box.appendChild(f);
    const inp = f.querySelector('input');
    if (kind === 'diff') inp.addEventListener('input', () => f.querySelector('b').textContent = num(inp.value));
    f.querySelector('.mini-btn:not([data-reset])').addEventListener('click', () => {
      const v = parseFloat(inp.value);
      if (isNaN(v)) return;
      saveOverride(g.key, kind === 'diff' ? { diff: v } : { hours: v });
      kind === 'diff' ? g.difficulty = v : g.hoursPlat = v;
      ctx.toast('Salvo ✔'); ctx.reopen();
    });
    f.querySelector('[data-reset]').addEventListener('click', () => {
      saveOverride(g.key, kind === 'diff' ? { diff: null } : { hours: null });
      kind === 'diff' ? g.difficulty = g.diffAuto : delete g.hoursPlat;
      ctx.reopen();
    });
    inp.focus();
  }));

  if (g.trophies) loadTrophies(g.trophies.id).then(list => {
    const road = panel.querySelector('#road');
    if (!road) return;
    road.innerHTML = list?.length ? roadmap(list, g) : '<div class="glass note" style="margin-top:20px">Não achei a lista de troféus desse jogo — rode o sync de novo.</div>';
    road.addEventListener('click', e => {
      const h = e.target.closest('.hidden-t'); if (h) h.classList.toggle('show');
      const m = e.target.closest('[data-more]');
      if (m) { m.previousElementSibling.querySelectorAll('.tro[hidden]').forEach(x => x.hidden = false); m.remove(); }
    });
    animate(road);
  });
}

function troRow(x, step){
  const rk = rarity(x.r);
  const secret = x.h && !x.e;
  return `<div class="tro ${x.e ? 'got' : ''} ${secret ? 'hidden-t' : ''}">
    <div class="tro-ic">${x.ic ? `<img src="${esc(x.ic)}" alt="" loading="lazy">` : ''}<span class="tro-type">${trophySVG(x.ty)}</span></div>
    <div style="min-width:0">
      <div class="tro-name">${step ? `<span class="step">${step}</span>` : ''}<span>${esc(x.n || 'Troféu oculto')}</span>${x.g && x.g !== 'default' ? '<em class="dlc">DLC</em>' : ''}</div>
      <div class="tro-desc">${secret ? 'Troféu oculto — toque para revelar · ' : ''}${esc(x.d || '')}${x.e && x.at ? ` · conquistado em ${fmtDate(x.at)}` : ''}</div>
    </div>
    <div class="tro-rate ${rk ? 'r-' + rk.k : ''}">${fmtPct(x.r)}<small>${rk?.label || ''}</small></div>
  </div>`;
}

function roadmap(list, g){
  const plat = list.find(x => x.ty === 'platinum');
  const pending = list.filter(x => !x.e && x.ty !== 'platinum').sort((a, b) => (b.r ?? -1) - (a.r ?? -1));
  const done = list.filter(x => x.e && x.ty !== 'platinum').sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const base = pending.filter(x => !x.g || x.g === 'default');
  const next = base.slice(0, 5);
  const rest = pending.filter(x => !next.includes(x));
  const goal = plat
    ? `<div class="goal">${trophySVG('platinum', { shine: true })}<div>
        <div style="font-size:11.5px;letter-spacing:1px;font-weight:700;color:var(--muted);text-transform:uppercase">${plat.e ? 'Conquistada' : 'Objetivo'}</div>
        <div style="font-family:var(--display);font-weight:800;font-size:19px;margin-top:4px">${esc(plat.n)}</div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">${plat.e ? `Platinado em ${fmtDate(plat.at)} — você está entre os ${fmtPct(plat.r)} que conseguiram` : `${base.length} troféus do jogo base faltando · ${fmtPct(plat.r)} dos jogadores chegaram lá`}</div>
      </div></div>`
    : `<div class="goal">${trophySVG('gold', { shine: true })}<div><div style="font-family:var(--display);font-weight:800;font-size:18px">Sem platina — objetivo é 100%</div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">${pending.length} troféus faltando</div></div></div>`;

  return `
    <h3>🧭 Rumo à platina</h3>
    ${goal}
    ${next.length ? `<h3>Próximos passos <span class="count">ordem sugerida: dos mais comuns aos mais raros</span></h3>
      <div>${next.map((x, i) => troRow(x, i + 1)).join('')}</div>` : ''}
    ${rest.length ? `<h3>Restantes <span class="count">${rest.length}</span></h3>
      <div>${rest.map((x, i) => troRow(x).replace('<div class="tro', i >= 12 ? '<div hidden class="tro' : '<div class="tro')).join('')}</div>
      ${rest.length > 12 ? `<button class="mini-btn more" data-more>Mostrar mais ${rest.length - 12}</button>` : ''}` : ''}
    ${done.length ? `<details style="margin-top:24px"><summary style="cursor:pointer;font-family:var(--display);font-weight:700;font-size:16px">✔ Conquistados <span class="count" style="color:var(--muted);font-size:12px">${done.length}</span></summary>
      <div style="margin-top:10px">${done.map(x => troRow(x)).join('')}</div></details>` : ''}`;
}
