// O wallet-hub só alimenta saldo de teste nas carteiras do mybitcoin —
// mainnet/testnet rodam em infra fora do controle desse app, por isso só um
// valor de rede é aceito por chain.
export type BtcNetwork = "regtest"
export type EthNetwork = "anvil"

export interface BtcConnectionConfig {
  rpcHost: string
  rpcPort: number
  rpcUser: string
  rpcPassword: string
  walletName: string
}

export interface EthConnectionConfig {
  rpcUrl: string
  rpcToken: string
}

export interface NodeConnection<TNetwork extends string, TConfig> {
  id: string
  chain: "btc" | "eth"
  network: TNetwork
  label: string
  config: TConfig
  isActive: boolean
  createdAt: string
}

export type BtcConnection = NodeConnection<BtcNetwork, BtcConnectionConfig>
export type EthConnection = NodeConnection<EthNetwork, EthConnectionConfig>
