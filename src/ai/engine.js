// Engine interface: run({audio, settings, getSelection}) -> { transcription, output, kind }.
// The UI never touches models; swap this module's internals to change backends.
const fs = require('fs'); const os = require('os'); const path = require('path');
const { analyze } = require('../vad/vad'); const { encodeWav } = require('../audio/wav');
const { transcribe } = require('../speech/whisper'); const writer = require('./llama');
const { buildMessages, cleanOutput, needsSelection, detectKind } = require('./prompt');
const fail = (code) => Object.assign(new Error(code), { code });

async function run({ audio, settings, getSelection, signal }) {
  const cancelled = () => Object.assign(new Error('cancelled'), { code: 'CANCELLED' });
  if (signal?.aborted) throw cancelled();
  const v = analyze(audio, { sensitivity: settings.vad });
  if (!v.hasSpeech) throw fail('NO_SPEECH');
  const wav = path.join(os.tmpdir(), `maicer-${process.pid}-${Date.now()}.wav`);
  let text;
  try { fs.writeFileSync(wav, encodeWav(v.samples)); text = await transcribe(wav, { language: settings.language }); }
  finally { fs.unlink(wav, () => {}); }
  if (signal?.aborted) throw cancelled();
  if (!text) throw fail('NO_SPEECH');
  let selection = '';
  if (needsSelection(text)) selection = await getSelection().catch(() => '');
  const output = cleanOutput(await writer.chat(buildMessages(text, selection), signal));
  if (signal?.aborted) throw cancelled();
  if (!output) throw fail('GENERATION');
  return { transcription: text, output, kind: detectKind(text, output) };
}
module.exports = { run, configure: (s) => writer.configure(s), warmUp: () => writer.ensure().catch(() => {}), shutdown: () => writer.stop() };
