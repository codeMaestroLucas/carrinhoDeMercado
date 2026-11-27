import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import {
  dismissPwaInstallBanner,
  isPwaInstallBannerDismissed,
} from '../../services/storageService';

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
    if (isPwaInstallBannerDismissed()) {
      setDismissed(true);
      return;
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
    dismissPwaInstallBanner();
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
    <div className="mx-auto mt-4 max-w-5xl px-4 sm:px-6 lg:px-8">
      <div className="surface-card flex items-start gap-3.5 p-4 text-sm text-[var(--text-primary)]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-fg)]">
          {showIosGuide ? (
            <Share size={18} strokeWidth={1.75} />
          ) : (
            <Download size={18} strokeWidth={1.75} />
          )}
        </div>
        <div className="flex-1">
          {deferredPrompt ? (
            <>
              <p className="font-display text-base font-semibold">Instalar Carrinho</p>
              <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">
                Adicione à tela inicial para usar offline no mercado com abertura instantânea
              </p>
              <button
                type="button"
                onClick={handleInstallClick}
                className="btn-primary mt-3 h-9 px-4 text-xs"
              >
                Instalar app
              </button>
            </>
          ) : (
            <>
              <p className="font-display text-base font-semibold">Instalar no iPhone</p>
              <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">
                Toque em <strong>Compartilhar</strong> no Safari e escolha{' '}
                <strong>Adicionar à Tela de Início</strong>
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar dica de instalação"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
