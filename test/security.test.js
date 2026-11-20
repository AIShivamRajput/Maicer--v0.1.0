const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sanitizeSettingsPatch } = require('../src/settings/sanitize');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  if (!e.isDirectory()) return [path.join(dir, e.name)];
  if (['.git', 'dist', 'node_modules', 'tmp'].includes(e.name)) return [];
  return walk(path.join(dir, e.name));
});
const files = walk(SRC).filter((f) => /\.(js|html)$/.test(f));
const projectFiles = walk(ROOT).filter((f) => !f.endsWith('.zip') && !f.includes(`${path.sep}resources${path.sep}engine${path.sep}`));
const read = (f) => fs.readFileSync(f, 'utf8');

test('settings: accepts known keys with valid values', () => {
  assert.deepEqual(sanitizeSettingsPatch({ hotkey: 'Control+M', theme: 'dark', idleMinutes: 5 }), { hotkey: 'Control+M', theme: 'dark', idleMinutes: '5' });
  assert.deepEqual(sanitizeSettingsPatch({ startWithWindows: true }), { startWithWindows: true });
});
test('settings: rejects unknown keys (no arbitrary writes to the settings file)', () => {
  assert.throws(() => sanitizeSettingsPatch({ __proto__: null, isAdmin: true }), /unknown setting/);
  assert.throws(() => sanitizeSettingsPatch({ constructor: 'x' }), /unknown setting/);
});
test('settings: rejects bad values and bad hotkeys', () => {
  assert.throws(() => sanitizeSettingsPatch({ theme: 'neon' }), /invalid value/);
  assert.throws(() => sanitizeSettingsPatch({ startWithWindows: 'yes' }), /invalid value/);
  assert.throws(() => sanitizeSettingsPatch({ hotkey: 'M' }), /invalid value/);             // needs a modifier
  assert.throws(() => sanitizeSettingsPatch({ hotkey: 'Control+;' }), /invalid value/);
  assert.throws(() => sanitizeSettingsPatch({ hotkey: 'Control+M; calc' }), /invalid value/);
});
test('settings: rejects non-object input', () => {
  assert.throws(() => sanitizeSettingsPatch(null), /must be an object/);
  assert.throws(() => sanitizeSettingsPatch(['x']), /must be an object/);
});

test('no hard-coded secrets, keys or tokens in the source', () => {
  const patterns = [
    /sk-[A-Za-z0-9]{16,}/, /AKIA[0-9A-Z]{16}/, /ghp_[A-Za-z0-9]{20,}/, /xox[baprs]-[A-Za-z0-9-]{10,}/,
    /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/, /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}['"]/i,
  ];
  for (const f of files) for (const re of patterns) assert.ok(!re.test(read(f)), `possible secret in ${path.relative(SRC, f)}`);
});

test('repository files contain no secret-like credentials or local environment files', () => {
  const patterns = [
    /sk-[A-Za-z0-9]{16,}/, /AKIA[0-9A-Z]{16}/, /ghp_[A-Za-z0-9]{20,}/, /xox[baprs]-[A-Za-z0-9-]{10,}/,
    /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  ];
  for (const file of projectFiles) {
    const name = path.basename(file);
    assert.ok(name === '.env.example' || !(name === '.env' || name.startsWith('.env.')), `environment file in repository: ${path.relative(ROOT, file)}`);
    assert.ok(!/\.(pem|key|p12|pfx)$/i.test(name), `private-key file in repository: ${path.relative(ROOT, file)}`);
    if (/\.(js|html|json|yml|yaml|md|txt|nsh|gitignore)$/.test(name)) {
      for (const pattern of patterns) assert.ok(!pattern.test(read(file)), `possible secret in ${path.relative(ROOT, file)}`);
    }
  }
});

test('npm manifest and lockfile use the same pinned direct dependencies', () => {
  const manifest = JSON.parse(read(path.join(ROOT, 'package.json')));
  const lock = JSON.parse(read(path.join(ROOT, 'package-lock.json')));
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.packages[''].version, manifest.version);
  for (const [name, version] of Object.entries(manifest.devDependencies)) {
    assert.equal(lock.packages[''].devDependencies[name], version, `${name} is not locked to the manifest`);
  }
});

test('no external network calls: only localhost is contacted at run time', () => {
  for (const f of files) {
    const urls = read(f).match(/https?:\/\/[^\s'"`)]+/g) || [];
    for (const u of urls) assert.ok(/^https?:\/\/(127\.0\.0\.1|localhost)/.test(u) || /^https?:\/\/www\.w3\.org/.test(u), `external URL in ${path.relative(SRC, f)}: ${u}`);
  }
});

test('no dynamic code execution in the app', () => {
  for (const f of files) {
    const s = read(f);
    assert.ok(!/\beval\s*\(/.test(s), `eval in ${path.relative(SRC, f)}`);
    assert.ok(!/new Function\s*\(/.test(s), `new Function in ${path.relative(SRC, f)}`);
    assert.ok(!/shell\s*:\s*true/.test(s), `shell:true in ${path.relative(SRC, f)}`);
  }
});

test('every window keeps contextIsolation on and never enables nodeIntegration', () => {
  const main = read(path.join(SRC, 'main.js'));
  assert.ok(!/nodeIntegration\s*:\s*true/.test(main));
  const windows = main.match(/webPreferences:\s*\{[^}]*\}/g) || [];
  assert.ok(windows.length >= 2);
  for (const w of windows) assert.match(w, /contextIsolation:\s*true/, w);
  for (const w of windows) assert.match(w, /sandbox:\s*true/, `sandbox missing: ${w}`);
});

test('every page carries a content security policy that never allows inline scripts', () => {
  for (const f of files.filter((x) => x.endsWith('.html'))) {
    const csp = read(f).match(/Content-Security-Policy" content="([^"]*)"/);
    assert.ok(csp, `no CSP in ${path.relative(SRC, f)}`);
    assert.match(csp[1], /script-src 'self'/, path.relative(SRC, f));
    assert.doesNotMatch(csp[1], /script-src[^;]*unsafe-inline/, path.relative(SRC, f));
    assert.doesNotMatch(read(f), /<script>(?![\s\S]*?<\/script>\s*$)/, `inline script in ${path.relative(SRC, f)}`);
  }
});

test('every download in the build is checked against a SHA-256 before use', () => {
  const wf = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'build.yml'), 'utf8');
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'engine-sources.json'), 'utf8'));
  for (const k of ['whisper', 'speechModel', 'writerModel', 'vcRedist']) {
    assert.match(cfg[k].sha256, /^[a-f0-9]{64}$/, `${k} has no valid SHA-256`);
  }
  assert.match(cfg.llama.sourceCommit, /^[a-f0-9]{40}$/, 'llama.cpp must use a pinned source commit');
  assert.match(wf, /rev-parse HEAD/, 'the checked-out llama.cpp commit must be verified');
  assert.match(wf, /-DLLAMA_BUILD_EXAMPLES=ON/, 'llama-server is included through the examples build');
  assert.match(wf, /-DLLAMA_BUILD_SERVER=ON/, 'the llama-server target must be enabled');
  assert.match(wf, /cmake --build .*--target llama-server/, 'llama-server must be built from the pinned source');
});

test('installer artifacts are validated and releases require successful checks and build', () => {
  const wf = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'build.yml'), 'utf8');
  assert.match(wf, /Verify installer[\s\S]*?\$installers\[0\]\.Length -le 0/);
  assert.match(wf, /actions\/upload-artifact@v4[\s\S]*?path: dist\/\*\.exe/);
  assert.match(wf, /needs: \[checks, build\]/);
  assert.match(wf, /contents: write/);
  assert.match(wf, /gh release create \$version \$target[\s\S]*?--verify-tag/);
});

test('third-party notices match the pinned app and engine versions', () => {
  const root = path.join(__dirname, '..');
  const notices = fs.readFileSync(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const sources = JSON.parse(fs.readFileSync(path.join(root, 'build', 'engine-sources.json'), 'utf8'));
  assert.ok(notices.includes(`Electron ${manifest.devDependencies.electron}`));
  assert.ok(notices.includes(`electron-builder ${manifest.devDependencies['electron-builder']}`));
  assert.ok(notices.includes(`release ${sources.whisper.tag}`));
  assert.ok(notices.includes(`tag ${sources.llama.tag}`));
  assert.ok(notices.includes(sources.llama.sourceCommit));
});

test('the dashboard allows no inline event handler attributes', () => {
  for (const f of files.filter((x) => x.endsWith('.html'))) {
    assert.doesNotMatch(read(f), /\son(click|load|change|submit|input)\s*=\s*["']/, path.relative(SRC, f));
  }
});

test('new windows and navigation are blocked', () => {
  const main = read(path.join(SRC, 'main.js'));
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/);
  assert.match(main, /will-navigate/);
});

test('the log never records transcripts, clipboard text or audio', () => {
  const main = read(path.join(SRC, 'main.js'));
  const logCalls = main.match(/log\((.*)\)/g) || [];
  for (const c of logCalls) assert.ok(!/transcription|output|clipboard|audio|text/.test(c), `log call may expose content: ${c}`);
});
