import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { SimpleSendCard as BtcSimpleSendCard } from "@/components/btc/simple-send-card"
import { SimpleSendCard as EthSimpleSendCard } from "@/components/eth/simple-send-card"
import { HistoryTable as BtcHistoryTable } from "@/components/btc/history-table"
import { HistoryTable as EthHistoryTable } from "@/components/eth/history-table"
import { getInitialTheme } from "@/lib/theme"
import { logout } from "@/services/api"
import type { AuthUser } from "@/types/wallet"

import btcIcon from "@/assets/coins/btc.svg"
import ethIcon from "@/assets/coins/eth.svg"

interface UserSendPageProps {
  user: AuthUser
}

type Tab = "btc" | "eth"

export function UserSendPage({ user }: UserSendPageProps) {
  const [tab, setTab] = useState<Tab>("btc")
  const queryClient = useQueryClient()

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => queryClient.setQueryData(["me"], null),
  })

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 p-6 md:p-10">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold">Wallet Hub</h1>
          <p className="text-sm text-muted-foreground">Mande fundos de teste — regtest (BTC) e Anvil (ETH).</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
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
      </div>

      {tab === "btc" ? (
        <>
          <BtcSimpleSendCard />
          <BtcHistoryTable limit={5} title="Seus últimos envios (BTC)" />
        </>
      ) : (
        <>
          <EthSimpleSendCard />
          <EthHistoryTable limit={5} title="Seus últimos envios (ETH)" />
        </>
      )}
    </div>
  )
}
