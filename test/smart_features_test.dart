import 'package:carrinhocompras/models/shopping_models.dart';
import 'package:carrinhocompras/screens/history_screen.dart';
import 'package:carrinhocompras/screens/home_screen.dart';
import 'package:carrinhocompras/screens/nfce_qr_scanner_screen.dart';
import 'package:carrinhocompras/services/category_classifier.dart';
import 'package:carrinhocompras/services/nfce_scanner_service.dart';
import 'package:carrinhocompras/services/receipt_scanner_service.dart';
import 'package:carrinhocompras/services/shopping_controller.dart';
import 'package:carrinhocompras/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('NfceScannerService Tests', () {
    test('Extracts 44-digit access key from URL or raw text', () {
      const sampleUrl =
          'https://www.nfce.fazenda.sp.gov.br/qrcode?p=35230912345678000190650010000012341234567890|2|1|1|CC48';
      final key = NfceScannerService.extractAccessKey(sampleUrl);
      expect(key, '35230912345678000190650010000012341234567890');
      expect(NfceScannerService.getUfFromAccessKey(key!), 'SP');
      expect(
        NfceScannerService.getCnpjFromAccessKey(key),
        '12.345.678/0001-90',
      );

      final resolvedUrl = NfceScannerService.resolveUrlFromInput(key);
      expect(resolvedUrl, contains('fazenda.sp.gov.br'));
      expect(resolvedUrl, contains(key));
    });

    test('Resolves direct SEFAZ URLs from QR code or access key correctly', () {
      const qrUrl =
          'http://www.fazenda.pr.gov.br/nfce/qrcode?p=41240112345678000190650010000012341234567890|2|1|1|ABCD';
      final resolvedFromUrl = NfceScannerService.resolveUrlFromInput(qrUrl);
      expect(resolvedFromUrl, qrUrl);

      const mgKey = '31240112345678000190650010000012341234567890';
      final resolvedFromMgKey = NfceScannerService.resolveUrlFromInput(mgKey);
      expect(resolvedFromMgKey, contains('fazenda.mg.gov.br'));
      expect(resolvedFromMgKey, contains(mgKey));

      const dfKey = '53261104972092006163652020002167941197684255';
      final resolvedFromDfKey = NfceScannerService.resolveUrlFromInput(dfKey);
      expect(resolvedFromDfKey, contains('dec.fazenda.df.gov.br'));
      expect(resolvedFromDfKey, contains(dfKey));
    });

    test('Robustly extracts access key from formatted strings, params and OCR text', () {
      const spacedKey = '5326 1104 9720 9200 6163 6520 2000 2167 9411 9768 4255';
      expect(
        NfceScannerService.extractAccessKey(spacedKey),
        '53261104972092006163652020002167941197684255',
      );

      const dottedKey = '5326.1104.9720-9200.6163.6520-2000.2167.9411.9768.4255';
      expect(
        NfceScannerService.extractAccessKey(dottedKey),
        '53261104972092006163652020002167941197684255',
      );

      const ocrCupomText = '''
SUPERMERCADO LTDA
CNPJ: 11.832.478/0015-08
CHAVE DE ACESSO: 5326 1104 9720 9200 6163 6520 2000 2167 9411 9768 4255
PROTOCOLO DE AUTORIZACAO: 153240012345678
''';
      expect(
        NfceScannerService.extractAccessKey(ocrCupomText),
        '53261104972092006163652020002167941197684255',
      );

      const chNfeUrl = 'https://www.sefaz.ba.gov.br/nfce?chNFe=29240112345678000190650010000012341234567890&tpAmb=1';
      expect(
        NfceScannerService.extractAccessKey(chNfeUrl),
        '29240112345678000190650010000012341234567890',
      );
      expect(NfceScannerService.getStateName('DF'), 'Distrito Federal');
      expect(NfceScannerService.getStateName('SP'), 'São Paulo');
      expect(NfceScannerService.getStateName('BA'), 'Bahia');
    });

    test('Extracts SEFAZ URLs without scheme, with trailing punctuation or enclosed in brackets', () {
      const schemeless = 'dec.fazenda.df.gov.br/ConsultarNFCe.aspx?p=53261104972092006163652020002167941197684255|2|1|1|';
      expect(
        NfceScannerService.extractSefazUrl(schemeless),
        'https://dec.fazenda.df.gov.br/ConsultarNFCe.aspx?p=53261104972092006163652020002167941197684255|2|1|1|',
      );

      const trailingDot = 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=43240112345678000190650010000012341234567890|2|1|1|. ';
      expect(
        NfceScannerService.extractSefazUrl(trailingDot),
        'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=43240112345678000190650010000012341234567890|2|1|1|',
      );

      const bracketed = '<https://www.nfce.fazenda.sp.gov.br/qrcode?p=35230912345678000190650010000012341234567890|2|1|1|>';
      expect(
        NfceScannerService.extractSefazUrl(bracketed),
        'https://www.nfce.fazenda.sp.gov.br/qrcode?p=35230912345678000190650010000012341234567890|2|1|1|',
      );
    });

    test('AppFormatters.parseQuantity parses 3-4 decimal fiscal quantities and unscaled multiples correctly', () {
      // Direct decimal formats from SEFAZ / Danfe
      expect(AppFormatters.parseQuantity('1'), 1.0);
      expect(AppFormatters.parseQuantity('2'), 2.0);
      expect(AppFormatters.parseQuantity('1.000'), 1.0);
      expect(AppFormatters.parseQuantity('1,000'), 1.0);
      expect(AppFormatters.parseQuantity('1.0000'), 1.0);
      expect(AppFormatters.parseQuantity('1,0000'), 1.0);
      expect(AppFormatters.parseQuantity('2.000'), 2.0);
      expect(AppFormatters.parseQuantity('2,000'), 2.0);
      expect(AppFormatters.parseQuantity('2.0000'), 2.0);
      expect(AppFormatters.parseQuantity('3.000'), 3.0);
      expect(AppFormatters.parseQuantity('0.500'), 0.5);
      expect(AppFormatters.parseQuantity('0,500'), 0.5);
      expect(AppFormatters.parseQuantity('0.350', unit: 'kg'), 0.35);
      expect(AppFormatters.parseQuantity('1.250', unit: 'kg'), 1.25);
      expect(AppFormatters.parseQuantity('12', unit: 'un'), 12.0);

      // Unscaled multiples of 1000 / 10000 (when decimal separator was stripped)
      expect(AppFormatters.parseQuantity('1000', unit: 'un'), 1.0);
      expect(AppFormatters.parseQuantity('2000', unit: 'un'), 2.0);
      expect(AppFormatters.parseQuantity('3000', unit: 'un'), 3.0);
      expect(AppFormatters.parseQuantity('10000', unit: 'un'), 1.0);
      expect(AppFormatters.parseQuantity('20000', unit: 'un'), 2.0);

      // Grams ('g') should preserve absolute gram numbers
      expect(AppFormatters.parseQuantity('500', unit: 'g'), 500.0);
      expect(AppFormatters.parseQuantity('1000', unit: 'g'), 1000.0);
      expect(AppFormatters.parseQuantity('2000', unit: 'g'), 2000.0);
    });

    test('Validates pasted link or key and returns UF feedback message', () {
      final dfKeyValidation = NfceScannerService.validateInput(
        '5326 1104 9720 9200 6163 6520 2000 2167 9411 9768 4255',
      );
      expect(dfKeyValidation.isValid, true);
      expect(dfKeyValidation.uf, 'DF');
      expect(
        dfKeyValidation.statusMessage,
        '✓ Chave de acesso válida (Distrito Federal - DF)',
      );

      final spUrlValidation = NfceScannerService.validateInput(
        'https://www.nfce.fazenda.sp.gov.br/qrcode?p=35230912345678000190650010000012341234567890|2|1|1|',
      );
      expect(spUrlValidation.isValid, true);
      expect(spUrlValidation.uf, 'SP');
      expect(
        spUrlValidation.statusMessage,
        '✓ Link SEFAZ identificado (São Paulo - SP)',
      );

      final partialDigits = NfceScannerService.validateInput('3523091234');
      expect(partialDigits.isValid, false);
      expect(partialDigits.statusMessage, '10 de 44 dígitos digitados');
    });

    test('Parses HTML items, market name and date from NFC-e table', () {
      const sampleHtml = '''
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
  <span class="totalNfe">Total: R\$ 39,60</span>
</body>
</html>
''';

      final result = NfceScannerService.parseNfceHtml(
        sampleHtml,
        fallbackKey: '35230912345678000190650010000012341234567890',
      );

      expect(result.isSuccess, true);
      expect(result.marketName, 'SUPERMERCADO BOA COMPRA LTDA');
      expect(result.items.length, 2);
      expect(result.items[0].name, 'Arroz Tipo 1 Camil 5kg');
      expect(result.items[0].price, 24.90);
      expect(result.items[0].quantity, 1.0);
      expect(result.items[0].unit, 'un');
      expect(result.items[0].category, ProductCategory.alimentos);
      expect(result.items[1].name, 'Leite Integral Piracanjuba 1L');
      expect(result.items[1].price, 14.70);
      expect(result.items[1].quantity, 3.0);
      expect(result.items[1].unit, 'un');
      expect(result.items[1].category, ProductCategory.alimentos);
    });

    test('Parses SEFAZ DF DANFE NFC-e layout (Dona de Casa S/A)', () {
      const dfHtml = '''
<!DOCTYPE html>
<html>
<body>
  <div>DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA</div>
  <div class="header">
    <div>DONA DE CASA S/A</div>
    <div>CNPJ: 11.832.478/0015-08</div>
    <div>RUA Q SEPN 506 BLOCO A LOJA 1 2 3 4, SN, , ASA NORTE, BRASILIA, DF</div>
  </div>
  <div class="items">
    <tr>
      <td>REFRI COCA COLA 2L TRAD (Cód: 70)</td>
      <td>Vl. Total 9,98</td>
    </tr>
    <tr><td>Qtde.: 1.0000 UN: UN Vl. Unit.: 9,98</td></tr>

    <tr>
      <td>REFRI COCA COLA 600ML ZERO (Cód: 10902)</td>
      <td>Vl. Total 6,99</td>
    </tr>
    <tr><td>Qtde.: 1.0000 UN: UN Vl. Unit.: 6,99</td></tr>

    <tr>
      <td>PROT DIARIO CAREFREE 40X1 TODO DIA (Cód: 82)</td>
      <td>Vl. Total 16,99</td>
    </tr>
    <tr><td>Qtde.: 1.0000 UN: UN Vl. Unit.: 16,99</td></tr>

    <tr>
      <td>CHIPS BATATA JUJU 100G (Cód: 30118)</td>
      <td>Vl. Total 10,98</td>
    </tr>
    <tr><td>Qtde.: 1.0000 UN: UN Vl. Unit.: 10,98</td></tr>
  </div>
  <div>Qtd. total de itens: 4</div>
  <div>Valor a pagar R\$: 44,94</div>
  <div>Chave de acesso: 5326 1111 8324 7800 1508 6510 1000 7155 5412 7069 0553</div>
</body>
</html>
''';

      final result = NfceScannerService.parseNfceHtml(
        dfHtml,
        fallbackKey: '53261111832478001508651010007155541270690553',
      );

      expect(result.isSuccess, true);
      expect(result.marketName, 'DONA DE CASA S/A');
      expect(result.totalAmount, 44.94);
      expect(result.items.length, 4);

      expect(result.items[0].name, 'Refrigerante Coca Cola 2L Tradicional');
      expect(result.items[0].price, 9.98);
      expect(result.items[0].quantity, 1.0);
      expect(result.items[0].unit, 'un');

      expect(result.items[1].name, 'Refrigerante Coca Cola 600ml Zero');
      expect(result.items[1].price, 6.99);

      expect(result.items[2].name, 'Protetor Diario Carefree 40x1 Todo Dia');
      expect(result.items[2].price, 16.99);

      expect(result.items[3].name, 'Chips Batata Juju 100g');
      expect(result.items[3].price, 10.98);
    });

    test('Parses SEFAZ DF real Bootstrap Accordion NFC-e layout (Grupo Fartura Hortifrut S A)', () {
      const realDfHtml = r'''
<html>
<div class="container">
  <div class="row centralizar-texto">
    <div class="col" style="color:#6C6C6C; font-size: 13px; margin-top: 10px;">
      DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA
    </div>
  </div>
  <div class="card accordion bg-success mb-3" id="accordion1">
    <div class="card-header centralizar-texto text-white visao-mobile-nfce" id="heading1">
      <div class="col" style="font-weight: bold;">GRUPO FARTURA DE HORTIFRUT S A</div>
      <div>CNPJ: 04.972.092/0061-63</div>
      <div>QUADRA CLN 306 BLOCO D, SN, LOJA 79 SETOR A, ASA NORTE, BRASILIA, DF</div>
    </div>
    <div id="collapse1" class="collapse show">
      <ul class="list-group list-group-flush">
        <li class="list-group-item">
          <div class="row" style="line-height:0.1px; margin-top:-7px;">
            <div class="col-9">
              <p class="h6">PAO FORMA BAUDUCCO INT 390G<small>(Cód: 226525)</small></p>
            </div>
            <div class="col-3" style="text-align:right;"><strong><p class="h6">Vl. Total</p></strong></div>
          </div>
          <div class="row" style="line-height:0.1px; margin-bottom:3px;">
            <div class="col-9"><span style="font-size:11px;"><strong>Qtde.:</strong>1.0000<strong>UN:</strong>UN<strong>Vl. Unit.:</strong>11,99</span></div>
            <div class="col-3" style="text-align:right;"><span style="font-weight: bold; font-size:10px;">11,99</span></div>
          </div>
        </li>
      </ul>
      <ul class="list-group list-group-flush">
        <li class="list-group-item">
          <div class="row" style="margin-top:-7px; margin-bottom:-13px;">
            <div class="col-8" style="text-align:right;"><p class="h6"><strong>Qtd. total de itens:</strong></p></div>
            <div class="col-4" style="text-align:right;"><p class="h6"><strong>1</strong></p></div>
          </div>
        </li>
      </ul>
      <ul class="list-group list-group-flush">
        <li class="list-group-item campo-xml">
          <div class="row" style="margin-top:-7px; margin-bottom:-13px;">
            <div class="col-8" style="text-align:right;"><p class="h6"><strong>Valor a pagar R$:</strong></p></div>
            <div class="col-4" style="text-align:right;"><p class="h6"><strong>11,99</strong></p></div>
          </div>
        </li>
      </ul>
    </div>
  </div>
  <div class="card accordion bg-success mb-3" id="accordion3">
    <div id="collapse3" class="collapse show">
      <ul class="list-group list-group-flush">
        <li class="list-group-item">
          <div class="row">
            <div class="col"><p class="h6">5326 1104 9720 9200 6163 6520 2000 2167 9411 9768 4255</p></div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</div>
</html>
''';

      final result = NfceScannerService.parseNfceHtml(realDfHtml);

      expect(result.isSuccess, true);
      expect(result.marketName, 'GRUPO FARTURA DE HORTIFRUT S A');
      expect(result.totalAmount, 11.99);
      expect(result.items.length, 1);
      expect(result.items[0].name, 'Pao De Forma Bauducco Integral 390g');
      expect(result.items[0].price, 11.99);
      expect(result.accessKey, '53261104972092006163652020002167941197684255');
    });

    test('Standardizes product volume in name and extracts quantity (Option 1)', () {
      expect(
        NfceScannerService.cleanNfceProductName('CHA LEAO 1,5L TP'),
        'Cha Leao 1,5L Tp',
      );
      expect(
        NfceScannerService.cleanNfceProductName('GUARANA 2L PET'),
        'Guarana 2L Pet',
      );
      expect(
        NfceScannerService.cleanNfceProductName('DETERGENTE YPE 500ML'),
        'Detergente Ype 500ml',
      );
      expect(
        NfceScannerService.cleanNfceProductName('ARROZ CAMIL 5KG'),
        'Arroz Camil 5kg',
      );

      // Category classification
      expect(
        CategoryClassifier.classify('Cha Leao 1,5L'),
        ProductCategory.bebidas,
      );
      expect(
        CategoryClassifier.classify('Guarana 2L'),
        ProductCategory.bebidas,
      );

      // Cleaned alimentos & non-food items to proper categories or Diversos
      expect(
        CategoryClassifier.classify('Massa Corrida 15kg'),
        ProductCategory.diversos,
      );
      expect(
        CategoryClassifier.classify('Óleo de Peroba 200ml'),
        ProductCategory.limpeza,
      );
      expect(
        CategoryClassifier.classify('Óleo Lubrificante Motor'),
        ProductCategory.diversos,
      );
      expect(
        CategoryClassifier.classify('Salto Alto Feminino'),
        ProductCategory.diversos,
      );
      expect(
        CategoryClassifier.classify('Parafuso Sextavado 5mm'),
        ProductCategory.diversos,
      );
      expect(
        CategoryClassifier.classify('Cabo USB Tipo C'),
        ProductCategory.diversos,
      );
      expect(
        CategoryClassifier.classify('Camiseta Básica Masculina'),
        ProductCategory.diversos,
      );
      expect(
        CategoryClassifier.classify('Sacola Plástica Grande'),
        ProductCategory.descartaveis,
      );
      expect(
        CategoryClassifier.classify('Leite de Rosas Tradicional'),
        ProductCategory.perfumariaHigiene,
      );
      expect(
        CategoryClassifier.classify('Item Aleatório Sem Categoria'),
        ProductCategory.diversos,
      );

      // True alimentos remain alimentos
      expect(
        CategoryClassifier.classify('Arroz Branco Tio João 5kg'),
        ProductCategory.alimentos,
      );
      expect(
        CategoryClassifier.classify('Feijão Carioca Camil 1kg'),
        ProductCategory.alimentos,
      );
      expect(
        CategoryClassifier.classify('Sal Refinado Cisne 1kg'),
        ProductCategory.alimentos,
      );
      expect(
        CategoryClassifier.classify('Óleo de Soja Soya 900ml'),
        ProductCategory.alimentos,
      );
      expect(
        CategoryClassifier.classify('Asa de Frango Congelada'),
        ProductCategory.alimentos,
      );

      // AppFormatters.formatQuantity
      expect(AppFormatters.formatQuantity(1.0, 'un'), '1 un');
      expect(AppFormatters.formatQuantity(2.0, 'un'), '2 un');
      expect(AppFormatters.formatQuantity(1.5, 'L'), '1,5 L');
      expect(AppFormatters.formatQuantity(0.54, 'kg'), '0,54 kg');
    });

    test('Expands common supermarket NFC-e abbreviations into clean names and correct categories', () {
      final testCases = <String, Map<String, dynamic>>{
        'LT INTEGRAL PIRACANJUBA 1L': {
          'expectedName': 'Leite Integral Piracanjuba 1L',
          'expectedCategory': ProductCategory.alimentos,
        },
        'AM CONCENTRADO COMFORT 500ML': {
          'expectedName': 'Amaciante Concentrado Comfort 500ml',
          'expectedCategory': ProductCategory.limpeza,
        },
        'DET YPE NEUTRO 500ML': {
          'expectedName': 'Detergente Ype Neutro 500ml',
          'expectedCategory': ProductCategory.limpeza,
        },
        'DESENG VEJA 500ML': {
          'expectedName': 'Desengordurante Veja 500ml',
          'expectedCategory': ProductCategory.limpeza,
        },
        'L MOV POLIFLOR 200ML': {
          'expectedName': 'Limpa Moveis Poliflor 200ml',
          'expectedCategory': ProductCategory.limpeza,
        },
        'HID NIVEA SOFT 200ML': {
          'expectedName': 'Hidratante Nivea Soft 200ml',
          'expectedCategory': ProductCategory.perfumariaHigiene,
        },
        'COND PANTENE RESTAURAÇÃO 400ML': {
          'expectedName': 'Condicionador Pantene Restauração 400ml',
          'expectedCategory': ProductCategory.perfumariaHigiene,
        },
        'SH CLEAR ANTICASPA 400ML': {
          'expectedName': 'Shampoo Clear Anticaspa 400ml',
          'expectedCategory': ProductCategory.perfumariaHigiene,
        },
        'CR LEITE NESTLE 200G': {
          'expectedName': 'Creme De Leite Nestle 200g',
          'expectedCategory': ProductCategory.alimentos,
        },
        'CR LT PIRACANJUBA 200G': {
          'expectedName': 'Creme De Leite Piracanjuba 200g',
          'expectedCategory': ProductCategory.alimentos,
        },
        'L  COND MOCOCA 395G': {
          'expectedName': 'Leite Condensado Mococa 395g',
          'expectedCategory': ProductCategory.alimentos,
        },
        'ESC DENTAL COLGATE TOTAL': {
          'expectedName': 'Escova Dental Colgate Total',
          'expectedCategory': ProductCategory.perfumariaHigiene,
        },
        'PIP MICROONDAS YOKI 100G': {
          'expectedName': 'Pipoca Microondas Yoki 100g',
          'expectedCategory': ProductCategory.alimentos,
        },
        'QJ MUSSARELA FATIADO': {
          'expectedName': 'Queijo Mussarela Fatiado',
          'expectedCategory': ProductCategory.alimentos,
        },
        'OREG KITANO 10G': {
          'expectedName': 'Oregano Kitano 10g',
          'expectedCategory': ProductCategory.alimentos,
        },
        'PEI FRANGO CONG 1KG': {
          'expectedName': 'Peito Frango Congelado 1kg',
          'expectedCategory': ProductCategory.alimentos,
        },
        'ESP ACO BOMBRIL 60G': {
          'expectedName': 'Esponja De Aco Bombril 60g',
          'expectedCategory': ProductCategory.limpeza,
        },
        'BISC RECH OREO 90G': {
          'expectedName': 'Biscoito Recheado Oreo 90g',
          'expectedCategory': ProductCategory.alimentos,
        },
        'IOG NATURAL NESTLE 170G': {
          'expectedName': 'Iogurte Natural Nestle 170g',
          'expectedCategory': ProductCategory.alimentos,
        },
        'ARR BRANCO TIO JOAO 5KG': {
          'expectedName': 'Arroz Branco Tio Joao 5kg',
          'expectedCategory': ProductCategory.alimentos,
        },
        'FEIJ CARIOCA CAMIL 1KG': {
          'expectedName': 'Feijao Carioca Camil 1kg',
          'expectedCategory': ProductCategory.alimentos,
        },
        'MACARR ESPAGUETE BARILLA 500G': {
          'expectedName': 'Macarrao Espaguete Barilla 500g',
          'expectedCategory': ProductCategory.alimentos,
        },
        'VINAG DE MACA 500ML': {
          'expectedName': 'Vinagre De Maca 500ml',
          'expectedCategory': ProductCategory.alimentos,
        },
        'FERM EM PO ROYAL 100G': {
          'expectedName': 'Fermento Em Po Royal 100g',
          'expectedCategory': ProductCategory.alimentos,
        },
        'FAR TRIGO DONA BENTA 1KG': {
          'expectedName': 'Farinha De Trigo Dona Benta 1kg',
          'expectedCategory': ProductCategory.alimentos,
        },
        'CNT FILE BOVINO FAT 1KG': {
          'expectedName': 'Contra File Bovino Fatiado 1kg',
          'expectedCategory': ProductCategory.alimentos,
        },
        'FIL FRANG CONG SADIA 1KG': {
          'expectedName': 'File De Frango Congelado Sadia 1kg',
          'expectedCategory': ProductCategory.alimentos,
        },
        'LING CALAB DEFUMADA 500G': {
          'expectedName': 'Linguica Calabresa Defumada 500g',
          'expectedCategory': ProductCategory.alimentos,
        },
        'MORT OURO PERDIGAO FAT 200G': {
          'expectedName': 'Mortadela Ouro Perdigao Fatiado 200g',
          'expectedCategory': ProductCategory.alimentos,
        },
        'PAO FRANC QUENTINHO 500G': {
          'expectedName': 'Pao Frances Quentinho 500g',
          'expectedCategory': ProductCategory.alimentos,
        },
        'REQ CREMOSO POCOES 200G': {
          'expectedName': 'Requeijao Cremoso Pocoes 200g',
          'expectedCategory': ProductCategory.alimentos,
        },
        'QJ PROV DEFUMADO 300G': {
          'expectedName': 'Queijo Provolone Defumado 300g',
          'expectedCategory': ProductCategory.alimentos,
        },
        'CERV HEINEKEN LATA 350ML': {
          'expectedName': 'Cerveja Heineken Lata 350ml',
          'expectedCategory': ProductCategory.bebidas,
        },
        'AG MINER C/GAS 500ML': {
          'expectedName': 'Agua Mineral Com Gas 500ml',
          'expectedCategory': ProductCategory.bebidas,
        },
        'AG TONICA ANTARCTICA 350ML': {
          'expectedName': 'Agua Tonica Antarctica 350ml',
          'expectedCategory': ProductCategory.bebidas,
        },
        'SAB PO OMO LAVAGEM PERFEITA 1,6KG': {
          'expectedName': 'Sabao Em Po Omo Lavagem Perfeita 1,6kg',
          'expectedCategory': ProductCategory.limpeza,
        },
        'DESINF PINHO SOL 1L': {
          'expectedName': 'Desinfetante Pinho Sol 1L',
          'expectedCategory': ProductCategory.limpeza,
        },
        'ALVEJ SEM CLORO VANISH 500ML': {
          'expectedName': 'Alvejante Sem Cloro Vanish 500ml',
          'expectedCategory': ProductCategory.limpeza,
        },
        'LIMPA VID VEJA 500ML': {
          'expectedName': 'Limpa Vidros Veja 500ml',
          'expectedCategory': ProductCategory.limpeza,
        },
        'ABS C/ABAS SEMPRE LIVRE 16UN': {
          'expectedName': 'Absorvente Com Abas Sempre Livre 16un',
          'expectedCategory': ProductCategory.perfumariaHigiene,
        },
        'CR DENT COLGATE TOTAL 90G': {
          'expectedName': 'Creme Dental Colgate Total 90g',
          'expectedCategory': ProductCategory.perfumariaHigiene,
        },
        'FIO DENT ORAL B 50M': {
          'expectedName': 'Fio Dental Oral B 50m',
          'expectedCategory': ProductCategory.perfumariaHigiene,
        },
        'DESOD AER REXONA 150ML': {
          'expectedName': 'Desodorante Aerosol Rexona 150ml',
          'expectedCategory': ProductCategory.perfumariaHigiene,
        },
        'FRALD DESC PAMPERS PANTS G': {
          'expectedName': 'Fralda Descartavel Pampers Pants G',
          'expectedCategory': ProductCategory.bebeCrianca,
        },
        'LENC UMEDEC BABY 48UN': {
          'expectedName': 'Lenco Umedecido Baby 48un',
          'expectedCategory': ProductCategory.bebeCrianca,
        },
      };

      for (final entry in testCases.entries) {
        final raw = entry.key;
        final expectedName = entry.value['expectedName'] as String;
        final expectedCategory = entry.value['expectedCategory'] as ProductCategory;

        final cleanedName = NfceScannerService.cleanNfceProductName(raw);
        expect(cleanedName, expectedName, reason: 'Failed name cleaning for "$raw"');

        final category = CategoryClassifier.classify(cleanedName);
        expect(category, expectedCategory, reason: 'Failed classification for "$cleanedName" (from "$raw")');
      }
    });

    test('Parses items with multi-quantity in NFC-e HTML (e.g. 2 un of Cha Leao 1,5L)', () {
      const sampleHtml = '''
<!DOCTYPE html>
<html>
<body>
  <div class="txtTopo">SUPERMERCADO CENTRAL</div>
  <table id="tabResult">
    <tr id="Item + 1">
      <td>
        <span class="txtTit">CHA LEAO 1,5L</span>
        <span class="Rqtd">Qtde.: 2,000</span>
        <span class="RUN">UN: UN</span>
        <span class="valor">17,98</span>
      </td>
    </tr>
    <tr id="Item + 2">
      <td>
        <span class="txtTit">GUARANA 2L</span>
        <span class="Rqtd">Qtde.: 1,000</span>
        <span class="RUN">UN: UN</span>
        <span class="valor">9,98</span>
      </td>
    </tr>
  </table>
  <span class="totalNfe">Total: R\$ 27,96</span>
</body>
</html>
''';

      final result = NfceScannerService.parseNfceHtml(sampleHtml);
      expect(result.isSuccess, true);
      expect(result.items.length, 2);

      // Item 1: 2 un of Cha Leao 1,5L
      expect(result.items[0].name, 'Cha Leao 1,5L');
      expect(result.items[0].price, 17.98);
      expect(result.items[0].quantity, 2.0);
      expect(result.items[0].unit, 'un');
      expect(result.items[0].category, ProductCategory.bebidas);

      // Item 2: 1 un of Guarana 2L
      expect(result.items[1].name, 'Guarana 2L');
      expect(result.items[1].price, 9.98);
      expect(result.items[1].quantity, 1.0);
      expect(result.items[1].unit, 'un');
      expect(result.items[1].category, ProductCategory.bebidas);
    });

    test('Merges duplicate products in real SEFAZ Sendas DF accordion HTML and classifies all items', () {
      const sendasHtml = r'''
<div class="card accordion bg-success mb-3" id="accordion1">
    <div class="card-header centralizar-texto text-white visao-mobile-nfce" id="heading1" data-toggle="collapse" data-target="#collapse1" aria-expanded="true" aria-controls="collapse1">
        <div class="col" style="font-weight: bold;">SENDAS DISTRIBUIDORA S/A</div>
        <div>CNPJ: 06.057.223/0540-00</div>
    </div>
    <div id="collapse1" class="collapse show" aria-labelledby="heading1" data-parent="#accordion1">
        <ul class="list-group list-group-flush">
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">LI FGO SF 800G APIM <small>(Cód: 1118007)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> PC <strong>Vl. Unit.:</strong> 14,89</span></div><div class="col-3"><span>14,89</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">LT SD NINHO 1LT LEV <small>(Cód: 1019816)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 7,40</span></div><div class="col-3"><span>7,40</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">LT SD NINHO 1LT LEV <small>(Cód: 1019816)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 7,40</span></div><div class="col-3"><span>7,40</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">TIRA MAN VANISH 240G <small>(Cód: 1176272)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 15,99</span></div><div class="col-3"><span>15,99</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">VEJA COZ 400ML LIMAO <small>(Cód: 1066220)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 11,45</span></div><div class="col-3"><span>11,45</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">AM DOWC SACH 750ML V <small>(Cód: 1274810)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 19,49</span></div><div class="col-3"><span>19,49</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">DET MINUANO 500ML CL <small>(Cód: 5199)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 2.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 2,75</span></div><div class="col-3"><span>5,50</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">TIXAN 2,4kg MACIEZ <small>(Cód: 1161484)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 26,39</span></div><div class="col-3"><span>26,39</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">DESENG WD-40 300ML <small>(Cód: 1073352)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 45,90</span></div><div class="col-3"><span>45,90</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">L MOV POLIF 200ML LA <small>(Cód: 36700)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 16,90</span></div><div class="col-3"><span>16,90</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">AJAX 500ML LEMON <small>(Cód: 5025)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Fr <strong>Vl. Unit.:</strong> 10,99</span></div><div class="col-3"><span>10,99</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">AROM GLAD CON 120 CB <small>(Cód: 1342917)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 13,29</span></div><div class="col-3"><span>13,29</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">SASSAMI SUPER FGO 1K <small>(Cód: 1062356)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> PC <strong>Vl. Unit.:</strong> 17,80</span></div><div class="col-3"><span>17,80</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">MELAO REI kg <small>(Cód: 106415)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 2.8650 <strong>UN:</strong> Kg <strong>Vl. Unit.:</strong> 12,90</span></div><div class="col-3"><span>36,95</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">MELAO REI kg <small>(Cód: 106415)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 2.5800 <strong>UN:</strong> Kg <strong>Vl. Unit.:</strong> 12,90</span></div><div class="col-3"><span>33,28</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">LI CAL DEF BOUA 400G <small>(Cód: 1130207)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> PC <strong>Vl. Unit.:</strong> 8,99</span></div><div class="col-3"><span>8,99</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">OMO LIQ 900ML LAV PE <small>(Cód: 1112450)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 14,90</span></div><div class="col-3"><span>14,90</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">D GIOV BAB 150ML BLU <small>(Cód: 1253649)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 13,89</span></div><div class="col-3"><span>13,89</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">D GIOV BA 150ML CLAS <small>(Cód: 1253676)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 13,89</span></div><div class="col-3"><span>13,89</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">HID NIVEA CER 400ML <small>(Cód: 1166342)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 23,90</span></div><div class="col-3"><span>23,90</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">SH ELSEVE 400ML HIDR <small>(Cód: 1145099)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 31,90</span></div><div class="col-3"><span>31,90</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">COND ELSE 400ML HIDR <small>(Cód: 1145102)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 35,90</span></div><div class="col-3"><span>35,90</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">CR LEITE ITALAC 200G <small>(Cód: 15067)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 3.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 2,85</span></div><div class="col-3"><span>8,55</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">L COND ITALAC 395G <small>(Cód: 34805)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 6,25</span></div><div class="col-3"><span>6,25</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">MAC LIANE 1kg ESPAG <small>(Cód: 1229459)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 6,65</span></div><div class="col-3"><span>6,65</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">M TARANT 300G TRAD <small>(Cód: 1161449)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 3.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 1,69</span></div><div class="col-3"><span>5,07</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">OL SJ LIZA PET 900ML <small>(Cód: 667)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 6,99</span></div><div class="col-3"><span>6,99</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">CD COLG PRO A 90G OR <small>(Cód: 1111547)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 15,69</span></div><div class="col-3"><span>15,69</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">CD COLG PRO A 90G OR <small>(Cód: 1111547)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 15,69</span></div><div class="col-3"><span>15,69</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">BASE ACET ONLY 100ML <small>(Cód: 1134438)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 4,75</span></div><div class="col-3"><span>4,75</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">AG MICE CICATR 200ML <small>(Cód: 1117919)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 25,55</span></div><div class="col-3"><span>25,55</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">SBT LUX LQ 500ML ROS <small>(Cód: 1185777)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 17,90</span></div><div class="col-3"><span>17,90</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">ESC ORAL-B 123 C/4 <small>(Cód: 1223318)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Am <strong>Vl. Unit.:</strong> 12,90</span></div><div class="col-3"><span>12,90</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">MILHO PIP KIC P 500G <small>(Cód: 1111170)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 2.0000 <strong>UN:</strong> PC <strong>Vl. Unit.:</strong> 3,25</span></div><div class="col-3"><span>6,50</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">HAST COTTONB C/75 <small>(Cód: 77681)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 2.0000 <strong>UN:</strong> PC <strong>Vl. Unit.:</strong> 2,95</span></div><div class="col-3"><span>5,90</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">FREEGELLS 15X8G MENT <small>(Cód: 1103586)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> PC <strong>Vl. Unit.:</strong> 20,60</span></div><div class="col-3"><span>20,60</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">QJ RAL VALEZA FI 50G <small>(Cód: 1029851)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 3.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 4,09</span></div><div class="col-3"><span>12,27</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">CAREFREE C/60 PRO EX <small>(Cód: 1231742)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 34,90</span></div><div class="col-3"><span>34,90</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">ABS ADAPT C/32 SVE <small>(Cód: 1080383)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> PC <strong>Vl. Unit.:</strong> 21,19</span></div><div class="col-3"><span>21,19</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">RALINHO P/PIA INOX <small>(Cód: 1252920)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 8,19</span></div><div class="col-3"><span>8,19</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">OREG KITANO 10G <small>(Cód: 76868)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> PC <strong>Vl. Unit.:</strong> 4,95</span></div><div class="col-3"><span>4,95</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">QJ T MUSS DEALE 150G <small>(Cód: 1364133)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 4,99</span></div><div class="col-3"><span>4,99</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">PEI PERU D SADIA FT <small>(Cód: 8480)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 0.0880 <strong>UN:</strong> Kg <strong>Vl. Unit.:</strong> 79,99</span></div><div class="col-3"><span>7,03</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">ESP ESFRELUX DF C/4 <small>(Cód: 100312)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> PC <strong>Vl. Unit.:</strong> 3,49</span></div><div class="col-3"><span>3,49</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">BISC BAUD 335G CHOC <small>(Cód: 60070)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 9,79</span></div><div class="col-3"><span>9,79</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">PALHA YOKI 380G TRAD <small>(Cód: 1207740)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 30,89</span></div><div class="col-3"><span>30,89</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">PIP KOD 90G CARAMELO <small>(Cód: 1203001)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 8,99</span></div><div class="col-3"><span>8,99</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">PIP KOD 90G CHURROS <small>(Cód: 1203005)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 8,99</span></div><div class="col-3"><span>8,99</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">IOG NAT NESTLE 170G <small>(Cód: 76556)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 2.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 4,19</span></div><div class="col-3"><span>8,38</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">ASSENTO SANIT ALMOF <small>(Cód: 1111774)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 89,90</span></div><div class="col-3"><span>89,90</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">PH DELUXE 20M L12P11 <small>(Cód: 1136158)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> PC <strong>Vl. Unit.:</strong> 12,90</span></div><div class="col-3"><span>12,90</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">UVA ESC R B S/S 150G <small>(Cód: 1069937)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 8,90</span></div><div class="col-3"><span>8,90</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">SAND IPAN S RAST 35 <small>(Cód: 1212506)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 10,90</span></div><div class="col-3"><span>10,90</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">HARPIC CX ACOP C/1 <small>(Cód: 1157632)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 20,79</span></div><div class="col-3"><span>20,79</span></div></div>
            </li>
            <li class="list-group-item">
                <div class="row"><div class="col-9"><p class="h6">HARPIC CX ACOP C/1 <small>(Cód: 1157632)</small></p></div><div class="col-3"><strong><p class="h6">Vl. Total</p></strong></div></div>
                <div class="row"><div class="col-9"><span><strong>Qtde.:</strong> 1.0000 <strong>UN:</strong> Un <strong>Vl. Unit.:</strong> 20,79</span></div><div class="col-3"><span>20,79</span></div></div>
            </li>
        </ul>
        <ul class="list-group list-group-flush"><li class="list-group-item"><div>Qtd. total de itens: 55</div></li></ul>
        <ul class="list-group list-group-flush"><li class="list-group-item campo-xml"><div>Valor total R$: 914,21</div></li></ul>
        <ul class="list-group list-group-flush"><li class="list-group-item campo-xml"><div>Valor a pagar R$: 912,09</div></li></ul>
    </div>
</div>
''';

      final result = NfceScannerService.parseNfceHtml(sendasHtml);
      expect(result.isSuccess, true);
      expect(result.marketName, 'SENDAS DISTRIBUIDORA S/A');
      expect(result.totalAmount, 914.21);

      // 55 raw rows -> 4 identical/weighed pairs merged -> 51 unique items
      expect(result.items.length, 51);

      // Total sum of all parsed items must remain 914.21
      final sumPrices = result.items.fold<double>(0.0, (acc, item) => acc + item.price);
      expect(sumPrices, closeTo(914.21, 0.01));

      // 1. Merged duplicate unit product: LT SD NINHO 1LT LEV (2x R$ 7,40 = R$ 14,80)
      final ninho = result.items.firstWhere((i) => i.productCode == '1019816');
      expect(ninho.name, 'Leite Semidesnatado Ninho 1L Lev');
      expect(ninho.quantity, 2.0);
      expect(ninho.price, 14.80);
      expect(ninho.unitPrice, 7.40);
      expect(ninho.unit, 'un');
      expect(ninho.category, ProductCategory.alimentos);

      // 2. Merged weighed product: MELAO REI kg (2.865 + 2.580 = 5.445 kg, total R$ 70,23)
      final melao = result.items.firstWhere((i) => i.productCode == '106415');
      expect(melao.quantity, closeTo(5.445, 0.0001));
      expect(melao.price, closeTo(70.23, 0.01));
      expect(melao.unitPrice, 12.90);
      expect(melao.unit, 'kg');
      expect(melao.category, ProductCategory.alimentos);

      // 3. Merged duplicate product: CD COLG PRO A 90G OR (2x R$ 15,69 = R$ 31,38)
      final colgate = result.items.firstWhere((i) => i.productCode == '1111547');
      expect(colgate.name, 'Creme Dental Colgate Pro A 90g Or');
      expect(colgate.quantity, 2.0);
      expect(colgate.price, 31.38);
      expect(colgate.category, ProductCategory.perfumariaHigiene);

      // 4. Merged duplicate product: HARPIC CX ACOP C/1 (2x R$ 20,79 = R$ 41,58)
      final harpic = result.items.firstWhere((i) => i.productCode == '1157632');
      expect(harpic.name, 'Harpic Caixa Acoplada Com 1');
      expect(harpic.quantity, 2.0);
      expect(harpic.price, 41.58);
      expect(harpic.category, ProductCategory.limpeza);

      // 5. Same unit price (13,89) but DIFFERENT codes & names must NOT merge
      final giovBlu = result.items.firstWhere((i) => i.productCode == '1253649');
      final giovClas = result.items.firstWhere((i) => i.productCode == '1253676');
      expect(giovBlu.quantity, 1.0);
      expect(giovClas.quantity, 1.0);
      expect(giovBlu.category, ProductCategory.perfumariaHigiene);
      expect(giovClas.category, ProductCategory.perfumariaHigiene);

      // 6. Same unit price (8,99) but DIFFERENT flavors & codes must NOT merge
      final pipCaramelo = result.items.firstWhere((i) => i.productCode == '1203001');
      final pipChurros = result.items.firstWhere((i) => i.productCode == '1203005');
      expect(pipCaramelo.quantity, 1.0);
      expect(pipChurros.quantity, 1.0);
      expect(pipCaramelo.category, ProductCategory.alimentos);
      expect(pipChurros.category, ProductCategory.alimentos);

      // 7. Real receipt abbreviations & category spot-checks
      expect(result.items.firstWhere((i) => i.productCode == '1062356').name, 'Sassami Super Frango 1kg');
      expect(result.items.firstWhere((i) => i.productCode == '1062356').unit, 'pct');
      expect(result.items.firstWhere((i) => i.productCode == '1062356').category, ProductCategory.alimentos);
      expect(result.items.firstWhere((i) => i.productCode == '1161484').category, ProductCategory.limpeza); // Tixan
      expect(result.items.firstWhere((i) => i.productCode == '5025').category, ProductCategory.limpeza); // Ajax
      expect(result.items.firstWhere((i) => i.productCode == '1342917').category, ProductCategory.limpeza); // Arom Glade
      expect(result.items.firstWhere((i) => i.productCode == '1229459').name, 'Macarrao Liane 1kg Espaguete');
      expect(result.items.firstWhere((i) => i.productCode == '1229459').category, ProductCategory.alimentos);
      expect(result.items.firstWhere((i) => i.productCode == '667').name, 'Oleo De Soja Liza Pet 900ml');
      expect(result.items.firstWhere((i) => i.productCode == '1136158').name, 'Papel Higienico Deluxe 20m L12p11');
      expect(result.items.firstWhere((i) => i.productCode == '1136158').category, ProductCategory.perfumariaHigiene);
      expect(result.items.firstWhere((i) => i.productCode == '1111774').name, 'Assento Sanitario Almofadado');
      expect(result.items.firstWhere((i) => i.productCode == '1111774').category, ProductCategory.bazar);
      expect(result.items.firstWhere((i) => i.productCode == '1252920').name, 'Ralinho Para Pia Inox');
      expect(result.items.firstWhere((i) => i.productCode == '1252920').category, ProductCategory.bazar);
      expect(result.items.firstWhere((i) => i.productCode == '1212506').name, 'Sandalia Ipanema S Rast 35');
      expect(result.items.firstWhere((i) => i.productCode == '1212506').category, ProductCategory.diversos);
    });

    test('mergeDuplicateItems verifies productCode and unitPrice mismatch guards', () {
      final items = [
        // Same name, same unit, same unit price, DIFFERENT product codes -> must NOT merge
        ScannedReceiptItem(name: 'Produto Teste', price: 10.0, quantity: 1.0, unit: 'un', unitPrice: 10.0, productCode: '111'),
        ScannedReceiptItem(name: 'Produto Teste', price: 10.0, quantity: 1.0, unit: 'un', unitPrice: 10.0, productCode: '222'),
        // Same name, same code, DIFFERENT unit prices -> must NOT merge
        ScannedReceiptItem(name: 'Produto Promocao', price: 10.0, quantity: 1.0, unit: 'un', unitPrice: 10.0, productCode: '333'),
        ScannedReceiptItem(name: 'Produto Promocao', price: 8.0, quantity: 1.0, unit: 'un', unitPrice: 8.0, productCode: '333'),
        // Exact match with code & unitPrice -> MUST merge
        ScannedReceiptItem(name: 'Leite A', price: 5.50, quantity: 1.0, unit: 'un', unitPrice: 5.50, productCode: '444'),
        ScannedReceiptItem(name: 'Leite A', price: 11.00, quantity: 2.0, unit: 'un', unitPrice: 5.50, productCode: '444'),
      ];

      final merged = NfceScannerService.mergeDuplicateItems(items);
      expect(merged.length, 5);
      final leiteA = merged.firstWhere((i) => i.productCode == '444');
      expect(leiteA.quantity, 3.0);
      expect(leiteA.price, 16.50);
    });
  });

  group('Personal Price Index & Category Spending Tests', () {
    test('Calculates basket price index variation and category spending', () {
      final controller = ShoppingController(enablePersistence: false);
      final now = DateTime.now();

      // Prior purchase: 20 days ago
      controller.addPurchaseFromItems(
        marketId: controller.selectedMarket.id,
        date: now.subtract(const Duration(days: 20)),
        items: const [
          PurchaseHistoryItem(
            name: 'Azeite de Oliva',
            category: ProductCategory.alimentos,
            price: 30.00,
          ),
          PurchaseHistoryItem(
            name: 'Sabão em Pó',
            category: ProductCategory.limpeza,
            price: 20.00,
          ),
        ],
      );

      // Recent purchase: 2 days ago
      // Azeite rose from 30.00 to 36.00 (+20%)
      // Sabao fell from 20.00 to 18.00 (-10%)
      controller.addPurchaseFromItems(
        marketId: controller.selectedMarket.id,
        date: now.subtract(const Duration(days: 2)),
        items: const [
          PurchaseHistoryItem(
            name: 'Azeite de Oliva',
            category: ProductCategory.alimentos,
            price: 36.00,
          ),
          PurchaseHistoryItem(
            name: 'Sabão em Pó',
            category: ProductCategory.limpeza,
            price: 18.00,
          ),
        ],
      );

      final indexSummary = controller.calculatePriceIndex(daysWindow: 30);
      expect(indexSummary.totalComparedItems, 2);
      expect(indexSummary.increasedCount, 1);
      expect(indexSummary.decreasedCount, 1);
      // Average variation: (+20% + -10%) / 2 = +5%
      expect(indexSummary.overallVariationPercent, closeTo(5.0, 0.1));
      expect(indexSummary.topIncreases.first.productName, 'Azeite de Oliva');
      expect(indexSummary.topDecreases.first.productName, 'Sabão em Pó');

      // Category spending
      final spending = controller.calculateCategorySpending();
      expect(spending.isNotEmpty, true);
      // Alimentos: 30 + 36 = 66
      // Limpeza: 20 + 18 = 38
      // Total = 104
      expect(spending.first.category, ProductCategory.alimentos);
      expect(spending.first.totalSpent, 66.0);
    });

    testWidgets(
      'HomeScreen renders analytics, price index and category spending on narrow screen without overflow',
      (tester) async {
        // Set narrow screen size (320x640)
        tester.view.physicalSize = const Size(320, 640);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);

        final controller = ShoppingController(enablePersistence: false);
        final now = DateTime.now();

        controller.addPurchaseFromItems(
          marketId: controller.selectedMarket.id,
          date: now.subtract(const Duration(days: 30)),
          items: const [
            PurchaseHistoryItem(
              name: 'Arroz Camil 5kg',
              category: ProductCategory.alimentos,
              price: 22.0,
            ),
            PurchaseHistoryItem(
              name: 'Detergente Ypê 500ml',
              category: ProductCategory.limpeza,
              price: 2.50,
            ),
          ],
        );

        controller.addPurchaseFromItems(
          marketId: controller.selectedMarket.id,
          date: now,
          items: const [
            PurchaseHistoryItem(
              name: 'Arroz Camil 5kg',
              category: ProductCategory.alimentos,
              price: 26.0,
            ),
            PurchaseHistoryItem(
              name: 'Detergente Ypê 500ml',
              category: ProductCategory.limpeza,
              price: 2.20,
            ),
          ],
        );

        await tester.pumpWidget(
          MaterialApp(
            home: HomeScreen(controller: controller),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Início & Análises'), findsOneWidget);
        expect(find.text('Índice de Preços da Cesta'), findsOneWidget);
        expect(find.text('Gastos por Categoria'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets(
      'NfceQrScannerScreen renders header, buttons, and allows manual key input',
      (tester) async {
        String? scannedResult;

        await tester.pumpWidget(
          MaterialApp(
            home: Builder(
              builder: (context) {
                return Scaffold(
                  body: Center(
                    child: ElevatedButton(
                      onPressed: () async {
                        scannedResult = await Navigator.push<String>(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const NfceQrScannerScreen(),
                          ),
                        );
                      },
                      child: const Text('Open Scanner'),
                    ),
                  ),
                );
              },
            ),
          ),
        );

        // Tap to open scanner
        await tester.tap(find.text('Open Scanner'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        expect(find.text('Leitor NFC-e'), findsOneWidget);
        expect(find.text('Galeria'), findsOneWidget);
        expect(find.text('Digitar Chave'), findsOneWidget);

        // Tap "Digitar Chave"
        await tester.tap(find.text('Digitar Chave'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        expect(find.text('Digitar Chave / Link'), findsOneWidget);

        // Enter key
        await tester.enterText(
          find.byType(TextField),
          '35230912345678000190650010000012341234567890',
        );
        await tester.tap(find.text('Confirmar'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        expect(
          scannedResult,
          '35230912345678000190650010000012341234567890',
        );
      },
    );

    testWidgets(
      'HistoryScreen exposes QR Code and Link options for NF reading',
      (tester) async {
        final controller = ShoppingController(enablePersistence: false);

        await tester.pumpWidget(
          MaterialApp(
            home: HistoryScreen(controller: controller),
          ),
        );
        await tester.pumpAndSettle();

        // 1. In empty state, direct quick action buttons are present:
        expect(find.text('Ler por QR Code'), findsOneWidget);
        expect(find.text('Ler por Link / Chave'), findsOneWidget);

        // 2. Tapping "Adicionar Compra" opens bottom sheet with both options:
        await tester.tap(find.text('Adicionar Compra'));
        await tester.pumpAndSettle();

        expect(find.text('Como deseja adicionar a compra?'), findsOneWidget);
        expect(find.text('Ler pelo QR Code'), findsOneWidget);
        expect(find.text('Ler pelo Link ou Chave'), findsOneWidget);
        expect(find.text('Fotografar Cupom (OCR)'), findsOneWidget);
        expect(find.text('Digitar Manualmente'), findsOneWidget);
      },
    );
  });
}
