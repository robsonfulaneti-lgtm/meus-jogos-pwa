// Pastas: agrupa os jogos do catálogo que são do mesmo "mundo" (série/franquia).
// 1) regras pras séries conhecidas (pegam nomes que não começam igual, tipo "Shadow of the Tomb Raider")
// 2) agrupamento automático pelo começo do nome ("Far Cry 4", "Far Cry Primal" -> Far Cry)

const RULES = [
  ['resident-evil',   'Resident Evil',          /\bresident evil\b|\bbiohazard\b|\bumbrella corps\b/],
  ['gta',             'Grand Theft Auto',       /\bgrand theft auto\b|\bgta\b/],
  ['tomb-raider',     'Tomb Raider',            /\btomb raider\b|\blara croft\b/],
  ['plague-tale',     'A Plague Tale',          /\bplague tale\b/],
  ['uncharted',       'Uncharted',              /\buncharted\b/],
  ['last-of-us',      'The Last of Us',         /\blast of us\b/],
  ['god-of-war',      'God of War',             /\bgod of war\b/],
  ['spider-man',      'Marvel\'s Spider-Man',   /\bspider ?man\b/],
  ['horizon',         'Horizon',                /^horizon\b/],
  ['crash',           'Crash Bandicoot',        /\bcrash\b/],
  ['silent-hill',     'Silent Hill',            /\bsilent hill\b/],
  ['far-cry',         'Far Cry',                /\bfar ?cry\b/],
  ['ea-fc',           'EA Sports FC / FIFA',    /\bfifa\b|\bea sports fc\b/],
  ['mortal-kombat',   'Mortal Kombat',          /\bmortal kombat\b/],
  ['call-of-duty',    'Call of Duty',           /\bcall of duty\b/],
  ['assassins-creed', 'Assassin\'s Creed',      /\bassassin s creed\b/],
  ['life-is-strange', 'Life is Strange',        /\blife is strange\b/],
  ['mafia',           'Mafia',                  /^mafia\b/],
  ['red-dead',        'Red Dead',               /\bred dead\b/],
  ['alan-wake',       'Alan Wake',              /\balan wake\b/],
  ['evil-within',     'The Evil Within',        /\bevil within\b/],
  ['dark-pictures',   'The Dark Pictures',      /\bdark pictures\b/],
  ['ghost-of',        'Ghost of Tsushima / Yōtei', /\bghost of (tsushima|yotei)\b/],
  ['harry-potter',    'Harry Potter / Hogwarts', /\bharry potter\b|\bhogwarts\b/],
  ['fallout',         'Fallout',                /\bfallout\b/],
  ['sonic',           'Sonic',                  /\bsonic\b/],
  ['nba-2k',          'NBA 2K',                 /\bnba 2 ?k/],
  ['ufc',             'UFC',                    /\bufc\b/],
  ['motogp',          'MotoGP',                 /\bmotogp\b/],
  ['f1',              'F1',                     /^f1\b/],
  ['kena',            'Kena',                   /\bkena\b/],
  ['avatar-aang',     'Avatar: A Lenda de Aang', /\blast airbender\b|\bavatar legends\b|\bquest for balance\b/],
  ['fortnite',        'Fortnite',               /\bfortnite\b/],
];

const STOP = new Set(['the', 'lego', 'marvel', 'marvel s', 'disney', 'star', 'super', 'ea sports', 'troféus do', 'trofeus do']);
const EDITION = /\b(remastered|remaster|definitive|edition|classic|collection|ultimate|deluxe|goty|game of the year|complete|ps4|ps5|playstation \d|director s cut|hd)\b/g;
const SEQ = /^(\d+|i{1,3}|iv|v|vi{1,3}|ix|x|\d+k\d*)$/;

const clean = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[™®©•]/g, ' ').replace(/([a-z])(\d)/g, '$1 $2');
const flat = s => clean(s).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// "Far Cry® 3 Blood Dragon" -> "far cry", "Life is Strange: Before the Storm" -> "life is strange"
function autoKey(name){
  const head = clean(name).split(/:| – | - | — /)[0];
  const toks = head.replace(EDITION, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  const cut = toks.findIndex(t => SEQ.test(t));
  const key = (cut === -1 ? toks : toks.slice(0, cut)).join(' ');
  return key.length >= 4 && !STOP.has(key) ? key : null;
}
const titleCase = k => k.replace(/\b[a-z]/g, c => c.toUpperCase());
const hue = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

export function buildFolders(M){
  const map = new Map();
  const get = (id, name) => map.get(id) || map.set(id, { id, name, games: [], soon: [], hue: hue(id) }).get(id);
  const ruleOf = name => { const f = flat(name); return RULES.find(([, , re]) => re.test(f)); };

  const loose = [];
  for (const g of M.games) {
    const r = ruleOf(g.name);
    if (r) get(r[0], r[1]).games.push(g);
    else loose.push(g);
  }

  // automático: junta por chave e depois junta chaves que são começo de outras ("far cry" ⊂ "far cry new dawn")
  const byKey = new Map();
  for (const g of loose) {
    const k = autoKey(g.name);
    if (k) (byKey.get(k) || byKey.set(k, []).get(k)).push(g);
  }
  const keys = [...byKey.keys()].sort((a, b) => a.length - b.length);
  for (const k of keys) {
    const parent = keys.find(p => p !== k && k.startsWith(p + ' ') && byKey.has(p) && (p.includes(' ') || p.length >= 5));
    if (parent) { byKey.get(parent).push(...byKey.get(k)); byKey.delete(k); }
  }
  for (const [k, list] of byKey) if (list.length >= 2) get('auto-' + k.replace(/\s+/g, '-'), titleCase(k)).games.push(...list);

  // lista de desejos vira "em breve" dentro da pasta da série
  for (const w of M.watch.filter(w => !w.removed && !w.bought)) {
    const r = ruleOf(w.search || w.name);
    const k = !r && autoKey(w.search || w.name);
    const f = r ? map.get(r[0]) : k && map.get('auto-' + k.replace(/\s+/g, '-'));
    if (f) f.soon.push(w);
  }

  return [...map.values()]
    .filter(f => f.games.length >= 2 || (f.games.length >= 1 && f.soon.length >= 1))
    .map(f => {
      const played = f.games.filter(g => g.source === 'psn');
      return {
        ...f,
        games: f.games.sort(byRelease),
        plats: f.games.filter(g => g.status === 'platinum').length,
        zerados: f.games.filter(g => g.zerado).length,
        never: f.games.filter(g => g.status === 'never' && !g.zerado).length,
        minutes: played.reduce((s, g) => s + (g.playMinutes || 0), 0),
        hero: [...f.games].sort((a, b) => (b.playMinutes || 0) - (a.playMinutes || 0)).find(g => g.hero)?.hero
          || f.games.find(g => g.cover)?.cover,
      };
    })
    .sort((a, b) => b.games.length - a.games.length || a.name.localeCompare(b.name, 'pt-BR'));
}

// ordem de lançamento quando o RAWG sabe a data; senão, ordem "natural" do nome (2 antes de 10)
function byRelease(a, b){
  // data do jogo original quando o seu é remaster/definitive (GTA III de 2001, não de 2021)
  const ra = a.rating?.orig || a.rating?.released, rb = b.rating?.orig || b.rating?.released;
  if (ra && rb) return ra.localeCompare(rb);
  if (ra) return -1;
  if (rb) return 1;
  return a.name.localeCompare(b.name, 'pt-BR', { numeric: true });
}
