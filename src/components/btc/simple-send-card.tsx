import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { Send as SendIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getBtcHistory, sendBtc } from "@/services/api"
import { getErrorMessage } from "@/lib/api-errors"
import { formatBtc } from "@/lib/utils"
import btcIcon from "@/assets/coins/btc.svg"

const DAILY_LIMIT_BTC = 3

const sendSchema = z.object({
  address: z.string().min(1, "Endereço é obrigatório."),
  amount: z.coerce.number().positive("Valor precisa ser maior que zero."),
})

// Visão simplificada (usuário comum): só endereço + valor, sem escolha de
// carteira de origem. O limite de 3 BTC/dia por endereço de destino é
// validado no backend somando todos os usuários — o badge aqui mostra só o
// que a própria conta já mandou hoje pra esse endereço, como referência.
export function SimpleSendCard() {
  const [address, setAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const historyQuery = useQuery({ queryKey: ["btc-history"], queryFn: getBtcHistory, refetchInterval: 10000 })

  const sentTodayByMe = useMemo(() => {
    if (!address || !historyQuery.data) return 0
    const today = new Date().toISOString().slice(0, 10)
    return historyQuery.data
      .filter((item) => item.address === address && item.at.slice(0, 10) === today)
      .reduce((sum, item) => sum + item.amount, 0)
  }, [address, historyQuery.data])

  const sendMutation = useMutation({
    mutationFn: sendBtc,
    onSuccess: () => {
      setAmount("")
      queryClient.invalidateQueries({ queryKey: ["btc-history"] })
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const parsed = sendSchema.safeParse({ address, amount })
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Dados inválidos.")
      return
    }

    sendMutation.mutate({ address: parsed.data.address, amount: parsed.data.amount })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><img src={btcIcon} alt="" className="size-4" /> Enviar BTC</CardTitle>
        <CardDescription>Regtest — limite de {DAILY_LIMIT_BTC} BTC por dia, por endereço de destino.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="btc-address">Endereço de destino</Label>
            <Input id="btc-address" placeholder="bcrt1q..." value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="btc-amount">Valor (BTC)</Label>
            <Input id="btc-amount" type="number" step="0.00000001" min="0" placeholder="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>

          {address && (
            <Badge variant={sentTodayByMe > 0 ? "secondary" : "outline"} className="w-fit">
              Você já enviou {formatBtc(sentTodayByMe)} / {DAILY_LIMIT_BTC} BTC hoje pra esse endereço
            </Badge>
          )}

          <Button type="submit" disabled={sendMutation.isPending}>
            <SendIcon /> Enviar
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
