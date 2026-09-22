import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AccountCard } from "@/components/btc/account-card"
import { getBtcAccounts, createBtcAccount } from "@/services/api"
import { getErrorMessage } from "@/lib/api-errors"
import type { LocalAccountCreated } from "@/types/wallet"

interface LocalAccountListProps {
  onReceive: (address: string) => void
}

export function LocalAccountList({ onReceive }: LocalAccountListProps) {
  const [label, setLabel] = useState("")
  const [justCreated, setJustCreated] = useState<LocalAccountCreated | null>(null)
  const queryClient = useQueryClient()

  const accountsQuery = useQuery({ queryKey: ["btc-accounts"], queryFn: getBtcAccounts })

  const createMutation = useMutation({
    mutationFn: () => createBtcAccount(label.trim()),
    onSuccess: (account) => {
      setLabel("")
      setJustCreated(account)
      queryClient.invalidateQueries({ queryKey: ["btc-accounts"] })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contas de teste (BTC)</CardTitle>
        <CardDescription>Endereço + chave privada gerados aqui mesmo, sem criar wallet no node.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate()
          }}
        >
          <Input
            placeholder="Rótulo (opcional), ex: cold-storage"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button type="submit" disabled={createMutation.isPending}>
            <Plus /> Nova
          </Button>
        </form>

        {createMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>{getErrorMessage(createMutation.error)}</AlertDescription>
          </Alert>
        )}

        {justCreated && (
          <Alert>
            <AlertTitle>Conta criada! Guarde essa chave agora — não é recuperável depois.</AlertTitle>
            <AlertDescription className="flex flex-col gap-1 break-all">
              <div><b>Endereço:</b> {justCreated.address}</div>
              <div><b>Seed (12 palavras):</b> {justCreated.mnemonic}</div>
              <div><b>Chave privada (WIF):</b> {justCreated.privateKeyWIF}</div>
            </AlertDescription>
          </Alert>
        )}

        {accountsQuery.isLoading && <div className="text-sm text-muted-foreground">Carregando...</div>}
        {accountsQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>{getErrorMessage(accountsQuery.error)}</AlertDescription>
          </Alert>
        )}
        {accountsQuery.data && accountsQuery.data.length === 0 && (
          <div className="text-sm text-muted-foreground">Nenhuma conta ainda — crie uma acima.</div>
        )}

        <div className="scroll-thin flex max-h-96 flex-col overflow-y-auto pr-4">
          {accountsQuery.data?.map((account) => (
            <AccountCard key={account.id} account={account} onReceive={onReceive} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
