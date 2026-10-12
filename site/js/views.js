// Telas do app. Cada uma devolve { html, wall, mount? }.
import { esc, fmtH, fmtDate, fmtPct, brl, relTime, rarity, diffInfo, art, trophySVG, ring, gameCard, ICON, thumb, wantLabel } from './ui.js';
import { saveOverride, watchAction, loadTrophies, zerarEstimate } from './data.js';
import { sparkles, animate, setWall } from './fx.js';
import { buildFolders } from './folders.js';

const num = n => String(n).replace('.', ',');
const by = {
  recent:   (a, b) => (b.lastPlayed || b.trophies?.updated || '').localeCompare(a.lastPlayed || a.trophies?.updated || ''),
  hours:    (a, b) => (b.playMinutes || 0) - (a.playMinutes || 0),
  progress: (a, b) => (b.trophies?.progress ?? -1) - (a.trophies?.progress ?? -1),
  rare:     (a, b) => (a.trophies?.plat?.rate ?? 999) - (b.trophies?.plat?.rate ?? 999),
  diff:     (a, b) => (b.difficulty ?? -1) - (a.difficulty ?? -1),
  name:     (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
  // quanto falta pra zerar (sem estimativa vai pro fim)
  ttb:      (a, b) => (a.zerarFalta ?? 1e9) - (b.zerarFalta ?? 1e9) || a.name.localeCompare(b.name, 'pt-BR'),
  want:     (a, b) => (b.wantAt || 0) - (a.wantAt || 0),
  zerado:   (a, b) => (b.zeradoDate || 0) - (a.zeradoDate || 0),
};
const hasPlatDef = g => g.trophies?.defined?.platinum > 0;
// listas usam M.games (sem os ocultos); números da conta usam M.all
const isPlayed = g => g.source === 'psn' && g.status !== 'never';
const played = M => M.games.filter(isPlayed);
const plats  = M => M.all.filter(g => g.status === 'platinum').sort((a, b) => (b.platEarnedAt || '').localeCompare(a.platEarnedAt || ''));
const isNear = g => g.status !== 'platinum' && hasPlatDef(g) && g.trophies.progress >= 50;
const near   = M => M.games.filter(isNear).sort(by.progress);
const isNever = g => g.status === 'never' && !g.zerado;
const queue  = M => M.games.filter(isNever).sort((a, b) => b.want - a.want || (a.source === 'lista') - (b.source === 'lista') || by.name(a, b));
const canZerar = g => !g.zerado;
const isWanted = g => g.want && !g.zerado;
const wanted = M => M.games.filter(isWanted).sort((a, b) => b.wantAt - a.wantAt);
const totalMinutes = M => M.all.reduce((s, g) => s + (g.playMinutes || 0), 0);
const pill = (icon, text) => `<span class="pill">${icon}${text}</span>`;

function avatar(p, cls = ''){
  return `<div class="avatar ${cls}">${p?.avatar ? `<img src="${esc(p.avatar)}" alt="">` : esc((p?.onlineId || '?')[0].toUpperCase())}</div>`;
}
function section(title, body, { count, href, cls = '', sub = '' } = {}){
  return `<section class="section reveal ${cls}"><div class="section-head">
    <div><h2 class="section-title">${title}${count != null ? ` <span class="count">${count}</span>` : ''}</h2>
    ${sub ? `<div class="page-sub" style="margin-top:4px">${sub}</div>` : ''}</div>
    ${href ? `<a class="see-all" href="${href}">Ver tudo →</a>` : ''}</div>${body}</section>`;
}
const rail = (title, list, href, sub) => list.length
  ? section(title, `<div class="rail-row">${list.slice(0, 16).map(gameCard).join('')}</div>`, { count: list.length, href, sub })
  : '';
const wantRail = M => rail('⭐ Quero zerar', wanted(M), '#/biblioteca?f=want', 'Os jogos que você escolheu terminar');

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
  const never = queue(M).length;
  const folders = buildFolders(M);

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
      ${retroTeaser(M)}
      ${rail('Jogados recentemente', pl, '#/biblioteca?f=playing')}
      <div id="wantSlot">${wantRail(M)}</div>
      ${folders.length ? section('📁 Suas séries', `<div class="rail-row wide">${folders.slice(0, 12).map(folderCard).join('')}</div>`,
        { count: folders.length, href: '#/biblioteca?f=pastas', sub: 'Jogos do mesmo mundo, juntos numa pasta' }) : ''}
      ${rail('Quase platinando', near(M))}
      ${rail('Nunca jogados', queue(M), '#/biblioteca?f=never', 'Toque no ＋ pra colocar em "Quero zerar"')}
      ${rail('Platinas recentes', plats(M), '#/platinas')}
    `,
    mount(root, ctx){
      ctx.onWant = () => {
        const slot = root.querySelector('#wantSlot');
        slot.innerHTML = wantRail(M);
        animate(slot);
      };
    },
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
// cada aba lembra a sua ordenação (Quero zerar e Nunca jogados começam pelo mais rápido de zerar)
const LIB = { f: 'all', q: '', p: '', edit: false,
  sortBy: { all: 'recent', want: 'ttb', playing: 'recent', zerados: 'zerado', never: 'ttb', hidden: 'name' } };
const curSort = () => LIB.sortBy[LIB.f] || 'recent';
const TABS = [
  ['all',     'Todos',          () => true,                                                            'Tudo que está na sua conta, mais a sua lista antiga'],
  ['want',    '⭐ Quero zerar',  isWanted,                                                              'Os jogos que você escolheu terminar — toque no ＋ de qualquer jogo pra adicionar aqui'],
  ['playing', 'Jogando',        g => (g.status === 'playing' || g.status === 'started') && !g.zerado,  'Já abriu e ainda não zerou'],
  ['zerados', '✅ Zerados',      g => g.zerado,                                                         'Platinados e 100% entram sozinhos. Também marquei os jogos com mais de 3 h (ou com troféu de fim de história). Não zerou algum? Toque no ✓ verde do card pra tirar.'],
  ['never',   'Nunca jogados',  isNever,                                                               'Estão na sua conta, mas você nunca abriu'],
  ['pastas',  '📁 Pastas',       null,                                                                  'Jogos do mesmo mundo juntos — toque numa pasta pra abrir'],
];
const SORTS = [['ttb', '⏳ Mais rápido de zerar'], ['recent', 'Jogados recentemente'], ['want', 'Ordem em que escolhi'], ['zerado', 'Zerados por data'],
  ['hours', 'Mais jogados'], ['progress', 'Mais perto da platina'], ['rare', 'Platina mais rara'], ['diff', 'Mais difíceis'], ['name', 'Nome (A–Z)']];
// "Nunca jogados" separado pela origem, pra não misturar o que você comprou com o que veio no Plus
const NEVER_GROUPS = [
  ['🛒 Comprados por você', g => g.source === 'psn' && !g.plus],
  ['➕ Resgatados no PS Plus', g => g.source === 'psn' && g.plus],
  ['📝 Da sua lista antiga', g => g.source === 'lista'],
];

function libList(M){
  const q = LIB.q.trim().toLowerCase();
  const base = LIB.f === 'hidden' ? M.hiddenGames : M.games.filter((TABS.find(x => x[0] === LIB.f) || TABS[0])[2] || (() => true));
  const sort = by[curSort()] || by.recent;
  return base
    .filter(g => !q || g.name.toLowerCase().includes(q))
    .filter(g => !LIB.p || g.platforms?.includes(LIB.p))
    .sort(sort);
}
const tabCount = (M, v) => v === 'pastas' ? buildFolders(M).length : M.games.filter(TABS.find(t => t[0] === v)[2]).length;

export function library(M, params){
  if (params.f) LIB.f = TABS.some(t => t[0] === params.f) ? params.f : 'all';
  if (LIB.f === 'hidden' && !M.hiddenGames.length) LIB.f = 'all';
  const plats = [...new Set(M.games.flatMap(g => g.platforms || []))].sort();
  const list = LIB.f === 'pastas' ? [] : libList(M);
  const tab = ([v, l]) => `<button class="lib-tab ${v === 'want' ? 'want' : ''} ${v === LIB.f ? 'on' : ''}" data-f="${v}" role="tab" aria-selected="${v === LIB.f}">${l} <b>${tabCount(M, v)}</b></button>`;
  const opt = (group, v, l, cur) => `<button class="chip ${v === cur ? 'on' : ''}" data-${group}="${esc(v)}">${esc(l)}</button>`;
  return {
    wall: list[0]?.hero || list[0]?.cover,
    html: `
      <div class="page-head reveal"><div>
        <h1 class="page-title">Biblioteca</h1>
        <div class="page-sub">${M.games.length} jogos${M.hiddenGames.length ? ` · ${M.hiddenGames.length} ocultos` : ''} · ${fmtH(totalMinutes(M))} de jogo registradas</div>
      </div></div>
      <div class="lib-tabs" id="libF" role="tablist">${TABS.map(tab).join('')}</div>
      <div class="lib-bar">
        <label class="search">${ICON.search}<input id="libQ" type="search" placeholder="Buscar jogo…" value="${esc(LIB.q)}" autocomplete="off"></label>
        <button class="icon-btn" id="libOpts" aria-expanded="false" aria-controls="libPanel" title="Ordenar e filtrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
          <span class="dot" ${LIB.p ? '' : 'hidden'}></span>
        </button>
        <button class="icon-btn ${LIB.edit ? 'on' : ''}" id="libEdit" aria-pressed="${LIB.edit}" title="Organizar: ocultar jogos">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7a14 14 0 0 1-3.1 4.3M6.6 6.6A14 14 0 0 0 2 12c1 2.5 5 7 10 7a9.6 9.6 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
        </button>
      </div>
      <div class="edit-bar glass" id="editBar" ${LIB.edit || LIB.f === 'hidden' ? '' : 'hidden'}>
        <span id="editMsg"></span>
        <span style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="mini-btn" id="seeHidden">${LIB.f === 'hidden' ? '← Voltar' : `🙈 Ver ocultos (${M.hiddenGames.length})`}</button>
          <button class="mini-btn good" id="editDone">Concluir</button>
        </span>
      </div>
      <div class="glass lib-opts" id="libPanel" hidden>
        <div><div class="ix-lbl" style="margin-bottom:8px">Ordenar por</div>
          <div class="chips" id="libS">${SORTS.map(([v, l]) => opt('s', v, l, curSort())).join('')}</div></div>
        <div><div class="ix-lbl" style="margin-bottom:8px">Plataforma</div>
          <div class="chips" id="libP">${opt('p', '', 'Todas', LIB.p)}${plats.map(p => opt('p', p, p, LIB.p)).join('')}</div></div>
      </div>
      <p class="lib-hint" id="libHint"></p>
      <div id="libGrid"></div>`,
    mount(root, ctx){
      const box = root.querySelector('#libGrid');
      const counts = () => root.querySelectorAll('#libF .lib-tab').forEach(c => {
        c.querySelector('b').textContent = tabCount(M, c.dataset.f);
      });
      // marcar/desmarcar "quero zerar" atualiza os contadores e a lista
      ctx.onWant = () => { counts(); if (LIB.f === 'want') draw(); };

      const grid = l => `<div class="grid">${l.map(gameCard).join('')}</div>`;
      const editBar = root.querySelector('#editBar');
      const draw = () => {
        const hiddenMode = LIB.f === 'hidden';
        // no modo organizar (ou vendo os ocultos), tocar no card oculta/mostra — tratado no app.js
        box.className = LIB.edit || hiddenMode ? `lib-editing ${hiddenMode ? 'show-mode' : 'hide-mode'}` : '';
        editBar.hidden = !(LIB.edit || hiddenMode);
        root.querySelector('#editMsg').innerHTML = hiddenMode
          ? '👁 Toque num jogo pra <b>mostrar de novo</b> na biblioteca'
          : '🙈 Toque nos jogos que você <b>não quer ver</b> — eles somem das listas (dá pra trazer de volta)';
        root.querySelector('#libHint').textContent = hiddenMode ? 'Jogos que você ocultou' : (TABS.find(t => t[0] === LIB.f)?.[3] || '');

        if (LIB.f === 'pastas') {
          const q = LIB.q.trim().toLowerCase();
          const fs = buildFolders(M).filter(f => !q || f.name.toLowerCase().includes(q) || f.games.some(g => g.name.toLowerCase().includes(q)));
          box.innerHTML = fs.length ? `<div class="folders">${fs.map(folderCard).join('')}</div>` : '<div class="empty">Nenhuma pasta encontrada</div>';
          animate(box);
          if (fs[0]) setWall(fs[0].hero);
          return;
        }
        const l = libList(M);
        if (!l.length) {
          box.innerHTML = `<div class="empty">${LIB.f === 'want' && !LIB.q
            ? '⭐ Nada em "Quero zerar" ainda.<br>Toque no <b>＋</b> no canto de qualquer jogo que você quer terminar.'
            : LIB.f === 'zerados' && !LIB.q
            ? '✅ Nenhum jogo zerado ainda.<br>Abra um jogo e toque em <b>"Marcar como zerado"</b> — platinados entram sozinhos.'
            : 'Nada por aqui 👀'}</div>`;
        } else if (LIB.f === 'never') {
          box.innerHTML = NEVER_GROUPS.map(([title, fn]) => {
            const part = l.filter(fn);
            return part.length ? `<section class="lib-group"><h3>${title} <span class="count">${part.length}</span></h3>${grid(part)}</section>` : '';
          }).join('');
        } else {
          box.innerHTML = grid(l);
        }
        animate(box);
        if (l[0]) setWall(l[0].hero || l[0].cover);
      };

      let t;
      root.querySelector('#libQ').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { LIB.q = e.target.value; draw(); }, 140); });
      const panel = root.querySelector('#libPanel'), optsBtn = root.querySelector('#libOpts');
      optsBtn.addEventListener('click', () => {
        panel.hidden = !panel.hidden;
        optsBtn.setAttribute('aria-expanded', !panel.hidden);
      });
      panel.addEventListener('click', e => {
        const b = e.target.closest('.chip'); if (!b) return;
        if ('s' in b.dataset) LIB.sortBy[LIB.f] = b.dataset.s; else LIB.p = b.dataset.p;
        b.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
        optsBtn.querySelector('.dot').hidden = !LIB.p;
        draw();
      });
      const selectTab = v => {
        LIB.f = v;
        root.querySelectorAll('#libS .chip').forEach(c => c.classList.toggle('on', c.dataset.s === curSort()));
        root.querySelectorAll('#libF .lib-tab').forEach(c => { c.classList.toggle('on', c.dataset.f === v); c.setAttribute('aria-selected', c.dataset.f === v); });
        draw();
      };
      root.querySelector('#libF').addEventListener('click', e => {
        const b = e.target.closest('.lib-tab'); if (b) selectTab(b.dataset.f);
      });
      const editBtn = root.querySelector('#libEdit');
      const setEdit = on => {
        LIB.edit = on;
        editBtn.classList.toggle('on', on);
        editBtn.setAttribute('aria-pressed', on);
      };
      editBtn.addEventListener('click', () => { setEdit(!LIB.edit); if (!LIB.edit && LIB.f === 'hidden') LIB.f = 'all'; selectTab(LIB.f); });
      root.querySelector('#editDone').addEventListener('click', () => { setEdit(false); selectTab(LIB.f === 'hidden' ? 'all' : LIB.f); });
      root.querySelector('#seeHidden').addEventListener('click', () => {
        if (LIB.f === 'hidden') { selectTab('all'); return; }
        if (!M.hiddenGames.length) return ctx.toast('Nenhum jogo oculto');
        selectTab('hidden');
      });
      draw();
    },
  };
}

// ================= PLATINAS =================
// uma entrada por platina conquistada (PS4 e PS5 do mesmo jogo ficam separadas, cada uma no seu ano)
export const platEntries = M => plats(M).flatMap(g =>
  (g.plats?.length ? g.plats : [{ at: g.platEarnedAt, rate: g.trophies?.plat?.rate, platform: g.platforms?.[0] }])
    .map(p => ({ g, ...p }))
).sort((a, b) => (b.at || '').localeCompare(a.at || ''));

export function platinas(M){
  const list = platEntries(M);
  const games = new Set(list.map(e => e.g.key)).size;
  const withRate = list.filter(e => e.rate != null);
  const rarest = [...withRate].sort((a, b) => a.rate - b.rate)[0];
  const buckets = { ultra: 0, very: 0, rare: 0, common: 0 };
  withRate.forEach(e => buckets[rarity(e.rate).k]++);
  const max = Math.max(1, ...Object.values(buckets));
  const labels = { ultra: 'Ultra raras <5%', very: 'Muito raras 5–15%', rare: 'Raras 15–50%', common: 'Comuns >50%' };
  const timed = plats(M).filter(g => g.playMinutes > 0);
  const avgMin = timed.length ? timed.reduce((s, g) => s + g.playMinutes, 0) / timed.length : 0;
  const count = M.profile?.earned?.platinum ?? list.length;
  const doubles = plats(M).filter(g => (g.plats?.length || 0) > 1).length;

  const years = {};
  for (const e of list) (years[(e.at || '').slice(0, 4) || '—'] ||= []).push(e);

  const pcard = ({ g, at, rate, platform }) => {
    const rk = rarity(rate);
    const multi = (g.plats?.length || 0) > 1;
    return `<a class="glass pcard reveal" href="#/jogo/${encodeURIComponent(g.key)}" data-wall="${esc(g.hero || g.cover || '')}">
      ${art(g.cover, { alt: g.name, w: 200 })}
      <div><div class="pcard-name">${esc(g.name)}</div>
      <div class="pcard-sub">${platform ? `<span class="tag" style="${multi ? 'background:linear-gradient(135deg,#fff,#a9bddb);color:#0a0f1f;border:0' : ''}">${esc(platform)}</span> ` : ''}${fmtDate(at)}${!multi && g.playMinutes ? ` · ${fmtH(g.playMinutes)}` : ''}${g.difficulty != null ? ` · ◆ ${num(g.difficulty)}` : ''}</div></div>
      <div class="rate ${rk ? 'r-' + rk.k : ''}">${fmtPct(rate)}<small>${rk?.label || ''}</small></div></a>`;
  };

  return {
    wall: list[0]?.g.hero || list[0]?.g.cover,
    html: `
      <div class="page-head reveal"><div><h1 class="page-title">Estante de platinas</h1>
        <div class="page-sub">Cada platina com a % de jogadores no mundo que também conseguiram</div></div></div>
      <section class="glass trophy-hero reveal">
        <div class="big-trophy" id="bigTrophy">${trophySVG('platinum', { shine: true })}</div>
        <div>
          <div class="plat-count" data-count="${count}">0</div>
          <div style="color:var(--muted);font-weight:600;margin-top:4px">platinas conquistadas${games < list.length ? ` em ${games} jogos` : ''}${avgMin ? ` · média de ${fmtH(Math.round(avgMin))} por jogo` : ''}</div>
          ${doubles ? `<div style="color:var(--dim);font-size:12.5px;margin-top:4px">${doubles} jogos platinados em duas versões — cada platina aparece no seu ano, com a etiqueta da versão</div>` : ''}
          ${rarest ? `<div style="margin-top:12px;font-size:14px">A mais rara: <b>${esc(rarest.g.name)}</b>${(rarest.g.plats?.length || 0) > 1 ? ` (${esc(rarest.platform)})` : ''} — <span class="r-${rarity(rarest.rate).k}" style="font-weight:800">${fmtPct(rarest.rate)}</span> dos jogadores</div>` : ''}
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

// linha de data de lançamento (lista de desejos, mais aguardados, pastas)
function dateLine(i, M){
  if (!i) return `<span>${M.sources.rawg ? 'Sem dados de lançamento' : 'Data: ative o RAWG no sync'}</span>`;
  if (i.tba || !i.released) return `<span>Data a confirmar</span>`;
  const t = new Date(i.released + 'T12:00:00').getTime(), days = Math.ceil((t - Date.now()) / 864e5);
  // 31/12 é a data que o RAWG usa quando só se sabe o ano
  if (days > 0 && i.released.endsWith('-12-31')) return `<span>Previsto para ${i.released.slice(0, 4)}</span>`;
  return days > 0
    ? `<span>Lança em ${fmtDate(i.released + 'T12:00:00')}</span><span class="countdown">faltam ${days} dia${days > 1 ? 's' : ''}</span>`
    : `<span>Lançou em ${fmtDate(i.released + 'T12:00:00')}</span><span class="countdown out">disponível</span>`;
}

// ================= LANÇAMENTOS =================
const REL = { sort: 'date', show: 'all' };
const REL_SORTS = [['date', '📅 Lançamento'], ['price', '💰 Preço'], ['ttb', '⏳ Tempo de jogo'], ['hype', '🔥 Hype']];
const REL_SHOW = [['all', 'Todos'], ['out', 'Já lançados'], ['soon', 'Em breve']];

// mini gráfico do histórico de preço (pontos que você foi registrando)
function priceSpark(hist){
  if (hist.length < 2) return '';
  const ps = hist.map(h => h.p), lo = Math.min(...ps), hi = Math.max(...ps), W = 110, H = 26;
  const x = i => Math.round(i / (hist.length - 1) * W), y = v => hi === lo ? H / 2 : Math.round(H - 3 - (v - lo) / (hi - lo) * (H - 6));
  const pts = hist.map((h, i) => `${x(i)},${y(h.p)}`).join(' ');
  const mi = ps.indexOf(lo);
  return `<svg class="spark" viewBox="-3 0 ${W + 6} ${H}" width="${W}" height="${H}" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="#ffd27a" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(mi)}" cy="${y(lo)}" r="3" fill="#3ddc97"/></svg>`;
}

export function releases(M, params, ctx){
  const active = M.watch.filter(w => !w.removed && !w.bought);
  const total = active.reduce((s, w) => s + (w.price || 0), 0);
  const now = Date.now();
  const relAt = w => w.info?.released ? Date.parse(w.info.released + 'T12:00:00') : null;
  const isOut = w => relAt(w) != null && relAt(w) <= now;
  // hype só entre os jogos da sua lista (o mais aguardado dela = 100)
  const maxAdded = Math.max(1, ...active.map(w => w.info?.added || 0));
  const hype = added => added ? Math.max(4, Math.round(100 * Math.log10(added + 1) / Math.log10(maxAdded + 1))) : 0;
  const ttbOf = w => w.ttb?.h || w.ttb?.n || null;

  const shown = active.filter(w => REL.show === 'all' || (REL.show === 'out' ? isOut(w) : !isOut(w)));
  const last = 9e15;
  const sorters = {
    // em breve: o mais próximo primeiro; já lançados: o mais recente primeiro; sem data no fim
    date: (a, b) => {
      const oa = isOut(a), ob = isOut(b);
      if (oa !== ob) return oa - ob;
      return oa ? (relAt(b) || 0) - (relAt(a) || 0) : (relAt(a) ?? last) - (relAt(b) ?? last);
    },
    price: (a, b) => (a.price || last) - (b.price || last),
    ttb: (a, b) => (ttbOf(a) ?? last) - (ttbOf(b) ?? last),
    hype: (a, b) => (b.info?.added || 0) - (a.info?.added || 0),
  };
  shown.sort(sorters[REL.sort] || sorters.date);

  const hypeBar = added => added ? `<div class="hype"><div class="hype-top"><span>${ICON.flame.replace('<svg', '<svg width="12" height="12" style="vertical-align:-1px"')} Hype</span><span>${hype(added)}/100</span></div>
    <div class="hype-track"><i data-w="${hype(added)}"></i></div></div>` : '';
  const score = i => i?.rating && i.released && new Date(i.released) < new Date()
    ? `<div class="wcard-date" style="margin-top:6px"><span style="color:var(--gold)">${ICON.star.replace('<svg', '<svg width="12" height="12" style="vertical-align:-1px"')} ${num(i.rating)}</span>${i.metacritic ? `<span>Metacritic ${i.metacritic}</span>` : ''}</div>` : '';
  const priceBox = w => {
    if (!w.price) return `<div class="price none">sem preço definido</div>`;
    const ps = w.hist.map(h => h.p), lo = ps.length ? Math.min(...ps) : w.price;
    const loAt = w.hist.find(h => h.p === lo)?.t;
    return `<div class="price-row"><div class="price">${brl(w.price)}</div>${priceSpark(w.hist)}</div>
      ${w.hist.length > 1 ? `<div class="wcard-date">${lo < w.price
        ? `<span>menor registrado: <b style="color:var(--good)">${brl(lo)}</b> em ${fmtDate(new Date(loAt).toISOString())}</span>`
        : `<span style="color:var(--good)">▼ menor preço que você já registrou</span>`} · ${w.hist.length} registros</div>` : ''}`;
  };

  const wcard = w => `<div class="glass wcard reveal" data-id="${esc(w.id)}" data-wall="${esc(w.info?.bg || w.cover || '')}">
    ${art(w.info?.bg && !w.cover ? w.info.bg : w.cover, { alt: w.name, w: 260 })}
    <div>
      <div class="wcard-name">${esc(w.name)}</div>
      <div class="wcard-date">${dateLine(w.info, M)}</div>
      ${score(w.info)}
      ${ttbOf(w) ? `<div class="wcard-date" style="margin-top:4px"><span>⏳ ~${num(ttbOf(w))} h pra zerar${w.ttb.c ? ` · 100% ~${num(w.ttb.c)} h` : ''}${w.ttb.src && w.ttb.src.toLowerCase() !== w.name.toLowerCase() ? ` · com base em ${esc(w.ttb.src)}` : ''}</span></div>` : ''}
      ${hypeBar(w.info?.added)}
      ${priceBox(w)}
      <div class="wactions">
        <button class="mini-btn" data-act="price">✏️ Preço</button>
        <button class="mini-btn good" data-act="bought">✔ Comprei</button>
        <button class="mini-btn bad" data-act="removed" aria-label="Remover">🗑</button>
      </div>
    </div></div>`;

  const chip = (group, v, l, cur) => `<button class="chip ${v === cur ? 'on' : ''}" data-${group}="${v}">${l}</button>`;
  const done = M.watch.filter(w => w.bought || w.removed);
  const outCount = active.filter(isOut).length;
  return {
    wall: shown[0]?.info?.bg || shown[0]?.cover,
    html: `
      <div class="page-head reveal"><div><h1 class="page-title">Lançamentos & desejos</h1>
        <div class="page-sub">Sua lista: quando sai, quanto custa, quanto tempo leva e o hype</div></div></div>
      <section class="glass invest reveal">
        <div><div style="color:var(--muted);font-size:13px;font-weight:600">Total pra investir</div>
          <div class="invest-num">${brl(total)}</div></div>
        <div style="color:var(--muted);font-size:13px">${active.length} jogos · ${outCount} já lançado${outCount === 1 ? '' : 's'}${active.filter(w => !w.price).length ? ` · ${active.filter(w => !w.price).length} sem preço` : ''}</div>
      </section>
      ${M.sources.rawg ? '' : `<div class="glass note reveal" style="margin-top:14px">
        <b>Ative datas, notas e hype:</b> crie uma chave grátis em <b>rawg.io/apidocs</b>, cole em <code>sync/.env.local</code> como <code>RAWG_API_KEY=</code> e rode o sync de novo.</div>`}
      <div class="rel-controls reveal">
        <div><span class="ix-lbl">Ordenar</span><div class="chips" id="relSort">${REL_SORTS.map(([v, l]) => chip('sort', v, l, REL.sort)).join('')}</div></div>
        <div><span class="ix-lbl">Mostrar</span><div class="chips" id="relShow">${REL_SHOW.map(([v, l]) => chip('show', v, l, REL.show)).join('')}</div></div>
      </div>
      ${section('Sua lista de desejos', shown.length ? `<div class="wl" id="wl">${shown.map(wcard).join('')}</div>` : '<div class="empty">Nada nesse filtro</div>', { count: shown.length })}
      <div class="ix-foot" style="margin-top:10px">💡 O histórico de preço é montado com os preços que você atualiza aqui (✏️ Preço). Atualize quando vir promoção na PS Store que o menor valor fica registrado.</div>
      ${done.length ? section('Comprados ou removidos', `<div class="kv">${done.map(w => `<button class="chip" data-undo="${esc(w.id)}" data-act="${w.bought ? 'bought' : 'removed'}">${w.bought ? '✔' : '🗑'} ${esc(w.name)} <span>desfazer</span></button>`).join('')}</div>`) : ''}`,
    mount(root){
      root.addEventListener('click', e => {
        const c = e.target.closest('[data-sort],[data-show]');
        if (c) {
          if (c.dataset.sort) REL.sort = c.dataset.sort; else REL.show = c.dataset.show;
          ctx.rerender();
          return;
        }
        const b = e.target.closest('[data-act]'); if (!b) return;
        const id = b.dataset.undo || b.closest('[data-id]')?.dataset.id;
        const w = M.watch.find(x => x.id === id); if (!w) return;
        const act = b.dataset.act;
        if (act === 'price') {
          const raw = prompt(`Preço de ${w.name} (R$):`, w.price ? String(w.price).replace('.', ',') : '');
          if (raw == null) return;
          const v = parseFloat(raw.replace(/[R$\s.]/g, '').replace(',', '.'));
          if (isNaN(v) || v < 0) return ctx.toast('Valor inválido');
          watchAction(id, 'price', v);
          w.hist = [...(w.hist || []), { p: v, t: Date.now() }];
          const lo = Math.min(...w.hist.map(h => h.p));
          ctx.toast(v <= lo && w.hist.length > 1 ? `🔥 ${w.name}: ${brl(v)} — menor preço já registrado!` : `💰 ${w.name}: ${brl(v)}`);
          w.price = v;
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
  const pl = M.all.filter(isPlayed);   // perfil = números da conta inteira (inclui ocultos)
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
      ${retroTeaser(M)}
      <div class="two section">
        <div class="glass panel reveal"><h3>${ICON.clock.replace('<svg', '<svg width="18" height="18"')} Mais jogados</h3>
          <div class="bars">${top.map(g => `<a class="bar-row" href="#/jogo/${encodeURIComponent(g.key)}">${art(g.cover, { w: 120 })}
            <div style="min-width:0"><div class="bar-name">${esc(g.name)}</div><div class="bar-track"><i data-w="${g.playMinutes / maxMin * 100}"></i></div></div>
            <div class="bar-val">${fmtH(g.playMinutes)}</div></a>`).join('') || '<div class="empty">Sem tempo registrado</div>'}</div></div>
        <div class="glass panel reveal"><h3>📊 Seus números</h3>
          ${kv('Horas jogadas (PS4/PS5)', fmtH(totalMin))}
          ${kv('Jogos na conta', M.all.filter(g => g.source === 'psn').length)}
          ${kv('Jogos iniciados', pl.length)}
          ${kv('Zerados', `${M.all.filter(g => g.zerado).length} (platinados contam)`)}
          ${kv('Nunca jogados', M.all.filter(g => g.status === 'never' && !g.zerado).length)}
          ${kv('Taxa de platina', `${platRate}% dos jogos com platina`)}
          ${kv('Média por jogo', pl.length ? fmtH(Math.round(totalMin / Math.max(1, pl.filter(g => g.playMinutes).length))) : '—')}
          ${first ? kv('Jogando desde', fmtDate(first, { month: 'long', year: 'numeric' })) : ''}
          <div class="kv" style="margin-top:14px">${Object.entries(byPlat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="pill">${esc(k)} · ${v}</span>`).join('')}</div>
        </div>
      </div>`,
  };
}

// ================= PASTAS (SÉRIES) =================
function folderCard(f){
  const covers = f.games.filter(g => g.cover).slice(0, 3);
  const pct = Math.round(f.zerados / f.games.length * 100);
  return `<a class="folder reveal" href="#/pasta/${encodeURIComponent(f.id)}" data-wall="${esc(f.hero || '')}" style="--h:${f.hue}">
    <div class="folder-bg" style="background-image:url('${esc(thumb(f.hero, 800))}')"></div>
    <div class="folder-stack" style="--n:${covers.length}">${covers.map((g, i) =>
      `<div class="fs" style="--i:${i};z-index:${i === 1 ? 3 : 1}">${art(g.cover, { w: 240, alt: g.name })}</div>`).join('')}</div>
    <div class="folder-info">
      <div class="folder-name">${esc(f.name)}</div>
      <div class="folder-sub">${f.games.length} jogo${f.games.length > 1 ? "s" : ""} · ${f.zerados} zerado${f.zerados === 1 ? '' : 's'}${f.plats ? ` (${f.plats} 🏆)` : ''}${f.minutes ? ` · ${fmtH(f.minutes)}` : ''}</div>
      ${f.soon.length ? `<div class="folder-soon">🚀 ${f.soon.length} em breve na série</div>` : ''}
      <div class="pbar" title="${pct}% da série zerada"><i data-w="${pct}"></i></div>
    </div></a>`;
}

export function pasta(M, params, ctx, id){
  const f = buildFolders(M).find(x => x.id === id);
  if (!f) return { html: `<a class="see-all" href="#/biblioteca?f=pastas">← Pastas</a><div class="empty">Pasta não encontrada.</div>` };
  const pct = Math.round(f.zerados / f.games.length * 100);
  const soonCard = w => `<div class="glass wcard reveal" data-wall="${esc(w.info?.bg || w.cover || '')}">
    ${art(w.cover || w.info?.bg, { alt: w.name, w: 260 })}
    <div><div class="wcard-name">${esc(w.name)}</div>
      <div class="wcard-date">${dateLine(w.info, M)}</div>
      <div class="price ${w.price ? '' : 'none'}">${w.price ? brl(w.price) : 'sem preço definido'}</div>
      <div class="wcard-date" style="margin-top:6px"><a class="see-all" href="#/lancamentos">Na sua lista de desejos →</a></div></div></div>`;
  return {
    wall: f.hero,
    html: `
      <a class="see-all back reveal" href="#/biblioteca?f=pastas">← Todas as pastas</a>
      <section class="folder-hero reveal" style="--h:${f.hue}">
        <div class="folder-bg" style="background-image:url('${esc(thumb(f.hero, 1600))}')"></div>
        <div class="eyebrow">📁 Série</div>
        <h1 class="hero-title" style="margin:8px 0 14px">${esc(f.name)}</h1>
        <div class="hero-meta" style="margin:0">
          ${pill('', `${f.games.length} jogo${f.games.length > 1 ? 's' : ''} no catálogo`)}
          ${pill('', `✅ ${f.zerados} zerado${f.zerados === 1 ? '' : 's'} (${pct}% da série)`)}
          ${f.plats ? pill(`<span style="width:14px;height:16px;display:inline-block">${trophySVG('platinum')}</span>`, `${f.plats} platinado${f.plats === 1 ? '' : 's'}`) : ''}
          ${f.minutes ? pill(ICON.clock, `${fmtH(f.minutes)} jogadas`) : ''}
          ${f.never ? pill('', `${f.never} nunca jogado${f.never > 1 ? 's' : ''}`) : ''}
          ${f.soon.length ? pill('', `🚀 ${f.soon.length} em breve`) : ''}
        </div>
        <div class="pbar" style="max-width:420px;margin-top:16px;height:6px"><i data-w="${pct}"></i></div>
      </section>
      ${section('Na sua conta', `<div class="grid">${f.games.map(gameCard).join('')}</div>`,
        { count: f.games.length, sub: f.games.some(g => g.rating?.released) ? 'Em ordem de lançamento' : '' })}
      ${f.soon.length ? section('🚀 Em breve na série', `<div class="wl">${f.soon.map(soonCard).join('')}</div>`, { count: f.soon.length }) : ''}`,
  };
}

// ================= RETROSPECTIVA (ANO A ANO) =================
const RETRO = { metric: 'min', sel: null };
const TLBL = { platinum: 'Platina', gold: 'Ouro', silver: 'Prata', bronze: 'Bronze' };
const hShort = m => m >= 60 ? `${Math.round(m / 60).toLocaleString('pt-BR')} h` : m ? `${m} min` : '—';

export function retro(M){
  const Y = M.years.filter(y => y.total || y.minutes);
  if (!Y.length) return { html: `<div class="page-head"><h1 class="page-title">Retrospectiva</h1></div>
    <div class="empty">${M.connected ? 'Ainda sem dados por ano — rode o sync de novo.' : 'Conecte a PSN pra ver sua retrospectiva.'}</div>` };
  if (!Y.some(y => y.year === RETRO.sel)) RETRO.sel = Y[0].year;
  const asc = [...Y].sort((a, b) => a.year - b.year);
  const nowY = new Date().getFullYear();
  const wallOf = y => { const g = M.byKey.get(y?.top[0]?.key); return g?.hero || g?.cover; };

  const chart = () => {
    const val = y => RETRO.metric === 'min' ? y.minutes : y.total;
    const max = Math.max(1, ...asc.map(val));
    return asc.map(y => `<button class="ybar ${y.year === RETRO.sel ? 'on' : ''}" data-y="${y.year}" aria-label="Ver ${y.year}">
      <span class="ybar-val">${RETRO.metric === 'min' ? (y.minutes ? '≈' + hShort(y.minutes) : '—') : y.total.toLocaleString('pt-BR')}</span>
      <span class="ybar-track"><i data-h="${val(y) ? Math.max(3, val(y) / max * 100) : 0}"></i></span>
      <span class="ybar-year">${y.year}</span></button>`).join('');
  };

  const detailY = () => {
    const y = Y.find(x => x.year === RETRO.sel) || Y[0];
    const top = y.top.map(t => ({ ...t, g: M.byKey.get(t.key) })).filter(t => t.g && (t.min || t.tro));
    const maxMin = Math.max(1, ...top.map(t => t.min));
    const maxTro = Math.max(1, ...top.map(t => t.tro));
    const platsY = y.plats.map(p => ({ ...p, g: M.byKey.get(p.key) })).filter(p => p.g);
    const rg = y.rarest && M.byKey.get(y.rarest.game);
    const rk = y.rarest && rarity(y.rarest.rate);
    const tile = (val, lbl, sub = '') => `<div class="glass stat reveal"><div class="stat-num" data-count="${val}">0</div><div class="stat-lbl">${lbl}</div>${sub}</div>`;
    return `
      <div class="year-title reveal">${y.year}${y.year === nowY ? '<small>até agora</small>' : ''}</div>
      <div class="stats">
        ${tile(Math.round(y.minutes / 60), 'horas jogadas (estimativa)')}
        ${tile(y.total, 'troféus conquistados')}
        ${tile(y.trophies.platinum, 'platinas')}
        ${tile(y.games, 'jogos jogados', `<div class="stat-lbl" style="margin-top:2px;color:var(--dim)">${y.started} começados no ano</div>`)}
      </div>
      <div class="trophy-row">${['platinum', 'gold', 'silver', 'bronze'].map(k =>
        `<div class="glass tbox reveal">${trophySVG(k, { shine: k === 'platinum' })}<div class="num" data-count="${y.trophies[k] || 0}">0</div><div class="lbl">${TLBL[k]}</div></div>`).join('')}</div>
      <div class="two section">
        <div class="glass panel reveal"><h3>🎮 Mais jogados em ${y.year}</h3>
          <div class="bars">${top.map(t => `<a class="bar-row" href="#/jogo/${encodeURIComponent(t.key)}">${art(t.g.cover, { w: 120 })}
            <div style="min-width:0"><div class="bar-name">${esc(t.g.name)}</div><div class="bar-track"><i data-w="${t.min ? t.min / maxMin * 100 : t.tro / maxTro * 100}"></i></div></div>
            <div class="bar-val">${t.min ? '≈' + hShort(t.min) : `${t.tro} troféus`}</div></a>`).join('') || '<div class="empty">Sem atividade registrada</div>'}</div></div>
        <div class="glass panel reveal"><h3><span style="width:18px;height:20px;display:inline-block">${trophySVG('platinum')}</span> Platinas de ${y.year} <span class="count" style="font-size:12px;color:var(--muted);font-family:var(--body)">${platsY.length}</span></h3>
          ${platsY.length ? platsY.map(p => {
            const r = rarity(p.rate);
            return `<a class="mini-plat" href="#/jogo/${encodeURIComponent(p.key)}">${art(p.g.cover, { w: 120 })}
              <div style="min-width:0"><div class="bar-name" style="margin:0">${esc(p.g.name)}</div>
              <div class="pcard-sub">${p.platform ? `<span class="tag">${esc(p.platform)}</span> ` : ''}${fmtDate(p.at)}</div></div>
              <div class="rate ${r ? 'r-' + r.k : ''}" style="font-size:15px">${fmtPct(p.rate)}</div></a>`;
          }).join('') : '<div class="empty" style="padding:20px">Nenhuma platina nesse ano</div>'}
          ${y.rarest ? `<div style="margin-top:18px">
            <div class="ix-lbl">Troféu mais raro do ano</div>
            <div class="tro got" style="padding:10px 0 0">
              <div class="tro-ic">${y.rarest.icon ? `<img src="${esc(y.rarest.icon)}" alt="" loading="lazy">` : ''}<span class="tro-type">${trophySVG(y.rarest.type)}</span></div>
              <div style="min-width:0"><div class="tro-name">${esc(y.rarest.name)}</div><div class="tro-desc">${esc(rg?.name || '')}</div></div>
              <div class="tro-rate r-${rk.k}">${fmtPct(y.rarest.rate)}<small>${rk.label}</small></div>
            </div></div>` : ''}
        </div>
      </div>
      <div class="glass note reveal" style="margin-top:16px">
        <b>Como os números são calculados:</b> troféus e platinas por ano são exatos (a Sony registra a data de cada um).
        As <b>horas por ano são estimadas</b>: a Sony só informa o tempo total de cada jogo, então dividimos esse total entre os anos
        em que você jogou e ganhou troféus. Jogos de PS3 e Vita não têm tempo registrado pela Sony.</div>`;
  };

  return {
    wall: wallOf(Y.find(y => y.year === RETRO.sel)),
    html: `
      <div class="page-head reveal"><div><h1 class="page-title">Retrospectiva</h1>
        <div class="page-sub">${M.firstTrophy ? `Seu primeiro troféu foi em ${fmtDate(M.firstTrophy, { month: 'long', year: 'numeric' })} · ` : ''}${Y.length} anos de jogatina</div></div></div>
      <section class="glass panel reveal">
        <div class="section-head" style="margin-bottom:6px"><h3 style="margin:0">📅 Ano a ano</h3>
          <div class="seg" id="retroMetric" style="margin:0">
            <button data-m="min" class="${RETRO.metric === 'min' ? 'on' : ''}">Horas</button>
            <button data-m="tro" class="${RETRO.metric === 'tro' ? 'on' : ''}">Troféus</button>
          </div></div>
        <div class="ychart" id="ychart">${chart()}</div>
      </section>
      <div id="ydetail">${detailY()}</div>`,
    mount(root){
      const c = root.querySelector('#ychart');
      const center = () => requestAnimationFrame(() => {
        const on = c.querySelector('.ybar.on');
        if (on) c.scrollLeft = on.offsetLeft - c.clientWidth / 2 + on.clientWidth / 2;
      });
      c.addEventListener('click', e => {
        const b = e.target.closest('[data-y]'); if (!b) return;
        RETRO.sel = +b.dataset.y;
        c.querySelectorAll('.ybar').forEach(x => x.classList.toggle('on', x === b));
        const d = root.querySelector('#ydetail');
        d.innerHTML = detailY();
        animate(d);
        setWall(wallOf(Y.find(y => y.year === RETRO.sel)));
      });
      root.querySelector('#retroMetric').addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        RETRO.metric = b.dataset.m;
        root.querySelectorAll('#retroMetric button').forEach(x => x.classList.toggle('on', x === b));
        c.innerHTML = chart();
        animate(c);
        center();
      });
      center();
    },
  };
}

// cartão de atalho pra retrospectiva (Início e Perfil)
function retroTeaser(M){
  const y = M.years.find(x => x.total || x.minutes);
  if (!y) return '';
  const now = y.year === new Date().getFullYear();
  return `<a class="glass retro-teaser reveal" href="#/anos">
    <div><div class="eyebrow">📅 Retrospectiva</div><div class="rt-title">Seu ${y.year}${now ? ' até agora' : ''}</div></div>
    <div class="rt-nums">
      <span><b data-count="${Math.round(y.minutes / 60)}">0</b>h</span>
      <span><b data-count="${y.total}">0</b>troféus</span>
      <span><b data-count="${y.trophies.platinum}">0</b>platinas</span>
    </div>
    <span class="see-all">Ver ano a ano →</span></a>`;
}

// ================= DETALHE: RUMO À PLATINA =================
// partes do jogo grande: jogos de uma coletânea ou DLCs, cada uma com o seu "zerado"
const PART_LABEL = { base: 'Jogo base', dlc: 'DLC', jogo: 'Jogo', extra: 'Extra' };
function partsBlock(M, g){
  if (!g.parts || g.parts.length < 2) return '';
  const title = g.collection ? '📦 Jogos desta coletânea' : '📦 Jogo base e DLCs';
  const row = p => {
    const pct = p.defined ? Math.round(p.earned / p.defined * 100) : 0;
    const when = p.date ? ` · ${fmtDate(new Date(p.date).toISOString())}` : '';
    const btn = p.auto
      ? `<span class="part-btn on auto" title="Todos os troféus dessa parte">✅ 100%</span>`
      : `<button class="part-btn ${p.zerado ? 'on' : ''}" ${p.link ? `data-zerar="${esc(p.link)}"` : `data-part="${esc(g.key)}|${esc(p.id)}"`}
           aria-pressed="${p.zerado}">${p.zerado ? '✅ Zerado' : 'Marcar zerado'}</button>`;
    const name = esc(p.name);
    return `<div class="part ${p.zerado ? 'done' : ''}">
      <div class="part-ic">${art(p.icon, { w: 200, alt: p.name })}</div>
      <div class="part-main">
        <div class="part-name">${p.link ? `<a href="#/jogo/${encodeURIComponent(p.link)}">${name} ›</a>` : name}
          <em class="ptag ${p.kind}">${PART_LABEL[p.kind] || ''}</em></div>
        <div class="part-sub">${p.defined ? `${p.earned}/${p.defined} troféus` : 'sem troféus'}${p.zerado && p.sug && !p.auto ? ' · troféu de fim de história' : ''}${p.zerado ? when : ''}</div>
        <div class="pbar"><i data-w="${pct}"></i></div>
      </div>
      ${btn}
    </div>`;
  };
  return `<section class="parts">
    <h3 class="parts-title">${title} <span class="count">${g.partsDone}/${g.partsTotal} zerado${g.partsTotal > 1 ? 's' : ''}</span></h3>
    ${g.collection ? `<div class="ix-foot" style="margin:-4px 0 12px">A coletânea conta como zerada quando todos os jogos dela estiverem zerados.</div>` : ''}
    <div class="parts-list">${g.parts.map(row).join('')}</div>
  </section>`;
}

export function detail(M, g){
  const t = g.trophies, di = diffInfo(g.difficulty);
  const rate = t?.plat?.rate;
  const meter = Array.from({ length: 10 }, (_, i) => `<i style="${g.difficulty != null && i < Math.round(g.difficulty) ? `background:${di.color}` : ''}"></i>`).join('');
  const q = encodeURIComponent(g.name);
  const tags = [
    ...(g.platforms || []).map(p => `<span class="tag">${esc(p)}</span>`),
    g.status === 'never' ? '<span class="tag never">NUNCA JOGADO</span>' : '',
    g.hidden ? '<span class="tag">🙈 OCULTO</span>' : '',
    g.status === 'platinum' ? '<span class="tag" style="background:linear-gradient(135deg,#fff,#a9bddb);color:#0a0f1f;border:0">PLATINADO</span>' : '',
    g.plus ? '<span class="tag plus">PLUS</span>' : '',
    g.source === 'lista' ? '<span class="tag list">MINHA LISTA</span>' : '',
  ].join('');

  return `
    <div class="d-banner"><div class="bg" style="background-image:url('${esc(thumb(g.hero || g.cover, 1600))}')"></div>
      <button class="d-close" data-close aria-label="Fechar">${ICON.close.replace('<svg', '<svg stroke="#fff" stroke-width="2.4"')}</button></div>
    <div class="d-head">${art(g.cover, { alt: g.name, w: 400 })}
      <div><h2 class="d-title">${esc(g.name)}</h2><div class="d-tags">${tags}</div>
        ${g.rating?.score ? `<div class="d-rating"><b>★ ${num(Math.round(g.rating.score * 10) / 10)}</b><span>no RAWG${g.rating.count ? ` · ${g.rating.count.toLocaleString('pt-BR')} avaliações` : ''}</span>
          ${g.rating.metacritic ? `<span class="tag" style="background:${g.rating.metacritic >= 75 ? '#2e9d5b' : g.rating.metacritic >= 50 ? '#c9952b' : '#b33a3a'};border:0;color:#fff">Metacritic ${g.rating.metacritic}</span>` : ''}</div>` : ''}
        <div class="d-actions">
          ${canZerar(g) ? `<button class="btn ghost want-big ${g.want ? 'on' : ''}" data-want="${esc(g.key)}" aria-pressed="${g.want}">${wantLabel(g.want)}</button>` : ''}
          ${g.zeradoAuto
            ? `<span class="btn ghost zer-big on" title="Conta como zerado sozinho">✅ Zerado (${esc(g.zeradoWhy)})</span>`
            : `<button class="btn ghost zer-big ${g.zerado ? 'on' : ''}" data-zerar="${esc(g.key)}" aria-pressed="${g.zerado}">${g.zerado
                ? `✅ Zerado${g.zeradoDate ? ` em ${fmtDate(new Date(g.zeradoDate).toISOString())}` : ''} · tirar`
                : '✅ Marcar como zerado'}</button>`}
          <button class="btn ghost hide-big" data-hide="${esc(g.key)}" aria-pressed="${g.hidden}">${g.hidden ? '👁 Mostrar na biblioteca' : '🙈 Ocultar'}</button>
        </div>
        ${g.zerado && !g.zeradoAuto && !g.zeradoAt && g.zeradoSug ? `<div class="ix-foot" style="margin-top:8px">Marquei sozinho: ${g.storyTrophy
          ? `você ganhou o troféu de fim de história <b>“${esc(g.storyTrophy.name)}”</b>`
          : `mais de 3 h jogadas — a data é a do seu último troféu`}. Não zerou? Toque em “tirar”.</div>` : ''}
        ${g.parentKey ? `<a class="see-all" style="display:inline-block;margin-top:10px" href="#/jogo/${encodeURIComponent(g.parentKey)}">📦 Faz parte de ${esc(M.byKey.get(g.parentKey)?.name || 'uma coletânea')} →</a>` : ''}
      </div></div>
    <div class="d-body">
      ${partsBlock(M, g)}
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
        <div class="glass ix" id="ixZerar">
          <button class="ix-edit" data-edit="zerar">editar</button>
          <div class="ix-lbl">Tempo pra zerar</div>
          <div class="ix-val">${g.zerarH != null ? '~' + num(g.zerarH) : '—'}<small>h</small></div>
          <div class="ix-foot">${g.zerarH == null ? (M.sources.igdb ? 'sem dado no IGDB — defina você' : 'ative o IGDB no sync ou defina você')
            : g.zerarSrc === 'IGDB' ? `só a história${g.ttb.n ? ` · com extras ~${num(g.ttb.n)} h` : ''}${g.ttb.c ? ` · 100% ~${num(g.ttb.c)} h` : ''} · IGDB${g.ttb.src && g.ttb.src.toLowerCase() !== g.name.toLowerCase().replace(/[™®]/g, '').trim() ? ` (${esc(g.ttb.src)})` : ''}`
            : g.zerarSrc === 'você' ? 'sua estimativa' : 'estimativa da sua lista'}${!g.zerado && g.playMinutes && g.zerarFalta != null ? ` · faltam ~${num(g.zerarFalta)} h` : ''}</div>
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
            ${(g.plats?.length || 0) > 1
              ? g.plats.map(p => `<span>Platina ${esc(p.platform)} em <b>${fmtDate(p.at)}</b> (${fmtPct(p.rate)})</span>`).join('')
              : g.platEarnedAt ? `<span>Platinado em <b>${fmtDate(g.platEarnedAt)}</b></span>` : ''}
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
    const cur = kind === 'diff' ? (g.difficulty ?? 5) : kind === 'zerar' ? (g.zerarH ?? '') : (g.hoursPlat ?? '');
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
      saveOverride(g.key, kind === 'diff' ? { diff: v } : kind === 'zerar' ? { zerar: v } : { hours: v });
      if (kind === 'diff') g.difficulty = v; else if (kind === 'zerar') zerarEstimate(g); else g.hoursPlat = v;
      ctx.toast('Salvo ✔'); ctx.reopen();
    });
    f.querySelector('[data-reset]').addEventListener('click', () => {
      saveOverride(g.key, kind === 'diff' ? { diff: null } : kind === 'zerar' ? { zerar: null } : { hours: null });
      if (kind === 'diff') g.difficulty = g.diffAuto; else if (kind === 'zerar') zerarEstimate(g); else delete g.hoursPlat;
      ctx.reopen();
    });
    inp.focus();
  }));

  if (g.trophies) loadTrophies(g.trophies.id).then(list => {
    const road = panel.querySelector('#road');
    if (!road) return;
    road.innerHTML = list?.length ? roadmap(list, g) : '<div class="glass note" style="margin-top:20px">Não achei a lista de troféus desse jogo — rode o sync de novo.</div>';
    road.addEventListener('click', e => {
      const pc = e.target.closest('[data-pid]');
      if (pc) {
        const tabNow = road.querySelector('[data-tab].on')?.dataset.tab || '';
        road.innerHTML = roadmap(list, g, pc.dataset.pid, tabNow);
        animate(road);
        return;
      }
      const tb = e.target.closest('[data-tab]');
      if (tb) {
        road.querySelectorAll('[data-tab]').forEach(b => { b.classList.toggle('on', b === tb); b.setAttribute('aria-selected', b === tb); });
        road.querySelectorAll('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== tb.dataset.tab);
        return;
      }
      const h = e.target.closest('.hidden-t'); if (h) h.classList.toggle('show');
      const m = e.target.closest('[data-more]');
      if (m) { m.previousElementSibling.querySelectorAll('.tro[hidden]').forEach(x => x.hidden = false); m.remove(); }
    });
    animate(road);
  });
}

function troRow(x, step, partName){
  const rk = rarity(x.r);
  const secret = x.h && !x.e;
  // etiqueta da parte: nome da DLC / do jogo da coletânea (o jogo base não precisa)
  const tag = partName ? `<em class="dlc">${esc(partName)}</em>` : x.g && x.g !== 'default' ? '<em class="dlc">DLC</em>' : '';
  return `<div class="tro ${x.e ? 'got' : ''} ${secret ? 'hidden-t' : ''}">
    <div class="tro-ic">${x.ic ? `<img src="${esc(x.ic)}" alt="" loading="lazy">` : ''}<span class="tro-type">${trophySVG(x.ty)}</span></div>
    <div style="min-width:0">
      <div class="tro-name">${step ? `<span class="step">${step}</span>` : ''}<span>${esc(x.n || 'Troféu oculto')}</span>${tag}</div>
      <div class="tro-desc">${secret ? 'Troféu oculto — toque para revelar · ' : ''}${esc(x.d || '')}${x.e && x.at ? ` · conquistado em ${fmtDate(x.at)}` : ''}</div>
    </div>
    <div class="tro-rate ${rk ? 'r-' + rk.k : ''}">${fmtPct(x.r)}<small>${rk?.label || ''}</small></div>
  </div>`;
}

// pid = mostrar só os troféus de uma parte (DLC ou jogo da coletânea)
function roadmap(list, g, pid = '', tabPref = ''){
  const groupParts = (g.parts || []).filter(p => !p.link);
  const nameOf = id => {
    const p = groupParts.find(x => x.id === (id || 'default'));
    return p && (g.collection || p.id !== 'default') ? p.name : '';
  };
  const inPart = x => !pid || (x.g || 'default') === pid;
  const plat = list.find(x => x.ty === 'platinum');
  const pending = list.filter(x => !x.e && x.ty !== 'platinum' && inPart(x)).sort((a, b) => (b.r ?? -1) - (a.r ?? -1));
  const done = list.filter(x => x.e && x.ty !== 'platinum' && inPart(x)).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  // próximos passos: do jogo base (ou da parte escolhida; numa coletânea, de tudo)
  const base = pid || g.collection || !groupParts.length ? pending : pending.filter(x => !x.g || x.g === 'default');
  const next = base.slice(0, 5);
  const rest = pending.filter(x => !next.includes(x));
  const row = (x, step) => troRow(x, step, pid ? '' : nameOf(x.g));
  const chips = groupParts.length > 1 ? `<div class="chips part-chips">
      <button class="chip ${!pid ? 'on' : ''}" data-pid="">Todas as partes</button>
      ${groupParts.map(p => `<button class="chip ${pid === p.id ? 'on' : ''}" data-pid="${esc(p.id)}">${esc(p.name)} <span>${p.earned}/${p.defined}</span></button>`).join('')}
    </div>` : '';
  const goal = plat
    ? `<div class="goal">${trophySVG('platinum', { shine: true })}<div>
        <div style="font-size:11.5px;letter-spacing:1px;font-weight:700;color:var(--muted);text-transform:uppercase">${plat.e ? 'Conquistada' : 'Objetivo'}</div>
        <div style="font-family:var(--display);font-weight:800;font-size:19px;margin-top:4px">${esc(plat.n)}</div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">${plat.e ? `Platinado em ${fmtDate(plat.at)} — você está entre os ${fmtPct(plat.r)} que conseguiram` : `${base.length} troféus ${!pid && !g.collection && groupParts.length ? "do jogo base " : ""}faltando · ${fmtPct(plat.r)} dos jogadores chegaram lá`}</div>
      </div></div>`
    : `<div class="goal">${trophySVG('gold', { shine: true })}<div><div style="font-family:var(--display);font-weight:800;font-size:18px">Sem platina — objetivo é 100%</div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">${pending.length} troféus faltando</div></div></div>`;

  // abre em "Conquistados" quando não falta nada (ou mantém a aba que você estava vendo)
  const tab = tabPref || (pending.length ? 'pend' : 'done');
  const pendPane = pending.length ? `
      ${next.length ? `<h3>Próximos passos <span class="count">ordem sugerida: dos mais comuns aos mais raros</span></h3>
        <div>${next.map((x, i) => row(x, i + 1)).join('')}</div>` : ''}
      ${rest.length ? `<h3>${next.length ? 'Depois' : 'Faltam'} <span class="count">${rest.length}</span></h3>
        <div>${rest.map((x, i) => row(x).replace('<div class="tro', i >= 12 ? '<div hidden class="tro' : '<div class="tro')).join('')}</div>
        ${rest.length > 12 ? `<button class="mini-btn more" data-more>Mostrar mais ${rest.length - 12}</button>` : ''}` : ''}`
    : `<div class="glass note" style="margin-top:16px">Não falta nenhum troféu${pid ? ' nessa parte' : ''}. 🎉</div>`;
  const donePane = done.length
    ? `<div style="margin-top:14px">${done.map(x => row(x)).join('')}</div>`
    : `<div class="glass note" style="margin-top:16px">Nenhum troféu ainda${pid ? ' nessa parte' : ''} — o primeiro passo está na aba ao lado.</div>`;

  return `
    <h3>🧭 Rumo à platina</h3>
    ${goal}
    ${chips}
    <div class="seg" role="tablist">
      <button role="tab" data-tab="pend" class="${tab === 'pend' ? 'on' : ''}" aria-selected="${tab === 'pend'}">Faltam <span>${pending.length}</span></button>
      <button role="tab" data-tab="done" class="${tab === 'done' ? 'on' : ''}" aria-selected="${tab === 'done'}">✔ Conquistados <span>${done.length}</span></button>
    </div>
    <div data-pane="pend" ${tab === 'pend' ? '' : 'hidden'}>${pendPane}</div>
    <div data-pane="done" ${tab === 'done' ? '' : 'hidden'}>${donePane}</div>`;
}
