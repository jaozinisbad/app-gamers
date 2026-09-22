# Publicar o backend no Render

O `render.yaml` publica somente o servidor Express + Socket.IO. O cliente
Electron continua sendo instalado no computador dos usuarios.

## Armazenamento escolhido: gratuito para testes

O plano gratuito foi escolhido para esta etapa. O Blueprint esta configurado
com `plan: free`, sem disco pago. O SQLite
nesse plano e temporario: contas, mensagens e servidores podem desaparecer
quando o servico reiniciar ou receber um deploy.

Para manter SQLite em producao, altere `plan` para `starter` e acrescente
ao servico os campos abaixo (servico e disco sao pagos):

```yaml
    disk:
      name: app-gamers-data
      mountPath: /var/data
      sizeGB: 1
```

Acrescente tambem a lista `envVars`:

```yaml
      - key: DATABASE_PATH
        value: /var/data/app-gamers.db
```

O servidor cria o diretorio e o banco quando inicia. Sem `DATABASE_PATH`,
continua usando `server/app-gamers.db`. A publicacao comeca com um banco
novo; os dados locais nao sao enviados automaticamente. Para preservar dados
existentes, planeje uma transferencia com o servidor parado antes de liberar
o acesso. Use apenas uma instancia, pois o SQLite e a presenca em memoria
nao estao preparados para varias instancias.

## Publicacao

1. Revise o diff. O armazenamento escolhido nesta etapa e o gratuito temporario.
2. Se tiver o Render CLI instalado e autenticado, execute
   `render blueprints validate render.yaml` na raiz do projeto.
3. Faça commit dos arquivos desta preparacao e push para a branch `master`
   de `https://github.com/jaozinisbad/app-gamers`.
4. No Dashboard do Render, crie um Blueprint desse repositorio e selecione
   a branch `master` e o workspace `jaozinisbad projects`.
5. Revise o plano antes de aplicar. `JWT_SECRET` sera gerado pelo Render.
   A porta e fornecida automaticamente por `PORT`.
6. Espere o deploy ficar `Live` e verifique se `/` responde com HTTP 200.

## Cliente Electron

Depois de obter a URL real do backend, configure em `client/.env.local`:

```dotenv
VITE_SERVER_URL=https://SEU-SERVICO.onrender.com
```

Essa variavel e incorporada durante o build. Gere uma nova versao do cliente
com `npm run dist` na pasta `client` e distribua o instalador. Instaladores
antigos continuam usando a URL anterior. Para testar localmente com esse
backend, reinicie o Vite depois de configurar a variavel.

Teste cadastro/login, mensagens e conexao Socket.IO entre dois clientes.
Voz e tela usam WebRTC entre os computadores; hospedar a sinalizacao no
Render nao substitui um servidor TURN nas redes que exigem esse recurso.

Referencias: https://render.com/docs/disks e
https://render.com/docs/blueprint-spec.
