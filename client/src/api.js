const URL_PUBLICA = 'https://app-gamers-server.onrender.com';
// A prévia local também usa a API publicada por padrão. Para desenvolver com
// um backend local, defina VITE_SERVER_URL=http://localhost:3001.
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || URL_PUBLICA;

export async function apiFetch(caminho, token, opcoes = {}) {
  const resp = await fetch(`${SERVER_URL}${caminho}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      // Faz o ngrok (plano grátis) pular a página de aviso de navegador.
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opcoes.headers || {}),
    },
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const erro = new Error(dados.erro || (resp.status === 401 || resp.status === 403 ? 'Sua sessão expirou. Entre novamente.' : 'Erro ao falar com o servidor.'));
    erro.status = resp.status;
    if (resp.status === 401 || resp.status === 403) {
      localStorage.removeItem('sessao');
      window.dispatchEvent(new Event('sessao-invalida'));
    }
    throw erro;
  }
  return dados;
}
