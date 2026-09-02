const express = require('express');
const { db } = require('../db');
const autenticar = require('../middleware/autenticar');
const { estaOnline } = require('../presenca');

const router = express.Router();
router.use(autenticar);

// "Amigo" aqui é qualquer pessoa que já divide pelo menos um servidor
// com você — não existe pedido de amizade manual, pra manter simples
// num grupo fechado onde todo mundo já se conhece via convite.
router.get('/amigos', (req, res) => {
  const amigos = db
    .prepare(
      `SELECT DISTINCT u.id, u.nome, u.avatar_cor, u.avatar_url, u.status
       FROM usuarios u
       JOIN membros_servidor m2 ON m2.usuario_id = u.id
       WHERE m2.servidor_id IN (
         SELECT servidor_id FROM membros_servidor WHERE usuario_id = ?
       )
       AND u.id != ?
       ORDER BY u.nome`
    )
    .all(req.usuario.id, req.usuario.id);

  res.json(amigos.map((amigo) => ({ ...amigo, online: estaOnline(amigo.id) })));
});

function compartilhamServidor(usuarioIdA, usuarioIdB) {
  return !!db
    .prepare(
      `SELECT 1 FROM membros_servidor m1
       JOIN membros_servidor m2 ON m2.servidor_id = m1.servidor_id
       WHERE m1.usuario_id = ? AND m2.usuario_id = ?`
    )
    .get(usuarioIdA, usuarioIdB);
}

router.get('/mensagens-diretas/:usuarioId', (req, res) => {
  const outroId = Number(req.params.usuarioId);

  if (!compartilhamServidor(req.usuario.id, outroId)) {
    return res.status(403).json({ erro: 'Vocês não compartilham nenhum servidor.' });
  }

  const mensagens = db
    .prepare(
      `SELECT m.id, m.conteudo, m.criado_em, m.remetente_id
       FROM mensagens_diretas m
       WHERE (m.remetente_id = ? AND m.destinatario_id = ?)
          OR (m.remetente_id = ? AND m.destinatario_id = ?)
       ORDER BY m.id
       LIMIT 100`
    )
    .all(req.usuario.id, outroId, outroId, req.usuario.id);

  res.json(mensagens);
});

module.exports = { router, compartilhamServidor };
