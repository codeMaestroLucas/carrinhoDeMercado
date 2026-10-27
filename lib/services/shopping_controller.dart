import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import '../models/shopping_models.dart';
import 'category_classifier.dart';
import 'cloud_sync_service.dart';

class PasteListResult {
  const PasteListResult({
    required this.addedCount,
    required this.skippedDuplicatesCount,
  });

  final int addedCount;
  final int skippedDuplicatesCount;
}

class ShoppingController extends ChangeNotifier {
  ShoppingController({this.enablePersistence = true}) {
    _initializeDefaultData();
    if (enablePersistence) {
      loadFromDisk();
    }
  }

  final bool enablePersistence;
  final String _clientId =
      'client_${DateTime.now().microsecondsSinceEpoch}';

  List<ShoppingItem> _items = [];
  List<MarketProfile> _markets = [];
  String _selectedMarketId = 'mercado_padrao';
  bool _filterBySelectedMarket = false;
  List<PurchaseRecord> _history = [];
  Map<String, ProductCategory> _learnedCategories = {};
  Map<ProductCategory, List<String>> _categoryDictionary = {};

  ProductCategory? _categoryFilter;
  bool _showCheckedItems = true;

  String? _sharedSpaceCode;
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>?
      _cloudSubscription;
  bool _isApplyingRemoteUpdate = false;

  List<ShoppingItem> get allItems => List.unmodifiable(_items);
  List<MarketProfile> get markets => List.unmodifiable(_markets);
  List<PurchaseRecord> get history => List.unmodifiable(_history);
  ProductCategory? get categoryFilter => _categoryFilter;
  bool get showCheckedItems => _showCheckedItems;
  bool get filterBySelectedMarket => _filterBySelectedMarket;
  Map<String, ProductCategory> get learnedCategories =>
      Map.unmodifiable(_learnedCategories);
  String? get sharedSpaceCode => _sharedSpaceCode;
  bool get isCloudConnected =>
      _sharedSpaceCode != null && _sharedSpaceCode!.isNotEmpty;

  List<String> keywordsForCategory(ProductCategory category) {
    final list = _categoryDictionary[category] ?? const [];
    return List.unmodifiable(list);
  }

  MarketProfile get selectedMarket {
    for (final market in _markets) {
      if (market.id == _selectedMarketId) {
        return market;
      }
    }
    return _markets.first;
  }

  MarketProfile marketById(String? marketId) {
    if (marketId == null) return selectedMarket;
    for (final m in _markets) {
      if (m.id == marketId) return m;
    }
    return selectedMarket;
  }

  int itemCountForMarket(String marketId) {
    return _items.where((item) {
      final itemMarketId = item.marketId ?? _selectedMarketId;
      return itemMarketId == marketId;
    }).length;
  }

  void setFilterBySelectedMarket(bool value, {String? marketId}) {
    _filterBySelectedMarket = value;
    if (marketId != null && _markets.any((m) => m.id == marketId)) {
      _selectedMarketId = marketId;
    }
    notifyListeners();
  }

  /// Returns historical price recommendations per market for a given product name,
  /// sorted from the cheapest average price to the most expensive.
  List<MarketPriceRecommendation> marketRecommendationsForProduct(
    String itemName,
  ) {
    final normalized = CategoryClassifier.normalize(itemName);
    if (normalized.isEmpty) return const [];

    final pricesByMarketId = <String, List<double>>{};
    final marketNameFallback = <String, String>{};

    for (final record in _history) {
      for (final item in record.items) {
        if (item.price <= 0) continue;
        if (CategoryClassifier.normalize(item.name) == normalized) {
          // Match by marketId or marketName
          MarketProfile? matchedMarket;
          for (final m in _markets) {
            if (m.id == record.marketId ||
                CategoryClassifier.normalize(m.name) ==
                    CategoryClassifier.normalize(record.marketName)) {
              matchedMarket = m;
              break;
            }
          }
          final key = matchedMarket?.id ?? record.marketId;
          marketNameFallback[key] = matchedMarket?.name ?? record.marketName;
          pricesByMarketId.putIfAbsent(key, () => []).add(item.price);
        }
      }
    }

    if (pricesByMarketId.isEmpty) return const [];

    final recommendations = <MarketPriceRecommendation>[];
    for (final entry in pricesByMarketId.entries) {
      final prices = entry.value;
      final avg = prices.fold<double>(0.0, (a, b) => a + b) / prices.length;
      final last = prices.first; // _history is ordered newest first

      final market = _markets.firstWhere(
        (m) => m.id == entry.key,
        orElse: () => MarketProfile(
          id: entry.key,
          name: marketNameFallback[entry.key] ?? 'Mercado',
          categoryOrder: ProductCategory.values,
        ),
      );

      recommendations.add(
        MarketPriceRecommendation(
          market: market,
          averagePrice: avg,
          lastPrice: last,
        ),
      );
    }

    recommendations.sort((a, b) => a.averagePrice.compareTo(b.averagePrice));
    return recommendations;
  }

  /// Returns the single best (cheapest) market recommendation for a product based on history.
  MarketPriceRecommendation? recommendCheapestMarketForProduct(String itemName) {
    final recs = marketRecommendationsForProduct(itemName);
    if (recs.isEmpty) return null;
    return recs.first;
  }

  /// Returns the shopping items filtered by the active filter settings and sorted
  /// according to the selected market's category order.
  List<ShoppingItem> get filteredAndSortedItems {
    final categoryOrder = selectedMarket.categoryOrder;
    final orderIndexMap = <ProductCategory, int>{
      for (var i = 0; i < categoryOrder.length; i++) categoryOrder[i]: i,
    };

    final filtered = _items.where((item) {
      if (_filterBySelectedMarket) {
        final itemMarketId = item.marketId ?? _selectedMarketId;
        if (itemMarketId != _selectedMarketId) {
          return false;
        }
      }
      if (!_showCheckedItems && item.isChecked) {
        return false;
      }
      if (_categoryFilter != null && item.category != _categoryFilter) {
        return false;
      }
      return true;
    }).toList();

    filtered.sort((a, b) {
      final catIndexA = orderIndexMap[a.category] ?? 999;
      final catIndexB = orderIndexMap[b.category] ?? 999;
      if (catIndexA != catIndexB) {
        return catIndexA.compareTo(catIndexB);
      }
      if (a.isChecked != b.isChecked) {
        return a.isChecked ? 1 : -1;
      }
      return a.name.toLowerCase().compareTo(b.name.toLowerCase());
    });

    return filtered;
  }

  int get totalItemsCount => _items.length;
  int get checkedItemsCount => _items.where((e) => e.isChecked).length;
  int get pendingItemsCount => _items.where((e) => !e.isChecked).length;

  double get totalEstimatedAmount =>
      _items.fold(0.0, (acc, item) => acc + (item.price ?? 0.0));

  double get checkedTotalAmount => _items
      .where((e) => e.isChecked)
      .fold(0.0, (acc, item) => acc + (item.price ?? 0.0));

  int countForCategory(ProductCategory category) {
    return _items.where((item) {
      if (_filterBySelectedMarket &&
          (item.marketId ?? _selectedMarketId) != _selectedMarketId) {
        return false;
      }
      if (!_showCheckedItems && item.isChecked) return false;
      return item.category == category;
    }).length;
  }

  void _initializeDefaultData() {
    _categoryDictionary = CategoryClassifier.cloneDefaultDictionary();
    _markets = [
      MarketProfile(
        id: 'mercado_padrao',
        name: 'Supermercado Padrão',
        categoryOrder: ProductCategory.values,
      ),
      MarketProfile(
        id: 'atacadao',
        name: 'Atacadão',
        categoryOrder: [
          ProductCategory.limpeza,
          ProductCategory.descartaveis,
          ProductCategory.perfumariaHigiene,
          ProductCategory.bebidas,
          ProductCategory.alimentos,
          ProductCategory.bebeCrianca,
          ProductCategory.petShop,
          ProductCategory.bazar,
          ProductCategory.diversos,
        ],
      ),
      MarketProfile(
        id: 'mercado_bairro',
        name: 'Mercado do Bairro',
        categoryOrder: [
          ProductCategory.alimentos,
          ProductCategory.bebidas,
          ProductCategory.perfumariaHigiene,
          ProductCategory.limpeza,
          ProductCategory.bebeCrianca,
          ProductCategory.descartaveis,
          ProductCategory.petShop,
          ProductCategory.bazar,
          ProductCategory.diversos,
        ],
      ),
    ];
    _selectedMarketId = _markets.first.id;
  }

  void setCategoryFilter(ProductCategory? category) {
    _categoryFilter = category;
    notifyListeners();
  }

  void setShowCheckedItems(bool value) {
    _showCheckedItems = value;
    notifyListeners();
  }

  ProductCategory predictCategory(String name) {
    return CategoryClassifier.classify(
      name,
      customMemory: _learnedCategories,
      customDictionary: _categoryDictionary,
    );
  }

  /// Checks if an item with the same normalized name (ignoring accents/case) already exists.
  bool isDuplicateItemName(String name, {String? excludeItemId}) {
    final normalizedTarget = CategoryClassifier.normalize(name);
    if (normalizedTarget.isEmpty) return false;

    for (final existing in _items) {
      if (excludeItemId != null && existing.id == excludeItemId) continue;
      if (CategoryClassifier.normalize(existing.name) == normalizedTarget) {
        return true;
      }
    }
    return false;
  }

  /// Finds the last price paid for this product in history, if any.
  double? findLastHistoricalPrice(String itemName, {String? marketId}) {
    final normalized = CategoryClassifier.normalize(itemName);
    if (normalized.isEmpty) return null;
    if (marketId != null) {
      for (final record in _history) {
        if (record.marketId != marketId) continue;
        for (final item in record.items) {
          if (CategoryClassifier.normalize(item.name) == normalized &&
              item.price > 0) {
            return item.price;
          }
        }
      }
    }
    for (final record in _history) {
      for (final item in record.items) {
        if (CategoryClassifier.normalize(item.name) == normalized &&
            item.price > 0) {
          return item.price;
        }
      }
    }
    return null;
  }

  /// Adds a single item to the list. Automatically assigns the cheapest historical market
  /// unless a specific marketId is provided. Returns null if the item is a duplicate.
  ShoppingItem? addSingleItem(
    String name, {
    ProductCategory? category,
    String? marketId,
    double? price,
  }) {
    final cleanName = name.trim();
    if (cleanName.isEmpty) return null;
    if (isDuplicateItemName(cleanName)) {
      return null;
    }

    final formattedName = cleanName[0].toUpperCase() + cleanName.substring(1);
    final assignedCategory = category ?? predictCategory(formattedName);
    if (category != null) {
      _learnedCategories[CategoryClassifier.normalize(formattedName)] = category;
    }

    final bestMarketRec = recommendCheapestMarketForProduct(formattedName);
    final assignedMarketId =
        marketId ?? bestMarketRec?.market.id ?? _selectedMarketId;

    final item = ShoppingItem(
      id: '${DateTime.now().microsecondsSinceEpoch}_${_items.length}',
      name: formattedName,
      category: assignedCategory,
      marketId: assignedMarketId,
      price: price,
    );
    _items.add(item);
    _saveToDisk();
    notifyListeners();
    return item;
  }

  PasteListResult addItemsFromPastedTextWithReport(
    String rawText, {
    String? overrideMarketId,
  }) {
    final rawSegments = rawText.split(RegExp(r'[\r\n;]+'));
    final candidateSegments =
        (rawSegments.length == 1 && rawText.contains(','))
            ? rawText.split(',')
            : rawSegments;

    final prefixRegex = RegExp(
      r'^(\s*[-*•◦▪▫▸▹▻✓✔✗✘☐☑☒]\s*|\s*\[[ xX]?\]\s*|\s*\d+[\.\)\-]\s*)+',
    );

    var addedCount = 0;
    var skippedDuplicatesCount = 0;
    final now = DateTime.now().microsecondsSinceEpoch;

    for (var i = 0; i < candidateSegments.length; i++) {
      var cleaned = candidateSegments[i].replaceFirst(prefixRegex, '').trim();
      if (cleaned.isEmpty) continue;

      if (isDuplicateItemName(cleaned)) {
        skippedDuplicatesCount++;
        continue;
      }

      cleaned = cleaned[0].toUpperCase() + cleaned.substring(1);
      final category = predictCategory(cleaned);
      final bestMarketRec = recommendCheapestMarketForProduct(cleaned);
      final assignedMarketId =
          overrideMarketId ?? bestMarketRec?.market.id ?? _selectedMarketId;

      _items.add(
        ShoppingItem(
          id: '${now}_${_items.length}_$i',
          name: cleaned,
          category: category,
          marketId: assignedMarketId,
        ),
      );
      addedCount++;
    }

    if (addedCount > 0) {
      _saveToDisk();
      notifyListeners();
    }
    return PasteListResult(
      addedCount: addedCount,
      skippedDuplicatesCount: skippedDuplicatesCount,
    );
  }

  int addItemsFromPastedText(String rawText) {
    return addItemsFromPastedTextWithReport(rawText).addedCount;
  }

  void toggleItemChecked(String id) {
    final index = _items.indexWhere((e) => e.id == id);
    if (index == -1) return;
    final current = _items[index];
    _items[index] = current.copyWith(isChecked: !current.isChecked);
    _saveToDisk();
    notifyListeners();
  }

  bool updateItem(
    String id, {
    String? name,
    ProductCategory? category,
    String? marketId,
    double? price,
    bool clearPrice = false,
  }) {
    final index = _items.indexWhere((e) => e.id == id);
    if (index == -1) return false;
    final current = _items[index];
    final updatedName =
        name?.trim().isNotEmpty == true ? name!.trim() : current.name;

    if (isDuplicateItemName(updatedName, excludeItemId: id)) {
      return false;
    }

    final updatedCategory = category ?? current.category;

    if (category != null) {
      _learnedCategories[CategoryClassifier.normalize(updatedName)] =
          updatedCategory;
    }

    _items[index] = current.copyWith(
      name: updatedName,
      category: updatedCategory,
      marketId: marketId ?? current.marketId,
      price: price,
      clearPrice: clearPrice,
    );
    _saveToDisk();
    notifyListeners();
    return true;
  }

  void removeItem(String id) {
    _items.removeWhere((e) => e.id == id);
    _saveToDisk();
    notifyListeners();
  }

  void clearCheckedItems() {
    _items.removeWhere((e) => e.isChecked);
    _saveToDisk();
    notifyListeners();
  }

  void clearAllItems() {
    _items.clear();
    _saveToDisk();
    notifyListeners();
  }

  bool addKeywordToCategory(ProductCategory category, String rawKeyword) {
    final clean = rawKeyword.trim().toLowerCase();
    final normalizedNew = CategoryClassifier.normalize(clean);
    if (normalizedNew.isEmpty) return false;

    for (final cat in ProductCategory.values) {
      final list = _categoryDictionary[cat] ?? [];
      list.removeWhere(
        (existing) => CategoryClassifier.normalize(existing) == normalizedNew,
      );
      _categoryDictionary[cat] = list;
    }

    final targetList = List<String>.from(_categoryDictionary[category] ?? []);
    targetList.insert(0, clean);
    _categoryDictionary[category] = targetList;
    _learnedCategories[normalizedNew] = category;

    for (var i = 0; i < _items.length; i++) {
      final item = _items[i];
      if (CategoryClassifier.normalize(item.name) == normalizedNew) {
        _items[i] = item.copyWith(category: category);
      }
    }

    _saveToDisk();
    notifyListeners();
    return true;
  }

  void removeKeywordFromCategory(ProductCategory category, String keyword) {
    final normalizedTarget = CategoryClassifier.normalize(keyword);
    final list = List<String>.from(_categoryDictionary[category] ?? []);
    list.removeWhere(
      (item) => CategoryClassifier.normalize(item) == normalizedTarget,
    );
    _categoryDictionary[category] = list;
    _learnedCategories.remove(normalizedTarget);
    _saveToDisk();
    notifyListeners();
  }

  bool editKeywordInCategory(
    ProductCategory category,
    String oldKeyword,
    String newKeyword,
  ) {
    final cleanNew = newKeyword.trim().toLowerCase();
    final normalizedNew = CategoryClassifier.normalize(cleanNew);
    final normalizedOld = CategoryClassifier.normalize(oldKeyword);
    if (normalizedNew.isEmpty) return false;

    final list = List<String>.from(_categoryDictionary[category] ?? []);
    final index = list.indexWhere(
      (item) => CategoryClassifier.normalize(item) == normalizedOld,
    );
    if (index == -1) return false;

    final duplicateIndex = list.indexWhere(
      (item) => CategoryClassifier.normalize(item) == normalizedNew,
    );
    if (duplicateIndex != -1 && duplicateIndex != index) {
      return false;
    }

    list[index] = cleanNew;
    _categoryDictionary[category] = list;
    _learnedCategories.remove(normalizedOld);
    _learnedCategories[normalizedNew] = category;
    _saveToDisk();
    notifyListeners();
    return true;
  }

  void resetCategoryDictionary({ProductCategory? onlyCategory}) {
    final defaults = CategoryClassifier.cloneDefaultDictionary();
    if (onlyCategory != null) {
      _categoryDictionary[onlyCategory] = defaults[onlyCategory] ?? [];
    } else {
      _categoryDictionary = defaults;
      _learnedCategories.clear();
    }
    _saveToDisk();
    notifyListeners();
  }

  PurchaseRecord? finishPurchase({
    String? marketId,
    DateTime? date,
    bool onlyChecked = true,
  }) {
    final itemsToSave = onlyChecked
        ? _items.where((e) => e.isChecked).toList()
        : List<ShoppingItem>.from(_items);

    if (itemsToSave.isEmpty) return null;

    final targetMarket = _markets.firstWhere(
      (m) => m.id == (marketId ?? _selectedMarketId),
      orElse: () => selectedMarket,
    );

    final record = PurchaseRecord(
      id: 'purchase_${DateTime.now().microsecondsSinceEpoch}',
      marketId: targetMarket.id,
      marketName: targetMarket.name,
      date: date ?? DateTime.now(),
      items: itemsToSave
          .map(
            (e) => PurchaseHistoryItem(
              name: e.name,
              category: e.category,
              price: e.price ?? 0.0,
            ),
          )
          .toList(),
    );

    _history.insert(0, record);

    if (onlyChecked) {
      _items.removeWhere((e) => e.isChecked);
    } else {
      _items.clear();
    }

    _saveToDisk();
    notifyListeners();
    return record;
  }

  PurchaseRecord? addPurchaseFromItems({
    required String marketId,
    required List<PurchaseHistoryItem> items,
    DateTime? date,
  }) {
    if (items.isEmpty) return null;

    final targetMarket = _markets.firstWhere(
      (m) => m.id == marketId,
      orElse: () => selectedMarket,
    );

    final record = PurchaseRecord(
      id: 'purchase_${DateTime.now().microsecondsSinceEpoch}',
      marketId: targetMarket.id,
      marketName: targetMarket.name,
      date: date ?? DateTime.now(),
      items: items,
    );

    _history.insert(0, record);
    _saveToDisk();
    notifyListeners();
    return record;
  }

  void deletePurchaseRecord(String recordId) {
    _history.removeWhere((r) => r.id == recordId);
    _saveToDisk();
    notifyListeners();
  }

  void selectMarket(String marketId) {
    if (_markets.any((m) => m.id == marketId)) {
      _selectedMarketId = marketId;
      _saveToDisk();
      notifyListeners();
    }
  }

  MarketProfile addMarket(String name, {List<ProductCategory>? initialOrder}) {
    final cleanName = name.trim();
    final market = MarketProfile(
      id: 'market_${DateTime.now().microsecondsSinceEpoch}',
      name: cleanName,
      categoryOrder: initialOrder ?? List.from(selectedMarket.categoryOrder),
    );
    _markets.add(market);
    _selectedMarketId = market.id;
    _saveToDisk();
    notifyListeners();
    return market;
  }

  void renameMarket(String marketId, String newName) {
    final index = _markets.indexWhere((m) => m.id == marketId);
    if (index == -1 || newName.trim().isEmpty) return;
    _markets[index] = _markets[index].copyWith(name: newName.trim());
    _saveToDisk();
    notifyListeners();
  }

  bool deleteMarket(String marketId) {
    if (_markets.length <= 1) return false;
    _markets.removeWhere((m) => m.id == marketId);
    if (_selectedMarketId == marketId) {
      _selectedMarketId = _markets.first.id;
    }
    for (var i = 0; i < _items.length; i++) {
      if (_items[i].marketId == marketId) {
        _items[i] = _items[i].copyWith(marketId: _selectedMarketId);
      }
    }
    _saveToDisk();
    notifyListeners();
    return true;
  }

  void moveMarketCategory(String marketId, int oldIndex, int newIndex) {
    final marketIndex = _markets.indexWhere((m) => m.id == marketId);
    if (marketIndex == -1) return;

    final order =
        List<ProductCategory>.from(_markets[marketIndex].categoryOrder);
    if (oldIndex < 0 ||
        oldIndex >= order.length ||
        newIndex < 0 ||
        newIndex >= order.length) {
      return;
    }
    final moved = order.removeAt(oldIndex);
    order.insert(newIndex, moved);

    _markets[marketIndex] =
        _markets[marketIndex].copyWith(categoryOrder: order);
    _saveToDisk();
    notifyListeners();
  }

  // Cloud Sync (Firebase Firestore) Methods
  Future<void> initializeCloudSync() async {
    if (!enablePersistence) return;
    final ready = await CloudSyncService.initializeFirebase();
    if (ready && _sharedSpaceCode != null && _sharedSpaceCode!.isNotEmpty) {
      _startCloudListener(_sharedSpaceCode!);
    }
    notifyListeners();
  }

  Future<String> createNewSharedSpace() async {
    final code = CloudSyncService.generateSpaceCode();
    await CloudSyncService.pushStateToSharedSpace(
      spaceCode: code,
      stateMap: _buildStateMap(),
      clientId: _clientId,
      verifyServer: true,
    );
    _sharedSpaceCode = code;
    _startCloudListener(code);
    await _saveToDisk(pushCloud: false);
    notifyListeners();
    return code;
  }

  Future<void> joinExistingSharedSpace(String rawCode) async {
    final code = CloudSyncService.normalizeSpaceCode(rawCode);
    if (code.isEmpty) {
      throw Exception('Informe um código válido.');
    }

    final existingData = await CloudSyncService.fetchSharedSpace(code);
    if (existingData != null) {
      _applyStateFromMap(existingData);
    } else {
      await CloudSyncService.pushStateToSharedSpace(
        spaceCode: code,
        stateMap: _buildStateMap(),
        clientId: _clientId,
      );
    }

    _sharedSpaceCode = code;
    _startCloudListener(code);
    await _saveToDisk(pushCloud: false);
    notifyListeners();
  }

  Future<void> disconnectSharedSpace() async {
    await _cloudSubscription?.cancel();
    _cloudSubscription = null;
    _sharedSpaceCode = null;
    await _saveToDisk(pushCloud: false);
    notifyListeners();
  }

  void _startCloudListener(String spaceCode) {
    _cloudSubscription?.cancel();
    if (!CloudSyncService.isFirebaseReady) return;

    _cloudSubscription = CloudSyncService.listenToSharedSpace(
      spaceCode: spaceCode,
      onData: (data) {
        // Ignore echo updates originated from this same client instance
        if (data['updatedByClientId'] == _clientId) {
          return;
        }
        _isApplyingRemoteUpdate = true;
        try {
          _applyStateFromMap(data);
          _saveToDisk(pushCloud: false);
          notifyListeners();
        } finally {
          _isApplyingRemoteUpdate = false;
        }
      },
    );
  }

  Map<String, dynamic> _buildStateMap() {
    return {
      'items': _items.map((e) => e.toJson()).toList(),
      'markets': _markets.map((m) => m.toJson()).toList(),
      'selectedMarketId': _selectedMarketId,
      'history': _history.map((h) => h.toJson()).toList(),
      'learnedCategories': {
        for (final entry in _learnedCategories.entries)
          entry.key: entry.value.id,
      },
      'categoryDictionary': {
        for (final entry in _categoryDictionary.entries)
          entry.key.id: entry.value,
      },
      'showCheckedItems': _showCheckedItems,
    };
  }

  void _applyStateFromMap(Map<String, dynamic> data) {
    if (data['items'] is List) {
      final loaded = (data['items'] as List)
          .whereType<Map<String, dynamic>>()
          .map(ShoppingItem.fromJson)
          .toList();
      final seen = <String>{};
      _items = loaded
          .where((item) => seen.add(CategoryClassifier.normalize(item.name)))
          .toList();
    }

    if (data['markets'] is List) {
      final loadedMarkets = (data['markets'] as List)
          .whereType<Map<String, dynamic>>()
          .map(MarketProfile.fromJson)
          .toList();
      if (loadedMarkets.isNotEmpty) {
        _markets = loadedMarkets;
      }
    }

    if (data['selectedMarketId'] is String) {
      final id = data['selectedMarketId'] as String;
      if (_markets.any((m) => m.id == id)) {
        _selectedMarketId = id;
      }
    }

    if (data['history'] is List) {
      _history = (data['history'] as List)
          .whereType<Map<String, dynamic>>()
          .map(PurchaseRecord.fromJson)
          .toList();
    }

    if (data['learnedCategories'] is Map) {
      final rawMap = data['learnedCategories'] as Map<String, dynamic>;
      _learnedCategories = {
        for (final entry in rawMap.entries)
          if (entry.value is String)
            entry.key: ProductCategory.fromId(entry.value as String),
      };
    }

    if (data['categoryDictionary'] is Map) {
      final rawDict = data['categoryDictionary'] as Map<String, dynamic>;
      for (final entry in rawDict.entries) {
        final cat = ProductCategory.fromId(entry.key);
        if (entry.value is List) {
          _categoryDictionary[cat] =
              (entry.value as List).whereType<String>().toList();
        }
      }
    }

    if (data['showCheckedItems'] is bool) {
      _showCheckedItems = data['showCheckedItems'] as bool;
    }
  }

  File? _resolveStorageFile() {
    if (kIsWeb) return null;
    try {
      final parentDir = Directory.systemTemp.parent;
      for (final subDirName in ['Documents', 'files', 'app_flutter']) {
        final candidateDir = Directory('${parentDir.path}/$subDirName');
        if (candidateDir.existsSync()) {
          return File('${candidateDir.path}/carrinho_compras_state_v1.json');
        }
      }
      return File('${Directory.systemTemp.path}/carrinho_compras_state_v1.json');
    } catch (_) {
      return null;
    }
  }

  Future<void> loadFromDisk() async {
    if (!enablePersistence) return;
    try {
      final file = _resolveStorageFile();
      if (file == null || !await file.exists()) return;

      final content = await file.readAsString();
      if (content.trim().isEmpty) return;

      final data = jsonDecode(content) as Map<String, dynamic>;
      _applyStateFromMap(data);

      if (data['sharedSpaceCode'] is String) {
        final savedCode = (data['sharedSpaceCode'] as String).trim();
        if (savedCode.isNotEmpty) {
          _sharedSpaceCode = savedCode;
          if (CloudSyncService.isFirebaseReady) {
            _startCloudListener(savedCode);
          }
        }
      }

      notifyListeners();
    } catch (_) {
      // Ignore corrupted state
    }
  }

  Future<void> _saveToDisk({bool pushCloud = true}) async {
    if (!enablePersistence) return;
    try {
      final stateMap = _buildStateMap();
      final file = _resolveStorageFile();
      if (file != null) {
        final payload = jsonEncode({
          ...stateMap,
          'sharedSpaceCode': _sharedSpaceCode,
        });
        await file.writeAsString(payload);
      }

      if (pushCloud &&
          !_isApplyingRemoteUpdate &&
          _sharedSpaceCode != null &&
          _sharedSpaceCode!.isNotEmpty &&
          CloudSyncService.isFirebaseReady) {
        await CloudSyncService.pushStateToSharedSpace(
          spaceCode: _sharedSpaceCode!,
          stateMap: stateMap,
          clientId: _clientId,
        );
      }
    } catch (_) {
      // Ignore file system / network errors
    }
  }

  @override
  void dispose() {
    _cloudSubscription?.cancel();
    super.dispose();
  }
}
