import React, { useEffect, useState } from 'react';

/**
 * Modal de Configurações
 * - Seleção de microfone / dispositivo de entrada
 * - Seleção de fone / dispositivo de saída
 * - Controle de volume (entrada e saída)
 */
export default function SettingsModal({ onFechar, onSalvarConfiguracao }) {
  const [dispositivos, setDispositivos] = useState({
    microfones: [],
    fones: [],
  });
  const [configuracao, setConfiguracao] = useState(() => {
    const salva = localStorage.getItem('configuracoesAudio');
    const padrao = {
          microfoneId: '',
          foneId: '',
          volumeEntrada: 100,
          volumeSaida: 100,
          perfilEntrada: 'isolamento',
          supressaoRuido: 'rnnoise',
          cancelamentoEco: true,
          ganhoAutomatico: true,
        };
    try {
      return salva ? { ...padrao, ...JSON.parse(salva) } : padrao;
    } catch {
      return padrao;
    }
  });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregarDispositivos() {
      try {
        const dispositivos = await navigator.mediaDevices.enumerateDevices();
        const microfones = dispositivos.filter((d) => d.kind === 'audioinput');
        const fones = dispositivos.filter((d) => d.kind === 'audiooutput');

        setDispositivos({ microfones, fones });

        // Se ainda não tem um microfone selecionado, seleciona o padrão
        if (!configuracao.microfoneId && microfones.length > 0) {
          setConfiguracao((atual) => ({ ...atual, microfoneId: microfones[0].deviceId }));
        }
        // Se ainda não tem um fone selecionado, seleciona o padrão
        if (!configuracao.foneId && fones.length > 0) {
          setConfiguracao((atual) => ({ ...atual, foneId: fones[0].deviceId }));
        }
      } catch (e) {
        setErro(`Erro ao listar dispositivos: ${e.message}`);
      } finally {
        setCarregando(false);
      }
    }

    navigator.mediaDevices.addEventListener('devicechange', carregarDispositivos);
    carregarDispositivos();
    return () => navigator.mediaDevices.removeEventListener('devicechange', carregarDispositivos);
  }, []);

  function salvar() {
    localStorage.setItem('configuracoesAudio', JSON.stringify(configuracao));
    onSalvarConfiguracao?.(configuracao);
    onFechar();
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal__header"><div><span className="eyebrow">Comunicação</span><h2>Voz e vídeo</h2></div><button type="button" onClick={onFechar} aria-label="Fechar">×</button></div>

        {carregando ? (
          <p>Carregando dispositivos...</p>
        ) : erro ? (
          <p style={{ color: 'red' }}>{erro}</p>
        ) : (
          <>
            <div className="settings-section"><h3>Voz</h3><div className="settings-grid">
            {dispositivos.microfones.length > 0 && (
              <label className="settings-field">
                Microfone
                <select
                  value={configuracao.microfoneId}
                  onChange={(e) => setConfiguracao({ ...configuracao, microfoneId: e.target.value })}
                >
                  {dispositivos.microfones.map((mic) => (
                    <option key={mic.deviceId} value={mic.deviceId}>
                      {mic.label || `Microfone ${mic.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {dispositivos.fones.length > 0 && (
              <label className="settings-field">
                Fone / Saída de Áudio
                <select
                  value={configuracao.foneId}
                  onChange={(e) => setConfiguracao({ ...configuracao, foneId: e.target.value })}
                >
                  {dispositivos.fones.map((fone) => (
                    <option key={fone.deviceId} value={fone.deviceId}>
                      {fone.label || `Fone ${fone.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            </div>

            <label className="settings-field">
              Volume de Entrada (Microfone): {configuracao.volumeEntrada}%
              <input
                type="range"
                min="0"
                max="200"
                value={configuracao.volumeEntrada}
                onChange={(e) => setConfiguracao({ ...configuracao, volumeEntrada: parseInt(e.target.value) })}
                className="volume-slider"
              />
            </label>
            </div>

            <div className="settings-section">
              <h3>Perfil de entrada</h3>
              <div className="input-profile-options">
                <label><input type="radio" name="perfilEntrada" checked={configuracao.perfilEntrada === 'isolamento'} onChange={() => setConfiguracao({ ...configuracao, perfilEntrada: 'isolamento', supressaoRuido: 'rnnoise', cancelamentoEco: true, ganhoAutomatico: true })} /><span><strong>Isolamento de voz</strong><small>Foco na voz e redução forte de teclado e ruído.</small></span></label>
                <label><input type="radio" name="perfilEntrada" checked={configuracao.perfilEntrada === 'estudio'} onChange={() => setConfiguracao({ ...configuracao, perfilEntrada: 'estudio', supressaoRuido: 'desligada', cancelamentoEco: false, ganhoAutomatico: false })} /><span><strong>Estúdio</strong><small>Áudio cru, para música ou microfones já tratados.</small></span></label>
                <label><input type="radio" name="perfilEntrada" checked={configuracao.perfilEntrada === 'personalizado'} onChange={() => setConfiguracao({ ...configuracao, perfilEntrada: 'personalizado' })} /><span><strong>Personalizado</strong><small>Escolha cada processamento abaixo.</small></span></label>
              </div>
            </div>

            {configuracao.perfilEntrada === 'personalizado' && <div className="settings-section settings-advanced">
              <h3>Processamento avançado</h3>
              <label className="settings-toggle-row"><span><strong>Supressão de ruído</strong><small>RNNoise gratuito reduz teclado e ruído ambiente.</small></span><select value={configuracao.supressaoRuido} onChange={(e) => setConfiguracao({ ...configuracao, supressaoRuido: e.target.value })}><option value="rnnoise">RNNoise avançado</option><option value="nativa">Padrão do navegador</option><option value="desligada">Desligada</option></select></label>
              <label className="settings-toggle-row"><span><strong>Cancelamento de eco</strong><small>Evita que o áudio da chamada retorne pelo microfone.</small></span><input type="checkbox" checked={configuracao.cancelamentoEco !== false} onChange={(e) => setConfiguracao({ ...configuracao, cancelamentoEco: e.target.checked })} /></label>
              <label className="settings-toggle-row"><span><strong>Ajustar ganho automaticamente</strong><small>Mantém sua voz em um volume equilibrado.</small></span><input type="checkbox" checked={configuracao.ganhoAutomatico !== false} onChange={(e) => setConfiguracao({ ...configuracao, ganhoAutomatico: e.target.checked })} /></label>
            </div>}

            <label className="settings-field">
              Volume de Saída (Fone): {configuracao.volumeSaida}%
              <input
                type="range"
                min="0"
                max="200"
                value={configuracao.volumeSaida}
                onChange={(e) => setConfiguracao({ ...configuracao, volumeSaida: parseInt(e.target.value) })}
                className="volume-slider"
              />
            </label>

            <div className="settings-acoes">
              <button type="button" onClick={onFechar} className="btn-secundario">
                Cancelar
              </button>
              <button type="button" onClick={salvar} className="btn-primario">
                Salvar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
