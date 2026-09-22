import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ExternalLink, LogOut, Users } from "lucide-react"

import btcIcon from "@/assets/coins/btc.svg"
import ethIcon from "@/assets/coins/eth.svg"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button, buttonVariantClasses } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { LocalAccountList } from "@/components/btc/local-account-list"
import { SendForm as BtcSendForm } from "@/components/btc/send-form"
import { HistoryTable as BtcHistoryTable } from "@/components/btc/history-table"
import { ConnectionManager as BtcConnectionManager } from "@/components/btc/connection-manager"
import { WalletList as EthWalletList } from "@/components/eth/wallet-list"
import { SendForm as EthSendForm } from "@/components/eth/send-form"
import { HistoryTable as EthHistoryTable } from "@/components/eth/history-table"
import { ConnectionManager as EthConnectionManager } from "@/components/eth/connection-manager"
import { UsersManager } from "@/components/admin/users-manager"
import { getInitialTheme } from "@/lib/theme"
import { EXPLORER_BASE_URL, ETH_EXPLORER_BASE_URL } from "@/lib/config"
import { logout } from "@/services/api"
import type { AuthUser } from "@/types/wallet"

interface AdminConsolePageProps {
  user: AuthUser
}

type Tab = "btc" | "eth" | "users"

export function AdminConsolePage({ user }: AdminConsolePageProps) {
  const [tab, setTab] = useState<Tab>("btc")
  const [btcDestination, setBtcDestination] = useState("")
  const queryClient = useQueryClient()

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => queryClient.setQueryData(["me"], null),
  })

  const explorerUrl = tab === "eth" ? ETH_EXPLORER_BASE_URL : EXPLORER_BASE_URL

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 p-6 md:p-10">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold">Wallet Hub — Console admin</h1>
          <p className="text-sm text-muted-foreground">Bitcoin regtest + Ethereum/Anvil — gerencie contas de teste e mande fundos.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium [&_svg]:size-4",
              buttonVariantClasses.outline,
            )}
          >
            <ExternalLink /> Abrir explorer
          </a>
          <ThemeToggle initialTheme={getInitialTheme()} />
          <Button variant="outline" size="icon" aria-label="Sair" onClick={() => logoutMutation.mutate()}>
            <LogOut />
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === "btc" ? "default" : "outline"} onClick={() => setTab("btc")}>
          <img src={btcIcon} alt="" className="size-4" /> Bitcoin
        </Button>
        <Button variant={tab === "eth" ? "default" : "outline"} onClick={() => setTab("eth")}>
          <img src={ethIcon} alt="" className="size-4" /> Ethereum
        </Button>
        <Button variant={tab === "users" ? "default" : "outline"} onClick={() => setTab("users")}><Users /> Usuários</Button>
      </div>

      {tab === "users" && <UsersManager />}

      {tab === "btc" && (
        <>
          <Alert>
            <AlertDescription className="flex flex-col gap-1.5">
              <span><b>1.</b> Crie uma conta de teste — gera um endereço + chave privada aqui mesmo.</span>
              <span><b>2.</b> Mande fundos de teste pra ela — sai da carteira do node e confirma na hora.</span>
              <span>Use esse endereço pra testar observabilidade, ou simule hot→cold mandando pra uma segunda conta.</span>
            </AlertDescription>
          </Alert>

          <div className="grid gap-6 md:grid-cols-2">
            <BtcSendForm presetAddress={btcDestination} />
            <LocalAccountList onReceive={setBtcDestination} />
          </div>

          <BtcHistoryTable />

          <BtcConnectionManager />
        </>
      )}

      {tab === "eth" && (
        <>
          <Alert>
            <AlertDescription className="flex flex-col gap-1.5">
              <span><b>1.</b> Cadastre carteiras — cole uma chave privada ou importe as contas padrão do Anvil.</span>
              <span><b>2.</b> Mande ETH de teste — assinado no backend, nunca no navegador.</span>
              <span>Sem saldo? Use o faucet abaixo pra creditar uma carteira instantaneamente.</span>
            </AlertDescription>
          </Alert>

          <div className="grid gap-6 md:grid-cols-2">
            <EthSendForm presetAddress="" />
            <EthWalletList />
          </div>

          <EthHistoryTable />

          <EthConnectionManager />
        </>
      )}
    </div>
  )
}
