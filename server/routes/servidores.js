const express = require('express');
const { db, gerarCodigoConvite } = require('../db');
const autenticar = require('../middleware/autenticar');

const router = express.Router();
router.use(autenticar);

const TODAS_PERMISSOES = [
  'gerenciar_servidor',
  'gerenciar_canais',
  'gerenciar_cargos',
  'gerenciar_membros',
  'banir_membros',
  'expulsar_call',
  'gerenciar_mensagens',
];

function permissoesDoCargo(cargo) {
  try {
    return JSON.parse(cargo.permissoes || '{}');
  } catch {
    return {};
  }
}

function temPermissao(servidorId, usuarioId, permissao) {
  const membro = db
    .prepare('SELECT papel FROM membros_servidor WHERE servidor_id = ? AND usuario_id = ?')
    .get(servidorId, usuarioId);
  if (!membro) return false;
  if (membro.papel === 'dono') return true;

  const cargos = db
    .prepare(
      `SELECT c.permissoes
       FROM cargos c
       JOIN membros_cargos mc ON mc.cargo_id = c.id
       WHERE mc.servidor_id = ? AND mc.usuario_id = ?`
    )
    .all(servidorId, usuarioId);
  return cargos.some((cargo) => permissoesDoCargo(cargo)[permissao] === true);
}

function validarPermissoes(permissoes) {
  const resultado = {};
  for (const nome of TODAS_PERMISSOES) resultado[nome] = permissoes?.[nome] === true;
  return resultado;
}

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

  const cargoAdmin = db
    .prepare('INSERT INTO cargos (servidor_id, nome, cor, permissoes, posicao) VALUES (?, ?, ?, ?, ?)')
    .run(servidorId, 'Administrador', '#e74c3c', JSON.stringify(validarPermissoes(Object.fromEntries(TODAS_PERMISSOES.map((p) => [p, true])))), 100);
  db.prepare('INSERT INTO membros_cargos (cargo_id, servidor_id, usuario_id) VALUES (?, ?, ?)')
    .run(cargoAdmin.lastInsertRowid, servidorId, req.usuario.id);

  res.status(201).json({ id: servidorId, nome: nome.trim(), codigo_convite: codigo, icone_url: null, banner_url: null });
});

// Lista os servidores dos quais o usuário logado é membro.
router.get('/servidores', (req, res) => {
  const servidores = db
    .prepare(
      `SELECT s.id, s.nome, s.codigo_convite, s.icone_url, s.banner_url, s.descricao, m.papel
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

  const banido = db.prepare('SELECT 1 FROM banimentos_servidor WHERE servidor_id = ? AND usuario_id = ?').get(servidor.id, req.usuario.id);
  if (banido) return res.status(403).json({ erro: 'Você foi banido deste servidor.' });

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

  db.prepare('DELETE FROM membros_cargos WHERE servidor_id = ?').run(servidorId);
  db.prepare('DELETE FROM cargos WHERE servidor_id = ?').run(servidorId);
  db.prepare('DELETE FROM banimentos_servidor WHERE servidor_id = ?').run(servidorId);
  db.prepare('DELETE FROM canais WHERE servidor_id = ?').run(servidorId);
  db.prepare('DELETE FROM membros_servidor WHERE servidor_id = ?').run(servidorId);
  db.prepare('DELETE FROM servidores WHERE id = ?').run(servidorId);

  res.status(204).end();
});

// Sai de um servidor por conta própria. O dono não pode sair — ele precisa
// excluir o servidor (ou, no futuro, transferir a posse pra outra pessoa).
router.post('/servidores/:id/sair', (req, res) => {
  const servidorId = Number(req.params.id);

  const membro = db
    .prepare('SELECT papel FROM membros_servidor WHERE servidor_id = ? AND usuario_id = ?')
    .get(servidorId, req.usuario.id);

  if (!membro) {
    return res.status(404).json({ erro: 'Você não é membro deste servidor.' });
  }
  if (membro.papel === 'dono') {
    return res.status(400).json({ erro: 'Quem criou o servidor não pode sair dele — só excluir.' });
  }

  db.prepare('DELETE FROM membros_cargos WHERE servidor_id = ? AND usuario_id = ?').run(servidorId, req.usuario.id);
  db.prepare('DELETE FROM membros_servidor WHERE servidor_id = ? AND usuario_id = ?').run(servidorId, req.usuario.id);

  res.status(204).end();
});

router.patch('/servidores/:id', (req, res) => {
  const servidorId = Number(req.params.id);
  if (!temPermissao(servidorId, req.usuario.id, 'gerenciar_servidor')) {
    return res.status(403).json({ erro: 'Você não tem permissão para editar este servidor.' });
  }

  const servidor = db.prepare('SELECT id, nome, icone_url, banner_url, descricao FROM servidores WHERE id = ?').get(servidorId);
  if (!servidor) return res.status(404).json({ erro: 'Servidor não encontrado.' });

  const nome = req.body.nome === undefined ? servidor.nome : String(req.body.nome).trim();
  const descricao = req.body.descricao === undefined ? String(servidor.descricao || '') : String(req.body.descricao).trim();
  const iconeUrl = req.body.icone_url === undefined ? servidor.icone_url : req.body.icone_url || null;
  const bannerUrl = req.body.banner_url === undefined ? servidor.banner_url : req.body.banner_url || null;
  if (!nome || nome.length > 80 || descricao.length > 240) {
    return res.status(400).json({ erro: 'Nome ou descrição do servidor inválidos.' });
  }
  for (const imagem of [iconeUrl, bannerUrl]) {
    if (imagem && (!String(imagem).startsWith('data:image/') || String(imagem).length > 2000000)) {
      return res.status(400).json({ erro: 'Imagem do servidor inválida ou muito grande.' });
    }
  }

  db.prepare('UPDATE servidores SET nome = ?, descricao = ?, icone_url = ?, banner_url = ? WHERE id = ?')
    .run(nome, descricao || null, iconeUrl, bannerUrl, servidorId);
  res.json({ id: servidorId, nome, descricao: descricao || null, icone_url: iconeUrl, banner_url: bannerUrl });
});

router.get('/servidores/:id/cargos', (req, res) => {
  const servidorId = Number(req.params.id);
  if (!ehMembro(servidorId, req.usuario.id)) return res.status(403).json({ erro: 'Você não é membro deste servidor.' });
  const cargos = db.prepare('SELECT id, nome, cor, permissoes, posicao FROM cargos WHERE servidor_id = ? ORDER BY posicao DESC, id').all(servidorId)
    .map((cargo) => ({ ...cargo, permissoes: permissoesDoCargo(cargo) }));
  res.json(cargos);
});

router.get('/servidores/:id/membros', (req, res) => {
  const servidorId = Number(req.params.id);
  if (!ehMembro(servidorId, req.usuario.id)) return res.status(403).json({ erro: 'Você não é membro deste servidor.' });
  const membros = db.prepare(
    `SELECT m.usuario_id, m.papel, u.nome, u.avatar_cor, u.avatar_url, u.status,
            c.id AS cargo_id, c.nome AS cargo_nome, c.cor AS cargo_cor
     FROM membros_servidor m
     JOIN usuarios u ON u.id = m.usuario_id
     LEFT JOIN membros_cargos mc ON mc.servidor_id = m.servidor_id AND mc.usuario_id = m.usuario_id
     LEFT JOIN cargos c ON c.id = mc.cargo_id
     WHERE m.servidor_id = ?
     ORDER BY m.papel = 'dono' DESC, c.posicao DESC, u.nome`
  ).all(servidorId);
  const agrupados = new Map();
  for (const membro of membros) {
    if (!agrupados.has(membro.usuario_id)) {
      agrupados.set(membro.usuario_id, { id: membro.usuario_id, nome: membro.nome, papel: membro.papel, avatar_cor: membro.avatar_cor, avatar_url: membro.avatar_url, status: membro.status, cargos: [] });
    }
    if (membro.cargo_id) agrupados.get(membro.usuario_id).cargos.push({ id: membro.cargo_id, nome: membro.cargo_nome, cor: membro.cargo_cor });
  }
  res.json([...agrupados.values()]);
});

router.post('/servidores/:id/cargos', (req, res) => {
  const servidorId = Number(req.params.id);
  if (!temPermissao(servidorId, req.usuario.id, 'gerenciar_cargos')) return res.status(403).json({ erro: 'Você não pode gerenciar cargos.' });
  const nome = String(req.body.nome || '').trim();
  const cor = String(req.body.cor || '#99aab5').trim();
  if (!nome || nome.length > 32 || !/^#[0-9a-fA-F]{6}$/.test(cor)) return res.status(400).json({ erro: 'Nome ou cor do cargo inválidos.' });
  const resultado = db.prepare('INSERT INTO cargos (servidor_id, nome, cor, permissoes, posicao) VALUES (?, ?, ?, ?, ?)').run(servidorId, nome, cor, JSON.stringify(validarPermissoes(req.body.permissoes)), Number(req.body.posicao) || 0);
  res.status(201).json({ id: resultado.lastInsertRowid, nome, cor, permissoes: validarPermissoes(req.body.permissoes), posicao: Number(req.body.posicao) || 0 });
});

router.patch('/servidores/:servidorId/cargos/:cargoId', (req, res) => {
  const servidorId = Number(req.params.servidorId);
  const cargoId = Number(req.params.cargoId);
  if (!temPermissao(servidorId, req.usuario.id, 'gerenciar_cargos')) return res.status(403).json({ erro: 'Você não pode gerenciar cargos.' });
  const cargo = db.prepare('SELECT * FROM cargos WHERE id = ? AND servidor_id = ?').get(cargoId, servidorId);
  if (!cargo) return res.status(404).json({ erro: 'Cargo não encontrado.' });
  const nome = req.body.nome === undefined ? cargo.nome : String(req.body.nome).trim();
  const cor = req.body.cor === undefined ? cargo.cor : String(req.body.cor).trim();
  const permissoes = req.body.permissoes === undefined ? permissoesDoCargo(cargo) : validarPermissoes(req.body.permissoes);
  if (!nome || nome.length > 32 || !/^#[0-9a-fA-F]{6}$/.test(cor)) return res.status(400).json({ erro: 'Nome ou cor do cargo inválidos.' });
  db.prepare('UPDATE cargos SET nome = ?, cor = ?, permissoes = ? WHERE id = ?').run(nome, cor, JSON.stringify(permissoes), cargoId);
  res.json({ id: cargoId, nome, cor, permissoes });
});

router.post('/servidores/:servidorId/membros/:usuarioId/cargos/:cargoId', (req, res) => {
  const servidorId = Number(req.params.servidorId);
  const usuarioId = Number(req.params.usuarioId);
  const cargoId = Number(req.params.cargoId);
  if (!temPermissao(servidorId, req.usuario.id, 'gerenciar_cargos')) return res.status(403).json({ erro: 'Você não pode gerenciar cargos.' });
  const cargo = db.prepare('SELECT id FROM cargos WHERE id = ? AND servidor_id = ?').get(cargoId, servidorId);
  const membro = db.prepare('SELECT usuario_id FROM membros_servidor WHERE servidor_id = ? AND usuario_id = ?').get(servidorId, usuarioId);
  if (!cargo || !membro) return res.status(404).json({ erro: 'Cargo ou membro não encontrado.' });
  db.prepare('INSERT OR IGNORE INTO membros_cargos (cargo_id, servidor_id, usuario_id) VALUES (?, ?, ?)').run(cargoId, servidorId, usuarioId);
  res.status(204).end();
});

router.delete('/servidores/:servidorId/membros/:usuarioId/cargos/:cargoId', (req, res) => {
  const servidorId = Number(req.params.servidorId);
  const usuarioId = Number(req.params.usuarioId);
  const cargoId = Number(req.params.cargoId);
  if (!temPermissao(servidorId, req.usuario.id, 'gerenciar_cargos')) return res.status(403).json({ erro: 'Você não pode gerenciar cargos.' });
  db.prepare('DELETE FROM membros_cargos WHERE servidor_id = ? AND usuario_id = ? AND cargo_id = ?').run(servidorId, usuarioId, cargoId);
  res.status(204).end();
});

function membroAlvoValido(servidorId, usuarioId) {
  return db.prepare('SELECT m.usuario_id, m.papel, s.dono_id FROM membros_servidor m JOIN servidores s ON s.id = m.servidor_id WHERE m.servidor_id = ? AND m.usuario_id = ?').get(servidorId, usuarioId);
}

router.delete('/servidores/:servidorId/membros/:usuarioId', (req, res) => {
  const servidorId = Number(req.params.servidorId);
  const usuarioId = Number(req.params.usuarioId);
  if (!temPermissao(servidorId, req.usuario.id, 'gerenciar_membros')) return res.status(403).json({ erro: 'Você não pode expulsar membros.' });
  const alvo = membroAlvoValido(servidorId, usuarioId);
  if (!alvo) return res.status(404).json({ erro: 'Membro não encontrado.' });
  if (alvo.papel === 'dono' || alvo.dono_id === usuarioId) return res.status(403).json({ erro: 'O dono não pode ser expulso.' });
  db.prepare('DELETE FROM membros_cargos WHERE servidor_id = ? AND usuario_id = ?').run(servidorId, usuarioId);
  db.prepare('DELETE FROM membros_servidor WHERE servidor_id = ? AND usuario_id = ?').run(servidorId, usuarioId);
  res.status(204).end();
});

router.post('/servidores/:servidorId/membros/:usuarioId/banir', (req, res) => {
  const servidorId = Number(req.params.servidorId);
  const usuarioId = Number(req.params.usuarioId);
  if (!temPermissao(servidorId, req.usuario.id, 'banir_membros')) return res.status(403).json({ erro: 'Você não pode banir membros.' });
  const alvo = membroAlvoValido(servidorId, usuarioId);
  if (!alvo) return res.status(404).json({ erro: 'Membro não encontrado.' });
  if (alvo.papel === 'dono' || alvo.dono_id === usuarioId) return res.status(403).json({ erro: 'O dono não pode ser banido.' });
  db.prepare('INSERT OR IGNORE INTO banimentos_servidor (servidor_id, usuario_id) VALUES (?, ?)').run(servidorId, usuarioId);
  db.prepare('DELETE FROM membros_cargos WHERE servidor_id = ? AND usuario_id = ?').run(servidorId, usuarioId);
  db.prepare('DELETE FROM membros_servidor WHERE servidor_id = ? AND usuario_id = ?').run(servidorId, usuarioId);
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

// Cria um canal novo (texto ou voz) no servidor.
router.post('/servidores/:id/canais', (req, res) => {
  const servidorId = Number(req.params.id);
  if (!temPermissao(servidorId, req.usuario.id, 'gerenciar_canais')) {
    return res.status(403).json({ erro: 'Você não tem permissão para gerenciar canais.' });
  }

  const nome = String(req.body.nome || '').trim();
  const tipo = req.body.tipo;

  if (!nome || nome.length > 32) {
    return res.status(400).json({ erro: 'O nome do canal precisa ter entre 1 e 32 caracteres.' });
  }
  if (tipo !== 'texto' && tipo !== 'voz') {
    return res.status(400).json({ erro: 'Tipo de canal inválido.' });
  }

  const resultado = db
    .prepare('INSERT INTO canais (servidor_id, nome, tipo) VALUES (?, ?, ?)')
    .run(servidorId, nome, tipo);

  res.status(201).json({ id: resultado.lastInsertRowid, nome, tipo });
});

// Apaga um canal do servidor.
router.delete('/servidores/:id/canais/:canalId', (req, res) => {
  const servidorId = Number(req.params.id);
  const canalId = Number(req.params.canalId);

  if (!temPermissao(servidorId, req.usuario.id, 'gerenciar_canais')) {
    return res.status(403).json({ erro: 'Você não tem permissão para gerenciar canais.' });
  }

  const canal = db.prepare('SELECT id FROM canais WHERE id = ? AND servidor_id = ?').get(canalId, servidorId);
  if (!canal) return res.status(404).json({ erro: 'Canal não encontrado.' });

  db.prepare('DELETE FROM mensagens WHERE canal_id = ?').run(canalId);
  db.prepare('DELETE FROM canais WHERE id = ?').run(canalId);

  res.status(204).end();
});

module.exports = { router, ehMembro, temPermissao };
