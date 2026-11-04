import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:carrinhocompras/services/shopping_controller.dart';
import 'package:carrinhocompras/widgets/shopping_list_editor_widget.dart';

void main() {
  testWidgets('ShoppingListEditorWidget allows adding, editing, incrementing and removing items',
      (WidgetTester tester) async {
    final controller = ShoppingController(enablePersistence: false);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ShoppingListEditorWidget(controller: controller),
        ),
      ),
    );

    // Initial empty state
    expect(find.text('Sua lista está vazia'), findsOneWidget);

    // 1. Add item
    final inputFinder = find.byType(TextField);
    expect(inputFinder, findsOneWidget);
    await tester.enterText(inputFinder, 'Arroz');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();

    expect(find.text('Arroz'), findsOneWidget);
    expect(controller.allItems.length, 1);
    expect(controller.allItems.first.name, 'Arroz');

    // 2. Increment quantity
    final addIconFinder = find.byIcon(Icons.add);
    expect(addIconFinder, findsOneWidget);
    await tester.tap(addIconFinder);
    await tester.pumpAndSettle();

    expect(controller.allItems.first.quantity, 2);
    expect(find.text('2 un'), findsOneWidget);

    // 3. Edit item
    final editIconFinder = find.byIcon(Icons.edit_outlined);
    expect(editIconFinder, findsOneWidget);
    await tester.tap(editIconFinder);
    await tester.pumpAndSettle();

    // Bottom sheet is displayed
    expect(find.text('Editar Item'), findsOneWidget);
    final editNameFinder = find.widgetWithText(TextField, 'Arroz');
    expect(editNameFinder, findsOneWidget);
    await tester.enterText(editNameFinder, 'Arroz Integral');

    final saveButtonFinder = find.text('Salvar Alterações');
    expect(saveButtonFinder, findsOneWidget);
    await tester.ensureVisible(saveButtonFinder);
    await tester.tap(saveButtonFinder);
    await tester.pumpAndSettle();

    expect(find.text('Arroz Integral'), findsOneWidget);
    expect(controller.allItems.first.name, 'Arroz Integral');

    // 4. Remove item via swipe or decrement
    final deleteOrMinusFinder = find.byIcon(Icons.remove);
    expect(deleteOrMinusFinder, findsOneWidget);
    await tester.tap(deleteOrMinusFinder); // decrements to 1
    await tester.pumpAndSettle();
    expect(controller.allItems.first.quantity, 1);

    // Tap trash/minus to delete
    final trashFinder = find.byIcon(Icons.delete_outline);
    expect(trashFinder, findsOneWidget);
    await tester.tap(trashFinder);
    await tester.pumpAndSettle();

    expect(controller.allItems.isEmpty, true);
    expect(find.text('Sua lista está vazia'), findsOneWidget);
  });
}
