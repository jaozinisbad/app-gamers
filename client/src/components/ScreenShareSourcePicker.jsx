import React, { useEffect, useState } from 'react';

/**
 * Modal para seleção de fonte de compartilhamento de tela (Electron)
 * - Lista telas, janelas
 * - Escolhe resolução (720p/1080p) e FPS (30/60)
 */
export default function ScreenShareSourcePicker({ onSelecionar, onFechar }) {
  const [fontes, setFontes] = useState([]); // [{id, name, thumbnail, tipo}]
  // Fixado em 720p por enquanto — foco é deixar essa resolução impecável
  // antes de reabrir 1080p como opção.
  const resolucao = '720p';
  const [fps, setFps] = useState('60');
  const [selecionada, setSelecionada] = useState(null);
  const [capturarAudioApp, setCapturarAudioApp] = useState(false);
  const [ignorarAudioDiscord, setIgnorarAudioDiscord] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregarFontes() {
      try {
        if (window.electronAPI?.listarFontesCompartilhamento) {
          const lista = await window.electronAPI.listarFontesCompartilhamento();
          setFontes(lista);
          if (lista.length > 0) setSelecionada(lista[0].id);
        } else {
          // Sem Electron, usa getDisplayMedia padrão
          setErro('Use o navegador ou Electron para compartilhar tela');
        }
      } catch (e) {
        setErro(`Erro ao listar telas: ${e.message}`);
      } finally {
        setCarregando(false);
      }
    }
    carregarFontes();
  }, []);

  function confirmar() {
    if (!selecionada) return;
    const fonte = fontes.find((f) => f.id === selecionada);
    if (fonte) {
      onSelecionar({
        fonteId: fonte.id,
        resolucao,
        fps: parseInt(fps),
        // Só faz sentido pedir áudio isolado de um app quando a fonte
        // escolhida É um app (janela), não uma tela inteira.
        capturarAudioApp: fonte.tipo === 'janela' && capturarAudioApp,
        tituloJanela: fonte.name,
        // O inverso: só faz sentido "ignorar o Discord" quando a fonte
        // é a tela inteira — se já é uma janela específica, o Discord
        // naturalmente já não está sendo capturado.
        ignorarProcessoAudio: fonte.tipo === 'tela' && ignorarAudioDiscord,
        nomeProcessoIgnorado: 'Discord.exe',
      });
    }
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal screen-picker-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Qual tela você deseja compartilhar?</h2>

        {carregando ? (
          <p>Carregando telas...</p>
        ) : erro ? (
          <p style={{ color: 'red' }}>{erro}</p>
        ) : (
          <>
            <div className="screen-picker-grid">
              {fontes.map((fonte) => (
                <div
                  key={fonte.id}
                  className={`screen-picker-item ${selecionada === fonte.id ? 'selecionada' : ''}`}
                  onClick={() => setSelecionada(fonte.id)}
                >
                  {fonte.thumbnail && (
                    <img src={fonte.thumbnail} alt={fonte.name} className="screen-picker-thumb" />
                  )}
                  <p className="screen-picker-label">{fonte.name}</p>
                </div>
              ))}
            </div>

            {fontes.find((f) => f.id === selecionada)?.tipo === 'janela' && (
              <label className="screen-picker-audio-app">
                <input
                  type="checkbox"
                  checked={capturarAudioApp}
                  onChange={(e) => setCapturarAudioApp(e.target.checked)}
                />
                🎯 Capturar só o áudio desse app (experimental, Windows) — em vez do som do
                sistema inteiro
              </label>
            )}

<<<<<<< HEAD
            {fontes.find((f) => f.id === selecionada)?.tipo === 'tela' && (
              <label className="screen-picker-audio-app">
                <input
                  type="checkbox"
                  checked={ignorarAudioDiscord}
                  onChange={(e) => setIgnorarAudioDiscord(e.target.checked)}
                />
                🔇 Ignorar o Discord no áudio (experimental, Windows) — evita o eco de quem
                está na call ouvir a própria voz de volta
              </label>
            )}

=======
>>>>>>> 9cfcac3bd742dc24bebd676096585cab7fb4d17c
            <div className="screen-picker-options">
              <label>
                FPS:
                <select value={fps} onChange={(e) => setFps(e.target.value)}>
                  <option value="30">30 FPS</option>
                  <option value="60">60 FPS</option>
                </select>
              </label>
            </div>

            <div className="screen-picker-acoes">
              <button type="button" onClick={onFechar} className="btn-secundario">
                Cancelar
              </button>
              <button type="button" onClick={confirmar} className="btn-primario" disabled={!selecionada}>
                Compartilhar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
