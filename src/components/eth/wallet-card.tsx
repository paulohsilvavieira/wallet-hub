import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, KeyRound, Pencil, ShieldOff, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { renameEthWallet, deleteEthWallet } from "@/services/api"
import { getErrorMessage } from "@/lib/api-errors"
import { formatEth } from "@/lib/utils"
import type { EthWallet } from "@/types/ethereum"

interface WalletCardProps {
  wallet: EthWallet
}

export function WalletCard({ wallet }: WalletCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [labelDraft, setLabelDraft] = useState(wallet.label)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const queryClient = useQueryClient()

  const renameMutation = useMutation({
    mutationFn: () => renameEthWallet(wallet.id, labelDraft.trim()),
    onSuccess: () => {
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ["eth-wallets"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteEthWallet(wallet.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eth-wallets"] })
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
              <div className="truncate text-sm font-medium">{wallet.label || "(sem rótulo)"}</div>
              <button
                type="button"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Editar nome"
                onClick={() => {
                  setLabelDraft(wallet.label)
                  setIsEditing(true)
                }}
              >
                <Pencil className="size-3" />
              </button>
              {wallet.hasPrivateKey ? (
                <Badge variant="outline" className="gap-1"><KeyRound className="size-3" /> com chave</Badge>
              ) : (
                <Badge variant="outline" className="gap-1"><ShieldOff className="size-3" /> sem chave (Anvil)</Badge>
              )}
            </div>
          )}
          <div className="truncate text-xs text-muted-foreground">{wallet.address}</div>
        </div>

        {wallet.balanceEth !== null && (
          <Badge variant={Number(wallet.balanceEth) > 0 ? "success" : "outline"} className="shrink-0">
            {formatEth(Number(wallet.balanceEth))} ETH
          </Badge>
        )}
      </div>

      {confirmingDelete ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Remover essa carteira da lista compartilhada?</span>
          <Button size="xs" variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
            Excluir
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setConfirmingDelete(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="outline" onClick={() => setConfirmingDelete(true)}>
            <Trash2 /> Excluir
          </Button>
        </div>
      )}

      {deleteMutation.isError && (
        <div className="text-xs text-destructive">{getErrorMessage(deleteMutation.error)}</div>
      )}
    </div>
  )
}
