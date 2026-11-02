import 'package:carrinhocompras/models/shopping_models.dart';
import 'package:carrinhocompras/screens/home_screen.dart';
import 'package:carrinhocompras/screens/nfce_qr_scanner_screen.dart';
import 'package:carrinhocompras/screens/pantry_screen.dart';
import 'package:carrinhocompras/services/nfce_scanner_service.dart';
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
      expect(result.items[0].category, ProductCategory.alimentos);
      expect(result.items[1].name, 'Leite Integral Piracanjuba 1l');
      expect(result.items[1].price, 14.70);
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

      expect(result.items[0].name, 'Refri Coca Cola 2l Trad');
      expect(result.items[0].price, 9.98);

      expect(result.items[1].name, 'Refri Coca Cola 600ml Zero');
      expect(result.items[1].price, 6.99);

      expect(result.items[2].name, 'Prot Diario Carefree 40x1 Todo Dia');
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
      expect(result.items[0].name, 'Pao Forma Bauducco Int 390g');
      expect(result.items[0].price, 11.99);
      expect(result.accessKey, '53261104972092006163652020002167941197684255');
    });
  });

  group('Pantry & Repurchase Prediction Tests', () {
    test('Adds items to pantry and manages quantity and status', () {
      final controller = ShoppingController(enablePersistence: false);

      final item = PantryItem(
        id: 'p1',
        name: 'Café Melitta 500g',
        category: ProductCategory.alimentos,
        quantity: 2.0,
        estimatedDaysToConsume: 15,
      );

      controller.addToPantry([item]);
      expect(controller.pantryItems.length, 1);
      expect(controller.pantryItems.first.quantity, 2.0);
      expect(controller.pantryItems.first.status, PantryItemStatus.ok);

      // Decrement quantity to low stock
      controller.updatePantryItemQuantity('p1', -1.8);
      expect(controller.pantryItems.first.quantity, closeTo(0.2, 0.01));
      expect(controller.pantryItems.first.status, PantryItemStatus.low);
      expect(controller.lowStockPantryCount, 1);

      // Add pantry item directly to shopping list
      final addedToList =
          controller.addPantryItemToShoppingList(controller.pantryItems.first);
      expect(addedToList, true);
      expect(
        controller.allItems.any((i) => i.name == 'Café Melitta 500g'),
        true,
      );
    });

    test('Quantity added on shopping list is reflected in Pantry after purchase', () {
      final controller = ShoppingController(enablePersistence: false);

      // Initially pantry has 1.0 unit of Leite
      controller.addToPantry([
        PantryItem(
          id: 'p_leite',
          name: 'Leite Integral',
          category: ProductCategory.alimentos,
          quantity: 1.0,
          unit: 'L',
        ),
      ]);

      // User adds 3 Leite Integral to the shopping list
      controller.addSingleItem(
        'Leite Integral',
        quantity: 3,
        unit: 'L',
        price: 5.0,
      );

      // Verify pantry reflects that 3 are on the shopping list
      expect(controller.getQuantityOnShoppingList('Leite Integral'), 3.0);

      // Finish purchase from shopping list
      final record = controller.finishPurchase(onlyChecked: false);
      expect(record, isNotNull);
      expect(record!.items.first.quantity, 3.0);
      expect(record.items.first.unit, 'L');

      // Send to pantry
      controller.addPurchaseItemsToPantry(record.items, marketName: record.marketName);

      // Pantry quantity must now be 1.0 + 3.0 = 4.0!
      expect(controller.pantryItems.length, 1);
      expect(controller.pantryItems.first.quantity, 4.0);
      expect(controller.pantryItems.first.unit, 'L');
    });

    test('Predicts replenishment for frequently bought items', () {
      final controller = ShoppingController(enablePersistence: false);
      final now = DateTime.now();

      // Purchase 1: 30 days ago
      controller.addPurchaseFromItems(
        marketId: controller.selectedMarket.id,
        date: now.subtract(const Duration(days: 30)),
        items: const [
          PurchaseHistoryItem(
            name: 'Pão de Forma',
            category: ProductCategory.alimentos,
            price: 8.50,
          ),
        ],
      );

      // Purchase 2: 15 days ago (interval = 15 days)
      controller.addPurchaseFromItems(
        marketId: controller.selectedMarket.id,
        date: now.subtract(const Duration(days: 15)),
        items: const [
          PurchaseHistoryItem(
            name: 'Pão de Forma',
            category: ProductCategory.alimentos,
            price: 9.00,
          ),
        ],
      );

      // Today is 15 days after last purchase. Repurchase should be suggested!
      final suggestions = controller.replenishmentSuggestions;
      expect(suggestions.isNotEmpty, true);
      final pBread = suggestions.firstWhere(
        (s) => s.productName.toLowerCase().contains('pão'),
      );
      expect(pBread.averageIntervalDays, 15);
      expect(pBread.urgency, RepurchaseUrgency.urgent);
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
      'PantryScreen displays vertical stepper, removes 3 dots, and triggers action sheet on long press',
      (tester) async {
        final controller = ShoppingController(enablePersistence: false);
        controller.addToPantry([
          PantryItem(
            id: 'item1',
            name: 'Arroz Integral 1kg',
            category: ProductCategory.alimentos,
            quantity: 3.0,
            unit: 'kg',
          ),
        ]);

        await tester.pumpWidget(
          MaterialApp(
            home: PantryScreen(controller: controller),
          ),
        );
        await tester.pumpAndSettle();

        // Verify item name and quantity displayed
        expect(find.text('Arroz Integral 1kg'), findsOneWidget);
        expect(find.text('3'), findsOneWidget);
        expect(find.text('kg'), findsOneWidget);

        // Verify 3 dots (more_vert) is removed!
        expect(find.byIcon(Icons.more_vert), findsNothing);

        // Verify vertical stepper buttons exist
        expect(find.byIcon(Icons.add_rounded), findsOneWidget);
        expect(find.byIcon(Icons.remove_rounded), findsOneWidget);

        // Tap '+' to increment
        await tester.tap(find.byIcon(Icons.add_rounded));
        await tester.pumpAndSettle();
        expect(controller.pantryItems.first.quantity, 4.0);

        // Long press item to trigger action sheet
        await tester.longPress(find.text('Arroz Integral 1kg'));
        await tester.pumpAndSettle();

        // Verify action sheet options are displayed
        expect(find.text('Adicionar à Lista de Compras'), findsOneWidget);
        expect(find.text('Editar Item'), findsOneWidget);
        expect(find.text('Remover da Despensa'), findsOneWidget);
      },
    );

    testWidgets(
      'PantryScreen gesture hint disappears after 4 seconds or when dismissed by user',
      (tester) async {
        final controller = ShoppingController(enablePersistence: false);
        controller.addToPantry([
          PantryItem(
            id: 'p1',
            name: 'Feijão Carioca 1kg',
            category: ProductCategory.alimentos,
            quantity: 2,
            unit: 'kg',
            estimatedDaysToConsume: 20,
            price: 7.90,
          ),
        ]);

        await tester.pumpWidget(
          MaterialApp(
            home: PantryScreen(controller: controller),
          ),
        );
        await tester.pump();

        // 1. Gesture hint is initially visible
        expect(
          find.text('Toque para editar ou segure para opções'),
          findsOneWidget,
        );

        // 2. Advance clock by 4 seconds
        await tester.pump(const Duration(seconds: 4));
        await tester.pumpAndSettle();

        // 3. Hint has disappeared automatically
        expect(
          find.text('Toque para editar ou segure para opções'),
          findsNothing,
        );
      },
    );

    testWidgets(
      'PantryScreen gesture hint can be dismissed immediately by close button or swipe',
      (tester) async {
        final controller = ShoppingController(enablePersistence: false);
        controller.addToPantry([
          PantryItem(
            id: 'p2',
            name: 'Leite Integral 1L',
            category: ProductCategory.alimentos,
            quantity: 6,
            unit: 'un',
            estimatedDaysToConsume: 10,
            price: 4.80,
          ),
        ]);

        await tester.pumpWidget(
          MaterialApp(
            home: PantryScreen(controller: controller),
          ),
        );
        await tester.pump();

        expect(
          find.text('Toque para editar ou segure para opções'),
          findsOneWidget,
        );

        // Swipe hint horizontally to dismiss off screen
        await tester.drag(
          find.text('Toque para editar ou segure para opções'),
          const Offset(-500, 0),
        );
        await tester.pumpAndSettle();

        expect(
          find.text('Toque para editar ou segure para opções'),
          findsNothing,
        );
      },
    );

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
  });
}
