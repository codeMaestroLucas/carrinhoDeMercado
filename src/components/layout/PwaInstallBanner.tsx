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
    <div className="mx-auto mt-3 max-w-2xl px-4">
      <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 text-xs text-[var(--text-primary)] shadow-2xs">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-fg)]">
          {showIosGuide ? (
            <Share size={16} strokeWidth={1.5} />
          ) : (
            <Download size={16} strokeWidth={1.5} />
          )}
        </div>
        <div className="flex-1">
          {deferredPrompt ? (
            <>
              <p className="text-sm font-medium">Instalar Carrinho de Compras</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                Adicione à tela inicial para usar offline no mercado
              </p>
              <button
                type="button"
                onClick={handleInstallClick}
                className="mt-3 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-ink)] transition-[background-color,transform] duration-150 ease-ui hover:bg-[var(--accent-hover)] active:scale-[0.98]"
              >
                Instalar app
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Instalar no iPhone</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
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
          className="rounded-lg p-1 text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
