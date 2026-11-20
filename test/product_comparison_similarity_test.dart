import 'package:carrinhocompras/models/shopping_models.dart';
import 'package:carrinhocompras/services/category_classifier.dart';
import 'package:carrinhocompras/services/product_history_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CategoryClassifier.normalizeForComparison', () {
    test('strips receipt codes and noise tokens while preserving product name', () {
      expect(
        CategoryClassifier.normalizeForComparison('Melão Amarelo 4821'),
        'melao amarelo',
      );
      expect(
        CategoryClassifier.normalizeForComparison('MELAO AMARELO COD 9102'),
        'melao amarelo',
      );
      expect(
        CategoryClassifier.normalizeForComparison('004521 MELAO AMARELO KG'),
        'melao amarelo',
      );
      expect(
        CategoryClassifier.normalizeForComparison('Melão Amarelo (REF: 1234)'),
        'melao amarelo',
      );
      expect(
        CategoryClassifier.normalizeForComparison('Melão Amarelo #789 PROM'),
        'melao amarelo',
      );
    });

    test('preserves meaningful numbers and unit quantities', () {
      expect(
        CategoryClassifier.normalizeForComparison('Arroz Tipo 1 Camil 5kg'),
        'arroz tipo 1 camil 5kg',
      );
      expect(
        CategoryClassifier.normalizeForComparison('Leite Integral 1L'),
        'leite integral 1l',
      );
      expect(
        CategoryClassifier.normalizeForComparison('Papel Higiênico 12 Rolos'),
        'papel higienico 12 rolo',
      );
    });

    test('expands common abbreviations for receipt matching', () {
      expect(
        CategoryClassifier.normalizeForComparison('FRANG PEIT KG'),
        'frango peito',
      );
    });
  });

  group('CategoryClassifier.productSimilarity', () {
    test('returns 1.0 for same product with different receipt codes', () {
      final score = CategoryClassifier.productSimilarity(
        'Melão Amarelo 4821',
        'MELAO AMARELO COD 9102',
        categoryA: ProductCategory.hortifruti,
        categoryB: ProductCategory.hortifruti,
      );
      expect(score, 1.0);
    });

    test('scores similar products higher than unrelated products', () {
      final similarScore = CategoryClassifier.productSimilarity(
        'Melão Amarelo',
        'Melão Espanhol',
        categoryA: ProductCategory.hortifruti,
        categoryB: ProductCategory.hortifruti,
      );
      final unrelatedScore = CategoryClassifier.productSimilarity(
        'Melão Amarelo',
        'Detergente Líquido',
        categoryA: ProductCategory.hortifruti,
        categoryB: ProductCategory.limpeza,
      );

      expect(similarScore, greaterThanOrEqualTo(0.42));
      expect(unrelatedScore, lessThan(0.35));
      expect(similarScore, greaterThan(unrelatedScore));
    });
  });

  group('ProductHistoryAggregate grouping and similarity', () {
    test('groups purchases of the same product with different receipt codes', () {
      final records = [
        PurchaseRecord(
          id: 'r1',
          marketId: 'm1',
          marketName: 'Mercado A',
          date: DateTime(2026, 10, 1),
          items: const [
            PurchaseHistoryItem(
              name: 'Melão Amarelo 4821',
              category: ProductCategory.hortifruti,
              price: 8.90,
            ),
          ],
        ),
        PurchaseRecord(
          id: 'r2',
          marketId: 'm2',
          marketName: 'Mercado B',
          date: DateTime(2026, 10, 15),
          items: const [
            PurchaseHistoryItem(
              name: 'Melão Amarelo',
              category: ProductCategory.hortifruti,
              price: 7.50,
            ),
          ],
        ),
        PurchaseRecord(
          id: 'r3',
          marketId: 'm1',
          marketName: 'Mercado A',
          date: DateTime(2026, 11, 1),
          items: const [
            PurchaseHistoryItem(
              name: 'MELAO AMARELO COD 9102',
              category: ProductCategory.hortifruti,
              price: 9.20,
            ),
          ],
        ),
      ];

      final aggregates = ProductHistoryAggregate.buildAllFromRecords(records);
      expect(aggregates.length, 1);
      expect(aggregates.first.normalizedKey, 'melao amarelo');
      expect(aggregates.first.displayName, 'Melão Amarelo');
      expect(aggregates.first.occurrences.length, 3);
      expect(aggregates.first.lastPrice, 9.20);
      expect(aggregates.first.previousPrice, 7.50);
    });

    test('findSimilarProducts returns related items first and supports fuzzy search', () {
      final records = [
        PurchaseRecord(
          id: 'r1',
          marketId: 'm1',
          marketName: 'Mercado A',
          date: DateTime(2026, 11, 1),
          items: const [
            PurchaseHistoryItem(
              name: 'Melão Amarelo 4821',
              category: ProductCategory.hortifruti,
              price: 8.90,
            ),
            PurchaseHistoryItem(
              name: 'Melão Espanhol',
              category: ProductCategory.hortifruti,
              price: 10.50,
            ),
            PurchaseHistoryItem(
              name: 'Melão Rei',
              category: ProductCategory.hortifruti,
              price: 9.90,
            ),
            PurchaseHistoryItem(
              name: 'Sabão em Pó Omo',
              category: ProductCategory.limpeza,
              price: 22.00,
            ),
          ],
        ),
      ];

      final aggregates = ProductHistoryAggregate.buildAllFromRecords(records);
      final target = aggregates.firstWhere(
        (a) => a.normalizedKey == 'melao amarelo',
      );
      final similar = ProductHistoryAggregate.findSimilarProducts(
        target,
        aggregates,
      );

      final similarKeys = similar.map((e) => e.product.normalizedKey).toList();
      expect(similarKeys, containsAll(['melao espanhol', 'melao rei']));
      expect(similarKeys, isNot(contains('sabao em po omo')));
      expect(target.matchesSearchQuery('melao'), isTrue);
      expect(target.matchesSearchQuery('sabao'), isFalse);
    });
  });

  group('CategoryClassifier Alimentos / Hortifruti / Congelados split', () {
    test('classifies hortifruti, congelados and alimentos into distinct categories', () {
      expect(CategoryClassifier.classify('Melão Amarelo'), ProductCategory.hortifruti);
      expect(CategoryClassifier.classify('Tomate Italiano'), ProductCategory.hortifruti);
      expect(CategoryClassifier.classify('Pizza Congelada'), ProductCategory.congelados);
      expect(CategoryClassifier.classify('Sorvete de Chocolate'), ProductCategory.congelados);
      expect(CategoryClassifier.classify('Arroz Tipo 1'), ProductCategory.alimentos);
    });
  });
}
