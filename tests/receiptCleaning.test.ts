import { describe, expect, it } from 'vitest';
import {
  applyLocalSauvolaSoftContrast,
  cleanReceiptProductName,
  computeReceiptTargetDimensions,
  isTotalProductName,
  repairReceiptWord,
  mergeSplitWords,
  ReceiptScannerService,
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

    it('decodes HTML entities and removes embedded SEFAZ codes in DANFE and generic tables', () => {
      const danfeHtml = `
        <html>
          <body>
            <div class="col" style="font-weight: bold;">ATACADAO DIA A DIA</div>
            <ul class="list-group">
              <li class="list-group-item">
                <div class="row">
                  <div class="col-9">
                    <p class="h6">MA&Ccedil;&Atilde; FUJI KG <small>(C&oacute;d: 4131)</small></p>
                  </div>
                  <div class="col-3">R$ 7,98</div>
                </div>
                <div>Qtde.: 0,850 UN: KG Vl. Unit.: R$ 9,39</div>
              </li>
              <li class="list-group-item">
                <div class="row">
                  <div class="col-9">
                    <p class="h6">1048291 - BISC. RECH. OREO ORIG. 90G <small>(C&oacute;digo: 1048291)</small></p>
                  </div>
                  <div class="col-3">R$ 5,98</div>
                </div>
                <div>Qtde.: 2,000 UN: UN Vl. Unit.: R$ 2,99</div>
              </li>
            </ul>
          </body>
        </html>
      `;

      const result = NfceScannerService.parseNfceHtml(danfeHtml);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe('Maçã Fuji');
      expect(result.items[0].quantity).toBeCloseTo(0.85);
      expect(result.items[0].unit).toBe('kg');
      expect(result.items[1].name).toBe('Biscoito Recheado Oreo Original 90g');
      expect(result.items[1].quantity).toBe(2);
      expect(result.items[1].unit).toBe('un');
    });
  });

  describe('Enhanced NFC-e & OCR noise removal', () => {
    it('removes stray numbers, codes, units and punctuation while preserving meaningful numbers', () => {
      expect(cleanReceiptProductName('MELAO AMARELO 4821')).toBe('Melão Amarelo');
      expect(cleanReceiptProductName('004521 MELAO AMARELO KG')).toBe('Melão Amarelo');
      expect(cleanReceiptProductName('BISC. RECH. OREO ORIG. 90G (Cód.: 1048291)')).toBe(
        'Biscoito Recheado Oreo Original 90g',
      );
      expect(cleanReceiptProductName('LEITE UHT INT. PIRACANJUBA 1 LT * 1UN X 4,99 F1')).toBe(
        'Leite UHT Integral Piracanjuba 1l',
      );
      expect(cleanReceiptProductName('ARROZ T1 CAMIL 5KG 02')).toBe('Arroz Tipo 1 Camil 5kg');
      expect(cleanReceiptProductName('SABONETE DOVE 90G T1')).toBe('Sabonete Dove 90g');
      expect(cleanReceiptProductName('DESINFETANTE PINHO SOL 500ML 1')).toBe(
        'Desinfetante Pinho Sol 500ml',
      );
      expect(cleanReceiptProductName('CREME DENTAL COLGATE TOTAL 12 90G')).toBe(
        'Creme Dental Colgate Total 12 90g',
      );
      expect(cleanReceiptProductName('| . 003 ) MANTEIGA C/SAL AVIACAO 200G - 02 ;')).toBe(
        'Manteiga com Sal Aviacao 200g',
      );
      expect(cleanReceiptProductName('KIT CHOC 2X100G 7891000100100')).toBe(
        'Kit Chocolate 2x100g',
      );
      expect(cleanReceiptProductName('3 CORACOES CAFE TRAD 500G 01')).toBe(
        '3 Coracoes Café Tradicional 500g',
      );
    });

    it('parses copied SEFAZ plain text cleanly without leaking Qtde./Vl. Total into names', () => {
      const sefazCopied = `
SUPERMERCADO PAO DE ACUCAR
CNPJ: 47.508.411/0001-56
LEITE UHT INTEGRAL PIRACANJUBA 1L (Código: 123456 )
Qtde.: 3   UN: UN   Vl. Unit.:   5,49
Vl. Total
16,47
ARROZ BRANCO T1 CAMIL 5KG
(Cód: 1019816)
Qtde.: 2,000 UN: UN Vl. Unit.: R$ 26,90
Vl. Total: R$ 53,80
BANANA PRATA KG (Código: 4011 )
Qtde.: 0,740   UN: KG   Vl. Unit.:   7,99
Vl. Total
5,91
Qtd. total de itens: 3
Valor total R$: 76,18
`;

      const items = ReceiptScannerService.parseReceiptText(sefazCopied);
      expect(items).toHaveLength(3);
      expect(items[0].name).toBe('Leite UHT Integral Piracanjuba 1l');
      expect(items[0].quantity).toBe(3);
      expect(items[0].price).toBe(16.47);
      expect(items[1].name).toBe('Arroz Branco Tipo 1 Camil 5kg');
      expect(items[1].quantity).toBe(2);
      expect(items[1].price).toBe(53.8);
      expect(items[2].name).toBe('Banana Prata');
      expect(items[2].quantity).toBeCloseTo(0.74);
      expect(items[2].unit).toBe('kg');
      expect(items[2].price).toBe(5.91);
    });

    it('parses noisy OCR receipts with spaced prices, tabular quantities, and ignores PIX/tributos', () => {
      const noisyOcr = `
001 7891000315507 CR. LE1TE NESTLE 200G 2 UN X 4,50 F1 9,00
002 004011 BANANA PRATA KG 0,850 KG x 7,99 6,79
003 7891150056534 SAB. EM P0 OMO LAV. PERF. 800G T18,00% 15,90
004 7891991010856 CERV. BRAHMA 350ML 6 UN 3,50 21,00
005 | . 7894900011517 - REFRIG COCA-COLA 2L 1UN 9, 49
006 MELAO AMARELO 4821 1 UN X 8,90 8,90
QTD. TOTAL DE ITENS 006
VALOR TOTAL R$ 71,08
PIX 71,08
TRIB APROX R$ 11,20 FED EST
`;

      const items = ReceiptScannerService.parseReceiptText(noisyOcr);
      expect(items).toHaveLength(6);
      expect(items[0].name).toBe('Creme de Leite Nestle 200g');
      expect(items[1].name).toBe('Banana Prata');
      expect(items[1].quantity).toBeCloseTo(0.85);
      expect(items[2].name).toBe('Sabão em Pó Omo Lavagem Perfeita 800g');
      expect(items[3].name).toBe('Cerveja Brahma 350ml');
      expect(items[3].quantity).toBe(6);
      expect(items[3].price).toBe(21);
      expect(items[4].name).toBe('Refrigerante Coca-Cola 2l');
      expect(items[4].price).toBe(9.49);
      expect(items[5].name).toBe('Melão Amarelo');
    });

    it('handles two-line NFC-e OCR noise, math reconciliation, bazar items, and footer cutoff', () => {
      const twoLineOcr = `
DOCUMENTO AUXILIAR
DA NOTA FISCAL DE CONSUMIDOR ELETRONICA
ITEM | COD | DESC | QTDE | UN | VL. UNIT | VL. TOTAL R$
001 7897542800037 OVO BCO GRANDE C/30
4,000 Un x 15,90 15,90
OU: 7koG2A56065460 SALG ARR KOD 70G CEB
2,000 Un x 5,29 10,58
004 1230 PEI PERU D SADIA FT
0,084 kg x 84,90 71,13
005 3954 PINENIÃAO VERDE ka
0,820 Kg x 10,90 8,93
ou7 69 TOMATE SALADA kg
0,570 Ka x 16,90 9,63
0,570 Ka x 16,890 9,63
008 7E37186077215 PARAFUSO+BUCHA 6MM
1.009 Un x 8,19 6,19
009 7891040216260 FITA DF FIXA FORTE
1,000 Un x 39,90 39,90
4 010 T7695493990426 EXTENSAO 1.5 20A ILU
2,000 Un x 63,50 127,00
2X 011 7698322644049 FILIRO LINHA S1ONADA
2,000 Un x 46,90 43,80
012 7897186077772 CHAVE ALLEN DOBRAVEL
o 1.000 Un x 24,49 24,48
22 013 7657186077222 PARAFUSO +BUCHA 8MM
És 1.000 Un x 8,49 6,49
Ol& 7697186obas32 ESTILETE LARGO VESTE
1,000 Un x 16,49 16,49
& 016 7691112027015 IESOU USO GERAL TRAM
1,000 Un x 22,90 22,90
018 7898193140435 DESENG WD-40 300HL
1,000 Un x 47,90 47,90
QID. TOTAL DE IJENS 14
VHL OR JOTAL R$ 551,12
VALOR A PAGAR R$ 551,12
Cart Credito 39,90
Cartao Alimentacao 511,22
Ão 551,12
Ser 551,12
`;

      const items = ReceiptScannerService.parseReceiptText(twoLineOcr);
      expect(items).toHaveLength(14);

      expect(items[0].name).toBe('Ovo Branco Grande c/30');
      expect(items[0].quantity).toBe(1);
      expect(items[0].price).toBe(15.9);
      expect(items[0].category).toBe('alimentos');

      expect(items[1].name).toBe('Salgado Arroz Kod 70g Cebola');
      expect(items[1].quantity).toBe(2);
      expect(items[1].price).toBe(10.58);
      expect(items[1].category).toBe('alimentos');

      expect(items[2].name).toBe('Peito de Peru D Sadia Fatiado');
      expect(items[2].quantity).toBeCloseTo(0.084);
      expect(items[2].unit).toBe('kg');
      expect(items[2].price).toBe(7.13);

      expect(items[3].name).toBe('Pimentão Verde');
      expect(items[3].category).toBe('hortifruti');
      expect(items[3].price).toBe(8.93);

      expect(items[4].name).toBe('Tomate Salada');
      expect(items[4].unit).toBe('kg');
      expect(items[4].price).toBe(9.63);

      // Orphaned detail line ("0,570 Ka x 16,890 9,63") must NOT create a bogus item
      expect(items.some((it) => it.name.includes('16,890'))).toBe(false);

      expect(items[5].name).toBe('Parafuso Bucha 6mm');
      expect(items[5].quantity).toBe(1);
      expect(items[5].price).toBe(8.19);
      expect(items[5].category).toBe('bazar');

      expect(items[6].name).toBe('Fita Dupla Face Fixa Forte');
      expect(items[6].category).toBe('bazar');

      expect(items[7].name).toBe('Extensão 1.5 20a Ilu');
      expect(items[7].price).toBe(127);
      expect(items[7].category).toBe('bazar');

      expect(items[8].name).toBe('Filtro de Linha 5 Tomadas');
      expect(items[8].quantity).toBe(2);
      expect(items[8].price).toBe(93.8);
      expect(items[8].category).toBe('bazar');

      expect(items[9].name).toBe('Chave Allen Dobrável');
      expect(items[9].price).toBe(24.49);
      expect(items[9].category).toBe('bazar');

      expect(items[10].name).toBe('Parafuso Bucha 8mm');
      expect(items[10].price).toBe(8.49);
      expect(items[10].category).toBe('bazar');

      expect(items[11].name).toBe('Estilete Largo Veste');
      expect(items[11].category).toBe('bazar');

      expect(items[12].name).toBe('Tesoura Uso Geral Tramontina');
      expect(items[12].category).toBe('bazar');

      expect(items[13].name).toBe('Desengripante WD-40 300ml');
      expect(items[13].price).toBe(47.9);
      expect(items[13].category).toBe('bazar');
    });

    it('parses Dona de Casa thermal receipt with OCR distortions, barcodes, and weighed items', () => {
      const donaDeCasaOcr = `
CNPJ do Emitente 11.832.478/0015-08
DONA DE CASA S/A
RUA Q SEPN 506 BLOCO A LOJA 1 2 3 4, SN, ASA NORTE -
BRASILIA DF, FONE (61)32464250
Documento Auxiliar da Nota Fiscal de Consumidor Eletronica
25/11/26 18:05:27 LJ 00014 PDV 001 DOC 95134 OP FISCAL SELF CHEC
# | COD | DESCRICAO DO ITEM | QTD| UN | VL UNIT R$ | VL TOTAL R$
Cooi 7bsbes3btib7t Queijo Nacon 200g Parmesao 1un 34.99 34.99
Creme de Leite Ifálac 200g TP 1UN 4.49 4.49
Co3 7bcscbogso222 Creme de Leite Italac 200g TP 1un 4.49 4.49
7bsbobos4c222 Creme de Leite Italac 200g Tipo 1un 4.49 4.49
005 33 Alho Ko O,iiok6 59,99 6,60
006 82 Limão Siciliano Kg O,19ok6 19,90 3,78
007 3 Cebola Ka O,336k6 14,99 5,04
Dos 29404 Sacola Reutilizavel Und 2un 0,22 0,44
Qtde. Total de Itens 8
Velor É Pegar 64,32
Cartao Debito 64,32
`;

      const items = ReceiptScannerService.parseReceiptText(donaDeCasaOcr);

      // Footer "Velor É Pegar 64,32" and payment lines MUST NOT be parsed as items
      expect(items.some((it) => /velor|pegar|debito|cartao/i.test(it.name))).toBe(false);

      // Queijo Nacon
      const queijo = items.find((it) => it.name.includes('Queijo'));
      expect(queijo).toBeDefined();
      expect(queijo?.name).toBe('Queijo Nacon 200g Parmesão');
      expect(queijo?.price).toBe(34.99);
      expect(queijo?.quantity).toBe(1);

      // Creme de Leite Italac - 3 lines of 4.49 consolidated into 3 un, R$ 13.47
      const cremeLeite = items.find((it) => it.name.includes('Creme de Leite'));
      expect(cremeLeite).toBeDefined();
      expect(cremeLeite?.name).toBe('Creme de Leite Italac 200g');
      expect(cremeLeite?.quantity).toBe(3);
      expect(cremeLeite?.price).toBe(13.47);
      expect(cremeLeite?.unitPrice).toBe(4.49);

      // Alho weighed (0.110 kg at 59.99/kg = 6.60)
      const alho = items.find((it) => it.name.includes('Alho'));
      expect(alho).toBeDefined();
      expect(alho?.name).toBe('Alho');
      expect(alho?.unit).toBe('kg');
      expect(alho?.quantity).toBeCloseTo(0.11, 2);
      expect(alho?.price).toBe(6.6);

      // Limão Siciliano weighed (0.190 kg at 19.90/kg = 3.78)
      const limao = items.find((it) => it.name.includes('Limão'));
      expect(limao).toBeDefined();
      expect(limao?.name).toBe('Limão Siciliano');
      expect(limao?.unit).toBe('kg');
      expect(limao?.quantity).toBeCloseTo(0.19, 2);
      expect(limao?.price).toBe(3.78);

      // Cebola weighed (0.336 kg at 14.99/kg = 5.04)
      const cebola = items.find((it) => it.name.includes('Cebola'));
      expect(cebola).toBeDefined();
      expect(cebola?.name).toBe('Cebola');
      expect(cebola?.unit).toBe('kg');
      expect(cebola?.quantity).toBeCloseTo(0.336, 3);
      expect(cebola?.price).toBe(5.04);

      // Sacola Reutilizável (2 un at 0.22 = 0.44)
      const sacola = items.find((it) => it.name.includes('Sacola'));
      expect(sacola).toBeDefined();
      expect(sacola?.name).toBe('Sacola Reutilizável');
      expect(sacola?.quantity).toBe(2);
      expect(sacola?.price).toBe(0.44);

      // Total items identified = 6 consolidated items
      expect(items).toHaveLength(6);
      const total = items.reduce((acc, it) => acc + it.price, 0);
      expect(total).toBeCloseTo(64.32, 2);
    });

    it('corrects hardware dimensions like 6mm (Gnmh) and 8mm (Bhn) and discrete unit noise', () => {
      expect(cleanReceiptProductName('PARAFUSO BUCHA GNMH')).toBe('Parafuso Bucha 6mm');
      expect(cleanReceiptProductName('PARAFUSO BUCHA BHN')).toBe('Parafuso Bucha 8mm');
      expect(cleanReceiptProductName('PARAFUSO+BUCHA 6MM')).toBe('Parafuso Bucha 6mm');
      expect(cleanReceiptProductName('PARAFUSO +BUCHA 8MM')).toBe('Parafuso Bucha 8mm');

      // Test Prego Ferro discrete unit noise (1,609 un -> 1 un at R$ 8.49)
      const pregoOcr = `
019 7897186059013 PREGO FERRO 40MM 45P
1,609 Un x 8,49 8,49
VALOR A PAGAR R$ 8,49
`;
      const pregoItems = ReceiptScannerService.parseReceiptText(pregoOcr);
      expect(pregoItems).toHaveLength(1);
      expect(pregoItems[0].name).toBe('Prego Ferro 40mm 45p');
      expect(pregoItems[0].quantity).toBe(1);
      expect(pregoItems[0].unit).toBe('un');
      expect(pregoItems[0].price).toBe(8.49);
    });
  });

  describe('OCR image preprocessing helpers', () => {
    it('upscales narrow receipt images and caps oversized images', () => {
      const narrow = computeReceiptTargetDimensions(449, 1024);
      expect(narrow.width).toBe(1350);
      expect(narrow.height).toBe(3079);

      const large = computeReceiptTargetDimensions(3000, 4000);
      expect(large.width).toBe(2400);
      expect(large.height).toBe(3200);
    });

    it('normalizes uneven lighting with local Sauvola soft contrast', () => {
      const width = 48;
      const height = 48;
      const rgba = new Uint8ClampedArray(width * height * 4);
      // Simulate bright top (luma 220) and shadowed bottom (luma 110) with dark ink block in center
      for (let y = 0; y < height; y++) {
        const bg = y < 24 ? 220 : 110;
        for (let x = 0; x < width; x++) {
          const isInk = x >= 20 && x <= 26 && y >= 28 && y <= 34;
          const v = isInk ? 35 : bg;
          const idx = (y * width + x) * 4;
          rgba[idx] = v;
          rgba[idx + 1] = v;
          rgba[idx + 2] = v;
          rgba[idx + 3] = 255;
        }
      }

      const out = applyLocalSauvolaSoftContrast(rgba, width, height);
      const topBg = out[(4 * width + 4) * 4];
      const bottomShadowBg = out[(42 * width + 4) * 4];
      const inkPixel = out[(31 * width + 23) * 4];

      expect(topBg).toBeGreaterThan(200);
      expect(bottomShadowBg).toBeGreaterThan(190);
      expect(inkPixel).toBeLessThan(60);
    });
  });
});
