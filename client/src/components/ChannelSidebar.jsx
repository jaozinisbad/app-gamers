import React from 'react';
import Avatar from './Avatar.jsx';

function IconTexto() {
  return <span className="channel-icon">#</span>;
}

function IconVoz() {
  return (
    <span className="channel-icon">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 1.5a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 0 0 5 0V4A2.5 2.5 0 0 0 8 1.5Z"
          fill="currentColor"
        />
        <path
          d="M3.5 7.5v0.5a4.5 4.5 0 0 0 9 0V7.5"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M8 12.5v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function IconMic({ mudo }) {
  return <span>{mudo ? '🔇' : '🎙️'}</span>;
}

function IconFone({ mudo }) {
  return <span>{mudo ? '🔕' : '🎧'}</span>;
}

export default function ChannelSidebar({
  servidorNome,
  codigoConvite,
  souDono,
  onExcluirServidor,
  onSairDoServidor,
  minhasPermissoes = {},
  canais,
  canalAtivoId,
  onSelecionar,
  usuario,
  onSair,
  onAbrirPerfil,
  onAbrirConfiguracao,
  canalDeVoz, // { id, nome } | null — canal de voz atualmente conectado
  presencaVoz, // { canalId: [{ socketId, nome, avatarCor, avatarUrl, usuarioId }] } — de QUALQUER canal, mesmo sem estar nele
  vozEstado, // { micMudo, audioMudo, compartilhandoTela }
  vozAcoes, // { onAlternarMic, onAlternarAudio, onAlternarTela, onDesconectar }
  nomeUsuarioNaVoz,
  onAbrirServidorConfiguracao,
  onCriarCanal,
  onApagarCanal,
  onExpulsarDaCall,
}) {
  const canaisTexto = canais.filter((c) => c.tipo === 'texto');
  const canaisVoz = canais.filter((c) => c.tipo === 'voz');
  const podeGerenciarCanais = souDono || minhasPermissoes.gerenciar_canais;
  const podeExpulsarCall = souDono || minhasPermissoes.expulsar_call;

  return (
    <div className="channel-sidebar">
      <div className="channel-sidebar__header">
        <span>{servidorNome}</span>
        {codigoConvite && (
          <span
            className="convite-pill"
            title="Clique para copiar o código de convite"
            onClick={() => navigator.clipboard.writeText(codigoConvite)}
          >
            Convite: {codigoConvite}
          </span>
        )}
        {(souDono || minhasPermissoes.gerenciar_servidor) && (
          <button type="button" className="channel-sidebar__configurar-servidor" title="Configurar servidor" onClick={onAbrirServidorConfiguracao}>⚙️</button>
        )}
        {souDono && (
          <button
            type="button"
            className="channel-sidebar__excluir-servidor"
            title="Excluir servidor"
            onClick={() => {
              if (
                window.confirm(
                  `Excluir "${servidorNome}"? Isso apaga todos os canais e mensagens dele para sempre.`
                )
              ) {
                onExcluirServidor();
              }
            }}
          >
            🗑️
          </button>
        )}
        {!souDono && (
          <button
            type="button"
            className="channel-sidebar__excluir-servidor"
            title="Sair do servidor"
            onClick={() => {
              if (window.confirm(`Sair de "${servidorNome}"? Você pode voltar depois com um convite.`)) {
                onSairDoServidor();
              }
            }}
          >
            🚪
          </button>
        )}
      </div>

      <div className="channel-sidebar__list">
        <div className="channel-group-label">
          <span>Canais de texto</span>
          {podeGerenciarCanais && (
            <button type="button" className="channel-group-label__add" title="Criar canal de texto" onClick={() => onCriarCanal('texto')}>
              +
            </button>
          )}
        </div>
        {canaisTexto.map((c) => (
          <div
            key={c.id}
            className={`channel-item${c.id === canalAtivoId ? ' active' : ''}`}
            onClick={() => onSelecionar(c)}
          >
            <IconTexto />
            <span style={{ flex: 1 }}>{c.nome}</span>
            {podeGerenciarCanais && (
              <button
                type="button"
                className="channel-item__apagar"
                title="Apagar canal"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Apagar o canal #${c.nome}?`)) onApagarCanal(c.id);
                }}
              >
                🗑️
              </button>
            )}
          </div>
        ))}

        <div className="channel-group-label">
          <span>Canais de voz</span>
          {podeGerenciarCanais && (
            <button type="button" className="channel-group-label__add" title="Criar canal de voz" onClick={() => onCriarCanal('voz')}>
              +
            </button>
          )}
        </div>
        {canaisVoz.map((c) => {
          const listaPresenca = presencaVoz?.[c.id] || [];
          return (
            <React.Fragment key={c.id}>
              <div
                className={`channel-item${c.id === canalAtivoId ? ' active' : ''}`}
                onClick={() => onSelecionar(c)}
              >
                <IconVoz />
                <span style={{ flex: 1 }}>{c.nome}</span>
                {listaPresenca.length > 0 && (
                  <span className="voz-contador-participantes">{listaPresenca.length}</span>
                )}
                {podeGerenciarCanais && (
                  <button
                    type="button"
                    className="channel-item__apagar"
                    title="Apagar canal"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Apagar o canal ${c.nome}?`)) onApagarCanal(c.id);
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>
              {listaPresenca.length > 0 && (
                <div className="voz-participantes-lista">
                  {listaPresenca.map((p) => {
                    const souEu = canalDeVoz?.id === c.id && p.nome === nomeUsuarioNaVoz;
                    return (
                      <div key={p.socketId} className="voz-participante-item">
                        <Avatar
                          nome={p.nome}
                          avatarUrl={souEu ? usuario.avatarUrl : p.avatarUrl}
                          avatarCor={souEu ? usuario.avatarCor : p.avatarCor || '#5865f2'}
                          tamanho="sm"
                        />
                        <span style={{ flex: 1 }}>
                          {p.nome}
                          {souEu ? ' (você)' : ''} {souEu && vozEstado.micMudo ? '🔇' : ''}
                        </span>
                        {!souEu && podeExpulsarCall && (
                          <button
                            type="button"
                            className="channel-item__apagar"
                            title={`Expulsar ${p.nome} da call`}
                            onClick={() => onExpulsarDaCall(c.id, p.usuarioId)}
                          >
                            ✖
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {canalDeVoz && (
        <div className="voz-status-bar">
          <div className="voz-status-bar__linha">
            <span className="voz-status-bar__icone-onda">📶</span>
            <div className="voz-status-bar__textos">
              <div className="voz-status-bar__titulo">Voz conectada</div>
              <div className="voz-status-bar__subtitulo">{canalDeVoz.nome} / {servidorNome}</div>
            </div>
            <button className="voz-status-bar__desconectar" onClick={vozAcoes.onDesconectar} title="Desconectar">
              📞
            </button>
          </div>
          {vozEstado.erro && <div className="voz-status-bar__erro">{vozEstado.erro}</div>}
          {vozEstado.erroCompartilhamento && (
            <div className="voz-status-bar__erro">{vozEstado.erroCompartilhamento}</div>
          )}
          <div className="voz-status-bar__acoes">
            <button
              className={`voz-icone-botao${vozEstado.compartilhandoTela ? ' ativo' : ''}`}
              onClick={vozEstado.compartilhandoTela ? vozAcoes.onPararTela : vozAcoes.onIniciarTela}
              title={vozEstado.compartilhandoTela ? 'Parar compartilhamento de tela' : 'Compartilhar tela'}
            >
              🖥️
            </button>
          </div>
        </div>
      )}

      <div className="user-panel">
        <div
          className="user-panel__clicavel"
          onClick={onAbrirPerfil}
          title="Personalizar perfil"
        >
          <Avatar nome={usuario.nome} avatarUrl={usuario.avatarUrl} avatarCor={usuario.avatarCor} tamanho="md" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-panel__name">{usuario.nome}</div>
            <div className="user-panel__status">{usuario.status || (usuario.online ? 'Online' : 'Offline')}</div>
          </div>
        </div>

        <button
          type="button"
          className={`user-panel__icone${canalDeVoz && vozEstado.micMudo ? ' ativo' : ''}`}
          onClick={vozAcoes.onAlternarMic}
          disabled={!canalDeVoz}
          title={canalDeVoz ? (vozEstado.micMudo ? 'Ativar microfone' : 'Mutar microfone') : 'Entre num canal de voz primeiro'}
        >
          <IconMic mudo={!!(canalDeVoz && vozEstado.micMudo)} />
        </button>
        <button
          type="button"
          className={`user-panel__icone${canalDeVoz && vozEstado.audioMudo ? ' ativo' : ''}`}
          onClick={vozAcoes.onAlternarAudio}
          disabled={!canalDeVoz}
          title={canalDeVoz ? (vozEstado.audioMudo ? 'Ativar áudio' : 'Silenciar áudio') : 'Entre num canal de voz primeiro'}
        >
          <IconFone mudo={!!(canalDeVoz && vozEstado.audioMudo)} />
        </button>
        <button type="button" className="user-panel__icone" onClick={onAbrirConfiguracao} title="Configurações de áudio">
          ⚙️
        </button>
        <button type="button" className="user-panel__icone" onClick={onSair} title="Sair da conta">
          🚪
        </button>
      </div>
    </div>
  );
}
