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

  const [scannedItems, setScannedItems] = useState<ScannedReceiptItem[]>([]);
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
        `Não foi possível iniciar a câmera (${err instanceof Error ? err.message : String(err)}). Verifique a permissão ou cole o link/chave abaixo.`,
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
        setScannedItems(res.items);
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
            'Não foi possível extrair os itens automaticamente.',
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
          'OCR concluiu, mas nenhum item com preço claro foi detectado automaticamente. Revise o texto abaixo.',
        );
      } else {
        setScannedItems(items);
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

    if (raw.includes('<') && (raw.includes('txtTit') || raw.includes('<tr') || raw.includes('<li'))) {
      const res = NfceScannerService.parseNfceHtml(raw);
      if (res.items.length > 0) {
        setScannedItems(res.items);
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
        'Nenhum item com preço válido encontrado no texto colado.',
      );
    } else {
      setScannedItems(items);
    }
  };

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    const price = AppFormatters.parsePrice(manualPrice);
    if (!manualName.trim() || price == null || price <= 0) return;
    const name = manualName.trim();
    setScannedItems((prev) => [
      ...prev,
      {
        name,
        price,
        unitPrice: price,
        quantity: 1,
        unit: 'un',
        category: predictCategory(name),
        itemIndex: prev.length + 1,
      },
    ]);
    setManualName('');
    setManualPrice('');
  };

  const handleSavePurchase = () => {
    if (scannedItems.length === 0) return;

    let finalMarketId = marketId;
    if (isCreatingMarket && newMarketName.trim()) {
      const created = addMarket(newMarketName.trim());
      finalMarketId = created.id;
    }

    const targetMarketName =
      markets.find((m) => m.id === finalMarketId)?.name ??
      (isCreatingMarket ? newMarketName.trim() : 'Mercado');

    const historyItems: PurchaseHistoryItem[] = scannedItems.map((item) => ({
      name: item.name,
      category: item.category ?? predictCategory(item.name),
      price: item.price,
      unitPrice: item.unitPrice,
      quantity: item.quantity > 0 ? item.quantity : 1,
      unit: item.unit || 'un',
    }));

    const rec = addPurchaseFromItems({
      marketId: finalMarketId,
      items: historyItems,
    });
    if (rec) {
      onImported(targetMarketName, historyItems.length);
    }
    onClose();
  };

  const totalExtracted = scannedItems.reduce((sum, i) => sum + i.price, 0);

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
        className="max-h-[93vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-[#F8F9FA] p-5 pb-8 shadow-2xl dark:bg-[#121417] sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-[#111827] dark:text-[#F3F4F6]">
              Importar Compra / Cupom Fiscal
            </h2>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              QR Code NFC-e, Foto OCR ou colagem manual
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void stopCamera();
              onClose();
            }}
            className="rounded-full p-1.5 text-[#6B7280] hover:bg-black/5 dark:text-[#9CA3AF]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-2xl bg-[#E5E7EB]/60 p-1 dark:bg-[#1E2229]">
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
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                  active
                    ? 'bg-white text-[#00C853] shadow-2xs dark:bg-[#121417]'
                    : 'text-[#6B7280] dark:text-[#9CA3AF]'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {/* Target Market */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3.5 dark:border-[#2E3440] dark:bg-[#1E2229]">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF]">
                Supermercado da compra
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingMarket((v) => !v)}
                className="text-[11px] font-bold text-[#00C853]"
              >
                {isCreatingMarket ? 'Escolher existente' : '+ Novo mercado'}
              </button>
            </div>
            {isCreatingMarket ? (
              <input
                type="text"
                placeholder="Nome do novo supermercado..."
                value={newMarketName}
                onChange={(e) => setNewMarketName(e.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-3 py-2 text-xs font-semibold text-[#111827] outline-none dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
              />
            ) : (
              <select
                value={marketId}
                onChange={(e) => setMarketId(e.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-3 py-2 text-xs font-semibold text-[#111827] outline-none dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
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
            <div className="space-y-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 dark:border-[#2E3440] dark:bg-[#1E2229]">
              <div
                id={qrRegionId}
                className={`overflow-hidden rounded-2xl bg-black ${
                  isCameraActive ? 'block min-h-[240px]' : 'hidden'
                }`}
              />
              {!isCameraActive ? (
                <button
                  type="button"
                  onClick={() => void startQrCamera()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00C853] py-2.5 text-xs font-bold text-white"
                >
                  <QrCode size={16} />
                  Abrir Câmera para Ler QR Code NFC-e
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void stopCamera()}
                  className="w-full rounded-xl border border-red-500/30 bg-red-500/10 py-2 text-xs font-bold text-red-600"
                >
                  Parar Câmera
                </button>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ou cole o link da SEFAZ / chave de 44 dígitos..."
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  className="flex-1 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-3 py-2 text-xs text-[#111827] outline-none dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
                />
                <button
                  type="button"
                  disabled={!qrInput.trim() || isProcessing}
                  onClick={() => void handleProcessQrOrKey(qrInput)}
                  className="rounded-xl bg-[#111827] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40 dark:bg-[#F3F4F6] dark:text-[#111827]"
                >
                  Ler
                </button>
              </div>

              {resolvedSefazUrl && (
                <div className="flex items-center justify-between rounded-xl bg-[#00C853]/10 px-3 py-2 text-[11px]">
                  <span className="truncate font-semibold text-[#111827] dark:text-[#F3F4F6]">
                    Portal SEFAZ identificado
                  </span>
                  <a
                    href={resolvedSefazUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 flex shrink-0 items-center gap-1 font-bold text-[#00C853] hover:underline"
                  >
                    Abrir nota <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* OCR Photo Mode */}
          {mode === 'ocr' && (
            <div className="space-y-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 text-center dark:border-[#2E3440] dark:bg-[#1E2229]">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#00C853]/40 bg-[#00C853]/5 px-4 py-7 transition hover:bg-[#00C853]/10">
                <Upload size={26} className="text-[#00C853]" />
                <span className="text-xs font-bold text-[#111827] dark:text-[#F3F4F6]">
                  Fotografar ou escolher imagem do cupom
                </span>
                <span className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                  Reconhecimento OCR direto no navegador (funciona offline)
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
                <div className="space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#2E3440]">
                    <div
                      className="h-full bg-[#00C853] transition-all"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
                    Lendo cupom fiscal... {ocrProgress}%
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Paste Text / HTML / Manual Mode */}
          {mode === 'paste' && (
            <div className="space-y-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 dark:border-[#2E3440] dark:bg-[#1E2229]">
              <textarea
                rows={4}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Cole aqui o texto copiado da página da SEFAZ ou do cupom fiscal..."
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-3 text-xs text-[#111827] outline-none dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
              />
              <button
                type="button"
                disabled={!pasteText.trim()}
                onClick={handleParsePastedContent}
                className="w-full rounded-xl bg-[#00C853] py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                Extrair Itens do Texto
              </button>

              <form
                onSubmit={handleAddManualItem}
                className="flex gap-2 border-t border-[#E5E7EB] pt-3 dark:border-[#2E3440]"
              >
                <input
                  type="text"
                  placeholder="Adicionar item manual..."
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="flex-1 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-3 py-2 text-xs text-[#111827] outline-none dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Preço"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  className="w-20 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-2.5 py-2 text-xs font-bold text-[#111827] outline-none dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
                />
                <button
                  type="submit"
                  aria-label="Adicionar item manual"
                  className="flex items-center justify-center rounded-xl bg-[#111827] px-3 text-white dark:bg-[#F3F4F6] dark:text-[#111827]"
                >
                  <Plus size={16} />
                </button>
              </form>
            </div>
          )}

          {statusError && (
            <div className="rounded-2xl bg-amber-500/12 p-3 text-xs font-medium text-amber-700 dark:text-amber-300">
              {statusError}
            </div>
          )}

          {/* Extracted Items Preview & Editor */}
          {scannedItems.length > 0 && (
            <div className="space-y-2.5 rounded-2xl border border-[#E5E7EB] bg-white p-4 dark:border-[#2E3440] dark:bg-[#1E2229]">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-[#111827] dark:text-[#F3F4F6]">
                  Itens Identificados ({scannedItems.length})
                </h3>
                <span className="text-xs font-extrabold text-[#00C853]">
                  Total: {AppFormatters.formatCurrency(totalExtracted)}
                </span>
              </div>

              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {scannedItems.map((item, idx) => (
                  <div
                    key={`${item.name}_${idx}`}
                    className="flex items-center gap-2 rounded-xl bg-[#F8F9FA] p-2.5 text-xs dark:bg-[#181B20]"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setScannedItems((prev) =>
                            prev.map((it, i) =>
                              i === idx ? { ...it, name: val } : it,
                            ),
                          );
                        }}
                        className="w-full bg-transparent font-bold text-[#111827] outline-none dark:text-[#F3F4F6]"
                      />
                      <div className="flex items-center gap-2">
                        <select
                          value={item.category ?? predictCategory(item.name)}
                          onChange={(e) => {
                            const cat = e.target.value as ProductCategoryId;
                            setScannedItems((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, category: cat } : it,
                              ),
                            );
                          }}
                          className="rounded-lg bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#6B7280] outline-none dark:bg-[#1E2229] dark:text-[#9CA3AF]"
                        >
                          {PRODUCT_CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                          {AppFormatters.formatQuantity(item.quantity, item.unit)}
                        </span>
                      </div>
                    </div>

                    <span className="shrink-0 font-bold text-[#00C853]">
                      {AppFormatters.formatCurrency(item.price)}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setScannedItems((prev) =>
                          prev.filter((_, i) => i !== idx),
                        )
                      }
                      aria-label="Remover item extraído"
                      className="rounded-lg p-1 text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleSavePurchase}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#00C853] py-3 text-xs font-bold text-white shadow-sm"
              >
                <Check size={16} />
                Salvar Compra no Histórico
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
