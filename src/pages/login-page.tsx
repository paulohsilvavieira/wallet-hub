import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { login, signup } from "@/services/api"
import { getErrorMessage } from "@/lib/api-errors"
import logo from "@/assets/logo-text-horizontal.svg"
import logoWhite from "@/assets/logo-text-horizontal-white.svg"

export function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => (mode === "login" ? login(email, password) : signup(email, password)),
    onSuccess: (user) => {
      queryClient.setQueryData(["me"], user)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <img src={logo} alt="mybitcoin" className="h-28 dark:hidden" />
      <img src={logoWhite} alt="mybitcoin" className="hidden h-28 dark:block" />

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Wallet Hub</CardTitle>
          <CardDescription>
            {mode === "login" ? "Entre pra enviar fundos de teste (BTC/ETH)." : "Crie uma conta pra enviar fundos de teste (BTC/ETH)."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={mutation.isPending}>
              {mode === "login" ? "Entrar" : "Criar conta"}
            </Button>

            {mutation.isError && (
              <Alert variant="destructive">
                <AlertDescription>{getErrorMessage(mutation.error)}</AlertDescription>
              </Alert>
            )}

            <button
              type="button"
              className="text-sm text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
