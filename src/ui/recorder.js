let ctx, stream, node, chunks = [];
maicer.onRecCmd(({ cmd, deviceId }) => cmd === 'start' ? start(deviceId) : stop());
async function open(id) {
  const base = { channelCount: 1, echoCancellation: true, noiseSuppression: true };
  try { return await navigator.mediaDevices.getUserMedia({ audio: id ? { ...base, deviceId: { exact: id } } : base }); }
  catch (e) { if (id) return navigator.mediaDevices.getUserMedia({ audio: base }); throw e; }  // chosen mic unplugged -> default
}
async function start(id) {
  chunks = [];
  try {
    stream = await open(id);
    stream.getAudioTracks()[0].onended = () => maicer.recError('MIC');
    ctx = new AudioContext({ sampleRate: 16000 });
    const src = ctx.createMediaStreamSource(stream);
    node = ctx.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = e => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(node); node.connect(ctx.destination);
  } catch { cleanup(); maicer.recError('MIC'); }
}
function cleanup() { try { node?.disconnect(); } catch {} stream?.getTracks().forEach(t => t.stop()); try { ctx?.close(); } catch {} node = stream = ctx = null; }
function stop() {
  cleanup();
  const n = chunks.reduce((a, c) => a + c.length, 0), all = new Float32Array(n); let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.length; }
  chunks = [];
  maicer.recData(new Uint8Array(all.buffer));
}
