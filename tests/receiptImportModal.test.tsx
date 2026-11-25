import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReceiptImportModal } from '../src/components/history/ReceiptImportModal';
import { useShoppingStore } from '../src/store/useShoppingStore';

describe('ReceiptImportModal item editing', () => {
  const onClose = vi.fn();
  const onImported = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    useShoppingStore.setState({
      isHydrated: true,
      items: [],
      history: [],
      markets: [
        {
          id: 'mkt-1',
          name: 'Mercado Teste',
          categoryOrder: [],
        },
      ],
      selectedMarketId: 'mkt-1',
    });
  });

  it('allows editing an item via edit button and saving changes to purchase history', () => {
    render(<ReceiptImportModal onClose={onClose} onImported={onImported} />);

    // Switch to Texto / Manual tab
    const manualTab = screen.getByText('Texto / Manual');
    fireEvent.click(manualTab);

    // Add a manual item
    const nameInput = screen.getByPlaceholderText('Item manual');
    const priceInput = screen.getByPlaceholderText('Preço');
    const addBtn = screen.getByLabelText('Adicionar item manual');

    fireEvent.change(nameInput, { target: { value: 'Ovo Bco Grande' } });
    fireEvent.change(priceInput, { target: { value: '15,90' } });
    fireEvent.click(addBtn);

    // Verify it appeared in the identified items list
    expect(screen.getByText(/Itens identificados/)).toBeInTheDocument();
    expect(screen.getByText('Total: R$ 15,90')).toBeInTheDocument();
    expect(screen.getByText('Ovo Bco Grande')).toBeInTheDocument();

    // Click edit button (pencil)
    const editBtn = screen.getByLabelText('Editar Ovo Bco Grande');
    fireEvent.click(editBtn);

    // Verify Edit Modal opened
    expect(screen.getByText('Editar item #01')).toBeInTheDocument();

    // 1. Edit Name
    const modalNameInput = screen.getByPlaceholderText('Ex: Leite Integral');
    expect(modalNameInput).toHaveValue('Ovo Bco Grande');
    fireEvent.change(modalNameInput, {
      target: { value: 'Ovo Branco Grande C/30' },
    });

    // 2. Edit Quantity
    const qtyInput = screen.getByPlaceholderText('1');
    expect(qtyInput).toHaveValue('1');
    fireEvent.change(qtyInput, { target: { value: '4' } });

    // 3. Edit Unit
    const unitSelect = screen.getByDisplayValue('un');
    fireEvent.change(unitSelect, { target: { value: 'cx' } });

    // 4. Edit Price
    const modalPriceInput = screen.getByDisplayValue('15,90');
    fireEvent.change(modalPriceInput, { target: { value: '25,50' } });

    // 5. Edit Category
    const catSelect = screen.getByDisplayValue('Alimentos');
    fireEvent.change(catSelect, { target: { value: 'bazar' } });

    // Save modal
    fireEvent.click(screen.getByText('Salvar alterações'));

    // Modal should close and row should be updated
    expect(screen.queryByText('Editar item #01')).not.toBeInTheDocument();
    expect(screen.getByText('Ovo Branco Grande C/30')).toBeInTheDocument();
    expect(screen.getByText('Total: R$ 25,50')).toBeInTheDocument();

    // 6. Save Purchase
    const saveBtn = screen.getByText('Salvar compra no histórico');
    fireEvent.click(saveBtn);

    const history = useShoppingStore.getState().history;
    expect(history).toHaveLength(1);
    expect(history[0].items).toHaveLength(1);
    const saved = history[0].items[0];
    expect(saved.name).toBe('Ovo Branco Grande C/30');
    expect(saved.category).toBe('bazar');
    expect(saved.quantity).toBe(4);
    expect(saved.unit).toBe('cx');
    expect(saved.price).toBe(25.5);
    expect(onImported).toHaveBeenCalledWith('Mercado Teste', 1);
    expect(onClose).toHaveBeenCalled();
  });

  it('triggers item editing by holding (long-press) the item on touch/mobile', () => {
    vi.useFakeTimers();
    render(<ReceiptImportModal onClose={onClose} onImported={onImported} />);

    // Switch to Texto / Manual tab
    fireEvent.click(screen.getByText('Texto / Manual'));

    // Add item
    fireEvent.change(screen.getByPlaceholderText('Item manual'), {
      target: { value: 'Queijo Mussarela' },
    });
    fireEvent.change(screen.getByPlaceholderText('Preço'), {
      target: { value: '14,00' },
    });
    fireEvent.click(screen.getByLabelText('Adicionar item manual'));

    const itemCard = screen.getByText('Queijo Mussarela').closest('.group')!;
    expect(itemCard).toBeInTheDocument();

    // Simulate pointer down (start holding)
    fireEvent.pointerDown(itemCard, { clientX: 100, clientY: 200 });

    // Advance timers for long-press threshold (450ms)
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Edit modal should now be open
    expect(screen.getByText('Editar item #01')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('adds items via "+ Adicionar item" modal and supports removing items', () => {
    render(<ReceiptImportModal onClose={onClose} onImported={onImported} />);

    // Switch to Texto / Manual tab
    fireEvent.click(screen.getByText('Texto / Manual'));

    // Add item 1
    fireEvent.change(screen.getByPlaceholderText('Item manual'), {
      target: { value: 'Pimentao Verde' },
    });
    fireEvent.change(screen.getByPlaceholderText('Preço'), {
      target: { value: '8,93' },
    });
    fireEvent.click(screen.getByLabelText('Adicionar item manual'));

    expect(screen.getByText('Pimentao Verde')).toBeInTheDocument();
    expect(screen.getByText('Total: R$ 8,93')).toBeInTheDocument();

    // Click "+ Adicionar item" button
    fireEvent.click(screen.getByText('Adicionar item'));

    // New item modal should open
    expect(screen.getByText('Adicionar item à nota')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('Ex: Leite Integral');
    fireEvent.change(nameInput, { target: { value: 'Tomate Salada' } });

    const priceInput = screen.getByPlaceholderText('0,00');
    fireEvent.change(priceInput, { target: { value: '9,63' } });

    fireEvent.click(screen.getByText('Adicionar à lista'));

    // Both items should be in the list
    expect(screen.getByText('Tomate Salada')).toBeInTheDocument();
    expect(screen.getByText('Total: R$ 18,56')).toBeInTheDocument();

    // Remove item 1
    const removeBtn = screen.getByLabelText('Remover item Pimentao Verde');
    fireEvent.click(removeBtn);

    expect(screen.queryByText('Pimentao Verde')).not.toBeInTheDocument();
    expect(screen.getByText('Tomate Salada')).toBeInTheDocument();
    expect(screen.getByText('Total: R$ 9,63')).toBeInTheDocument();
  });
});
