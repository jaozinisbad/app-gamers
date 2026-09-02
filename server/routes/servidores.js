const express = require('express');
const { db, gerarCodigoConvite } = require('../db');
const autenticar = require('../middleware/autenticar');

const router = express.Router();
router.use(autenticar);

// Cria um servidor novo, já com dois canais padrão (geral / Sala de voz),
// adiciona quem criou como dono, e gera um código de convite único.
router.post('/servidores', (req, res) => {
  const { nome } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'Dê um nome para o servidor.' });
  }

  const codigo = gerarCodigoConvite();

  const resultado = db
    .prepare('INSERT INTO servidores (nome, dono_id, codigo_convite) VALUES (?, ?, ?)')
    .run(nome.trim(), req.usuario.id, codigo);
  const servidorId = resultado.lastInsertRowid;

  db.prepare('INSERT INTO membros_servidor (servidor_id, usuario_id, papel) VALUES (?, ?, ?)').run(
    servidorId,
    req.usuario.id,
    'dono'
  );

  db.prepare("INSERT INTO canais (servidor_id, nome, tipo) VALUES (?, 'geral', 'texto')").run(servidorId);
  db.prepare("INSERT INTO canais (servidor_id, nome, tipo) VALUES (?, 'Sala de voz', 'voz')").run(servidorId);

  res.status(201).json({ id: servidorId, nome: nome.trim(), codigo_convite: codigo });
});

// Lista os servidores dos quais o usuário logado é membro.
router.get('/servidores', (req, res) => {
  const servidores = db
    .prepare(
      `SELECT s.id, s.nome, s.codigo_convite, m.papel
       FROM servidores s
       JOIN membros_servidor m ON m.servidor_id = s.id
       WHERE m.usuario_id = ?
       ORDER BY s.id`
    )
    .all(req.usuario.id);

  res.json(servidores);
});

// Entra em um servidor a partir de um código de convite.
router.post('/servidores/entrar', (req, res) => {
  const { codigo } = req.body;
  if (!codigo || !codigo.trim()) {
    return res.status(400).json({ erro: 'Informe um código de convite.' });
  }

  const servidor = db
    .prepare('SELECT id, nome FROM servidores WHERE codigo_convite = ?')
    .get(codigo.trim());

  if (!servidor) {
    return res.status(404).json({ erro: 'Código de convite inválido.' });
  }

  const jaEhMembro = db
    .prepare('SELECT 1 FROM membros_servidor WHERE servidor_id = ? AND usuario_id = ?')
    .get(servidor.id, req.usuario.id);

  if (jaEhMembro) {
    return res.status(409).json({ erro: 'Você já é membro deste servidor.' });
  }

  db.prepare('INSERT INTO membros_servidor (servidor_id, usuario_id, papel) VALUES (?, ?, ?)').run(
    servidor.id,
    req.usuario.id,
    'membro'
  );

  res.status(201).json({ id: servidor.id, nome: servidor.nome });
});

// Exclui um servidor. Só quem criou (dono) pode excluir.
router.delete('/servidores/:id', (req, res) => {
  const servidorId = Number(req.params.id);

  const servidor = db.prepare('SELECT id, dono_id FROM servidores WHERE id = ?').get(servidorId);

  if (!servidor) {
    return res.status(404).json({ erro: 'Servidor não encontrado.' });
  }

  if (servidor.dono_id !== req.usuario.id) {
    return res.status(403).json({ erro: 'Só quem criou o servidor pode excluí-lo.' });
  }

  // Sem ON DELETE CASCADE no banco, então apagamos na ordem certa:
  // mensagens dos canais -> canais -> membros -> servidor.
  const canaisDoServidor = db
    .prepare('SELECT id FROM canais WHERE servidor_id = ?')
    .all(servidorId)
    .map((c) => c.id);

  const apagarMensagens = db.prepare('DELETE FROM mensagens WHERE canal_id = ?');
  for (const canalId of canaisDoServidor) {
    apagarMensagens.run(canalId);
  }

  db.prepare('DELETE FROM canais WHERE servidor_id = ?').run(servidorId);
  db.prepare('DELETE FROM membros_servidor WHERE servidor_id = ?').run(servidorId);
  db.prepare('DELETE FROM servidores WHERE id = ?').run(servidorId);

  res.status(204).end();
});

function ehMembro(servidorId, usuarioId) {
  return !!db
    .prepare('SELECT 1 FROM membros_servidor WHERE servidor_id = ? AND usuario_id = ?')
    .get(servidorId, usuarioId);
}

// Lista os canais de um servidor (só se o usuário for membro).
router.get('/servidores/:id/canais', (req, res) => {
  const servidorId = Number(req.params.id);

  if (!ehMembro(servidorId, req.usuario.id)) {
    return res.status(403).json({ erro: 'Você não é membro deste servidor.' });
  }

  const canais = db
    .prepare('SELECT id, nome, tipo FROM canais WHERE servidor_id = ? ORDER BY tipo, id')
    .all(servidorId);

  res.json(canais);
});

module.exports = { router, ehMembro };
