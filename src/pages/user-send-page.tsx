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

interface UserSendPageProps {
  user: AuthUser
}

export function UserSendPage({ user }: UserSendPageProps) {
  const queryClient = useQueryClient()

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => queryClient.setQueryData(["me"], null),
  })

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6 md:p-10">
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

      <div className="grid gap-6 md:grid-cols-2">
        <BtcSimpleSendCard />
        <EthSimpleSendCard />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <BtcHistoryTable limit={5} title="Seus últimos envios (BTC)" />
        <EthHistoryTable limit={5} title="Seus últimos envios (ETH)" />
      </div>
    </div>
  )
}
