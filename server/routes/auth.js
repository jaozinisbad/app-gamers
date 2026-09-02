const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const autenticar = require('../middleware/autenticar');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

function gerarToken(usuario) {
  return jwt.sign({ id: usuario.id, nome: usuario.nome }, JWT_SECRET, {
    expiresIn: '30d',
  });
}

function dadosPublicos(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    avatar_cor: usuario.avatar_cor || '#5865f2',
    avatar_url: usuario.avatar_url || null,
    status: usuario.status || 'Disponível',
  };
}

router.post('/cadastro', async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Preencha nome, email e senha.' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' });
  }

  const jaExiste = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (jaExiste) {
    return res.status(409).json({ erro: 'Já existe uma conta com este email.' });
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  const resultado = db
    .prepare('INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)')
    .run(nome, email, senhaHash);

  const usuario = { id: resultado.lastInsertRowid, nome, email, avatar_cor: '#5865f2', status: 'Disponível' };
  const token = gerarToken(usuario);

  res.status(201).json({ token, usuario: dadosPublicos(usuario) });
});

router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Preencha email e senha.' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  if (!usuario) {
    return res.status(401).json({ erro: 'Email ou senha incorretos.' });
  }

  const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaCorreta) {
    return res.status(401).json({ erro: 'Email ou senha incorretos.' });
  }

  const token = gerarToken(usuario);
  res.json({ token, usuario: dadosPublicos(usuario) });
});

router.get('/perfil', autenticar, (req, res) => {
  const usuario = db.prepare('SELECT id, nome, email, avatar_cor, avatar_url, status FROM usuarios WHERE id = ?').get(req.usuario.id);
  res.json(dadosPublicos(usuario));
});

router.patch('/perfil', autenticar, (req, res) => {
  const nome = String(req.body.nome || '').trim();
  const status = String(req.body.status || '').trim();
  const avatarCor = String(req.body.avatar_cor || '').trim();
  const avatarUrl = req.body.avatar_url ? String(req.body.avatar_url).trim() : null;

  if (!nome || nome.length > 32) {
    return res.status(400).json({ erro: 'O nome precisa ter entre 1 e 32 caracteres.' });
  }
  if (status.length > 80) {
    return res.status(400).json({ erro: 'O status pode ter no máximo 80 caracteres.' });
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(avatarCor)) {
    return res.status(400).json({ erro: 'Escolha uma cor de avatar válida.' });
  }

  // Validar avatar_url se fornecido
  if (avatarUrl) {
    if (!avatarUrl.startsWith('data:image/')) {
      return res.status(400).json({ erro: 'Avatar deve ser uma imagem em base64 válida.' });
    }
    if (avatarUrl.length > 1000000) {
      // Máximo ~1MB de base64 (750KB de imagem real)
      return res.status(400).json({ erro: 'Avatar muito grande (máximo ~750KB).' });
    }
  }

  db.prepare('UPDATE usuarios SET nome = ?, status = ?, avatar_cor = ?, avatar_url = ? WHERE id = ?')
    .run(nome, status || 'Disponível', avatarCor, avatarUrl, req.usuario.id);

  const usuario = db.prepare('SELECT id, nome, email, avatar_cor, avatar_url, status FROM usuarios WHERE id = ?').get(req.usuario.id);
  const token = gerarToken(usuario);
  res.json({ token, usuario: dadosPublicos(usuario) });
});

module.exports = router;
