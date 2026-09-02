import React, { useRef, useState } from 'react';
import Avatar from './Avatar.jsx';

const CORES_AVATAR = ['#f06449', '#e0a458', '#43aa8b', '#4d96ff', '#7b61ff', '#e85d9e'];

export default function ProfileModal({ usuario, onFechar, onSalvar }) {
  const [nome, setNome] = useState(usuario.nome);
  const [status, setStatus] = useState(usuario.status || 'Disponível');
  const [avatarCor, setAvatarCor] = useState(usuario.avatar_cor || '#5865f2');
  const [avatarUrl, setAvatarUrl] = useState(usuario.avatar_url || null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const inputFotoRef = useRef(null);

  async function comprimirFoto(arquivo) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const size = 256; // 256x256px
          canvas.width = size;
          canvas.height = size;

          const ctx = canvas.getContext('2d');
          // Desenha a imagem cortada em quadrado
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

          // Comprime com qualidade baixa
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Erro ao comprimir foto'));
              return;
            }
            const reader2 = new FileReader();
            reader2.onload = (e2) => resolve(e2.target.result);
            reader2.readAsDataURL(blob);
          }, 'image/jpeg', 0.6);
        };
        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
        img.src = event.target.result;
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(arquivo);
    });
  }

  async function selecionarFoto() {
    const arquivo = inputFotoRef.current?.files?.[0];
    if (!arquivo) return;

    try {
      setErro('');
      // Valida tipo
      if (!arquivo.type.startsWith('image/')) {
        setErro('Selecione uma imagem válida');
        return;
      }
      // Valida tamanho (máximo 5MB original)
      if (arquivo.size > 5 * 1024 * 1024) {
        setErro('Imagem muito grande (máximo 5MB)');
        return;
      }

      const base64 = await comprimirFoto(arquivo);
      setAvatarUrl(base64);
    } catch (err) {
      setErro(err.message);
    }
  }

  function removerFoto() {
    setAvatarUrl(null);
    if (inputFotoRef.current) {
      inputFotoRef.current.value = '';
    }
  }

  async function salvar(event) {
    event.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      const dados = { nome: nome.trim(), status: status.trim(), avatar_cor: avatarCor };
      if (avatarUrl) {
        dados.avatar_url = avatarUrl;
      }
      await onSalvar(dados);
      onFechar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <form className="modal profile-modal" onClick={(event) => event.stopPropagation()} onSubmit={salvar}>
        <div className="profile-modal__heading">
          <div>
            <span className="eyebrow">Seu espaço</span>
            <h2>Personalizar perfil</h2>
          </div>
          <div className="profile-modal__preview">
            <Avatar nome={nome} avatarUrl={avatarUrl} avatarCor={avatarCor} tamanho="lg" />
          </div>
        </div>

        <label className="profile-field">
          Nome exibido
          <input className="modal-input" maxLength="32" value={nome} onChange={(event) => setNome(event.target.value)} autoFocus />
        </label>

        <label className="profile-field">
          Status
          <input className="modal-input" maxLength="80" placeholder="Disponível" value={status} onChange={(event) => setStatus(event.target.value)} />
        </label>

        <div className="profile-field">
          Foto de Perfil
          <div className="profile-foto-acoes">
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              onChange={selecionarFoto}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => inputFotoRef.current?.click()}
              className="btn-foto-upload"
            >
              {avatarUrl ? '📷 Trocar foto' : '📷 Adicionar foto'}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={removerFoto}
                className="btn-foto-remover"
              >
                ❌ Remover foto
              </button>
            )}
          </div>
        </div>

        <div className="profile-field">
          Cor do avatar
          <div className="profile-colors">
            {CORES_AVATAR.map((cor) => (
              <button
                key={cor}
                type="button"
                className={`profile-color${avatarCor === cor ? ' selected' : ''}`}
                style={{ background: cor }}
                aria-label={`Selecionar cor ${cor}`}
                onClick={() => setAvatarCor(cor)}
              />
            ))}
          </div>
        </div>

        {erro && <div className="modal-erro">{erro}</div>}
        <div className="modal-acoes">
          <button type="button" onClick={onFechar} className="modal-botao-secundario">
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className="modal-botao-primario">
            {salvando ? 'Salvando...' : 'Salvar perfil'}
          </button>
        </div>
      </form>
    </div>
  );
}
