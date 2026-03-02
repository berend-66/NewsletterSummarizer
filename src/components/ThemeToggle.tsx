'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from './Providers'

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2.5 rounded-lg bg-ink-800/50 hover:bg-ink-700/50 transition-colors ${className}`}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {isLight ? (
        <Moon className="w-5 h-5 text-ink-300" />
      ) : (
        <Sun className="w-5 h-5 text-amber-400" />
      )}
    </button>
  )
}
