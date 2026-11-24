import Lottie from 'lottie-react';
import shoppingCartAnim from '../../assets/shopping_cart.json';

interface SplashScreenProps {
  onDismiss: () => void;
}

export function SplashScreen({ onDismiss }: SplashScreenProps) {
  return (
    <div
      onClick={onDismiss}
      className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-[#F8F9FA] px-8 transition-opacity duration-300 dark:bg-[#121417]"
    >
      <div className="h-52 w-52">
        <Lottie animationData={shoppingCartAnim} loop />
      </div>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-[#111827] dark:text-[#F3F4F6]">
        Carrinho de Compras
      </h1>
      <p className="mt-1.5 text-center text-sm text-[#6B7280] dark:text-[#9CA3AF]">
        Suas listas inteligentes e economia por mercado
      </p>
      <div className="mt-6 h-1 w-28 overflow-hidden rounded-full bg-[#00C853]/20">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-[#00C853]" />
      </div>
    </div>
  );
}
