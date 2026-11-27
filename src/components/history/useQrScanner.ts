import { useCallback, useEffect, useRef, useState } from 'react';

interface ZoomCapabilities {
  min: number;
  max: number;
  step: number;
  isHardware: boolean;
}

export function useQrScanner(options: {
  regionId: string;
  onDecoded: (decodedText: string) => void;
  onError: (msg: string) => void;
}) {
  const { regionId, onDecoded, onError } = options;
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraZoom, setCameraZoom] = useState(2.2);
  const [zoomCaps, setZoomCaps] = useState<ZoomCapabilities>({
    min: 1,
    max: 3.5,
    step: 0.25,
    isHardware: false,
  });

  const scannerRef = useRef<{
    stop: () => Promise<void>;
    applyVideoConstraints: (constraints: MediaTrackConstraints) => Promise<void>;
    getRunningTrackCameraCapabilities: () => {
      zoomFeature: () => {
        isSupported: () => boolean;
        min: () => number;
        max: () => number;
        step: () => number;
        apply: (value: number) => Promise<void>;
      };
    };
  } | null>(null);

  const applyCameraZoom = useCallback(
    async (targetZoom: number, capsOverride?: ZoomCapabilities) => {
      const caps = capsOverride ?? zoomCaps;
      const clamped = Number(
        Math.max(caps.min, Math.min(caps.max, targetZoom)).toFixed(2),
      );
      setCameraZoom(clamped);

      const videoEl = document.querySelector<HTMLVideoElement>(
        `#${regionId} video`,
      );

      if (
        caps.isHardware &&
        scannerRef.current?.getRunningTrackCameraCapabilities
      ) {
        try {
          const zoomFeature = scannerRef.current
            .getRunningTrackCameraCapabilities()
            .zoomFeature();
          if (zoomFeature.isSupported()) {
            await zoomFeature.apply(clamped);
            if (videoEl) {
              videoEl.style.transform = '';
            }
            return;
          }
        } catch {
        }
      }

      if (videoEl) {
        videoEl.style.transformOrigin = 'center center';
        videoEl.style.transition =
          'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)';
        videoEl.style.transform = `scale(${clamped})`;
      }
    },
    [regionId, zoomCaps],
  );

  const stopCamera = useCallback(async () => {
    const videoEl = document.querySelector<HTMLVideoElement>(
      `#${regionId} video`,
    );
    if (videoEl) {
      videoEl.style.transform = '';
    }
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
      }
      scannerRef.current = null;
    }
    setIsCameraActive(false);
  }, [regionId]);

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  const startQrCamera = useCallback(async () => {
    setIsCameraActive(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const qr = new Html5Qrcode(regionId);
      scannerRef.current = qr;
      await qr.start(
        { facingMode: 'environment' },
        {
          fps: 12,
          aspectRatio: 1,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.max(180, Math.floor(minEdge * 0.72));
            return { width: size, height: size };
          },
          videoConstraints: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        (decodedText) => {
          void stopCamera();
          onDecoded(decodedText);
        },
        () => {},
      );

      let detectedCaps: ZoomCapabilities = {
        min: 1,
        max: 3.5,
        step: 0.25,
        isHardware: false,
      };
      let defaultZoom = 2.2;

      try {
        const capabilities = qr.getRunningTrackCameraCapabilities();
        const zoomFeature = capabilities.zoomFeature();
        if (zoomFeature.isSupported()) {
          const min = zoomFeature.min();
          const max = zoomFeature.max();
          const step = zoomFeature.step() || 0.1;
          detectedCaps = { min, max, step, isHardware: true };
          defaultZoom = Math.min(max, Math.max(min, 2.5));
        }
      } catch {
      }

      setZoomCaps(detectedCaps);
      await applyCameraZoom(defaultZoom, detectedCaps);

      try {
        await qr.applyVideoConstraints({
          advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
        });
      } catch {
      }
    } catch (err) {
      setIsCameraActive(false);
      onError(
        `Não foi possível iniciar a câmera (${err instanceof Error ? err.message : String(err)}). Verifique a permissão ou cole o link abaixo`,
      );
    }
  }, [applyCameraZoom, onDecoded, onError, regionId, stopCamera]);

  return {
    isCameraActive,
    cameraZoom,
    zoomCaps,
    applyCameraZoom,
    startQrCamera,
    stopCamera,
  };
}
