const { contextBridge, ipcRenderer } = require('electron');
const inv = (c) => (...a) => ipcRenderer.invoke(c, ...a);
const on = (c) => (cb) => ipcRenderer.on(c, (_, d) => cb(d));
contextBridge.exposeInMainWorld('maicer', {
  stats: inv('stats'), recent: inv('recent'), daily: inv('daily'), search: inv('search'), del: inv('delete'), clear: inv('clear'), copy: inv('copy'),
  getSettings: inv('settings:get'), setSettings: inv('settings:set'), openDiag: inv('diag:open'),
  onChange: on('data-changed'), onRec: on('rec'), onGoto: on('goto'), onState: on('state'), onRecCmd: on('rec-cmd'),
  recData: (u8) => ipcRenderer.send('rec:data', u8), recError: (c) => ipcRenderer.send('rec:error', c),
});
