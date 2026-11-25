import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ExternalLink,
  FileText,
  Plus,
  QrCode,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  type ProductCategoryId,
  type PurchaseHistoryItem,
  type ScannedReceiptItem,
} from '../../types/shopping';
import { useShoppingStore } from '../../store/useShoppingStore';
import { NfceScannerService } from '../../services/nfceParserService';
import { ReceiptScannerService } from '../../services/receiptParserService';
import { AppFormatters } from '../../utils/formatters';

const DEFAULT_UNITS = ['un', 'kg', 'g', 'L', 'ml', 'dz', 'cx', 'pct'];

export interface EditableReceiptItem {
  id: string;
  name: string;
  category: ProductCategoryId;
  quantity: number;
  quantityStr: string;
  unit: string;
  price: number;
  priceStr: string;
  unitPrice?: number;
  itemIndex?: number;
}

function toEditableItem(
  item: ScannedReceiptItem,
  index: number,
  predictCategoryFn: (name: string) => ProductCategoryId,
): EditableReceiptItem {
  const qty = item.quantity > 0 ? item.quantity : 1;
  const unit = item.unit ? AppFormatters.normalizeUnit(item.unit) : 'un';
  const price =
    typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0
      ? item.price
      : 0;

  return {
    id: `rcpt-item-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    name: item.name,
    category: item.category ?? predictCategoryFn(item.name),
    quantity: qty,
    quantityStr:
      qty === Math.round(qty) ? String(qty) : qty.toString().replace('.', ','),
    unit,
    price,
    priceStr: price > 0 ? price.toFixed(2).replace('.', ',') : '',
    unitPrice: item.unitPrice,
    itemIndex: item.itemIndex ?? index + 1,
  };
}

type ImportMode = 'qr' | 'ocr' | 'paste';

interface ReceiptImportModalProps {
  onClose: () => void;
  onImported: (marketName: string, count: number) => void;
}

export function ReceiptImportModal({
  onClose,
  onImported,
}: ReceiptImportModalProps) {
  const markets = useShoppingStore((s) => s.markets);
  const selectedMarketId = useShoppingStore((s) => s.selectedMarketId);
  const predictCategory = useShoppingStore((s) => s.predictCategory);
  const addMarket = useShoppingStore((s) => s.addMarket);
  const addPurchaseFromItems = useShoppingStore((s) => s.addPurchaseFromItems);

  const [mode, setMode] = useState<ImportMode>('qr');
  const [marketId, setMarketId] = useState(selectedMarketId);
  const [newMarketName, setNewMarketName] = useState('');
  const [isCreatingMarket, setIsCreatingMarket] = useState(false);

  const [qrInput, setQrInput] = useState('');
  const [resolvedSefazUrl, setResolvedSefazUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const [pasteText, setPasteText] = useState('');
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [scannedItems, setScannedItems] = useState<EditableReceiptItem[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');

  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const qrRegionId = 'nfce-qr-reader-region';

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // Ignore stop errors if already stopped
      }
      scannerRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, []);

  const startQrCamera = async () => {
    setStatusError(null);
    setIsCameraActive(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const qr = new Html5Qrcode(qrRegionId);
      scannerRef.current = qr;
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          setQrInput(decodedText);
          void stopCamera();
          void handleProcessQrOrKey(decodedText);
        },
        () => {
          // Ignore per-frame scan misses
        },
      );
    } catch (err) {
      setIsCameraActive(false);
      setStatusError(
        `Não foi possível iniciar a câmera (${err instanceof Error ? err.message : String(err)}). Verifique a permissão ou cole o link abaixo`,
      );
    }
  };

  const handleProcessQrOrKey = async (raw: string) => {
    const clean = raw.trim();
    if (!clean) return;
    setStatusError(null);
    setIsProcessing(true);

    const url = NfceScannerService.resolveUrlFromInput(clean);
    setResolvedSefazUrl(url);

    try {
      const res = await NfceScannerService.fetchAndParseNfceViaProxy(clean);
      if (res.items.length > 0) {
        setScannedItems(
          res.items.map((it, idx) => toEditableItem(it, idx, predictCategory)),
        );
        if (res.marketName) {
          const trimmed = res.marketName.trim();
          const match = markets.find(
            (m) => m.name.trim().toLowerCase() === trimmed.toLowerCase(),
          );
          if (match) {
            setMarketId(match.id);
            setIsCreatingMarket(false);
          } else {
            setNewMarketName(trimmed);
            setIsCreatingMarket(true);
          }
        }
      } else {
        setStatusError(
          res.errorMessage ??
            'Não foi possível extrair os itens automaticamente',
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusError(null);
    setIsProcessing(true);
    setOcrProgress(0);
    try {
      const text = await ReceiptScannerService.recognizeTextFromImageFile(
        file,
        (p) => setOcrProgress(p),
      );
      const items = ReceiptScannerService.parseReceiptText(text);
      if (items.length === 0) {
        setPasteText(text);
        setMode('paste');
        setStatusError(
          'OCR concluiu sem detectar preços claros. Revise o texto abaixo',
        );
      } else {
        setScannedItems(
          items.map((it, idx) => toEditableItem(it, idx, predictCategory)),
        );
      }
    } catch (err) {
      setStatusError(
        `Erro ao processar foto: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsProcessing(false);
      setOcrProgress(null);
      e.target.value = '';
    }
  };

  const handleParsePastedContent = () => {
    const raw = pasteText.trim();
    if (!raw) return;
    setStatusError(null);

    if (
      raw.includes('<') &&
      (raw.includes('txtTit') ||
        raw.includes('<tr') ||
        raw.includes('<li') ||
        raw.includes('<div') ||
        raw.includes('<table') ||
        raw.includes('<p'))
    ) {
      const res = NfceScannerService.parseNfceHtml(raw);
      if (res.items.length > 0) {
        setScannedItems(
          res.items.map((it, idx) => toEditableItem(it, idx, predictCategory)),
        );
        if (res.marketName) {
          const trimmed = res.marketName.trim();
          const match = markets.find(
            (m) => m.name.trim().toLowerCase() === trimmed.toLowerCase(),
          );
          if (match) {
            setMarketId(match.id);
            setIsCreatingMarket(false);
          } else {
            setNewMarketName(trimmed);
            setIsCreatingMarket(true);
          }
        }
        return;
      }
    }

    const items = ReceiptScannerService.parseReceiptText(raw);
    if (items.length === 0) {
      setStatusError(
        'Nenhum item com preço válido encontrado no texto colado',
      );
    } else {
      setScannedItems(
        items.map((it, idx) => toEditableItem(it, idx, predictCategory)),
      );
    }
  };

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    const price = AppFormatters.parsePrice(manualPrice);
    if (!manualName.trim() || price == null || price < 0) return;
    const name = manualName.trim();
    const newItem: EditableReceiptItem = {
      id: `rcpt-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      price,
      priceStr: price > 0 ? price.toFixed(2).replace('.', ',') : '',
      unitPrice: price,
      quantity: 1,
      quantityStr: '1',
      unit: 'un',
      category: predictCategory(name),
      itemIndex: scannedItems.length + 1,
    };
    setScannedItems((prev) => [...prev, newItem]);
    setManualName('');
    setManualPrice('');
  };

  const handleAddNewItem = () => {
    const newItem: EditableReceiptItem = {
      id: `rcpt-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: '',
      category: 'alimentos',
      quantity: 1,
      quantityStr: '1',
      unit: 'un',
      price: 0,
      priceStr: '',
      itemIndex: scannedItems.length + 1,
    };
    setScannedItems((prev) => [...prev, newItem]);
  };

  const handleClearAllItems = () => {
    setScannedItems([]);
  };

  const handleNameChange = (id: string, name: string) => {
    setScannedItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, name } : it)),
    );
  };

  const handleCategoryChange = (id: string, category: ProductCategoryId) => {
    setScannedItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, category } : it)),
    );
  };

  const handleQuantityChange = (id: string, val: string) => {
    setScannedItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const parsed = AppFormatters.parseQuantity(val, it.unit);
        return {
          ...it,
          quantityStr: val,
          quantity: parsed != null && parsed > 0 ? parsed : it.quantity,
        };
      }),
    );
  };

  const handleQuantityBlur = (id: string) => {
    setScannedItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const parsed = AppFormatters.parseQuantity(it.quantityStr, it.unit);
        const finalQty =
          parsed != null && parsed > 0
            ? parsed
            : it.quantity > 0
              ? it.quantity
              : 1;
        const formattedStr =
          finalQty === Math.round(finalQty)
            ? String(finalQty)
            : finalQty.toString().replace('.', ',');
        return {
          ...it,
          quantity: finalQty,
          quantityStr: formattedStr,
        };
      }),
    );
  };

  const handleUnitChange = (id: string, unit: string) => {
    setScannedItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, unit } : it)),
    );
  };

  const handlePriceChange = (id: string, val: string) => {
    setScannedItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const parsed = AppFormatters.parsePrice(val);
        return {
          ...it,
          priceStr: val,
          price: parsed != null && parsed >= 0 ? parsed : it.price,
        };
      }),
    );
  };

  const handlePriceBlur = (id: string) => {
    setScannedItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const parsed = AppFormatters.parsePrice(it.priceStr);
        const finalPrice = parsed != null && parsed >= 0 ? parsed : it.price;
        return {
          ...it,
          price: finalPrice,
          priceStr:
            finalPrice > 0 ? finalPrice.toFixed(2).replace('.', ',') : '',
        };
      }),
    );
  };

  const handleRemoveItem = (id: string) => {
    setScannedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSavePurchase = () => {
    const validItems = scannedItems.filter((i) => i.name.trim().length > 0);
    if (validItems.length === 0) return;

    let finalMarketId = marketId;
    if (isCreatingMarket && newMarketName.trim()) {
      const created = addMarket(newMarketName.trim());
      finalMarketId = created.id;
    }

    const targetMarketName =
      markets.find((m) => m.id === finalMarketId)?.name ??
      (isCreatingMarket ? newMarketName.trim() : 'Mercado');

    const historyItems: PurchaseHistoryItem[] = validItems.map((item) => {
      const effectivePrice =
        AppFormatters.parsePrice(item.priceStr) ?? item.price;
      const effectiveQty =
        AppFormatters.parseQuantity(item.quantityStr, item.unit) ??
        (item.quantity > 0 ? item.quantity : 1);
      const effectiveUnitPrice =
        item.unitPrice ??
        (effectiveQty > 0
          ? Number((effectivePrice / effectiveQty).toFixed(2))
          : effectivePrice);

      return {
        name: item.name.trim(),
        category: item.category ?? predictCategory(item.name),
        price: effectivePrice,
        unitPrice: effectiveUnitPrice,
        quantity: effectiveQty,
        unit: item.unit || 'un',
      };
    });

    const rec = addPurchaseFromItems({
      marketId: finalMarketId,
      items: historyItems,
    });
    if (rec) {
      onImported(targetMarketName, historyItems.length);
    }
    onClose();
  };

  const totalExtracted = scannedItems.reduce((sum, item) => {
    const p = AppFormatters.parsePrice(item.priceStr) ?? item.price;
    return sum + (Number.isFinite(p) && p > 0 ? p : 0);
  }, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center"
      onClick={() => {
        void stopCamera();
        onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[93vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-5 pb-8 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium text-[var(--text-primary)]">
              Importar cupom fiscal
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              QR Code NFC-e, foto OCR ou entrada manual
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void stopCamera();
              onClose();
            }}
            aria-label="Fechar importação"
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-1">
          {[
            { id: 'qr' as const, label: 'QR Code', icon: QrCode },
            { id: 'ocr' as const, label: 'Foto OCR', icon: Camera },
            { id: 'paste' as const, label: 'Texto / Manual', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (mode === 'qr' && tab.id !== 'qr') void stopCamera();
                  setMode(tab.id);
                }}
                className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-[background-color,color] duration-150 ease-ui ${
                  active
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon size={15} strokeWidth={1.5} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {/* Target Market */}
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                Supermercado da compra
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingMarket((v) => !v)}
                className="text-xs font-medium text-[var(--accent-fg)] hover:underline"
              >
                {isCreatingMarket ? 'Escolher existente' : 'Novo mercado'}
              </button>
            </div>
            {isCreatingMarket ? (
              <input
                type="text"
                placeholder="Nome do supermercado"
                value={newMarketName}
                onChange={(e) => setNewMarketName(e.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
              />
            ) : (
              <select
                value={marketId}
                onChange={(e) => setMarketId(e.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-xs font-medium text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                {markets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* QR Code Mode */}
          {mode === 'qr' && (
            <div className="space-y-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
              <div
                id={qrRegionId}
                className={`overflow-hidden rounded-xl bg-black ${
                  isCameraActive ? 'block min-h-[240px]' : 'hidden'
                }`}
              />
              {!isCameraActive ? (
                <button
                  type="button"
                  onClick={() => void startQrCamera()}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] text-xs font-medium text-[var(--accent-ink)] transition-[background-color,transform] duration-150 ease-ui hover:bg-[var(--accent-hover)] active:scale-[0.98]"
                >
                  <QrCode size={16} strokeWidth={1.5} />
                  Abrir câmera para ler QR Code
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void stopCamera()}
                  className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--negative-soft)] text-xs font-medium text-[var(--negative)]"
                >
                  Parar câmera
                </button>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Link da SEFAZ ou chave de 44 dígitos"
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  className="h-9 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  disabled={!qrInput.trim() || isProcessing}
                  onClick={() => void handleProcessQrOrKey(qrInput)}
                  className="h-9 rounded-lg bg-[var(--text-primary)] px-4 text-xs font-medium text-[var(--bg-app)] disabled:opacity-40"
                >
                  Ler
                </button>
              </div>

              {resolvedSefazUrl && (
                <div className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-app)] px-3 py-2 text-xs">
                  <span className="truncate font-medium text-[var(--text-primary)]">
                    Portal SEFAZ identificado
                  </span>
                  <a
                    href={resolvedSefazUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 flex shrink-0 items-center gap-1 font-medium text-[var(--accent-fg)] hover:underline"
                  >
                    Abrir nota <ExternalLink size={13} strokeWidth={1.5} />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* OCR Photo Mode */}
          {mode === 'ocr' && (
            <div className="space-y-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 text-center">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-app)] px-4 py-8 transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)]">
                <Upload size={22} strokeWidth={1.5} className="text-[var(--accent-fg)]" />
                <span className="text-xs font-medium text-[var(--text-primary)]">
                  Fotografar ou escolher imagem do cupom
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  Reconhecimento direto no navegador
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => void handlePhotoUpload(e)}
                  className="hidden"
                />
              </label>

              {ocrProgress != null && (
                <div className="space-y-1.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                    <div
                      className="h-full bg-[var(--accent)] transition-[width] duration-150 ease-ui"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                  <p className="font-mono-tabular text-xs text-[var(--text-muted)]">
                    Lendo cupom fiscal ({ocrProgress}%)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Paste Text / HTML / Manual Mode */}
          {mode === 'paste' && (
            <div className="space-y-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
              <textarea
                rows={4}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Cole aqui o texto copiado da página da SEFAZ ou do cupom fiscal"
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                disabled={!pasteText.trim()}
                onClick={handleParsePastedContent}
                className="h-9 w-full rounded-lg bg-[var(--accent)] text-xs font-medium text-[var(--accent-ink)] disabled:opacity-40"
              >
                Extrair itens do texto
              </button>

              <form
                onSubmit={handleAddManualItem}
                className="flex gap-2 border-t border-[var(--border-hairline)] pt-3"
              >
                <input
                  type="text"
                  placeholder="Item manual"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="h-9 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Preço"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  className="font-mono-tabular h-9 w-24 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="submit"
                  aria-label="Adicionar item manual"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--text-primary)] text-[var(--bg-app)]"
                >
                  <Plus size={16} strokeWidth={1.5} />
                </button>
              </form>
            </div>
          )}

          {statusError && (
            <div className="rounded-xl border border-[#B45309]/25 bg-[#FEF3C7]/60 p-3 text-xs font-medium text-[#92400E] dark:bg-[#78350F]/25 dark:text-[#FCD34D]">
              {statusError}
            </div>
          )}

          {/* Extracted Items Preview */}
          {scannedItems.length > 0 && (
            <div className="space-y-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-2.5">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                    Itens identificados (<span className="font-mono-tabular">{scannedItems.length}</span>)
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Edite nome, categoria, quantidade, unidade e preço livremente
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono-tabular text-xs font-semibold text-[var(--accent-fg)]">
                    Total: {AppFormatters.formatCurrency(totalExtracted)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleAddNewItem}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--bg-surface)]"
                >
                  <Plus size={14} strokeWidth={1.5} />
                  Adicionar item
                </button>
                <button
                  type="button"
                  onClick={handleClearAllItems}
                  className="text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--negative)] hover:underline"
                >
                  Limpar lista
                </button>
              </div>

              <div className="max-h-80 space-y-2.5 overflow-y-auto pr-1 sm:max-h-96">
                {scannedItems.map((item, idx) => {
                  const availableUnits = Array.from(
                    new Set([...DEFAULT_UNITS, item.unit || 'un']),
                  );
                  const effectiveQty =
                    AppFormatters.parseQuantity(item.quantityStr, item.unit) ??
                    item.quantity;
                  const effectivePrice =
                    AppFormatters.parsePrice(item.priceStr) ?? item.price;
                  const showUnitPrice =
                    effectiveQty > 0 &&
                    Math.abs(effectiveQty - 1) > 0.001 &&
                    effectivePrice > 0;

                  return (
                    <div
                      key={item.id}
                      className="space-y-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-2.5 transition-colors focus-within:border-[var(--accent)]/60 sm:p-3"
                    >
                      {/* Linha 1: Índice, Nome do Produto com foco nítido e botão de excluir */}
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono-tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[10px] font-bold text-[var(--text-muted)]"
                          title={`Item #${idx + 1}`}
                        >
                          #{String(idx + 1).padStart(2, '0')}
                        </span>

                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) =>
                            handleNameChange(item.id, e.target.value)
                          }
                          placeholder="Nome do produto"
                          aria-label={`Nome do produto #${idx + 1}`}
                          className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-[border-color,background-color] focus:border-[var(--accent)] focus:bg-[var(--bg-surface)] focus:ring-1 focus:ring-[var(--accent)]"
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label={`Remover item ${item.name || idx + 1}`}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--negative)] transition-colors duration-150 ease-ui hover:bg-[var(--negative-soft)]"
                          title="Remover este item"
                        >
                          <Trash2 size={15} strokeWidth={1.5} />
                        </button>
                      </div>

                      {/* Linha 2: Categoria, Quantidade + Unidade, Preço Total */}
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {/* Categoria */}
                        <div className="min-w-[120px] flex-1">
                          <select
                            value={item.category}
                            onChange={(e) =>
                              handleCategoryChange(
                                item.id,
                                e.target.value as ProductCategoryId,
                              )
                            }
                            aria-label={`Categoria do produto #${idx + 1}`}
                            className="h-7 w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2 text-[11px] font-medium text-[var(--text-secondary)] outline-none transition-colors focus:border-[var(--accent)] focus:bg-[var(--bg-surface)]"
                          >
                            {PRODUCT_CATEGORIES.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantidade e Unidade */}
                        <div
                          className="flex items-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-subtle)] focus-within:border-[var(--accent)] focus-within:bg-[var(--bg-surface)]"
                          title="Quantidade e unidade de medida"
                        >
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="1"
                            value={item.quantityStr}
                            onChange={(e) =>
                              handleQuantityChange(item.id, e.target.value)
                            }
                            onBlur={() => handleQuantityBlur(item.id)}
                            aria-label={`Quantidade #${idx + 1}`}
                            className="font-mono-tabular h-7 w-12 rounded-l-md bg-transparent px-1.5 text-center text-xs font-medium text-[var(--text-primary)] outline-none sm:w-14"
                          />
                          <div className="h-4 w-px bg-[var(--border-hairline)]" />
                          <select
                            value={item.unit}
                            onChange={(e) =>
                              handleUnitChange(item.id, e.target.value)
                            }
                            aria-label={`Unidade de medida #${idx + 1}`}
                            className="h-7 rounded-r-md bg-transparent px-1.5 text-[11px] font-medium text-[var(--text-secondary)] outline-none"
                          >
                            {availableUnits.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Preço Total */}
                        <div
                          className="flex items-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-subtle)] focus-within:border-[var(--accent)] focus-within:bg-[var(--bg-surface)]"
                          title="Preço total deste item (R$)"
                        >
                          <span className="select-none pl-2 text-[11px] font-medium text-[var(--text-muted)]">
                            R$
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={item.priceStr}
                            onChange={(e) =>
                              handlePriceChange(item.id, e.target.value)
                            }
                            onBlur={() => handlePriceBlur(item.id)}
                            aria-label={`Preço total #${idx + 1}`}
                            className="font-mono-tabular h-7 w-20 rounded-r-md bg-transparent px-2 text-right text-xs font-semibold text-[var(--accent-fg)] outline-none sm:w-22"
                          />
                        </div>

                        {/* Indicador de Preço Unitário */}
                        {showUnitPrice && (
                          <span
                            className="font-mono-tabular hidden text-[10px] text-[var(--text-muted)] sm:inline"
                            title="Preço unitário calculado com base no total e quantidade"
                          >
                            ({AppFormatters.formatCurrency(effectivePrice / effectiveQty)}/{item.unit})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleSavePurchase}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] text-xs font-medium text-[var(--accent-ink)] transition-[background-color,transform] duration-150 ease-ui hover:bg-[var(--accent-hover)] active:scale-[0.98]"
              >
                <Check size={16} strokeWidth={1.5} />
                Salvar compra no histórico
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
