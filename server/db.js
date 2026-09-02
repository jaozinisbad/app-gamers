const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const crypto = require('crypto');

// O banco fica salvo como um arquivo local (app-gamers.db).
// node:sqlite é embutido no próprio Node (a partir da v22.5), então
// não precisa instalar nada nem compilar binário nativo.
// Quando o projeto migrar para MySQL, só este arquivo precisa mudar —
// o resto do código (rotas) não depende de qual banco está por trás.
const db = new DatabaseSync(path.join(__dirname, 'app-gamers.db'));

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
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (canal_id) REFERENCES canais(id),
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

function gerarCodigoConvite() {
  return crypto.randomBytes(4).toString('hex');
}

module.exports = { db, gerarCodigoConvite };
