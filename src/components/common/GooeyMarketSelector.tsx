import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Store } from 'lucide-react';

export interface GooeyOption {
  id: string;
  label: string;
  showIcon?: boolean;
}

interface GooeyMarketSelectorProps {
  options: GooeyOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
  trailing?: ReactNode;
}

interface PillRect {
  left: number;
  width: number;
}

export function GooeyMarketSelector({
  options,
  selectedId,
  onSelect,
  className = '',
  trailing,
}: GooeyMarketSelectorProps) {
  const rawId = useId();
  const filterId = `gooey-${rawId.replace(/:/g, '')}`;

  const trackRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const [rects, setRects] = useState<Map<string, PillRect>>(new Map());
  const [leadRect, setLeadRect] = useState<PillRect | null>(null);
  const [trailRect, setTrailRect] = useState<PillRect | null>(null);
  const [hasAnimatedOnce, setHasAnimatedOnce] = useState(false);

  const measureAll = () => {
    const track = trackRef.current;
    if (!track) return;
    const next = new Map<string, PillRect>();
    for (const opt of options) {
      const btn = btnRefs.current.get(opt.id);
      if (btn) {
        next.set(opt.id, {
          left: btn.offsetLeft,
          width: btn.offsetWidth,
        });
      }
    }
    setRects(next);
    const active = next.get(selectedId);
    if (active) {
      setLeadRect(active);
      setTrailRect((prev) => prev ?? active);
    }
  };

  useLayoutEffect(() => {
    measureAll();
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measureAll());
    observer.observe(track);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.map((o) => `${o.id}:${o.label}`).join('|')]);

  useLayoutEffect(() => {
    const target = rects.get(selectedId);
    if (!target) return;

    setLeadRect(target);

    // Delayed trail blob creates the mercury / liquid ink bridge via SVG gooey filter
    const timer = setTimeout(() => {
      setTrailRect(target);
    }, 65);

    if (!hasAnimatedOnce) {
      const initTimer = setTimeout(() => setHasAnimatedOnce(true), 40);
      return () => {
        clearTimeout(timer);
        clearTimeout(initTimer);
      };
    }

    // Keep active pill scrolled into view smoothly on mobile
    const activeBtn = btnRefs.current.get(selectedId);
    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }

    return () => clearTimeout(timer);
  }, [selectedId, rects, hasAnimatedOnce]);

  return (
    <div
      className={`no-scrollbar relative flex flex-1 items-center overflow-x-auto py-1 ${className}`}
    >
      {/* SVG Gooey Filter Definition */}
      <svg
        className="pointer-events-none absolute h-0 w-0 overflow-hidden"
        aria-hidden="true"
      >
        <defs>
          <filter id={filterId}>
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="5.5"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div ref={trackRef} className="relative flex items-center gap-2">
        {/* Layer 0: Crisp white background pills for unselected options */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
        >
          {options.map((opt) => {
            const r = rects.get(opt.id);
            if (!r) return null;
            return (
              <span
                key={`bg-${opt.id}`}
                style={{
                  transform: `translate3d(${r.left}px, 0, 0)`,
                  width: `${r.width}px`,
                }}
                className="absolute top-0 bottom-0 left-0 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              />
            );
          })}
        </div>

        {/* Layer 1: Gooey / Liquid Morphing Green Mercury Blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            filter: `url(#${filterId})`,
          }}
        >
          {trailRect && (
            <span
              style={{
                transform: `translate3d(${trailRect.left}px, 0, 0)`,
                width: `${trailRect.width}px`,
                transition: hasAnimatedOnce
                  ? 'transform 340ms cubic-bezier(0.22, 1, 0.36, 1), width 320ms cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'none',
              }}
              className="absolute top-0.5 bottom-0.5 left-0 rounded-full bg-[var(--accent)]"
            />
          )}
          {leadRect && (
            <span
              style={{
                transform: `translate3d(${leadRect.left}px, 0, 0)`,
                width: `${leadRect.width}px`,
                transition: hasAnimatedOnce
                  ? 'transform 360ms cubic-bezier(0.22, 1.12, 0.36, 1), width 340ms cubic-bezier(0.22, 1.12, 0.36, 1)'
                  : 'none',
              }}
              className="absolute top-0 bottom-0 left-0 rounded-full bg-[var(--accent)] shadow-[0_2px_10px_rgba(25,128,66,0.22)]"
            />
          )}
        </div>

        {/* Layer 2: Interactive Foreground Buttons */}
        {options.map((opt) => {
          const active = opt.id === selectedId;
          const showIcon = opt.showIcon ?? true;
          return (
            <button
              key={opt.id}
              ref={(el) => {
                if (el) {
                  btnRefs.current.set(opt.id, el);
                } else {
                  btnRefs.current.delete(opt.id);
                }
              }}
              type="button"
              onClick={() => onSelect(opt.id)}
              className={`relative z-[2] inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-xs font-semibold transition-colors duration-200 ease-ui active:scale-[0.97] ${
                active
                  ? 'text-[var(--accent-ink)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {showIcon &&
                (active ? (
                  <Check size={14} strokeWidth={2.4} />
                ) : (
                  <Store size={14} strokeWidth={1.7} />
                ))}
              <span className="whitespace-nowrap">{opt.label}</span>
            </button>
          );
        })}

        {trailing && (
          <div className="relative z-[2] shrink-0">{trailing}</div>
        )}
      </div>
    </div>
  );
}
