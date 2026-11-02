import 'package:flutter/material.dart';

enum ProductCategory {
  alimentos(
    id: 'alimentos',
    label: 'Alimentos',
    icon: Icons.restaurant_outlined,
    color: Color(0xFF4CAF50),
  ),
  bebidas(
    id: 'bebidas',
    label: 'Bebidas',
    icon: Icons.local_drink_outlined,
    color: Color(0xFF42A5F5),
  ),
  limpeza(
    id: 'limpeza',
    label: 'Limpeza',
    icon: Icons.cleaning_services_outlined,
    color: Color(0xFF26A69A),
  ),
  perfumariaHigiene(
    id: 'perfumaria_higiene',
    label: 'Perfumaria e Higiene',
    icon: Icons.spa_outlined,
    color: Color(0xFFEC407A),
  ),
  bebeCrianca(
    id: 'bebe_crianca',
    label: 'Bebê e Criança',
    icon: Icons.child_friendly_outlined,
    color: Color(0xFFAB47BC),
  ),
  descartaveis(
    id: 'descartaveis',
    label: 'Descartáveis',
    icon: Icons.recycling_outlined,
    color: Color(0xFFFFA726),
  ),
  petShop(
    id: 'pet_shop',
    label: 'PetShop',
    icon: Icons.pets_outlined,
    color: Color(0xFF8D6E63),
  ),
  bazar(
    id: 'bazar',
    label: 'Bazar',
    icon: Icons.kitchen_outlined,
    color: Color(0xFF78909C),
  ),
  diversos(
    id: 'diversos',
    label: 'Diversos',
    icon: Icons.category_outlined,
    color: Color(0xFF90A4AE),
  );

  const ProductCategory({
    required this.id,
    required this.label,
    required this.icon,
    required this.color,
  });

  final String id;
  final String label;
  final IconData icon;
  final Color color;

  static ProductCategory fromId(String? id) {
    if (id == null) return ProductCategory.diversos;
    for (final category in ProductCategory.values) {
      if (category.id == id || category.name == id) {
        return category;
      }
    }
    return ProductCategory.diversos;
  }
}

class ShoppingItem {
  ShoppingItem({
    required this.id,
    required this.name,
    required this.category,
    this.marketId,
    this.price,
    this.quantity = 1,
    this.unit = 'un',
    this.isPriceTotal = false,
    this.isChecked = false,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  final String id;
  final String name;
  final ProductCategory category;
  final String? marketId;
  final double? price;
  final int quantity;
  final String unit; // 'un', 'kg', 'g', 'dz', 'cx', 'L'
  final bool isPriceTotal; // true: price is the total for all items; false: price is unit price (default)
  final bool isChecked;
  final DateTime createdAt;

  /// Effective total amount calculated for this item
  double get effectiveTotalAmount {
    if (price == null || price! <= 0) return 0.0;
    if (isPriceTotal) return price!;
    return price! * (quantity > 0 ? quantity : 1);
  }

  ShoppingItem copyWith({
    String? id,
    String? name,
    ProductCategory? category,
    String? marketId,
    double? price,
    bool clearPrice = false,
    int? quantity,
    String? unit,
    bool? isPriceTotal,
    bool? isChecked,
    DateTime? createdAt,
  }) {
    return ShoppingItem(
      id: id ?? this.id,
      name: name ?? this.name,
      category: category ?? this.category,
      marketId: marketId ?? this.marketId,
      price: clearPrice ? null : (price ?? this.price),
      quantity: quantity ?? this.quantity,
      unit: unit ?? this.unit,
      isPriceTotal: isPriceTotal ?? this.isPriceTotal,
      isChecked: isChecked ?? this.isChecked,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'category': category.id,
      'marketId': marketId,
      'price': price,
      'quantity': quantity,
      'unit': unit,
      'isPriceTotal': isPriceTotal,
      'isChecked': isChecked,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  factory ShoppingItem.fromJson(Map<String, dynamic> json) {
    return ShoppingItem(
      id: json['id'] as String,
      name: json['name'] as String,
      category: ProductCategory.fromId(json['category'] as String?),
      marketId: json['marketId'] as String?,
      price: (json['price'] as num?)?.toDouble(),
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      unit: (json['unit'] as String?)?.trim().isNotEmpty == true
          ? (json['unit'] as String).trim()
          : 'un',
      isPriceTotal: json['isPriceTotal'] as bool? ?? false,
      isChecked: json['isChecked'] as bool? ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

class MarketPriceRecommendation {
  const MarketPriceRecommendation({
    required this.market,
    required this.averagePrice,
    required this.lastPrice,
  });

  final MarketProfile market;
  final double averagePrice;
  final double lastPrice;
}

class MarketProfile {
  MarketProfile({
    required this.id,
    required this.name,
    required List<ProductCategory> categoryOrder,
  }) : categoryOrder = _normalizeCategoryOrder(categoryOrder);

  final String id;
  final String name;
  final List<ProductCategory> categoryOrder;

  static List<ProductCategory> _normalizeCategoryOrder(
    List<ProductCategory> order,
  ) {
    final result = <ProductCategory>[];
    for (final cat in order) {
      if (!result.contains(cat)) {
        result.add(cat);
      }
    }
    for (final cat in ProductCategory.values) {
      if (!result.contains(cat)) {
        result.add(cat);
      }
    }
    return result;
  }

  MarketProfile copyWith({
    String? id,
    String? name,
    List<ProductCategory>? categoryOrder,
  }) {
    return MarketProfile(
      id: id ?? this.id,
      name: name ?? this.name,
      categoryOrder: categoryOrder ?? this.categoryOrder,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'categoryOrder': categoryOrder.map((c) => c.id).toList(),
    };
  }

  factory MarketProfile.fromJson(Map<String, dynamic> json) {
    final rawList = (json['categoryOrder'] as List<dynamic>? ?? [])
        .whereType<String>()
        .map(ProductCategory.fromId)
        .toList();
    return MarketProfile(
      id: json['id'] as String,
      name: json['name'] as String,
      categoryOrder: rawList,
    );
  }
}

class PurchaseHistoryItem {
  const PurchaseHistoryItem({
    required this.name,
    required this.category,
    required this.price,
    this.quantity = 1.0,
    this.unit = 'un',
  });

  final String name;
  final ProductCategory category;
  final double price;
  final double quantity;
  final String unit;

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'category': category.id,
      'price': price,
      'quantity': quantity,
      'unit': unit,
    };
  }

  factory PurchaseHistoryItem.fromJson(Map<String, dynamic> json) {
    return PurchaseHistoryItem(
      name: json['name'] as String,
      category: ProductCategory.fromId(json['category'] as String?),
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      quantity: (json['quantity'] as num?)?.toDouble() ?? 1.0,
      unit: (json['unit'] as String?) ?? 'un',
    );
  }
}

class PurchaseRecord {
  const PurchaseRecord({
    required this.id,
    required this.marketId,
    required this.marketName,
    required this.date,
    required this.items,
  });

  final String id;
  final String marketId;
  final String marketName;
  final DateTime date;
  final List<PurchaseHistoryItem> items;

  double get totalAmount =>
      items.fold(0.0, (sum, item) => sum + item.price);

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'marketId': marketId,
      'marketName': marketName,
      'date': date.toIso8601String(),
      'items': items.map((e) => e.toJson()).toList(),
    };
  }

  factory PurchaseRecord.fromJson(Map<String, dynamic> json) {
    final itemsList = (json['items'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(PurchaseHistoryItem.fromJson)
        .toList();
    return PurchaseRecord(
      id: json['id'] as String,
      marketId: json['marketId'] as String? ?? 'default',
      marketName: json['marketName'] as String? ?? 'Mercado',
      date: DateTime.tryParse(json['date'] as String? ?? '') ?? DateTime.now(),
      items: itemsList,
    );
  }
}

enum PantryItemStatus {
  ok,
  low,
  expired,
}

class PantryItem {
  PantryItem({
    required this.id,
    required this.name,
    required this.category,
    this.quantity = 1.0,
    this.unit = 'un',
    this.estimatedDaysToConsume = 14,
    this.marketName,
    this.price,
    this.expiryDate,
    DateTime? addedAt,
  }) : addedAt = addedAt ?? DateTime.now();

  final String id;
  final String name;
  final ProductCategory category;
  final double quantity;
  final String unit;
  final int estimatedDaysToConsume;
  final String? marketName;
  final double? price;
  final DateTime? expiryDate;
  final DateTime addedAt;

  int get daysSinceAdded => DateTime.now().difference(addedAt).inDays;

  int get daysRemaining =>
      (estimatedDaysToConsume - daysSinceAdded).clamp(0, 999);

  bool get isExpired {
    if (expiryDate == null) return false;
    final now = DateTime.now();
    return expiryDate!.isBefore(DateTime(now.year, now.month, now.day));
  }

  bool get isNearExpiry {
    if (expiryDate == null) return false;
    final now = DateTime.now();
    final diff = expiryDate!.difference(now).inDays;
    return diff >= 0 && diff <= 3;
  }

  PantryItemStatus get status {
    if (isExpired) return PantryItemStatus.expired;
    if (quantity <= 0.25 || daysRemaining <= 2) return PantryItemStatus.low;
    return PantryItemStatus.ok;
  }

  PantryItem copyWith({
    String? id,
    String? name,
    ProductCategory? category,
    double? quantity,
    String? unit,
    int? estimatedDaysToConsume,
    String? marketName,
    double? price,
    DateTime? expiryDate,
    bool clearExpiry = false,
    DateTime? addedAt,
  }) {
    return PantryItem(
      id: id ?? this.id,
      name: name ?? this.name,
      category: category ?? this.category,
      quantity: quantity ?? this.quantity,
      unit: unit ?? this.unit,
      estimatedDaysToConsume:
          estimatedDaysToConsume ?? this.estimatedDaysToConsume,
      marketName: marketName ?? this.marketName,
      price: price ?? this.price,
      expiryDate: clearExpiry ? null : (expiryDate ?? this.expiryDate),
      addedAt: addedAt ?? this.addedAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'category': category.id,
      'quantity': quantity,
      'unit': unit,
      'estimatedDaysToConsume': estimatedDaysToConsume,
      'marketName': marketName,
      'price': price,
      'expiryDate': expiryDate?.toIso8601String(),
      'addedAt': addedAt.toIso8601String(),
    };
  }

  factory PantryItem.fromJson(Map<String, dynamic> json) {
    return PantryItem(
      id: json['id'] as String,
      name: json['name'] as String,
      category: ProductCategory.fromId(json['category'] as String?),
      quantity: (json['quantity'] as num?)?.toDouble() ?? 1.0,
      unit: (json['unit'] as String?)?.trim().isNotEmpty == true
          ? (json['unit'] as String).trim()
          : 'un',
      estimatedDaysToConsume:
          (json['estimatedDaysToConsume'] as num?)?.toInt() ?? 14,
      marketName: json['marketName'] as String?,
      price: (json['price'] as num?)?.toDouble(),
      expiryDate: json['expiryDate'] != null
          ? DateTime.tryParse(json['expiryDate'] as String)
          : null,
      addedAt: json['addedAt'] != null
          ? DateTime.tryParse(json['addedAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

enum RepurchaseUrgency {
  urgent, // Jogo rápido: já passou do ciclo estimado
  moderate, // Na janela: faltam poucos dias
  low, // Apenas sugestão
}

class ReplenishmentSuggestion {
  const ReplenishmentSuggestion({
    required this.productName,
    required this.category,
    required this.averageIntervalDays,
    required this.daysSinceLastPurchase,
    required this.lastPrice,
    required this.lastMarket,
    required this.urgency,
  });

  final String productName;
  final ProductCategory category;
  final int averageIntervalDays;
  final int daysSinceLastPurchase;
  final double lastPrice;
  final String lastMarket;
  final RepurchaseUrgency urgency;
}

class ProductVariationItem {
  const ProductVariationItem({
    required this.productName,
    required this.category,
    required this.currentPrice,
    required this.previousPrice,
    required this.variationPercent,
    required this.marketName,
  });

  final String productName;
  final ProductCategory category;
  final double currentPrice;
  final double previousPrice;
  final double variationPercent;
  final String marketName;
}

class PriceIndexSummary {
  const PriceIndexSummary({
    required this.periodLabel,
    required this.overallVariationPercent,
    required this.totalComparedItems,
    required this.increasedCount,
    required this.decreasedCount,
    required this.stableCount,
    required this.topIncreases,
    required this.topDecreases,
  });

  final String periodLabel;
  final double overallVariationPercent;
  final int totalComparedItems;
  final int increasedCount;
  final int decreasedCount;
  final int stableCount;
  final List<ProductVariationItem> topIncreases;
  final List<ProductVariationItem> topDecreases;
}

class CategorySpendingSummary {
  const CategorySpendingSummary({
    required this.category,
    required this.totalSpent,
    required this.percentage,
    required this.itemCount,
  });

  final ProductCategory category;
  final double totalSpent;
  final double percentage;
  final int itemCount;
}

class ProductHistoryOccurrence {
  const ProductHistoryOccurrence({
    required this.productName,
    required this.category,
    required this.price,
    required this.marketName,
    required this.date,
  });

  final String productName;
  final ProductCategory category;
  final double price;
  final String marketName;
  final DateTime date;
}

class MarketProductStats {
  const MarketProductStats({
    required this.marketName,
    required this.averagePrice,
    required this.lastPrice,
    required this.lastDate,
    required this.purchaseCount,
  });

  final String marketName;
  final double averagePrice;
  final double lastPrice;
  final DateTime lastDate;
  final int purchaseCount;
}


