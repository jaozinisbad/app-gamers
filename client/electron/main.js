const { app, BrowserWindow, desktopCapturer, session, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { exec } = require('child_process');

// loopback-capture só funciona no Windows — em qualquer outro sistema
// (dev no Mac/Linux, por exemplo) isso falha ao importar, então
// carregamos com cuidado pra não derrubar o app inteiro por causa disso.
let loopback = null;
try {
  loopback = require('loopback-capture');
} catch (err) {
  console.warn('loopback-capture não disponível (provavelmente não é Windows 10+):', err.message);
}

// Guarda qual fonte (tela/janela) o usuário escolheu no seletor próprio
// do app, pra usar na hora que o Electron de fato pedir a captura.
let fonteEscolhidaId = null;
let capturaProcessoAtual = null;

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
      // "loopback" captura o áudio que está saindo do seu PC (sistema
      // todo, não só da janela/jogo escolhido). Para capturar só de um
      // app específico, usamos outra API por baixo (veja
      // configurarCapturaPorProcesso) — o renderer decide qual usar.
      callback({ video: escolhida || fontes[0], audio: 'loopback' });
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
      // "tela" (monitor inteiro) ou "janela" (um app específico) — só
      // janelas têm um processo específico pra isolar o áudio.
      tipo: fonte.id.startsWith('screen') ? 'tela' : 'janela',
    }));
  });
}

// Descobre o PID (identificador do processo) de uma janela pelo título
// dela, usando o PowerShell — assim não precisamos de mais nenhuma
// dependência nativa só pra essa busca.
function obterPidPorTitulo(tituloJanela) {
  return new Promise((resolve) => {
    const comandoPs =
      "Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object Id, MainWindowTitle | ConvertTo-Json -Compress";
    exec(
      `powershell -NoProfile -Command "${comandoPs}"`,
      { windowsHide: true, timeout: 5000 },
      (err, stdout) => {
        if (err) {
          resolve(null);
          return;
        }
        try {
          let lista = JSON.parse(stdout || '[]');
          if (!Array.isArray(lista)) lista = [lista];
          const encontrado = lista.find((p) => p.MainWindowTitle === tituloJanela);
          resolve(encontrado ? encontrado.Id : null);
        } catch (e) {
          resolve(null);
        }
      },
    );
  });
}

// Captura o áudio de UM app específico (ex: só o jogo, ignorando
// Spotify/YouTube) usando a mesma técnica que Discord e OBS usam no
// Windows (WASAPI Process Loopback Capture) — bem mais avançado que o
// "audio: loopback" de cima, que pega o som do sistema inteiro.
function configurarCapturaPorProcesso() {
  ipcMain.handle('iniciar-captura-processo', async (event, tituloJanela) => {
    if (!loopback) {
      return { sucesso: false, mensagem: 'Esse recurso só funciona no Windows 10 (versão 2004) ou mais novo.' };
    }

    try {
      const pid = await obterPidPorTitulo(tituloJanela);
      if (!pid) {
        return { sucesso: false, mensagem: `Não encontrei o processo da janela "${tituloJanela}".` };
      }

      if (capturaProcessoAtual) {
        capturaProcessoAtual.stop();
        capturaProcessoAtual = null;
      }

      capturaProcessoAtual = new loopback.LoopbackCapture();
      // "true" inclui processos-filho (ex: um jogo que abre sub-processos)
      capturaProcessoAtual.start(pid, true, (chunk) => {
        event.sender.send('audio-tela-chunk', chunk);
      });

      return { sucesso: true };
    } catch (err) {
      return { sucesso: false, mensagem: `Erro ao iniciar a captura: ${err.message}` };
    }
  });

  ipcMain.handle('parar-captura-processo', () => {
    if (capturaProcessoAtual) {
      capturaProcessoAtual.stop();
      capturaProcessoAtual = null;
    }
    return { sucesso: true };
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

  return win;
}

// Verifica se há uma versão nova publicada, baixa em segundo plano e,
// quando terminar, avisa a interface pra mostrar o botão de reiniciar.
// Só roda em build empacotado (não em npm run dev:electron).
function configurarAtualizacaoAutomatica(win) {
  if (!app.isPackaged) return;

  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('atualizacao-pronta');
  });

  ipcMain.handle('reiniciar-para-atualizar', () => {
    autoUpdater.quitAndInstall();
  });
}

app.whenReady().then(() => {
  configurarCompartilhamentoDeTela();
  configurarCapturaPorProcesso();
  const win = createWindow();
  configurarAtualizacaoAutomatica(win);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
