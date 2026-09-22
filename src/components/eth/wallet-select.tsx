import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { formatEth } from "@/lib/utils"
import type { EthWallet } from "@/types/ethereum"

interface WalletSelectProps {
  wallets: EthWallet[]
  value: string
  onChange: (id: string) => void
}

export function WalletSelect({ wallets, value, onChange }: WalletSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = wallets.find((w) => w.id === value)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    document.addEventListener("keydown", onEscape)
    return () => {
      document.removeEventListener("mousedown", onClickOutside)
      document.removeEventListener("keydown", onEscape)
    }
  }, [])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-[38px] w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {selected ? (
          <>
            <span className="truncate">{selected.label}</span>
            <span className="flex shrink-0 items-center gap-2">
              {selected.balanceEth !== undefined && selected.balanceEth !== null && (
                <Badge variant="success">{formatEth(Number(selected.balanceEth))} ETH</Badge>
              )}
              <ChevronDown className="size-4 text-muted-foreground" />
            </span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">Selecione...</span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </>
        )}
      </button>

      {open && (
        <div className="scroll-thin absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-input bg-card p-1 shadow-lg">
          {wallets.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma carteira cadastrada.</div>
          )}
          {wallets.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                onChange(w.id)
                setOpen(false)
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent ${
                w.id === value ? "bg-accent" : ""
              }`}
            >
              <span className="truncate">{w.label}</span>
              {w.balanceEth !== undefined && w.balanceEth !== null && (
                <Badge variant="success" className="shrink-0">{formatEth(Number(w.balanceEth))} ETH</Badge>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
