const path = require('path');
const fs = require('fs');
function root() {
  const { app } = require('electron');
  return app.isPackaged ? path.join(process.resourcesPath, 'engine') : path.join(__dirname, '../../resources/engine');
}
function models() {
  const { app } = require('electron');
  const bundled = path.join(root(), 'models');
  if (!app.isPackaged) return bundled;
  const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local');
  const persistent = path.join(localAppData, 'Maicer', 'engine', 'models');
  return ['speech.bin', 'writer.gguf'].every(file => fs.existsSync(path.join(persistent, file))) ? persistent : bundled;
}
module.exports = {
  whisperCli: () => path.join(root(), 'whisper', 'whisper-cli.exe'),
  whisperModel: () => path.join(models(), 'speech.bin'),
  llamaServer: () => path.join(root(), 'llama', 'llama-server.exe'),
  languageModel: () => path.join(models(), 'writer.gguf'),
};
