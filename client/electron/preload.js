const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Listar telas e janelas disponíveis para compartilhamento
  // (desktopCapturer só existe no processo main, por isso usamos IPC)
  listarFontesCompartilhamento: async () => {
    try {
      return await ipcRenderer.invoke('listar-fontes-compartilhamento');
    } catch (err) {
      console.error('Erro ao listar fontes:', err);
      throw err;
    }
  },

  // Trocar dispositivo de áudio
  changeAudioDevice: async (kind, deviceId) => {
    try {
      // Envia mensagem para main process, que pode fazer algo com isso
      await ipcRenderer.invoke('change-audio-device', { kind, deviceId });
    } catch (err) {
      console.error('Erro ao trocar dispositivo:', err);
      throw err;
    }
  },
});
