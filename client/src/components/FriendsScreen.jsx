import React from 'react';
import Avatar from './Avatar.jsx';

export default function FriendsScreen({ amigos, onAbrirDM }) {
  const online = amigos.filter((a) => a.online);
  const offline = amigos.filter((a) => !a.online);

  function Linha({ amigo }) {
    return (
      <div className="amigo-linha" onClick={() => onAbrirDM(amigo)}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <Avatar nome={amigo.nome} avatarUrl={amigo.avatar_url} avatarCor={amigo.avatar_cor || '#5865f2'} tamanho="md" />
          <span className={`status-dot ${amigo.online ? 'online' : 'offline'}`} />
        </div>
        <div>
          <div className="amigo-nome">{amigo.nome}</div>
          <div className="amigo-status">{amigo.status || (amigo.online ? 'Online' : 'Offline')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="content__header">Amigos</div>
      <div className="content__body">
        {amigos.length === 0 ? (
          <p style={{ color: '#949ba4' }}>
            Você ainda não tem amigos por aqui — quando você entrar num servidor
            com alguém, essa pessoa aparece automaticamente nesta lista.
          </p>
        ) : (
          <>
            {online.length > 0 && (
              <>
                <div className="channel-group-label">Online — {online.length}</div>
                {online.map((a) => (
                  <Linha key={a.id} amigo={a} />
                ))}
              </>
            )}
            {offline.length > 0 && (
              <>
                <div className="channel-group-label">Offline — {offline.length}</div>
                {offline.map((a) => (
                  <Linha key={a.id} amigo={a} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
