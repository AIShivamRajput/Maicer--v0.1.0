// Local dictation history, stored as a JSON file in the user's data folder.
// No native modules, so installing the app needs no C++ compiler.
// Writes are atomic (temp file, then rename). The history keeps the newest MAX_ROWS entries.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { stats, localDayRange } = require('../analytics/lines');

const MAX_ROWS = 10000;

class HistoryStore {
  constructor(file) {
    this.file = file;
    this.rows = this._load();
  }

  _load() {
    let raw;
    try { raw = fs.readFileSync(this.file, 'utf8'); }
    catch (e) { if (e.code === 'ENOENT') return []; throw e; }
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) throw new Error('not a list');
      return data.filter((r) => r && typeof r.id === 'string' && Number.isFinite(r.created_at));
    } catch {
      // Keep the damaged file for inspection instead of overwriting it.
      fs.renameSync(this.file, this.file + '.damaged-' + Date.now());
      return [];
    }
  }

  _save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.rows));
    fs.renameSync(tmp, this.file);
  }

  // Call ONLY after a confirmed successful insertion.
  recordSuccess({ transcription, output, application = null, kind = 'text', at = Date.now() }) {
    const s = stats(output);
    const id = crypto.randomUUID();
    this.rows.push({
      id, created_at: at,
      transcription: String(transcription), generated_output: String(output),
      application, kind,
      line_count: s.line_count, word_count: s.word_count, character_count: s.character_count,
      status: 'success',
    });
    if (this.rows.length > MAX_ROWS) this.rows.splice(0, this.rows.length - MAX_ROWS);
    this._save();
    return id;
  }

  _ok() { return this.rows.filter((r) => r.status === 'success'); }

  totals(now = new Date()) {
    const { start, end } = localDayRange(now);
    const ok = this._ok();
    const total = ok.reduce((a, r) => a + r.line_count, 0);
    const today = ok.filter((r) => r.created_at >= start && r.created_at < end).reduce((a, r) => a + r.line_count, 0);
    return { total, today, count: ok.length };
  }

  // Lines per local day for the last N days, oldest first.
  daily(days = 7, now = new Date()) {
    const ok = this._ok();
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const { start, end } = localDayRange(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
      out.push(ok.filter((r) => r.created_at >= start && r.created_at < end).reduce((a, r) => a + r.line_count, 0));
    }
    return out;
  }

  recent(limit = 10) {
    return this._ok().slice().sort((a, b) => b.created_at - a.created_at).slice(0, limit);
  }

  search(q) {
    const needle = String(q).toLowerCase();
    return this._ok()
      .filter((r) => r.transcription.toLowerCase().includes(needle) || r.generated_output.toLowerCase().includes(needle))
      .sort((a, b) => b.created_at - a.created_at);
  }

  remove(id) {
    this.rows = this.rows.filter((r) => r.id !== id);
    this._save();
  }

  clearAll() {
    this.rows = [];
    this._save();
  }
}

module.exports = { HistoryStore, MAX_ROWS };
