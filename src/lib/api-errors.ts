import { isAxiosError } from "axios"

export function getErrorMessage(err: unknown): string {
  if (isAxiosError<{ error?: string }>(err)) {
    return err.response?.data?.error || err.message
  }
  if (err instanceof Error) {
    return err.message
  }
  return "Erro desconhecido"
}
