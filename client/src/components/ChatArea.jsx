import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api.js';

function ChatIcon({ nome }) {
  const paths = nome === 'anexo'
    ? <path d="m7 10 5.5-5.5a3 3 0 1 1 4.2 4.2L9 16.4A4.5 4.5 0 0 1 2.6 10l7.1-7.1" />
    : <path d="M3 5h14M8 5V3h4v2M5 5l1 12h8l1-12M8 9v4M12 9v4" />;
  return <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>;
}

export default function ChatArea({ canal, statusConexao, socket, token, nomeUsuario, meuUsuarioId, podeApagarMensagens }) {
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const fimDaLista = useRef(null);
  const inputArquivo = useRef(null);

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

  // Escuta novas mensagens e apagamentos em tempo real.
  useEffect(() => {
    if (!socket) return;
    function aoReceber({ canalId, mensagem }) {
      if (canalId === canal.id) {
        setMensagens((atual) => [...atual, mensagem]);
      }
    }
    function aoApagar({ canalId, mensagemId }) {
      if (canalId === canal.id) {
        setMensagens((atual) => atual.filter((m) => m.id !== mensagemId));
      }
    }
    socket.on('nova-mensagem', aoReceber);
    socket.on('mensagem-apagada', aoApagar);
    return () => {
      socket.off('nova-mensagem', aoReceber);
      socket.off('mensagem-apagada', aoApagar);
    };
  }, [socket, canal.id]);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  function enviar(e) {
    e.preventDefault();
    if ((!texto.trim() && !arquivo) || !socket) return;
    if (arquivo && arquivo.size > 5 * 1024 * 1024) {
      window.alert('O arquivo precisa ter no máximo 5MB.');
      return;
    }
    const enviarComDados = (url) => {
      socket.emit('enviar-mensagem', {
        canalId: canal.id,
        conteudo: texto.trim(),
        anexo: arquivo ? { nome: arquivo.name, tipo: arquivo.type || 'application/octet-stream', tamanho: arquivo.size, url } : null,
      });
      setTexto('');
      setArquivo(null);
      if (inputArquivo.current) inputArquivo.current.value = '';
    };
    if (!arquivo) enviarComDados(null);
    else {
      const leitor = new FileReader();
      leitor.onload = () => enviarComDados(leitor.result);
      leitor.readAsDataURL(arquivo);
    }
  }

  function apagarMensagem(mensagemId) {
    socket?.emit('apagar-mensagem', { canalId: canal.id, mensagemId });
  }

  const conectado = statusConexao === 'conectado ao servidor';

  return (
    <div className="content">
      <div className="content__header">
        <span className="content__channel-symbol">{canal.tipo === 'texto' ? '#' : '◌'}</span> {canal.nome}
      </div>

      {canal.tipo === 'texto' ? (
        <>
          <div className="content__body">
            <div className="connection-banner" style={{ marginBottom: 16 }}>
              <span className="dot" style={{ background: conectado ? '#23a559' : '#f0b232' }} />
              Servidor: {statusConexao}
            </div>
            <div className="chat-mensagens">
              {mensagens.map((m) => {
                const podeApagar = podeApagarMensagens || m.usuario_id === meuUsuarioId;
                return (
                  <div key={m.id} className="chat-mensagem">
                    <div className="chat-mensagem__cabecalho">
                      <span className="autor">{m.autor}</span>
                      <span className="hora">{new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {podeApagar && (
                        <button type="button" className="chat-mensagem__apagar" title="Apagar mensagem" onClick={() => apagarMensagem(m.id)}>
                          <ChatIcon nome="apagar" />
                        </button>
                      )}
                    </div>
                    {m.conteudo && <span className="conteudo">{m.conteudo}</span>}
                    {m.anexo_url && (
                      <div className="chat-anexo">
                        {m.anexo_tipo?.startsWith('image/') ? (
                          <img src={m.anexo_url} alt={m.anexo_nome || 'Imagem enviada'} />
                        ) : (
                          <a href={m.anexo_url} download={m.anexo_nome || 'arquivo'}>{m.anexo_nome || 'Baixar arquivo'}</a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={fimDaLista} />
            </div>
          </div>
          <form className="chat-input-area" onSubmit={enviar}>
            <button type="button" className="chat-anexo-botao" onClick={() => inputArquivo.current?.click()} title="Anexar imagem ou arquivo"><ChatIcon nome="anexo" /></button>
            <input ref={inputArquivo} type="file" hidden onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
            <input
              className="chat-input"
              placeholder={`Conversar em #${canal.nome}`}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            {arquivo && <span className="chat-arquivo-selecionado" title={arquivo.name}>Arquivo: {arquivo.name}</span>}
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
