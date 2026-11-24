import Lottie from 'lottie-react';
import shoppingCartAnim from '../../assets/shopping_cart.json';

interface SplashScreenProps {
  onDismiss: () => void;
}

export function SplashScreen({ onDismiss }: SplashScreenProps) {
  return (
    <div
      onClick={onDismiss}
      className="fixed inset-0 z-50 flex cursor-pointer select-none flex-col items-center justify-center bg-[#F8F9FA] px-6 transition-opacity duration-300 dark:bg-[#121417]"
    >
      <div className="flex flex-col items-center justify-center text-center">
        {/* Animated Shopping Cart - centered 1:1 ratio without cropping */}
        <div className="mb-4 flex h-48 w-48 shrink-0 items-center justify-center">
          <Lottie
            animationData={shoppingCartAnim}
            loop
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* Brand Text strictly below the animation */}
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111827] dark:text-[#F3F4F6]">
          Carrinho de Compras
        </h1>
        <p className="mt-1.5 max-w-xs text-sm text-[#6B7280] dark:text-[#9CA3AF]">
          Suas listas inteligentes e economia por mercado
        </p>

        {/* Animated Loading Bar */}
        <div className="mt-6 h-1 w-28 overflow-hidden rounded-full bg-[#00C853]/20">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[#00C853]" />
        </div>
      </div>
    </div>
  );
}
