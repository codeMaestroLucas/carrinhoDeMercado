import 'package:flutter/material.dart';
import '../models/shopping_models.dart';
import '../services/shopping_controller.dart';
import '../theme/app_colors.dart';
import '../utils/formatters.dart';

/// Um widget dedicado e focado exclusivamente na manipulação da lista de compras.
/// Permite adicionar, editar, remover e alterar quantidades/status dos itens.
class ShoppingListEditorWidget extends StatefulWidget {
  const ShoppingListEditorWidget({
    super.key,
    required this.controller,
    this.showHeader = true,
    this.showQuickAdd = true,
  });

  final ShoppingController controller;
  final bool showHeader;
  final bool showQuickAdd;

  @override
  State<ShoppingListEditorWidget> createState() =>
      _ShoppingListEditorWidgetState();
}

class _ShoppingListEditorWidgetState extends State<ShoppingListEditorWidget> {
  final TextEditingController _addItemController = TextEditingController();
  final FocusNode _addItemFocusNode = FocusNode();

  @override
  void dispose() {
    _addItemController.dispose();
    _addItemFocusNode.dispose();
    super.dispose();
  }

  void _addItem() {
    final text = _addItemController.text.trim();
    if (text.isEmpty) return;

    final item = widget.controller.addSingleItem(text);
    _addItemController.clear();
    _addItemFocusNode.requestFocus();

    if (!mounted) return;
    if (item == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('"$text" já está na lista!'),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  void _openEditDialog(ShoppingItem item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _EditItemBottomSheet(
        item: item,
        controller: widget.controller,
      ),
    );
  }

  void _confirmDeleteItem(ShoppingItem item) {
    widget.controller.removeItem(item.id);

    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('"${item.name}" removido da lista'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 3),
        action: SnackBarAction(
          label: 'Desfazer',
          textColor: AppColors.primaryGreen,
          onPressed: () {
            widget.controller.addSingleItem(
              item.name,
              category: item.category,
              quantity: item.quantity,
              unit: item.unit,
              price: item.price,
              marketId: item.marketId,
            );
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceColor = AppColors.surface(context);
    final borderColor = AppColors.border(context);
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);

    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        final items = widget.controller.allItems;
        final pendingCount = widget.controller.pendingItemsCount;
        final checkedCount = widget.controller.checkedItemsCount;

        return Column(
          children: [
            // Cabeçalho de status da lista
            if (widget.showHeader)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Lista de Compras',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${items.length} ${items.length == 1 ? "item" : "itens"} ($pendingCount pendentes, $checkedCount no carrinho)',
                          style: TextStyle(
                            fontSize: 12,
                            color: textSecondary,
                          ),
                        ),
                      ],
                    ),
                    if (checkedCount > 0)
                      TextButton.icon(
                        onPressed: () {
                          widget.controller.clearCheckedItems();
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Itens concluídos removidos.'),
                              duration: Duration(seconds: 2),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        },
                        icon: const Icon(Icons.cleaning_services_outlined, size: 16),
                        label: const Text('Limpar concluídos'),
                        style: TextButton.styleFrom(
                          foregroundColor: Colors.redAccent,
                          textStyle: const TextStyle(fontSize: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                        ),
                      ),
                  ],
                ),
              ),

            // Campo de Adição Rápida
            if (widget.showQuickAdd)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: Container(
                  decoration: BoxDecoration(
                    color: surfaceColor,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: borderColor),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.04),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      const SizedBox(width: 14),
                      Icon(Icons.add_shopping_cart_rounded,
                          color: AppColors.primaryGreen, size: 22),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _addItemController,
                          focusNode: _addItemFocusNode,
                          style: TextStyle(fontSize: 14, color: textPrimary),
                          textInputAction: TextInputAction.done,
                          onSubmitted: (_) => _addItem(),
                          decoration: InputDecoration(
                            hintText: 'Adicionar item (ex: 2kg de maçã)...',
                            hintStyle: TextStyle(
                              fontSize: 13.5,
                              color: textSecondary.withValues(alpha: 0.8),
                            ),
                            border: InputBorder.none,
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Adicionar à lista',
                        onPressed: _addItem,
                        icon: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: AppColors.primaryGreen,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(
                            Icons.arrow_upward_rounded,
                            color: Colors.white,
                            size: 18,
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                    ],
                  ),
                ),
              ),

            const SizedBox(height: 6),

            // Lista de Itens
            Expanded(
              child: items.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.playlist_add_check_rounded,
                            size: 64,
                            color: textSecondary.withValues(alpha: 0.4),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Sua lista está vazia',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: textPrimary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Adicione itens acima para começar suas compras.',
                            style: TextStyle(
                              fontSize: 13,
                              color: textSecondary,
                            ),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      itemCount: items.length,
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                      itemBuilder: (context, index) {
                        final item = items[index];
                        return _ShoppingItemCard(
                          key: ValueKey(item.id),
                          item: item,
                          onToggle: () =>
                              widget.controller.toggleItemChecked(item.id),
                          onEdit: () => _openEditDialog(item),
                          onDelete: () => _confirmDeleteItem(item),
                          onIncrement: () => widget.controller.updateItemQuantity(
                            item.id,
                            item.quantity + 1,
                          ),
                          onDecrement: () {
                            if (item.quantity > 1) {
                              widget.controller.updateItemQuantity(
                                item.id,
                                item.quantity - 1,
                              );
                            } else {
                              _confirmDeleteItem(item);
                            }
                          },
                        );
                      },
                    ),
            ),
          ],
        );
      },
    );
  }
}

/// Card de exibição individual de cada item da lista
class _ShoppingItemCard extends StatelessWidget {
  const _ShoppingItemCard({
    super.key,
    required this.item,
    required this.onToggle,
    required this.onEdit,
    required this.onDelete,
    required this.onIncrement,
    required this.onDecrement,
  });

  final ShoppingItem item;
  final VoidCallback onToggle;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceColor = AppColors.surface(context);
    final borderColor = AppColors.border(context);
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);

    return Dismissible(
      key: ValueKey('dismiss_${item.id}'),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        margin: const EdgeInsets.symmetric(vertical: 4),
        decoration: BoxDecoration(
          color: Colors.red.shade400,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Icon(Icons.delete_outline, color: Colors.white, size: 24),
      ),
      onDismissed: (_) => onDelete(),
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        decoration: BoxDecoration(
          color: item.isChecked
              ? (isDark ? const Color(0xFF16191F) : const Color(0xFFF3F4F6))
              : surfaceColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: item.isChecked
                ? borderColor.withValues(alpha: 0.5)
                : borderColor,
          ),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onToggle,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(
              children: [
                // Checkbox
                Checkbox(
                  value: item.isChecked,
                  activeColor: AppColors.primaryGreen,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(4),
                  ),
                  onChanged: (_) => onToggle(),
                ),

                // Ícone da Categoria
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: item.category.color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    item.category.icon,
                    size: 18,
                    color: item.category.color,
                  ),
                ),
                const SizedBox(width: 10),

                // Nome e detalhes
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.name,
                        style: TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                          color: item.isChecked ? textSecondary : textPrimary,
                          decoration: item.isChecked
                              ? TextDecoration.lineThrough
                              : TextDecoration.none,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Text(
                            item.category.label,
                            style: TextStyle(
                              fontSize: 11,
                              color: textSecondary,
                            ),
                          ),
                          if (item.price != null && item.price! > 0) ...[
                            Text(' • ',
                                style: TextStyle(
                                    fontSize: 11, color: textSecondary)),
                            Text(
                              AppFormatters.formatCurrency(item.effectiveTotalAmount),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primaryGreen,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),

                // Controles de Quantidade
                Container(
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF23272F) : const Color(0xFFF1F3F5),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      InkWell(
                        onTap: onDecrement,
                        borderRadius: BorderRadius.circular(8),
                        child: Padding(
                          padding: const EdgeInsets.all(5),
                          child: Icon(
                            item.quantity == 1
                                ? Icons.delete_outline
                                : Icons.remove,
                            size: 15,
                            color: item.quantity == 1
                                ? Colors.redAccent
                                : textSecondary,
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        child: Text(
                          '${item.quantity} ${item.unit}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: textPrimary,
                          ),
                        ),
                      ),
                      InkWell(
                        onTap: onIncrement,
                        borderRadius: BorderRadius.circular(8),
                        child: Padding(
                          padding: const EdgeInsets.all(5),
                          child: Icon(
                            Icons.add,
                            size: 15,
                            color: textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 4),

                // Botão de Editar
                IconButton(
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  color: textSecondary,
                  tooltip: 'Editar item',
                  onPressed: onEdit,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Modal inferior para editar nome, categoria, quantidade, unidade e preço do item
class _EditItemBottomSheet extends StatefulWidget {
  const _EditItemBottomSheet({
    required this.item,
    required this.controller,
  });

  final ShoppingItem item;
  final ShoppingController controller;

  @override
  State<_EditItemBottomSheet> createState() => _EditItemBottomSheetState();
}

class _EditItemBottomSheetState extends State<_EditItemBottomSheet> {
  late final TextEditingController _nameController;
  late final TextEditingController _priceController;
  late ProductCategory _selectedCategory;
  late int _quantity;
  late String _unit;
  late bool _isPriceTotal;

  final List<String> _commonUnits = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'dz', 'pct'];

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.item.name);
    _priceController = TextEditingController(
      text: widget.item.price != null && widget.item.price! > 0
          ? widget.item.price!.toStringAsFixed(2)
          : '',
    );
    _selectedCategory = widget.item.category;
    _quantity = widget.item.quantity;
    _unit = widget.item.unit;
    _isPriceTotal = widget.item.isPriceTotal;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  void _save() {
    final name = _nameController.text.trim();
    if (name.isEmpty) return;

    final priceParsed = double.tryParse(
      _priceController.text.replaceAll(',', '.').trim(),
    );

    final success = widget.controller.updateItem(
      widget.item.id,
      name: name,
      category: _selectedCategory,
      quantity: _quantity,
      unit: _unit,
      price: priceParsed,
      isPriceTotal: _isPriceTotal,
      clearPrice: priceParsed == null || priceParsed <= 0,
    );

    if (mounted) {
      Navigator.of(context).pop();
      if (!success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Já existe outro item com esse nome na lista.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceColor = AppColors.surface(context);
    final borderColor = AppColors.border(context);
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);

    return Container(
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Barra de título e botão fechar
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Editar Item',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: textPrimary,
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                  color: textSecondary,
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Nome do Produto
            Text(
              'Nome do produto',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: textSecondary,
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _nameController,
              style: TextStyle(color: textPrimary, fontSize: 14),
              decoration: InputDecoration(
                filled: true,
                fillColor: isDark ? const Color(0xFF23272F) : const Color(0xFFF8F9FA),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: borderColor),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              ),
            ),

            const SizedBox(height: 16),

            // Quantidade e Unidade
            Row(
              children: [
                Expanded(
                  flex: 3,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Quantidade',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: textSecondary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF23272F) : const Color(0xFFF8F9FA),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: borderColor),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.remove, size: 18),
                              onPressed: _quantity > 1
                                  ? () => setState(() => _quantity--)
                                  : null,
                            ),
                            Text(
                              '$_quantity',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: textPrimary,
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.add, size: 18),
                              onPressed: () => setState(() => _quantity++),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Unidade',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: textSecondary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      DropdownButtonFormField<String>(
                        initialValue: _commonUnits.contains(_unit) ? _unit : 'un',
                        items: _commonUnits.map((u) {
                          return DropdownMenuItem(
                            value: u,
                            child: Text(u, style: TextStyle(color: textPrimary)),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) setState(() => _unit = val);
                        },
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: isDark ? const Color(0xFF23272F) : const Color(0xFFF8F9FA),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide(color: borderColor),
                          ),
                          contentPadding:
                              const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Preço Opcional
            Text(
              'Preço (opcional)',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: textSecondary,
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _priceController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              style: TextStyle(color: textPrimary, fontSize: 14),
              decoration: InputDecoration(
                prefixText: 'R\$ ',
                filled: true,
                fillColor: isDark ? const Color(0xFF23272F) : const Color(0xFFF8F9FA),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: borderColor),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              ),
            ),

            const SizedBox(height: 16),

            // Seleção de Categoria
            Text(
              'Categoria',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: textSecondary,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: ProductCategory.values.map((cat) {
                final isSelected = cat == _selectedCategory;
                return ChoiceChip(
                  label: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        cat.icon,
                        size: 14,
                        color: isSelected ? Colors.white : cat.color,
                      ),
                      const SizedBox(width: 4),
                      Text(cat.label),
                    ],
                  ),
                  selected: isSelected,
                  selectedColor: AppColors.primaryGreen,
                  labelStyle: TextStyle(
                    fontSize: 12,
                    color: isSelected ? Colors.white : textPrimary,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  ),
                  onSelected: (val) {
                    if (val) setState(() => _selectedCategory = cat);
                  },
                );
              }).toList(),
            ),

            const SizedBox(height: 24),

            // Botão Salvar
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryGreen,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Salvar Alterações',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
