# App de comunicação para gamers — Fase 0

Esqueleto inicial já testado: servidor Node.js + Socket.io e app
Electron + React com o layout base (colunas de servidor/canal/conteúdo).

## Como rodar

### 1. Servidor
```
cd server
npm install
npm run dev
```
Deve aparecer: `Servidor rodando em http://localhost:3001`

### 2. App cliente (em outro terminal)
```
cd client
npm install
npm run dev:electron
```
Isso abre a janela do Electron carregando o app React. Se tudo estiver
certo, a tela vai mostrar "Status da conexão com o servidor: conectado
ao servidor".

## Próximo passo: acesso pela internet (Cloudflare Tunnel)

Para os amigos conseguirem se conectar ao seu servidor sem você precisar
mexer no roteador:

1. Instale o `cloudflared`:
   - Windows: baixe o instalador em https://github.com/cloudflare/cloudflared/releases
   - Ou via winget: `winget install --id Cloudflare.cloudflared`

2. Com o servidor rodando (`npm run dev` dentro de `/server`), abra outro
   terminal e rode:
   ```
   cloudflared tunnel --url http://localhost:3001
   ```

3. O terminal vai mostrar uma URL pública do tipo
   `https://algo-aleatorio.trycloudflare.com`. Essa é a URL que os amigos
   (e o app cliente) vão usar para falar com o servidor.

4. No arquivo `client/src/App.jsx`, troque a constante `SERVER_URL` pela
   URL gerada pelo Cloudflare Tunnel (isso ainda será feito de forma mais
   organizada, via variável de ambiente, numa fase futura).

> Nota: essa URL gratuita do `trycloudflare.com` muda toda vez que você
> reinicia o túnel. Quando o projeto avançar, dá pra configurar um túnel
> fixo associado a um domínio (inclusive gratuito, via Cloudflare) para
> ter sempre o mesmo endereço.

## O que já funciona
- Servidor Express + Socket.io respondendo e aceitando conexões
- App Electron abrindo com layout inspirado no Discord
- Cadastro e login reais, com senha criptografada (bcrypt) e sessão via token (JWT)
- Banco de dados SQLite embutido no Node (`node:sqlite`, arquivo `server/app-gamers.db`)
- **Criação de servidores de verdade**, cada um já vem com um canal de texto
  ("geral") e um canal de voz criados automaticamente
- **Sistema de convite**: cada servidor tem um código único; qualquer amigo
  com o código entra pelo botão "+" → "Entrar com convite"
- **Chat de texto em tempo real**: mensagens são salvas no banco e entregues
  instantaneamente para todos que estiverem no mesmo canal (testado com dois
  usuários simultâneos)
- Histórico de mensagens carregado ao abrir um canal
- **Chamada de voz de verdade** em canais de voz: captura de microfone,
  conexão P2P via WebRTC entre todos que estiverem no mesmo canal, e
  botão de mutar/desmutar
- **Compartilhamento de tela ao vivo**: qualquer participante da chamada
  pode compartilhar a tela, e todo mundo no canal vê o vídeo em tempo real

> Requisito: Node.js 22.5 ou superior (para o `node:sqlite` funcionar). Se
> aparecer um aviso "ExperimentalWarning: SQLite is an experimental feature"
> no terminal ao iniciar o servidor, é esperado e não afeta o funcionamento.

## Fase 3 — servidores, convites e chat em tempo real

Fluxo para testar com um amigo:
1. Você cria um servidor pelo botão "+" na barra da esquerda
2. Clique no texto "Convite: xxxxx" no topo da lista de canais para copiar o código
3. Mande esse código pro seu amigo (ex: por WhatsApp)
4. Seu amigo clica no "+", escolhe "Entrar com convite" e cola o código
5. Agora os dois estão no mesmo servidor e podem conversar no canal #geral em tempo real

**Importante:** para o amigo conseguir entrar de outro computador, o servidor
precisa estar acessível pela internet — é para isso que serve o Cloudflare
Tunnel mencionado mais abaixo. Enquanto vocês não configurarem isso, o teste
só funciona entre janelas abertas na mesma máquina.

## Fase 4 — chamada de voz (WebRTC)

Quando você clica num canal de voz, o app pede permissão do microfone e
te conecta com todo mundo que já estiver naquele canal. A conversa de
áudio em si trafega **direto entre os PCs** (peer-to-peer) — o servidor
só ajuda a "apresentar" os participantes uns aos outros no início.

Funciona bem até uns 4-5 participantes na mesma chamada; com mais gente
que isso, cada pessoa manda áudio pra todas as outras e a coisa fica
pesada — se o grupo crescer, dá pra revisitar isso numa fase de polimento.

**Importante para testar com amigos:** como a conexão é direta entre os
computadores, cada participante precisa estar numa rede que permita esse
tipo de conexão. Na grande maioria dos casos (redes residenciais normais)
funciona sem configuração nenhuma, graças aos servidores STUN públicos já
configurados no código. Se alguém não conseguir ouvir os outros, o
próximo passo de diagnóstico é verificar se o navegador/Electron liberou
a permissão do microfone.

## Próxima fase (Fase 5, conforme o plano)
Vídeo de webcam e compartilhamento de tela, usando a mesma conexão WebRTC
já estabelecida pra voz.

## Fase 5 — compartilhamento de tela

Decisão: sem chamada de vídeo por webcam, só compartilhamento de tela
mesmo (mais simples e é o que interessa pro uso do grupo).

Como funciona: dentro de um canal de voz, o botão "Compartilhar tela"
pede pro navegador escolher qual tela/janela compartilhar, e adiciona
esse vídeo na mesma conexão WebRTC que já existe pra voz (sem precisar
o servidor saber de nada novo — é a mesma sinalização genérica da Fase 4,
só que carregando vídeo dessa vez em vez de só áudio).

- Cada participante pode compartilhar sua própria tela
- O vídeo de quem está compartilhando aparece pra todo mundo no canal
- Parar pelo botão ou pelo controle nativo do navegador ("Parar
  compartilhamento") funciona igual

**Limitação conhecida:** se duas pessoas começarem a compartilhar tela
bem no mesmo instante uma da outra, pode dar um pequeno engasgo na
conexão (chamado de "colisão de negociação" no WebRTC). Isso é raro na
prática e, se incomodar, dá pra resolver depois com um ajuste mais fino
na lógica de quem manda a oferta primeiro.

## Ajustes finos pendentes (a fazer no fim, conforme pedido)
- Chamada de voz não deve desconectar ao trocar de canal — poder navegar
  no chat de texto enquanto continua na call
- Botão de "Desconectar" explícito da chamada de voz
- Separar o controle de mutar microfone do de silenciar o áudio recebido (fone)
