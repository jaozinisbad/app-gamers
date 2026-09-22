import React, { useMemo, useState } from 'react';
import Avatar from './Avatar.jsx';

export default function FriendsScreen({ amigos, onAbrirDM }) {
  const [busca, setBusca] = useState('');
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return termo
      ? amigos.filter((amigo) => amigo.nome.toLocaleLowerCase('pt-BR').includes(termo))
      : amigos;
  }, [amigos, busca]);
  const online = filtrados.filter((amigo) => amigo.online);
  const offline = filtrados.filter((amigo) => !amigo.online);

  function Linha({ amigo }) {
    return (
      <button className="amigo-linha" type="button" onClick={() => onAbrirDM(amigo)}>
        <span className="amigo-linha__avatar" aria-hidden="true">
          <Avatar nome={amigo.nome} avatarUrl={amigo.avatar_url} avatarCor={amigo.avatar_cor || '#5865f2'} tamanho="md" />
          <span className={`status-dot ${amigo.online ? 'online' : 'offline'}`} />
        </span>
        <span className="amigo-linha__info">
          <span className="amigo-nome">{amigo.nome}</span>
          <span className="amigo-status">{amigo.status || (amigo.online ? 'Online agora' : 'Offline')}</span>
        </span>
        <span className="amigo-linha__action" aria-hidden="true">↗</span>
      </button>
    );
  }

  return (
    <section className="content friends-screen">
      <header className="content__header friends-screen__header">
        <span className="friends-screen__header-mark" aria-hidden="true">✦</span>
        <span>Amigos</span>
        <span className="friends-screen__total">{amigos.length}</span>
      </header>
      <div className="content__body friends-screen__body">
        <div className="friends-screen__intro">
          <div>
            <span className="eyebrow">SUA TURMA</span>
            <h1>Amigos</h1>
            <p>Encontre alguém e continue a conversa no privado.</p>
          </div>
          <div className="friends-screen__online-count"><span />{amigos.filter((amigo) => amigo.online).length} online</div>
        </div>

        {amigos.length > 0 && (
          <label className="friends-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar amigos"
              aria-label="Buscar amigos pelo nome"
            />
            {busca && <button type="button" onClick={() => setBusca('')} aria-label="Limpar busca">×</button>}
          </label>
        )}

        {amigos.length === 0 ? (
          <div className="friends-empty">
            <span className="friends-empty__icon" aria-hidden="true">✦</span>
            <h2>Sua turma começa no servidor</h2>
            <p>Quando você dividir um servidor com alguém, essa pessoa aparece aqui para vocês conversarem.</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="friends-empty friends-empty--compact" role="status">
            <h2>Ninguém por aqui com esse nome</h2>
            <p>Confira a busca ou tente outro nome.</p>
          </div>
        ) : (
          <div className="friends-list" aria-live="polite">
            {online.length > 0 && (
              <section className="friends-group" aria-label={`${online.length} amigos online`}>
                <div className="friends-group__heading"><span>ONLINE</span><span>{online.length}</span></div>
                {online.map((amigo) => <Linha key={amigo.id} amigo={amigo} />)}
              </section>
            )}
            {offline.length > 0 && (
              <section className="friends-group" aria-label={`${offline.length} amigos offline`}>
                <div className="friends-group__heading"><span>OFFLINE</span><span>{offline.length}</span></div>
                {offline.map((amigo) => <Linha key={amigo.id} amigo={amigo} />)}
              </section>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
