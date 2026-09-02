import React from 'react';

/**
 * Componente reutilizável de avatar
 * - Se tiver avatarUrl (foto), mostra a foto
 * - Senão, mostra as iniciais com a cor do avatar
 */
export default function Avatar({ nome, avatarUrl, avatarCor, tamanho = 'md' }) {
  const tamanhos = {
    sm: '28px',
    md: '40px',
    lg: '56px',
    xl: '80px',
  };

  const tamanhoStyle = tamanhos[tamanho] || tamanhos.md;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={nome}
        className="avatar avatar-foto"
        style={{ width: tamanhoStyle, height: tamanhoStyle }}
      />
    );
  }

  const iniciais = nome
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className="avatar avatar-iniciais"
      style={{
        width: tamanhoStyle,
        height: tamanhoStyle,
        backgroundColor: avatarCor || '#5865f2',
        fontSize: `${parseInt(tamanhoStyle) * 0.4}px`,
      }}
      title={nome}
    >
      {iniciais || '??'}
    </div>
  );
}
