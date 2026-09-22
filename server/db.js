const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// O banco fica salvo como um arquivo local (app-gamers.db).
// node:sqlite é embutido no próprio Node (a partir da v22.5), então
// não precisa instalar nada nem compilar binário nativo.
// Quando o projeto migrar para MySQL, só este arquivo precisa mudar —
// o resto do código (rotas) não depende de qual banco está por trás.
const databasePath = process.env.DATABASE_PATH || path.join(__dirname, 'app-gamers.db');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);

db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS servidores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    dono_id INTEGER NOT NULL,
    codigo_convite TEXT NOT NULL UNIQUE,
    icone_url TEXT,
    banner_url TEXT,
    descricao TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (dono_id) REFERENCES usuarios(id)
  );

  CREATE TABLE IF NOT EXISTS membros_servidor (
    servidor_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    papel TEXT NOT NULL DEFAULT 'membro',
    entrou_em TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (servidor_id, usuario_id),
    FOREIGN KEY (servidor_id) REFERENCES servidores(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );

  CREATE TABLE IF NOT EXISTS canais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    servidor_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('texto', 'voz')),
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (servidor_id) REFERENCES servidores(id)
  );

  CREATE TABLE IF NOT EXISTS mensagens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    canal_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    conteudo TEXT NOT NULL,
    anexo_nome TEXT,
    anexo_tipo TEXT,
    anexo_url TEXT,
    anexo_tamanho INTEGER,
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (canal_id) REFERENCES canais(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );

  CREATE TABLE IF NOT EXISTS cargos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    servidor_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    cor TEXT NOT NULL DEFAULT '#99aab5',
    permissoes TEXT NOT NULL DEFAULT '{}',
    posicao INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (servidor_id) REFERENCES servidores(id)
  );

  CREATE TABLE IF NOT EXISTS membros_cargos (
    cargo_id INTEGER NOT NULL,
    servidor_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    PRIMARY KEY (cargo_id, usuario_id),
    FOREIGN KEY (cargo_id) REFERENCES cargos(id),
    FOREIGN KEY (servidor_id) REFERENCES servidores(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );

  CREATE TABLE IF NOT EXISTS banimentos_servidor (
    servidor_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (servidor_id, usuario_id),
    FOREIGN KEY (servidor_id) REFERENCES servidores(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );

  CREATE TABLE IF NOT EXISTS mensagens_diretas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    remetente_id INTEGER NOT NULL,
    destinatario_id INTEGER NOT NULL,
    conteudo TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (remetente_id) REFERENCES usuarios(id),
    FOREIGN KEY (destinatario_id) REFERENCES usuarios(id)
  );
`);

try {
  db.exec("ALTER TABLE usuarios ADD COLUMN avatar_cor TEXT NOT NULL DEFAULT '#5865f2'");
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}

try {
  db.exec("ALTER TABLE usuarios ADD COLUMN status TEXT NOT NULL DEFAULT 'Disponível'");
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}

try {
  db.exec("ALTER TABLE usuarios ADD COLUMN avatar_url TEXT");
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}

try {
  db.exec('ALTER TABLE usuarios ADD COLUMN banner_url TEXT');
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}

for (const [tabela, coluna, tipo] of [
  ['servidores', 'icone_url', 'TEXT'],
  ['servidores', 'banner_url', 'TEXT'],
  ['servidores', 'descricao', 'TEXT'],
  ['mensagens', 'anexo_nome', 'TEXT'],
  ['mensagens', 'anexo_tipo', 'TEXT'],
  ['mensagens', 'anexo_url', 'TEXT'],
  ['mensagens', 'anexo_tamanho', 'INTEGER'],
]) {
  try {
    db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}`);
  } catch (err) {
    if (!err.message.includes('duplicate column name')) throw err;
  }
}

db.exec(`
  INSERT INTO cargos (servidor_id, nome, cor, permissoes, posicao)
  SELECT s.id, 'Administrador', '#e74c3c',
    '{"gerenciar_servidor":true,"gerenciar_canais":true,"gerenciar_cargos":true,"gerenciar_membros":true,"banir_membros":true,"expulsar_call":true,"gerenciar_mensagens":true}',
    100
  FROM servidores s
  WHERE NOT EXISTS (
    SELECT 1 FROM cargos c WHERE c.servidor_id = s.id AND c.nome = 'Administrador'
  );

  INSERT OR IGNORE INTO membros_cargos (cargo_id, servidor_id, usuario_id)
  SELECT c.id, s.id, s.dono_id
  FROM cargos c
  JOIN servidores s ON s.id = c.servidor_id
  WHERE c.nome = 'Administrador';
`);

function gerarCodigoConvite() {
  return crypto.randomBytes(4).toString('hex');
}

module.exports = { db, gerarCodigoConvite };
