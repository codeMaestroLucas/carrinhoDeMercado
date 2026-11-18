import 'dart:convert';
import 'package:carrinhocompras/models/shopping_models.dart';
import 'package:carrinhocompras/services/home_widget_service.dart';
import 'package:carrinhocompras/services/shopping_controller.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final Map<String, dynamic> mockWidgetStorage = {};

  setUp(() {
    mockWidgetStorage.clear();

    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('home_widget'),
      (MethodCall methodCall) async {
        switch (methodCall.method) {
          case 'setAppGroupId':
            return true;
          case 'saveWidgetData':
            final id = methodCall.arguments['id'] as String;
            final data = methodCall.arguments['data'];
            if (data == null) {
              mockWidgetStorage.remove(id);
            } else {
              mockWidgetStorage[id] = data;
            }
            return true;
          case 'getWidgetData':
            final id = methodCall.arguments['id'] as String;
            final defaultValue = methodCall.arguments['defaultValue'];
            return mockWidgetStorage[id] ?? defaultValue;
          case 'updateWidget':
            return true;
          default:
            return null;
        }
      },
    );
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('home_widget'),
      null,
    );
  });

  group('HomeWidget & ShoppingController Bidirectional Sync Tests', () {
    test('updateHomeWidget prioritizes pending items at the top and checked at the bottom', () async {
      final items = [
        ShoppingItem(
          id: '1',
          name: 'Arroz',
          category: ProductCategory.alimentos,
          isChecked: true,
        ),
        ShoppingItem(
          id: '2',
          name: 'Banana',
          category: ProductCategory.alimentos,
          isChecked: false,
        ),
      ];

      await HomeWidgetService.updateHomeWidget(items);

      expect(mockWidgetStorage['total_items'], 2);
      expect(mockWidgetStorage['pending_count'], 1);
      expect(mockWidgetStorage['checked_count'], 1);

      final jsonStr = mockWidgetStorage['shopping_items_json'] as String;
      final decoded = (jsonDecode(jsonStr) as List).cast<Map<String, dynamic>>();

      // Pending items first, checked items last
      expect(decoded.first['name'], 'Banana');
      expect(decoded.first['isChecked'], false);
      expect(decoded.last['name'], 'Arroz');
      expect(decoded.last['isChecked'], true);
    });

    test('syncFromHomeWidget clears app items if widget list is empty', () async {
      final controller = ShoppingController(enablePersistence: false);
      controller.addSingleItem('Leite');
      expect(controller.allItems.length, 1);

      // Simulates user deleting all items from widget
      mockWidgetStorage['shopping_items_json'] = jsonEncode([]);

      await controller.syncFromHomeWidget();
      expect(controller.allItems.isEmpty, true);
    });

    test('syncFromHomeWidget merges toggle and quantity while preserving rich app fields', () async {
      final controller = ShoppingController(enablePersistence: false);
      final item = controller.addSingleItem(
        'Azeite',
        category: ProductCategory.alimentos,
        price: 32.50,
        marketId: 'mercado_bh',
      );
      expect(item, isNotNull);
      expect(controller.allItems.first.isChecked, false);
      expect(controller.allItems.first.price, 32.50);
      expect(controller.allItems.first.quantity, 1);

      // Simulates user ticking the item and setting quantity to 3 on the widget
      final widgetItems = [
        {
          'id': item!.id,
          'name': 'Azeite',
          'category': 'alimentos',
          'quantity': 3,
          'unit': 'un',
          'isChecked': true,
        }
      ];
      mockWidgetStorage['shopping_items_json'] = jsonEncode(widgetItems);

      await controller.syncFromHomeWidget();

      expect(controller.allItems.length, 1);
      final updated = controller.allItems.first;
      expect(updated.isChecked, true);
      expect(updated.quantity, 3);
      // Preserved fields that widget doesn't destroy:
      expect(updated.price, 32.50);
      expect(updated.marketId, 'mercado_bh');
    });

    test('syncFromHomeWidget adds new item created in widget QuickAdd with smart prediction', () async {
      final controller = ShoppingController(enablePersistence: false);
      expect(controller.allItems.isEmpty, true);

      // Simulates user adding an item from the native QuickAdd widget
      final widgetItems = [
        {
          'id': 'widget_123',
          'name': 'Detergente',
          'category': 'limpeza',
          'quantity': 2,
          'unit': 'un',
          'isChecked': false,
        }
      ];
      mockWidgetStorage['shopping_items_json'] = jsonEncode(widgetItems);

      await controller.syncFromHomeWidget();

      expect(controller.allItems.length, 1);
      final added = controller.allItems.first;
      expect(added.name, 'Detergente');
      expect(added.category, ProductCategory.limpeza);
      expect(added.quantity, 2);
    });

    test('syncFromHomeWidget removes items that were deleted in the widget', () async {
      final controller = ShoppingController(enablePersistence: false);
      final item1 = controller.addSingleItem('Maçã')!;
      final item2 = controller.addSingleItem('Pão')!;
      expect(controller.allItems.length, 2);

      // Simulates user deleting 'Maçã' in the widget
      final widgetItems = [
        item2.toJson(),
      ];
      mockWidgetStorage['shopping_items_json'] = jsonEncode(widgetItems);

      await controller.syncFromHomeWidget();

      expect(controller.allItems.length, 1);
      expect(controller.allItems.first.name, 'Pão');
    });

    test('flushToHomeWidget pushes latest state without exceptions', () async {
      final controller = ShoppingController(enablePersistence: false);
      controller.addSingleItem('Café');

      await controller.flushToHomeWidget();

      expect(mockWidgetStorage['total_items'], 1);
      expect(mockWidgetStorage['pending_count'], 1);
    });

    test('Native widget_sync channel triggers immediate synchronization', () async {
      bool synced = false;
      HomeWidgetService.registerWidgetSyncListener(() {
        synced = true;
      });

      // Simulates native MainActivity invoking onWidgetDataChanged
      const channel = MethodChannel(HomeWidgetService.syncChannelName);
      final message = channel.codec.encodeMethodCall(const MethodCall('onWidgetDataChanged'));
      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .handlePlatformMessage(
        HomeWidgetService.syncChannelName,
        message,
        (data) {},
      );

      expect(synced, true);
    });
  });
}
