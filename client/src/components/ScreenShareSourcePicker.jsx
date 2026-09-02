import React, { useEffect, useState } from 'react';

/**
 * Modal para seleção de fonte de compartilhamento de tela (Electron)
 * - Lista telas, janelas
 * - Escolhe resolução (720p/1080p) e FPS (30/60)
 */
export default function ScreenShareSourcePicker({ onSelecionar, onFechar }) {
  const [fontes, setFontes] = useState([]); // [{id, name, thumbnail}]
  const [resolucao, setResolucao] = useState('720p');
  const [fps, setFps] = useState('30');
  const [selecionada, setSelecionada] = useState(null);
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

            <div className="screen-picker-options">
              <label>
                Resolução:
                <select value={resolucao} onChange={(e) => setResolucao(e.target.value)}>
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </label>
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
