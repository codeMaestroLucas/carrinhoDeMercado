import Lottie from 'lottie-react';
import shoppingCartAnim from '../../assets/shopping_cart.json';

interface SplashScreenProps {
  onDismiss: () => void;
}

export function SplashScreen({ onDismiss }: SplashScreenProps) {
  return (
    <div
      onClick={onDismiss}
      className="fixed inset-0 z-50 flex cursor-pointer select-none flex-col items-center justify-center bg-[var(--bg-app)] px-6 transition-opacity duration-300 ease-ui"
    >
      <div className="flex flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-44 w-44 shrink-0 items-center justify-center">
          <Lottie
            animationData={shoppingCartAnim}
            loop
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        <h1 className="text-2xl font-medium tracking-tight text-[var(--text-primary)]">
          Carrinho de Compras
        </h1>
        <p className="mt-2 max-w-xs text-sm text-[var(--text-secondary)]">
          Listas por corredor e comparativo real de preços
        </p>

        <div className="mt-6 h-0.5 w-24 overflow-hidden rounded-full bg-[var(--border-hairline)]">
          <div className="h-full w-1/2 rounded-full bg-[var(--accent)]" />
        </div>
      </div>
    </div>
  );
}
