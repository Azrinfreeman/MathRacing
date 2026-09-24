// Build an installable Android APK for testing on tablets and smartboards. Run with: npm run apk
//   1. builds the web app (dist/), 2. copies it into the Capacitor Android project (android/),
//   3. runs Gradle assembleDebug, 4. copies the APK to output/apk/MathRacing-<version>-<date>-debug.apk.
// The APK is debug-signed: fine for sideloading and testing, not for the Play Store (DECISIONS #38).
// Needs JDK 17 and the Android SDK (platform 34). JAVA_HOME and ANDROID_HOME are used when set; otherwise
// the usual Windows install locations are tried.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const win = process.platform === 'win32';

function step(label, command, options = {}) {
  console.log(`> ${label}`);
  // One command string through the shell (npm/npx are .cmd files on Windows).
  const r = spawnSync(command, { stdio: 'inherit', shell: true, ...options });
  if (r.status !== 0) {
    console.error(`FAIL ${label}`);
    process.exit(r.status ?? 1);
  }
}

function findJdk17() {
  const fromEnv = process.env.JAVA_HOME?.replace(/[\\/]+$/, '');
  if (fromEnv && fromEnv.includes('17')) return fromEnv;
  const roots = [
    'C:/Program Files/Microsoft',
    'C:/Program Files/Eclipse Adoptium',
    'C:/Program Files/Java',
  ];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const r = spawnSync(win ? 'cmd' : 'ls', win ? ['/c', 'dir', '/b', root] : [root], {
      encoding: 'utf8',
    });
    const jdk = (r.stdout ?? '').split(/\r?\n/).find((d) => /^jdk-?17/.test(d.trim()));
    if (jdk) return join(root, jdk.trim());
  }
  return fromEnv; // let Gradle report a clear error if this is not a usable JDK
}

function findSdk() {
  const fromEnv = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (fromEnv) return fromEnv;
  const guess = join(homedir(), 'AppData', 'Local', 'Android', 'Sdk');
  return existsSync(guess) ? guess : null;
}

const sdk = findSdk();
if (!sdk) {
  console.error('Android SDK not found: set ANDROID_HOME.');
  process.exit(1);
}
// Forward slashes: a backslash is an escape character in .properties files.
writeFileSync('android/local.properties', `sdk.dir=${sdk.replace(/\\/g, '/')}\n`);

step('build web app', 'npm run build');
step('copy web app into android/', 'npx cap sync android');
const env = { ...process.env };
const jdk = findJdk17();
if (jdk) env.JAVA_HOME = jdk;
// Full path: some Windows shells do not look in the current folder for programs.
const gradlew = join(process.cwd(), 'android', win ? 'gradlew.bat' : 'gradlew');
step('gradle assembleDebug', `"${gradlew}" assembleDebug --no-daemon -q`, { cwd: 'android', env });

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const d = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
mkdirSync('output/apk', { recursive: true });
const target = `output/apk/MathRacing-${version}-${stamp}-debug.apk`;
copyFileSync('android/app/build/outputs/apk/debug/app-debug.apk', target);
console.log(`APK: ${target}`);
