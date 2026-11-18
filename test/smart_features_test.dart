import 'package:carrinhocompras/models/shopping_models.dart';
import 'package:carrinhocompras/screens/home_screen.dart';
import 'package:carrinhocompras/screens/nfce_qr_scanner_screen.dart';
import 'package:carrinhocompras/services/category_classifier.dart';
import 'package:carrinhocompras/services/nfce_scanner_service.dart';
import 'package:carrinhocompras/services/receipt_scanner_service.dart';
import 'package:carrinhocompras/services/shopping_controller.dart';
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
      expect(result.items[0].category, ProductCategory.alimentos);
      expect(result.items[1].name, 'Leite Integral Piracanjuba 1l');
      expect(result.items[1].price, 14.70);
      expect(result.items[1].quantity, 3.0);
      expect(result.items[1].effectiveUnitPrice, 4.90);
      expect(result.items[1].category, ProductCategory.alimentos);
    });

    test('Accurately parses SEFAZ NFC-e quantity formats (1.000 == 1 und, 2.000 == 2 und)', () {
      expect(NfceScannerService.parseNfceQuantity('1.000'), 1.0);
      expect(NfceScannerService.parseNfceQuantity('2.000'), 2.0);
      expect(NfceScannerService.parseNfceQuantity('3.000'), 3.0);
      expect(NfceScannerService.parseNfceQuantity('1.0000'), 1.0);
      expect(NfceScannerService.parseNfceQuantity('2.0000'), 2.0);
      expect(NfceScannerService.parseNfceQuantity('1,000'), 1.0);
      expect(NfceScannerService.parseNfceQuantity('2,000'), 2.0);
      expect(NfceScannerService.parseNfceQuantity('0.450'), 0.45);
      expect(NfceScannerService.parseNfceQuantity('0,450'), 0.45);
      expect(NfceScannerService.parseNfceQuantity('1.250'), 1.25);
      expect(NfceScannerService.parseNfceQuantity('10'), 10.0);
      expect(NfceScannerService.parseNfceQuantity(''), 1.0);
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

      expect(result.items[0].name, 'Refrigerante Coca Cola 2l Tradicional');
      expect(result.items[0].price, 9.98);

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
      expect(result.items[0].name, 'Pao Forma Bauducco Integral 390g');
      expect(result.items[0].price, 11.99);
      expect(result.accessKey, '53261104972092006163652020002167941197684255');
    });

    test('Expands realistic Brazilian supermarket receipt & NFC-e abbreviations', () {
      // 1. Meat / Açougue
      expect(
        NfceScannerService.cleanNfceProductName('BOV MOID ACEM 1KG'),
        'Bovino Moída Acém 1kg',
      );
      expect(
        NfceScannerService.cleanNfceProductName('CARN ALCATR PIC 500G'),
        'Carne Alcatra Picado 500g',
      );
      expect(
        NfceScannerService.cleanNfceProductName('FILE FRANG CONG'),
        'Filé Frango Congelado',
      );
      expect(
        NfceScannerService.cleanNfceProductName('COSTEL SUIN DEFUM'),
        'Costela Suíno Defumado',
      );

      // 2. Frios & Laticínios
      expect(
        NfceScannerService.cleanNfceProductName('QUEIJ MUSSA FAT 200G'),
        'Queijo Mussarela Fatiado 200g',
      );
      expect(
        NfceScannerService.cleanNfceProductName('LEIT DESNAT PAST 1L'),
        'Leite Desnatado Pasteurizado 1l',
      );
      expect(
        NfceScannerService.cleanNfceProductName('REQ CREM TRAD'),
        'Requeijão Creme Tradicional',
      );

      // 3. Limpeza & Higiene
      expect(
        NfceScannerService.cleanNfceProductName('DET LOUC LIMP 500ML'),
        'Detergente Louças Limpador 500ml',
      );
      expect(
        NfceScannerService.cleanNfceProductName('AMAC ROUP CONC REFIL 1L'),
        'Amaciante Roupas Concentrado Refil 1l',
      );
      expect(
        NfceScannerService.cleanNfceProductName('SAB LIQ REFIL 200ML'),
        'Sabonete Líquido Refil 200ml',
      );
      expect(
        NfceScannerService.cleanNfceProductName('DESOD AER ANTISS'),
        'Desodorante Aerossol Antisséptico',
      );

      // 4. Hortifruti & Mercearia
      expect(
        NfceScannerService.cleanNfceProductName('BATAT ESP BDJ 1KG'),
        'Batata Especial Bandeja 1kg',
      );
      expect(
        NfceScannerService.cleanNfceProductName('SC ARROZ TRG 5KG'),
        'Saco Arroz Trigo 5kg',
      );
      expect(
        NfceScannerService.cleanNfceProductName('OL SOJ 900ML PET'),
        'Óleo Soja 900ml Pet',
      );
      expect(
        NfceScannerService.cleanNfceProductName('SUC LAR INT 1L'),
        'Suco Laranja Integral 1l',
      );

      // 5. User explicit requested abbreviations (LT, L Mov, Hid, SH, Cr Leite, qj, oreg)
      expect(
        NfceScannerService.cleanNfceProductName('LT INT PIRACANJUBA 1L'),
        'Leite Integral Piracanjuba 1l',
      );
      expect(
        NfceScannerService.cleanNfceProductName('L MOV PEROBA 200ML'),
        'Lava Móveis Peroba 200ml',
      );
      expect(
        NfceScannerService.cleanNfceProductName('HID CORP NIVEA 200ML'),
        'Hidratante Corp Nivea 200ml',
      );
      expect(
        NfceScannerService.cleanNfceProductName('SH DOVE RECONSTRUCAO 400ML'),
        'Shampoo Dove Reconstrucao 400ml',
      );
      expect(
        NfceScannerService.cleanNfceProductName('CR LEITE NESTLE 200G'),
        'Creme de Leite Nestle 200g',
      );
      expect(
        NfceScannerService.cleanNfceProductName('QJ PRATO FAT 150G'),
        'Queijo Prato Fatiado 150g',
      );
      expect(
        NfceScannerService.cleanNfceProductName('OREG DESIDRATADO KITANO'),
        'Orégano Desidratado Kitano',
      );
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

    test('Correctly extracts and classifies Limpa móvel and Limpa vidro without corrupting initial L into unit', () {
      final item1 = CategoryClassifier.extractQuantityAndName('Limpa movel');
      expect(item1.name, 'Limpa movel');
      expect(item1.quantity, 1);
      expect(item1.unit, 'un');
      expect(CategoryClassifier.classify(item1.name), ProductCategory.limpeza);

      final item2 = CategoryClassifier.extractQuantityAndName('1 Limpa movel');
      expect(item2.name, 'Limpa movel');
      expect(item2.quantity, 1);
      expect(item2.unit, 'un');

      final item3 = CategoryClassifier.extractQuantityAndName('Limpa vidro');
      expect(item3.name, 'Limpa vidro');
      expect(item3.quantity, 1);
      expect(item3.unit, 'un');
      expect(CategoryClassifier.classify(item3.name), ProductCategory.limpeza);

      final item4 = CategoryClassifier.extractQuantityAndName('1 Limpa vidro');
      expect(item4.name, 'Limpa vidro');
      expect(item4.quantity, 1);
      expect(item4.unit, 'un');

      final item5 = CategoryClassifier.extractQuantityAndName('Limpa móveis');
      expect(CategoryClassifier.classify(item5.name), ProductCategory.limpeza);
    });

    test('ShoppingController deletes and restores purchase records properly', () {
      final controller = ShoppingController(enablePersistence: false);
      final record = controller.addPurchaseFromItems(
        marketId: controller.selectedMarket.id,
        items: const [
          PurchaseHistoryItem(
            name: 'Limpa móvel',
            category: ProductCategory.limpeza,
            price: 15.50,
          ),
        ],
      );

      expect(controller.history.length, 1);
      expect(controller.history.first.id, record!.id);

      controller.deletePurchaseRecord(record.id);
      expect(controller.history.isEmpty, true);

      controller.restorePurchaseRecord(record, atIndex: 0);
      expect(controller.history.length, 1);
      expect(controller.history.first.items.first.name, 'Limpa móvel');
    });

    test('Parses Firestore Map format cleanly without dropping items or throwing TypeError', () {
      final firestoreRawData = <String, dynamic>{
        'items': <dynamic>[
          <dynamic, dynamic>{
            'id': 'item_1',
            'name': 'Escova de vaso sanitário',
            'category': 'perfumaria_higiene',
            'quantity': 1,
            'unit': 'un',
            'isPriceTotal': false,
            'isChecked': false,
            'createdAt': '2026-11-05T08:45:53.633',
          },
          <dynamic, dynamic>{
            'id': 'item_2',
            'name': 'WD40',
            'category': 'diversos',
            'quantity': 1,
            'unit': 'un',
            'isPriceTotal': false,
            'isChecked': false,
            'createdAt': '2026-10-29T22:37:57.956096',
          }
        ],
        'learnedCategories': <dynamic, dynamic>{
          'arroz': 'alimentos',
        },
        'categoryDictionary': <dynamic, dynamic>{
          'alimentos': <dynamic>['arroz', 'feijao'],
        },
      };

      // Simulates remote sync event from Firestore
      final rawList = firestoreRawData['items'] as List;
      final parsed = rawList
          .whereType<Map>()
          .map((m) => ShoppingItem.fromJson(Map<String, dynamic>.from(m)))
          .toList();

      expect(parsed.length, 2);
      expect(parsed[0].name, 'Escova de vaso sanitário');
      expect(parsed[1].name, 'WD40');
    });

    test('NfceScannerService extractAccessKey handles multiline and OCR noise', () {
      const canonicalKey = '41230912345678000190650010000012341234567890';
      expect(NfceScannerService.extractAccessKey(canonicalKey), canonicalKey);

      // Spaced 11x4
      const spaced = '4123 0912 3456 7800 0190 6500 1000 0012 3412 3456 7890';
      expect(NfceScannerService.extractAccessKey(spaced), canonicalKey);

      // Multiline with OCR letter 'O' confused for '0'
      const ocrNoise = '''
SUPERMERCADO LTDA
CHAVE DE ACESSO
4123 O912 3456 78OO O19O 65
OO 1OOO OO12 3412 3456 789O
PROTOCOLO: 123456789
''';
      expect(NfceScannerService.extractAccessKey(ocrNoise), canonicalKey);
    });

    test('NfceScannerService extractSefazUrl joins multiline thermal paper URLs cleanly', () {
      const multilineUrlReceipt = '''
EMITIDO EM 05/11/2026 18:30
Consulte pela Chave de Acesso em
http://www.fazenda.pr.gov.br/
nfce/qrcode?p=41230912345678000190650010000012341234567890|2|1|1|C8F9
CHAVE DE ACESSO
4123 0912 3456 7800 0190 6500 1000 0012 3412 3456 7890
''';
      final extracted = NfceScannerService.extractSefazUrl(multilineUrlReceipt);
      expect(extracted, isNotNull);
      expect(
        extracted,
        'http://www.fazenda.pr.gov.br/nfce/qrcode?p=41230912345678000190650010000012341234567890|2|1|1|C8F9',
      );
    });

    test('ReceiptScannerService repairs OCR confusions: 0 vs O, v vs u, and imperfect prices', () {
      const ocrReceipt = '''
001 7891000 BISC0IT0 RECH ORE0 90G 2 UN X 3,99 7,98
002 7892000 C0CA-C0LA 2L 1 UN X 9,9O 9,9O
003 7893000 CERUEJA HEINEKEN 350ML 6 UN X 6,50 39,00
004 7894000 SVCO DE UVA INTEGRAL 1L 1 UN X 12,90 12,90
005 7895000 AZEITE DE OLIUA EXTRA VIRG 500ML 1 UN X 35,O0 35,O0
006 7896000 QVEIJO PRATO 150G 1 UN X 8,50 8,50
007 7897000 IOGVRTE GREGO 90G 4 UN X 3,25 13,00
008 7898000 ACVCAR CRISTAL 5KG 1 UN X 18,90 18,90
009 7899000 AUEIA FLOCOS 200G 1 UN X 5,50 5,50
010 7800000 COUUE MANTEIGA 1 UN X 3,00 3,00
011 7801000 0LE0 SOJA 900ML 1 UN X 7,89 7,89
''';
      final items = ReceiptScannerService.parseReceiptText(ocrReceipt);
      expect(items.length, 11);

      // 0 vs O in words, but preserved in measurements
      expect(items[0].name.contains('Biscoito'), isTrue);
      expect(items[0].name.contains('Oreo'), isTrue);
      expect(items[0].quantity, 2.0);
      expect(items[0].price, 7.98);

      // Coca-cola with 0 repaired and price with 'O' normalized (9,9O -> 9.90)
      expect(items[1].name.contains('Coca-cola'), isTrue);
      expect(items[1].price, 9.90);

      // 'u' mistyped for 'v' -> CERUEJA -> Cerveja
      expect(items[2].name.contains('Cerveja'), isTrue);
      expect(items[2].name.contains('Heineken'), isTrue);
      expect(items[2].quantity, 6.0);

      // 'v' mistyped for 'u' -> SVCO -> Suco, and UVA is preserved with 'v'!
      expect(items[3].name.contains('Suco'), isTrue);
      expect(items[3].name.contains('Uva'), isTrue);

      // OLIUA -> Oliva, and price with 'O' normalized (35,O0 -> 35.00)
      expect(items[4].name.contains('Oliva'), isTrue);
      expect(items[4].price, 35.00);

      // QVEIJO -> Queijo
      expect(items[5].name.contains('Queijo'), isTrue);

      // IOGVRTE -> Iogurte
      expect(items[6].name.contains('Iogurte'), isTrue);

      // ACVCAR -> Açúcar
      expect(items[7].name.contains('Açúcar'), isTrue);

      // AUEIA -> Aveia
      expect(items[8].name.contains('Aveia'), isTrue);

      // COUUE -> Couve
      expect(items[9].name.contains('Couve'), isTrue);

      // 0LE0 -> Óleo / Oleo
      expect(items[10].name.contains('Óleo') || items[10].name.contains('Oleo'), isTrue);
    });

    test('ReceiptScannerService repairs split words like "espon ja" and misreadings like "escoua"', () {
      const receiptWithSplitAndMisread = '''
001 7891001 ESPON JA SCOTCH BRITE 1 UN X 4,50 4,50
002 7891002 ESCOUA DENTAL COLGATE 2 UN X 8,90 17,80
003 7891003 ES COUA SANITARIA 1 UN X 12,00 12,00
004 7891004 ESCO VA DENTAL ORAL B 1 UN X 9,50 9,50
005 7891005 SA BO NETE DOVE 90G 3 UN X 3,80 11,40
006 7891006 CHO CO LATE NESTLE 1 UN X 6,99 6,99
007 7891007 MA CA RRAO DONA BENTA 500G 2 UN X 4,20 8,40
008 7891008 MARGA RINA QUALY 500G 1 UN X 7,50 7,50
009 7891009 UASSOURA SANTA MARIA 1 UN X 15,90 15,90
010 7891010 CAME MOIDA BOVINA 1,000 KG X 29,90 29,90
''';
      final items = ReceiptScannerService.parseReceiptText(receiptWithSplitAndMisread);
      expect(items.length, 10);

      // "espon ja" merged into "Esponja"
      expect(items[0].name.startsWith('Esponja'), isTrue);
      expect(items[0].name, 'Esponja Scotch Brite');
      expect(items[0].category, ProductCategory.limpeza);

      // "escoua" corrected into "Escova"
      expect(items[1].name.startsWith('Escova'), isTrue);
      expect(items[1].name, 'Escova Dental Colgate');

      // "es coua" merged and corrected into "Escova"
      expect(items[2].name.startsWith('Escova'), isTrue);
      expect(items[2].name, 'Escova Sanitária');

      // "esco va" merged into "Escova"
      expect(items[3].name.startsWith('Escova'), isTrue);
      expect(items[3].name, contains('Oral'));

      // "sa bo nete" merged into "Sabonete"
      expect(items[4].name.startsWith('Sabonete'), isTrue);

      // "cho co late" merged into "Chocolate"
      expect(items[5].name.startsWith('Chocolate'), isTrue);

      // "ma ca rrao" merged into "Macarrão"
      expect(items[6].name.startsWith('Macarrão'), isTrue);

      // "marga rina" merged into "Margarina"
      expect(items[7].name.startsWith('Margarina'), isTrue);

      // "uassoura" corrected into "Vassoura"
      expect(items[8].name.startsWith('Vassoura'), isTrue);

      // "came" corrected into "Carne"
      expect(items[9].name.startsWith('Carne'), isTrue);
    });

    test('ReceiptScannerService never captures bill Total, Valor total, Ualor total or Subtotal as items, but preserves actual products like Colgate Total', () {
      const receiptWithTotals = '''
001 7891001 ARROZ TIO JOAO 5KG 1 UN X 29,90 29,90
002 7891002 FEIJAO CARIOCA 1KG 2 UN X 7,50 15,00
003 7891003 CREME DENTAL COLGATE TOTAL 12 90G 1 UN X 6,99 6,99
SUBTOTAL 51,89
DESCONTO R\$ 1,89
TOTAL R\$ 50,00
VALOR TOTAL R\$ 50,00
UALOR TOTAL R\$ 50,00
004 UALOR TOTAL R\$ 50,00
005 VALOR TOTAL R\$ 50,00
006 ULR TOTAL 50,00
VALOR A PAGAR R\$ 50,00
UALOR A PAGAR R\$ 50,00
VALOR TOTAL A PAGAR R\$ 50,00
UALOR TOTAL A PAGAR R\$ 50,00
007 VALOR TOTAL A PAGAR 50,00
008 UALOR TOTAL A PAGAR 50,00
UALOR LIQUIDO 50,00
VALOR LIQUIDO 50,00
UALOR DOS PRODUTOS 51,89
VALOR DOS PRODUTOS 51,89
FORMA DE PAGAMENTO: CARTAO CREDITO 50,00
TROCO R\$ 0,00
''';
      final items = ReceiptScannerService.parseReceiptText(receiptWithTotals);
      expect(items.length, 3);

      expect(items[0].name, contains('Arroz'));
      expect(items[0].price, 29.90);

      expect(items[1].name, contains('Feijao'));
      expect(items[1].price, 15.00);

      // Product containing 'Total' in its brand name is preserved
      expect(items[2].name, contains('Colgate Total'));
      expect(items[2].price, 6.99);

      // None of the items is "Total", "Subtotal", "Desconto", "Valor total", "Ualor total" or "Valor a Pagar"
      for (final item in items) {
        final lower = item.name.toLowerCase();
        expect(lower == 'total', isFalse);
        expect(lower == 'subtotal', isFalse);
        expect(lower.contains('valor total'), isFalse);
        expect(lower.contains('ualor total'), isFalse);
        expect(lower.contains('ulr total'), isFalse);
        expect(lower.contains('pagar'), isFalse);
        expect(lower.contains('troco'), isFalse);
        expect(lower.contains('desconto'), isFalse);
        expect(lower.contains('produtos'), isFalse);
      }
    });

    test('ReceiptScannerService preserves exact item order from the NF and restores order when OCR slightly permutes lines', () {
      // Simulates a receipt where OCR recognized items slightly inverted (003 before 002)
      const receiptInvertedOcr = '''
001 7891001 ARROZ TIO JOAO 5KG 1 UN X 29,90 29,90
003 7891003 LEITE INTEGRAL 1L 2 UN X 5,50 11,00
002 7891002 FEIJAO CARIOCA 1KG 1 UN X 8,50 8,50
004 7891004 SABONETE DOVE 90G 3 UN X 3,90 11,70
VALOR TOTAL R\$ 61,10
''';
      final items = ReceiptScannerService.parseReceiptText(receiptInvertedOcr);
      expect(items.length, 4);

      // Must be sorted in exact order 1, 2, 3, 4 matching the physical receipt
      expect(items[0].itemIndex, 1);
      expect(items[0].name, contains('Arroz'));
      expect(items[0].price, 29.90);

      expect(items[1].itemIndex, 2);
      expect(items[1].name, contains('Feijao'));
      expect(items[1].price, 8.50);

      expect(items[2].itemIndex, 3);
      expect(items[2].name, contains('Leite'));
      expect(items[2].price, 11.00);

      expect(items[3].itemIndex, 4);
      expect(items[3].name, contains('Sabonete'));
      expect(items[3].price, 11.70);
    });

    test('Expands supermarket abbreviations Sc -> Saco and Ol -> Óleo', () {
      final name1 = NfceScannerService.cleanNfceProductName('ARROZ SC 5KG TIPO 1');
      expect(name1, contains('Saco'));

      final name2 = NfceScannerService.cleanNfceProductName('OL SOJA LIZA 900ML');
      expect(name2, contains('Óleo'));

      const receipt = '''
001 7891001 ARROZ SC 5KG 1 UN X 25,00 25,00
002 7891002 OL SOJA 900ML 1 UN X 7,50 7,50
''';
      final parsed = ReceiptScannerService.parseReceiptText(receipt);
      expect(parsed[0].name, contains('Saco'));
      expect(parsed[1].name, contains('Óleo'));
    });

    test('Accumulates duplicate scanned items and preserves unit price and total price', () {
      const receiptWithDuplicates = '''
001 7891001 CERVEJA HEINEKEN 350ML 1 UN X 6,00 6,00
002 7891001 CERVEJA HEINEKEN 350ML 1 UN X 6,00 6,00
003 7891001 CERVEJA HEINEKEN 350ML 2 UN X 6,00 12,00
004 7891002 LEITE INTEGRAL 1L 1 UN X 5,00 5,00
''';
      final items = ReceiptScannerService.parseReceiptText(receiptWithDuplicates);
      expect(items.length, 2);
      expect(items[0].name, contains('Cerveja Heineken'));
      expect(items[0].quantity, 4.0);
      expect(items[0].price, 24.00);
      expect(items[0].effectiveUnitPrice, 6.00);

      expect(items[1].name, contains('Leite Integral'));
      expect(items[1].quantity, 1.0);
      expect(items[1].price, 5.00);
    });

    test('Classifies hortifruti, congelados, alimentos, and defaults unknown items to diversos', () {
      expect(CategoryClassifier.classify('Tomate Italiano'), ProductCategory.hortifruti);
      expect(CategoryClassifier.classify('Cebola'), ProductCategory.hortifruti);
      expect(CategoryClassifier.classify('Banana Prata'), ProductCategory.hortifruti);
      expect(CategoryClassifier.classify('Alface Crespa'), ProductCategory.hortifruti);
      expect(CategoryClassifier.classify('Maçã Fuji'), ProductCategory.hortifruti);
      expect(CategoryClassifier.classify('Uva Thompson'), ProductCategory.hortifruti);

      expect(CategoryClassifier.classify('Pizza de Calabresa'), ProductCategory.congelados);
      expect(CategoryClassifier.classify('Nuggets de Frango'), ProductCategory.congelados);
      expect(CategoryClassifier.classify('Hambúrguer Congelado'), ProductCategory.congelados);
      expect(CategoryClassifier.classify('Sorvete de Chocolate'), ProductCategory.congelados);

      expect(CategoryClassifier.classify('Arroz Branco'), ProductCategory.alimentos);
      expect(CategoryClassifier.classify('Feijão Preto'), ProductCategory.alimentos);
      expect(CategoryClassifier.classify('Macarrão Espaguete'), ProductCategory.alimentos);
      expect(CategoryClassifier.classify('Carne Moída'), ProductCategory.alimentos);

      // Unrelated items MUST NOT be classified as Alimentos - must default to Diversos
      expect(CategoryClassifier.classify('Martelo'), ProductCategory.diversos);
      expect(CategoryClassifier.classify('Cabo USB'), ProductCategory.diversos);
      expect(CategoryClassifier.classify('Furadeira de Impacto'), ProductCategory.diversos);
      expect(CategoryClassifier.classify('Carregador de Celular'), ProductCategory.diversos);
    });

    test('ShoppingController adds new product falling back to Diversos when unclassified', () {
      final controller = ShoppingController(enablePersistence: false);
      final item = controller.addSingleItem('Martelo 500g');
      expect(item, isNotNull);
      expect(item!.category, ProductCategory.diversos);

      final vegItem = controller.addSingleItem('Maçã Fuji');
      expect(vegItem, isNotNull);
      expect(vegItem!.category, ProductCategory.hortifruti);

      final congItem = controller.addSingleItem('Pizza 4 Queijos');
      expect(congItem, isNotNull);
      expect(congItem!.category, ProductCategory.congelados);
    });
  });
}
