import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { Droplets, Send as SendIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { WalletSelect } from "@/components/eth/wallet-select"
import { getEthWallets, sendEth, ethFaucet } from "@/services/api"
import { getErrorMessage } from "@/lib/api-errors"
import { formatEth } from "@/lib/utils"

const sendSchema = z.object({
  walletId: z.string().min(1, "Selecione a carteira de origem."),
  address: z.string().min(1, "Endereço é obrigatório."),
  amountEth: z.coerce.number().positive("Valor precisa ser maior que zero."),
})

interface SendFormProps {
  presetAddress: string
}

export function SendForm({ presetAddress }: SendFormProps) {
  const [walletId, setWalletId] = useState("")
  const [address, setAddress] = useState("")
  const [amountEth, setAmountEth] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [faucetAddress, setFaucetAddress] = useState("")
  const [faucetAmount, setFaucetAmount] = useState("10")
  const queryClient = useQueryClient()

  useEffect(() => {
    if (presetAddress) setAddress(presetAddress)
  }, [presetAddress])

  const walletsQuery = useQuery({ queryKey: ["eth-wallets"], queryFn: getEthWallets, refetchInterval: 15000 })
  const wallets = walletsQuery.data ?? []

  useEffect(() => {
    if (!walletId && wallets.length > 0) {
      setWalletId(wallets[0].id)
    }
  }, [walletId, wallets])

  const sendMutation = useMutation({
    mutationFn: sendEth,
    onSuccess: () => {
      setAmountEth("")
      queryClient.invalidateQueries({ queryKey: ["eth-wallets"] })
      queryClient.invalidateQueries({ queryKey: ["eth-history"] })
    },
  })

  const faucetMutation = useMutation({
    mutationFn: () => ethFaucet(faucetAddress.trim(), Number(faucetAmount)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eth-wallets"] })
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const parsed = sendSchema.safeParse({ walletId, address, amountEth })
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Dados inválidos.")
      return
    }

    sendMutation.mutate({
      walletId: parsed.data.walletId,
      address: parsed.data.address,
      amountEth: parsed.data.amountEth,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enviar ETH</CardTitle>
        <CardDescription>Assinado no backend com a chave da carteira escolhida (ou via eth_sendTransaction, se ela não tiver chave salva).</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="eth-from">Carteira de origem</Label>
            <WalletSelect wallets={wallets} value={walletId} onChange={setWalletId} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="eth-address">Endereço de destino</Label>
            <Input id="eth-address" placeholder="0x..." value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="eth-amount">Valor (ETH)</Label>
            <Input id="eth-amount" type="number" step="0.000001" min="0" placeholder="0.01" value={amountEth} onChange={(e) => setAmountEth(e.target.value)} />
          </div>

          <Button type="submit" disabled={sendMutation.isPending}>
            <SendIcon /> Enviar transação
          </Button>

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          {sendMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>{getErrorMessage(sendMutation.error)}</AlertDescription>
            </Alert>
          )}

          {sendMutation.isSuccess && (
            <Alert>
              <AlertDescription className="break-all">
                Enviado! Hash: {sendMutation.data.hash} ({sendMutation.data.status})
              </AlertDescription>
            </Alert>
          )}
        </form>

        <div className="mt-4 border-t border-border pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Droplets className="size-4" /> Faucet — creditar saldo direto num endereço
          </div>

          <form
            className="mt-3 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              faucetMutation.mutate()
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="faucet-address">Endereço</Label>
              <Input
                id="faucet-address"
                placeholder="0x..."
                value={faucetAddress}
                onChange={(e) => setFaucetAddress(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="faucet-amount">Valor (ETH)</Label>
              <Input
                id="faucet-amount"
                type="number"
                step="0.01"
                min="0"
                value={faucetAmount}
                onChange={(e) => setFaucetAmount(e.target.value)}
              />
            </div>

            <Button type="submit" variant="outline" disabled={faucetMutation.isPending || !faucetAddress.trim()}>
              <Droplets /> Creditar
            </Button>

            {faucetMutation.isError && (
              <Alert variant="destructive">
                <AlertDescription>{getErrorMessage(faucetMutation.error)}</AlertDescription>
              </Alert>
            )}

            {faucetMutation.isSuccess && (
              <Alert>
                <AlertDescription>
                  Novo saldo de {faucetMutation.data.address}: {formatEth(Number(faucetMutation.data.newBalanceEth))} ETH
                </AlertDescription>
              </Alert>
            )}
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
