// Lines Written = non-empty lines in the inserted text, after normalizing line endings.
function normalize(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n');
}
function countLines(text) {
  return normalize(text).split('\n').filter(l => l.trim().length > 0).length;
}
function countWords(text) {
  const t = normalize(text).trim();
  return t ? t.split(/\s+/).length : 0;
}
function stats(text) {
  const t = normalize(text);
  return { line_count: countLines(t), word_count: countWords(t), character_count: t.length };
}
// Start/end of the user's local calendar day, as epoch ms.
function localDayRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  return { start, end };
}
// Groups: Today / Yesterday / Previous 7 days / Older
function historyGroup(ts, now = new Date()) {
  const { start } = localDayRange(now);
  const day = 86400000;
  if (ts >= start) return 'Today';
  if (ts >= start - day) return 'Yesterday';
  if (ts >= start - 7 * day) return 'Previous 7 days';
  return 'Older';
}
module.exports = { countLines, countWords, stats, localDayRange, historyGroup };
