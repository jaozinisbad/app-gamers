export const SERVER_URL = 'https://relate-leon-extremely-moderators.trycloudflare.com';

export async function apiFetch(caminho, token, opcoes = {}) {
  const resp = await fetch(`${SERVER_URL}${caminho}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
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
