import 'package:carrinhocompras/main.dart';
import 'package:carrinhocompras/models/shopping_models.dart';
import 'package:carrinhocompras/services/category_classifier.dart';
import 'package:carrinhocompras/services/shopping_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CategoryClassifier & Text Parsing Tests', () {
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

    test('Prevents duplicate items ignoring accents and case (feijao == feijão)', () {
      final controller = ShoppingController(enablePersistence: false);
      final first = controller.addSingleItem('feijão');
      final duplicate = controller.addSingleItem('feijao');

      expect(first != null, true);
      expect(duplicate == null, true);
      expect(controller.totalItemsCount, 1);

      final pasteReport = controller.addItemsFromPastedTextWithReport(
        'Feijao\nArroz\narroz\nFEIJÃO',
      );
      expect(pasteReport.addedCount, 1);
      expect(pasteReport.skippedDuplicatesCount, 3);
      expect(controller.totalItemsCount, 2);
    });

    test('Recommends cheapest market from history and allows editing market assignment', () {
      final controller = ShoppingController(enablePersistence: false);

      // Record Arroz at R$ 22 in Supermercado Padrão
      final item1 = controller.addSingleItem('Arroz', price: 22.0)!;
      controller.toggleItemChecked(item1.id);
      controller.finishPurchase(marketId: 'mercado_padrao', onlyChecked: true);

      // Record Arroz at R$ 17 in Atacadão
      final item2 = controller.addSingleItem('Arroz', price: 17.0)!;
      controller.toggleItemChecked(item2.id);
      controller.finishPurchase(marketId: 'atacadao', onlyChecked: true);

      // Next time Arroz is added, it should automatically be assigned to 'atacadao'
      final newArroz = controller.addSingleItem('Arroz')!;
      expect(newArroz.marketId, 'atacadao');

      // And user can still manually edit it to buy at the more expensive market if desired
      controller.updateItem(newArroz.id, marketId: 'mercado_padrao');
      expect(controller.allItems.first.marketId, 'mercado_padrao');
    });
  });

  group('ShoppingController & 3 Screens Widget Tests', () {
    testWidgets(
      'Shows live market recommendation while typing and interactive price on chart',
      (WidgetTester tester) async {
        final controller = ShoppingController(enablePersistence: false);
        await tester.pumpWidget(CarrinhoComprasApp(controller: controller));

        // Add 1 item without price -> missing price icon should be visible
        final arroz = controller.addSingleItem('Arroz')!;
        await tester.pumpAndSettle();
        expect(find.byIcon(Icons.money_off_csred_outlined), findsOneWidget);

        // Set price -> missing price icon disappears
        controller.updateItem(arroz.id, price: 20.00);
        controller.toggleItemChecked(arroz.id);
        await tester.pumpAndSettle();
        expect(find.byIcon(Icons.money_off_csred_outlined), findsNothing);

        // Finish 1st purchase at Supermercado Padrão (R$ 20,00)
        controller.finishPurchase(
          marketId: 'mercado_padrao',
          date: DateTime(2026, 5, 10),
          onlyChecked: true,
        );

        // Add Arroz again and finish 2nd purchase at Atacadão (R$ 17,00 -> -15%)
        final arroz2 = controller.addSingleItem('Arroz', price: 17.00)!;
        controller.toggleItemChecked(arroz2.id);
        controller.finishPurchase(
          marketId: 'atacadao',
          date: DateTime(2026, 6, 15),
          onlyChecked: true,
        );
        await tester.pumpAndSettle();

        // Typing "Arroz" on the main screen shows the live recommendation banner for Atacadão
        await tester.enterText(find.byType(TextField).first, 'Arroz');
        await tester.pumpAndSettle();
        expect(
          find.textContaining('Compensa mais no Atacadão'),
          findsOneWidget,
        );

        // Go to Histórico tab
        await tester.tap(find.text('Histórico'));
        await tester.pumpAndSettle();

        // Expand purchase in "Por Mercado" and tap individual product "Arroz"
        await tester.tap(find.text('Atacadão').first);
        await tester.pumpAndSettle();
        await tester.tap(find.text('Arroz').first);
        await tester.pumpAndSettle();

        // Verify Individual Product Analytics Screen & interactive chart price banner
        expect(find.text('Último Preço Pago'), findsOneWidget);
        expect(find.text('-15% ↘'), findsOneWidget);
        expect(find.textContaining('Preço: R\$'), findsOneWidget);
      },
    );
  });
}
