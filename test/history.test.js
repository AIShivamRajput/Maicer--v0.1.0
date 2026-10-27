const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { HistoryStore, MAX_ROWS } = require('../src/history/db');

const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hist-')), 'history.json');
const day = new Date(2026, 9, 25, 12, 0);

test('records a success with line, word and character counts', () => {
  const h = new HistoryStore(tmpFile());
  h.recordSuccess({ transcription: 'write a function', output: 'const a = 1;\nconst b = 2;\n\nconst c = 3;', application: 'VS Code', kind: 'code', at: day.getTime() });
  const [row] = h.recent();
  assert.equal(row.line_count, 3);
  assert.equal(row.application, 'VS Code');
  assert.equal(row.status, 'success');
});

test('totals and daily count only real rows, by local day', () => {
  const h = new HistoryStore(tmpFile());
  h.recordSuccess({ transcription: 'a', output: 'x\ny', at: day.getTime() });
  h.recordSuccess({ transcription: 'b', output: 'z', at: day.getTime() - 2 * 86400000 });
  const t = h.totals(day);
  assert.equal(t.total, 3);
  assert.equal(t.today, 2);
  assert.equal(t.count, 2);
  assert.equal(h.daily(3, day).at(-1), 2);
});

test('data survives a restart', () => {
  const file = tmpFile();
  new HistoryStore(file).recordSuccess({ transcription: 'keep me', output: 'ok' });
  assert.equal(new HistoryStore(file).recent()[0].transcription, 'keep me');
});

test('search is case-insensitive over both transcript and output', () => {
  const h = new HistoryStore(tmpFile());
  h.recordSuccess({ transcription: 'Write A Loop', output: 'for (;;) {}' });
  h.recordSuccess({ transcription: 'other', output: 'const LOOP = 1' });
  assert.equal(h.search('loop').length, 2);
  assert.equal(h.search('nothing-here').length, 0);
});

test('delete one entry and clear all update the totals', () => {
  const h = new HistoryStore(tmpFile());
  const id = h.recordSuccess({ transcription: 'one', output: 'a\nb' });
  h.recordSuccess({ transcription: 'two', output: 'c' });
  h.remove(id);
  assert.equal(h.totals().total, 1);
  h.clearAll();
  assert.equal(h.totals().total, 0);
  assert.equal(h.recent().length, 0);
});

test('history keeps only the newest entries (retention cap)', () => {
  const h = new HistoryStore(tmpFile());
  for (let i = 0; i < MAX_ROWS + 5; i++) h.rows.push({ id: 'r' + i, created_at: i, transcription: 't', generated_output: 'o', line_count: 1, word_count: 1, character_count: 1, status: 'success' });
  h.recordSuccess({ transcription: 'newest', output: 'x' });
  assert.equal(h.rows.length, MAX_ROWS);
  assert.equal(h.recent(1)[0].transcription, 'newest');
});

test('a damaged history file is kept aside, not overwritten', () => {
  const file = tmpFile();
  fs.writeFileSync(file, '{not json');
  const h = new HistoryStore(file);
  assert.equal(h.recent().length, 0);
  const kept = fs.readdirSync(path.dirname(file)).filter((f) => f.startsWith('history.json.damaged-'));
  assert.equal(kept.length, 1);
});
