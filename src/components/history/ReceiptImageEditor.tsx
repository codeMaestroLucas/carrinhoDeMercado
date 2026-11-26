import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Contrast,
  Crop,
  Maximize2,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sun,
  Undo2,
  X,
} from 'lucide-react';

export interface CropRect {
  /** Normalized 0..1 */
  x: number;
  y: number;
  width: number;
  height: number;
}

type DragHandle =
  | 'move'
  | 'nw'
  | 'ne'
  | 'sw'
  | 'se'
  | 'n'
  | 's'
  | 'e'
  | 'w';

interface ReceiptImageEditorProps {
  file: File;
  onCancel: () => void;
  onConfirm: (editedFile: File, previewUrl: string) => void;
}

const MIN_CROP_SIZE = 0.08;
const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getRotatedBaseDimensions(
  naturalWidth: number,
  naturalHeight: number,
  rotation: number,
): { width: number; height: number } {
  const normalized = ((rotation % 360) + 360) % 360;
  if (normalized === 90 || normalized === 270) {
    return { width: naturalHeight, height: naturalWidth };
  }
  return { width: naturalWidth, height: naturalHeight };
}

function drawRotatedImageToCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  rotation: number,
  straighten: number,
  maxDimension: number,
): { width: number; height: number } {
  const base = getRotatedBaseDimensions(
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
    rotation,
  );
  const scale = Math.min(1, maxDimension / Math.max(base.width, base.height, 1));
  const targetW = Math.max(1, Math.round(base.width * scale));
  const targetH = Math.max(1, Math.round(base.height * scale));

  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d');
  if (!ctx) return { width: targetW, height: targetH };

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.save();
  ctx.translate(targetW / 2, targetH / 2);
  ctx.rotate(((rotation + straighten) * Math.PI) / 180);

  const drawW = (img.naturalWidth || img.width) * scale;
  const drawH = (img.naturalHeight || img.height) * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  return { width: targetW, height: targetH };
}

function applyPixelAdjustments(
  imageData: ImageData,
  brightness: number,
  contrast: number,
  enhanceText: boolean,
): ImageData {
  const brightnessFactor = 1 + brightness / 100;
  const effectiveContrast = enhanceText ? contrast + 35 : contrast;
  const contrastFactor = 1 + effectiveContrast / 100;

  if (brightnessFactor === 1 && contrastFactor === 1 && !enhanceText) {
    return imageData;
  }

  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (brightnessFactor !== 1) {
      r *= brightnessFactor;
      g *= brightnessFactor;
      b *= brightnessFactor;
    }
    if (contrastFactor !== 1) {
      r = (r - 128) * contrastFactor + 128;
      g = (g - 128) * contrastFactor + 128;
      b = (b - 128) * contrastFactor + 128;
    }
    if (enhanceText) {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = lum;
      g = lum;
      b = lum;
    }

    data[i] = clamp(Math.round(r), 0, 255);
    data[i + 1] = clamp(Math.round(g), 0, 255);
    data[i + 2] = clamp(Math.round(b), 0, 255);
  }
  return imageData;
}

export function ReceiptImageEditor({
  file,
  onCancel,
  onConfirm,
}: ReceiptImageEditorProps) {
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'crop' | 'adjust'>('crop');

  const [rotation, setRotation] = useState<number>(0);
  const [straighten, setStraighten] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(0);
  const [enhanceText, setEnhanceText] = useState<boolean>(false);
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    handle: DragHandle;
    startClientX: number;
    startClientY: number;
    startCrop: CropRect;
    stageWidth: number;
    stageHeight: number;
  } | null>(null);

  // Load File into HTMLImageElement
  useEffect(() => {
    let active = true;
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (!active) return;
      setLoadedImg(img);
      setLoadError(null);
    };
    img.onerror = () => {
      if (!active) return;
      setLoadError('Não foi possível carregar a imagem selecionada.');
    };
    img.src = objectUrl;

    return () => {
      active = false;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  // Redraw preview canvas whenever image, rotation or straighten changes
  useEffect(() => {
    if (!loadedImg || !previewCanvasRef.current) return;
    drawRotatedImageToCanvas(
      previewCanvasRef.current,
      loadedImg,
      rotation,
      straighten,
      1280,
    );
  }, [loadedImg, rotation, straighten]);

  const handleRotate = (delta: number) => {
    setRotation((prev) => (((prev + delta) % 360) + 360) % 360);
    setCrop(FULL_CROP);
  };

  const handleResetAll = () => {
    setRotation(0);
    setStraighten(0);
    setBrightness(0);
    setContrast(0);
    setEnhanceText(false);
    setCrop(FULL_CROP);
  };

  const hasModifications =
    rotation !== 0 ||
    straighten !== 0 ||
    brightness !== 0 ||
    contrast !== 0 ||
    enhanceText ||
    crop.x > 0.001 ||
    crop.y > 0.001 ||
    crop.width < 0.999 ||
    crop.height < 0.999;

  const startDrag = useCallback(
    (handle: DragHandle) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      dragStateRef.current = {
        handle,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startCrop: { ...crop },
        stageWidth: rect.width,
        stageHeight: rect.height,
      };
      setIsDragging(true);
    },
    [crop],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    e.preventDefault();

    const dx = (e.clientX - drag.startClientX) / drag.stageWidth;
    const dy = (e.clientY - drag.startClientY) / drag.stageHeight;
    const s = drag.startCrop;
    let { x, y, width, height } = s;

    if (drag.handle === 'move') {
      x = clamp(s.x + dx, 0, 1 - s.width);
      y = clamp(s.y + dy, 0, 1 - s.height);
    } else {
      if (drag.handle.includes('w')) {
        const right = s.x + s.width;
        const nextX = clamp(s.x + dx, 0, right - MIN_CROP_SIZE);
        x = nextX;
        width = right - nextX;
      }
      if (drag.handle.includes('e')) {
        width = clamp(s.width + dx, MIN_CROP_SIZE, 1 - s.x);
      }
      if (drag.handle.includes('n')) {
        const bottom = s.y + s.height;
        const nextY = clamp(s.y + dy, 0, bottom - MIN_CROP_SIZE);
        y = nextY;
        height = bottom - nextY;
      }
      if (drag.handle.includes('s')) {
        height = clamp(s.height + dy, MIN_CROP_SIZE, 1 - s.y);
      }
    }

    setCrop({ x, y, width, height });
  }, []);

  const endDrag = useCallback(() => {
    dragStateRef.current = null;
    setIsDragging(false);
  }, []);

  const handleExport = async () => {
    if (!loadedImg || isExporting) return;
    setIsExporting(true);

    try {
      // 1. Render full rotated image to an offscreen canvas
      const rotatedCanvas = document.createElement('canvas');
      const { width: fullW, height: fullH } = drawRotatedImageToCanvas(
        rotatedCanvas,
        loadedImg,
        rotation,
        straighten,
        2200,
      );

      // 2. Crop to user-selected rectangle
      const sx = Math.round(crop.x * fullW);
      const sy = Math.round(crop.y * fullH);
      const sw = Math.max(1, Math.round(crop.width * fullW));
      const sh = Math.max(1, Math.round(crop.height * fullH));

      const outCanvas = document.createElement('canvas');
      outCanvas.width = sw;
      outCanvas.height = sh;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) {
        onConfirm(file, URL.createObjectURL(file));
        return;
      }

      outCtx.fillStyle = '#FFFFFF';
      outCtx.fillRect(0, 0, sw, sh);
      outCtx.drawImage(rotatedCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

      // 3. Apply brightness / contrast / B&W adjustments identically to preview
      if (brightness !== 0 || contrast !== 0 || enhanceText) {
        try {
          const imgData = outCtx.getImageData(0, 0, sw, sh);
          const adjusted = applyPixelAdjustments(
            imgData,
            brightness,
            contrast,
            enhanceText,
          );
          outCtx.putImageData(adjusted, 0, 0);
        } catch {
          // Fallback silently if canvas taint prevents getImageData
        }
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        outCanvas.toBlob(resolve, 'image/png'),
      );

      if (!blob) {
        onConfirm(file, URL.createObjectURL(file));
        return;
      }

      const baseName = file.name.replace(/\.[^.]+$/, '') || 'cupom';
      const editedFile = new File([blob], `${baseName}-editado.png`, {
        type: 'image/png',
      });
      const previewUrl = URL.createObjectURL(blob);
      onConfirm(editedFile, previewUrl);
    } finally {
      setIsExporting(false);
    }
  };

  const effectiveContrastPercent = 100 + contrast + (enhanceText ? 35 : 0);
  const previewCssFilter = `brightness(${100 + brightness}%) contrast(${effectiveContrastPercent}%) ${
    enhanceText ? 'grayscale(100%)' : ''
  }`.trim();

  const baseDims = loadedImg
    ? getRotatedBaseDimensions(
        loadedImg.naturalWidth || loadedImg.width,
        loadedImg.naturalHeight || loadedImg.height,
        rotation,
      )
    : { width: 3, height: 4 };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-[#0B0B0D]/95 text-[#F5F5F7] backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Editar foto do cupom"
    >
      {/* Top Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={16} strokeWidth={2} />
          Cancelar
        </button>

        <h2 className="font-display text-sm font-semibold tracking-tight text-white">
          Editar foto do cupom
        </h2>

        <button
          type="button"
          onClick={handleResetAll}
          disabled={!hasModifications}
          className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-[#30D158] transition-colors hover:bg-white/10 disabled:opacity-35"
        >
          <Undo2 size={14} strokeWidth={2} />
          Restaurar
        </button>
      </div>

      {/* Main Interactive Crop & Preview Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-5 sm:p-8">
        {loadError ? (
          <div className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-center text-xs text-white/80">
            {loadError}
          </div>
        ) : !loadedImg ? (
          <div className="text-xs text-white/60">Carregando imagem...</div>
        ) : (
          <div
            ref={stageRef}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              aspectRatio: `${baseDims.width} / ${baseDims.height}`,
            }}
            className="relative max-h-full max-w-full select-none touch-none overflow-visible shadow-2xl"
          >
            {/* Preview Canvas */}
            <canvas
              ref={previewCanvasRef}
              style={{ filter: previewCssFilter }}
              className="block h-full w-full rounded-sm object-contain"
            />

            {/* Darkened mask outside crop area */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {/* Top shade */}
              <div
                className="absolute inset-x-0 top-0 bg-black/60"
                style={{ height: `${crop.y * 100}%` }}
              />
              {/* Bottom shade */}
              <div
                className="absolute inset-x-0 bottom-0 bg-black/60"
                style={{ height: `${(1 - crop.y - crop.height) * 100}%` }}
              />
              {/* Left shade */}
              <div
                className="absolute left-0 bg-black/60"
                style={{
                  top: `${crop.y * 100}%`,
                  height: `${crop.height * 100}%`,
                  width: `${crop.x * 100}%`,
                }}
              />
              {/* Right shade */}
              <div
                className="absolute right-0 bg-black/60"
                style={{
                  top: `${crop.y * 100}%`,
                  height: `${crop.height * 100}%`,
                  width: `${(1 - crop.x - crop.width) * 100}%`,
                }}
              />
            </div>

            {/* Interactive Crop Frame */}
            <div
              onPointerDown={startDrag('move')}
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.width * 100}%`,
                height: `${crop.height * 100}%`,
              }}
              className="absolute cursor-move border border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
            >
              {/* Rule of thirds grid */}
              <div
                className={`pointer-events-none absolute inset-0 transition-opacity duration-150 ${
                  isDragging ? 'opacity-90' : 'opacity-40'
                }`}
              >
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/50" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/50" />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/50" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/50" />
              </div>

              {/* Corner Handles (large 40px touch hit area, sleek Apple L-bracket visual) */}
              <button
                type="button"
                aria-label="Ajustar canto superior esquerdo"
                onPointerDown={startDrag('nw')}
                className="absolute -left-4 -top-4 flex h-9 w-9 cursor-nwse-resize items-center justify-center touch-none"
              >
                <span className="block h-5 w-5 rounded-tl-sm border-l-[3px] border-t-[3px] border-[#30D158] drop-shadow" />
              </button>
              <button
                type="button"
                aria-label="Ajustar canto superior direito"
                onPointerDown={startDrag('ne')}
                className="absolute -right-4 -top-4 flex h-9 w-9 cursor-nesw-resize items-center justify-center touch-none"
              >
                <span className="block h-5 w-5 rounded-tr-sm border-r-[3px] border-t-[3px] border-[#30D158] drop-shadow" />
              </button>
              <button
                type="button"
                aria-label="Ajustar canto inferior esquerdo"
                onPointerDown={startDrag('sw')}
                className="absolute -bottom-4 -left-4 flex h-9 w-9 cursor-nesw-resize items-center justify-center touch-none"
              >
                <span className="block h-5 w-5 rounded-bl-sm border-b-[3px] border-l-[3px] border-[#30D158] drop-shadow" />
              </button>
              <button
                type="button"
                aria-label="Ajustar canto inferior direito"
                onPointerDown={startDrag('se')}
                className="absolute -bottom-4 -right-4 flex h-9 w-9 cursor-nwse-resize items-center justify-center touch-none"
              >
                <span className="block h-5 w-5 rounded-br-sm border-b-[3px] border-r-[3px] border-[#30D158] drop-shadow" />
              </button>

              {/* Edge Handles */}
              <button
                type="button"
                aria-label="Ajustar borda superior"
                onPointerDown={startDrag('n')}
                className="absolute -top-3 left-1/2 flex h-6 w-12 -translate-x-1/2 cursor-ns-resize items-center justify-center touch-none"
              >
                <span className="h-1 w-7 rounded-full bg-white shadow" />
              </button>
              <button
                type="button"
                aria-label="Ajustar borda inferior"
                onPointerDown={startDrag('s')}
                className="absolute -bottom-3 left-1/2 flex h-6 w-12 -translate-x-1/2 cursor-ns-resize items-center justify-center touch-none"
              >
                <span className="h-1 w-7 rounded-full bg-white shadow" />
              </button>
              <button
                type="button"
                aria-label="Ajustar borda esquerda"
                onPointerDown={startDrag('w')}
                className="absolute -left-3 top-1/2 flex h-12 w-6 -translate-y-1/2 cursor-ew-resize items-center justify-center touch-none"
              >
                <span className="h-7 w-1 rounded-full bg-white shadow" />
              </button>
              <button
                type="button"
                aria-label="Ajustar borda direita"
                onPointerDown={startDrag('e')}
                className="absolute -right-3 top-1/2 flex h-12 w-6 -translate-y-1/2 cursor-ew-resize items-center justify-center touch-none"
              >
                <span className="h-7 w-1 rounded-full bg-white shadow" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Editing Controls Dock */}
      <div className="shrink-0 space-y-3 border-t border-white/10 bg-[#141417]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
        {/* Editor Mode Switcher */}
        <div className="mx-auto grid max-w-sm grid-cols-2 rounded-full bg-white/10 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('crop')}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'crop'
                ? 'bg-white text-[#1D1D1F] shadow-xs'
                : 'text-white/75 hover:text-white'
            }`}
          >
            <Crop size={14} strokeWidth={2} />
            Cortar e Girar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('adjust')}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'adjust'
                ? 'bg-white text-[#1D1D1F] shadow-xs'
                : 'text-white/75 hover:text-white'
            }`}
          >
            <SlidersHorizontal size={14} strokeWidth={2} />
            Ajustes OCR
          </button>
        </div>

        {/* Tab Controls */}
        <div className="mx-auto max-w-md">
          {activeTab === 'crop' ? (
            <div className="space-y-3">
              {/* Rotation & Full Crop Quick Actions */}
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRotate(-90)}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-white transition-colors hover:bg-white/10 active:scale-[0.97]"
                >
                  <RotateCcw size={15} strokeWidth={2} />
                  -90°
                </button>
                <button
                  type="button"
                  onClick={() => handleRotate(90)}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-white transition-colors hover:bg-white/10 active:scale-[0.97]"
                >
                  <RotateCw size={15} strokeWidth={2} />
                  +90°
                </button>
                <button
                  type="button"
                  onClick={() => setCrop(FULL_CROP)}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-white transition-colors hover:bg-white/10 active:scale-[0.97]"
                >
                  <Maximize2 size={14} strokeWidth={2} />
                  Imagem inteira
                </button>
              </div>

              {/* Fine Straighten Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-white/70">
                  <span>Endireitar inclinação</span>
                  <button
                    type="button"
                    onClick={() => setStraighten(0)}
                    className="font-mono-tabular font-semibold text-[#30D158]"
                  >
                    {straighten > 0 ? `+${straighten}°` : `${straighten}°`}
                  </button>
                </div>
                <input
                  type="range"
                  aria-label="Endireitar inclinação"
                  min={-15}
                  max={15}
                  step={1}
                  value={straighten}
                  onChange={(e) => setStraighten(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer accent-[#30D158]"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* One-tap Enhance Text (B&W High Contrast) */}
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-white">
                    Realçar texto (Preto e Branco)
                  </p>
                  <p className="text-[10px] text-white/60">
                    Aumenta nitidez de letras apagadas no cupom
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enhanceText}
                  onClick={() => setEnhanceText((v) => !v)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    enhanceText ? 'bg-[#30D158]' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      enhanceText ? 'translate-x-5.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Brightness & Contrast Sliders */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-white/70">
                    <span className="flex items-center gap-1">
                      <Sun size={12} /> Brilho
                    </span>
                    <span className="font-mono-tabular text-white/90">
                      {brightness > 0 ? `+${brightness}%` : `${brightness}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="Brilho"
                    min={-50}
                    max={50}
                    step={5}
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer accent-[#30D158]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-white/70">
                    <span className="flex items-center gap-1">
                      <Contrast size={12} /> Contraste
                    </span>
                    <span className="font-mono-tabular text-white/90">
                      {contrast > 0 ? `+${contrast}%` : `${contrast}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="Contraste"
                    min={-40}
                    max={80}
                    step={5}
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer accent-[#30D158]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Confirm Action */}
        <div className="mx-auto flex max-w-md items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-11 flex-1 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
          >
            Trocar foto
          </button>
          <button
            type="button"
            disabled={!loadedImg || isExporting}
            onClick={() => void handleExport()}
            className="flex h-11 flex-[1.6] items-center justify-center gap-2 rounded-full bg-[#30D158] text-sm font-semibold text-[#052E16] shadow-lg transition-transform hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
          >
            <Check size={17} strokeWidth={2.4} />
            {isExporting ? 'Preparando...' : 'Usar foto e ler OCR'}
          </button>
        </div>
      </div>
    </div>
  );
}
