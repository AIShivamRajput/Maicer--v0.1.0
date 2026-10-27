// Manages a local text-generation server process. Fast mode keeps it loaded; Memory saver stops it when idle.
const { spawn } = require('child_process'); const net = require('net'); const os = require('os'); const fs = require('fs'); const path = require('path');
const paths = require('../models/paths');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
class Writer {
  constructor() { this.proc = null; this.ready = null; this.timer = null; this.mode = 'fast'; this.idleMs = 300000; }
  configure({ performance = 'fast', idleMinutes = 5 }) { this.mode = performance; this.idleMs = Math.max(1, Number(idleMinutes) || 5) * 60000; if (this.mode === 'fast') clearTimeout(this.timer); else this._schedule(); }
  ensure() {
    if (!this.ready) this.ready = this._start().catch(e => { this.stop(); throw e; });
    return this.ready;
  }
  async _start() {
    const bin = paths.llamaServer(), model = paths.languageModel();
    if (!fs.existsSync(bin) || !fs.existsSync(model)) throw Object.assign(new Error('writer files missing'), { code: 'ENGINE_MISSING' });
    const port = await freePort(); this.port = port;
    const threads = String(Math.max(2, Math.min(8, Math.floor(os.cpus().length / 2))));
    this.proc = spawn(bin, ['-m', model, '--host', '127.0.0.1', '--port', String(port), '-c', '4096', '-t', threads, '-np', '1'],
      { windowsHide: true, stdio: 'ignore', cwd: path.dirname(bin) });
    this.proc.on('exit', () => { this.proc = null; this.ready = null; });
    for (let i = 0; i < 180; i++) {
      if (!this.proc) throw new Error('writer exited');
      try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return; } catch {}
      await sleep(500);
    }
    throw new Error('writer start timeout');
  }
  async chat(messages, signal) {
    await this.ensure(); clearTimeout(this.timer);
    try {
      const r = await fetch(`http://127.0.0.1:${this.port}/v1/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, temperature: 0.2, max_tokens: 1024, stream: false }),
        signal: signal ? AbortSignal.any([AbortSignal.timeout(60000), signal]) : AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error('writer http ' + r.status);
      return (await r.json()).choices[0].message.content;
    } catch (e) {
      if (signal?.aborted) throw Object.assign(new Error('cancelled'), { code: 'CANCELLED' });   // user stopped: keep the model loaded
      this.stop(); throw e;                                                                   // real failure: next request restarts it
    }
    finally { this._schedule(); }
  }
  _schedule() { clearTimeout(this.timer); if (this.mode === 'saver') this.timer = setTimeout(() => this.stop(), this.idleMs); }
  stop() { clearTimeout(this.timer); const p = this.proc; this.proc = null; this.ready = null; try { p?.kill(); } catch {} }
}
module.exports = new Writer();
