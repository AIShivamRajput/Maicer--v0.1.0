// Validates settings coming from the dashboard before they are saved or applied.
// Only known keys with the expected type or allowed value are accepted. Anything else is rejected.
const ALLOWED = {
  hotkey: (v) => typeof v === 'string' && /^((Control|Alt|Shift|Super)\+)*((Control|Alt|Shift|Super)\+)?([A-Z0-9]|F([1-9]|1[0-2]))$/.test(v) && /(Control|Alt|Shift|Super)\+/.test(v),
  startWithWindows: (v) => typeof v === 'boolean',
  indicator: (v) => typeof v === 'boolean',
  micReady: (v) => typeof v === 'boolean',
  onboarded: (v) => typeof v === 'boolean',
  theme: (v) => ['light', 'dark'].includes(v),
  performance: (v) => ['fast', 'saver'].includes(v),
  idleMinutes: (v) => ['2', '5', '10'].includes(String(v)),
  micId: (v) => typeof v === 'string' && v.length <= 512,
  language: (v) => ['en', 'auto', 'es', 'fr', 'de', 'pt', 'hi'].includes(v),
  vad: (v) => ['low', 'medium', 'high'].includes(v),
};

function sanitizeSettingsPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('settings must be an object');
  const out = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.prototype.hasOwnProperty.call(ALLOWED, key)) throw new Error(`unknown setting: ${key}`);
    if (!ALLOWED[key](value)) throw new Error(`invalid value for ${key}`);
    out[key] = key === 'idleMinutes' ? String(value) : value;
  }
  return out;
}

module.exports = { sanitizeSettingsPatch, ALLOWED_KEYS: Object.keys(ALLOWED) };
