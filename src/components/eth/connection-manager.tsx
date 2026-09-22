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
  getEthConnections,
  createEthConnection,
  updateEthConnection,
  activateEthConnection,
  deleteEthConnection,
} from "@/services/api"
import { getErrorMessage } from "@/lib/api-errors"
import type { EthConnection, EthNetwork } from "@/types/connection"

const ETH_NETWORK: EthNetwork = "anvil"

const connectionSchema = z.object({
  label: z.string().min(1, "Rótulo é obrigatório."),
  rpcUrl: z.string().min(1, "URL do RPC é obrigatória."),
  rpcToken: z.string().optional(),
})

const initialForm = {
  label: "",
  rpcUrl: "",
  rpcToken: "",
}

export function ConnectionManager() {
  const [form, setForm] = useState(initialForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const connectionsQuery = useQuery({ queryKey: ["eth-connections"], queryFn: getEthConnections })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["eth-connections"] })
    queryClient.invalidateQueries({ queryKey: ["eth-wallets"] })
    queryClient.invalidateQueries({ queryKey: ["eth-history"] })
  }

  const createMutation = useMutation({
    mutationFn: createEthConnection,
    onSuccess: () => {
      setForm(initialForm)
      invalidateAll()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (params: { id: string; network: EthNetwork; label: string; config: { rpcUrl: string; rpcToken: string } }) =>
      updateEthConnection(params.id, { network: params.network, label: params.label, config: params.config }),
    onSuccess: () => {
      setForm(initialForm)
      setEditingId(null)
      invalidateAll()
    },
  })

  const activateMutation = useMutation({
    mutationFn: activateEthConnection,
    onSuccess: invalidateAll,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEthConnection,
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

    const config = { rpcUrl: parsed.data.rpcUrl, rpcToken: parsed.data.rpcToken || "" }

    if (editingId) {
      updateMutation.mutate({ id: editingId, network: ETH_NETWORK, label: parsed.data.label, config })
    } else {
      createMutation.mutate({ network: ETH_NETWORK, label: parsed.data.label, config })
    }
  }

  function startEdit(conn: EthConnection) {
    setFormError(null)
    setEditingId(conn.id)
    setForm({
      label: conn.label,
      rpcUrl: conn.config.rpcUrl,
      rpcToken: conn.config.rpcToken || "",
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
        <CardTitle className="flex items-center gap-2"><Plug className="size-4" /> Conexão do node (ETH)</CardTitle>
        <CardDescription>Escolha qual RPC Ethereum o Wallet Hub usa — troque sem reiniciar o container.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {active ? (
          <div className="flex items-center justify-between rounded-lg border border-input px-3 py-2.5">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{active.label}</span>
              <span className="text-xs text-muted-foreground">{active.config.rpcUrl}</span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Nenhuma conexão ativa.</div>
        )}

        <form className="flex flex-col gap-3 border-t border-border pt-4" onSubmit={handleSubmit}>
          <div className="text-sm font-medium">{editingId ? "Editando conexão" : "Nova conexão"}</div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="eth-conn-label">Rótulo</Label>
            <Input
              id="eth-conn-label"
              placeholder="Meu Anvil de dev"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="eth-conn-url">URL do RPC</Label>
            <Input
              id="eth-conn-url"
              placeholder="http://host.docker.internal:9000/rpc"
              value={form.rpcUrl}
              onChange={(e) => setForm((f) => ({ ...f, rpcUrl: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="eth-conn-token">Token do RPC (opcional)</Label>
            <Input
              id="eth-conn-token"
              placeholder={editingId ? "Deixe como está pra manter o token atual" : "deixe vazio se o RPC não exigir header de auth"}
              value={form.rpcToken}
              onChange={(e) => setForm((f) => ({ ...f, rpcToken: e.target.value }))}
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
                <div className="truncate text-xs text-muted-foreground">{conn.config.rpcUrl}</div>
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
