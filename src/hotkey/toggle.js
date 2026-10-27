// Push-to-talk state machine: hold Ctrl+M to record, let go to process.
// Every activation gets a generation number. Work from an older generation is stale and must not paste.
// Pressing Ctrl+M while processing interrupts it: the old generation is cancelled and a new one starts.
// Key auto-repeat while the key is held is ignored (down() is a no-op while already recording).
class PushToTalk {
  constructor({ onStart, onStop, onCancel, maxMs = 60000 }) {
    Object.assign(this, { onStart, onStop, onCancel, maxMs });
    this.state = 'idle';
    this.gen = 0;
    this.timer = null;
  }
  down() {
    if (this.state === 'processing') this.cancel();          // interrupt the previous instruction
    if (this.state !== 'idle') return false;                  // already recording: key repeat, ignore
    this.gen += 1;
    this.state = 'recording';
    const g = this.gen;
    this.timer = setTimeout(() => this.up(g), this.maxMs);    // safety: release missed
    this.onStart && this.onStart(g);
    return true;
  }
  up(g = this.gen) {
    if (this.state !== 'recording' || g !== this.gen) return false;
    clearTimeout(this.timer); this.timer = null;
    this.state = 'processing';
    this.onStop && this.onStop(g);
    return true;
  }
  cancel() {
    if (this.state === 'idle') return false;
    const was = this.state;
    clearTimeout(this.timer); this.timer = null;
    this.gen += 1;                                            // anything still running is now stale
    this.state = 'idle';
    this.onCancel && this.onCancel(was);
    return true;
  }
  isCurrent(g) { return g === this.gen && this.state !== 'idle'; }
  done(g = this.gen) {                                        // finish only the generation that is asking
    if (g !== this.gen) return false;
    clearTimeout(this.timer); this.timer = null;
    this.state = 'idle';
    return true;
  }
}
module.exports = { PushToTalk };
