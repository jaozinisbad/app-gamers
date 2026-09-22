import React from 'react';

// Gera uma cor consistente pro servidor a partir do nome/id, pra cada
// servidor ter uma "cara" diferente na barra, parecido com ícones
// customizados (sem precisar de upload de imagem).
const PALETA = ['#7866d8', '#4d78bd', '#8a63ba', '#3d8c94', '#665bd1', '#ad659a', '#4e87a8', '#6570b7'];

function corDoServidor(servidor) {
  const chave = String(servidor.id ?? servidor.nome);
  let soma = 0;
  for (let i = 0; i < chave.length; i++) soma += chave.charCodeAt(i);
  return PALETA[soma % PALETA.length];
}

export default function ServerSidebar({ servidores, servidorAtivoId, viewAtiva, onSelecionar, onAbrirAmigos, onAbrirModal }) {
  return (
    <div className="server-sidebar">
      <button
        type="button"
        className={`server-icon${viewAtiva === 'amigos' ? ' active' : ''}`}
        title="Amigos"
        aria-label="Abrir amigos"
        onClick={onAbrirAmigos}
      >
        <span className="tooltip-servidor">Amigos</span>
        <span aria-hidden="true">AM</span>
      </button>

      <div className="divider" />

      {servidores.map((s) => (
        <button
          type="button"
          key={s.id}
          className={`server-icon${viewAtiva === 'servidor' && s.id === servidorAtivoId ? ' active' : ''}`}
          style={{ background: corDoServidor(s) }}
          aria-label={`Abrir servidor ${s.nome}`}
          onClick={() => onSelecionar(s.id)}
        >
          <span className="tooltip-servidor">{s.nome}</span>
          {s.icone_url ? <img src={s.icone_url} alt="" className="server-icon__imagem" /> : s.nome.slice(0, 2).toUpperCase()}
        </button>
      ))}

      <div className="divider" />
      <button type="button" className="server-icon add-server" title="Criar ou entrar em servidor" aria-label="Criar ou entrar em servidor" onClick={onAbrirModal}>
        +
      </button>
    </div>
  );
}
