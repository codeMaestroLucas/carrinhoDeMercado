import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MarketAisleReorderList } from '../src/components/config/MarketAisleReorderList';
import type { ProductCategoryId } from '../src/types/shopping';

function dispatchTouch(
  target: EventTarget,
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  touch: { identifier?: number; clientX?: number; clientY?: number },
): Event {
  const evt = new Event(type, { bubbles: true, cancelable: true });
  const touchObj = {
    identifier: touch.identifier ?? 1,
    clientX: touch.clientX ?? 0,
    clientY: touch.clientY ?? 0,
    target,
  };
  Object.defineProperty(evt, 'touches', {
    value: type === 'touchend' || type === 'touchcancel' ? [] : [touchObj],
  });
  Object.defineProperty(evt, 'changedTouches', {
    value: [touchObj],
  });
  act(() => {
    target.dispatchEvent(evt);
  });
  return evt;
}

describe('MarketAisleReorderList (To-do reorder drag + arrow FLIP)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const sampleOrder: ProductCategoryId[] = [
    'hortifruti',
    'alimentos',
    'bebidas',
  ];

  it('reorders via arrow buttons and applies visual pulse feedback', () => {
    vi.useFakeTimers();
    const onMove = vi.fn();

    render(
      <MarketAisleReorderList categoryOrder={sampleOrder} onMove={onMove} />,
    );

    const moveDownBtn = screen.getByLabelText('Mover Hortifruti para baixo');
    fireEvent.click(moveDownBtn);

    expect(onMove).toHaveBeenCalledWith(0, 1);

    const row = moveDownBtn.closest('li')!;
    expect(row.className).toContain('t-reorder-arrow-active');

    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(row.className).not.toContain('t-reorder-arrow-active');
  });

  it('drags immediately from the grip handle on touch, prevents native scroll, shifts siblings and commits on drop', () => {
    vi.useFakeTimers();
    const onMove = vi.fn();

    const { container } = render(
      <MarketAisleReorderList categoryOrder={sampleOrder} onMove={onMove} />,
    );

    const rows = Array.from(container.querySelectorAll('li'));
    expect(rows).toHaveLength(3);

    rows.forEach((row, idx) => {
      vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: idx * 68,
        top: idx * 68,
        bottom: idx * 68 + 60,
        left: 0,
        right: 300,
        width: 300,
        height: 60,
        toJSON: () => ({}),
      });
    });

    const firstHandle = rows[0].querySelector('[data-drag-handle="true"]')!;

    // Start dragging row 0 from its grip handle (touchstart should preventDefault immediately)
    const startEvt = dispatchTouch(firstHandle, 'touchstart', {
      identifier: 1,
      clientX: 20,
      clientY: 30,
    });
    expect(startEvt.defaultPrevented).toBe(true);
    expect(rows[0].classList.contains('is-dragging')).toBe(true);
    expect(rows[0].style.getPropertyValue('--dy')).toBe('0px');

    // Drag down by 70px (1 slot) -> touchmove must preventDefault to stop mobile scrolling
    const moveEvt = dispatchTouch(window, 'touchmove', {
      identifier: 1,
      clientX: 20,
      clientY: 100,
    });
    expect(moveEvt.defaultPrevented).toBe(true);
    expect(rows[0].style.getPropertyValue('--dy')).toBe('70px');
    expect(rows[1].style.transform).toContain('translate3d(0, -68px, 0)');

    // Release finger -> settling animation starts
    dispatchTouch(window, 'touchend', {
      identifier: 1,
      clientX: 20,
      clientY: 100,
    });

    expect(rows[0].classList.contains('is-dragging')).toBe(false);
    expect(rows[0].classList.contains('is-settling')).toBe(true);

    // After settle duration (260ms), onMove(0, 1) is committed
    act(() => {
      vi.advanceTimersByTime(280);
    });

    expect(onMove).toHaveBeenCalledWith(0, 1);
    expect(rows[0].classList.contains('is-settling')).toBe(false);
  });

  it('activates drag on mobile touch press-and-hold (180ms) on row body and blocks page scroll once lifted', () => {
    vi.useFakeTimers();
    const onMove = vi.fn();

    const { container } = render(
      <MarketAisleReorderList categoryOrder={sampleOrder} onMove={onMove} />,
    );

    const rows = Array.from(container.querySelectorAll('li'));
    const startEvt = dispatchTouch(rows[0], 'touchstart', {
      identifier: 2,
      clientX: 120,
      clientY: 30,
    });

    // Not preventing default on initial touchstart so fast swipes can scroll normally
    expect(startEvt.defaultPrevented).toBe(false);
    expect(rows[0].classList.contains('is-dragging')).toBe(false);
    expect(rows[0].className).toContain('is-holding');

    // After 180ms hold, drag lifts automatically
    act(() => {
      vi.advanceTimersByTime(190);
    });

    expect(rows[0].classList.contains('is-dragging')).toBe(true);

    // Subsequent touchmove MUST preventDefault to block mobile scroll
    const moveEvt = dispatchTouch(window, 'touchmove', {
      identifier: 2,
      clientX: 120,
      clientY: 95,
    });
    expect(moveEvt.defaultPrevented).toBe(true);

    dispatchTouch(window, 'touchend', { identifier: 2 });
  });
});
