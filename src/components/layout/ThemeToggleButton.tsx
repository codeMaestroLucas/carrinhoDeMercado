import { Moon, Sun } from 'lucide-react';
import { useShoppingStore } from '../../store/useShoppingStore';

interface ThemeToggleButtonProps {
  variant?: 'default' | 'glass';
}

export function ThemeToggleButton({
  variant = 'default',
}: ThemeToggleButtonProps) {
  const isDarkMode = useShoppingStore((s) => s.isDarkMode);
  const toggleDarkMode = useShoppingStore((s) => s.toggleDarkMode);

  const baseClass =
    variant === 'glass'
      ? 'bg-[var(--bg-surface)]/90 text-[var(--text-primary)] backdrop-blur-md'
      : 'bg-[var(--bg-surface)] text-[var(--text-primary)]';

  return (
    <button
      type="button"
      onClick={toggleDarkMode}
      aria-label={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-hairline)] shadow-2xs transition-[background-color,color,transform] duration-150 ease-ui hover:bg-[var(--bg-subtle)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${baseClass}`}
    >
      {isDarkMode ? (
        <Sun size={18} strokeWidth={1.5} />
      ) : (
        <Moon size={18} strokeWidth={1.5} />
      )}
    </button>
  );
}
