const { execFile } = require('child_process'); const fs = require('fs'); const os = require('os'); const path = require('path');
const paths = require('../models/paths');
const missing = () => Object.assign(new Error('speech files missing'), { code: 'ENGINE_MISSING' });
function clean(out) {
  return out.split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^[\[(].*[\])]$/.test(l)).join(' ').trim();
}
function transcribe(wavPath, { language = 'en' } = {}) {
  const exe = paths.whisperCli(), model = paths.whisperModel();
  if (!fs.existsSync(exe) || !fs.existsSync(model)) return Promise.reject(missing());
  const threads = String(Math.max(2, Math.min(8, Math.floor(os.cpus().length / 2))));
  return new Promise((res, rej) => execFile(exe, ['-m', model, '-f', wavPath, '-l', language, '-nt', '-np', '-t', threads],
    { windowsHide: true, timeout: 60000, maxBuffer: 1 << 24, cwd: path.dirname(exe) }, (err, stdout) => err ? rej(err) : res(clean(stdout))));
}
module.exports = { transcribe, clean };
