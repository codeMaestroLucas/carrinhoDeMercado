import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReceiptImportModal } from '../src/components/history/ReceiptImportModal';
import { ReceiptScannerService } from '../src/services/receiptParserService';
import { useShoppingStore } from '../src/store/useShoppingStore';

describe('ReceiptImportModal item editing and gestures', () => {
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

  it('allows holding (long-press) an item to edit all fields and saves changes to purchase history', () => {
    vi.useFakeTimers();
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

    // Verify edit/remove buttons are NOT present in the row
    expect(screen.queryByLabelText(/Editar Ovo/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Remover item Ovo/)).not.toBeInTheDocument();

    // Hold (long-press) item for 450ms
    const itemCard = screen.getByText('Ovo Bco Grande').closest('.touch-pan-y')!;
    fireEvent.pointerDown(itemCard, { clientX: 100, clientY: 200 });
    act(() => {
      vi.advanceTimersByTime(500);
    });

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

    vi.useRealTimers();
  });

  it('swipes left from right to left to remove an item from the identified items list', () => {
    vi.useFakeTimers();
    render(<ReceiptImportModal onClose={onClose} onImported={onImported} />);

    // Switch to Texto / Manual tab
    fireEvent.click(screen.getByText('Texto / Manual'));

    // Add 2 items
    fireEvent.change(screen.getByPlaceholderText('Item manual'), {
      target: { value: 'Pimentao Verde' },
    });
    fireEvent.change(screen.getByPlaceholderText('Preço'), {
      target: { value: '8,93' },
    });
    fireEvent.click(screen.getByLabelText('Adicionar item manual'));

    fireEvent.change(screen.getByPlaceholderText('Item manual'), {
      target: { value: 'Tomate Salada' },
    });
    fireEvent.change(screen.getByPlaceholderText('Preço'), {
      target: { value: '9,63' },
    });
    fireEvent.click(screen.getByLabelText('Adicionar item manual'));

    expect(screen.getByText('Pimentao Verde')).toBeInTheDocument();
    expect(screen.getByText('Tomate Salada')).toBeInTheDocument();
    expect(screen.getByText('Total: R$ 18,56')).toBeInTheDocument();

    // Swipe left on item 1: start at clientX: 200, move to 90 (deltaX: -110), release
    const pimentaoCard = screen.getByText('Pimentao Verde').closest('div[style]')!;
    fireEvent.mouseDown(pimentaoCard, { clientX: 200, clientY: 100 });
    fireEvent.mouseMove(pimentaoCard, { clientX: 90, clientY: 100 });
    fireEvent.mouseUp(pimentaoCard, { clientX: 90, clientY: 100 });

    act(() => {
      vi.runAllTimers();
    });

    // Pimentao Verde should be removed, leaving only Tomate Salada
    expect(screen.queryByText('Pimentao Verde')).not.toBeInTheDocument();
    expect(screen.getByText('Tomate Salada')).toBeInTheDocument();
    expect(screen.getByText('Total: R$ 9,63')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('adds items via "+ Adicionar item" modal', () => {
    render(<ReceiptImportModal onClose={onClose} onImported={onImported} />);

    // Switch to Texto / Manual tab
    fireEvent.click(screen.getByText('Texto / Manual'));

    // Add item 1
    fireEvent.change(screen.getByPlaceholderText('Item manual'), {
      target: { value: 'Alface Crespa' },
    });
    fireEvent.change(screen.getByPlaceholderText('Preço'), {
      target: { value: '4,50' },
    });
    fireEvent.click(screen.getByLabelText('Adicionar item manual'));

    expect(screen.getByText('Alface Crespa')).toBeInTheDocument();
    expect(screen.getByText('Total: R$ 4,50')).toBeInTheDocument();

    // Click "+ Adicionar item" button
    fireEvent.click(screen.getByText('Adicionar item'));

    // New item modal should open
    expect(screen.getByText('Adicionar item à nota')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('Ex: Leite Integral');
    fireEvent.change(nameInput, { target: { value: 'Queijo Prato' } });

    const priceInput = screen.getByPlaceholderText('0,00');
    fireEvent.change(priceInput, { target: { value: '18,20' } });

    fireEvent.click(screen.getByText('Adicionar à lista'));

    // Both items should be in the list
    expect(screen.getByText('Alface Crespa')).toBeInTheDocument();
    expect(screen.getByText('Queijo Prato')).toBeInTheDocument();
    expect(screen.getByText('Total: R$ 22,70')).toBeInTheDocument();
  });

  it('displays gesture chips and shows a tap hint when clicking without holding', () => {
    vi.useFakeTimers();
    render(<ReceiptImportModal onClose={onClose} onImported={onImported} />);

    // Switch to Texto / Manual tab and add an item
    fireEvent.click(screen.getByText('Texto / Manual'));
    fireEvent.change(screen.getByPlaceholderText('Item manual'), {
      target: { value: 'Suco de Uva' },
    });
    fireEvent.change(screen.getByPlaceholderText('Preço'), {
      target: { value: '12,50' },
    });
    fireEvent.click(screen.getByLabelText('Adicionar item manual'));

    // Check intuitive header chips
    expect(screen.getByText('Segure p/ editar')).toBeInTheDocument();
    expect(screen.getByText('Deslize p/ excluir')).toBeInTheDocument();

    // Perform a quick tap (pointerdown and pointerup without waiting 450ms)
    const itemCard = screen.getByText('Suco de Uva').closest('.touch-pan-y')!;
    fireEvent.pointerDown(itemCard, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(itemCard, { clientX: 100, clientY: 100 });

    // The tap hint should appear
    expect(
      screen.getByText(
        'Dica: segure o item para editar • deslize para a esquerda para excluir',
      ),
    ).toBeInTheDocument();

    // After hint timeout expires, hint disappears
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(
      screen.queryByText(
        'Dica: segure o item para editar • deslize para a esquerda para excluir',
      ),
    ).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('opens the image editor (crop, rotate, adjust) before sending a photo to OCR', () => {
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock-receipt');
    URL.revokeObjectURL = vi.fn();

    try {
      render(<ReceiptImportModal onClose={onClose} onImported={onImported} />);

      fireEvent.click(screen.getByText('Foto OCR'));
      expect(screen.getByText('Tirar foto do cupom')).toBeInTheDocument();
      expect(screen.getByText('Escolher da galeria')).toBeInTheDocument();

      const galleryInput = screen
        .getByText('Escolher da galeria')
        .closest('label')!
        .querySelector('input[type="file"]') as HTMLInputElement;

      const fakeFile = new File(['fake-image-bytes'], 'cupom.jpg', {
        type: 'image/jpeg',
      });
      fireEvent.change(galleryInput, { target: { files: [fakeFile] } });

      expect(
        screen.getByRole('dialog', { name: 'Editar foto do cupom' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Cortar e Girar')).toBeInTheDocument();
      expect(screen.getByText('Ajustes OCR')).toBeInTheDocument();
      expect(screen.getByText('-90°')).toBeInTheDocument();
      expect(screen.getByText('+90°')).toBeInTheDocument();

      fireEvent.click(screen.getByText('+90°'));
      fireEvent.click(screen.getByText('Ajustes OCR'));
      expect(screen.getByText('Realçar texto (Preto e Branco)')).toBeInTheDocument();
      expect(screen.getByLabelText('Brilho')).toBeInTheDocument();
      expect(screen.getByLabelText('Contraste')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancelar'));
      expect(
        screen.queryByRole('dialog', { name: 'Editar foto do cupom' }),
      ).not.toBeInTheDocument();
    } finally {
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
    }
  });

  it('blocks pull-to-refresh while ReceiptImportModal is open and restores overscroll on unmount', () => {
    const { unmount } = render(
      <ReceiptImportModal onClose={onClose} onImported={onImported} />,
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Importar cupom fiscal',
    });
    expect(dialog).toHaveAttribute('data-disable-pull-to-refresh', 'true');
    expect(document.body.style.overscrollBehaviorY).toBe('none');
    expect(document.documentElement.style.overscrollBehaviorY).toBe('none');

    unmount();

    expect(document.body.style.overscrollBehaviorY).toBe('');
    expect(document.documentElement.style.overscrollBehaviorY).toBe('');
  });

  it('hides camera/gallery upload buttons after confirming an OCR photo and restores them when removing the photo', async () => {
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    const OrigImage = globalThis.Image;

    URL.createObjectURL = vi.fn(() => 'blob:mock-edited-receipt');
    URL.revokeObjectURL = vi.fn();

    class MockImage {
      naturalWidth = 400;
      naturalHeight = 600;
      width = 400;
      height = 600;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_val: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    globalThis.Image = MockImage as unknown as typeof Image;

    try {
      vi.spyOn(
        ReceiptScannerService,
        'recognizeTextFromImageFile',
      ).mockResolvedValue('001 LEITE INTEGRAL 1L 5,49');

      render(<ReceiptImportModal onClose={onClose} onImported={onImported} />);

      fireEvent.click(screen.getByText('Foto OCR'));
      expect(screen.getByText('Tirar foto do cupom')).toBeInTheDocument();
      expect(screen.getByText('Escolher da galeria')).toBeInTheDocument();

      const galleryInput = screen
        .getByText('Escolher da galeria')
        .closest('label')!
        .querySelector('input[type="file"]') as HTMLInputElement;

      const fakeFile = new File(['fake-image-bytes'], 'cupom.jpg', {
        type: 'image/jpeg',
      });
      fireEvent.change(galleryInput, { target: { files: [fakeFile] } });

      const confirmBtn = await screen.findByText('Usar foto e ler OCR');
      await waitFor(() => expect(confirmBtn).not.toBeDisabled());
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText('Foto do cupom pronta')).toBeInTheDocument();
      });
      expect(screen.queryByText('Tirar foto do cupom')).not.toBeInTheDocument();
      expect(screen.queryByText('Escolher da galeria')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Remover foto')).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Remover foto'));
      expect(screen.queryByText('Foto do cupom pronta')).not.toBeInTheDocument();
      expect(screen.getByText('Tirar foto do cupom')).toBeInTheDocument();
      expect(screen.getByText('Escolher da galeria')).toBeInTheDocument();
    } finally {
      globalThis.Image = OrigImage;
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
    }
  });
});
