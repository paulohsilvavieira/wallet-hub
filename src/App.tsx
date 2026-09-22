import { QueryClientProvider, useQuery } from "@tanstack/react-query"

import { AdminConsolePage } from "@/pages/admin-console-page"
import { UserSendPage } from "@/pages/user-send-page"
import { LoginPage } from "@/pages/login-page"
import { getMe } from "@/services/api"
import { queryClient } from "@/lib/query-client"

function AuthGate() {
  const meQuery = useQuery({ queryKey: ["me"], queryFn: getMe, retry: false })

  if (meQuery.isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Carregando...</div>
  }

  if (!meQuery.data) {
    return <LoginPage />
  }

  return meQuery.data.role === "admin" ? <AdminConsolePage user={meQuery.data} /> : <UserSendPage user={meQuery.data} />
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  )
}

export default App
