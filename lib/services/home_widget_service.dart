import 'dart:convert';
import 'package:home_widget/home_widget.dart';
import '../models/shopping_models.dart';

class HomeWidgetService {
  static const String appGroupId = 'group.com.lucasrajao.carrinhoDecompras';
  static const String androidWidgetProvider = 'ShoppingListWidgetProvider';
  static const String iOSWidgetName = 'ShoppingListWidget';

  static bool _initialized = false;

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

      final pendingCount = items.where((i) => !i.isChecked).length;
      final checkedCount = items.where((i) => i.isChecked).length;

      await HomeWidget.saveWidgetData<int>('total_items', items.length);
      await HomeWidget.saveWidgetData<int>('pending_count', pendingCount);
      await HomeWidget.saveWidgetData<int>('checked_count', checkedCount);
      await HomeWidget.saveWidgetData<bool>('is_dark_mode', isDarkMode);

      final simpleItems = items.map((i) => i.toJson()).toList();

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
