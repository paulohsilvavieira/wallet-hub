import { useState } from "react"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { applyTheme, persistTheme, type Theme } from "@/lib/theme"

interface ThemeToggleProps {
  initialTheme: Theme
}

export function ThemeToggle({ initialTheme }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark"
    applyTheme(next)
    persistTheme(next)
    setTheme(next)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
      onClick={toggleTheme}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  )
}
