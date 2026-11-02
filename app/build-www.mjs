// Monta app/www (o conteúdo que vai dentro do APK) a partir de site/.
// Fica de fora: seus dados da PSN (o app baixa do site na primeira vez e depois sincroniza sozinho)
// e o service worker (só serve pro site).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '../site');
const OUT = path.join(HERE, 'www');
const SKIP = new Set(['data/psn.json', 'data/seed.json', 'data/t', 'sw.js', 'app']);

fs.rmSync(OUT, { recursive: true, force: true });
let files = 0, bytes = 0;
(function copy(rel){
  const src = path.join(SITE, rel);
  for (const name of fs.readdirSync(src)) {
    const r = rel ? `${rel}/${name}` : name;
    if (SKIP.has(r)) continue;
    const s = path.join(SITE, r), d = path.join(OUT, r);
    if (fs.statSync(s).isDirectory()) { fs.mkdirSync(d, { recursive: true }); copy(r); }
    else { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(s, d); files++; bytes += fs.statSync(s).size; }
  }
})('');

const { version } = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(OUT, 'app-version.json'), JSON.stringify({ version }));
console.log(`www: ${files} arquivos, ${(bytes / 1024 / 1024).toFixed(1)} MB, versão ${version}`);
