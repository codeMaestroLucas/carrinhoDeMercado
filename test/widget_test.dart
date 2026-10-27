import 'package:carrinhocompras/main.dart';
import 'package:carrinhocompras/models/shopping_models.dart';
import 'package:carrinhocompras/screens/shopping_list_screen.dart';
import 'package:carrinhocompras/services/category_classifier.dart';
import 'package:carrinhocompras/services/receipt_scanner_service.dart';
import 'package:carrinhocompras/services/shopping_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CategoryClassifier & ReceiptScannerService Tests', () {
    test('Classifies products automatically into the 9 required categories', () {
      expect(
        CategoryClassifier.classify('Arroz 5kg'),
        ProductCategory.alimentos,
      );
      expect(
        CategoryClassifier.classify('Cerveja Heineken'),
        ProductCategory.bebidas,
      );
      expect(
        CategoryClassifier.classify('Detergente Ypê'),
        ProductCategory.limpeza,
      );
      expect(
        CategoryClassifier.classify('Shampoo Anticaspa'),
        ProductCategory.perfumariaHigiene,
      );
      expect(
        CategoryClassifier.classify('Fralda Pampers G'),
        ProductCategory.bebeCrianca,
      );
      expect(
        CategoryClassifier.classify('Papel toalha'),
        ProductCategory.descartaveis,
      );
      expect(
        CategoryClassifier.classify('Ração para cachorro'),
        ProductCategory.petShop,
      );
      expect(
        CategoryClassifier.classify('Lâmpada LED'),
        ProductCategory.bazar,
      );
      expect(
        CategoryClassifier.classify('Item desconhecido xyz'),
        ProductCategory.diversos,
      );
    });

    test('Parses Brazilian receipt (NFC-e / Cupom Fiscal) lines into items and prices', () {
      const sampleReceipt = '''
SUPERMERCADO EXEMPLO LTDA
CNPJ: 12.345.678/0001-99
DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRONICA
001 789100012345 ARROZ T1 CAMIL 5KG 1 UN X 24,90 24,90
002 789100054321 FEIJAO CARIOCA 1KG
2 UN X 7,50 15,00
003 DETERGENTE YPE 500ML 2,39
QTD. TOTAL DE ITENS 3
VALOR TOTAL R\$ 42,29
CARTAO DE CREDITO 42,29
''';
      final extracted = ReceiptScannerService.parseReceiptText(sampleReceipt);
      expect(extracted.length, 3);
      expect(extracted[0].name, 'Arroz t1 camil 5kg');
      expect(extracted[0].price.toStringAsFixed(2), '24.90');
      expect(extracted[1].name, 'Feijao carioca 1kg');
      expect(extracted[1].price.toStringAsFixed(2), '15.00');
      expect(extracted[2].name, 'Detergente ype 500ml');
      expect(extracted[2].price.toStringAsFixed(2), '2.39');
    });
  });

  group('ShoppingController & 4 Screens Widget Tests', () {
    testWidgets(
      'Dynamic multi-item input, 4 tabs (Início, Lista, Histórico, Configurações), Home analytics, and Dark Mode toggle',
      (WidgetTester tester) async {
        final controller = ShoppingController(enablePersistence: false);
        await tester.pumpWidget(CarrinhoComprasApp(controller: controller));

        // Verify Paste button was removed and prominent Adicionar button exists on Lista
        expect(find.text('Colar'), findsNothing);
        expect(find.text('Adicionar'), findsOneWidget);

        // Dynamically enter multiple items in the single input field on Lista
        final listInputFinder = find.descendant(
          of: find.byType(ShoppingListScreen),
          matching: find.byType(TextField),
        );
        await tester.enterText(
          listInputFinder.first,
          'Arroz\nFeijão\nDetergente',
        );
        await tester.pumpAndSettle();

        // Button dynamically updates to show count of detected items
        expect(find.text('Adicionar (3)'), findsOneWidget);
        await tester.tap(find.text('Adicionar (3)'));
        await tester.pumpAndSettle();

        expect(find.text('Arroz'), findsOneWidget);
        expect(find.text('Feijão'), findsOneWidget);
        expect(find.text('Detergente'), findsOneWidget);

        // Verify tab order: Início (0), Lista (1), Histórico (2), Configurações (3)
        final navBar = tester.widget<NavigationBar>(find.byType(NavigationBar));
        expect(
          (navBar.destinations[0] as NavigationDestination).label,
          'Início',
        );
        expect(
          (navBar.destinations[1] as NavigationDestination).label,
          'Lista',
        );
        expect(
          (navBar.destinations[2] as NavigationDestination).label,
          'Histórico',
        );
        expect(
          (navBar.destinations[3] as NavigationDestination).label,
          'Configurações',
        );

        // Add sample purchase history to verify Home screen analytics
        controller.addPurchaseFromItems(
          marketId: controller.selectedMarket.id,
          date: DateTime.now().subtract(const Duration(days: 5)),
          items: const [
            PurchaseHistoryItem(
              name: 'Arroz',
              category: ProductCategory.alimentos,
              price: 20.0,
            ),
          ],
        );
        controller.addPurchaseFromItems(
          marketId: controller.selectedMarket.id,
          date: DateTime.now(),
          items: const [
            PurchaseHistoryItem(
              name: 'Arroz',
              category: ProductCategory.alimentos,
              price: 25.0,
            ),
          ],
        );
        await tester.pumpAndSettle();

        // Navigate to Início (Home tab with house icon)
        await tester.tap(find.text('Início'));
        await tester.pumpAndSettle();

        expect(find.text('Início & Análises'), findsOneWidget);
        expect(find.text('Maiores Variações Recentes'), findsOneWidget);
        expect(find.text('Análise por Produto'), findsOneWidget);

        // Navigate to Histórico
        await tester.tap(find.text('Histórico'));
        await tester.pumpAndSettle();

        expect(find.text('Adicionar Compra'), findsOneWidget);

        // Toggle Dark Mode
        expect(controller.isDarkMode, false);
        controller.toggleDarkMode();
        await tester.pumpAndSettle();
        expect(controller.isDarkMode, true);
      },
    );
  });
}
