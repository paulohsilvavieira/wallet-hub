export interface EthWallet {
  id: string
  label: string
  address: string
  createdAt: string
  hasPrivateKey: boolean
  balanceWei: string | null
  balanceEth: string | null
}

export type EthSendStatus = "pending" | "confirmed" | "failed"

export interface EthSendResult {
  hash: string
  walletId: string | null
  fromAddress: string
  toAddress: string
  valueWei: string
  amountEth: number
  status: EthSendStatus
  blockNumber: number | null
  gasUsed: string | null
  error: string | null
  userId: string | null
  createdAt: string
  updatedAt: string
}

export interface FaucetResult {
  address: string
  newBalanceWei: string
  newBalanceEth: string
}
