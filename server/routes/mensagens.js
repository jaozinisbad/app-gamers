const express = require('express');
const { all, get } = require('../db');
const autenticar = require('../middleware/autenticar');
const { ehMembro } = require('./servidores');

const router = express.Router();
router.use(autenticar);

async function servidorDoCanal(canalId) {
  return get('SELECT servidor_id FROM canais WHERE id = ?', canalId);
}

router.get('/canais/:id/mensagens', async (req, res, next) => {
 try {
  const canalId = Number(req.params.id);
  const canal = await servidorDoCanal(canalId);

  if (!canal) {
    return res.status(404).json({ erro: 'Canal não encontrado.' });
  }
  if (!(await ehMembro(canal.servidor_id, req.usuario.id))) {
    return res.status(403).json({ erro: 'Você não é membro deste servidor.' });
  }

  const mensagens = await all(
      `SELECT m.id, m.conteudo, m.criado_em, m.usuario_id, m.anexo_nome, m.anexo_tipo, m.anexo_url, m.anexo_tamanho, u.nome AS autor
       FROM mensagens m
       JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.canal_id = ?
       ORDER BY m.id
       LIMIT 100`
    , canalId);

  res.json(mensagens);
 } catch(error) { next(error); }
});

module.exports = router;
