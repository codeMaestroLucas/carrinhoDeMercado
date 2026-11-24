import { describe, expect, it } from 'vitest';
import { CategoryClassifier } from '../src/services/categoryClassifier';
import { NfceScannerService } from '../src/services/nfceParserService';
import { ReceiptScannerService } from '../src/services/receiptParserService';
import { AppFormatters } from '../src/utils/formatters';

describe('NfceScannerService Tests', () => {
  it('Extracts 44-digit access key from URL or raw text', () => {
    const sampleUrl =
      'https://www.nfce.fazenda.sp.gov.br/qrcode?p=35230912345678000190650010000012341234567890|2|1|1|CC48';
    const key = NfceScannerService.extractAccessKey(sampleUrl);
    expect(key).toBe('35230912345678000190650010000012341234567890');
    expect(NfceScannerService.getUfFromAccessKey(key!)).toBe('SP');
    expect(NfceScannerService.getCnpjFromAccessKey(key!)).toBe('12.345.678/0001-90');

    const resolvedUrl = NfceScannerService.resolveUrlFromInput(key!);
    expect(resolvedUrl).toContain('fazenda.sp.gov.br');
    expect(resolvedUrl).toContain(key!);
  });

  it('Resolves direct SEFAZ URLs from QR code or access key correctly', () => {
    const qrUrl =
      'http://www.fazenda.pr.gov.br/nfce/qrcode?p=41240112345678000190650010000012341234567890|2|1|1|ABCD';
    expect(NfceScannerService.resolveUrlFromInput(qrUrl)).toBe(qrUrl);

    const mgKey = '31240112345678000190650010000012341234567890';
    const resolvedFromMgKey = NfceScannerService.resolveUrlFromInput(mgKey);
    expect(resolvedFromMgKey).toContain('fazenda.mg.gov.br');
    expect(resolvedFromMgKey).toContain(mgKey);
  });

  it('Parses HTML items, market name and date from NFC-e table', () => {
    const sampleHtml = `
<!DOCTYPE html>
<html>
<body>
  <div class="txtTopo">SUPERMERCADO BOA COMPRA LTDA</div>
  <div>Emissão: 15/09/2024 14:30:00</div>
  <table id="tabResult">
    <tr id="Item + 1">
      <td>
        <span class="txtTit">ARROZ TIPO 1 CAMIL 5KG</span>
        <span class="Rqtd">Qtde.: 1,000</span>
        <span class="RUN">UN: UN</span>
        <span class="valor">24,90</span>
      </td>
    </tr>
    <tr id="Item + 2">
      <td>
        <span class="txtTit">LEITE INTEGRAL PIRACANJUBA 1L</span>
        <span class="Rqtd">Qtde.: 3,000</span>
        <span class="RUN">UN: UN</span>
        <span class="valor">14,70</span>
      </td>
    </tr>
  </table>
  <span class="totalNfe">Total: R$ 39,60</span>
</body>
</html>
`;

    const result = NfceScannerService.parseNfceHtml(
      sampleHtml,
      '35230912345678000190650010000012341234567890',
    );

    expect(result.items.length).toBe(2);
    expect(result.marketName).toBe('SUPERMERCADO BOA COMPRA LTDA');
    expect(result.items[0].name).toBe('Arroz Tipo 1 Camil 5kg');
    expect(result.items[0].price).toBe(24.9);
    expect(result.items[0].quantity).toBe(1.0);
    expect(result.items[0].category).toBe('alimentos');
    expect(result.items[1].name).toBe('Leite Integral Piracanjuba 1l');
    expect(result.items[1].price).toBe(14.7);
    expect(result.items[1].quantity).toBe(3.0);
    expect(result.items[1].unitPrice).toBeCloseTo(4.9);
    expect(result.items[1].category).toBe('alimentos');
  });

  it('Accurately parses SEFAZ NFC-e quantity formats', () => {
    expect(NfceScannerService.parseNfceQuantity('1.000')).toBe(1.0);
    expect(NfceScannerService.parseNfceQuantity('2.000')).toBe(2.0);
    expect(NfceScannerService.parseNfceQuantity('3.000')).toBe(3.0);
    expect(NfceScannerService.parseNfceQuantity('1.0000')).toBe(1.0);
    expect(NfceScannerService.parseNfceQuantity('0.450')).toBe(0.45);
    expect(NfceScannerService.parseNfceQuantity('0,450')).toBe(0.45);
  });
});

describe('ReceiptScannerService & Formatters Tests', () => {
  it('parses OCR receipt lines with abbreviations and OCR repairs', () => {
    const raw = `
SUPERMERCADO MODELO
001 ARR TIPO 1 CAMIL 5KG 1 UN X 24,90 24,90
002 ESCOUA DENTAL COLGATE 1 UN X 12,50 12,50
003 VALOR TOTAL A PAGAR 37,40
`;
    const items = ReceiptScannerService.parseReceiptText(raw);
    expect(items.length).toBe(2);
    expect(items[0].name).toContain('Arroz');
    expect(items[0].price).toBe(24.9);
    expect(items[1].name).toContain('Escova');
    expect(items[1].price).toBe(12.5);
  });

  it('extracts quantity and unit from pasted shopping list items', () => {
    const p1 = CategoryClassifier.extractQuantityAndName('2kg Batata');
    expect(p1).toEqual({
      name: 'Batata',
      quantity: 2,
      unit: 'kg',
      isPriceTotalByDefault: true,
    });

    const p2 = CategoryClassifier.extractQuantityAndName('3x Leite Integral');
    expect(p2).toEqual({
      name: 'Leite Integral',
      quantity: 3,
      unit: 'un',
      isPriceTotalByDefault: false,
    });

    const pasted = CategoryClassifier.parsePastedList(
      '- 2kg Arroz\n- Feijão\n- arroz 2kg',
    );
    expect(pasted).toEqual(['2kg Arroz', 'Feijão']);
  });

  it('formats currency and quantities in pt-BR', () => {
    expect(AppFormatters.formatCurrency(1234.5)).toBe('R$ 1.234,50');
    expect(AppFormatters.formatQuantity(0.54, 'kg')).toBe('0,54 kg');
    expect(AppFormatters.parsePrice('R$ 12,90')).toBe(12.9);
  });
});
