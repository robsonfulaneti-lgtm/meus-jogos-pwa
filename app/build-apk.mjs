// Gera o APK assinado do app.
//   cd app && npm run apk
// Usa o Java e o Android SDK portáteis de C:\Users\infra.FORMA\android-dev (nada instalado no sistema)
// e a chave de assinatura de android-dev\keys (fora do git — sem ela não dá pra atualizar o app instalado).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEV = 'C:/Users/infra.FORMA/android-dev';
const KEYS = path.join(DEV, 'keys', 'games-release.properties');
const REMOTE = 'https://meus-jogos-app.netlify.app/';
// pasta temporária simples: o Java do Windows não abre o canal interno numa pasta com nome abreviado
// (C:\Users\INFRA~1.FOR\...) e o Gradle falha com "Unable to establish loopback connection"
const TMP = path.join(DEV, 'tmp');
fs.mkdirSync(TMP, { recursive: true });
const env = {
  ...process.env, JAVA_HOME: `${DEV}/jdk`, ANDROID_HOME: `${DEV}/sdk`, ANDROID_SDK_ROOT: `${DEV}/sdk`,
  TEMP: TMP, TMP, JAVA_TOOL_OPTIONS: `-Djdk.net.unixdomain.tmpdir=${TMP} -Djava.io.tmpdir=${TMP}`,
};
// --teste = versão de depuração (dá pra inspecionar o app pelo PC); não é publicada
const TEST = process.argv.includes('--teste');
const run = (cmd, cwd = HERE) => execSync(cmd, { cwd, env, stdio: 'inherit' });

const { version } = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8'));
const [ma, mi, pa] = version.split('.').map(Number);
const versionCode = ma * 10000 + mi * 100 + pa;          // 1.2.3 -> 10203 (o Android exige que só aumente)

if (!fs.existsSync(KEYS)) throw new Error('chave de assinatura não encontrada em ' + KEYS);
const key = Object.fromEntries(fs.readFileSync(KEYS, 'utf8').split(/\r?\n/).filter(Boolean).map(l => l.split(/=(.*)/s).slice(0, 2)));

// 1) conteúdo do app + projeto Android
run('node build-www.mjs');
run('npx cap sync android');

// 2) versão no Gradle e caminho do SDK
const gradle = path.join(HERE, 'android/app/build.gradle');
fs.writeFileSync(gradle, fs.readFileSync(gradle, 'utf8')
  .replace(/versionCode \d+/, `versionCode ${versionCode}`)
  .replace(/versionName "[^"]*"/, `versionName "${version}"`));
fs.writeFileSync(path.join(HERE, 'android/local.properties'), `sdk.dir=${DEV.replace(/:/g, '\\:')}/sdk\n`);

// 3) compila e assina. A senha vai por variável de ambiente (ORG_GRADLE_PROJECT_*), só pra esta execução:
// nunca aparece na linha de comando nem em mensagem de erro, e não fica gravada no projeto.
const signEnv = {
  'ORG_GRADLE_PROJECT_android.injected.signing.store.file': key.storeFile,
  'ORG_GRADLE_PROJECT_android.injected.signing.store.password': key.storePassword,
  'ORG_GRADLE_PROJECT_android.injected.signing.key.alias': key.keyAlias,
  'ORG_GRADLE_PROJECT_android.injected.signing.key.password': key.keyPassword,
};
try {
  // caminho completo do gradlew: este Windows não roda programas da pasta atual sem ele
  execSync(`"${path.join(HERE, 'android', 'gradlew.bat')}" ${TEST ? 'assembleDebug' : 'assembleRelease'} --console=plain`,
    { cwd: path.join(HERE, 'android'), env: TEST ? env : { ...env, ...signEnv }, stdio: 'inherit' });
} catch { throw new Error('a compilação do Android falhou (veja as mensagens do Gradle acima)'); }

if (TEST) {
  const dbg = path.join(HERE, 'android/app/build/outputs/apk/debug/app-debug.apk');
  fs.mkdirSync(path.join(HERE, 'dist'), { recursive: true });
  fs.copyFileSync(dbg, path.join(HERE, 'dist', 'games-teste.apk'));
  console.log('\nAPK de TESTE (não publicar): app/dist/games-teste.apk');
  process.exit(0);
}

// 4) copia o APK e publica a versão no site (o app avisa quando tem versão nova)
const built = path.join(HERE, 'android/app/build/outputs/apk/release/app-release.apk');
const name = `games-${version}.apk`;
fs.mkdirSync(path.join(HERE, 'dist'), { recursive: true });
fs.copyFileSync(built, path.join(HERE, 'dist', name));
const pub = path.resolve(HERE, '../site/app');
fs.rmSync(pub, { recursive: true, force: true });
fs.mkdirSync(pub, { recursive: true });
fs.copyFileSync(built, path.join(pub, name));
fs.writeFileSync(path.join(pub, 'latest.json'), JSON.stringify({ version, apk: `${REMOTE}app/${name}` }));
console.log(`\nAPK pronto: app/dist/${name} (${(fs.statSync(built).size / 1024 / 1024).toFixed(1)} MB) · versionCode ${versionCode}`);
