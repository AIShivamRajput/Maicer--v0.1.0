const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard, nativeImage, screen, powerMonitor, Notification, session, shell } = require('electron');
const path = require('path'); const fs = require('fs');
const { HistoryStore } = require('./history/db');
const { sanitizeSettingsPatch } = require('./settings/sanitize'); const { PushToTalk } = require('./hotkey/toggle');
const engine = require('./ai/engine'); const win32 = require('./insertion/win');
let uIOhook = null, UiohookKey = {};
try { ({ uIOhook, UiohookKey } = require('uiohook-napi')); } catch (e) { console.error('[maicer] key-release hook unavailable', e.message); }

if (!app.requestSingleInstanceLock()) app.quit();
const ICON = path.join(__dirname, 'assets/icon.png');
const userData = () => app.getPath('userData');
const DEFAULTS = { hotkey: 'Control+M', startWithWindows: false, indicator: true, theme: 'light', performance: 'fast', idleMinutes: '5',
  micId: '', language: 'en', vad: 'medium', onboarded: false, micReady: false };
let settings = { ...DEFAULTS }, store, win, indicator, recorder, tray, paused = false, hotkeyError = null, cur = { app: '', hwnd: 0 }, recWait = null;
let hookOk = false, releaseKeys = [];
let currentAbort = null, escOn = false;

const log = (m) => { try { fs.appendFileSync(path.join(userData(), 'maicer.log'), `${new Date().toISOString()} ${m}\n`); } catch {} };  // never logs voice or text
const loadSettings = () => { try { settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(path.join(userData(), 'settings.json'), 'utf8')) }; } catch {} };
const saveSettings = () => fs.writeFileSync(path.join(userData(), 'settings.json'), JSON.stringify(settings, null, 2));

const MSG = {
  NO_SPEECH: ['No speech detected', "We didn't hear anything. Try speaking again."],
  MIC: ['Microphone unavailable', 'Check your microphone and try again.'],
  ENGINE_MISSING: ['Voice files missing', 'Run the Maicer installer again to repair the local voice files. Your settings and history are kept.'],
  PASTE: ['No text field available', "Maicer couldn't find an active text field."],
  FOCUS: ['Focus moved', 'Your text is on the clipboard. Click where it belongs and press Ctrl + V.'],
  OTHER: ['Processing error', 'Something went wrong. Please try again.'],
};
const APPS = { code: 'VS Code', cursor: 'Cursor', chrome: 'Chrome', msedge: 'Edge', firefox: 'Firefox', notepad: 'Notepad', 'notepad++': 'Notepad++',
  winword: 'Word', slack: 'Slack', discord: 'Discord', teams: 'Teams', outlook: 'Outlook', idea64: 'IntelliJ', pycharm64: 'PyCharm', devenv: 'Visual Studio' };
const friendlyApp = (n) => (n ? APPS[n.toLowerCase()] || n : null);

function showIndicator(state, text, detail = '') {
  tray?.setToolTip(state === 'listening' ? 'Maicer — listening' : 'Maicer');
  if (!settings.indicator || !indicator) { if (state === 'error') new Notification({ title: text, body: detail }).show(); return; }
  indicator.webContents.send('state', { state, text, detail });
  const { workArea } = screen.getPrimaryDisplay();
  indicator.setPosition(Math.round(workArea.x + workArea.width / 2 - 160), workArea.y + workArea.height - 100);
  indicator.showInactive();
}
const hideIndicator = (ms = 0) => setTimeout(() => indicator?.hide(), ms);
function fail(e) {
  log(`error ${e.code || ''} ${e.message}`);
  const [t, d] = MSG[e.code] || MSG.OTHER; showIndicator('error', t, d); hideIndicator(3500); finish(); win?.webContents.send('rec', 'idle');
}
function setEscape(on) {                        // Escape cancels only while Maicer is busy; it is not held globally
  if (on && !escOn) { escOn = globalShortcut.register('Escape', () => ptt.cancel()); }
  else if (!on && escOn) { globalShortcut.unregister('Escape'); escOn = false; }
}
function finish(g) { ptt.done(g); setEscape(false); }

function saveClip() { return { text: clipboard.readText(), img: clipboard.readImage() }; }
function restoreClip(c) { if (!c.img.isEmpty()) clipboard.writeImage(c.img); else clipboard.writeText(c.text); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getSelection() {            // only called when the request refers to existing text
  const c = saveClip(); clipboard.writeText('');
  await win32.copy(); await sleep(150);
  const sel = clipboard.readText(); restoreClip(c); return sel;
}
async function paste(text) {
  const c = saveClip(); clipboard.writeText(text);
  const ok = await win32.paste();
  await sleep(900);                              // give slower apps time to read the clipboard
  if (clipboard.readText() === text) restoreClip(c); // restore only if the user hasn't copied something new
  return ok;
}
function stopRecording() {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { recWait = null; reject(Object.assign(new Error('rec timeout'), { code: 'MIC' })); }, 8000);
    recWait = (a) => { clearTimeout(t); recWait = null; resolve(a); };
    recorder.webContents.send('rec-cmd', { cmd: 'stop' });
  });
}
ipcMain.on('rec:data', (_, u8) => { const f = new Float32Array(u8.byteLength >> 2); new Uint8Array(f.buffer).set(u8); recWait?.(f); });
ipcMain.on('rec:error', (_, code) => { if (ptt.state === 'recording') fail({ code, message: 'recorder ' + code }); });

const ptt = new PushToTalk({
  onStart: (g) => {
    cur = { app: '', hwnd: 0 };
    setEscape(true);
    recorder.webContents.send('rec-cmd', { cmd: 'start', deviceId: settings.micId });
    showIndicator('listening', 'Listening...', 'Let go of ' + settings.hotkey.replace('Control', 'Ctrl').replace(/\\+/g, ' + ') + ' to finish');
    win?.webContents.send('rec', 'listening');
    win32.foregroundApp().then(a => { cur.app = a; });
    win32.foregroundWindow().then(h => { cur.hwnd = h; });
  },
  onStop: async (g) => {
    showIndicator('processing', 'Processing...'); win?.webContents.send('rec', 'processing');
    const ac = new AbortController(); currentAbort = ac;
    try {
      const audio = await stopRecording();
      if (!ptt.isCurrent(g)) return;                         // stopped or interrupted while listening
      const r = await engine.run({ audio, settings, getSelection, signal: ac.signal });
      if (!ptt.isCurrent(g)) return;                         // stale result: never paste it
      const nowHwnd = await win32.foregroundWindow();
      if (cur.hwnd && nowHwnd && nowHwnd !== cur.hwnd) {
        clipboard.writeText(r.output);                       // never paste into a window the user didn't pick
        throw Object.assign(new Error('focus moved'), { code: 'FOCUS' });
      }
      if (!ptt.isCurrent(g)) return;
      if (!(await paste(r.output))) throw Object.assign(new Error('paste failed'), { code: 'PASTE' });
      store.recordSuccess({ transcription: r.transcription, output: r.output, kind: r.kind, application: friendlyApp(cur.app) });
      showIndicator('done', '✓ Added'); hideIndicator(1200); win?.webContents.send('data-changed');
      finish(g); win?.webContents.send('rec', 'idle');
    } catch (e) {
      if (e.code === 'CANCELLED' || !ptt.isCurrent(g)) return;   // cancelled work is silent
      fail(e);
    } finally {
      if (currentAbort === ac) currentAbort = null;
    }
  },
  onCancel: (was) => {
    if (was === 'recording') recorder.webContents.send('rec-cmd', { cmd: 'stop' });  // stop the mic
    recWait = null;                                          // discard any audio still in flight
    if (currentAbort) { currentAbort.abort(); currentAbort = null; }
    setEscape(false);
    indicator?.hide(); win?.webContents.send('rec', 'idle');
  },
});

// Parse "Control+M" into the main key plus any modifier keys, so releasing ANY of them ends the hold.
function keysFor(hotkey) {
  const parts = hotkey.split('+'), main = parts.pop().toUpperCase();
  const mods = { Control: ['Ctrl', 'CtrlRight'], Shift: ['Shift', 'ShiftRight'], Alt: ['Alt', 'AltRight'], Super: ['Meta', 'MetaRight'] };
  return [UiohookKey[main], ...parts.flatMap(p => (mods[p] || []).map(k => UiohookKey[k]))].filter(k => k !== undefined);
}
function registerHotkey(key) {
  globalShortcut.unregisterAll();
  // globalShortcut fires on press and swallows the keystroke. Release is caught by the key hook below.
  const ok = globalShortcut.register(key, () => {
    if (paused) return;
    if (ptt.state === 'idle' && !settings.micReady) {
      win?.show(); win?.webContents.send('goto', 'home');
      showIndicator('error', 'Allow your microphone first', 'Click "Allow microphone" on the Home screen.'); hideIndicator(3500);
      return;
    }
    if (!hookOk && ptt.state === 'recording') { ptt.up(); return; }   // fallback: press again to finish
    ptt.down();
  });
  releaseKeys = keysFor(key);
  hotkeyError = ok ? null : `${key.replace('Control', 'Ctrl')} is already being used by another application. Choose another shortcut in Settings.`;
  return ok;
}
function startKeyHook() {
  if (!uIOhook) return;
  try {
    uIOhook.on('keyup', (e) => { if (ptt.state === 'recording' && releaseKeys.includes(e.keycode)) ptt.up(); });
    uIOhook.start(); hookOk = true;
  } catch (e) { hookOk = false; log('key hook failed ' + e.message); }
}
// No pop-up windows and no navigation away from the app's own pages.
function locked(w) {
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', (e) => e.preventDefault());
}
function hidden(file, extra = {}) {
  const w = new BrowserWindow({ show: false, ...extra, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false } });
  locked(w);
  w.loadFile(path.join(__dirname, 'ui', file)); return w;
}
function createWindows() {
  win = new BrowserWindow({ width: 1080, height: 720, minWidth: 760, minHeight: 560, show: !process.argv.includes('--hidden'), title: 'Maicer',
    backgroundColor: '#FFFFFF', autoHideMenuBar: true, icon: ICON, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  locked(win);
  win.loadFile(path.join(__dirname, 'ui/index.html'));
  win.on('close', e => { if (!app.isQuitting) { e.preventDefault(); win.hide(); } });
  indicator = hidden('indicator.html', { width: 340, height: 60, frame: false, transparent: true, alwaysOnTop: true, focusable: false, skipTaskbar: true, resizable: false });
  indicator.setIgnoreMouseEvents(true);
  recorder = hidden('recorder.html');
}
function buildTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  const refresh = () => tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'MAICER', enabled: false }, { label: paused ? '◉ Paused' : '● Ready', enabled: false }, { type: 'separator' },
    { label: 'Start / Stop dictation', click: () => { if (!paused) (ptt.state === 'recording' ? ptt.up() : ptt.down()); } },
    { label: paused ? 'Resume Maicer' : 'Pause Maicer', click: () => { paused = !paused; refresh(); } },
    { label: 'Test Microphone', click: () => { win.show(); win.webContents.send('goto', 'settings'); } },
    { label: 'Open Dashboard', click: () => win.show() },
    { label: 'Settings', click: () => { win.show(); win.webContents.send('goto', 'settings'); } },
    { label: 'Start with Windows', type: 'checkbox', checked: settings.startWithWindows, click: i => setStartup(i.checked) },
    { type: 'separator' }, { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }]));
  tray.setToolTip('Maicer'); refresh(); tray.on('click', () => win.show());
}
function setStartup(on) { settings.startWithWindows = on; saveSettings(); app.setLoginItemSettings({ openAtLogin: on, args: ['--hidden'] }); }

ipcMain.handle('stats', () => store.totals());
ipcMain.handle('daily', (_, n) => store.daily(n));
ipcMain.handle('recent', (_, n) => store.recent(n));
ipcMain.handle('search', (_, q) => (q ? store.search(q) : store.recent(500)));
ipcMain.handle('delete', (_, id) => { store.remove(id); return store.totals(); });
ipcMain.handle('clear', () => { store.clearAll(); return store.totals(); });
ipcMain.handle('copy', (_, t) => clipboard.writeText(t));
ipcMain.handle('diag:open', () => shell.openPath(userData()));
ipcMain.handle('settings:get', () => ({ ...settings, hotkeyError }));
ipcMain.handle('settings:set', (_, patch) => {
  if (patch && patch.hotkey && patch.hotkey !== settings.hotkey && !registerHotkey(patch.hotkey)) { const err = hotkeyError; registerHotkey(settings.hotkey); return { error: err, ...settings }; }
  let clean;
  try { clean = sanitizeSettingsPatch(patch); } catch (e) { return { error: e.message, ...settings }; }
  Object.assign(settings, clean); if ('startWithWindows' in clean) setStartup(clean.startWithWindows);
  saveSettings(); engine.configure(settings); return { ...settings, hotkeyError };
});

app.whenReady().then(() => {
  loadSettings(); store = new HistoryStore(path.join(userData(), 'history.json'));
  session.defaultSession.setPermissionRequestHandler((_, p, cb) => cb(p === 'media'));
  session.defaultSession.setPermissionCheckHandler((_, p) => p === 'media');
  createWindows(); buildTray(); startKeyHook(); registerHotkey(settings.hotkey); win32.init();
  engine.configure(settings); if (settings.performance === 'fast') engine.warmUp();
  powerMonitor.on('resume', () => { registerHotkey(settings.hotkey); try { uIOhook?.stop(); } catch {} startKeyHook(); win32.stop(); win32.init(); ptt.done(); });
});
process.on('uncaughtException', (e) => log('uncaught ' + e.message));
app.on('second-instance', () => win?.show());
app.on('before-quit', () => { app.isQuitting = true; globalShortcut.unregisterAll(); try { uIOhook?.stop(); } catch {} engine.shutdown(); win32.stop(); });
app.on('window-all-closed', () => {});
