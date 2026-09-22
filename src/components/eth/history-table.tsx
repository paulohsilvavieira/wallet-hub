import { useQuery } from "@tanstack/react-query"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getEthHistory } from "@/services/api"
import { formatEth } from "@/lib/utils"
import { ETH_EXPLORER_BASE_URL } from "@/lib/config"
import type { EthSendStatus } from "@/types/ethereum"

const statusVariant: Record<EthSendStatus, "success" | "outline" | "destructive"> = {
  confirmed: "success",
  pending: "outline",
  failed: "destructive",
}

const statusLabel: Record<EthSendStatus, string> = {
  confirmed: "confirmado",
  pending: "pendente",
  failed: "falhou",
}

interface HistoryTableProps {
  limit?: number
  title?: string
}

export function HistoryTable({ limit, title = "Últimos envios (ETH)" }: HistoryTableProps) {
  const historyQuery = useQuery({ queryKey: ["eth-history"], queryFn: getEthHistory, refetchInterval: 10000 })
  const items = (historyQuery.data ?? []).slice(0, limit)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhum envio ainda.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>De</TableHead>
                <TableHead>Para</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.hash}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}, {new Date(item.createdAt).toLocaleTimeString()}
                  </TableCell>
                  <TableCell className="max-w-32 truncate font-mono text-xs" title={item.fromAddress}>{item.fromAddress}</TableCell>
                  <TableCell className="max-w-32 truncate font-mono text-xs" title={item.toAddress}>{item.toAddress}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatEth(item.amountEth)} ETH</TableCell>
                  <TableCell><Badge variant={statusVariant[item.status]}>{statusLabel[item.status]}</Badge></TableCell>
                  <TableCell className="max-w-32 truncate font-mono text-xs">
                    <a
                      href={`${ETH_EXPLORER_BASE_URL}/tx/${item.hash}`}
                      target="_blank"
                      rel="noreferrer"
                      title={item.hash}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {item.hash}
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
