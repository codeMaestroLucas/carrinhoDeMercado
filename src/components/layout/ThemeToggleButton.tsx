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

  if (variant === 'glass') {
    return (
      <button
        type="button"
        onClick={toggleDarkMode}
        aria-label={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/25 text-white backdrop-blur-md transition active:scale-95"
      >
        {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleDarkMode}
      aria-label={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111827] shadow-xs transition active:scale-95 dark:border-[#2E3440] dark:bg-[#1E2229] dark:text-[#F3F4F6]"
    >
      {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
