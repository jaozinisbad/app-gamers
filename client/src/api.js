export const SERVER_URL = 'https://voltage-phoney-stunt.ngrok-free.dev';

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
    throw new Error(dados.erro || 'Erro ao falar com o servidor.');
  }
  return dados;
}
