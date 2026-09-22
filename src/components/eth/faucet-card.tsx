import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Droplets } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ethFaucet } from "@/services/api"
import { getErrorMessage } from "@/lib/api-errors"
import { formatEth } from "@/lib/utils"

// Faucet admin-only: credita saldo instantaneamente via anvil_setBalance,
// sem gastar de nenhuma conta nem depender de assinatura.
export function FaucetCard() {
  const [address, setAddress] = useState("")
  const [amountEth, setAmountEth] = useState("10")

  const faucetMutation = useMutation({
    mutationFn: () => ethFaucet(address.trim(), Number(amountEth)),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Droplets className="size-4" /> Faucet (ETH)</CardTitle>
        <CardDescription>Credita saldo instantaneamente num endereço, via anvil_setBalance.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            faucetMutation.mutate()
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="faucet-address">Endereço</Label>
            <Input id="faucet-address" placeholder="0x..." value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="faucet-amount">Valor (ETH)</Label>
            <Input id="faucet-amount" type="number" step="0.01" min="0" value={amountEth} onChange={(e) => setAmountEth(e.target.value)} />
          </div>

          <Button type="submit" disabled={faucetMutation.isPending || !address.trim()}>
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
      </CardContent>
    </Card>
  )
}
