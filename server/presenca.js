// Controle de presença online: um usuário pode estar conectado em mais
// de uma aba/janela ao mesmo tempo, por isso guardamos um conjunto de
// sockets por usuário (só fica "offline" quando o último desconecta).
const socketsPorUsuario = new Map(); // usuarioId -> Set(socketId)

function estaOnline(usuarioId) {
  return (socketsPorUsuario.get(usuarioId)?.size || 0) > 0;
}

module.exports = { socketsPorUsuario, estaOnline };
