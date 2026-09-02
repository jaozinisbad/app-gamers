import React from 'react';

// Gera uma cor consistente pro servidor a partir do nome/id, pra cada
// servidor ter uma "cara" diferente na barra, parecido com ícones
// customizados (sem precisar de upload de imagem).
const PALETA = ['#f06449', '#e0a458', '#43aa8b', '#4d96ff', '#7b61ff', '#e85d9e', '#22c1a4', '#ff8552'];

function corDoServidor(servidor) {
  const chave = String(servidor.id ?? servidor.nome);
  let soma = 0;
  for (let i = 0; i < chave.length; i++) soma += chave.charCodeAt(i);
  return PALETA[soma % PALETA.length];
}

export default function ServerSidebar({ servidores, servidorAtivoId, viewAtiva, onSelecionar, onAbrirAmigos, onAbrirModal }) {
  return (
    <div className="server-sidebar">
      <div
        className={`server-icon${viewAtiva === 'amigos' ? ' active' : ''}`}
        title="Amigos"
        onClick={onAbrirAmigos}
      >
        <span className="tooltip-servidor">Amigos</span>
        AM
      </div>

      <div className="divider" />

      {servidores.map((s) => (
        <div
          key={s.id}
          className={`server-icon${viewAtiva === 'servidor' && s.id === servidorAtivoId ? ' active' : ''}`}
          style={{ background: corDoServidor(s) }}
          onClick={() => onSelecionar(s.id)}
        >
          <span className="tooltip-servidor">{s.nome}</span>
          {s.nome.slice(0, 2).toUpperCase()}
        </div>
      ))}

      <div className="divider" />
      <div className="server-icon add-server" title="Criar ou entrar em servidor" onClick={onAbrirModal}>
        +
      </div>
    </div>
  );
}
