const test = require('node:test'); const assert = require('node:assert');
const { countLines, historyGroup, localDayRange } = require('../src/analytics/lines');
const { PushToTalk } = require('../src/hotkey/toggle');
test('counts non-empty lines, normalizes CRLF', () => {
  assert.equal(countLines('const player = {\r\n  health: 100,\r\n  speed: 5\r\n};'), 4);
  assert.equal(countLines('a\n\n  \nb\n'), 2);
  assert.equal(countLines(''), 0);
});
test('day grouping uses local calendar day', () => {
  const now = new Date(2026, 9, 8, 15, 0);
  const { start } = localDayRange(now);
  assert.equal(historyGroup(start + 1000, now), 'Today');
  assert.equal(historyGroup(start - 1000, now), 'Yesterday');
  assert.equal(historyGroup(start - 3 * 86400000, now), 'Previous 7 days');
  assert.equal(historyGroup(start - 30 * 86400000, now), 'Older');
});
test('hold to record: key repeat ignored, release finishes', () => {
  let starts = 0, stops = 0;
  const k = new PushToTalk({ onStart: () => starts++, onStop: () => stops++ });
  k.down(); k.down(); k.down();              // auto-repeat while held
  assert.equal(starts, 1);
  k.up(); assert.equal(stops, 1);
  k.up(); assert.equal(stops, 1);            // extra release does nothing
  k.done();
});
test('a press while processing interrupts the previous instruction', () => {
  let starts = 0, stops = 0, cancels = 0;
  const k = new PushToTalk({ onStart: () => starts++, onStop: () => stops++, onCancel: () => cancels++ });
  k.down(); k.up();
  k.down();
  assert.equal(starts, 2); assert.equal(cancels, 1);
  k.done();
});
