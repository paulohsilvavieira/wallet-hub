import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Eye, Pencil, Send, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { getBtcAccountBalance, revealBtcAccountSecret, renameBtcAccount, deleteBtcAccount } from "@/services/api"
import { getErrorMessage } from "@/lib/api-errors"
import { formatBtc } from "@/lib/utils"
import type { LocalAccount } from "@/types/wallet"

interface AccountCardProps {
  account: LocalAccount
  onReceive: (address: string) => void
}

export function AccountCard({ account, onReceive }: AccountCardProps) {
  const [secret, setSecret] = useState<{ mnemonic: string; privateKeyWIF: string } | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [labelDraft, setLabelDraft] = useState(account.label)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const queryClient = useQueryClient()

  const balanceQuery = useQuery({
    queryKey: ["btc-account-balance", account.id],
    queryFn: () => getBtcAccountBalance(account.id),
    refetchInterval: 15000,
  })

  const revealMutation = useMutation({
    mutationFn: () => revealBtcAccountSecret(account.id),
    onSuccess: setSecret,
  })

  const renameMutation = useMutation({
    mutationFn: () => renameBtcAccount(account.id, labelDraft.trim()),
    onSuccess: () => {
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ["btc-accounts"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteBtcAccount(account.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["btc-accounts"] })
    },
  })

  return (
    <div className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <Input
                autoFocus
                className="h-7 text-sm"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") renameMutation.mutate()
                  if (e.key === "Escape") setIsEditing(false)
                }}
              />
              <Button size="icon-xs" variant="ghost" onClick={() => renameMutation.mutate()} disabled={renameMutation.isPending}>
                <Check />
              </Button>
              <Button size="icon-xs" variant="ghost" onClick={() => setIsEditing(false)}>
                <X />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="truncate text-sm font-medium">{account.label || "(sem rótulo)"}</div>
              <button
                type="button"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Editar nome"
                onClick={() => {
                  setLabelDraft(account.label)
                  setIsEditing(true)
                }}
              >
                <Pencil className="size-3" />
              </button>
            </div>
          )}
          <div className="truncate text-xs text-muted-foreground">{account.address}</div>
        </div>

        {balanceQuery.data && (
          <Badge variant={balanceQuery.data.confirmed > 0 ? "success" : "outline"} className="shrink-0">
            {formatBtc(balanceQuery.data.confirmed)} BTC
          </Badge>
        )}
      </div>

      {confirmingDelete ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Excluir essa conta? A chave não fica recuperável depois.</span>
          <Button size="xs" variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
            Excluir
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setConfirmingDelete(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="xs" onClick={() => onReceive(account.address)}>
            <Send /> Receber
          </Button>
          <Button size="xs" variant="outline" onClick={() => (secret ? setSecret(null) : revealMutation.mutate())}>
            <Eye /> {secret ? "Ocultar chave" : "Ver chave"}
          </Button>
          <Button size="xs" variant="outline" onClick={() => setConfirmingDelete(true)}>
            <Trash2 /> Excluir
          </Button>
        </div>
      )}

      {(revealMutation.isError || deleteMutation.isError) && (
        <div className="text-xs text-destructive">
          {getErrorMessage(revealMutation.error || deleteMutation.error)}
        </div>
      )}

      {secret && (
        <div className="flex flex-col gap-1 rounded-lg bg-muted p-2 text-xs break-all">
          <div><b>Seed:</b> {secret.mnemonic}</div>
          <div><b>WIF:</b> {secret.privateKeyWIF}</div>
        </div>
      )}
    </div>
  )
}
