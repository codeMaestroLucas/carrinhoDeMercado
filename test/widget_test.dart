import 'package:carrinhocompras/main.dart';
import 'package:carrinhocompras/models/shopping_models.dart';
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

  group('ShoppingController & 3 Screens Widget Tests', () {
    testWidgets(
      'Dynamic multi-item input, new tab order (Lista, Histórico, Configurações), and Adicionar Compra on History',
      (WidgetTester tester) async {
        final controller = ShoppingController(enablePersistence: false);
        await tester.pumpWidget(CarrinhoComprasApp(controller: controller));

        // Verify Paste button was removed and prominent Adicionar button exists
        expect(find.text('Colar'), findsNothing);
        expect(find.text('Adicionar'), findsOneWidget);

        // Dynamically enter multiple items in the single input field
        await tester.enterText(
          find.byType(TextField).first,
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

        // Verify tab order: Lista (0), Histórico (1), Configurações (2)
        final navBar = tester.widget<NavigationBar>(find.byType(NavigationBar));
        expect(
          (navBar.destinations[0] as NavigationDestination).label,
          'Lista',
        );
        expect(
          (navBar.destinations[1] as NavigationDestination).label,
          'Histórico',
        );
        expect(
          (navBar.destinations[2] as NavigationDestination).label,
          'Configurações',
        );

        // Navigate to Histórico (2nd tab)
        await tester.tap(find.text('Histórico'));
        await tester.pumpAndSettle();

        // Verify "Adicionar Compra" button is present and "Total nas compras" is not shown
        expect(find.text('Adicionar Compra'), findsOneWidget);
        expect(find.textContaining('Total nas compras'), findsNothing);
      },
    );
  });
}
