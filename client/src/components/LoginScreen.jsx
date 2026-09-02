import React, { useState } from 'react';

const SERVER_URL = 'https://relate-leon-extremely-moderators.trycloudflare.com';

export default function LoginScreen({ onAutenticado }) {
  const [modo, setModo] = useState('login'); // 'login' | 'cadastro'
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    const rota = modo === 'login' ? '/api/login' : '/api/cadastro';
    const corpo = modo === 'login' ? { email, senha } : { nome, email, senha };

    try {
      const resp = await fetch(`${SERVER_URL}${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const dados = await resp.json();

      if (!resp.ok) {
        setErro(dados.erro || 'Algo deu errado.');
        return;
      }

      onAutenticado(dados.token, dados.usuario);
    } catch (err) {
      setErro('Não foi possível falar com o servidor. Ele está rodando?');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#313338',
      }}
    >
      <form
        onSubmit={enviar}
        style={{
          background: '#2b2d31',
          padding: 32,
          borderRadius: 8,
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h2 style={{ color: '#f2f3f5', margin: '0 0 4px' }}>
          {modo === 'login' ? 'Entrar' : 'Criar conta'}
        </h2>

        {modo === 'cadastro' && (
          <input
            placeholder="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            style={inputStyle}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          style={inputStyle}
        />

        {erro && <div style={{ color: '#f23f42', fontSize: 13 }}>{erro}</div>}

        <button type="submit" disabled={carregando} style={botaoStyle}>
          {carregando ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Cadastrar'}
        </button>

        <div
          style={{ color: '#949ba4', fontSize: 13, textAlign: 'center', cursor: 'pointer' }}
          onClick={() => {
            setModo(modo === 'login' ? 'cadastro' : 'login');
            setErro('');
          }}
        >
          {modo === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </div>
      </form>
    </div>
  );
}

const inputStyle = {
  padding: '10px 12px',
  borderRadius: 4,
  border: 'none',
  background: '#1e1f22',
  color: '#dbdee1',
  fontSize: 14,
  outline: 'none',
};

const botaoStyle = {
  padding: '10px 12px',
  borderRadius: 4,
  border: 'none',
  background: '#5865f2',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
