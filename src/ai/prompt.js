const SYSTEM = `You are the writing engine inside a voice-typing app. The user dictated a spoken instruction.
- If SELECTED TEXT is provided, apply the instruction to it and return only the transformed text.
- If the speech is an instruction (write code, create something, rewrite, convert), carry it out.
- If the speech is plain content meant to be typed (a normal sentence), return it with correct punctuation and capitalization.
- Return ONLY the result. No explanations, no greetings, no markdown code fences. Code must be raw code only.`;
function buildMessages(request, selection = '') {
  const user = selection ? `SELECTED TEXT:\n${selection}\n\nINSTRUCTION: ${request}` : request;
  return [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }];
}
// Strip a wrapping markdown fence if the model added one.
function cleanOutput(raw) {
  let t = String(raw ?? '').replace(/\r\n?/g, '\n').trim();
  const m = t.match(/^```[\w+#-]*\n([\s\S]*?)\n?```$/);
  if (m) t = m[1];
  return t.trim();
}
const NEEDS_SEL = /\b(this|these|selected|above|that)\b|\b(rewrite|rephrase|proofread|translate|convert|refactor|summari[sz]e|fix|improve|shorten|expand)\b/i;
const needsSelection = (req) => NEEDS_SEL.test(req);
const CODE_WORDS = /\b(function|loop|class|object|variable|statement|array|code|python|javascript|typescript|java|rust|sql|html|css|json|regex|api|method|script|const|def)\b/i;
function detectKind(request, output) {
  if (CODE_WORDS.test(request)) return 'code';
  return /[{};]|=>|^\s*(def|function|class|import)\b/m.test(output) && output.includes('\n') ? 'code' : 'text';
}
module.exports = { buildMessages, cleanOutput, needsSelection, detectKind };
