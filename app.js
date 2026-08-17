// ---- dados dos jogos (na ordem que você mandou) ----
const GAMES = [
  { id:'alan-wake-2',   title:'Alan Wake 2',                          note:'terminar', h:20,   series:'Alan Wake',   img:'covers/alan-wake-2.jpg' },
  { id:'re7',           title:'Resident Evil 7 — End of Zoe (DLC)',   note:'~2-3h',    h:2.5,  series:'Resident Evil', img:'covers/re7.jpg' },
  { id:'lara-croft-go', title:'Lara Croft GO',                        note:'~3-5h',    h:4,    series:'Tomb Raider', img:'covers/lara-croft-go.jpg' },
  { id:'tr1',           title:'Tomb Raider I (Remaster)',             note:'~6-8h',    h:7,    series:'Tomb Raider', img:'covers/tr1.png' },
  { id:'re-rev',        title:'Resident Evil Revelations',            note:'~8-10h',   h:9,    series:'Resident Evil', img:'covers/re-rev.jpg' },
  { id:'tr2',           title:'Tomb Raider II (Remaster)',            note:'~8-10h',   h:9,    series:'Tomb Raider', img:'covers/tr2.png' },
  { id:'re0',           title:'Resident Evil 0',                      note:'~8-10h',   h:9,    series:'Resident Evil', img:'covers/re0.jpg' },
  { id:'uncharted-2',   title:'Uncharted 2',                          note:'~8-10h',   h:9,    series:'Uncharted',   img:'covers/uncharted-2.jpg' },
  { id:'tr3',           title:'Tomb Raider III (Remaster)',           note:'~8-10h',   h:9,    series:'Tomb Raider', img:'covers/tr3.png' },
  { id:'re1',           title:'Resident Evil 1',                      note:'~8-10h',   h:9,    series:'Resident Evil', img:'covers/re1.jpg' },
  { id:'uncharted-3',   title:'Uncharted 3',                          note:'~8-10h',   h:9,    series:'Uncharted',   img:'covers/uncharted-3.jpg' },
  { id:'tr4',           title:'Tomb Raider IV — The Last Revelation', note:'~8-10h',   h:9,    series:'Tomb Raider', img:'covers/tr4.png' },
  { id:'gta3',          title:'GTA III',                              note:'~10-12h',  h:11,   series:'GTA',         img:'covers/gta3.jpg' },
  { id:'re5',           title:'Resident Evil 5',                      note:'~10-12h',  h:11,   series:'Resident Evil', img:'covers/re5.jpg' },
  { id:'tr5',           title:'Tomb Raider V — Chronicles',           note:'~6-8h',    h:7,    series:'Tomb Raider', img:'covers/tr5.png' },
  { id:'gta-vc',        title:'GTA Vice City',                        note:'~12-15h',  h:13.5, series:'GTA',         img:'covers/gta-vc.jpg' },
  { id:'re6',           title:'Resident Evil 6',                      note:'~12-15h',  h:13.5, series:'Resident Evil', img:'covers/re6.jpg' },
  { id:'tr6',           title:'Tomb Raider VI — Angel of Darkness',   note:'~10-12h',  h:11,   series:'Tomb Raider', img:'covers/tr6.png' },
  { id:'mafia-3',       title:'Mafia 3',                              note:'~15-20h',  h:17.5, series:'Mafia',       img:'covers/mafia-3.jpg' },
  { id:'gta-sa',        title:'GTA San Andreas',                      note:'~25-30h',  h:27.5, series:'GTA',         img:'covers/gta-sa.jpg' },
  { id:'gta-5',         title:'GTA V',                                note:'~30h',     h:30,   series:'GTA',         img:'covers/gta-5.jpg' },
  { id:'rdr2',          title:'Red Dead Redemption 2',                note:'~50-60h',  h:55,   series:'Red Dead',    img:'covers/rdr2.jpg' },
];

// ---- coleção RESIDENT EVIL (checklist: só marcar concluído) ----
const RE_GAMES = [
  { id:'r0',      title:'Resident Evil 0 HD',                                  img:'covers/re0.jpg' },
  { id:'rdc',     title:"Resident Evil Director's Cut",                        img:'covers/re-dc.png' },
  { id:'r1',      title:'Resident Evil 1 HD',                                  img:'covers/re1.jpg' },
  { id:'r2c',     title:'Resident Evil 2 clássico',                            img:'covers/re2c.png' },
  { id:'r2r',     title:'Resident Evil 2 Remake',                              img:'covers/re2r.jpg' },
  { id:'r3c',     title:'Resident Evil 3 Nemesis clássico',                    img:'covers/re3c.jpg' },
  { id:'r3r',     title:'Resident Evil 3 Remake',                              img:'covers/re3r.jpg' },
  { id:'rcvx',    title:'Resident Evil Code: Veronica X',                      img:'covers/recvx.jpg' },
  { id:'rver',    title:'Resident Evil Veronica (remake)',  note:'não lançado', img:'covers/re-veronica.jpg' },
  { id:'r4c',     title:'Resident Evil 4 clássico',                            img:'covers/re4c.jpg' },
  { id:'r4c-ada', title:'RE4 clássico — Assignment Ada / Separate Ways', dlc:true, img:'covers/dlc-r4c-ada.jpg' },
  { id:'r4r',     title:'Resident Evil 4 Remake',                              img:'covers/re4r.jpg' },
  { id:'r4r-sw',  title:'RE4 Remake — Separate Ways',       dlc:true,          img:'covers/dlc-r4r-sw.jpg' },
  { id:'r5',      title:'Resident Evil 5',                                     img:'covers/re5.jpg' },
  { id:'r5-lin',  title:'RE5 — Lost in Nightmares',         dlc:true,          img:'covers/dlc-r5-lin.jpg' },
  { id:'r5-de',   title:'RE5 — Desperate Escape',           dlc:true,          img:'covers/dlc-r5-de.jpg' },
  { id:'r6',      title:'Resident Evil 6',                                     img:'covers/re6.jpg' },
  { id:'rrev',    title:'Resident Evil Revelations',                           img:'covers/re-rev.jpg' },
  { id:'rrev2',   title:'Resident Evil Revelations 2',                         img:'covers/rev2.jpg' },
  { id:'r7',      title:'Resident Evil 7 biohazard',                           img:'covers/re7.jpg' },
  { id:'r7-bf1',  title:'RE7 — Banned Footage Vol. 1',      dlc:true,          img:'covers/dlc-r7-bf1.jpg' },
  { id:'r7-bf2',  title:'RE7 — Banned Footage Vol. 2',      dlc:true,          img:'covers/dlc-r7-bf2.jpg' },
  { id:'r7-nah',  title:'RE7 — Not a Hero',                 dlc:true,          img:'covers/dlc-r7-nah.jpg' },
  { id:'r7-eoz',  title:'RE7 — End of Zoe',                 dlc:true,          img:'covers/dlc-r7-eoz.jpg' },
  { id:'r8',      title:'Resident Evil Village',                               img:'covers/village.jpg' },
  { id:'r8-sor',  title:'Village — Shadows of Rose',        dlc:true,          img:'covers/dlc-r8-sor.jpg' },
  { id:'r9',      title:'Resident Evil Requiem',                               img:'covers/requiem.jpg' },
];

// ---- JOGOS PARA COMPRAR (lista de desejos com preço) ----
const BUY_GAMES = [
  { id:'b-avatar-qfb',    title:'Avatar: Quest for Balance',         price:49.50,  img:'covers/buy-avatar-qfb.jpg' },
  { id:'b-tides',         title:'Tides of Annihilation',             price:0,      img:'covers/buy-tides.jpg' },
  { id:'b-gta6',          title:'GTA VI',                            price:449.50, img:'covers/buy-gta6.jpg' },
  { id:'b-wolverine',     title:'Wolverine',                         price:399.90, img:'covers/buy-wolverine.jpg' },
  { id:'b-sh-townfall',   title:'Silent Hill: Townfall',             price:284.90, img:'covers/buy-sh-townfall.jpg' },
  { id:'b-sh-f',          title:'Silent Hill f',                     price:199.95, img:'covers/buy-sh-f.jpg' },
  { id:'b-veronica',      title:'Resident Evil Veronica',            price:0,      img:'covers/re-veronica.jpg' },
  { id:'b-gow-laufey',    title:'God of War: Laufey',                price:0,      img:'covers/buy-gow-laufey.jpg' },
  { id:'b-avatar-legends',title:'Avatar Legends',                    price:169.90, img:'covers/buy-avatar-legends.jpg' },
  { id:'b-kena',          title:'Kena: Scars of Kosmora',            price:0,      img:'covers/buy-kena.jpg' },
  { id:'b-itt',           title:'It Takes Two',                      price:59.67,  img:'covers/buy-itt.jpg' },
  { id:'b-tr-legacy',     title:'Tomb Raider: Legacy of Atlantis',   price:339.90, img:'covers/buy-tr-legacy.jpg' },
  { id:'b-crash',         title:'Crash Bandicoot Trilogy',           price:229.90, img:'covers/buy-crash.jpg' },
  { id:'b-apt-resonance', title:'Resonance: A Plague Tale Legacy',   price:339.90, img:'covers/buy-apt-resonance.jpg' },
  { id:'b-yotei',         title:'Ghost of Yotei',                    price:399.90, img:'covers/buy-yotei.jpg' },
];

const KEY = 'jogos.status.v2';
const OLD_KEY = 'zerados.v1';
const KEY_RE = 're.done.v1';
const KEY_PRICES = 'buy.prices.v1';
const KEY_BOUGHT = 'buy.bought.v1';
const KEY_DELETED = 'jogos.deleted.v1';
const KEY_DELETED_BUY = 'buy.deleted.v1';
let reDone = new Set(JSON.parse(localStorage.getItem(KEY_RE) || '[]'));
let priceOverride = JSON.parse(localStorage.getItem(KEY_PRICES) || '{}');
let bought = new Set(JSON.parse(localStorage.getItem(KEY_BOUGHT) || '[]'));
let deletedGames = new Set(JSON.parse(localStorage.getItem(KEY_DELETED) || '[]'));
let deletedBuy = new Set(JSON.parse(localStorage.getItem(KEY_DELETED_BUY) || '[]'));
const liveGames = () => GAMES.filter(g => !deletedGames.has(g.id));
const liveBuy = () => BUY_GAMES.filter(g => !deletedBuy.has(g.id));

// ---- jogos adicionados pelo usuário (foto própria, guardada no aparelho) ----
const KEY_CUSTOM = { main:'games.custom.main.v1', re:'games.custom.re.v1', buy:'games.custom.buy.v1' };
function loadCustom(kind){ return JSON.parse(localStorage.getItem(KEY_CUSTOM[kind]) || '[]'); }
function saveCustom(kind, list){ localStorage.setItem(KEY_CUSTOM[kind], JSON.stringify(list)); }
function removeCustom(kind, id){
  saveCustom(kind, loadCustom(kind).filter(g => g.id !== id));
  const arr = kind === 'main' ? GAMES : kind === 're' ? RE_GAMES : BUY_GAMES;
  const i = arr.findIndex(g => g.id === id);
  if(i !== -1) arr.splice(i, 1);
}

loadCustom('main').forEach(g => GAMES.push(g));
loadCustom('re').forEach(g => RE_GAMES.push(g));
loadCustom('buy').forEach(g => BUY_GAMES.push(g));

const priceOf = g => (g.id in priceOverride) ? priceOverride[g.id] : g.price;
const brl = n => n.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const buyToGame = g => ({ id:g.id, title:g.title, img:g.img, h:0, series:'NOVO', note:'' });

// jogos já comprados entram na lista principal (aba Todos)
BUY_GAMES.forEach(g => { if(bought.has(g.id)) GAMES.push(buyToGame(g)); });

// status: 'todo' -> 'playing' -> 'done' -> 'todo'
let status = loadStatus();
let filter = 'all';

function loadStatus(){
  const raw = localStorage.getItem(KEY);
  if(raw) return JSON.parse(raw);
  // migra da versão antiga (só tinha "zerado ou não")
  const oldDone = JSON.parse(localStorage.getItem(OLD_KEY) || '[]');
  const s = {};
  oldDone.forEach(id => s[id] = 'done');
  return s;
}

const RIBBON = { playing:'JOGANDO', done:'ZERADO' };

const $ = s => document.querySelector(s);
const grid = $('#grid');
const CIRC = 2 * Math.PI * 52; // 326.7

function save(){ localStorage.setItem(KEY, JSON.stringify(status)); }
function st(id){ return status[id] || 'todo'; }

function card(g, mini){
  const s = st(g.id);
  const el = document.createElement('div');
  el.className = 'card status-' + s + (mini ? ' mini' : '');
  el.dataset.id = g.id;
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-pressed', s === 'done');
  el.innerHTML = `
    <div class="cover">
      <img src="${g.img}" alt="${g.title}" loading="lazy" draggable="false"
           onerror="this.style.opacity=.25;this.style.background='#241a33'">
      <div class="ribbon">${RIBBON[s] || ''}</div>
      ${g.note ? `<span class="badge-time">${g.note}</span>` : ''}
      ${g.series ? `<span class="tag-series">${g.series}</span>` : ''}
      <button class="btn-del" type="button" aria-label="Excluir ${g.title}">🗑</button>
      <span class="check">
        <svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6"/></svg>
        <svg class="dot" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="currentColor" stroke="none"/></svg>
      </span>
    </div>
    <div class="name">${g.title}</div>`;
  el.addEventListener('click', e => { if(!suppressClick) tapToggle(g, e); });
  el.addEventListener('keydown', e => {
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); tapToggle(g, e); }
  });
  el.querySelector('.btn-del').addEventListener('click', ev => {
    ev.stopPropagation();
    if(!confirm(`Excluir "${g.title}" da lista? Essa ação não pode ser desfeita.`)) return;
    if(g.id.startsWith('custom-')) removeCustom('main', g.id);
    else { deletedGames.add(g.id); localStorage.setItem(KEY_DELETED, JSON.stringify([...deletedGames])); }
    delete status[g.id]; save();
    toast(`🗑 ${g.title} excluído`);
    render(); updateStats();
  });
  enableDrag(el, g);
  return el;
}

// confete ao marcar um jogo como concluído
function burstConfetti(x, y){
  if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#f5a623', '#2ed573', '#8b5cf6', '#ff6b9d', '#4dd2ff'];
  const n = 26;
  for(let i = 0; i < n; i++){
    const p = document.createElement('span');
    p.className = 'confetti-piece';
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 130;
    p.style.setProperty('--x0', x + 'px');
    p.style.setProperty('--y0', y + 'px');
    p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--dy', (Math.sin(angle) * dist * 0.6 - 40) + 'px');
    p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
    p.style.setProperty('--dur', (700 + Math.random() * 500) + 'ms');
    p.style.background = colors[i % colors.length];
    if(Math.random() > 0.5) p.style.borderRadius = '50%';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1300);
  }
}

// card da lista de compras: preço editável + botão Comprei
function cardBuy(g){
  const el = document.createElement('div');
  el.className = 'card card-buy';
  el.dataset.id = g.id;
  const p = priceOf(g);
  el.innerHTML = `
    <div class="cover">
      <img src="${g.img}" alt="${g.title}" loading="lazy" draggable="false"
           onerror="this.style.opacity=.25;this.style.background='#241a33'">
      <span class="price-tag">${p > 0 ? brl(p) : 'sem preço'}</span>
    </div>
    <div class="name">${g.title}</div>
    <div class="buy-actions">
      <button class="btn-edit" type="button">✏️ preço</button>
      <button class="btn-buy" type="button">✔ comprei</button>
      <button class="btn-del-buy" type="button" aria-label="Remover ${g.title}">🗑</button>
    </div>`;
  el.querySelector('.btn-edit').addEventListener('click', () => {
    const cur = priceOf(g);
    const raw = prompt(`Novo preço de ${g.title} (R$):`, cur ? String(cur).replace('.', ',') : '');
    if(raw === null) return;
    const val = parseFloat(raw.replace(/[R$\s.]/g, '').replace(',', '.'));
    if(isNaN(val) || val < 0){ toast('Valor inválido'); return; }
    priceOverride[g.id] = val;
    localStorage.setItem(KEY_PRICES, JSON.stringify(priceOverride));
    el.querySelector('.price-tag').textContent = val > 0 ? brl(val) : 'sem preço';
    toast(`💰 ${g.title}: ${brl(val)}`);
    updateStats();
  });
  el.querySelector('.btn-buy').addEventListener('click', () => {
    if(!confirm(`Comprou ${g.title}? Ele vai pra aba Todos.`)) return;
    bought.add(g.id);
    localStorage.setItem(KEY_BOUGHT, JSON.stringify([...bought]));
    GAMES.push(buyToGame(g));
    toast(`🛒 ${g.title} comprado! Já está em Todos`);
    render(); updateStats();
  });
  el.querySelector('.btn-del-buy').addEventListener('click', () => {
    if(!confirm(`Remover "${g.title}" da lista de compras?`)) return;
    if(g.id.startsWith('custom-')) removeCustom('buy', g.id);
    else { deletedBuy.add(g.id); localStorage.setItem(KEY_DELETED_BUY, JSON.stringify([...deletedBuy])); }
    if(g.id in priceOverride){ delete priceOverride[g.id]; localStorage.setItem(KEY_PRICES, JSON.stringify(priceOverride)); }
    toast(`🗑 ${g.title} removido`);
    render(); updateStats();
  });
  return el;
}

// card da coleção RE: só concluído/não concluído, sem arrasto
function cardRE(g){
  const isDone = reDone.has(g.id);
  const isCustom = g.id.startsWith('custom-');
  const el = document.createElement('div');
  el.className = 'card status-' + (isDone ? 'done' : 'todo');
  el.dataset.id = g.id;
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-pressed', isDone);
  el.innerHTML = `
    <div class="cover">
      <img src="${g.img}" alt="${g.title}" loading="lazy" draggable="false"
           onerror="this.style.opacity=.25;this.style.background='#241a33'">
      <div class="ribbon">CONCLUÍDO</div>
      ${g.note ? `<span class="badge-time">${g.note}</span>` : ''}
      ${g.dlc ? `<span class="tag-series tag-dlc">DLC</span>` : ''}
      ${isCustom ? `<button class="btn-del" type="button" aria-label="Excluir ${g.title}">🗑</button>` : ''}
      <span class="check">
        <svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6"/></svg>
      </span>
    </div>
    <div class="name">${g.title}</div>`;
  if(isCustom){
    el.querySelector('.btn-del').addEventListener('click', ev => {
      ev.stopPropagation();
      if(!confirm(`Excluir "${g.title}" da coleção?`)) return;
      reDone.delete(g.id);
      localStorage.setItem(KEY_RE, JSON.stringify([...reDone]));
      removeCustom('re', g.id);
      toast(`🗑 ${g.title} excluído`);
      render(); updateStats();
    });
  }
  el.addEventListener('click', ev => {
    if(reDone.has(g.id)){ reDone.delete(g.id); }
    else {
      reDone.add(g.id);
      toast(`✔ ${g.title} concluído!`);
      burstConfetti(ev.clientX, ev.clientY);
    }
    localStorage.setItem(KEY_RE, JSON.stringify([...reDone]));
    el.className = 'card status-' + (reDone.has(g.id) ? 'done' : 'todo');
    el.setAttribute('aria-pressed', reDone.has(g.id));
    updateStats();
  });
  return el;
}

// toque rápido: pendente/jogando -> zerado; zerado -> pendente
function tapToggle(g, ev){
  if(st(g.id) === 'done'){ delete status[g.id]; }
  else {
    status[g.id] = 'done';
    toast(`✔ ${g.title} zerado!`);
    if(ev) burstConfetti(ev.clientX, ev.clientY);
  }
  save(); render(); updateStats();
}

// ---- arrastar pra prateleira EM ANDAMENTO ----
let drag = null, suppressClick = false;
const preventScroll = e => e.preventDefault();
const shelfEl = () => $('#shelf');

function overShelf(ev){
  const r = shelfEl().getBoundingClientRect();
  return ev.clientX >= r.left && ev.clientX <= r.right &&
         ev.clientY >= r.top  && ev.clientY <= r.bottom;
}

function enableDrag(el, g){
  el.addEventListener('pointerdown', e => {
    if(e.pointerType === 'mouse' && e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY;
    const timer = setTimeout(start, 300);

    function start(){
      drag = { g };
      suppressClick = true;
      if(navigator.vibrate) navigator.vibrate(25);
      document.body.classList.add('dragging');
      document.addEventListener('touchmove', preventScroll, { passive:false });
      const r = el.getBoundingClientRect();
      const ghost = el.cloneNode(true);
      ghost.className = 'card ghost status-' + st(g.id);
      ghost.style.width = Math.min(r.width, 130) + 'px';
      document.body.appendChild(ghost);
      drag.ghost = ghost;
      el.classList.add('drag-src');
      drag.src = el;
      shelfEl().classList.add('drop-ready');
      move(e);
    }
    function move(ev){
      if(!drag) return;
      const gh = drag.ghost;
      gh.style.left = (ev.clientX - gh.offsetWidth/2) + 'px';
      gh.style.top  = (ev.clientY - gh.offsetHeight*0.75) + 'px';
      shelfEl().classList.toggle('drop-over', overShelf(ev));
    }
    function onMove(ev){
      if(drag){ move(ev); return; }
      // moveu antes do tempo = está rolando a tela, cancela o arrasto
      if(Math.hypot(ev.clientX - sx, ev.clientY - sy) > 10) cleanup();
    }
    function onUp(ev){
      if(drag){
        const cur = st(g.id);
        if(overShelf(ev) && cur !== 'playing'){
          status[g.id] = 'playing'; toast(`▶ ${g.title} em andamento`);
        } else if(!overShelf(ev) && cur === 'playing'){
          delete status[g.id]; toast(`${g.title} voltou pra lista`);
        }
        save(); updateStats();
      }
      cleanup();
    }
    function cleanup(){
      clearTimeout(timer);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      if(drag){
        if(drag.ghost) drag.ghost.remove();
        if(drag.src) drag.src.classList.remove('drag-src');
        document.body.classList.remove('dragging');
        document.removeEventListener('touchmove', preventScroll);
        shelfEl().classList.remove('drop-ready','drop-over');
        drag = null;
        render();
        setTimeout(() => { suppressClick = false; }, 80);
      }
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  });
}

function render(){
  const games = liveGames();
  const playing = games.filter(g => st(g.id) === 'playing');
  const shelf = shelfEl(), row = $('#shelfRow');

  if(filter === 're'){
    shelf.hidden = true;
    grid.innerHTML = '';
    RE_GAMES.forEach(g => grid.appendChild(cardRE(g)));
    $('#empty').hidden = true;
  } else if(filter === 'buy'){
    shelf.hidden = true;
    const list = liveBuy().filter(g => !bought.has(g.id));
    grid.innerHTML = '';
    list.forEach(g => grid.appendChild(cardBuy(g)));
    $('#empty').hidden = list.length > 0;
  } else if(filter === 'all'){
    shelf.hidden = false;
    row.innerHTML = '';
    playing.forEach(g => row.appendChild(card(g, true)));
    $('#shelfEmpty').hidden = playing.length > 0;
    const rest = games.filter(g => st(g.id) !== 'playing');
    grid.innerHTML = '';
    rest.forEach(g => grid.appendChild(card(g)));
    $('#empty').hidden = true;
  } else {
    shelf.hidden = true;
    const list = games.filter(g => st(g.id) === filter);
    grid.innerHTML = '';
    list.forEach(g => grid.appendChild(card(g)));
    $('#empty').hidden = list.length > 0;
  }
}

function updateStats(){
  let total, d, line;
  if(filter === 're'){
    total = RE_GAMES.length;
    d = reDone.size;
    line = `coleção Resident Evil · ${d} de ${total} concluídos`;
  } else if(filter === 'buy'){
    const buyList = liveBuy();
    total = buyList.length;
    d = bought.size;
    const invest = buyList.filter(g => !bought.has(g.id))
                          .reduce((s,g) => s + priceOf(g), 0);
    line = `total a investir: ${brl(invest)} · ${d} comprados`;
  } else {
    const games = liveGames();
    total = games.length;
    d = games.filter(g => st(g.id) === 'done').length;
    const p = games.filter(g => st(g.id) === 'playing').length;
    const hTotal = games.reduce((s,g)=>s+g.h, 0);
    const hDone  = games.filter(g=>st(g.id)==='done').reduce((s,g)=>s+g.h, 0);
    line = `${Math.round(hDone)} h zeradas · ${p} em andamento · ${Math.round(hTotal - hDone)} h restando`;
  }
  const pct = total ? Math.round(d / total * 100) : 0;
  $('#doneCount').textContent = d;
  $('#totalCount').textContent = total;
  $('#pct').textContent = pct + '%';
  $('#hoursLine').textContent = line;
  $('#bar').style.width = pct + '%';
  $('#ringFg').style.strokeDashoffset = CIRC * (1 - d/total);
}

// filtros
$('#filters').addEventListener('click', e=>{
  const b = e.target.closest('.chip'); if(!b) return;
  filter = b.dataset.filter;
  document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('is-active', c===b));
  render();
  updateStats();
});

// limpar (só a aba ativa)
$('#resetBtn').addEventListener('click', ()=>{
  if(filter === 're'){
    if(!reDone.size) return;
    if(confirm('Desmarcar toda a coleção Resident Evil?')){
      reDone.clear(); localStorage.setItem(KEY_RE, '[]'); render(); updateStats();
    }
  } else if(filter === 'buy'){
    if(!Object.keys(priceOverride).length) return;
    if(confirm('Restaurar os preços originais?')){
      priceOverride = {}; localStorage.setItem(KEY_PRICES, '{}'); render(); updateStats();
    }
  } else {
    if(!Object.keys(status).length) return;
    if(confirm('Desmarcar todo o progresso (andamento e zerados)?')){
      status = {}; save(); render(); updateStats();
    }
  }
});

// toast
let toastT;
function toast(msg){
  let t = $('#toast');
  if(!t){ t = document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(()=>t.classList.remove('show'), 1600);
}

render();
updateStats();

// ---- adicionar jogo próprio (nome + foto do celular) ----
(function setupAddGame(){
  const fab = $('#fabAdd'), overlay = $('#addOverlay'), form = $('#addForm');
  const titleInp = $('#addTitle'), photoInp = $('#addPhoto'), preview = $('#addPreview');
  const previewImg = preview.querySelector('img');
  const catSel = $('#addCategory'), noteInp = $('#addNote'), priceInp = $('#addPrice');
  const fieldHours = $('#fieldHours'), fieldPrice = $('#fieldPrice');
  let photoDataUrl = '';

  function openModal(){
    form.reset();
    photoDataUrl = '';
    preview.hidden = true;
    catSel.value = (filter === 're' || filter === 'buy') ? filter : 'main';
    syncFields();
    overlay.hidden = false;
    setTimeout(() => titleInp.focus(), 50);
  }
  function closeModal(){ overlay.hidden = true; }
  function syncFields(){
    fieldHours.hidden = catSel.value !== 'main';
    fieldPrice.hidden = catSel.value !== 'buy';
  }

  // reduz e comprime a foto pra não pesar no armazenamento do aparelho
  function readAndCompress(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const maxW = 640;
          const scale = Math.min(1, maxW / img.width);
          const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  fab.addEventListener('click', openModal);
  $('#addCancel').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if(e.target === overlay) closeModal(); });
  catSel.addEventListener('change', syncFields);

  photoInp.addEventListener('change', async () => {
    const file = photoInp.files[0];
    if(!file) return;
    try{
      photoDataUrl = await readAndCompress(file);
      previewImg.src = photoDataUrl;
      preview.hidden = false;
    }catch{ toast('Não consegui ler essa imagem'); }
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const title = titleInp.value.trim();
    if(!title){ toast('Digite o nome do jogo'); return; }
    if(!photoDataUrl){ toast('Escolha uma foto pro jogo'); return; }

    const id = 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const cat = catSel.value;

    if(cat === 'main'){
      const g = { id, title, note: noteInp.value.trim(), h: 0, series: 'MEU', img: photoDataUrl };
      GAMES.push(g);
      saveCustom('main', [...loadCustom('main'), g]);
    } else if(cat === 're'){
      const g = { id, title, img: photoDataUrl };
      RE_GAMES.push(g);
      saveCustom('re', [...loadCustom('re'), g]);
    } else {
      const raw = priceInp.value.trim();
      const price = raw ? parseFloat(raw.replace(/[R$\s.]/g, '').replace(',', '.')) : 0;
      const g = { id, title, price: isNaN(price) ? 0 : price, img: photoDataUrl };
      BUY_GAMES.push(g);
      saveCustom('buy', [...loadCustom('buy'), g]);
    }

    filter = cat === 'main' ? 'all' : cat;
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c.dataset.filter === filter));
    closeModal();
    toast(`🎮 ${title} adicionado!`);
    render(); updateStats();
  });
})();

// fundo com partículas sutis flutuando
(function setupBgFx(){
  const host = $('#bgFx');
  if(!host || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  const colors = ['#8b5cf6', '#f5a623', '#2ed573', '#4dd2ff'];
  const n = 10;
  for(let i = 0; i < n; i++){
    const p = document.createElement('span');
    const size = 60 + Math.random() * 140;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = Math.random() * 100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.opacity = (0.08 + Math.random() * 0.10).toFixed(2);
    p.style.animationDuration = (14 + Math.random() * 14) + 's';
    p.style.animationDelay = (Math.random() * -20) + 's';
    host.appendChild(p);
  }
})();

// service worker (offline / instalável)
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=> navigator.serviceWorker.register('sw.js').catch(()=>{}));
  // quando uma versão nova do app assumir, recarrega uma vez pra aplicar na hora
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', ()=>{
    if(navigator.serviceWorker.controller && !reloaded){ reloaded = true; location.reload(); }
  });
}
