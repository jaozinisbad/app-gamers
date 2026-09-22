import React from 'react';
import Avatar from './Avatar.jsx';

export default function MemberSidebar({ membros = [] }) {
  const grupos = new Map();

  for (const membro of membros) {
    const cargo = membro.cargos?.[0];
    const nomeGrupo = cargo?.nome || (membro.papel === 'dono' ? 'Dono' : 'Membros');
    if (!grupos.has(nomeGrupo)) {
      grupos.set(nomeGrupo, { cor: cargo?.cor || (membro.papel === 'dono' ? '#f04747' : '#949ba4'), membros: [] });
    }
    grupos.get(nomeGrupo).membros.push(membro);
  }

  return (
    <aside className="member-sidebar">
      <div className="member-sidebar__header">Membros — {membros.length}</div>
      {Array.from(grupos.entries()).map(([nomeGrupo, grupo]) => (
        <section className="member-group" key={nomeGrupo}>
          <div className="member-group__title" style={{ color: grupo.cor }}>
            {nomeGrupo} — {grupo.membros.length}
          </div>
          {grupo.membros.map((membro) => (
            <div className={`member-item${membro.online ? '' : ' member-item--offline'}`} key={membro.id}>
              <div className="member-item__avatar">
                <Avatar nome={membro.nome} avatarUrl={membro.avatar_url} avatarCor={membro.avatar_cor || '#5865f2'} tamanho="sm" />
                <span className={`member-item__status ${membro.online ? 'online' : 'offline'}`} />
              </div>
              <div className="member-item__details">
                <div className="member-item__name" style={{ color: grupo.cor === '#949ba4' ? '#dbdee1' : grupo.cor }}>
                  {membro.nome}
                  {membro.papel === 'dono' && <span className="member-item__owner">★</span>}
                </div>
                <div className="member-item__activity">{membro.online ? (membro.status || 'Disponível') : 'Offline'}</div>
              </div>
            </div>
          ))}
        </section>
      ))}
    </aside>
  );
}
