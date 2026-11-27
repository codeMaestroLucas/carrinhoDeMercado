import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronLeft,
  Crop,
  ExternalLink,
  FileText,
  Hand,
  Image as ImageIcon,
  Plus,
  QrCode,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  PRODUCT_CATEGORY_MAP,
  type PurchaseHistoryItem,
} from '../../types/shopping';
import { useShoppingStore } from '../../store/useShoppingStore';
import { NfceScannerService } from '../../services/nfceParserService';
import { ReceiptScannerService } from '../../services/receiptParserService';
import { AppFormatters } from '../../utils/formatters';
import { ModalShell } from '../common/ModalShell';
import { SwipeableRow } from '../common/SwipeableRow';
import { EditScannedItemModal } from './EditScannedItemModal';
import { ReceiptImageEditor } from './ReceiptImageEditor';
import {
  toEditableItem,
  type EditableReceiptItem,
} from './receiptImportTypes';
import { useQrScanner } from './useQrScanner';

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
  const [modeDirection, setModeDirection] = useState<'forward' | 'backward'>('forward');
  const [marketId, setMarketId] = useState(selectedMarketId);
  const [newMarketName, setNewMarketName] = useState('');
  const [isCreatingMarket, setIsCreatingMarket] = useState(false);

  const [qrInput, setQrInput] = useState('');
  const [resolvedSefazUrl, setResolvedSefazUrl] = useState<string | null>(null);

  const [pendingOcrFile, setPendingOcrFile] = useState<File | null>(null);
  const [lastOriginalOcrFile, setLastOriginalOcrFile] = useState<File | null>(null);
  const [editedPreviewUrl, setEditedPreviewUrl] = useState<string | null>(null);

  const [pasteText, setPasteText] = useState('');
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [scannedItems, setScannedItems] = useState<EditableReceiptItem[]>([]);
  const [editingItem, setEditingItem] = useState<EditableReceiptItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [tapHintVisible, setTapHintVisible] = useState(false);
  const tapHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');

  const handleItemTap = () => {
    if (tapHintTimeoutRef.current) {
      clearTimeout(tapHintTimeoutRef.current);
    }
    setTapHintVisible(true);
    tapHintTimeoutRef.current = setTimeout(() => {
      setTapHintVisible(false);
    }, 2800);
  };

  useEffect(() => {
    return () => {
      if (tapHintTimeoutRef.current) {
        clearTimeout(tapHintTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (editedPreviewUrl) {
        URL.revokeObjectURL(editedPreviewUrl);
      }
    };
  }, [editedPreviewUrl]);

  const qrRegionId = 'nfce-qr-reader-region';

  const applyScannedMarketMatch = useCallback(
    (marketName?: string) => {
      if (!marketName) return;
      const trimmed = marketName.trim();
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
    },
    [markets],
  );

  const handleProcessQrOrKey = useCallback(
    async (raw: string) => {
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
          applyScannedMarketMatch(res.marketName);
        } else {
          setStatusError(
            res.errorMessage ??
              'Não foi possível extrair os itens automaticamente',
          );
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [applyScannedMarketMatch, predictCategory],
  );

  const handleQrDecoded = useCallback(
    (decodedText: string) => {
      setQrInput(decodedText);
      void handleProcessQrOrKey(decodedText);
    },
    [handleProcessQrOrKey],
  );

  const handleQrError = useCallback((msg: string) => {
    setStatusError(msg);
  }, []);

  const {
    isCameraActive,
    cameraZoom,
    zoomCaps,
    applyCameraZoom,
    startQrCamera,
    stopCamera,
  } = useQrScanner({
    regionId: qrRegionId,
    onDecoded: handleQrDecoded,
    onError: handleQrError,
  });

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatusError(null);
    setLastOriginalOcrFile(file);
    setPendingOcrFile(file);
  };

  const runOcrOnFile = async (file: File) => {
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
    }
  };

  const handleConfirmEditedPhoto = (editedFile: File, previewUrl: string) => {
    setPendingOcrFile(null);
    setEditedPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });
    void runOcrOnFile(editedFile);
  };

  const handleRemoveOcrPhoto = () => {
    setEditedPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setLastOriginalOcrFile(null);
    setPendingOcrFile(null);
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
        applyScannedMarketMatch(res.marketName);
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
      priceStr: price > 0 ? AppFormatters.formatPriceInput(price) : '',
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
      <ModalShell
        onClose={() => {
          void stopCamera();
          onClose();
        }}
        ariaLabel="Importar cupom fiscal"
        maxWidthClass="max-w-xl"
        panelClassName="max-h-[93vh] overflow-y-auto overscroll-contain bg-[var(--bg-app)] p-6 pb-8"
        lockBodyScroll
      >
        <div
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border-subtle)] sm:hidden" />

          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
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
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
            >
              <X size={18} strokeWidth={1.8} />
            </button>
          </div>

          <div className="segmented-track mb-5 grid w-full grid-cols-3">
            {[
              { id: 'qr' as const, label: 'QR Code', icon: QrCode, idx: 0 },
              { id: 'ocr' as const, label: 'Foto OCR', icon: Camera, idx: 1 },
              { id: 'paste' as const, label: 'Texto / Manual', icon: FileText, idx: 2 },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = mode === tab.id;
              const currentIdx = mode === 'qr' ? 0 : mode === 'ocr' ? 1 : 2;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (mode === 'qr' && tab.id !== 'qr') void stopCamera();
                    setModeDirection(tab.idx >= currentIdx ? 'forward' : 'backward');
                    setMode(tab.id);
                  }}
                  className={`segmented-item flex h-9 items-center justify-center gap-1.5 text-xs ${
                    active
                      ? 'segmented-item-active text-[var(--accent-fg)]'
                      : ''
                  }`}
                >
                  <Icon size={15} strokeWidth={1.8} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
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

            {mode === 'qr' && (
              <div
                key="mode-qr"
                className={`space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 ${
                  modeDirection === 'forward'
                    ? 'animate-slide-forward'
                    : 'animate-slide-backward'
                }`}
              >
                <div
                  className={`relative overflow-hidden rounded-xl bg-black ${
                    isCameraActive ? 'block min-h-[260px]' : 'hidden'
                  }`}
                >
                  <div id={qrRegionId} className="w-full" />

                  {isCameraActive && (
                    <div className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-between gap-2 rounded-full bg-black/65 px-2.5 py-1.5 text-white backdrop-blur-md">
                      <button
                        type="button"
                        aria-label="Diminuir zoom"
                        onClick={() =>
                          void applyCameraZoom(cameraZoom - Math.max(0.25, zoomCaps.step))
                        }
                        disabled={cameraZoom <= zoomCaps.min}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-35"
                      >
                        <ZoomOut size={14} strokeWidth={2} />
                      </button>

                      <div className="flex items-center gap-1">
                        {[1, 2, 3]
                          .filter((preset) => preset >= zoomCaps.min && preset <= zoomCaps.max)
                          .map((preset) => {
                            const isSelected = Math.abs(cameraZoom - preset) < 0.2;
                            return (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => void applyCameraZoom(preset)}
                                className={`font-mono-tabular h-6 min-w-[34px] rounded-full px-2 text-[11px] font-semibold transition-all ${
                                  isSelected
                                    ? 'bg-[#30D158] text-[#052E16]'
                                    : 'bg-white/10 text-white/85 hover:bg-white/20'
                                }`}
                              >
                                {preset}x
                              </button>
                            );
                          })}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-tabular min-w-[32px] text-right text-[11px] font-medium text-white/80">
                          {cameraZoom.toFixed(1)}x
                        </span>
                        <button
                          type="button"
                          aria-label="Aumentar zoom"
                          onClick={() =>
                            void applyCameraZoom(cameraZoom + Math.max(0.25, zoomCaps.step))
                          }
                          disabled={cameraZoom >= zoomCaps.max}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-35"
                        >
                          <ZoomIn size={14} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
                    className="btn-tinted h-9 px-4 text-xs disabled:opacity-40"
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

            {mode === 'ocr' && (
              <div
                key="mode-ocr"
                className={`space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 text-center ${
                  modeDirection === 'forward'
                    ? 'animate-slide-forward'
                    : 'animate-slide-backward'
                }`}
              >
                {!editedPreviewUrl ? (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-app)] px-4 py-6 transition-colors duration-150 ease-ui hover:border-[var(--accent)]/40 hover:bg-[var(--bg-subtle)]">
                      <Camera size={22} strokeWidth={1.6} className="text-[var(--accent-fg)]" />
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        Tirar foto do cupom
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        Cortar, girar e ajustar antes do OCR
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoSelected}
                        className="hidden"
                      />
                    </label>

                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-app)] px-4 py-6 transition-colors duration-150 ease-ui hover:border-[var(--accent)]/40 hover:bg-[var(--bg-subtle)]">
                      <ImageIcon size={22} strokeWidth={1.6} className="text-[var(--accent-fg)]" />
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        Escolher da galeria
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        Editar foto salva no aparelho
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoSelected}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-3 text-left sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={editedPreviewUrl}
                        alt="Prévia do cupom editado"
                        className="h-14 w-14 shrink-0 rounded-lg border border-[var(--border-hairline)] object-cover"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">
                          Foto do cupom pronta
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {isProcessing
                            ? 'Extraindo itens pelo OCR...'
                            : 'Recortada e ajustada'}
                        </p>
                      </div>
                    </div>

                    {!isProcessing && (
                      <div className="flex items-center gap-2">
                        {lastOriginalOcrFile && (
                          <button
                            type="button"
                            onClick={() => setPendingOcrFile(lastOriginalOcrFile)}
                            className="btn-tinted flex h-8 flex-1 items-center justify-center gap-1.5 px-3 text-xs sm:flex-initial"
                          >
                            <Crop size={13} strokeWidth={2} />
                            Reeditar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleRemoveOcrPhoto}
                          aria-label="Remover foto"
                          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--negative)]/20 bg-[var(--negative-soft)] px-3 text-xs font-semibold text-[var(--negative)] transition-colors hover:brightness-95 active:scale-[0.98] sm:flex-initial"
                        >
                          <Trash2 size={13} strokeWidth={1.8} />
                          Remover foto
                        </button>
                      </div>
                    )}
                  </div>
                )}

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

            {mode === 'paste' && (
              <div
                key="mode-paste"
                className={`space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 ${
                  modeDirection === 'forward'
                    ? 'animate-slide-forward'
                    : 'animate-slide-backward'
                }`}
              >
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
                    className="btn-primary h-9 w-9 p-0"
                  >
                    <Plus size={16} strokeWidth={2} />
                  </button>
                </form>
              </div>
            )}

            {statusError && (
              <div className="animate-shake rounded-2xl border border-[#B45309]/25 bg-[#FEF3C7]/60 p-3 text-xs font-medium text-[#92400E] dark:bg-[#78350F]/25 dark:text-[#FCD34D]">
                {statusError}
              </div>
            )}

            {scannedItems.length > 0 && (
              <div className="space-y-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border-hairline)] pb-2.5">
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                      Itens identificados (<span className="font-mono-tabular">{scannedItems.length}</span>)
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                        <Hand size={11} className="text-[var(--accent-fg)]" strokeWidth={2} />
                        Segure p/ editar
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                        <ChevronLeft size={11} className="text-[var(--negative)]" strokeWidth={2.5} />
                        Deslize p/ excluir
                      </span>
                    </div>
                  </div>
                  <div className="text-right sm:self-center">
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

                <div className="max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-96">
                  {scannedItems.map((item, idx) => {
                    const categoryInfo = PRODUCT_CATEGORY_MAP[item.category];
                    const showUnitPrice =
                      item.quantity > 0 &&
                      Math.abs(item.quantity - 1) > 0.001 &&
                      item.price > 0;
                    return (
                      <SwipeableRow
                        key={item.id}
                        peekOnMount={idx === 0}
                        longPressHapticMs={40}
                        onTap={handleItemTap}
                        onLongPress={() => {
                          setIsAddingNew(false);
                          setEditingItem(item);
                        }}
                        onRemove={() => handleRemoveItem(item.id)}
                        removeLabel={`Remover ${item.name || 'item'}`}
                        containerClassName="relative overflow-hidden rounded-xl select-none touch-pan-y"
                        revealClassName="absolute inset-0 flex items-center justify-end rounded-xl bg-[var(--negative)] px-4 text-[#FDFBF7]"
                        foregroundClassName="relative flex cursor-pointer touch-pan-y items-center justify-between gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)] p-3 shadow-2xs transition-colors duration-150 ease-ui hover:border-[var(--border-subtle)]"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="font-mono-tabular flex h-5 w-6 shrink-0 items-center justify-center rounded bg-[var(--bg-subtle)] text-[10px] font-bold text-[var(--text-muted)] border border-[var(--border-hairline)]"
                              title={`Item #${idx + 1}`}
                            >
                              #{String(idx + 1).padStart(2, '0')}
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

                        <div className="flex shrink-0 items-center pl-2">
                          <span className="font-mono-tabular text-sm font-semibold text-[var(--accent-fg)]">
                            {AppFormatters.formatCurrency(item.price)}
                          </span>
                        </div>
                      </SwipeableRow>
                    );
                  })}
                </div>

                {tapHintVisible && (
                  <div className="pointer-events-none flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 py-1.5 text-center text-[11px] font-medium text-[var(--text-secondary)] animate-enter shadow-xs">
                    <Sparkles size={13} className="shrink-0 text-[var(--accent-fg)]" />
                    <span>Dica: segure o item para editar • deslize para a esquerda para excluir</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSavePurchase}
                  className="btn-primary h-11 w-full text-sm"
                >
                  <Check size={17} strokeWidth={2} />
                  Salvar compra no histórico
                </button>
              </div>
            )}
          </div>
        </div>
      </ModalShell>

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

      {pendingOcrFile && (
        <ReceiptImageEditor
          file={pendingOcrFile}
          onCancel={() => setPendingOcrFile(null)}
          onConfirm={handleConfirmEditedPhoto}
        />
      )}
    </>
  );
}
