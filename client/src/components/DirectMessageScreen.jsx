import React, { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import { apiFetch } from '../api.js';

export default function DirectMessageScreen({ amigo, socket, token, meuId }) {
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const fimDaLista = useRef(null);

  useEffect(() => {
    let ativo = true;
    apiFetch(`/api/mensagens-diretas/${amigo.id}`, token)
      .then((dados) => {
        if (ativo) setMensagens(dados);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [amigo.id, token]);

  useEffect(() => {
    if (!socket) return;
    function aoReceber({ comUsuarioId, deUsuarioId, mensagem }) {
      // Essa DM pertence a essa conversa se envolve exatamente esse amigo
      // (em qualquer direção — enviada ou recebida).
      const pertenceAConversa =
        (deUsuarioId === amigo.id && comUsuarioId === meuId) ||
        (deUsuarioId === meuId && comUsuarioId === amigo.id);
      if (pertenceAConversa) setMensagens((atual) => [...atual, mensagem]);
    }
    socket.on('nova-dm', aoReceber);
    return () => socket.off('nova-dm', aoReceber);
  }, [socket, amigo.id, meuId]);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  function enviar(e) {
    e.preventDefault();
    if (!texto.trim() || !socket) return;
    socket.emit('enviar-dm', { paraUsuarioId: amigo.id, conteudo: texto.trim() });
    setTexto('');
  }

  return (
    <div className="content">
      <div className="content__header">
        <Avatar nome={amigo.nome} avatarUrl={amigo.avatar_url} avatarCor={amigo.avatar_cor || '#5865f2'} tamanho="sm" />
        {amigo.nome}
      </div>
      <div className="content__body">
        <div className="chat-mensagens">
          {mensagens.map((m) => (
            <div key={m.id} className="chat-mensagem">
              <span className="autor">{m.remetente_id === meuId ? 'Você' : amigo.nome}</span>
              <span className="hora">
                {new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="conteudo">{m.conteudo}</span>
            </div>
          ))}
          <div ref={fimDaLista} />
        </div>
      </div>
      <form className="chat-input-area" onSubmit={enviar}>
        <input
          className="chat-input"
          placeholder={`Conversar com ${amigo.nome}`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </form>
    </div>
  );
}
