const test = require('node:test');
const assert = require('node:assert/strict');
const { PushToTalk } = require('../src/hotkey/toggle');

const rig = () => {
  const log = [];
  const k = new PushToTalk({
    onStart: (g) => log.push(['start', g]),
    onStop: (g) => log.push(['stop', g]),
    onCancel: (was) => log.push(['cancel', was]),
  });
  return { k, log };
};

test('one hold is one activation: key repeat while held does not start again', () => {
  const { k, log } = rig();
  k.down(); k.down(); k.down();
  assert.deepEqual(log, [['start', 1]]);
});

test('release processes the current generation once', () => {
  const { k, log } = rig();
  k.down(); k.up(); k.up();
  assert.deepEqual(log, [['start', 1], ['stop', 1]]);
});

test('Ctrl+M while processing interrupts: old generation cancelled, new one starts', () => {
  const { k, log } = rig();
  k.down(); k.up();                 // processing gen 1
  k.down();                         // interrupt
  assert.deepEqual(log, [['start', 1], ['stop', 1], ['cancel', 'processing'], ['start', 3]]);
  assert.equal(k.isCurrent(1), false);   // gen 1's late result must not paste
  assert.equal(k.isCurrent(3), true);
});

test('a stale finisher cannot end the newer activation', () => {
  const { k } = rig();
  k.down(); k.up();                 // gen 1 processing
  k.cancel();                       // user pressed Stop
  k.down();                         // gen 3 recording
  assert.equal(k.done(1), false);   // the old task finishing must not reset gen 3
  assert.equal(k.state, 'recording');
});

test('Stop during recording returns to idle without processing', () => {
  const { k, log } = rig();
  k.down(); k.cancel();
  assert.equal(k.state, 'idle');
  assert.deepEqual(log, [['start', 1], ['cancel', 'recording']]);
});
