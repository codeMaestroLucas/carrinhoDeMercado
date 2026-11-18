import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:home_widget/home_widget.dart';
import '../models/shopping_models.dart';

class HomeWidgetService {
  static const String appGroupId = 'group.com.lucasrajao.carrinhoDecompras';
  static const String androidWidgetProvider = 'ShoppingListWidgetProvider';
  static const String iOSWidgetName = 'ShoppingListWidget';
  static const String syncChannelName = 'com.lucasrajao.carrinhoDecompras/widget_sync';

  static const MethodChannel _syncChannel = MethodChannel(syncChannelName);
  static final List<void Function()> _syncListeners = [];
  static bool _syncChannelConfigured = false;
  static bool _initialized = false;

  /// Registra listener que dispara no exato instante em que o widget nativo altera dados
  static void registerWidgetSyncListener(void Function() listener) {
    if (!_syncListeners.contains(listener)) {
      _syncListeners.add(listener);
    }
    if (!_syncChannelConfigured) {
      _syncChannelConfigured = true;
      _syncChannel.setMethodCallHandler((call) async {
        if (call.method == 'onWidgetDataChanged') {
          for (final callback in List.of(_syncListeners)) {
            try {
              callback();
            } catch (_) {}
          }
        }
      });
    }
  }

  /// Remove listener registrado
  static void unregisterWidgetSyncListener(void Function() listener) {
    _syncListeners.remove(listener);
  }

  /// Inicializa o HomeWidget
  static Future<void> initialize() async {
    if (_initialized) return;
    try {
      await HomeWidget.setAppGroupId(appGroupId);
      _initialized = true;
    } catch (_) {}
  }

  /// Sincroniza a lista atual de compras e o tema com o Widget da tela inicial
  static Future<void> updateHomeWidget(
    List<ShoppingItem> items, {
    bool isDarkMode = false,
  }) async {
    try {
      await initialize();

      // Organiza os itens para exibição prioritária no widget: pendentes primeiro, checados por último
      final sortedItems = List<ShoppingItem>.from(items)
        ..sort((a, b) {
          if (a.isChecked != b.isChecked) {
            return a.isChecked ? 1 : -1;
          }
          return a.name.toLowerCase().compareTo(b.name.toLowerCase());
        });

      final pendingCount = sortedItems.where((i) => !i.isChecked).length;
      final checkedCount = sortedItems.where((i) => i.isChecked).length;

      await HomeWidget.saveWidgetData<int>('total_items', sortedItems.length);
      await HomeWidget.saveWidgetData<int>('pending_count', pendingCount);
      await HomeWidget.saveWidgetData<int>('checked_count', checkedCount);
      await HomeWidget.saveWidgetData<bool>('is_dark_mode', isDarkMode);

      final simpleItems = sortedItems.map((i) => i.toJson()).toList();

      await HomeWidget.saveWidgetData<String>(
        'shopping_items_json',
        jsonEncode(simpleItems),
      );

      // Notifica o sistema operacional para redesenhar o widget
      await HomeWidget.updateWidget(
        name: androidWidgetProvider,
        iOSName: iOSWidgetName,
      );
    } catch (_) {
      // Ignora falhas silenciosamente
    }
  }

  /// Lê os itens modificados fora do app pelo Widget nativo
  static Future<List<ShoppingItem>?> getWidgetShoppingItems() async {
    try {
      await initialize();
      final jsonStr = await HomeWidget.getWidgetData<String>('shopping_items_json');
      if (jsonStr == null || jsonStr.trim().isEmpty) return null;

      final dynamic decoded = jsonDecode(jsonStr);
      if (decoded is List) {
        return decoded
            .map((e) => ShoppingItem.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList();
      }
    } catch (_) {}
    return null;
  }
}
