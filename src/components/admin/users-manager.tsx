import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRound, Users } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getUsers, resetUserPassword } from "@/services/api"
import { getErrorMessage } from "@/lib/api-errors"

// Recuperação de conta admin-assistida: sem infra de e-mail, o admin gera
// uma senha temporária aqui e repassa pro usuário por fora (chat,
// presencial etc). A senha só aparece uma vez, na hora — nunca fica salva
// em texto puro nem é reexibida depois.
export function UsersManager() {
  const [revealed, setRevealed] = useState<{ email: string; tempPassword: string } | null>(null)
  const queryClient = useQueryClient()

  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: getUsers })

  const resetMutation = useMutation({
    mutationFn: resetUserPassword,
    onSuccess: ({ user, tempPassword }) => {
      setRevealed({ email: user.email, tempPassword })
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="size-4" /> Usuários</CardTitle>
        <CardDescription>Recuperação de conta admin-assistida — gere uma senha temporária e repasse por fora.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {revealed && (
          <Alert>
            <AlertTitle>Senha temporária gerada pra {revealed.email}</AlertTitle>
            <AlertDescription className="flex flex-col gap-1">
              <span>Copie agora — não vai aparecer de novo. O usuário troca depois de logar.</span>
              <code className="w-fit rounded bg-muted px-2 py-1 text-sm font-mono">{revealed.tempPassword}</code>
            </AlertDescription>
          </Alert>
        )}

        {resetMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>{getErrorMessage(resetMutation.error)}</AlertDescription>
          </Alert>
        )}

        {usersQuery.isLoading && <div className="text-sm text-muted-foreground">Carregando...</div>}
        {usersQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>{getErrorMessage(usersQuery.error)}</AlertDescription>
          </Alert>
        )}

        <div className="scroll-thin flex max-h-96 flex-col overflow-y-auto pr-4">
          {usersQuery.data?.map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-2 border-b border-border py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <span className="truncate text-sm font-medium">{user.email}</span>
                <div className="text-xs text-muted-foreground">desde {new Date(user.createdAt).toLocaleDateString("pt-BR")}</div>
              </div>
              <Button
                size="xs"
                variant="outline"
                onClick={() => resetMutation.mutate(user.id)}
                disabled={resetMutation.isPending}
              >
                <KeyRound /> Resetar senha
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
