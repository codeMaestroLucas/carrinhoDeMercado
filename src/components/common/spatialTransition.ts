interface SpatialOriginRect {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius?: number;
}

export interface SpatialOrigin {
  rect: SpatialOriginRect;
  element?: HTMLElement | null;
}

export function captureSpatialOrigin(el: HTMLElement | null): SpatialOrigin | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const computed = typeof window !== 'undefined' ? window.getComputedStyle(el) : null;
  const parsedRadius = computed ? parseFloat(computed.borderRadius) : 16;
  return {
    rect: {
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      borderRadius: Number.isFinite(parsedRadius) ? parsedRadius : 16,
    },
    element: el,
  };
}

export function getLiveOriginRect(origin?: SpatialOrigin | null): SpatialOriginRect | null {
  if (!origin) return null;
  if (origin.element && origin.element.isConnected) {
    const r = origin.element.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return {
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        borderRadius: origin.rect.borderRadius ?? 16,
      };
    }
  }
  return origin.rect;
}

export function computeFlipTransform(
  from: SpatialOriginRect,
  to: DOMRect,
): { transform: string; borderRadius: string } {
  const fromCenterX = from.left + from.width / 2;
  const fromCenterY = from.top + from.height / 2;
  const toCenterX = to.left + to.width / 2;
  const toCenterY = to.top + to.height / 2;

  const dx = fromCenterX - toCenterX;
  const dy = fromCenterY - toCenterY;
  const sx = Math.max(0.24, Math.min(1, from.width / Math.max(1, to.width)));
  const sy = Math.max(0.14, Math.min(1, from.height / Math.max(1, to.height)));

  // Compensate border-radius during scale so corners stay visually crisp
  const avgScale = (sx + sy) / 2;
  const compensatedRadius = Math.min(
    64,
    Math.round((from.borderRadius ?? 16) / Math.max(0.35, avgScale)),
  );

  return {
    transform: `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`,
    borderRadius: `${compensatedRadius}px`,
  };
}
