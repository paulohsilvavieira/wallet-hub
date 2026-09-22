import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, Plus, TriangleAlert } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { WalletCard } from "@/components/eth/wallet-card"
import { getEthWallets, addEthWallet, importEthWalletsFromAnvil } from "@/services/api"
import { getErrorMessage } from "@/lib/api-errors"

// Abaixo disso, avisa o admin a recarregar via faucet — os envios do
// usuário comum já caem pra próxima carteira sozinhos, mas ainda assim vale
// avisar antes que todas as carteiras zerem.
const LOW_BALANCE_ETH = 0.01

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

  const lowBalanceWallets = (walletsQuery.data ?? []).filter(
    (w) => w.balanceEth !== null && Number(w.balanceEth) < LOW_BALANCE_ETH,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carteiras (ETH)</CardTitle>
        <CardDescription>Compartilhadas entre todos os usuários. A chave privada nunca sai do backend.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {lowBalanceWallets.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle className="flex items-center gap-1.5"><TriangleAlert className="size-4" /> Saldo baixo</AlertTitle>
            <AlertDescription>
              {lowBalanceWallets.map((w) => w.label).join(", ")} — abaixo de {LOW_BALANCE_ETH} ETH. Recarregue pelo faucet no card "Enviar ETH".
            </AlertDescription>
          </Alert>
        )}

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

        <div className="scroll-thin flex max-h-96 flex-col overflow-y-auto pr-4">
          {walletsQuery.data?.map((wallet) => (
            <WalletCard key={wallet.id} wallet={wallet} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
