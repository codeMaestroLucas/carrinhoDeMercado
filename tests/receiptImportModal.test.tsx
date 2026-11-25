import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('allows full editing of name, category, quantity, unit and price on identified items', async () => {
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

    const identifiedNameInput = screen.getByLabelText('Nome do produto #1');
    expect(identifiedNameInput).toHaveValue('Ovo Bco Grande');

    // 1. Edit Product Name
    fireEvent.change(identifiedNameInput, {
      target: { value: 'Ovo Branco Grande C/30' },
    });
    expect(identifiedNameInput).toHaveValue('Ovo Branco Grande C/30');

    // 2. Edit Quantity
    const qtyInput = screen.getByLabelText('Quantidade #1');
    expect(qtyInput).toHaveValue('1');
    fireEvent.change(qtyInput, { target: { value: '4' } });
    fireEvent.blur(qtyInput);
    expect(qtyInput).toHaveValue('4');

    // 3. Edit Unit
    const unitSelect = screen.getByLabelText('Unidade de medida #1');
    expect(unitSelect).toHaveValue('un');
    fireEvent.change(unitSelect, { target: { value: 'cx' } });
    expect(unitSelect).toHaveValue('cx');

    // 4. Edit Price
    const itemPriceInput = screen.getByLabelText('Preço total #1');
    expect(itemPriceInput).toHaveValue('15,90');
    fireEvent.change(itemPriceInput, { target: { value: '25,50' } });
    fireEvent.blur(itemPriceInput);

    // Header total should update dynamically
    expect(screen.getByText('Total: R$ 25,50')).toBeInTheDocument();

    // 5. Edit Category
    const catSelect = screen.getByLabelText('Categoria do produto #1');
    fireEvent.change(catSelect, { target: { value: 'bazar' } });
    expect(catSelect).toHaveValue('bazar');

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

  it('supports decimal quantities for weight-based items and removing items', () => {
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

    // Change unit to kg and quantity to 0,820
    const unitSelect = screen.getByLabelText('Unidade de medida #1');
    fireEvent.change(unitSelect, { target: { value: 'kg' } });

    const qtyInput = screen.getByLabelText('Quantidade #1');
    fireEvent.change(qtyInput, { target: { value: '0,820' } });
    fireEvent.blur(qtyInput);
    expect(qtyInput).toHaveValue('0,82');

    // Add item 2 via "+ Adicionar item" button in list
    fireEvent.click(screen.getByText('Adicionar item'));
    expect(screen.getByLabelText('Nome do produto #2')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nome do produto #2'), {
      target: { value: 'Tomate Salada' },
    });
    fireEvent.change(screen.getByLabelText('Preço total #2'), {
      target: { value: '9,63' },
    });
    fireEvent.blur(screen.getByLabelText('Preço total #2'));

    expect(screen.getByText('Total: R$ 18,56')).toBeInTheDocument();

    // Remove item 1
    const removeBtn = screen.getByLabelText('Remover item Pimentao Verde');
    fireEvent.click(removeBtn);

    // Now only Tomate Salada remains
    expect(screen.queryByLabelText('Nome do produto #2')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nome do produto #1')).toHaveValue('Tomate Salada');
    expect(screen.getByText('Total: R$ 9,63')).toBeInTheDocument();
  });
});
