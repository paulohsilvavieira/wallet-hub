# Wallet Hub

Backend + frontend únicos para duas ferramentas de teste que antes eram separadas:
**Bitcoin regtest** (antigo `bitcoin/wallet-console`) e **Ethereum/Anvil** (antigo
`ethereum/.../tx-sender`). Um só login, dois níveis de acesso:

- **Admin**: console completo — gestão de carteiras do node/Anvil, contas de teste
  BTC e ETH, histórico completo, faucet ETH. Sem limite de envio.
- **Usuário comum** (cadastro aberto): tela simplificada com dois cards —
  "Enviar BTC" e "Enviar ETH", só endereço + valor. Limitado a **3 BTC/dia** e
  **3 ETH/dia por endereço de destino** (soma de todos os usuários, reseta à
  meia-noite UTC).

Stack: React 19 + Vite 6 + TypeScript + Tailwind v4 no frontend; Express +
better-sqlite3 no backend, com auth por sessão (cookie httpOnly). Módulo
Bitcoin fala direto com o RPC do `bitcoind` (regtest). Módulo Ethereum assina
e envia transações **no backend** (`ethers`), falando com o Anvil só através
do proxy HTTPS do `ethereum-local-explorer` — nunca porta 8545 exposta.

## Pré-requisitos

1. A stack `bitcoin` (repo irmão `../bitcoin`) precisa estar de pé, com a rede
   Docker `bitcoin_default` disponível (`docker compose up -d` nela primeiro).
2. O proxy do `ethereum-local-explorer` precisa estar acessível pela rede —
   por padrão isso é um domínio HTTPS externo (`ANVIL_RPC_URL`), não um
   serviço Docker local; não há rede Docker compartilhada com o Ethereum.

## Configuração

Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

Variáveis principais:

| Variável | Uso |
|---|---|
| `RPC_USER` / `RPC_PASSWORD` | Credenciais RPC do `bitcoin-node` (mesmas da stack `bitcoin`) |
| `WALLET_NAME` | Wallet auto-minerada do node, usada por `/api/btc/send` |
| `ANVIL_RPC_URL` | URL do proxy `/rpc` do `ethereum-local-explorer` (ex: `https://eth.explorer.mybitcoin.ptechsistemas.com/rpc`) |
| `ANVIL_RPC_TOKEN` | Header `X-RPC-Token` enviado em toda chamada ao Anvil |
| `VITE_EXPLORER_URL` / `VITE_ETH_EXPLORER_URL` | Links "abrir explorer" no frontend (build-time) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Se setados e ainda não existir nenhum admin, cria/promove esse usuário no boot (idempotente) |

Cadastro de admin é **fechado**: a única forma de existir um admin é essas
duas env vars no boot do container — não tem rota HTTP pra promover usuário.
Cadastro de usuário comum continua **aberto** (tela de login → "Cadastre-se").

## Rodando

```bash
docker compose build wallet-hub
docker compose up -d
```

Abra `http://localhost:3005`. Sem cookie de sessão → tela de login. Com
`ADMIN_EMAIL`/`ADMIN_PASSWORD` setados, logue com essas credenciais pra ver o
console completo (abas Bitcoin/Ethereum). Qualquer outra conta criada por
self-signup entra como usuário comum, e vê só os dois cards de envio.

Dados (usuários, sessões, contas de teste, carteiras ETH, histórico) ficam no
volume `wallet-hub-data`, mapeado em `/data` — sobrevivem a restart do
container.

### Desenvolvimento local (sem Docker)

```bash
# backend
cd server && npm install && npm start   # porta 3005 (ou $PORT)

# frontend (outro terminal)
npm install && npm run dev              # porta 5173, com proxy /api -> :3005
```

## Estrutura

```
server/
  auth.js, db.js, index.js, middleware.js   # sessão, SQLite, boot do admin
  bitcoin/    # portado quase sem alteração do wallet-console
    walletRpc.js, localWallet.js, history.js, routes.js
  ethereum/   # novo
    provider.js, anvilRpc.js, wallets.js, history.js, routes.js
src/
  components/ui/*       # design system (Alert, Button, Card, Input, Table, ...)
  components/btc/*      # send-form, local-account-list, account-card, history-table, simple-send-card
  components/eth/*      # send-form, wallet-list, wallet-card, faucet-card, history-table, simple-send-card
  pages/
    login-page.tsx
    admin-console-page.tsx   # abas Bitcoin/Ethereum (renomeado de wallet-page.tsx)
    user-send-page.tsx       # visão simplificada do usuário comum
```

## Fora de escopo

- Não desliga nem apaga `bitcoin/wallet-console` nem
  `ethereum/.../tx-sender` — ficam disponíveis até serem aposentados à parte.
- Sem recuperação de senha, sem UI de promoção de usuário a admin.
- Limite diário é por calendário UTC (reseta à meia-noite UTC), não é janela
  rolante de 24h.
- Sem poller em background pra confirmar transações ETH pendentes: o status é
  reconsultado (via `eth_getTransactionReceipt`) só quando o envio acontece e
  quando `GET /api/eth/history` é chamado de novo — suficiente pro uso de
  teste, mas uma transação só fica "confirmed" na próxima vez que alguém olhar
  o histórico depois do bloco sair.
