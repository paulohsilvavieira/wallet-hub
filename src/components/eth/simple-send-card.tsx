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
import { getEthHistory, sendEth } from "@/services/api"
import { getErrorMessage } from "@/lib/api-errors"
import { formatEth } from "@/lib/utils"
import ethIcon from "@/assets/coins/eth.svg"

const DAILY_LIMIT_ETH = 3

const sendSchema = z.object({
  address: z.string().min(1, "Endereço é obrigatório."),
  amountEth: z.coerce.number().positive("Valor precisa ser maior que zero."),
})

// Visão simplificada (usuário comum): só endereço + valor. O backend usa a
// primeira carteira ETH cadastrada pelo admin como origem e valida o
// limite de 3 ETH/dia por endereço de destino somando todos os usuários.
export function SimpleSendCard() {
  const [address, setAddress] = useState("")
  const [amountEth, setAmountEth] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const historyQuery = useQuery({ queryKey: ["eth-history"], queryFn: getEthHistory, refetchInterval: 10000 })

  const sentTodayByMe = useMemo(() => {
    if (!address || !historyQuery.data) return 0
    const today = new Date().toISOString().slice(0, 10)
    return historyQuery.data
      .filter((item) => item.toAddress.toLowerCase() === address.toLowerCase() && item.createdAt.slice(0, 10) === today)
      .reduce((sum, item) => sum + item.amountEth, 0)
  }, [address, historyQuery.data])

  const sendMutation = useMutation({
    mutationFn: sendEth,
    onSuccess: () => {
      setAmountEth("")
      queryClient.invalidateQueries({ queryKey: ["eth-history"] })
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const parsed = sendSchema.safeParse({ address, amountEth })
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Dados inválidos.")
      return
    }

    sendMutation.mutate({ address: parsed.data.address, amountEth: parsed.data.amountEth })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><img src={ethIcon} alt="" className="size-4" /> Enviar ETH</CardTitle>
        <CardDescription>Anvil — limite de {DAILY_LIMIT_ETH} ETH por dia, por endereço de destino.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="eth-simple-address">Endereço de destino</Label>
            <Input id="eth-simple-address" placeholder="0x..." value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="eth-simple-amount">Valor (ETH)</Label>
            <Input id="eth-simple-amount" type="number" step="0.000001" min="0" placeholder="0.01" value={amountEth} onChange={(e) => setAmountEth(e.target.value)} />
          </div>

          {address && (
            <Badge variant={sentTodayByMe > 0 ? "secondary" : "outline"} className="w-fit">
              Você já enviou {formatEth(sentTodayByMe)} / {DAILY_LIMIT_ETH} ETH hoje pra esse endereço
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
                Enviado! Hash: {sendMutation.data.hash} ({sendMutation.data.status})
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
