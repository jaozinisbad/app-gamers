import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api.js';

export default function ChatArea({ canal, statusConexao, socket, token, nomeUsuario }) {
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const fimDaLista = useRef(null);

  // Carrega o histórico e entra na sala do canal sempre que ele muda.
  useEffect(() => {
    if (canal.tipo !== 'texto') return;

    let ativo = true;
    apiFetch(`/api/canais/${canal.id}/mensagens`, token)
      .then((dados) => {
        if (ativo) setMensagens(dados);
      })
      .catch(() => {});

    socket?.emit('entrar-canal', canal.id);

    return () => {
      ativo = false;
      socket?.emit('sair-canal', canal.id);
    };
  }, [canal.id, canal.tipo, socket, token]);

  // Escuta novas mensagens em tempo real.
  useEffect(() => {
    if (!socket) return;
    function aoReceber({ canalId, mensagem }) {
      if (canalId === canal.id) {
        setMensagens((atual) => [...atual, mensagem]);
      }
    }
    socket.on('nova-mensagem', aoReceber);
    return () => socket.off('nova-mensagem', aoReceber);
  }, [socket, canal.id]);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  function enviar(e) {
    e.preventDefault();
    if (!texto.trim() || !socket) return;
    socket.emit('enviar-mensagem', { canalId: canal.id, conteudo: texto.trim() });
    setTexto('');
  }

  const conectado = statusConexao === 'conectado ao servidor';

  return (
    <div className="content">
      <div className="content__header">
        {canal.tipo === 'texto' ? '#' : '🔊'} {canal.nome}
      </div>

      {canal.tipo === 'texto' ? (
        <>
          <div className="content__body">
            <div className="connection-banner" style={{ marginBottom: 16 }}>
              <span className="dot" style={{ background: conectado ? '#23a559' : '#f0b232' }} />
              Servidor: {statusConexao}
            </div>
            <div className="chat-mensagens">
              {mensagens.map((m) => (
                <div key={m.id} className="chat-mensagem">
                  <span className="autor">{m.autor}</span>
                  <span className="hora">{new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="conteudo">{m.conteudo}</span>
                </div>
              ))}
              <div ref={fimDaLista} />
            </div>
          </div>
          <form className="chat-input-area" onSubmit={enviar}>
            <input
              className="chat-input"
              placeholder={`Conversar em #${canal.nome}`}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </form>
        </>
      ) : (
        <div className="content__body">
          <p style={{ color: '#949ba4' }}>Canal de voz selecionado.</p>
        </div>
      )}
    </div>
  );
}
