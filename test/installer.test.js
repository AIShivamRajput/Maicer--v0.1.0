const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('one-command installer targets the repository and accepts only verified stable releases', () => {
  const script = read('install.ps1');
  assert.match(script, /\$owner = 'AIShivamRajput'/);
  assert.match(script, /\$repository = 'Maicer-v\.1\.0\.0'/);
  assert.match(script, /releases\/latest/);
  assert.match(script, /\^v\(\?<version>\\d\+\\\.\\d\+\\\.\\d\+\)\$/);
  assert.match(script, /SHA-256 verification failed/);
  assert.ok(script.indexOf('$actualHash -cne $expectedHash') < script.indexOf("Start-Process -FilePath $stagedInstaller"));
});

test('installer checks Windows architecture, OS version, available space, and retries interrupted downloads', () => {
  const script = read('install.ps1');
  assert.match(script, /Is64BitOperatingSystem/);
  assert.match(script, /Win32_OperatingSystem/);
  assert.match(script, /19045/);
  assert.match(script, /22000/);
  assert.match(script, /Assert-FreeSpace/);
  assert.match(script, /\$attempt -le 3/);
  assert.match(script, /partialInstaller/);
});

test('packaged installer does not need external Node.js and provides the user command', () => {
  const script = read('install.ps1');
  const manifest = JSON.parse(read('package.json'));
  assert.match(script, /Maicer includes its Electron\/Node\.js runtime/);
  assert.match(script, /Programs\\Maicer/);
  assert.match(script, /maicer\.cmd/);
  assert.match(script, /SetEnvironmentVariable\('Path'.*'User'\)/);
  assert.equal(manifest.build.nsis.perMachine, false);
  assert.equal(manifest.build.nsis.createStartMenuShortcut, true);
  assert.equal(manifest.build.nsis.createDesktopShortcut, false);
});

test('models persist across app updates and uninstall defaults to retaining user data', () => {
  const nsis = read('installer/installer.nsh');
  const paths = read('src/models/paths.js');
  assert.match(nsis, /manifest\.ini/);
  assert.match(nsis, /LOCALAPPDATA\\Maicer\\engine\\models/);
  assert.match(nsis, /\/SD IDNO/);
  assert.match(nsis, /RMDir \/r "\$LOCALAPPDATA\\Maicer\\engine\\models"/);
  assert.match(paths, /process\.env\.LOCALAPPDATA/);
  assert.match(paths, /persistent/);
});

test('release workflow emits the model manifest and installer checksum used by setup', () => {
  const workflow = read('.github/workflows/build.yml');
  assert.match(workflow, /resources\/engine\/models\/manifest\.ini/);
  assert.match(workflow, /Parser\]::ParseFile/);
  assert.match(workflow, /Get-FileHash \$target -Algorithm SHA256/);
  assert.match(workflow, /gh release create \$version \$target \$checksum/);
});

test('model downloads use immutable upstream revisions with verified SHA-256 digests', () => {
  const sources = JSON.parse(read('build/engine-sources.json'));
  for (const model of [sources.speechModel, sources.writerModel]) {
    assert.match(model.revision, /^[a-f0-9]{40}$/);
    assert.ok(model.url.includes(`/resolve/${model.revision}/`));
    assert.match(model.sha256, /^[a-f0-9]{64}$/);
  }
});

test('Windows build loads both real models, runs inference twice, and smoke-tests the installed app', () => {
  const workflow = read('.github/workflows/build.yml');
  assert.match(workflow, /Load Whisper model and run llama\.cpp inference/);
  assert.match(workflow, /whisperTestAudio\.sha256/);
  assert.match(workflow, /ask not what your country can do for you/);
  assert.match(workflow, /\/v1\/chat\/completions/);
  assert.match(workflow, /foreach \(\$launch in 1\.\.2\)/);
  assert.match(workflow, /Install package and verify installed app, models, and shortcut/);
  assert.match(workflow, /Start-Process -FilePath \$app/);
});

test('pushes to main run Windows security checks and installer build without path filters', () => {
  const workflow = read('.github/workflows/build.yml');
  const push = workflow.match(/^  push:\r?\n([\s\S]*?)(?=^  \w+:|^permissions:)/m)?.[1];
  assert.ok(push, 'push event is missing');
  assert.match(push, /branches:\s*\[main\]/);
  assert.doesNotMatch(push, /paths(?:-ignore)?:/);
  assert.match(workflow, /secret-scan:\s*\n[\s\S]*?runs-on: ubuntu-latest/);
  assert.match(workflow, /checks:\s*\n\s+name: Security and tests\s*\n\s+needs: secret-scan/);
  assert.match(workflow, /checks:\s*\n[\s\S]*?runs-on: windows-latest/);
  assert.match(workflow, /build:\s*\n[\s\S]*?runs-on: windows-latest/);
  assert.match(workflow, /npm audit --audit-level=low/);
  assert.match(workflow, /npm test/);
});
