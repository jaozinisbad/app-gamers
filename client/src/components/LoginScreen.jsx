import React, { useState } from 'react';
import { SERVER_URL } from '../api.js';

export default function LoginScreen({ onAutenticado }) {
  const [modo, setModo] = useState('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function enviar(event) {
    event.preventDefault();
    setErro('');
    setCarregando(true);

    const cadastro = modo === 'cadastro';
    try {
      const resposta = await fetch(`${SERVER_URL}${cadastro ? '/api/cadastro' : '/api/login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cadastro ? { nome, email, senha } : { email, senha }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.erro || 'Não foi possível concluir. Tente novamente.');
        return;
      }
      onAutenticado(dados.token, dados.usuario);
    } catch {
      setErro('Não foi possível conectar ao servidor. Confira sua internet e tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  function alternarModo() {
    setModo((atual) => atual === 'login' ? 'cadastro' : 'login');
    setErro('');
  }

  const cadastro = modo === 'cadastro';

  return (
    <main className="auth-shell">
      <div className="auth-glow auth-glow--one" aria-hidden="true" />
      <div className="auth-glow auth-glow--two" aria-hidden="true" />

      <section className="auth-card" aria-labelledby="auth-form-title">
        <div className="auth-brand">
          <img className="auth-brand__mark" src="./astralis-mark.svg" alt="" />
          <span>ASTRALIS</span>
        </div>

        <div className="auth-card__heading">
          <h1 id="auth-form-title">{cadastro ? 'Criar conta' : 'Entrar'}</h1>
        </div>

        <form className="auth-form" onSubmit={enviar}>
          {cadastro && (
            <label className="auth-field">
              <span>Nome</span>
              <input
                type="text"
                name="name"
                placeholder="Seu nome"
                autoComplete="name"
                maxLength={32}
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                required
                disabled={carregando}
              />
            </label>
          )}
          <label className="auth-field">
            <span>E-mail</span>
            <input
              type="email"
              name="email"
              placeholder="voce@exemplo.com"
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={carregando}
            />
          </label>
          <label className="auth-field">
            <span>Senha</span>
            <input
              type="password"
              name="password"
              placeholder="Sua senha"
              autoComplete={cadastro ? 'new-password' : 'current-password'}
              minLength={cadastro ? 6 : undefined}
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              required
              disabled={carregando}
            />
          </label>

          {erro && <div className="auth-error" role="alert">{erro}</div>}

          <button className="auth-submit" type="submit" disabled={carregando}>
            {carregando ? 'Aguarde…' : cadastro ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <div className="auth-switch">
          <span>{cadastro ? 'Já tem uma conta?' : 'Não tem uma conta?'}</span>
          <button type="button" onClick={alternarModo} disabled={carregando}>
            {cadastro ? 'Entrar' : 'Criar conta'}
          </button>
        </div>
      </section>
    </main>
  );
}
