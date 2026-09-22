import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { Send as SendIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getEthWallets, sendEth } from "@/services/api"
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
  const queryClient = useQueryClient()

  useEffect(() => {
    if (presetAddress) setAddress(presetAddress)
  }, [presetAddress])

  const walletsQuery = useQuery({ queryKey: ["eth-wallets"], queryFn: getEthWallets, refetchInterval: 15000 })
  const wallets = walletsQuery.data ?? []
  const selectedWallet = wallets.find((w) => w.id === walletId)

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
            <select
              id="eth-from"
              className="h-[38px] w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
            >
              <option value="" disabled>Selecione...</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>{w.label} — {w.address.slice(0, 10)}…</option>
              ))}
            </select>
            {selectedWallet?.balanceEth !== undefined && selectedWallet?.balanceEth !== null && (
              <Badge variant="success" className="w-fit">{formatEth(Number(selectedWallet.balanceEth))} ETH</Badge>
            )}
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
      </CardContent>
    </Card>
  )
}
