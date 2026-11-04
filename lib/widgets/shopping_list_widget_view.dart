import 'package:flutter/material.dart';
import '../models/shopping_models.dart';

/// Widget visual puro renderizado pelo HomeWidget como imagem para a tela inicial.
/// Não utiliza ListView/Scrollable para evitar dependência de View.of(context) no pipeline headless.
class ShoppingListWidgetView extends StatelessWidget {
  const ShoppingListWidgetView({
    super.key,
    required this.items,
  });

  final List<ShoppingItem> items;

  @override
  Widget build(BuildContext context) {
    final pendingItems = items.where((i) => !i.isChecked).toList();
    final checkedItems = items.where((i) => i.isChecked).toList();
    // Exibe até 7 itens no espaço do widget
    final displayItems = [...pendingItems, ...checkedItems].take(7).toList();

    return Container(
      width: 320,
      height: 250,
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
      decoration: const BoxDecoration(
        color: Color(0xFF1E2229),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Cabeçalho (reserva espaço à direita para o botão "+" nativo)
          Padding(
            padding: const EdgeInsets.only(right: 38),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(5),
                      decoration: BoxDecoration(
                        color: const Color(0xFF00C853).withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.shopping_cart_outlined,
                        color: Color(0xFF00C853),
                        size: 15,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Lista de Compras',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 13.5,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                  decoration: BoxDecoration(
                    color: const Color(0xFF282D37),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '${pendingItems.length} pendentes',
                    style: const TextStyle(
                      color: Color(0xFF00C853),
                      fontSize: 10.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          const Divider(height: 1, color: Color(0xFF2E3440)),
          const SizedBox(height: 8),

          // Itens da lista em Column estática
          if (displayItems.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  'Nenhum item na lista',
                  style: TextStyle(
                    color: Color(0xFF9CA3AF),
                    fontSize: 12,
                  ),
                ),
              ),
            )
          else
            ...displayItems.map((item) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 3.5),
                child: Row(
                  children: [
                    Icon(
                      item.isChecked
                          ? Icons.check_circle_rounded
                          : Icons.circle_outlined,
                      size: 14,
                      color: item.isChecked
                          ? const Color(0xFF00C853)
                          : const Color(0xFF9CA3AF),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        item.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          color: item.isChecked
                              ? const Color(0xFF6B7280)
                              : Colors.white,
                          decoration: item.isChecked
                              ? TextDecoration.lineThrough
                              : TextDecoration.none,
                        ),
                      ),
                    ),
                    Text(
                      '${item.quantity} ${item.unit}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF9CA3AF),
                      ),
                    ),
                  ],
                ),
              );
            }),

          const Spacer(),

          // Rodapé
          if (items.length > displayItems.length)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                '+ ${items.length - displayItems.length} outros itens...',
                style: const TextStyle(
                  color: Color(0xFF6B7280),
                  fontSize: 10.5,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
