const { app, BrowserWindow, desktopCapturer, session, ipcMain } = require('electron');
const path = require('path');

// Guarda qual fonte (tela/janela) o usuário escolheu no seletor próprio
// do app, pra usar na hora que o Electron de fato pedir a captura.
let fonteEscolhidaId = null;

function configurarCompartilhamentoDeTela() {
  // Recebe do renderer qual fonte foi escolhida no ScreenShareSourcePicker,
  // ANTES de getDisplayMedia() ser chamado.
  ipcMain.on('definir-fonte-compartilhamento', (_event, fonteId) => {
    fonteEscolhidaId = fonteId;
  });

  // IMPORTANTE: useSystemPicker precisa ficar desligado — se estiver
  // ligado, o próprio Windows/macOS mostra o seletor nativo dele e essa
  // função nem chega a rodar, ignorando a fonte escolhida no app.
  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      const fontes = await desktopCapturer.getSources({ types: ['screen', 'window'] });
      const escolhida = fonteEscolhidaId ? fontes.find((f) => f.id === fonteEscolhidaId) : null;
      callback({ video: escolhida || fontes[0] });
      fonteEscolhidaId = null; // reseta pra próxima vez, evita "grudar" na mesma fonte
    },
    { useSystemPicker: false },
  );

  // desktopCapturer só pode ser usado no processo main (Electron 17+).
  // Por isso expomos essa chamada via IPC para o preload/renderer usarem.
  ipcMain.handle('listar-fontes-compartilhamento', async () => {
    const fontes = await desktopCapturer.getSources({
      types: ['screen', 'window'],
    });

    return fontes.map((fonte, index) => ({
      id: fonte.id,
      name: fonte.name.includes('Entire')
        ? `Tela ${index}`
        : fonte.name,
      thumbnail: fonte.thumbnail.toDataURL(),
    }));
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (!app.isPackaged) {
    // Modo desenvolvimento: aponta pro servidor do Vite
    win.loadURL('http://localhost:5173');
  } else {
    // Modo empacotado (após "npm run build")
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  configurarCompartilhamentoDeTela();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
