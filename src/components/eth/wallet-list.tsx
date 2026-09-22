import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, Plus } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { WalletCard } from "@/components/eth/wallet-card"
import { getEthWallets, addEthWallet, importEthWalletsFromAnvil } from "@/services/api"
import { getErrorMessage } from "@/lib/api-errors"

export function WalletList() {
  const [label, setLabel] = useState("")
  const [privateKey, setPrivateKey] = useState("")
  const queryClient = useQueryClient()

  const walletsQuery = useQuery({ queryKey: ["eth-wallets"], queryFn: getEthWallets, refetchInterval: 15000 })

  const addMutation = useMutation({
    mutationFn: () => addEthWallet(label.trim(), privateKey.trim()),
    onSuccess: () => {
      setLabel("")
      setPrivateKey("")
      queryClient.invalidateQueries({ queryKey: ["eth-wallets"] })
    },
  })

  const importMutation = useMutation({
    mutationFn: importEthWalletsFromAnvil,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eth-wallets"] })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carteiras (ETH)</CardTitle>
        <CardDescription>Compartilhadas entre todos os usuários. A chave privada nunca sai do backend.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            addMutation.mutate()
          }}
        >
          <Input
            placeholder="Rótulo (opcional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="sm:max-w-40"
          />
          <Input
            placeholder="Chave privada (0x...)"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
          />
          <Button type="submit" disabled={addMutation.isPending || !privateKey.trim()}>
            <Plus /> Adicionar
          </Button>
        </form>

        <Button type="button" variant="outline" onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
          <Download /> Importar contas do Anvil
        </Button>

        {(addMutation.isError || importMutation.isError) && (
          <Alert variant="destructive">
            <AlertDescription>{getErrorMessage(addMutation.error || importMutation.error)}</AlertDescription>
          </Alert>
        )}

        {importMutation.isSuccess && importMutation.data.length === 0 && (
          <Alert>
            <AlertDescription>Nenhuma conta nova — todas as contas do Anvil já estavam cadastradas.</AlertDescription>
          </Alert>
        )}

        {walletsQuery.isLoading && <div className="text-sm text-muted-foreground">Carregando...</div>}
        {walletsQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>{getErrorMessage(walletsQuery.error)}</AlertDescription>
          </Alert>
        )}
        {walletsQuery.data && walletsQuery.data.length === 0 && (
          <div className="text-sm text-muted-foreground">Nenhuma carteira ainda — adicione uma acima ou importe do Anvil.</div>
        )}

        <div className="flex flex-col">
          {walletsQuery.data?.map((wallet) => (
            <WalletCard key={wallet.id} wallet={wallet} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
