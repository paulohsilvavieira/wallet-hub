# Wallet Hub

Ferramenta interna pra facilitar testes com o **MyBitcoin**: um backend e um
frontend únicos pra distribuir saldo de teste em **Bitcoin (regtest)** e
**Ethereum (Anvil/devnet)**, com login e dois níveis de acesso:

- **Admin**: console completo — gerencia conexões de node (BTC e ETH),
  contas de teste BTC, carteiras ETH compartilhadas (cola chave privada ou
  importa do Anvil), envia fundos sem limite, usa o faucet ETH, reseta senha
  de usuários. Assinatura ETH sempre no navegador, com a chave da carteira
  escolhida.
- **Usuário comum** (cadastro aberto): tela simplificada com dois cards —
  "Enviar BTC" e "Enviar ETH", só endereço de destino + valor. Limitado a
  **3 BTC/dia** e **3 ETH/dia por endereço de destino** (soma de todos os
  usuários, reseta à meia-noite UTC). Nunca vê chave privada nem gerencia
  contas.

Não é uma ferramenta de produção nem lida com fundos reais — foi desenhada
só pra alimentar saldo de teste nas carteiras do MyBitcoin (regtest/devnet).

## Stack

- **Frontend**: React 19 + Vite 6 + TypeScript + Tailwind v4, mesmo design
  system usado no resto do MyBitcoin.
- **Backend**: Express + `better-sqlite3` (um arquivo só, sem serviço de
  banco separado), sessão por cookie httpOnly (sem biblioteca de sessão,
  token aleatório + tabela `sessions`).
- **Bitcoin**: fala direto com o RPC do `bitcoind` (regtest) — geração de
  contas de teste local via BIP39/BIP32 (`bitcoinjs-lib`), sem criar wallet
  nova no node.
- **Ethereum**: assinatura e envio **sempre no backend** (`ethers`), nunca
  no navegador — o frontend só manda endereço/valor. O RPC do Anvil nunca é
  acessado direto numa porta 8545: sempre através do proxy HTTPS do
  [`ethereum-local-explorer`](../ethereum/ethereum-local-explorer), com
  header `X-RPC-Token`.

## Funcionalidades

- **Conexões de node configuráveis**: o admin cadastra, edita, ativa e
  exclui múltiplas conexões salvas (BTC e ETH), trocando qual node está em
  uso sem reiniciar o container. Útil pra apontar pra um node de dev vs. um
  de staging, por exemplo.
- **Fallback de carteira ETH**: se a carteira mais antiga não tiver saldo
  suficiente pra um envio de usuário comum, o backend tenta automaticamente
  a próxima carteira cadastrada, sem o usuário perceber. Um alerta aparece
  no console admin quando alguma carteira está com saldo baixo (< 0.01 ETH),
  pedindo recarga via faucet.
- **Faucet ETH** (admin-only): credita saldo instantaneamente num endereço
  via `anvil_setBalance`, sem gastar de nenhuma carteira.
- **Recuperação de conta admin-assistida**: sem depender de e-mail, o admin
  gera uma senha temporária pra qualquer usuário na aba "Usuários" — some
  todas as sessões ativas dele, mostrado só uma vez na tela.
- **Admin fixo por variável de ambiente**: `ADMIN_EMAIL`/`ADMIN_PASSWORD`
  são sincronizados a cada boot do container — trocar a senha é só editar o
  `.env` e reiniciar, sem mexer no banco.

## Pré-requisitos

1. A stack `bitcoin` (repo irmão `../bitcoin`) precisa estar de pé, com a
   rede Docker `bitcoin_default` disponível:
   ```bash
   cd ../bitcoin && docker compose up -d
   ```
2. O proxy do [`ethereum-local-explorer`](../ethereum/ethereum-local-explorer)
   precisa estar acessível pela rede — por padrão isso é um domínio HTTPS
   externo (`ANVIL_RPC_URL`), não um serviço Docker local; não há rede
   Docker compartilhada com o Ethereum. Rodando local, `make up` nesse
   projeto expõe o proxy em `http://localhost:9000` (RPC em `/rpc`, token
   `local` por padrão).

## Configuração

Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

| Variável | Uso |
|---|---|
| `RPC_USER` / `RPC_PASSWORD` | Credenciais RPC do `bitcoin-node` (mesmas da stack `bitcoin`) |
| `WALLET_NAME` | Wallet auto-minerada do node, usada por `/api/btc/send` |
| `ANVIL_RPC_URL` | URL do proxy `/rpc` do `ethereum-local-explorer` (ex: `https://seu-dominio.exemplo.com/rpc`, ou `http://host.docker.internal:9000/rpc` local) |
| `ANVIL_RPC_TOKEN` | Header `X-RPC-Token` enviado em toda chamada ao Anvil (mesmo valor do `RPC_TOKEN` configurado no `ethereum-local-explorer`) |
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
histórico) ficam no volume `wallet-hub-data`, mapeado em `/data` —
sobrevivem a restart e recriação do container.

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

(Ajuste `RPC_HOST`/porta conforme como o `bitcoin-node` estiver exposto no
seu ambiente — dentro do Docker Compose ele é `bitcoin-node:18443`; rodando
solto localmente, depende de como você publicou a porta do container.)

## Rodando no Coolify

O Coolify sobe o `docker-compose.yml` do repositório direto, então o
processo é o de sempre — criar um recurso **Docker Compose** apontando pro
repo, configurar as env vars na UI do Coolify (mesmas da tabela acima) e
atribuir um domínio ao serviço `wallet-hub` (porta 3005).

Duas pegadinhas específicas desse projeto:

1. **A rede `bitcoin_default` precisa existir antes do deploy.** O compose
   declara essa rede como `external: true` — se o stack `bitcoin` não
   estiver rodando no mesmo host/Docker (Coolify ou não), o deploy falha na
   hora de subir o container. Suba o stack `bitcoin` primeiro, confirme que
   a rede existe (`docker network ls | grep bitcoin_default`), só depois
   faça o deploy do `wallet-hub`.
2. **`ANVIL_RPC_URL` precisa ser uma URL alcançável a partir do host do
   Coolify** — não tem rede Docker compartilhada com o Ethereum, é sempre
   HTTPS externo (o domínio público do `ethereum-local-explorer`, rota
   `/rpc`). Não use `localhost` nem endereço interno de outro stack.

O volume `wallet-hub-data` (SQLite com usuários, contas, histórico) precisa
ser um **volume persistente** no Coolify, não efêmero — senão todo deploy
novo apaga os dados.

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

## Fora de escopo

- Não desliga nem apaga `bitcoin/wallet-console` nem
  `ethereum/.../tx-sender` — ficam disponíveis até serem aposentados à parte.
- Sem mainnet/testnet: só regtest (BTC) e anvil/devnet (ETH) — essa
  ferramenta nunca deve mexer com fundos reais.
- Sem recuperação de senha por e-mail — é admin-assistida (senha temporária
  gerada na aba "Usuários").
- Limite diário é por calendário UTC (reseta à meia-noite UTC), não é janela
  rolante de 24h.
- Sem poller em background pra confirmar transações ETH pendentes: o status
  é reconsultado (via `eth_getTransactionReceipt`) só quando o envio
  acontece e quando `GET /api/eth/history` é chamado de novo — suficiente
  pro uso de teste, mas uma transação só fica "confirmado" na próxima vez
  que alguém olhar o histórico depois do bloco sair.
