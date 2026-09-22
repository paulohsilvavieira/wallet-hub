import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { Pencil, Plug, Plus, Trash2, X } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  getBtcConnections,
  createBtcConnection,
  updateBtcConnection,
  activateBtcConnection,
  deleteBtcConnection,
} from "@/services/api"
import { getErrorMessage } from "@/lib/api-errors"
import type { BtcConnection, BtcNetwork } from "@/types/connection"

const BTC_NETWORK: BtcNetwork = "regtest"

const connectionSchema = z.object({
  label: z.string().min(1, "Rótulo é obrigatório."),
  rpcHost: z.string().min(1, "Host é obrigatório."),
  rpcPort: z.coerce.number().int().positive("Porta precisa ser um número válido."),
  rpcUser: z.string().min(1, "Usuário é obrigatório."),
  rpcPassword: z.string().min(1, "Senha é obrigatória."),
  walletName: z.string().min(1, "Nome da wallet é obrigatório."),
})

const initialForm = {
  label: "",
  rpcHost: "",
  rpcPort: "18443",
  rpcUser: "",
  rpcPassword: "",
  walletName: "",
}

export function ConnectionManager() {
  const [form, setForm] = useState(initialForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const connectionsQuery = useQuery({ queryKey: ["btc-connections"], queryFn: getBtcConnections })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["btc-connections"] })
    queryClient.invalidateQueries({ queryKey: ["btc-wallets"] })
    queryClient.invalidateQueries({ queryKey: ["btc-accounts"] })
    queryClient.invalidateQueries({ queryKey: ["btc-history"] })
  }

  const createMutation = useMutation({
    mutationFn: createBtcConnection,
    onSuccess: () => {
      setForm(initialForm)
      invalidateAll()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (params: {
      id: string
      network: BtcNetwork
      label: string
      config: { rpcHost: string; rpcPort: number; rpcUser: string; rpcPassword: string; walletName: string }
    }) => updateBtcConnection(params.id, { network: params.network, label: params.label, config: params.config }),
    onSuccess: () => {
      setForm(initialForm)
      setEditingId(null)
      invalidateAll()
    },
  })

  const activateMutation = useMutation({
    mutationFn: activateBtcConnection,
    onSuccess: invalidateAll,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBtcConnection,
    onSuccess: invalidateAll,
  })

  const active = connectionsQuery.data?.find((c) => c.isActive)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const parsed = connectionSchema.safeParse(form)
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Dados inválidos.")
      return
    }

    const config = {
      rpcHost: parsed.data.rpcHost,
      rpcPort: parsed.data.rpcPort,
      rpcUser: parsed.data.rpcUser,
      rpcPassword: parsed.data.rpcPassword,
      walletName: parsed.data.walletName,
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, network: BTC_NETWORK, label: parsed.data.label, config })
    } else {
      createMutation.mutate({ network: BTC_NETWORK, label: parsed.data.label, config })
    }
  }

  function startEdit(conn: BtcConnection) {
    setFormError(null)
    setEditingId(conn.id)
    setForm({
      label: conn.label,
      rpcHost: conn.config.rpcHost,
      rpcPort: String(conn.config.rpcPort),
      rpcUser: conn.config.rpcUser,
      rpcPassword: conn.config.rpcPassword,
      walletName: conn.config.walletName,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(initialForm)
    setFormError(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Plug className="size-4" /> Conexão do node (BTC)</CardTitle>
        <CardDescription>Escolha qual node Bitcoin o Wallet Hub usa — troque sem reiniciar o container.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {active ? (
          <div className="flex items-center justify-between rounded-lg border border-input px-3 py-2.5">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{active.label}</span>
              <span className="text-xs text-muted-foreground">{active.config.rpcHost}:{active.config.rpcPort} — wallet {active.config.walletName}</span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Nenhuma conexão ativa.</div>
        )}

        <form className="flex flex-col gap-3 border-t border-border pt-4" onSubmit={handleSubmit}>
          <div className="text-sm font-medium">{editingId ? "Editando conexão" : "Nova conexão"}</div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="btc-conn-label">Rótulo</Label>
            <Input
              id="btc-conn-label"
              placeholder="Meu node de dev"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="btc-conn-host">Host RPC</Label>
              <Input
                id="btc-conn-host"
                placeholder="bitcoin-node"
                value={form.rpcHost}
                onChange={(e) => setForm((f) => ({ ...f, rpcHost: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="btc-conn-port">Porta</Label>
              <Input
                id="btc-conn-port"
                type="number"
                placeholder="18443"
                value={form.rpcPort}
                onChange={(e) => setForm((f) => ({ ...f, rpcPort: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="btc-conn-user">Usuário RPC</Label>
              <Input
                id="btc-conn-user"
                placeholder="admin"
                value={form.rpcUser}
                onChange={(e) => setForm((f) => ({ ...f, rpcUser: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="btc-conn-password">Senha RPC</Label>
              <Input
                id="btc-conn-password"
                type="password"
                placeholder={editingId ? "Deixe como está pra manter a senha atual" : undefined}
                value={form.rpcPassword}
                onChange={(e) => setForm((f) => ({ ...f, rpcPassword: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="btc-conn-wallet">Nome da wallet (usada em /send)</Label>
            <Input
              id="btc-conn-wallet"
              placeholder="bitcoin-wallet-regtest"
              value={form.walletName}
              onChange={(e) => setForm((f) => ({ ...f, walletName: e.target.value }))}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? <><Pencil /> Salvar alterações</> : <><Plus /> Adicionar conexão</>}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={cancelEdit}>
                <X /> Cancelar
              </Button>
            )}
          </div>

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          {(createMutation.isError || updateMutation.isError) && (
            <Alert variant="destructive">
              <AlertDescription>{getErrorMessage(createMutation.error || updateMutation.error)}</AlertDescription>
            </Alert>
          )}
        </form>

        {connectionsQuery.isLoading && <div className="text-sm text-muted-foreground">Carregando...</div>}
        {connectionsQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>{getErrorMessage(connectionsQuery.error)}</AlertDescription>
          </Alert>
        )}

        {(activateMutation.isError || deleteMutation.isError) && (
          <Alert variant="destructive">
            <AlertDescription>{getErrorMessage(activateMutation.error || deleteMutation.error)}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          {connectionsQuery.data?.map((conn) => (
            <div key={conn.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{conn.label}</span>
                  {conn.isActive && <Badge variant="secondary">ativa</Badge>}
                </div>
                <div className="truncate text-xs text-muted-foreground">{conn.config.rpcHost}:{conn.config.rpcPort}</div>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button size="xs" variant="outline" onClick={() => startEdit(conn)}>
                  <Pencil />
                </Button>
                {!conn.isActive && (
                  <>
                    <Button size="xs" onClick={() => activateMutation.mutate(conn.id)} disabled={activateMutation.isPending}>
                      Ativar
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => deleteMutation.mutate(conn.id)} disabled={deleteMutation.isPending}>
                      <Trash2 />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
