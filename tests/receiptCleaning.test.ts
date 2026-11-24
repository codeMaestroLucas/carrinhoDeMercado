import { describe, expect, it } from 'vitest';
import {
  cleanReceiptProductName,
  isTotalProductName,
  repairReceiptWord,
  mergeSplitWords,
} from '../src/services/receiptParserService';
import { NfceScannerService } from '../src/services/nfceParserService';

describe('Receipt and NFC-e Text Cleaning & Element Identification', () => {
  describe('repairReceiptWord', () => {
    it('corrects OCR digit-to-letter confusion in product words', () => {
      // 0 -> O
      expect(repairReceiptWord('0LEO')).toBe('OLEO');
      // 1 -> I
      expect(repairReceiptWord('B1SCOITO')).toBe('BISCOITO');
      expect(repairReceiptWord('LE1TE')).toBe('LEITE');
      expect(repairReceiptWord('1OGURTE')).toBe('IOGURTE');
      // 5 -> S
      expect(repairReceiptWord('5UCO')).toBe('SUCO');
      expect(repairReceiptWord('MA5SA')).toBe('MASSA');
      // 8 -> B
      expect(repairReceiptWord('8ISCOITO')).toBe('BISCOITO');
      expect(repairReceiptWord('8ANANA')).toBe('BANANA');
    });

    it('corrects OCR letter-to-letter confusion (U/V, RN/M)', () => {
      expect(repairReceiptWord('ESCOUA')).toBe('Escova');
      expect(repairReceiptWord('SVCO')).toBe('Suco');
      expect(repairReceiptWord('QVEIJO')).toBe('Queijo');
      expect(repairReceiptWord('CAME')).toBe('Carne');
    });

    it('preserves valid measurement units and numbers', () => {
      expect(repairReceiptWord('500G')).toBe('500G');
      expect(repairReceiptWord('1KG')).toBe('1KG');
      expect(repairReceiptWord('2L')).toBe('2L');
      expect(repairReceiptWord('350ML')).toBe('350ML');
    });
  });

  describe('mergeSplitWords', () => {
    it('reassembles words cut by narrow thermal receipt column wrapping', () => {
      expect(mergeSplitWords(['ES', 'COVA', 'DENTAL'])).toEqual(['ESCOVA', 'DENTAL']);
      expect(mergeSplitWords(['ESPON', 'JA', 'DE', 'ACO'])).toEqual(['ESPONJA', 'DE', 'ACO']);
      expect(mergeSplitWords(['MA', 'CA', 'RRAO'])).toEqual(['MACARRAO']);
      expect(mergeSplitWords(['MA', 'RGA', 'RINA'])).toEqual(['MARGARINA']);
    });
  });

  describe('cleanReceiptProductName', () => {
    it('expands compound supermarket abbreviations', () => {
      expect(cleanReceiptProductName('CR LEITE')).toBe('Creme de Leite');
      expect(cleanReceiptProductName('LEITE COND')).toBe('Leite Condensado');
      expect(cleanReceiptProductName('AG SANIT')).toBe('Água Sanitária');
      expect(cleanReceiptProductName('SAB PO')).toBe('Sabão em Pó');
      expect(cleanReceiptProductName('PAPEL HIG')).toBe('Papel Higiênico');
      expect(cleanReceiptProductName('DESOD AER')).toBe('Desodorante Aerossol');
      expect(cleanReceiptProductName('L MOV')).toBe('Lava Móveis');
      expect(cleanReceiptProductName('CHOC BARRA')).toBe('Chocolate em Barra');
      expect(cleanReceiptProductName('BISC RECH')).toBe('Biscoito Recheado');
    });

    it('removes parenthesized codes, PLU and internal references', () => {
      expect(cleanReceiptProductName('(Código: 12345) ARROZ TIPO 1')).toBe('Arroz Tipo 1');
      expect(cleanReceiptProductName('BANANA PRATA (Cód: 4011)')).toBe('Banana Prata');
      expect(cleanReceiptProductName('MACA NACIONAL (PLU: 4131)')).toBe('Maçã Nacional');
      expect(cleanReceiptProductName('FEIJAO PRETO (Ref: 99)')).toBe('Feijão Preto');
      expect(cleanReceiptProductName('LEITE INTEGRAL NCM 0401.20.10')).toBe('Leite Integral');
    });

    it('removes leading barcodes and item sequence numbers', () => {
      expect(cleanReceiptProductName('7891234567890 CAFE TORRADO')).toBe('Café Torrado');
      expect(cleanReceiptProductName('001 7891000100100 ARROZ BRANCO 5KG')).toBe('Arroz Branco 5kg');
    });

    it('removes trailing tax codes and fiscal noise', () => {
      expect(cleanReceiptProductName('SABONETE DOVE 90G F1')).toBe('Sabonete Dove 90g');
      expect(cleanReceiptProductName('DETERGENTE YPE 500ML T18%')).toBe('Detergente Ypê 500ml');
      expect(cleanReceiptProductName('REFRIGERANTE COCA COLA 2L T19,00%')).toBe('Refrigerante Coca Cola 2l');
      expect(cleanReceiptProductName('OLEO DE SOJA SOYA 900ML ST')).toBe('Óleo de Soja Soya 900ml');
      expect(cleanReceiptProductName('PAO DE FORMA ICMS 18%')).toBe('Pão de Forma');
    });

    it('removes trailing quantity and unit multiplier residues', () => {
      expect(cleanReceiptProductName('ARROZ 5KG 1 UN X 25,90')).toBe('Arroz 5kg');
      expect(cleanReceiptProductName('BANANA PRATA KG: KG VL UNIT: 7,99')).toBe('Banana Prata');
      expect(cleanReceiptProductName('AGUA MINERAL UN: UN')).toBe('Água Mineral');
    });

    it('cleans stray OCR symbols and formatting junk', () => {
      expect(cleanReceiptProductName('*** CAFE PILAO 500G ***')).toBe('Café Pilão 500g');
      expect(cleanReceiptProductName('>>> IOGURTE NATURAL <<<')).toBe('Iogurte Natural');
      expect(cleanReceiptProductName('# MANTEIGA COM SAL |')).toBe('Manteiga com Sal');
    });

    it('formats title casing and standard volume/weight abbreviations nicely', () => {
      expect(cleanReceiptProductName('LEITE UHT INTEGRAL 1L')).toBe('Leite UHT Integral 1l');
      expect(cleanReceiptProductName('AZEITE DE OLIVA EV 500ML')).toBe('Azeite de Oliva Extra Virgem 500ml');
      expect(cleanReceiptProductName('FARINHA DE TRIGO 1KG')).toBe('Farinha de Trigo 1kg');
    });
  });

  describe('isTotalProductName', () => {
    it('detects receipt summary lines so they are not parsed as products', () => {
      expect(isTotalProductName('VALOR TOTAL R$ 123,45')).toBe(true);
      expect(isTotalProductName('TOTAL A PAGAR')).toBe(true);
      expect(isTotalProductName('SUBTOTAL')).toBe(true);
      expect(isTotalProductName('VALOR APROX TRIBUTOS')).toBe(true);
      expect(isTotalProductName('TROCO R$ 10,00')).toBe(true);
      expect(isTotalProductName('FORMA DE PAGAMENTO')).toBe(true);
      expect(isTotalProductName('CARTAO DE CREDITO')).toBe(true);
      expect(isTotalProductName('VALOR PAGO')).toBe(true);
    });

    it('does NOT reject real products containing the word "total"', () => {
      expect(isTotalProductName('CREME DENTAL COLGATE TOTAL 12 90G')).toBe(false);
      expect(isTotalProductName('CEREAL TOTAL FIBRA 300G')).toBe(false);
      expect(isTotalProductName('RAÇÃO TOTAL MAX CAT 1KG')).toBe(false);
    });
  });

  describe('NfceScannerService HTML parsing & element classification', () => {
    it('parses NFC-e HTML table, cleans names, extracts prices, and auto-classifies items', () => {
      const sampleHtml = `
        <html>
          <body>
            <div class="txtTopo">SUPERMERCADO SUPER BOM LTDA</div>
            <table id="tabResult">
              <tr id="Item + 1">
                <td class="fixo-prod-serv-descricao">
                  <span class="txtTit">001 7891000100100 CR LEITE NESTLE 200G (Cód: 102) F1</span>
                  <span class="RCod">(Código: 102)</span>
                </td>
                <td class="fixo-prod-serv-qtd">
                  <span class="Rqtd">Qtde.: 2,000</span>
                  <span class="Run">UN: UN</span>
                  <span class="RvlUnit">Vl. Unit.: 4,50</span>
                </td>
                <td class="fixo-prod-serv-preco">
                  <span class="valor">9,00</span>
                </td>
              </tr>
              <tr id="Item + 2">
                <td class="fixo-prod-serv-descricao">
                  <span class="txtTit">002 SAB PO YPE 800G T18%</span>
                </td>
                <td class="fixo-prod-serv-qtd">
                  <span class="Rqtd">Qtde.: 1,000</span>
                  <span class="Run">UN: CX</span>
                  <span class="RvlUnit">Vl. Unit.: 12,90</span>
                </td>
                <td class="fixo-prod-serv-preco">
                  <span class="valor">12,90</span>
                </td>
              </tr>
              <tr id="Total">
                <td class="fixo-prod-serv-descricao">
                  <span class="txtTit">TOTAL A PAGAR</span>
                </td>
                <td class="fixo-prod-serv-preco">
                  <span class="valor">21,90</span>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const result = NfceScannerService.parseNfceHtml(sampleHtml);
      expect(result.marketName).toBe('SUPERMERCADO SUPER BOM LTDA');
      expect(result.items.length).toBe(2);

      // Item 1: CR LEITE NESTLE 200G -> Creme de Leite Nestle 200g
      const item1 = result.items[0];
      expect(item1.name).toContain('Creme de Leite');
      expect(item1.price).toBe(9);
      expect(item1.unitPrice).toBe(4.5);
      expect(item1.quantity).toBe(2);
      expect(item1.category).toBe('alimentos');

      // Item 2: SAB PO YPE 800G -> Sabão em Pó Ype 800g
      const item2 = result.items[1];
      expect(item2.name).toContain('Sabão em Pó');
      expect(item2.price).toBe(12.9);
      expect(item2.quantity).toBe(1);
      expect(item2.category).toBe('limpeza');
    });
  });
});
