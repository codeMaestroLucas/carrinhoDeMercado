import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.localStorage?.getItem?.('pwa_install_banner_dismissed') === '1') {
        setDismissed(true);
        return;
      }
    } catch {
      // Ignore storage access restrictions
    }

    const isStandalone =
      Boolean(window.matchMedia?.('(display-mode: standalone)').matches) ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    if (isStandalone) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
    if (isIos && isSafari) {
      setShowIosGuide(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (dismissed || (!deferredPrompt && !showIosGuide)) {
    return null;
  }

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage?.setItem?.('pwa_install_banner_dismissed', '1');
    } catch {
      // Ignore storage access restrictions
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="mx-4 mt-3 flex items-start gap-3 rounded-2xl border border-[#00C853]/30 bg-[#00C853]/10 p-3 text-xs text-[#111827] dark:text-[#F3F4F6]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#00C853] text-white">
        {showIosGuide ? <Share size={16} /> : <Download size={16} />}
      </div>
      <div className="flex-1">
        {deferredPrompt ? (
          <>
            <p className="font-bold">Instalar Carrinho de Compras</p>
            <p className="mt-0.5 text-[#6B7280] dark:text-[#9CA3AF]">
              Adicione à tela inicial para usar offline no mercado como app nativo.
            </p>
            <button
              type="button"
              onClick={handleInstallClick}
              className="mt-2 rounded-lg bg-[#00C853] px-3 py-1.5 text-xs font-bold text-white transition active:scale-95"
            >
              Instalar App
            </button>
          </>
        ) : (
          <>
            <p className="font-bold">Instalar no iPhone / iPad</p>
            <p className="mt-0.5 text-[#6B7280] dark:text-[#9CA3AF]">
              Toque no botão <strong>Compartilhar</strong> da barra do Safari e escolha{' '}
              <strong>&ldquo;Adicionar à Tela de Início&rdquo;</strong>.
            </p>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar dica de instalação"
        className="rounded-lg p-1 text-[#6B7280] hover:bg-black/5 dark:text-[#9CA3AF] dark:hover:bg-white/10"
      >
        <X size={15} />
      </button>
    </div>
  );
}
