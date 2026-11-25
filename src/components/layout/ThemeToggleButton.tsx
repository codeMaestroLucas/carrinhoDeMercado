import { Moon, Sun } from 'lucide-react';
import { useShoppingStore } from '../../store/useShoppingStore';
import { SmartTooltip } from '../common/SmartTooltip';

interface ThemeToggleButtonProps {
  variant?: 'default' | 'glass';
}

export function ThemeToggleButton({
  variant = 'default',
}: ThemeToggleButtonProps) {
  const isDarkMode = useShoppingStore((s) => s.isDarkMode);
  const toggleDarkMode = useShoppingStore((s) => s.toggleDarkMode);

  const label = isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro';
  const surfaceClass =
    variant === 'glass'
      ? 'bg-[var(--bg-surface)]/92 backdrop-blur-md'
      : 'bg-[var(--bg-surface)]';

  return (
    <SmartTooltip label={label}>
      <button
        type="button"
        onClick={toggleDarkMode}
        aria-label={label}
        className={`btn-secondary h-11 w-11 p-0 ${surfaceClass}`}
      >
        {isDarkMode ? (
          <Sun size={18} strokeWidth={1.75} className="text-[var(--text-primary)]" />
        ) : (
          <Moon size={18} strokeWidth={1.75} className="text-[var(--text-primary)]" />
        )}
      </button>
    </SmartTooltip>
  );
}
