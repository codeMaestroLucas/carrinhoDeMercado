import '../models/shopping_models.dart';
import 'category_classifier.dart';

class ProductHistoryAggregate {
  ProductHistoryAggregate({
    required this.normalizedKey,
    required this.displayName,
    required this.category,
    required List<ProductHistoryOccurrence> occurrences,
  }) : occurrences = List<ProductHistoryOccurrence>.from(occurrences)
          ..sort((a, b) => b.date.compareTo(a.date));

  final String normalizedKey;
  final String displayName;
  final ProductCategory category;

  /// Sorted from newest (index 0) to oldest
  final List<ProductHistoryOccurrence> occurrences;

  /// Occurrences that have a valid price > 0 (newest first)
  List<ProductHistoryOccurrence> get pricedOccurrences =>
      occurrences.where((e) => e.price > 0).toList();

  /// Chronological order (oldest to newest) for time-series chart
  List<ProductHistoryOccurrence> get chronologicalPricedOccurrences =>
      pricedOccurrences.reversed.toList();

  double get lastPrice =>
      pricedOccurrences.isNotEmpty ? pricedOccurrences.first.price : 0.0;

  String get lastMarket =>
      pricedOccurrences.isNotEmpty
          ? pricedOccurrences.first.marketName
          : occurrences.first.marketName;

  DateTime get lastDate =>
      pricedOccurrences.isNotEmpty
          ? pricedOccurrences.first.date
          : occurrences.first.date;

  /// Percentage variation comparing the latest price against the immediately previous purchase price.
  double? get variationPercentFromLastTime {
    final priced = pricedOccurrences;
    if (priced.length < 2) return null;
    final latest = priced[0].price;
    final previous = priced[1].price;
    if (previous <= 0) return null;
    return ((latest - previous) / previous) * 100.0;
  }

  double? get previousPrice {
    final priced = pricedOccurrences;
    if (priced.length < 2) return null;
    return priced[1].price;
  }

  double get averagePrice {
    final priced = pricedOccurrences;
    if (priced.isEmpty) return 0.0;
    final sum = priced.fold<double>(0.0, (acc, item) => acc + item.price);
    return sum / priced.length;
  }

  ProductHistoryOccurrence? get minPriceOccurrence {
    final priced = pricedOccurrences;
    if (priced.isEmpty) return null;
    return priced.reduce((a, b) => a.price <= b.price ? a : b);
  }

  ProductHistoryOccurrence? get maxPriceOccurrence {
    final priced = pricedOccurrences;
    if (priced.isEmpty) return null;
    return priced.reduce((a, b) => a.price >= b.price ? a : b);
  }

  /// Markets ranked from cheapest average price to most expensive
  List<MarketProductStats> get marketRanking {
    final byMarket = <String, List<ProductHistoryOccurrence>>{};
    for (final occ in pricedOccurrences) {
      byMarket.putIfAbsent(occ.marketName, () => []).add(occ);
    }

    final stats = byMarket.entries.map((entry) {
      final list = entry.value..sort((a, b) => b.date.compareTo(a.date));
      final avg =
          list.fold<double>(0.0, (s, e) => s + e.price) / list.length;
      return MarketProductStats(
        marketName: entry.key,
        averagePrice: avg,
        lastPrice: list.first.price,
        lastDate: list.first.date,
        purchaseCount: list.length,
      );
    }).toList();

    stats.sort((a, b) => a.averagePrice.compareTo(b.averagePrice));
    return stats;
  }

  /// Insight comparing the cheapest market with the most expensive / second market
  String? get marketComparisonInsight {
    final ranking = marketRanking;
    if (ranking.length < 2) return null;
    final cheapest = ranking.first;
    final compared = ranking.last;
    if (compared.averagePrice <= 0) return null;
    final diffPercent =
        ((compared.averagePrice - cheapest.averagePrice) /
                compared.averagePrice) *
            100.0;
    if (diffPercent < 0.5) {
      return '${cheapest.marketName} e ${compared.marketName} têm preços médios praticamente iguais para este item.';
    }
    return '${cheapest.marketName} é ${diffPercent.toStringAsFixed(0)}% mais barato para este item que ${compared.marketName}.';
  }

  /// Builds a sorted list of all unique product aggregates across the given purchase records.
  static List<ProductHistoryAggregate> buildAllFromRecords(
    List<PurchaseRecord> records,
  ) {
    final grouped = <String, List<ProductHistoryOccurrence>>{};
    final displayNames = <String, String>{};
    final categories = <String, ProductCategory>{};

    for (final record in records) {
      for (final item in record.items) {
        final key = CategoryClassifier.normalize(item.name);
        if (key.isEmpty) continue;
        displayNames.putIfAbsent(key, () => item.name);
        categories.putIfAbsent(key, () => item.category);
        grouped.putIfAbsent(key, () => []).add(
              ProductHistoryOccurrence(
                productName: item.name,
                category: item.category,
                price: item.price,
                marketName: record.marketName,
                date: record.date,
              ),
            );
      }
    }

    final list = grouped.entries.map((entry) {
      return ProductHistoryAggregate(
        normalizedKey: entry.key,
        displayName: displayNames[entry.key]!,
        category: categories[entry.key]!,
        occurrences: entry.value,
      );
    }).toList();

    list.sort(
      (a, b) => a.displayName.toLowerCase().compareTo(
            b.displayName.toLowerCase(),
          ),
    );
    return list;
  }
}
