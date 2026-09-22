import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { Send as SendIcon, Wallet } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getBtcWallets, sendBtc } from "@/services/api"
import { getErrorMessage } from "@/lib/api-errors"
import { formatBtc } from "@/lib/utils"

const sendSchema = z.object({
  address: z.string().min(1, "Endereço é obrigatório."),
  amount: z.coerce.number().positive("Valor precisa ser maior que zero."),
  feeRate: z.coerce.number().positive().optional().or(z.literal("")),
})

interface SendFormProps {
  presetAddress: string
}

// A carteira de origem é sempre a wallet auto-minerada do node (server/bitcoin/routes.js,
// WALLET_NAME) — não é mais escolhida aqui, só exibida com o saldo pra referência.
export function SendForm({ presetAddress }: SendFormProps) {
  const [address, setAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [feeRate, setFeeRate] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (presetAddress) setAddress(presetAddress)
  }, [presetAddress])

  const walletsQuery = useQuery({ queryKey: ["btc-wallets"], queryFn: getBtcWallets, refetchInterval: 15000 })
  const sourceWallet = walletsQuery.data?.find((w) => w.loaded) ?? walletsQuery.data?.[0]

  const sendMutation = useMutation({
    mutationFn: sendBtc,
    onSuccess: () => {
      setAmount("")
      setFeeRate("")
      queryClient.invalidateQueries({ queryKey: ["btc-wallets"] })
      queryClient.invalidateQueries({ queryKey: ["btc-accounts"] })
      queryClient.invalidateQueries({ queryKey: ["btc-account-balance"] })
      queryClient.invalidateQueries({ queryKey: ["btc-history"] })
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const parsed = sendSchema.safeParse({ address, amount, feeRate })
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Dados inválidos.")
      return
    }

    sendMutation.mutate({
      address: parsed.data.address,
      amount: parsed.data.amount,
      feeRate: parsed.data.feeRate ? Number(parsed.data.feeRate) : undefined,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enviar BTC</CardTitle>
        <CardDescription>Sai da carteira do node (fonte de fundos) pro endereço que você escolher.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label>Carteira de origem</Label>
            <div className="flex h-[38px] items-center justify-between rounded-lg border border-input px-3 text-sm">
              <span>{sourceWallet?.name || "Carregando..."}</span>
              {sourceWallet?.balances && (
                <Badge variant="success">
                  <Wallet /> {formatBtc(sourceWallet.balances.trusted)} BTC
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="address">Endereço de destino</Label>
            <Input id="address" placeholder="bcrt1q..." value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">Valor (BTC)</Label>
              <Input id="amount" type="number" step="0.00000001" min="0" placeholder="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="fee-rate">Fee rate (sat/vB)</Label>
              <Input id="fee-rate" type="number" step="1" min="1" placeholder="default: 2" value={feeRate} onChange={(e) => setFeeRate(e.target.value)} />
            </div>
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
                Enviado e confirmado! Txid: {sendMutation.data.txid}
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
