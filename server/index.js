require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { db } = require('./db');
const authRoutes = require('./routes/auth');
const { router: servidoresRoutes, ehMembro } = require('./routes/servidores');
const mensagensRoutes = require('./routes/mensagens');
const { router: amigosRoutes, compartilhamServidor } = require('./routes/amigos');
const { socketsPorUsuario } = require('./presenca');

const app = express();
const server = http.createServer(app);

// CORS liberado por enquanto (grupo fechado de amigos, sem exposição pública ampla).
// Quando o Cloudflare Tunnel estiver configurado, dá pra restringir à sua origem.
app.use(cors());

const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Servidor do app de comunicação está no ar!');
});

app.use('/api', authRoutes);
app.use('/api', servidoresRoutes);
app.use('/api', mensagensRoutes);
app.use('/api', amigosRoutes);

function servidorDoCanal(canalId) {
  return db.prepare('SELECT servidor_id FROM canais WHERE id = ?').get(canalId);
}

// Controle em memória de quem está em qual canal de voz (não precisa
// persistir no banco — é só presença em tempo real).
const canalVozParticipantes = {}; // canalId -> Map(socketId -> nome)

function amigosDe(usuarioId) {
  return db
    .prepare(
      `SELECT DISTINCT u.id
       FROM usuarios u
       JOIN membros_servidor m2 ON m2.usuario_id = u.id
       WHERE m2.servidor_id IN (
         SELECT servidor_id FROM membros_servidor WHERE usuario_id = ?
       )
       AND u.id != ?`
    )
    .all(usuarioId, usuarioId)
    .map((linha) => linha.id);
}

function avisarAmigos(usuarioId, evento) {
  amigosDe(usuarioId).forEach((amigoId) => {
    const sockets = socketsPorUsuario.get(amigoId);
    sockets?.forEach((socketId) => io.to(socketId).emit(evento, { usuarioId }));
  });
}

function sairDoCanalVoz(socket) {
  const canalId = socket.canalVozAtual;
  if (!canalId) return;

  socket.leave(`voz-${canalId}`);
  canalVozParticipantes[canalId]?.delete(socket.id);
  io.to(`voz-${canalId}`).emit('peer-saiu', { socketId: socket.id });
  socket.canalVozAtual = null;
}

// Exige um token válido para abrir a conexão de tempo real (chat/voz).
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Token não fornecido.'));

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) return next(new Error('Token inválido.'));
    socket.usuario = payload;
    next();
  });
});

io.on('connection', (socket) => {
  console.log('Novo cliente conectado:', socket.usuario.nome);

  // Presença online: registra este socket para o usuário e avisa os
  // amigos (quem compartilha servidor) que ele ficou online — só na
  // primeira conexão desse usuário (se ele já tinha outra aba aberta,
  // já estava online, não precisa avisar de novo).
  const jaEstavaOnline = socketsPorUsuario.has(socket.usuario.id);
  if (!socketsPorUsuario.has(socket.usuario.id)) socketsPorUsuario.set(socket.usuario.id, new Set());
  socketsPorUsuario.get(socket.usuario.id).add(socket.id);
  if (!jaEstavaOnline) avisarAmigos(socket.usuario.id, 'amigo-online');

  // Entrar na "sala" de um canal de texto para receber as mensagens dele.
  socket.on('entrar-canal', (canalId) => {
    const canal = servidorDoCanal(canalId);
    if (!canal || !ehMembro(canal.servidor_id, socket.usuario.id)) return;
    socket.join(`canal-${canalId}`);
  });

  socket.on('sair-canal', (canalId) => {
    socket.leave(`canal-${canalId}`);
  });

  // Enviar mensagem: salva no banco e retransmite pra todo mundo na sala do canal.
  socket.on('enviar-mensagem', ({ canalId, conteudo }) => {
    if (!conteudo || !conteudo.trim()) return;

    const canal = servidorDoCanal(canalId);
    if (!canal || !ehMembro(canal.servidor_id, socket.usuario.id)) return;

    const resultado = db
      .prepare('INSERT INTO mensagens (canal_id, usuario_id, conteudo) VALUES (?, ?, ?)')
      .run(canalId, socket.usuario.id, conteudo.trim());

    const mensagem = {
      id: resultado.lastInsertRowid,
      conteudo: conteudo.trim(),
      autor: socket.usuario.nome,
      criado_em: new Date().toISOString(),
    };

    io.to(`canal-${canalId}`).emit('nova-mensagem', { canalId, mensagem });
  });

  // --- Canal de voz: presença + sinalização WebRTC ---

  socket.on('entrar-canal-voz', (canalId) => {
    const canal = servidorDoCanal(canalId);
    if (!canal || !ehMembro(canal.servidor_id, socket.usuario.id)) return;

    // Se já estava em outro canal de voz, sai dele primeiro.
    sairDoCanalVoz(socket);

    if (!canalVozParticipantes[canalId]) canalVozParticipantes[canalId] = new Map();

    // Busca dados completos do usuário (incluindo avatar_cor e avatar_url)
    const usuario = db
      .prepare('SELECT id, nome, avatar_cor, avatar_url FROM usuarios WHERE id = ?')
      .get(socket.usuario.id);

    // Manda pro recém-chegado a lista de quem já está na chamada.
    const peers = Array.from(canalVozParticipantes[canalId].entries()).map(([socketId, dadosUsuario]) => ({
      socketId,
      nome: dadosUsuario.nome,
      avatarCor: dadosUsuario.avatarCor,
      avatarUrl: dadosUsuario.avatarUrl,
    }));
    socket.emit('peers-existentes', { peers });

    canalVozParticipantes[canalId].set(socket.id, {
      nome: usuario.nome,
      avatarCor: usuario.avatar_cor || '#5865f2',
      avatarUrl: usuario.avatar_url || null,
    });
    socket.join(`voz-${canalId}`);
    socket.canalVozAtual = canalId;

    socket.to(`voz-${canalId}`).emit('novo-peer', {
      socketId: socket.id,
      nome: usuario.nome,
      avatarCor: usuario.avatar_cor || '#5865f2',
      avatarUrl: usuario.avatar_url || null,
    });
  });

  socket.on('sair-canal-voz', () => sairDoCanalVoz(socket));

  socket.on('tela-parada', () => {
    if (socket.canalVozAtual) {
      socket.to(`voz-${socket.canalVozAtual}`).emit('tela-parada', { socketId: socket.id });
    }
  });

  // --- Mensagens diretas (fora de servidores) ---

  socket.on('enviar-dm', ({ paraUsuarioId, conteudo }) => {
    if (!conteudo || !conteudo.trim()) return;
    if (!compartilhamServidor(socket.usuario.id, paraUsuarioId)) return;

    const resultado = db
      .prepare('INSERT INTO mensagens_diretas (remetente_id, destinatario_id, conteudo) VALUES (?, ?, ?)')
      .run(socket.usuario.id, paraUsuarioId, conteudo.trim());

    const mensagem = {
      id: resultado.lastInsertRowid,
      conteudo: conteudo.trim(),
      remetente_id: socket.usuario.id,
      criado_em: new Date().toISOString(),
    };

    // Entrega pra todas as sessões abertas do destinatário e ecoa de
    // volta pra todas as suas próprias sessões (pra sincronizar se
    // você tiver o app aberto em mais de um lugar).
    [paraUsuarioId, socket.usuario.id].forEach((usuarioId) => {
      socketsPorUsuario.get(usuarioId)?.forEach((socketId) => {
        io.to(socketId).emit('nova-dm', { comUsuarioId: paraUsuarioId, deUsuarioId: socket.usuario.id, mensagem });
      });
    });
  });

  // Simples retransmissão de sinalização — o servidor não entende o
  // conteúdo, só entrega pro destinatário certo (relay).
  socket.on('webrtc-oferta', ({ para, oferta }) => {
    io.to(para).emit('webrtc-oferta', { de: socket.id, oferta });
  });
  socket.on('webrtc-resposta', ({ para, resposta }) => {
    io.to(para).emit('webrtc-resposta', { de: socket.id, resposta });
  });
  socket.on('webrtc-candidato', ({ para, candidato }) => {
    io.to(para).emit('webrtc-candidato', { de: socket.id, candidato });
  });

  socket.on('disconnect', () => {
    sairDoCanalVoz(socket);

    const sockets = socketsPorUsuario.get(socket.usuario.id);
    sockets?.delete(socket.id);
    if (sockets && sockets.size === 0) {
      socketsPorUsuario.delete(socket.usuario.id);
      avisarAmigos(socket.usuario.id, 'amigo-offline');
    }

    console.log('Cliente desconectado:', socket.usuario.nome);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
