<p align="center">
  <img src="client/public/astralis-mark.svg" alt="Logo Astralis" width="128" height="128" />
</p>

<h1 align="center">Astralis</h1>

<p align="center">Um espaço privado para conversar, jogar e compartilhar momentos com seus amigos.</p>

## Sobre

Astralis é um aplicativo de comunidade para Windows e macOS, inspirado nas ferramentas que tornam simples ficar em contato durante uma partida. O projeto reúne um cliente desktop em Electron e React e um backend Express com Socket.IO. Os dados são armazenados em PostgreSQL no Neon; o backend é hospedado no Render.

## Recursos

- Contas, login e perfis de usuário
- Servidores privados, convites, canais de texto e voz
- Mensagens em canais e conversas diretas
- Lista de membros com presença online atualizada em tempo real
- Chamadas de voz com seleção de dispositivos, perfis de áudio e redução de ruído RNNoise
- Compartilhamento de tela ou janela em chamadas
- Atualizações do aplicativo por GitHub Releases

## Baixar

Encontre o instalador mais recente para Windows na página [Releases](https://github.com/jaozinisbad/astralis/releases). O aplicativo avisa quando há uma atualização disponível.

## Executar localmente

Requisitos: Node.js 22.5 ou superior e npm.

1. Clone o repositório e instale as dependências do servidor e do cliente:

   ```powershell
   git clone https://github.com/jaozinisbad/astralis.git
   cd astralis
   cd server; npm install; cd ..
   cd client; npm install; cd ..
   ```

2. Crie `server/.env` com base em `server/.env.example`. Configure `DATABASE_URL` com uma URL pooled de desenvolvimento do Neon e defina um `JWT_SECRET` longo e aleatório.

3. Em um terminal, inicie o backend:

   ```powershell
   cd server
   npm run dev
   ```

4. Em outro terminal, abra o cliente desktop:

   ```powershell
   cd client
   npm run dev:electron
   ```

Para apontar o cliente local a outro backend, defina `VITE_SERVER_URL` em `client/.env.local`. Sem essa variável, o app usa o backend publicado.

## Testes e build

Na pasta `client`, use `npm test` para executar os testes e `npm run build` para gerar os arquivos web do cliente. `npm run dist` cria o instalador do sistema operacional atual.

As chamadas de voz e o compartilhamento de tela usam WebRTC entre os participantes. Algumas redes podem exigir um servidor TURN para permitir conexões ponto a ponto.

## Infraestrutura

- Cliente: Electron, React e Vite
- Backend: Node.js, Express e Socket.IO
- Banco de dados: PostgreSQL no Neon
- Hospedagem do backend: Render

As instruções de migração e configuração do banco e do Render estão em [`docs/render.md`](docs/render.md). Nunca envie arquivos `.env`, senhas, tokens ou URLs de banco com credenciais para o Git.
