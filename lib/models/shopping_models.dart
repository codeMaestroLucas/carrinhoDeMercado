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
    this.isChecked = false,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  final String id;
  final String name;
  final ProductCategory category;
  final String? marketId;
  final double? price;
  final bool isChecked;
  final DateTime createdAt;

  ShoppingItem copyWith({
    String? id,
    String? name,
    ProductCategory? category,
    String? marketId,
    double? price,
    bool clearPrice = false,
    bool? isChecked,
    DateTime? createdAt,
  }) {
    return ShoppingItem(
      id: id ?? this.id,
      name: name ?? this.name,
      category: category ?? this.category,
      marketId: marketId ?? this.marketId,
      price: clearPrice ? null : (price ?? this.price),
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
  });

  final String name;
  final ProductCategory category;
  final double price;

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'category': category.id,
      'price': price,
    };
  }

  factory PurchaseHistoryItem.fromJson(Map<String, dynamic> json) {
    return PurchaseHistoryItem(
      name: json['name'] as String,
      category: ProductCategory.fromId(json['category'] as String?),
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
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
