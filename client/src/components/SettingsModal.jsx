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
    return salva
      ? JSON.parse(salva)
      : {
          microfoneId: '',
          foneId: '',
          volumeEntrada: 100,
          volumeSaida: 100,
        };
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
        <h2>Configurações de Áudio</h2>

        {carregando ? (
          <p>Carregando dispositivos...</p>
        ) : erro ? (
          <p style={{ color: 'red' }}>{erro}</p>
        ) : (
          <>
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
