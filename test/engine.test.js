const test = require('node:test'); const assert = require('node:assert');
const { analyze } = require('../src/vad/vad'); const { encodeWav } = require('../src/audio/wav');
const { cleanOutput, needsSelection, detectKind, buildMessages } = require('../src/ai/prompt');
const { clean } = require('../src/speech/whisper.js');
let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
const noise = (s) => Float32Array.from({ length: 16000 * s }, () => rnd() * 0.004);
const tone = (s) => Float32Array.from({ length: 16000 * s }, (_, i) => 0.3 * Math.sin(i * 0.17) + rnd() * 0.004);
const cat = (...a) => { const o = new Float32Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
test('VAD trims silence and keeps speech', () => {
  const r = analyze(cat(noise(1), tone(1), noise(1)));
  assert.ok(r.hasSpeech); assert.ok(r.samples.length > 16000 && r.samples.length < 16000 * 1.6);
});
test('VAD keeps speech around a pause', () => {
  const r = analyze(cat(tone(1), noise(1), tone(1)));
  assert.ok(r.samples.length > 16000 * 2.9);
});
test('VAD rejects silence and very short blips', () => {
  assert.equal(analyze(noise(2)).hasSpeech, false);
  assert.equal(analyze(cat(noise(1), tone(0.1), noise(1))).hasSpeech, false);
  assert.equal(analyze(new Float32Array(100)).hasSpeech, false);
});
test('WAV header', () => {
  const b = encodeWav(new Float32Array(160)); assert.equal(b.toString('ascii', 0, 4), 'RIFF'); assert.equal(b.length, 44 + 320);
});
test('cleanOutput strips fences only', () => {
  assert.equal(cleanOutput('```js\nconst a = 1;\n```'), 'const a = 1;');
  assert.equal(cleanOutput('  hello  '), 'hello');
});
test('selection + kind heuristics', () => {
  assert.ok(needsSelection('Make this sentence more professional')); assert.ok(needsSelection('Convert this code to Python'));
  assert.ok(!needsSelection('Write a Python loop from 1 to 10'));
  assert.equal(detectKind('Create an object with health 100', 'const p = {\n a: 1\n};'), 'code');
  assert.equal(detectKind('Say hello to the team', 'Hello team.'), 'text');
  assert.equal(buildMessages('x', 'sel')[1].content.includes('SELECTED TEXT'), true);
});
test('whisper output cleaning drops blank markers', () => {
  assert.equal(clean('[BLANK_AUDIO]\n Hello there \n(music)\n'), 'Hello there');
});
