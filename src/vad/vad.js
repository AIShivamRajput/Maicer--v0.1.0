// Local energy-based voice activity detection. Runs AFTER the user stops recording, so brief
// pauses never end a recording early; it only trims silence and rejects empty recordings.
const SENS = { low: { k: 5, min: 0.012 }, medium: { k: 3.5, min: 0.008 }, high: { k: 2.5, min: 0.005 } };
function analyze(x, { sampleRate = 16000, sensitivity = 'medium' } = {}) {
  const hop = Math.round(sampleRate * 0.02), n = Math.floor(x.length / hop);
  const none = { hasSpeech: false, samples: new Float32Array(0), speechMs: 0 };
  if (n < 10) return none;
  const rms = new Float32Array(n);
  for (let f = 0; f < n; f++) { let s = 0; for (let i = f * hop; i < (f + 1) * hop; i++) s += x[i] * x[i]; rms[f] = Math.sqrt(s / hop); }
  const sorted = Float32Array.from(rms).sort();
  const { k, min } = SENS[sensitivity] || SENS.medium;
  const thr = Math.max(min, sorted[Math.floor(n * 0.1)] * k);
  const runs = []; let start = -1;
  for (let f = 0; f <= n; f++) {
    const on = f < n && rms[f] > thr;
    if (on && start < 0) start = f;
    if (!on && start >= 0) { if (f - start >= 3) runs.push([start, f]); start = -1; }
  }
  if (!runs.length) return none;
  const speechMs = runs.reduce((a, [s, e]) => a + (e - s) * 20, 0);
  if (speechMs < 250) return { ...none, speechMs };
  const from = Math.max(0, (runs[0][0] - 10) * hop), to = Math.min(x.length, (runs[runs.length - 1][1] + 15) * hop);
  return { hasSpeech: true, samples: x.slice(from, to), speechMs };
}
module.exports = { analyze };
