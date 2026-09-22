export interface WalletBalances {
  trusted: number
  untrusted_pending: number
  immature: number
}

export interface NodeWallet {
  name: string
  loaded: boolean
  balances: WalletBalances | null
}

export interface LocalAccount {
  id: string
  label: string
  address: string
  createdAt: string
}

export interface LocalAccountSecret {
  mnemonic: string
  privateKeyWIF: string
}

export type LocalAccountCreated = LocalAccount & LocalAccountSecret

export interface AccountBalance {
  confirmed: number
  utxoCount: number
}

export interface SendResult {
  txid: string
  fromWallet: string
  address: string
  amount: number
  userId: string | null
  at: string
}

export type UserRole = "admin" | "user"

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  createdAt: string
}
