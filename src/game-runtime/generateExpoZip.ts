import JSZip from 'jszip'
import { getStandaloneEngineSource } from './standaloneEngine'
import { slug } from './generateZip'
import type { GameProject } from '../types'

// Same Phaser build the web export uses. Bundled into the Android app so mini-games work offline.
export const PHASER_URL = 'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js'

// Versions verified together on an Android emulator (see the spike in the project notes).
const EXPO_DEPS: Record<string, string> = {
  expo: '~58.0.25',
  'expo-status-bar': '~58.0.5',
  react: '19.3.0',
  'react-native': '0.88.1',
  'react-native-webview': '14.0.1',
  'expo-speech': '~58.0.4',
}

// Bluetooth permissions pulled in by dependencies; the game never uses them.
const BLOCKED_PERMISSIONS = [
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_ADMIN',
  'android.permission.BLUETOOTH_SCAN',
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.BLUETOOTH_ADVERTISE',
]

const JAVA_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue',
  'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if',
  'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package', 'private',
  'protected', 'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this',
  'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while', 'true', 'false', 'null',
])

/** Downloads phaser.min.js so it can be bundled. Throws a readable error when offline. */
export async function fetchPhaser(): Promise<string> {
  let res: Response
  try {
    res = await fetch(PHASER_URL)
  } catch {
    throw new Error('Could not download Phaser for the Android build. Check your internet connection and try again.')
  }
  if (!res.ok) throw new Error(`Could not download Phaser (HTTP ${res.status}).`)
  return res.text()
}

/** Android package ids: lowercase dot-separated segments that are not Java keywords. */
export function resolvePackageId(givenId: string | undefined, name: string): string {
  const given = givenId?.trim()
  if (given) {
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(given)) {
      throw new Error(`Package ID "${given}" is not valid. Use lowercase parts separated by dots, like com.yourcompany.yourgame.`)
    }
    if (given.split('.').some((part) => JAVA_KEYWORDS.has(part))) {
      throw new Error(`Package ID "${given}" uses a Java keyword as one of its parts.`)
    }
    return given
  }
  let ident = name.replace(/-/g, '_')
  if (!/^[a-z]/.test(ident)) ident = `g${ident}`
  if (JAVA_KEYWORDS.has(ident)) ident = `${ident}_app`
  return `com.adventuregame.${ident}`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const APP_JS = [
  "import { useEffect, useRef } from 'react';",
  "import { BackHandler, SafeAreaView, StyleSheet } from 'react-native';",
  "import { WebView } from 'react-native-webview';",
  "import { StatusBar } from 'expo-status-bar';",
  "import * as Speech from 'expo-speech';",
  '',
  '// Hardware Back is sent to the game as the Escape key, which closes menus and story books.',
  '// It never exits the app, so the game controls when the player leaves.',
  "const BACK_TO_GAME = \"window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); true;\";",
  '',
  '// Keeps a number from the game inside the range the speech engine accepts.',
  'const clamp = (v, lo, hi, fallback) => (typeof v === \'number\' && !Number.isNaN(v) ? Math.min(hi, Math.max(lo, v)) : fallback);',
  '',
  '// Chooses the device voice for a story page. Browser voice names differ from Android voice names, so the exact',
  '// name is tried first, then the best installed voice for the page\'s language, then the device default.',
  'const pickVoice = async (name, lang) => {',
  '  const voices = await Speech.getAvailableVoicesAsync();',
  '  const norm = (t) => String(t || \'\').toLowerCase().replace(\'_\', \'-\');',
  '  const exact = name ? voices.find((v) => v.name === name || v.identifier === name) : undefined;',
  '  if (exact) return exact.identifier;',
  '  const want = norm(lang);',
  '  if (!want) return undefined;',
  '  const sameLang = voices.filter((v) => norm(v.language) === want);',
  '  const candidates = sameLang.length > 0',
  '    ? sameLang',
  '    : voices.filter((v) => norm(v.language).split(\'-\')[0] === want.split(\'-\')[0]);',
  '  candidates.sort((a, b) => (b.quality === \'Enhanced\' ? 1 : 0) - (a.quality === \'Enhanced\' ? 1 : 0));',
  '  return candidates.length > 0 ? candidates[0].identifier : undefined;',
  '};',
  'export default function App() {',
  '  const webRef = useRef(null);',
  '',
  '  useEffect(() => {',
  "    const sub = BackHandler.addEventListener('hardwareBackPress', () => {",
  '      webRef.current?.injectJavaScript(BACK_TO_GAME);',
  '      return true;',
  '    });',
  '    return () => sub.remove();',
  '  }, []);',
  '',
  '  // Story narration. The game asks for speech over the bridge because WebView speech is unreliable on Android.',
  '  const speechDone = (id) => {',
  "    webRef.current?.injectJavaScript('window.__agbSpeechDone && window.__agbSpeechDone(' + Number(id) + '); true;');",
  '  };',
  '',
  '  const onMessage = (event) => {',
  '    let msg;',
  '    try { msg = JSON.parse(event.nativeEvent.data); } catch (err) { return; }',
  '    if (msg.type === \'speak\') {',
  '      Speech.stop();',
  '      pickVoice(msg.voiceName, msg.voiceLang)',
  '        .catch(() => undefined)',
  '        .then((voice) => {',
  '          Speech.speak(String(msg.text || \'\'), {',
  '            voice,',
  '            rate: clamp(msg.rate, 0.5, 2, 1),',
  '            pitch: clamp(msg.pitch, 0.5, 2, 1),',
  '            onDone: () => speechDone(msg.id),',
  '            onStopped: () => speechDone(msg.id),',
  '            onError: () => speechDone(msg.id),',
  '          });',
  '        });',
  '    } else if (msg.type === \'stopSpeech\') {',
  "    } else if (msg.type === 'stopSpeech') {",
  '      Speech.stop();',
  '    }',
  '  };',
  '',
  '  return (',
  '    <SafeAreaView style={styles.container}>',
  '      <StatusBar hidden />',
  '      <WebView',
  '        ref={webRef}',
  "        source={{ uri: 'file:///android_asset/web/index.html' }}",
  "        originWhitelist={['*']}",
  '        allowFileAccess={true}',
  '        allowUniversalAccessFromFileURLs={true}',
  "        allowingReadAccessToURL=\"file:///android_asset/web/\"",
  '        domStorageEnabled={true}',
  '        javaScriptEnabled={true}',
  '        mediaPlaybackRequiresUserAction={false}',
  '        setSupportMultipleWindows={false}',
  '        onMessage={onMessage}',
  '        style={styles.webview}',
  '      />',
  '    </SafeAreaView>',
  '  );',
  '}',
  '',
  'const styles = StyleSheet.create({',
  "  container: { flex: 1, backgroundColor: '#000' },",
  '  webview: { flex: 1, backgroundColor: \'#000\' },',
  '});',
  '',
].join('\n')

const INDEX_JS = [
  "import { registerRootComponent } from 'expo';",
  "import App from './App';",
  '',
  'registerRootComponent(App);',
  '',
].join('\n')

// Copies the bundled web/ folder into the Android app's assets on every `expo prebuild`.
const PLUGIN_JS = [
  "const fs = require('fs');",
  "const path = require('path');",
  "const { withDangerousMod } = require('expo/config-plugins');",
  '',
  '// The game is served from the APK itself: file:///android_asset/web/index.html (no server, works offline).',
  'module.exports = function withGameWebAssets(config) {',
  "  return withDangerousMod(config, ['android', async (cfg) => {",
  "    const src = path.join(cfg.modRequest.projectRoot, 'web');",
  "    const dest = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'assets', 'web');",
  "    if (!fs.existsSync(path.join(src, 'index.html'))) {",
  "      throw new Error('web/index.html is missing. Re-export the Android project from the builder.');",
  '    }',
  '    fs.rmSync(dest, { recursive: true, force: true });',
  '    fs.mkdirSync(path.dirname(dest), { recursive: true });',
  '    fs.cpSync(src, dest, { recursive: true });',
  '    return cfg;',
  '  }]);',
  '};',
  '',
].join('\n')

const WEB_MAIN_JS = [
  "import { GameEngine } from './engine.js';",
  '',
  "const canvas = document.getElementById('game-canvas');",
  'if (!canvas) throw new Error(\'Canvas element not found\');',
  'new GameEngine(canvas, window.__GAME_DATA__).start();',
  '',
].join('\n')

const WEB_STYLE_CSS = `*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #000; height: 100%; overflow: hidden; touch-action: none; }
#app { display: flex; align-items: center; justify-content: center; width: 100vw; height: 100vh; }
#game-canvas {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  -webkit-user-drag: none;
}
`

function readme(title: string, pkg: string): string {
  return [
    `# ${title} (Android)`,
    '',
    'Generated by Adventure Game Builder. This is a complete Expo project: the game runs in a WebView',
    'and is bundled inside the app, so it works offline.',
    '',
    '## Requirements',
    '',
    '- Node.js 22.13 or newer (Expo SDK 58 does not run on Node 20).',
    '- Android Studio with the Android SDK. Set `ANDROID_HOME` (for example `~/Android/Sdk`).',
    '- A JDK 17 for Gradle.',
    '',
    '## Build a release APK',
    '',
    '```bash',
    'npm install',
    'npx expo prebuild --platform android',
    'cd android',
    './gradlew assembleRelease',
    '```',
    '',
    'The APK is written to `android/app/build/outputs/apk/release/app-release.apk`.',
    '',
    'Run `npx expo prebuild --platform android` again after changing the game in the builder, so the',
    'new `web/` folder is copied into the app.',
    '',
    '## Run on a phone or emulator',
    '',
    '```bash',
    'npx expo run:android',
    '```',
    '',
    '## Notes',
    '',
    `- Package ID: \`${pkg}\` (change it in Settings → Android App in the builder).`,
    '- The release build is signed with the debug key so it installs on a device.',
    '  Create a release keystore before uploading to the Play Store.',
    '- Hardware Back closes menus and story books. It does not exit the app.',
    '- Bluetooth permissions are removed in `app.json` (`blockedPermissions`).',
    '',
    '## Project layout',
    '',
    '- `web/` the game (engine, game data, Phaser, styles). Edit only by re-exporting from the builder.',
    '- `plugins/withGameWebAssets.js` copies `web/` into the Android assets on prebuild.',
    '- `App.js` the WebView shell.',
    '- `app.json` app name, package ID, version and orientation.',
    '',
  ].join('\n')
}

export async function generateExpoZip(project: GameProject): Promise<Blob> {
  const phaser = await fetchPhaser()
  const zip = new JSZip()
  const title = project.settings.title || 'My Adventure Game'
  const name = slug(title)
  const w = project.settings.resolutionWidth || 1280
  const h = project.settings.resolutionHeight || 720
  const version = project.settings.version || '1.0.0'
  const pkg = resolvePackageId(project.settings.androidPackageId, name)
  const versionCode = Math.max(1, Math.floor(project.settings.versionCode ?? 1))
  const orientation = project.settings.orientation ?? (w >= h ? 'landscape' : 'portrait')

  zip.file('package.json', JSON.stringify({
    name,
    version,
    private: true,
    main: 'index.js',
    scripts: {
      start: 'expo start',
      android: 'expo run:android',
      prebuild: 'expo prebuild --platform android',
    },
    dependencies: EXPO_DEPS,
  }, null, 2) + '\n')

  zip.file('app.json', JSON.stringify({
    expo: {
      name: title,
      slug: name,
      version,
      orientation,
      backgroundColor: '#000000',
      android: {
        package: pkg,
        versionCode,
        blockedPermissions: BLOCKED_PERMISSIONS,
      },
      plugins: ['./plugins/withGameWebAssets.js'],
    },
  }, null, 2) + '\n')

  zip.file('index.js', INDEX_JS)
  zip.file('App.js', APP_JS)
  zip.file('plugins/withGameWebAssets.js', PLUGIN_JS)
  zip.file('README.md', readme(title, pkg))

  // web/ is the prebuilt game. It is copied into the Android assets by the plugin.
  zip.file('web/index.html', `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <div id="app">
      <canvas id="game-canvas" width="${w}" height="${h}" draggable="false"></canvas>
    </div>
    <script src="phaser.min.js"></script>
    <script src="game-data.js"></script>
    <script type="module" src="main.js"></script>
  </body>
</html>
`)
  zip.file('web/style.css', WEB_STYLE_CSS)
  zip.file('web/phaser.min.js', phaser)
  zip.file('web/engine.js', getStandaloneEngineSource())
  zip.file('web/main.js', WEB_MAIN_JS)
  // The game data is a classic script, not JSON: fetch() does not work from file:// inside the WebView.
  zip.file('web/game-data.js', `window.__GAME_DATA__ = ${JSON.stringify(project).replace(/<\//g, '<\\/')};\n`)

  return zip.generateAsync({ type: 'blob' })
}
