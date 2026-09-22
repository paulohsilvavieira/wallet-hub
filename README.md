# Wallet Hub

Ferramenta pra facilitar a transferência de saldo de teste (**Bitcoin
regtest** e **Ethereum/Anvil**) durante o desenvolvimento e teste do
**MyBitcoin** — sem precisar decorar comandos de RPC ou ficar chamando
`bitcoin-cli`/`cast` na mão toda vez que precisa de fundos numa carteira de
teste.

Um só login, dois níveis de acesso:

- **Admin**: console completo — gerencia conexões de node (BTC e ETH),
  contas de teste BTC, carteiras ETH compartilhadas (cola chave privada ou
  importa do Anvil), envia fundos sem limite, usa o faucet ETH, reseta senha
  de usuários. Assinatura ETH sempre no navegador, com a chave da carteira
  escolhida.
- **Usuário comum** (cadastro aberto): tela simplificada com dois cards —
  "Enviar BTC" e "Enviar ETH", só endereço de destino + valor. Limitado a
  **3 BTC/dia** e **3 ETH/dia por endereço de destino** (soma de todos os
  usuários, reseta à meia-noite UTC).

Não é uma ferramenta de produção nem lida com fundos reais — só regtest
(BTC) e Anvil/devnet (ETH).

## Stack

- **Frontend**: React 19 + Vite 6 + TypeScript + Tailwind v4.
- **Backend**: Express + `better-sqlite3` (um arquivo só, sem serviço de
  banco separado), sessão por cookie httpOnly.
- **Bitcoin**: fala direto com o RPC do `bitcoind` (regtest) — geração de
  contas de teste local via BIP39/BIP32 (`bitcoinjs-lib`), sem criar wallet
  nova no node.
- **Ethereum**: assinatura e envio **sempre no backend** (`ethers`), nunca
  no navegador — o frontend só manda endereço/valor. O RPC do Anvil nunca é
  acessado direto numa porta 8545: sempre através de um proxy HTTPS
  autenticado (header `X-RPC-Token`).

## Funcionalidades

- **Conexões de node configuráveis**: o admin cadastra, edita, ativa e
  exclui múltiplas conexões salvas (BTC e ETH), trocando qual node está em
  uso sem reiniciar o container.
- **Fallback de carteira ETH**: se a carteira mais antiga não tiver saldo
  suficiente pra um envio de usuário comum, o backend tenta automaticamente
  a próxima carteira cadastrada, sem o usuário perceber. Um alerta aparece
  no console admin quando alguma carteira está com saldo baixo (< 0.01 ETH),
  pedindo recarga via faucet.
- **Faucet ETH** (admin-only): credita saldo instantaneamente num endereço
  via `anvil_setBalance`, sem gastar de nenhuma carteira.
- **Recuperação de conta admin-assistida**: sem depender de e-mail, o admin
  gera uma senha temporária pra qualquer usuário na aba "Usuários" — derruba
  todas as sessões ativas dele, mostrado só uma vez na tela.
- **Admin fixo por variável de ambiente**: `ADMIN_EMAIL`/`ADMIN_PASSWORD`
  são sincronizados a cada boot do container — trocar a senha é só editar o
  `.env` e reiniciar, sem mexer no banco.

## Pré-requisitos

Você precisa de dois serviços já rodando e alcançáveis pela rede:

1. **Um `bitcoind` em modo regtest**, com uma wallet carregada, alcançável
   por RPC (`RPC_HOST`/`RPC_PORT`/`RPC_USER`/`RPC_PASSWORD`).
2. **Um Anvil** (ou qualquer devnet Ethereum compatível), alcançável por
   HTTP/RPC (`ANVIL_RPC_URL`, mais um header de autenticação opcional
   `ANVIL_RPC_TOKEN` se o seu proxy/RPC exigir).

Se você não tem esses dois de pé ainda, existem repositórios prontos que já
sobem isso, cada um acompanhado de um block explorer:

- [`bitcoin-local-explorer`](https://github.com/paulohsilvavieira/bitcoin-local-explorer) — `bitcoind` regtest com auto-mining + btc-rpc-explorer.
- [`ethereum-local-explorer`](https://github.com/paulohsilvavieira/ethereum-local-explorer) — Anvil + Blockscout.

## Configuração

Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

| Variável | Uso |
|---|---|
| `RPC_HOST` / `RPC_PORT` | Endereço do `bitcoind` (regtest) |
| `RPC_USER` / `RPC_PASSWORD` | Credenciais RPC do `bitcoind` |
| `WALLET_NAME` | Wallet carregada no node, usada por `/api/btc/send` |
| `BITCOIN_NETWORK_NAME` | Nome da rede Docker externa onde o `bitcoind` está (default `bitcoin_default`) — só relevante rodando com Docker Compose |
| `ANVIL_RPC_URL` | URL do RPC do Anvil (direto, ou através de um proxy autenticado) |
| `ANVIL_RPC_TOKEN` | Header `X-RPC-Token` enviado em toda chamada ao Anvil, se o seu RPC exigir |
| `VITE_EXPLORER_URL` / `VITE_ETH_EXPLORER_URL` | Links "abrir explorer" no frontend (build-time, embutidos no bundle) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Único jeito de existir um admin — sincronizado a cada boot (idempotente: se já bate, não faz nada) |

Cadastro de admin é **fechado**: sem essas duas env vars, ninguém vira
admin, e não existe rota HTTP pra promover usuário. Cadastro de usuário
comum continua **aberto** (tela de login → "Cadastre-se").

As conexões de node (host/porta/credenciais do BTC, URL/token do Anvil) só
usam essas env vars como **valor inicial**, criado automaticamente no
primeiro boot (bootstrap, uma vez só) — depois disso, tudo é gerenciado pela
aba "Conexão do node" no console admin, sem precisar editar `.env` de novo.

## Rodando com Docker

```bash
docker compose build
docker compose up -d
```

Abra `http://localhost:3005`. Sem cookie de sessão → tela de login. Logue
com `ADMIN_EMAIL`/`ADMIN_PASSWORD` pra ver o console completo (abas
Bitcoin/Ethereum/Usuários). Qualquer conta criada por self-signup entra como
usuário comum, e vê só os dois cards de envio simplificado.

Dados (usuários, sessões, contas de teste, carteiras ETH, conexões de node,
histórico) ficam em `./data` (bind mount, ao lado do `docker-compose.yml`)
— sobrevivem a restart e recriação do container.

### Atualizando depois de mexer no código

```bash
docker compose build && docker compose up -d --force-recreate
```

`--force-recreate` evita um problema chato: às vezes o `up -d` sozinho não
recria o container mesmo com uma imagem nova, e você fica testando código
velho sem perceber.

## Desenvolvimento local (mais rápido que rebuildar Docker toda hora)

O `vite.config.ts` já tem um proxy de `/api` pra `http://localhost:3005` —
ou seja, dá pra rodar só o frontend fora do Docker, com hot reload, contra o
backend que já está rodando no container:

```bash
npm install
npm run dev   # http://localhost:5173, com hot reload
```

Só precisa rebuildar a imagem Docker quando: (a) mexer em código do
**backend** (`server/*.js` — não tem hot reload do lado do servidor hoje),
ou (b) for validar/publicar a imagem final de verdade.

Rodando o backend fora do Docker também, pra debugar sem container nenhum:

```bash
cd server
npm install
RPC_HOST=localhost RPC_PORT=18443 RPC_USER=admin RPC_PASSWORD=admin \
WALLET_NAME=bitcoin-wallet-regtest ANVIL_RPC_URL=... ANVIL_RPC_TOKEN=... \
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=troque-essa-senha \
node index.js
```

## Rodando no Coolify

O Coolify sobe o `docker-compose.yml` do repositório direto: crie um
recurso **Docker Compose** apontando pro repo, configure as env vars na UI
do Coolify (mesmas da tabela acima) e atribua um domínio ao serviço
`wallet-hub` (porta 3005).

Duas pegadinhas específicas desse projeto:

1. **A rede Docker do `bitcoind` precisa existir antes do deploy.** O
   compose declara essa rede como `external: true` (nome configurável por
   `BITCOIN_NETWORK_NAME`) — se ela não existir no host/Docker do Coolify
   nesse momento, o deploy falha na hora de subir o container. Suba o
   `bitcoind` primeiro, confirme que a rede existe
   (`docker network ls | grep bitcoin_default`), só depois faça o deploy do
   `wallet-hub`.
2. **`ANVIL_RPC_URL` precisa ser uma URL alcançável a partir do host do
   Coolify.** Se o Anvil roda noutro host/stack sem rede Docker
   compartilhada, use o domínio HTTPS público dele — nunca `localhost` nem
   endereço interno de outro stack que o Coolify não enxerga.

**Persistência do SQLite**: o `docker-compose.yml` já usa um bind mount
relativo (`./data:/data`) em vez de volume nomeado — o Coolify detecta isso
automaticamente e deve listar em **Storages** pro recurso `wallet-hub`,
como storage persistente. Confirme que aparece lá antes do primeiro deploy
de verdade, e evite qualquer opção de "limpar volumes" durante redeploys.
Pra testar que a persistência está funcionando: cadastre um usuário, force
um redeploy, confira se ele continua lá.

## Estrutura

```
server/
  auth.js          # usuários, sessões, hash de senha, sync do admin no boot
  connections.js   # conexões de node (BTC/ETH) — CRUD, ativação, bootstrap
  db.js            # conexão SQLite compartilhada (better-sqlite3)
  index.js         # monta o Express, rotas de auth/admin, serve o build do front
  middleware.js     # requireAuth / requireAdmin
  bitcoin/
    walletRpc.js     # RPC cru pro bitcoind
    localWallet.js   # geração de contas de teste (BIP39/BIP32)
    history.js       # histórico de envios BTC
    routes.js        # rotas /api/btc/*
  ethereum/
    provider.js      # provider ethers único, autenticado (X-RPC-Token)
    anvilRpc.js       # chamadas RPC cruas (eth_accounts, anvil_setBalance, ...)
    wallets.js        # carteiras ETH compartilhadas — CRUD, import do Anvil
    history.js        # histórico de envios ETH
    routes.js          # rotas /api/eth/*
src/
  components/ui/*       # design system (Alert, Badge, Button, Card, Input, Table, Label)
  components/admin/     # users-manager.tsx — lista de usuários, reset de senha
  components/btc/*      # send-form, connection-manager, local-account-list, account-card, history-table, simple-send-card
  components/eth/*      # send-form (com faucet embutido), connection-manager, wallet-list, wallet-card, wallet-select, history-table, simple-send-card
  pages/
    login-page.tsx
    admin-console-page.tsx   # abas Bitcoin / Ethereum / Usuários
    user-send-page.tsx       # visão simplificada — abas Bitcoin / Ethereum
```
