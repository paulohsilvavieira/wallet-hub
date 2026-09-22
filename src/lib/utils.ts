import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBtc(amount: number): string {
  return amount.toFixed(8)
}

export function formatEth(amount: number): string {
  return amount.toFixed(6)
}
