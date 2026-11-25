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
  PRODUCT_CATEGORY_MAP,
  type ProductCategoryId,
  type PurchaseHistoryItem,
  type ScannedReceiptItem,
} from '../../types/shopping';
import { useShoppingStore } from '../../store/useShoppingStore';
import { NfceScannerService } from '../../services/nfceParserService';
import { ReceiptScannerService } from '../../services/receiptParserService';
import { AppFormatters } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';

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

interface EditScannedItemModalProps {
  item: EditableReceiptItem;
  itemNumber: number;
  isNew?: boolean;
  onSave: (updated: EditableReceiptItem) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

function EditScannedItemModal({
  item,
  itemNumber,
  isNew = false,
  onSave,
  onRemove,
  onClose,
}: EditScannedItemModalProps) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<ProductCategoryId>(item.category);
  const [quantityStr, setQuantityStr] = useState(item.quantityStr);
  const [unit, setUnit] = useState(item.unit || 'un');
  const [priceStr, setPriceStr] = useState(item.priceStr);
  const [error, setError] = useState<string | null>(null);

  const availableUnits = Array.from(
    new Set([...DEFAULT_UNITS, unit || 'un']),
  );

  const parsedPrice = AppFormatters.parsePrice(priceStr) ?? 0;
  const parsedQty = AppFormatters.parseQuantity(quantityStr, unit) ?? 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome do produto');
      return;
    }

    const finalPrice = AppFormatters.parsePrice(priceStr) ?? item.price;
    const finalQty =
      AppFormatters.parseQuantity(quantityStr, unit) ??
      (item.quantity > 0 ? item.quantity : 1);
    const finalUnitPrice =
      finalQty > 0
        ? Number((finalPrice / finalQty).toFixed(2))
        : finalPrice;

    onSave({
      ...item,
      name: name.trim(),
      category,
      quantity: finalQty,
      quantityStr:
        finalQty === Math.round(finalQty)
          ? String(finalQty)
          : finalQty.toString().replace('.', ','),
      unit,
      price: finalPrice,
      priceStr: finalPrice > 0 ? finalPrice.toFixed(2).replace('.', ',') : '',
      unitPrice: finalUnitPrice,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-xs sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 pb-8 shadow-2xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]">
              <CategoryIcon category={category} size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                {isNew
                  ? 'Adicionar item à nota'
                  : `Editar item #${String(itemNumber).padStart(2, '0')}`}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {isNew
                  ? 'Informe os dados do produto'
                  : 'Ajuste nome, quantidade, unidade, categoria e preço'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar edição do item"
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-[var(--negative)]/25 bg-[var(--negative-soft)] px-3 py-2 text-xs font-medium text-[var(--negative)]">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Nome do produto
            </label>
            <input
              type="text"
              autoFocus={isNew}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Ex: Leite Integral"
              className="h-11 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-base sm:text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent)] focus:bg-[var(--bg-surface)] focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Categoria
            </label>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as ProductCategoryId)
              }
              className="h-11 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-base sm:text-sm font-medium text-[var(--text-secondary)] outline-none transition-colors focus:border-[var(--accent)] focus:bg-[var(--bg-surface)]"
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Quantidade
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="1"
                value={quantityStr}
                onChange={(e) => setQuantityStr(e.target.value)}
                className="font-mono-tabular h-11 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-center text-base sm:text-sm font-medium text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)] focus:bg-[var(--bg-surface)]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Unidade
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="h-11 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-base sm:text-sm font-medium text-[var(--text-secondary)] outline-none transition-colors focus:border-[var(--accent)] focus:bg-[var(--bg-surface)]"
              >
                {availableUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Preço total na nota (R$)
            </label>
            <div className="flex h-11 items-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 transition-colors focus-within:border-[var(--accent)] focus-within:bg-[var(--bg-surface)] focus-within:ring-1 focus-within:ring-[var(--accent)]">
              <span className="select-none text-sm font-semibold text-[var(--text-muted)] mr-2">
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                className="font-mono-tabular w-full bg-transparent text-right text-base sm:text-sm font-bold text-[var(--accent-fg)] outline-none"
              />
            </div>
          </div>

          {/* Resumo e Cálculo */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-3.5">
            <div>
              <p className="text-xs font-medium text-[var(--text-primary)]">
                Total deste item
              </p>
              {parsedQty > 0 && Math.abs(parsedQty - 1) > 0.001 && parsedPrice > 0 ? (
                <p className="font-mono-tabular text-xs text-[var(--text-muted)]">
                  Preço unitário: {AppFormatters.formatCurrency(parsedPrice / parsedQty)} / {unit}
                </p>
              ) : (
                <p className="text-[11px] text-[var(--text-muted)]">
                  {parsedQty} {unit}
                </p>
              )}
            </div>
            <span className="font-mono-tabular text-base font-bold text-[var(--accent-fg)]">
              {AppFormatters.formatCurrency(parsedPrice)}
            </span>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="submit"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-sm font-medium text-[var(--accent-ink)] transition-transform duration-150 ease-ui active:scale-[0.98]"
            >
              <Check size={18} strokeWidth={1.5} />
              {isNew ? 'Adicionar à lista' : 'Salvar alterações'}
            </button>
            {!isNew && (
              <button
                type="button"
                onClick={() => {
                  onRemove(item.id);
                  onClose();
                }}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] text-xs font-medium text-[var(--negative)] transition-colors hover:bg-[var(--negative-soft)]"
              >
                <Trash2 size={15} strokeWidth={1.5} />
                Excluir item da lista
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

interface SwipeableScannedReceiptItemRowProps {
  item: EditableReceiptItem;
  itemIndex: number;
  onOpenEdit: (item: EditableReceiptItem) => void;
  onRemove: (id: string) => void;
}

export function SwipeableScannedReceiptItemRow({
  item,
  itemIndex,
  onOpenEdit,
  onRemove,
}: SwipeableScannedReceiptItemRowProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const currentDeltaXRef = useRef<number>(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const isLongPressTriggeredRef = useRef(false);
  const isPressActiveRef = useRef(false);
  const lastPointerEventAtRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoryInfo = PRODUCT_CATEGORY_MAP[item.category];
  const showUnitPrice =
    item.quantity > 0 &&
    Math.abs(item.quantity - 1) > 0.001 &&
    item.price > 0;

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const isMouseDuplicateAfterPointer = (e: React.SyntheticEvent): boolean => {
    return (
      e.type.startsWith('mouse') &&
      Date.now() - lastPointerEventAtRef.current < 1000
    );
  };

  const getCoords = (e: React.SyntheticEvent) => {
    const anyE = e as unknown as {
      clientX?: number;
      clientY?: number;
    };
    return {
      clientX: anyE.clientX ?? 0,
      clientY: anyE.clientY ?? 0,
    };
  };

  const handlePressStart = (e: React.SyntheticEvent) => {
    if (e.type.startsWith('pointer')) {
      const pe = e as React.PointerEvent;
      if (pe.pointerType === 'mouse' && pe.button !== 0) return;
      lastPointerEventAtRef.current = Date.now();
    } else if (isMouseDuplicateAfterPointer(e)) {
      return;
    }

    if (isDismissed || isPressActiveRef.current) return;
    isPressActiveRef.current = true;

    const { clientX, clientY } = getCoords(e);
    startXRef.current = clientX;
    startYRef.current = clientY;
    currentDeltaXRef.current = 0;
    isHorizontalSwipeRef.current = null;
    isLongPressTriggeredRef.current = false;
    clearLongPressTimer();

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(40);
        } catch (_) {}
      }
      onOpenEdit(item);
    }, 450);
  };

  const handlePressMove = (e: React.SyntheticEvent) => {
    if (e.type.startsWith('pointer')) {
      lastPointerEventAtRef.current = Date.now();
    } else if (isMouseDuplicateAfterPointer(e)) {
      return;
    }

    if (isDismissed || !isPressActiveRef.current) return;
    const { clientX, clientY } = getCoords(e);
    const deltaX = clientX - startXRef.current;
    const deltaY = clientY - startYRef.current;

    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        isHorizontalSwipeRef.current = Math.abs(deltaX) > Math.abs(deltaY);
        if (isHorizontalSwipeRef.current) {
          clearLongPressTimer();
        }
      }
    }

    if (isHorizontalSwipeRef.current) {
      clearLongPressTimer();
      currentDeltaXRef.current = deltaX;
      if (deltaX < 0) {
        setIsSwiping(true);
        const damped = deltaX < -120 ? -120 + (deltaX + 120) * 0.25 : deltaX;
        setTranslateX(damped);
      } else {
        setTranslateX(0);
      }
    } else if (Math.abs(deltaY) > 8) {
      clearLongPressTimer();
    }
  };

  const handlePressEnd = (e: React.SyntheticEvent) => {
    if (e.type.startsWith('pointer')) {
      lastPointerEventAtRef.current = Date.now();
    } else if (isMouseDuplicateAfterPointer(e)) {
      return;
    }

    if (!isPressActiveRef.current) return;
    isPressActiveRef.current = false;
    clearLongPressTimer();

    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      setIsSwiping(false);
      setTranslateX(0);
      currentDeltaXRef.current = 0;
      return;
    }

    if (isSwiping || currentDeltaXRef.current < -15) {
      setIsSwiping(false);
      if (currentDeltaXRef.current < -80) {
        setIsDismissed(true);
        setTranslateX(-500);
        setTimeout(() => {
          onRemove(item.id);
        }, 220);
        return;
      }
      setTranslateX(0);
      currentDeltaXRef.current = 0;
    }
  };

  const handlePressCancel = () => {
    lastPointerEventAtRef.current = Date.now();
    isPressActiveRef.current = false;
    isLongPressTriggeredRef.current = false;
    clearLongPressTimer();
    setIsSwiping(false);
    setTranslateX(0);
    currentDeltaXRef.current = 0;
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl select-none transition-[opacity,transform] duration-200 ease-ui ${
        isDismissed ? 'pointer-events-none h-0 opacity-0' : 'opacity-100'
      }`}
    >
      {/* Delete reveal layer */}
      <div
        className={`absolute inset-0 flex items-center justify-end rounded-xl bg-[var(--negative)] px-4 text-[#FDFBF7] transition-opacity duration-150 ease-ui ${
          translateX < -5 ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-medium">
          <span>Remover</span>
          <Trash2 size={16} strokeWidth={1.5} />
        </div>
      </div>

      {/* Foreground product card */}
      <div
        onPointerDown={handlePressStart}
        onPointerMove={handlePressMove}
        onPointerUp={handlePressEnd}
        onPointerCancel={handlePressCancel}
        onMouseDown={handlePressStart}
        onMouseMove={handlePressMove}
        onMouseUp={handlePressEnd}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isSwiping
            ? 'none'
            : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          touchAction: 'pan-y',
        }}
        className="relative flex cursor-pointer touch-pan-y items-center justify-between gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-3 shadow-2xs transition-colors duration-150 ease-ui active:bg-[var(--bg-subtle)] hover:border-[var(--border-subtle)]"
      >
        {/* Left: Index badge + Name + Category + Qty/Unit */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span
              className="font-mono-tabular flex h-5 w-6 shrink-0 items-center justify-center rounded bg-[var(--bg-subtle)] text-[10px] font-bold text-[var(--text-muted)] border border-[var(--border-hairline)]"
              title={`Item #${itemIndex}`}
            >
              #{String(itemIndex).padStart(2, '0')}
            </span>
            <p className="truncate text-xs font-medium text-[var(--text-primary)] sm:text-sm">
              {item.name || '(Sem nome)'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
            <span className="rounded bg-[var(--bg-subtle)] px-2 py-0.5 font-medium text-[var(--text-secondary)]">
              {categoryInfo?.label ?? item.category}
            </span>
            <span className="font-mono-tabular font-medium text-[var(--text-muted)]">
              {AppFormatters.formatQuantity(item.quantity, item.unit)}
            </span>
            {showUnitPrice && (
              <span className="font-mono-tabular text-[10px] text-[var(--text-muted)]">
                ({AppFormatters.formatCurrency(item.price / item.quantity)}/{item.unit})
              </span>
            )}
          </div>
        </div>

        {/* Right: Price ONLY (no buttons!) */}
        <div className="flex shrink-0 items-center pl-2">
          <span className="font-mono-tabular text-sm font-semibold text-[var(--accent-fg)]">
            {AppFormatters.formatCurrency(item.price)}
          </span>
        </div>
      </div>
    </div>
  );
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
  const [editingItem, setEditingItem] = useState<EditableReceiptItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

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
    setIsAddingNew(true);
    setEditingItem(newItem);
  };

  const handleClearAllItems = () => {
    setScannedItems([]);
  };

  const handleSaveModalItem = (updated: EditableReceiptItem) => {
    if (isAddingNew) {
      setScannedItems((prev) => [...prev, updated]);
    } else {
      setScannedItems((prev) =>
        prev.map((it) => (it.id === updated.id ? updated : it)),
      );
    }
    setEditingItem(null);
    setIsAddingNew(false);
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
    <>
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
                      Segure para editar • Deslize para a esquerda para remover
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

                <div className="max-h-80 space-y-2 overflow-y-auto pr-1 sm:max-h-96">
                  {scannedItems.map((item, idx) => (
                    <SwipeableScannedReceiptItemRow
                      key={item.id}
                      item={item}
                      itemIndex={idx + 1}
                      onOpenEdit={(it) => {
                        setIsAddingNew(false);
                        setEditingItem(it);
                      }}
                      onRemove={handleRemoveItem}
                    />
                  ))}
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

      {editingItem && (
        <EditScannedItemModal
          item={editingItem}
          itemNumber={
            isAddingNew
              ? scannedItems.length + 1
              : scannedItems.findIndex((it) => it.id === editingItem.id) + 1 ||
                1
          }
          isNew={isAddingNew}
          onSave={handleSaveModalItem}
          onRemove={handleRemoveItem}
          onClose={() => {
            setEditingItem(null);
            setIsAddingNew(false);
          }}
        />
      )}
    </>
  );
}
