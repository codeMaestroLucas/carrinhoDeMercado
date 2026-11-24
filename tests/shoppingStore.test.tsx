import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useShoppingStore } from '../src/store/useShoppingStore';
import { ShoppingListPage } from '../src/pages/ShoppingListPage';
import { SwipeableShoppingItemRow } from '../src/components/list/SwipeableShoppingItemRow';
import { calculatePriceIndex } from '../src/services/productHistoryService';
import {
  CloudSyncService,
  sanitizeForFirestore,
} from '../src/services/cloudSyncService';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

describe('useShoppingStore & ShoppingListPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useShoppingStore.setState({
      isHydrated: true,
      items: [],
      history: [],
      categoryFilter: null,
      showCheckedItems: true,
      selectedMarketId: 'mercado_padrao',
      sharedSpaceCode: null,
      hasPendingCloudPush: false,
      lastSyncedAtIso: null,
      cloudError: null,
    });
  });

  it('adds single items without binding to a market and parses quantity/category', () => {
    const store = useShoppingStore.getState();
    const item = store.addSingleItem('2kg Tomate');
    expect(item).not.toBeNull();
    expect(item?.name).toBe('Tomate');
    expect(item?.quantity).toBe(2);
    expect(item?.unit).toBe('kg');
    expect(item?.category).toBe('hortifruti');
    expect(item?.marketId).toBeNull();
    expect(item?.isPriceTotal).toBe(true);

    // Duplicate prevention
    expect(store.addSingleItem('tomates')).toBeNull();
  });

  it('pastes multiple items with deduplication and finishes purchase into history', () => {
    const store = useShoppingStore.getState();
    const report = store.addItemsFromPastedTextWithReport(
      '- 2kg Arroz\n- 3x Leite\n- arroz',
    );
    expect(report.addedCount).toBe(2);
    expect(report.skippedDuplicatesCount).toBe(1);

    const items = useShoppingStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.marketId == null)).toBe(true);

    store.updateItem(items[0].id, { price: 25.0 });
    store.toggleItemChecked(items[0].id);

    const record = store.finishPurchase({ onlyChecked: true });
    expect(record).not.toBeNull();
    expect(record?.items).toHaveLength(1);
    expect(useShoppingStore.getState().items).toHaveLength(1);
    expect(useShoppingStore.getState().history).toHaveLength(1);
  });

  it('calculates personal inflation price index across purchase records', () => {
    const now = Date.now();
    const history = [
      {
        id: 'r2',
        marketId: 'mercado_padrao',
        marketName: 'Supermercado Padrão',
        date: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            name: 'Café Pilão',
            category: 'alimentos' as const,
            price: 18.0,
            quantity: 1,
            unit: 'un',
          },
        ],
      },
      {
        id: 'r1',
        marketId: 'mercado_padrao',
        marketName: 'Supermercado Padrão',
        date: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            name: 'Café Pilão',
            category: 'alimentos' as const,
            price: 15.0,
            quantity: 1,
            unit: 'un',
          },
        ],
      },
    ];
    const index = calculatePriceIndex(history, 60);
    expect(index.totalComparedItems).toBe(1);
    expect(index.increasedCount).toBe(1);
    expect(index.overallVariationPercent).toBeCloseTo(20);
  });

  it('renders ShoppingListPage, adds items, and reorders all items by selected market aisle order without filtering them out', () => {
    const store = useShoppingStore.getState();
    store.addSingleItem('Detergente Ypê'); // limpeza
    store.addSingleItem('Tomate'); // hortifruti

    render(<ShoppingListPage />);
    expect(screen.getByText(/Lista •/i)).toBeInTheDocument();
    expect(screen.getByText(/Detergente Ypê/i)).toBeInTheDocument();
    expect(screen.getByText(/Tomate/i)).toBeInTheDocument();

    // Switch to Atacadão (limpeza comes before hortifruti)
    fireEvent.click(screen.getByRole('button', { name: /Atacadão/i }));
    expect(
      screen.getByText(/Itens organizados na ordem de setores de Atacadão/i),
    ).toBeInTheDocument();

    // Both items remain visible; Detergente appears before Tomate
    const bodyText = document.body.textContent ?? '';
    expect(bodyText.indexOf('Detergente')).toBeLessThan(
      bodyText.indexOf('Tomate'),
    );

    // Switch to Mercado do Bairro (hortifruti comes before limpeza)
    fireEvent.click(screen.getByRole('button', { name: /Mercado do Bairro/i }));
    const updatedText = document.body.textContent ?? '';
    expect(updatedText.indexOf('Tomate')).toBeLessThan(
      updatedText.indexOf('Detergente'),
    );
  });

  it('sanitizes undefined fields for Firestore and flushes pending offline pushes before refreshing', async () => {
    const sanitized = sanitizeForFirestore({
      a: 1,
      b: undefined,
      items: [{ name: 'Arroz', unitPrice: undefined, price: 10 }],
    });
    expect(sanitized).toEqual({
      a: 1,
      items: [{ name: 'Arroz', price: 10 }],
    });
    expect('b' in sanitized).toBe(false);
    expect('unitPrice' in sanitized.items[0]).toBe(false);

    const pushSpy = vi
      .spyOn(CloudSyncService, 'pushStateToSharedSpace')
      .mockResolvedValue(undefined);
    const fetchSpy = vi
      .spyOn(CloudSyncService, 'fetchSharedSpace')
      .mockResolvedValue(null);
    vi.spyOn(CloudSyncService, 'isFirebaseReady').mockReturnValue(true);

    useShoppingStore.setState({
      sharedSpaceCode: 'CASA-1234',
      hasPendingCloudPush: true,
    });

    await useShoppingStore.getState().flushPendingSync();
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(useShoppingStore.getState().hasPendingCloudPush).toBe(false);

    await useShoppingStore.getState().refreshCloudSync();
    expect(fetchSpy).toHaveBeenCalledWith('CASA-1234');
  });

  it('supports tap to check/uncheck, long press to open edit, and swipe left to remove', async () => {
    vi.useFakeTimers();
    const toggleChecked = vi.fn();
    const openEdit = vi.fn();
    const remove = vi.fn();
    const updateQty = vi.fn();

    const mockItem = {
      id: 'item-1',
      name: 'Café Especial',
      quantity: 1,
      unit: 'un',
      category: 'alimentos' as const,
      isChecked: false,
      marketId: null,
      price: 15.9,
      isPriceTotal: false,
      createdAt: new Date().toISOString(),
    };

    render(
      <SwipeableShoppingItemRow
        item={mockItem}
        onToggleChecked={toggleChecked}
        onOpenEdit={openEdit}
        onRemove={remove}
        onUpdateQuantity={updateQty}
      />,
    );

    const card = screen.getByText('Café Especial');

    // 1. Tap / click: toggles checked
    fireEvent.mouseDown(card, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(card, { clientX: 100, clientY: 100 });
    expect(toggleChecked).toHaveBeenCalledWith('item-1');
    expect(openEdit).not.toHaveBeenCalled();

    // 2. Long press (500ms): opens edit modal
    fireEvent.mouseDown(card, { clientX: 100, clientY: 100 });
    vi.advanceTimersByTime(550);
    expect(openEdit).toHaveBeenCalledWith(mockItem);
    fireEvent.mouseUp(card, { clientX: 100, clientY: 100 });
    // mouseUp after long press should not toggle checked again
    expect(toggleChecked).toHaveBeenCalledTimes(1);

    // 3. Swipe left past -85px threshold: triggers remove
    const cardContainer = card.closest('div[style]') || card;
    fireEvent.mouseDown(cardContainer, { clientX: 200, clientY: 100 });
    fireEvent.mouseMove(cardContainer, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(cardContainer, { clientX: 100, clientY: 100 });
    vi.runAllTimers();
    expect(remove).toHaveBeenCalledWith('item-1');

    vi.useRealTimers();
  });

  it('ignores browser-synthesized mouse events after pointer events and does not toggle on pointerCancel', () => {
    const toggleChecked = vi.fn();
    const mockItem = {
      id: 'item-2',
      name: 'Arroz Integral',
      quantity: 1,
      unit: 'un',
      category: 'alimentos' as const,
      isChecked: false,
      marketId: null,
      price: null,
      isPriceTotal: false,
      createdAt: new Date().toISOString(),
    };

    render(
      <SwipeableShoppingItemRow
        item={mockItem}
        onToggleChecked={toggleChecked}
        onOpenEdit={vi.fn()}
        onRemove={vi.fn()}
        onUpdateQuantity={vi.fn()}
      />,
    );

    const card = screen.getByText('Arroz Integral');

    // Pointer sequence followed by compatibility mouse events must toggle only once
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(card, { clientX: 100, clientY: 100 });
    fireEvent.mouseDown(card, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(card, { clientX: 100, clientY: 100 });
    expect(toggleChecked).toHaveBeenCalledTimes(1);

    // Scroll cancellation (pointerCancel) must not toggle checked
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100 });
    fireEvent.pointerCancel(card);
    expect(toggleChecked).toHaveBeenCalledTimes(1);
  });
});
