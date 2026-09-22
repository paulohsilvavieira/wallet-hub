import axios from "axios"
import type {
  NodeWallet,
  LocalAccount,
  LocalAccountCreated,
  LocalAccountSecret,
  AccountBalance,
  SendResult,
  AuthUser,
} from "@/types/wallet"
import type { EthWallet, EthSendResult, FaucetResult } from "@/types/ethereum"
import type {
  BtcConnection,
  EthConnection,
  BtcConnectionConfig,
  EthConnectionConfig,
  BtcNetwork,
  EthNetwork,
} from "@/types/connection"
import { queryClient } from "@/lib/query-client"

const api = axios.create({ baseURL: "/api" })

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      queryClient.setQueryData(["me"], null)
    }
    return Promise.reject(error)
  },
)

// --- Autenticação ---

export async function getMe(): Promise<AuthUser> {
  const { data } = await api.get<{ user: AuthUser }>("/auth/me")
  return data.user
}

export async function signup(email: string, password: string): Promise<AuthUser> {
  const { data } = await api.post<{ user: AuthUser }>("/auth/signup", { email, password })
  return data.user
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const { data } = await api.post<{ user: AuthUser }>("/auth/login", { email, password })
  return data.user
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout")
}

// --- Usuários (admin-only) ---

export async function getUsers(): Promise<AuthUser[]> {
  const { data } = await api.get<AuthUser[]>("/admin/users")
  return data
}

export async function resetUserPassword(id: string): Promise<{ user: AuthUser; tempPassword: string }> {
  const { data } = await api.post<{ user: AuthUser; tempPassword: string }>(`/admin/users/${id}/reset-password`)
  return data
}

// --- Bitcoin ---

export async function getBtcWallets(): Promise<NodeWallet[]> {
  const { data } = await api.get<NodeWallet[]>("/btc/wallets")
  return data
}

export async function createBtcWallet(name: string): Promise<{ name: string; created: boolean }> {
  const { data } = await api.post("/btc/wallets", { name })
  return data
}

export async function sendBtc(params: {
  address: string
  amount: number
  feeRate?: number
}): Promise<SendResult> {
  const { data } = await api.post<SendResult>("/btc/send", params)
  return data
}

export async function getBtcHistory(): Promise<SendResult[]> {
  const { data } = await api.get<SendResult[]>("/btc/history")
  return data
}

export async function getBtcAccounts(): Promise<LocalAccount[]> {
  const { data } = await api.get<LocalAccount[]>("/btc/accounts")
  return data
}

export async function createBtcAccount(label: string): Promise<LocalAccountCreated> {
  const { data } = await api.post<LocalAccountCreated>("/btc/accounts", { label })
  return data
}

export async function renameBtcAccount(id: string, label: string): Promise<LocalAccount> {
  const { data } = await api.post<LocalAccount>(`/btc/accounts/${id}/rename`, { label })
  return data
}

export async function deleteBtcAccount(id: string): Promise<void> {
  await api.delete(`/btc/accounts/${id}`)
}

export async function revealBtcAccountSecret(id: string): Promise<LocalAccountSecret> {
  const { data } = await api.post<LocalAccountSecret>(`/btc/accounts/${id}/reveal`)
  return data
}

export async function getBtcAccountBalance(id: string): Promise<AccountBalance> {
  const { data } = await api.get<AccountBalance>(`/btc/accounts/${id}/balance`)
  return data
}

// --- Bitcoin: conexões de node (admin-only) ---

export async function getBtcConnections(): Promise<BtcConnection[]> {
  const { data } = await api.get<BtcConnection[]>("/btc/connections")
  return data
}

export async function createBtcConnection(params: {
  network: BtcNetwork
  label: string
  config: BtcConnectionConfig
}): Promise<BtcConnection> {
  const { data } = await api.post<BtcConnection>("/btc/connections", params)
  return data
}

export async function updateBtcConnection(
  id: string,
  params: { network: BtcNetwork; label: string; config: BtcConnectionConfig },
): Promise<BtcConnection> {
  const { data } = await api.put<BtcConnection>(`/btc/connections/${id}`, params)
  return data
}

export async function activateBtcConnection(id: string): Promise<BtcConnection> {
  const { data } = await api.post<BtcConnection>(`/btc/connections/${id}/activate`)
  return data
}

export async function deleteBtcConnection(id: string): Promise<void> {
  await api.delete(`/btc/connections/${id}`)
}

// --- Ethereum ---

export async function getEthWallets(): Promise<EthWallet[]> {
  const { data } = await api.get<EthWallet[]>("/eth/wallets")
  return data
}

export async function addEthWallet(label: string, privateKey: string): Promise<EthWallet> {
  const { data } = await api.post<EthWallet>("/eth/wallets", { label, privateKey })
  return data
}

export async function importEthWalletsFromAnvil(): Promise<EthWallet[]> {
  const { data } = await api.post<EthWallet[]>("/eth/wallets/import-anvil")
  return data
}

export async function renameEthWallet(id: string, label: string): Promise<EthWallet> {
  const { data } = await api.post<EthWallet>(`/eth/wallets/${id}/rename`, { label })
  return data
}

export async function deleteEthWallet(id: string): Promise<void> {
  await api.delete(`/eth/wallets/${id}`)
}

export async function ethFaucet(address: string, amountEth: number): Promise<FaucetResult> {
  const { data } = await api.post<FaucetResult>("/eth/faucet", { address, amountEth })
  return data
}

export async function sendEth(params: {
  walletId?: string
  address: string
  amountEth: number
}): Promise<EthSendResult> {
  const { data } = await api.post<EthSendResult>("/eth/send", params)
  return data
}

export async function getEthHistory(): Promise<EthSendResult[]> {
  const { data } = await api.get<EthSendResult[]>("/eth/history")
  return data
}

// --- Ethereum: conexões de node (admin-only) ---

export async function getEthConnections(): Promise<EthConnection[]> {
  const { data } = await api.get<EthConnection[]>("/eth/connections")
  return data
}

export async function createEthConnection(params: {
  network: EthNetwork
  label: string
  config: EthConnectionConfig
}): Promise<EthConnection> {
  const { data } = await api.post<EthConnection>("/eth/connections", params)
  return data
}

export async function updateEthConnection(
  id: string,
  params: { network: EthNetwork; label: string; config: EthConnectionConfig },
): Promise<EthConnection> {
  const { data } = await api.put<EthConnection>(`/eth/connections/${id}`, params)
  return data
}

export async function activateEthConnection(id: string): Promise<EthConnection> {
  const { data } = await api.post<EthConnection>(`/eth/connections/${id}/activate`)
  return data
}

export async function deleteEthConnection(id: string): Promise<void> {
  await api.delete(`/eth/connections/${id}`)
}
