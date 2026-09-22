import { useQuery } from "@tanstack/react-query"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { getBtcHistory } from "@/services/api"
import { formatBtc } from "@/lib/utils"
import { EXPLORER_BASE_URL } from "@/lib/config"

interface HistoryTableProps {
  limit?: number
  title?: string
}

export function HistoryTable({ limit, title = "Últimos envios (BTC)" }: HistoryTableProps) {
  const historyQuery = useQuery({ queryKey: ["btc-history"], queryFn: getBtcHistory, refetchInterval: 10000 })
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
                <TableHead>Endereço</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Txid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.txid}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(item.at).toLocaleDateString()}, {new Date(item.at).toLocaleTimeString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{item.fromWallet}</TableCell>
                  <TableCell className="max-w-40 truncate font-mono text-xs" title={item.address}>{item.address}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatBtc(item.amount)} BTC</TableCell>
                  <TableCell className="max-w-32 truncate font-mono text-xs">
                    <a
                      href={`${EXPLORER_BASE_URL}/tx/${item.txid}`}
                      target="_blank"
                      rel="noreferrer"
                      title={item.txid}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {item.txid}
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
