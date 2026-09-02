const express = require('express');
const { db } = require('../db');
const autenticar = require('../middleware/autenticar');
const { ehMembro } = require('./servidores');

const router = express.Router();
router.use(autenticar);

function servidorDoCanal(canalId) {
  return db.prepare('SELECT servidor_id FROM canais WHERE id = ?').get(canalId);
}

router.get('/canais/:id/mensagens', (req, res) => {
  const canalId = Number(req.params.id);
  const canal = servidorDoCanal(canalId);

  if (!canal) {
    return res.status(404).json({ erro: 'Canal não encontrado.' });
  }
  if (!ehMembro(canal.servidor_id, req.usuario.id)) {
    return res.status(403).json({ erro: 'Você não é membro deste servidor.' });
  }

  const mensagens = db
    .prepare(
      `SELECT m.id, m.conteudo, m.criado_em, u.nome AS autor
       FROM mensagens m
       JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.canal_id = ?
       ORDER BY m.id
       LIMIT 100`
    )
    .all(canalId);

  res.json(mensagens);
});

module.exports = router;
