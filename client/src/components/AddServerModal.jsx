import React, { useState } from 'react';

export default function AddServerModal({ onFechar, onCriar, onEntrar }) {
  const [modo, setModo] = useState('criar'); // 'criar' | 'entrar'
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function confirmar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      if (modo === 'criar') {
        await onCriar(nome.trim());
      } else {
        await onEntrar(codigo.trim());
      }
      onFechar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={confirmar}>
        <div className="modal-tabs">
          <div
            className={`modal-tab${modo === 'criar' ? ' active' : ''}`}
            onClick={() => setModo('criar')}
          >
            Criar servidor
          </div>
          <div
            className={`modal-tab${modo === 'entrar' ? ' active' : ''}`}
            onClick={() => setModo('entrar')}
          >
            Entrar com convite
          </div>
        </div>

        {modo === 'criar' ? (
          <input
            autoFocus
            placeholder="Nome do servidor"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="modal-input"
          />
        ) : (
          <input
            autoFocus
            placeholder="Código de convite"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="modal-input"
          />
        )}

        {erro && <div className="modal-erro">{erro}</div>}

        <div className="modal-acoes">
          <button type="button" onClick={onFechar} className="modal-botao-secundario">
            Cancelar
          </button>
          <button type="submit" disabled={carregando} className="modal-botao-primario">
            {carregando ? 'Aguarde...' : modo === 'criar' ? 'Criar' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
