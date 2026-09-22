# App de comunicação para gamers

Aplicativo Electron + React para conversar em servidores privados com amigos.
O backend usa Express + Socket.IO e o banco PostgreSQL hospedado no Neon.

## Executar localmente

1. Configure `server/.env` a partir de `server/.env.example`, usando a URL pooled
   de uma branch Neon de desenvolvimento e um `JWT_SECRET` local.
2. Na pasta `server`, execute `npm install` e `npm run dev`.
3. Em outro terminal, na pasta `client`, execute `npm install` e `npm run dev:electron`.

Não envie arquivos `.env` nem URLs de banco ao Git. O backend não usa mais o
arquivo SQLite local durante a execução. A transferência inicial dos dados e a
publicação no Render estão descritas em [`docs/render.md`](docs/render.md).

## Recursos

- Cadastro e login com senha criptografada e sessão JWT
- Servidores, convites, canais, membros e permissões
- Chat de texto e mensagens diretas persistidos no PostgreSQL
- Chamadas de voz e compartilhamento de tela por WebRTC
- Atualizações do app Electron por GitHub Releases

O app exige Node.js 22.5 ou superior. Voz e compartilhamento usam conexão
ponto a ponto; algumas redes podem exigir configuração de TURN.
