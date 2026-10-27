const path = require('path');
function root() {
  const { app } = require('electron');
  return app.isPackaged ? path.join(process.resourcesPath, 'engine') : path.join(__dirname, '../../resources/engine');
}
module.exports = {
  whisperCli: () => path.join(root(), 'whisper', 'whisper-cli.exe'),
  whisperModel: () => path.join(root(), 'models', 'speech.bin'),
  llamaServer: () => path.join(root(), 'llama', 'llama-server.exe'),
  languageModel: () => path.join(root(), 'models', 'writer.gguf'),
};
