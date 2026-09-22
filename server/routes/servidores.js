const express = require('express');
const { all, get, run, db, gerarCodigoConvite } = require('../db');
const autenticar = require('../middleware/autenticar');
const { estaOnline } = require('../presenca');

const router = express.Router();
router.use(autenticar);

const TODAS_PERMISSOES = [
  'gerenciar_servidor', 'gerenciar_canais', 'gerenciar_cargos',
  'gerenciar_membros', 'banir_membros', 'expulsar_call', 'gerenciar_mensagens',
];

const safe = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function validarPermissoes(permissoes = {}) {
  return Object.fromEntries(TODAS_PERMISSOES.map((nome) => [nome, permissoes[nome] === true]));
}

function permissoesDoCargo(cargo) {
  return typeof cargo.permissoes === 'object'
    ? cargo.permissoes || {}
    : JSON.parse(cargo.permissoes || '{}');
}

async function temPermissao(servidorId, usuarioId, permissao) {
  const membro = await get(
    'SELECT papel FROM membros_servidor WHERE servidor_id = ? AND usuario_id = ?',
    servidorId, usuarioId,
  );
  if (!membro) return false;
  if (membro.papel === 'dono') return true;
  const cargos = await all(
    `SELECT c.permissoes FROM cargos c
     JOIN membros_cargos mc ON mc.cargo_id = c.id
     WHERE mc.servidor_id = ? AND mc.usuario_id = ?`,
    servidorId, usuarioId,
  );
  return cargos.some((cargo) => permissoesDoCargo(cargo)[permissao] === true);
}

async function ehMembro(servidorId, usuarioId) {
  return !!(await get(
    'SELECT 1 FROM membros_servidor WHERE servidor_id = ? AND usuario_id = ?',
    servidorId, usuarioId,
  ));
}

router.post('/servidores', safe(async (req, res) => {
  const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
  if (!nome) return res.status(400).json({ erro: 'Dê um nome para o servidor.' });
  const codigo = gerarCodigoConvite();
  const permissoesAdmin = validarPermissoes(Object.fromEntries(TODAS_PERMISSOES.map((p) => [p, true])));
  const connection = await db.connect();
  let servidorId;
  try {
    await connection.query('BEGIN');
    servidorId = (await connection.query(
      'INSERT INTO servidores (nome, dono_id, codigo_convite) VALUES ($1, $2, $3) RETURNING id',
      [nome, req.usuario.id, codigo],
    )).rows[0].id;
    await connection.query(
      "INSERT INTO membros_servidor (servidor_id, usuario_id, papel) VALUES ($1, $2, 'dono')",
      [servidorId, req.usuario.id],
    );
    await connection.query(
      "INSERT INTO canais (servidor_id, nome, tipo) VALUES ($1, 'geral', 'texto'), ($1, 'Sala de voz', 'voz')",
      [servidorId],
    );
    const cargoId = (await connection.query(
      'INSERT INTO cargos (servidor_id, nome, cor, permissoes, posicao) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [servidorId, 'Administrador', '#e74c3c', permissoesAdmin, 100],
    )).rows[0].id;
    await connection.query(
      'INSERT INTO membros_cargos (cargo_id, servidor_id, usuario_id) VALUES ($1, $2, $3)',
      [cargoId, servidorId, req.usuario.id],
    );
    await connection.query('COMMIT');
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
  res.status(201).json({ id: servidorId, nome, codigo_convite: codigo, icone_url: null, banner_url: null });
}));

router.get('/servidores', safe(async (req, res) => {
  const servidores = await all(
    `SELECT s.id, s.nome, s.codigo_convite, s.icone_url, s.banner_url, s.descricao, m.papel
     FROM servidores s JOIN membros_servidor m ON m.servidor_id = s.id
     WHERE m.usuario_id = ? ORDER BY s.id`,
    req.usuario.id,
  );
  res.json(servidores);
}));

router.post('/servidores/entrar', safe(async (req, res) => {
  const codigo = typeof req.body.codigo === 'string' ? req.body.codigo.trim() : '';
  if (!codigo) return res.status(400).json({ erro: 'Informe um código de convite.' });
  const servidor = await get('SELECT id, nome FROM servidores WHERE codigo_convite = ?', codigo);
  if (!servidor) return res.status(404).json({ erro: 'Código de convite inválido.' });
  if (await ehMembro(servidor.id, req.usuario.id)) return res.status(409).json({ erro: 'Você já é membro deste servidor.' });
  if (await get('SELECT 1 FROM banimentos_servidor WHERE servidor_id = ? AND usuario_id = ?', servidor.id, req.usuario.id)) {
    return res.status(403).json({ erro: 'Você foi banido deste servidor.' });
  }
  await run('INSERT INTO membros_servidor (servidor_id, usuario_id, papel) VALUES (?, ?, ?)', servidor.id, req.usuario.id, 'membro');
  res.status(201).json({ id: servidor.id, nome: servidor.nome });
}));

router.delete('/servidores/:id', safe(async (req, res) => {
  const servidorId = Number(req.params.id);
  const servidor = await get('SELECT id, dono_id FROM servidores WHERE id = ?', servidorId);
  if (!servidor) return res.status(404).json({ erro: 'Servidor não encontrado.' });
  if (servidor.dono_id !== req.usuario.id) return res.status(403).json({ erro: 'Só quem criou o servidor pode excluí-lo.' });
  await run('DELETE FROM servidores WHERE id = ?', servidorId);
  res.status(204).end();
}));

router.post('/servidores/:id/sair', safe(async (req, res) => {
  const servidorId = Number(req.params.id);
  const membro = await get('SELECT papel FROM membros_servidor WHERE servidor_id = ? AND usuario_id = ?', servidorId, req.usuario.id);
  if (!membro) return res.status(404).json({ erro: 'Você não é membro deste servidor.' });
  if (membro.papel === 'dono') return res.status(400).json({ erro: 'Quem criou o servidor não pode sair dele — só excluir.' });
  await run('DELETE FROM membros_servidor WHERE servidor_id = ? AND usuario_id = ?', servidorId, req.usuario.id);
  res.status(204).end();
}));

router.patch('/servidores/:id', safe(async (req, res) => {
  const servidorId = Number(req.params.id);
  if (!(await temPermissao(servidorId, req.usuario.id, 'gerenciar_servidor'))) return res.status(403).json({ erro: 'Você não tem permissão para editar este servidor.' });
  const servidor = await get('SELECT id, nome, icone_url, banner_url, descricao FROM servidores WHERE id = ?', servidorId);
  if (!servidor) return res.status(404).json({ erro: 'Servidor não encontrado.' });
  const nome = req.body.nome === undefined ? servidor.nome : String(req.body.nome).trim();
  const descricao = req.body.descricao === undefined ? String(servidor.descricao || '') : String(req.body.descricao).trim();
  const iconeUrl = req.body.icone_url === undefined ? servidor.icone_url : req.body.icone_url || null;
  const bannerUrl = req.body.banner_url === undefined ? servidor.banner_url : req.body.banner_url || null;
  if (!nome || nome.length > 80 || descricao.length > 240) return res.status(400).json({ erro: 'Nome ou descrição do servidor inválidos.' });
  for (const imagem of [iconeUrl, bannerUrl]) {
    if (imagem && (!String(imagem).startsWith('data:image/') || String(imagem).length > 2000000)) return res.status(400).json({ erro: 'Imagem do servidor inválida ou muito grande.' });
  }
  await run('UPDATE servidores SET nome = ?, descricao = ?, icone_url = ?, banner_url = ? WHERE id = ?', nome, descricao || null, iconeUrl, bannerUrl, servidorId);
  res.json({ id: servidorId, nome, descricao: descricao || null, icone_url: iconeUrl, banner_url: bannerUrl });
}));

router.get('/servidores/:id/cargos', safe(async (req, res) => {
  const servidorId = Number(req.params.id);
  if (!(await ehMembro(servidorId, req.usuario.id))) return res.status(403).json({ erro: 'Você não é membro deste servidor.' });
  res.json((await all('SELECT id, nome, cor, permissoes, posicao FROM cargos WHERE servidor_id = ? ORDER BY posicao DESC, id', servidorId))
    .map((cargo) => ({ ...cargo, permissoes: permissoesDoCargo(cargo) })));
}));

router.get('/servidores/:id/membros', safe(async (req, res) => {
  const servidorId = Number(req.params.id);
  if (!(await ehMembro(servidorId, req.usuario.id))) return res.status(403).json({ erro: 'Você não é membro deste servidor.' });
  const membros = await all(
    `SELECT m.usuario_id, m.papel, u.nome, u.avatar_cor, u.avatar_url, u.status,
            c.id AS cargo_id, c.nome AS cargo_nome, c.cor AS cargo_cor
     FROM membros_servidor m JOIN usuarios u ON u.id = m.usuario_id
     LEFT JOIN membros_cargos mc ON mc.servidor_id = m.servidor_id AND mc.usuario_id = m.usuario_id
     LEFT JOIN cargos c ON c.id = mc.cargo_id
     WHERE m.servidor_id = ?
     ORDER BY CASE WHEN m.papel = 'dono' THEN 0 ELSE 1 END, c.posicao DESC NULLS LAST, u.nome`,
    servidorId,
  );
  const agrupados = new Map();
  for (const membro of membros) {
    if (!agrupados.has(membro.usuario_id)) agrupados.set(membro.usuario_id, {
      id: membro.usuario_id, nome: membro.nome, papel: membro.papel,
      avatar_cor: membro.avatar_cor, avatar_url: membro.avatar_url, status: membro.status, cargos: [],
    });
    if (membro.cargo_id) agrupados.get(membro.usuario_id).cargos.push({ id: membro.cargo_id, nome: membro.cargo_nome, cor: membro.cargo_cor });
  }
  res.json([...agrupados.values()].map((membro) => ({ ...membro, online: estaOnline(membro.id) })));
}));

router.post('/servidores/:id/cargos', safe(async (req, res) => {
  const servidorId = Number(req.params.id);
  if (!(await temPermissao(servidorId, req.usuario.id, 'gerenciar_cargos'))) return res.status(403).json({ erro: 'Você não pode gerenciar cargos.' });
  const nome = String(req.body.nome || '').trim();
  const cor = String(req.body.cor || '#99aab5').trim();
  if (!nome || nome.length > 32 || !/^#[0-9a-fA-F]{6}$/.test(cor)) return res.status(400).json({ erro: 'Nome ou cor do cargo inválidos.' });
  const permissoes = validarPermissoes(req.body.permissoes);
  const cargo = await get('INSERT INTO cargos (servidor_id, nome, cor, permissoes, posicao) VALUES (?, ?, ?, ?, ?) RETURNING id',
    servidorId, nome, cor, permissoes, Number(req.body.posicao) || 0);
  res.status(201).json({ id: cargo.id, nome, cor, permissoes, posicao: Number(req.body.posicao) || 0 });
}));

router.patch('/servidores/:servidorId/cargos/:cargoId', safe(async (req, res) => {
  const servidorId = Number(req.params.servidorId);
  const cargoId = Number(req.params.cargoId);
  if (!(await temPermissao(servidorId, req.usuario.id, 'gerenciar_cargos'))) return res.status(403).json({ erro: 'Você não pode gerenciar cargos.' });
  const cargo = await get('SELECT * FROM cargos WHERE id = ? AND servidor_id = ?', cargoId, servidorId);
  if (!cargo) return res.status(404).json({ erro: 'Cargo não encontrado.' });
  const nome = req.body.nome === undefined ? cargo.nome : String(req.body.nome).trim();
  const cor = req.body.cor === undefined ? cargo.cor : String(req.body.cor).trim();
  const permissoes = req.body.permissoes === undefined ? permissoesDoCargo(cargo) : validarPermissoes(req.body.permissoes);
  if (!nome || nome.length > 32 || !/^#[0-9a-fA-F]{6}$/.test(cor)) return res.status(400).json({ erro: 'Nome ou cor do cargo inválidos.' });
  await run('UPDATE cargos SET nome = ?, cor = ?, permissoes = ? WHERE id = ?', nome, cor, permissoes, cargoId);
  res.json({ id: cargoId, nome, cor, permissoes });
}));

router.post('/servidores/:servidorId/membros/:usuarioId/cargos/:cargoId', safe(async (req, res) => {
  const servidorId = Number(req.params.servidorId);
  const usuarioId = Number(req.params.usuarioId);
  const cargoId = Number(req.params.cargoId);
  if (!(await temPermissao(servidorId, req.usuario.id, 'gerenciar_cargos'))) return res.status(403).json({ erro: 'Você não pode gerenciar cargos.' });
  const cargo = await get('SELECT id FROM cargos WHERE id = ? AND servidor_id = ?', cargoId, servidorId);
  if (!cargo || !(await ehMembro(servidorId, usuarioId))) return res.status(404).json({ erro: 'Cargo ou membro não encontrado.' });
  await query(
    'INSERT INTO membros_cargos (cargo_id, servidor_id, usuario_id) VALUES (?, ?, ?) ON CONFLICT (cargo_id, usuario_id) DO NOTHING',
    [cargoId, servidorId, usuarioId],
  );
  res.status(204).end();
}));

router.delete('/servidores/:servidorId/membros/:usuarioId/cargos/:cargoId', safe(async (req, res) => {
  const { servidorId, usuarioId, cargoId } = req.params;
  if (!(await temPermissao(Number(servidorId), req.usuario.id, 'gerenciar_cargos'))) return res.status(403).json({ erro: 'Você não pode gerenciar cargos.' });
  await run('DELETE FROM membros_cargos WHERE servidor_id = ? AND usuario_id = ? AND cargo_id = ?', Number(servidorId), Number(usuarioId), Number(cargoId));
  res.status(204).end();
}));

async function membroAlvoValido(servidorId, usuarioId) {
  return get(
    'SELECT m.usuario_id, m.papel, s.dono_id FROM membros_servidor m JOIN servidores s ON s.id = m.servidor_id WHERE m.servidor_id = ? AND m.usuario_id = ?',
    servidorId, usuarioId,
  );
}

router.delete('/servidores/:servidorId/membros/:usuarioId', safe(async (req, res) => {
  const servidorId = Number(req.params.servidorId);
  const usuarioId = Number(req.params.usuarioId);
  if (!(await temPermissao(servidorId, req.usuario.id, 'gerenciar_membros'))) return res.status(403).json({ erro: 'Você não pode expulsar membros.' });
  const alvo = await membroAlvoValido(servidorId, usuarioId);
  if (!alvo) return res.status(404).json({ erro: 'Membro não encontrado.' });
  if (alvo.papel === 'dono' || alvo.dono_id === usuarioId) return res.status(403).json({ erro: 'O dono não pode ser expulso.' });
  await run('DELETE FROM membros_servidor WHERE servidor_id = ? AND usuario_id = ?', servidorId, usuarioId);
  res.status(204).end();
}));

router.post('/servidores/:servidorId/membros/:usuarioId/banir', safe(async (req, res) => {
  const servidorId = Number(req.params.servidorId);
  const usuarioId = Number(req.params.usuarioId);
  if (!(await temPermissao(servidorId, req.usuario.id, 'banir_membros'))) return res.status(403).json({ erro: 'Você não pode banir membros.' });
  const alvo = await membroAlvoValido(servidorId, usuarioId);
  if (!alvo) return res.status(404).json({ erro: 'Membro não encontrado.' });
  if (alvo.papel === 'dono' || alvo.dono_id === usuarioId) return res.status(403).json({ erro: 'O dono não pode ser banido.' });
  await query('INSERT INTO banimentos_servidor (servidor_id, usuario_id) VALUES (?, ?) ON CONFLICT (servidor_id, usuario_id) DO NOTHING', [servidorId, usuarioId]);
  await run('DELETE FROM membros_servidor WHERE servidor_id = ? AND usuario_id = ?', servidorId, usuarioId);
  res.status(204).end();
}));

router.get('/servidores/:id/canais', safe(async (req, res) => {
  const servidorId = Number(req.params.id);
  if (!(await ehMembro(servidorId, req.usuario.id))) return res.status(403).json({ erro: 'Você não é membro deste servidor.' });
  res.json(await all('SELECT id, nome, tipo FROM canais WHERE servidor_id = ? ORDER BY tipo, id', servidorId));
}));

router.post('/servidores/:id/canais', safe(async (req, res) => {
  const servidorId = Number(req.params.id);
  if (!(await temPermissao(servidorId, req.usuario.id, 'gerenciar_canais'))) return res.status(403).json({ erro: 'Você não tem permissão para gerenciar canais.' });
  const nome = String(req.body.nome || '').trim();
  const tipo = req.body.tipo;
  if (!nome || nome.length > 32) return res.status(400).json({ erro: 'O nome do canal precisa ter entre 1 e 32 caracteres.' });
  if (tipo !== 'texto' && tipo !== 'voz') return res.status(400).json({ erro: 'Tipo de canal inválido.' });
  const canal = await get('INSERT INTO canais (servidor_id, nome, tipo) VALUES (?, ?, ?) RETURNING id', servidorId, nome, tipo);
  res.status(201).json({ id: canal.id, nome, tipo });
}));

router.delete('/servidores/:id/canais/:canalId', safe(async (req, res) => {
  const servidorId = Number(req.params.id);
  const canalId = Number(req.params.canalId);
  if (!(await temPermissao(servidorId, req.usuario.id, 'gerenciar_canais'))) return res.status(403).json({ erro: 'Você não tem permissão para gerenciar canais.' });
  const canal = await get('SELECT id FROM canais WHERE id = ? AND servidor_id = ?', canalId, servidorId);
  if (!canal) return res.status(404).json({ erro: 'Canal não encontrado.' });
  await run('DELETE FROM canais WHERE id = ?', canalId);
  res.status(204).end();
}));

module.exports = { router, ehMembro, temPermissao };
