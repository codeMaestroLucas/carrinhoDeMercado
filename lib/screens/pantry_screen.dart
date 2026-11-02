import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/shopping_models.dart';
import '../services/shopping_controller.dart';
import '../theme/app_colors.dart';
import '../utils/formatters.dart';

class PantryScreen extends StatefulWidget {
  const PantryScreen({
    super.key,
    required this.controller,
  });

  final ShoppingController controller;

  @override
  State<PantryScreen> createState() => _PantryScreenState();
}

class _PantryScreenState extends State<PantryScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _selectedFilter = 'all'; // 'all', 'low', 'expired'
  ProductCategory? _categoryFilter;
  Timer? _hintTimer;
  bool _showGestureHint = true;

  @override
  void initState() {
    super.initState();
    _hintTimer = Timer(const Duration(seconds: 4), () {
      if (mounted) {
        setState(() {
          _showGestureHint = false;
        });
      }
    });
  }

  @override
  void dispose() {
    _hintTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _showAddItemModal({PantryItem? itemToEdit}) {
    final isEditing = itemToEdit != null;
    final nameController =
        TextEditingController(text: itemToEdit?.name ?? '');
    final qtyController = TextEditingController(
      text: itemToEdit != null
          ? (itemToEdit.quantity % 1 == 0
              ? itemToEdit.quantity.toInt().toString()
              : itemToEdit.quantity.toString())
          : '1',
    );
    final daysController = TextEditingController(
      text: (itemToEdit?.estimatedDaysToConsume ?? 15).toString(),
    );
    String selectedUnit = itemToEdit?.unit ?? 'un';
    ProductCategory selectedCategory =
        itemToEdit?.category ?? ProductCategory.alimentos;
    DateTime? selectedExpiry = itemToEdit?.expiryDate;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final surface = AppColors.surface(context);
            final textPrimary = AppColors.textPrimary(context);
            final textSecondary = AppColors.textSecondary(context);
            final borderColor = AppColors.border(context);

            return Container(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom + 16,
                top: 16,
                left: 16,
                right: 16,
              ),
              decoration: BoxDecoration(
                color: surface,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(20),
                ),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: borderColor,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      isEditing
                          ? 'Editar Item da Despensa'
                          : 'Adicionar à Despensa',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: textPrimary,
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: nameController,
                      autofocus: false,
                      style: TextStyle(color: textPrimary),
                      decoration: InputDecoration(
                        labelText: 'Nome do Produto',
                        hintText: 'Ex: Arroz Tipo 1, Detergente...',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onChanged: (text) {
                        if (!isEditing && text.trim().length >= 3) {
                          final predicted =
                              widget.controller.predictCategory(text);
                          setModalState(() {
                            selectedCategory = predicted;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: TextField(
                            controller: qtyController,
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                            style: TextStyle(color: textPrimary),
                            decoration: InputDecoration(
                              labelText: 'Quantidade',
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: selectedUnit,
                            decoration: InputDecoration(
                              labelText: 'Unidade',
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            items: const [
                              DropdownMenuItem(value: 'un', child: Text('un')),
                              DropdownMenuItem(value: 'kg', child: Text('kg')),
                              DropdownMenuItem(value: 'g', child: Text('g')),
                              DropdownMenuItem(value: 'L', child: Text('L')),
                              DropdownMenuItem(value: 'cx', child: Text('cx')),
                              DropdownMenuItem(value: 'dz', child: Text('dz')),
                            ],
                            onChanged: (val) {
                              if (val != null) {
                                setModalState(() {
                                  selectedUnit = val;
                                });
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: daysController,
                            keyboardType: TextInputType.number,
                            style: TextStyle(color: textPrimary),
                            decoration: InputDecoration(
                              labelText: 'Duração Estimada (dias)',
                              hintText: 'Ex: 15',
                              helperText: 'Avisa quando estiver perto de acabar',
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // Validade opcional
                    InkWell(
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: selectedExpiry ??
                              DateTime.now().add(const Duration(days: 30)),
                          firstDate: DateTime.now()
                              .subtract(const Duration(days: 30)),
                          lastDate:
                              DateTime.now().add(const Duration(days: 1825)),
                        );
                        if (picked != null) {
                          setModalState(() {
                            selectedExpiry = picked;
                          });
                        }
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          border: Border.all(color: borderColor),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.event_outlined,
                                  size: 20,
                                  color: textSecondary,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  selectedExpiry != null
                                      ? 'Validade: ${AppFormatters.formatShortDate(selectedExpiry!)}'
                                      : 'Adicionar Data de Validade (opcional)',
                                  style: TextStyle(
                                    fontSize: 13.5,
                                    color: selectedExpiry != null
                                        ? textPrimary
                                        : textSecondary,
                                    fontWeight: selectedExpiry != null
                                        ? FontWeight.w600
                                        : FontWeight.normal,
                                  ),
                                ),
                              ],
                            ),
                            if (selectedExpiry != null)
                              IconButton(
                                icon: const Icon(Icons.clear, size: 18),
                                onPressed: () {
                                  setModalState(() {
                                    selectedExpiry = null;
                                  });
                                },
                              ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    // Categoria
                    Text(
                      'Categoria:',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: textSecondary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: ProductCategory.values.map((cat) {
                          final isSelected = selectedCategory == cat;
                          return Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: ChoiceChip(
                              avatar: Icon(
                                cat.icon,
                                size: 16,
                                color: isSelected
                                    ? Colors.white
                                    : cat.color,
                              ),
                              label: Text(cat.label),
                              selected: isSelected,
                              selectedColor: cat.color,
                              labelStyle: TextStyle(
                                color: isSelected ? Colors.white : textPrimary,
                                fontSize: 12,
                              ),
                              onSelected: (_) {
                                setModalState(() {
                                  selectedCategory = cat;
                                });
                              },
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                    const SizedBox(height: 18),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primaryGreen,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: () {
                        final name = nameController.text.trim();
                        if (name.isEmpty) return;

                        final qty =
                            double.tryParse(qtyController.text.replaceAll(',', '.')) ??
                                1.0;
                        final days =
                            int.tryParse(daysController.text.trim()) ?? 15;

                        if (isEditing) {
                          final updated = itemToEdit.copyWith(
                            name: name,
                            category: selectedCategory,
                            quantity: qty,
                            unit: selectedUnit,
                            estimatedDaysToConsume: days,
                            expiryDate: selectedExpiry,
                            clearExpiry: selectedExpiry == null,
                          );
                          widget.controller.updatePantryItem(updated);
                        } else {
                          final newItem = PantryItem(
                            id: 'pantry_${DateTime.now().microsecondsSinceEpoch}',
                            name: name,
                            category: selectedCategory,
                            quantity: qty,
                            unit: selectedUnit,
                            estimatedDaysToConsume: days,
                            expiryDate: selectedExpiry,
                          );
                          widget.controller.addToPantry([newItem]);
                        }
                        Navigator.of(ctx).pop();
                      },
                      child: Text(
                        isEditing ? 'Salvar Alterações' : 'Adicionar à Despensa',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showImportFromPurchasesModal() {
    final history = widget.controller.history;
    if (history.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Nenhuma compra no histórico para importar.'),
        ),
      );
      return;
    }

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final textPrimary = AppColors.textPrimary(context);
        final textSecondary = AppColors.textSecondary(context);
        final surface = AppColors.surface(context);

        return Container(
          height: MediaQuery.of(context).size.height * 0.7,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: surface,
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(20),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border(context),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'Importar de Compra Recente',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Selecione uma compra para enviar os itens para sua despensa:',
                style: TextStyle(fontSize: 12.5, color: textSecondary),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ListView.separated(
                  itemCount: history.length,
                  separatorBuilder: (_, _) => Divider(
                    height: 1,
                    color: AppColors.divider(context),
                  ),
                  itemBuilder: (context, index) {
                    final rec = history[index];
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        rec.marketName,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: textPrimary,
                        ),
                      ),
                      subtitle: Text(
                        '${AppFormatters.formatShortDate(rec.date)} • ${rec.items.length} itens • ${AppFormatters.formatCurrency(rec.totalAmount)}',
                        style: TextStyle(fontSize: 12, color: textSecondary),
                      ),
                      trailing: FilledButton.tonal(
                        style: FilledButton.styleFrom(
                          visualDensity: VisualDensity.compact,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                        ),
                        onPressed: () {
                          widget.controller.addPurchaseItemsToPantry(
                            rec.items,
                            marketName: rec.marketName,
                          );
                          Navigator.of(ctx).pop();
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                '${rec.items.length} itens importados para a despensa!',
                              ),
                              backgroundColor: AppColors.primaryGreen,
                            ),
                          );
                        },
                        child: const Text('Importar'),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final allPantry = controller.pantryItems;
    final suggestions = controller.replenishmentSuggestions;
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);
    final surfaceColor = AppColors.surface(context);
    final borderColor = AppColors.border(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Filter pantry items
    final query = _searchController.text.trim().toLowerCase();
    final filtered = allPantry.where((item) {
      if (query.isNotEmpty && !item.name.toLowerCase().contains(query)) {
        return false;
      }
      if (_categoryFilter != null && item.category != _categoryFilter) {
        return false;
      }
      if (_selectedFilter == 'low') {
        return item.status == PantryItemStatus.low;
      }
      if (_selectedFilter == 'expired') {
        return item.status == PantryItemStatus.expired || item.isNearExpiry;
      }
      return true;
    }).toList();

    // Sort: expired first, then low stock, then alphabetical
    filtered.sort((a, b) {
      if (a.status == PantryItemStatus.expired &&
          b.status != PantryItemStatus.expired) {
        return -1;
      }
      if (b.status == PantryItemStatus.expired &&
          a.status != PantryItemStatus.expired) {
        return 1;
      }
      if (a.status == PantryItemStatus.low && b.status != PantryItemStatus.low) {
        return -1;
      }
      if (b.status == PantryItemStatus.low && a.status != PantryItemStatus.low) {
        return 1;
      }
      return a.name.toLowerCase().compareTo(b.name.toLowerCase());
    });

    final lowCount = allPantry
        .where((p) => p.status == PantryItemStatus.low)
        .length;
    final expiredCount = allPantry
        .where((p) => p.status == PantryItemStatus.expired || p.isNearExpiry)
        .length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Minha Despensa'),
        actions: [
          IconButton(
            tooltip: 'Importar de Compra',
            icon: const Icon(Icons.file_download_outlined),
            onPressed: _showImportFromPurchasesModal,
          ),
          IconButton(
            tooltip: 'Adicionar Item',
            icon: const Icon(Icons.add_circle_outline_rounded),
            onPressed: () => _showAddItemModal(),
          ),
          const SizedBox(width: 6),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primaryGreen,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text(
          'Novo Item',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        onPressed: () => _showAddItemModal(),
      ),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // KPI Cards: Em Estoque / Acabando / Vencendo
                  Row(
                    children: [
                      Expanded(
                        child: _buildMetricCard(
                          context,
                          title: 'Total na Despensa',
                          value: '${allPantry.length}',
                          icon: Icons.inventory_2_outlined,
                          color: AppColors.primaryGreen,
                          isSelected: _selectedFilter == 'all',
                          onTap: () => setState(() => _selectedFilter = 'all'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildMetricCard(
                          context,
                          title: 'Acabando',
                          value: '$lowCount',
                          icon: Icons.warning_amber_rounded,
                          color: const Color(0xFFD97706),
                          isSelected: _selectedFilter == 'low',
                          onTap: () => setState(() => _selectedFilter = 'low'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildMetricCard(
                          context,
                          title: 'Vencendo',
                          value: '$expiredCount',
                          icon: Icons.event_busy_outlined,
                          color: const Color(0xFFDC2626),
                          isSelected: _selectedFilter == 'expired',
                          onTap: () =>
                              setState(() => _selectedFilter = 'expired'),
                        ),
                      ),
                    ],
                  ),

                  // Smart Replenishment Suggestions Banner
                  if (suggestions.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    _buildReplenishmentBanner(context, suggestions),
                  ],

                  const SizedBox(height: 14),

                  // Search bar
                  SizedBox(
                    height: 42,
                    child: TextField(
                      controller: _searchController,
                      onChanged: (_) => setState(() {}),
                      style: TextStyle(fontSize: 14, color: textPrimary),
                      decoration: InputDecoration(
                        hintText: 'Buscar itens na despensa...',
                        hintStyle:
                            TextStyle(fontSize: 13, color: textSecondary),
                        prefixIcon: Icon(
                          Icons.search_rounded,
                          size: 19,
                          color: textSecondary,
                        ),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear, size: 17),
                                onPressed: () {
                                  setState(() {
                                    _searchController.clear();
                                  });
                                },
                              )
                            : null,
                        filled: true,
                        fillColor: surfaceColor,
                        contentPadding:
                            const EdgeInsets.symmetric(horizontal: 14),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: borderColor),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: borderColor),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 8),

                  // Category filter chips
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        ChoiceChip(
                          visualDensity: VisualDensity.compact,
                          label: const Text('Todas'),
                          selected: _categoryFilter == null,
                          onSelected: (_) {
                            setState(() => _categoryFilter = null);
                          },
                        ),
                        const SizedBox(width: 6),
                        ...ProductCategory.values.map((cat) {
                          final isSelected = _categoryFilter == cat;
                          return Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: ChoiceChip(
                              visualDensity: VisualDensity.compact,
                              label: Text(cat.label),
                              selected: isSelected,
                              onSelected: (_) {
                                setState(() {
                                  _categoryFilter = isSelected ? null : cat;
                                });
                              },
                            ),
                          );
                        }),
                      ],
                    ),
                  ),
                  // Dica de interação que some após 4 segundos ou quando o usuário tirá-la da tela (arrastar ou fechar)
                  AnimatedSize(
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeInOut,
                    child: _showGestureHint
                        ? Padding(
                            padding: const EdgeInsets.only(top: 8, bottom: 2),
                            child: Dismissible(
                              key: const ValueKey(
                                  'pantry_gesture_hint_dismissible'),
                              direction: DismissDirection.horizontal,
                              onDismissed: (_) {
                                _hintTimer?.cancel();
                                setState(() => _showGestureHint = false);
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: isDark
                                      ? const Color(0xFF222730)
                                      : const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isDark
                                        ? const Color(0xFF333B47)
                                        : const Color(0xFFE2E8F0),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(
                                      Icons.touch_app_outlined,
                                      size: 16,
                                      color: AppColors.primaryGreen,
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        'Toque para editar ou segure para opções',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
                                          color: textSecondary,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    InkWell(
                                      onTap: () {
                                        _hintTimer?.cancel();
                                        setState(
                                            () => _showGestureHint = false);
                                      },
                                      borderRadius: BorderRadius.circular(12),
                                      child: Padding(
                                        padding: const EdgeInsets.all(2),
                                        child: Icon(
                                          Icons.close_rounded,
                                          size: 16,
                                          color: textSecondary.withValues(
                                              alpha: 0.6),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          )
                        : const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
          ),

          // Pantry Items List
          if (filtered.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.kitchen_outlined,
                        size: 56,
                        color: textSecondary.withValues(alpha: 0.5),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        allPantry.isEmpty
                            ? 'Sua despensa está vazia'
                            : 'Nenhum item encontrado',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        allPantry.isEmpty
                            ? 'Adicione itens manualmente ou importe de suas compras anteriores para monitorar o que você tem em casa.'
                            : 'Tente outro filtro ou busca.',
                        style: TextStyle(fontSize: 13, color: textSecondary),
                        textAlign: TextAlign.center,
                      ),
                      if (allPantry.isEmpty) ...[
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primaryGreen,
                            foregroundColor: Colors.white,
                          ),
                          onPressed: _showImportFromPurchasesModal,
                          icon: const Icon(Icons.file_download_outlined,
                              size: 18),
                          label: const Text('Importar de Compra Recente'),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 80),
              sliver: SliverList.separated(
                itemCount: filtered.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final item = filtered[index];
                  return _buildPantryItemCard(context, item);
                },
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMetricCard(
    BuildContext context, {
    required String title,
    required String value,
    required IconData icon,
    required Color color,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceColor = AppColors.surface(context);
    final borderColor = isSelected ? color : AppColors.border(context);
    final textSecondary = AppColors.textSecondary(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          decoration: BoxDecoration(
            color: isSelected
                ? color.withValues(alpha: isDark ? 0.20 : 0.10)
                : surfaceColor,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isSelected
                  ? color
                  : borderColor.withValues(alpha: isDark ? 0.5 : 0.8),
              width: isSelected ? 1.6 : 1,
            ),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: color.withValues(alpha: isDark ? 0.25 : 0.15),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ]
                : null,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.all(5),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: isDark ? 0.22 : 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(icon, size: 16, color: color),
                  ),
                  Text(
                    value,
                    style: TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                      color: color,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 11,
                  height: 1.15,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                  color: isSelected
                      ? (isDark ? Colors.white : color)
                      : textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildReplenishmentBanner(
    BuildContext context,
    List<ReplenishmentSuggestion> suggestions,
  ) {
    final textSecondary = AppColors.textSecondary(context);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7).withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.lightbulb_outline_rounded,
                size: 20,
                color: Color(0xFFB45309),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Provavelmente Acabando (${suggestions.length})',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF92400E),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Baseado na sua frequência de compras anterior:',
            style: TextStyle(fontSize: 12, color: textSecondary),
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: suggestions.take(6).map((sugg) {
                final isUrgent = sugg.urgency == RepurchaseUrgency.urgent;
                return Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isUrgent
                          ? const Color(0xFFFCA5A5)
                          : const Color(0xFFFCD34D),
                    ),
                  ),
                  child: Row(
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            sugg.productName,
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1F2937),
                            ),
                          ),
                          Text(
                            isUrgent
                                ? 'Ciclo: ${sugg.averageIntervalDays}d • Há ${sugg.daysSinceLastPurchase}d'
                                : 'Previsão esta semana',
                            style: TextStyle(
                              fontSize: 10.5,
                              color: isUrgent
                                  ? const Color(0xFFDC2626)
                                  : const Color(0xFFB45309),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        tooltip: 'Adicionar à Lista de Compras',
                        icon: const Icon(
                          Icons.add_shopping_cart_rounded,
                          size: 18,
                          color: AppColors.primaryGreen,
                        ),
                        onPressed: () {
                          widget.controller.addSingleItem(
                            sugg.productName,
                            category: sugg.category,
                            price: sugg.lastPrice > 0 ? sugg.lastPrice : null,
                          );
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                '${sugg.productName} adicionado à lista de compras!',
                              ),
                              backgroundColor: AppColors.primaryGreen,
                            ),
                          );
                          setState(() {});
                        },
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  void _showItemActionSheet(PantryItem item) {
    HapticFeedback.mediumImpact();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final surface = AppColors.surface(context);
        final textPrimary = AppColors.textPrimary(context);
        final textSecondary = AppColors.textSecondary(context);
        final border = AppColors.border(context);

        final qtyDisplay = item.quantity % 1 == 0
            ? '${item.quantity.toInt()} ${item.unit}'
            : '${item.quantity.toStringAsFixed(1)} ${item.unit}';

        return Material(
          color: surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          child: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 38,
                      height: 4,
                      decoration: BoxDecoration(
                        color: border,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                const SizedBox(height: 14),
                // Header com preview do item
                Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: item.category.color.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        item.category.icon,
                        color: item.category.color,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.name,
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${item.category.label} • Estoque atual: $qtyDisplay',
                            style: TextStyle(
                              fontSize: 12.5,
                              color: textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Divider(height: 1, color: AppColors.divider(context)),
                const SizedBox(height: 6),

                // 1. Adicionar à Lista de Compras
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.add_shopping_cart_rounded,
                      size: 20,
                      color: AppColors.primaryGreen,
                    ),
                  ),
                  title: Text(
                    'Adicionar à Lista de Compras',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: textPrimary,
                      fontSize: 14.5,
                    ),
                  ),
                  subtitle: Text(
                    'Envia este item para repor na sua lista de compras',
                    style: TextStyle(fontSize: 12, color: textSecondary),
                  ),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    final added =
                        widget.controller.addPantryItemToShoppingList(item);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          added
                              ? '${item.name} enviado para a Lista de Compras!'
                              : '${item.name} já está na Lista de Compras.',
                        ),
                        backgroundColor:
                            added ? AppColors.primaryGreen : Colors.orange,
                      ),
                    );
                  },
                ),

                // 2. Editar
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.blue.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.edit_outlined,
                      size: 20,
                      color: Colors.blue,
                    ),
                  ),
                  title: Text(
                    'Editar Item',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: textPrimary,
                      fontSize: 14.5,
                    ),
                  ),
                  subtitle: Text(
                    'Alterar quantidade, validade, categoria ou duração',
                    style: TextStyle(fontSize: 12, color: textSecondary),
                  ),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    _showAddItemModal(itemToEdit: item);
                  },
                ),

                // 3. Remover
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.red.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.delete_outline_rounded,
                      size: 20,
                      color: Colors.red,
                    ),
                  ),
                  title: const Text(
                    'Remover da Despensa',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: Colors.red,
                      fontSize: 14.5,
                    ),
                  ),
                  subtitle: Text(
                    'Excluir este produto do estoque da despensa',
                    style: TextStyle(fontSize: 12, color: textSecondary),
                  ),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    widget.controller.removePantryItem(item.id);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('${item.name} removido da despensa.'),
                        action: SnackBarAction(
                          label: 'Desfazer',
                          textColor: Colors.white,
                          onPressed: () {
                            widget.controller.addToPantry([item]);
                          },
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

  Widget _buildVerticalStepper(BuildContext context, PantryItem item) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final stepperBg = isDark
        ? const Color(0xFF262C36)
        : const Color(0xFFF1F5F9);
    final stepperBorder = isDark
        ? const Color(0xFF374151)
        : const Color(0xFFE2E8F0);
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);

    final qtyNumber = item.quantity % 1 == 0
        ? '${item.quantity.toInt()}'
        : item.quantity.toStringAsFixed(1);

    return Container(
      width: 44,
      decoration: BoxDecoration(
        color: stepperBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: stepperBorder),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Botão + (em cima)
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(11)),
              onTap: () {
                HapticFeedback.selectionClick();
                widget.controller.updatePantryItemQuantity(item.id, 1);
              },
              child: const SizedBox(
                width: 44,
                height: 28,
                child: Icon(
                  Icons.add_rounded,
                  size: 18,
                  color: AppColors.primaryGreen,
                ),
              ),
            ),
          ),
          // Quantidade e unidade (no meio)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  qtyNumber,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w800,
                    color: textPrimary,
                    height: 1.1,
                  ),
                ),
                Text(
                  item.unit,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: textSecondary,
                    height: 1.1,
                  ),
                ),
              ],
            ),
          ),
          // Botão - (embaixo)
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius:
                  const BorderRadius.vertical(bottom: Radius.circular(11)),
              onTap: () {
                if (item.quantity > 0) {
                  HapticFeedback.selectionClick();
                  widget.controller.updatePantryItemQuantity(item.id, -1);
                }
              },
              child: SizedBox(
                width: 44,
                height: 28,
                child: Icon(
                  Icons.remove_rounded,
                  size: 18,
                  color: item.quantity > 0
                      ? textSecondary
                      : textSecondary.withValues(alpha: 0.3),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPantryItemCard(BuildContext context, PantryItem item) {
    final surfaceColor = AppColors.surface(context);
    final borderColor = AppColors.border(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);

    String statusLabel = 'Em estoque';
    IconData statusIcon = Icons.check_circle_outline_rounded;
    Color statusColor = const Color(0xFF16A34A);

    Color activeBorder = borderColor;
    if (item.isExpired) {
      statusLabel = 'Vencido!';
      statusIcon = Icons.error_outline_rounded;
      statusColor = const Color(0xFFDC2626);
      activeBorder = const Color(0xFFDC2626).withValues(alpha: 0.4);
    } else if (item.isNearExpiry) {
      statusLabel = 'Vence logo';
      statusIcon = Icons.access_time_rounded;
      statusColor = const Color(0xFFD97706);
      activeBorder = const Color(0xFFD97706).withValues(alpha: 0.4);
    } else if (item.status == PantryItemStatus.low) {
      statusLabel = 'Acabando';
      statusIcon = Icons.trending_down_rounded;
      statusColor = const Color(0xFFD97706);
      activeBorder = const Color(0xFFD97706).withValues(alpha: 0.4);
    }

    return Material(
      color: surfaceColor,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _showAddItemModal(itemToEdit: item),
        onLongPress: () => _showItemActionSheet(item),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: activeBorder),
          ),
          child: Row(
            children: [
              // Ícone da Categoria
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: item.category.color.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  item.category.icon,
                  color: item.category.color,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),

              // Informações do Item
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w700,
                              color: textPrimary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7.5,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: statusColor.withValues(
                              alpha: isDark ? 0.20 : 0.10,
                            ),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: statusColor.withValues(
                                alpha: isDark ? 0.45 : 0.25,
                              ),
                              width: 1,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                statusIcon,
                                size: 11,
                                color: statusColor,
                              ),
                              const SizedBox(width: 3.5),
                              Text(
                                statusLabel,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: statusColor,
                                  letterSpacing: 0.1,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 6,
                      runSpacing: 2,
                      children: [
                        Text(
                          item.category.label,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: textSecondary,
                          ),
                        ),
                        if (item.expiryDate != null) ...[
                          Text('•',
                              style: TextStyle(
                                  fontSize: 10, color: textSecondary)),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.event_outlined,
                                size: 12,
                                color: item.isExpired
                                    ? const Color(0xFFDC2626)
                                    : textSecondary,
                              ),
                              const SizedBox(width: 3),
                              Text(
                                'Val: ${AppFormatters.formatShortDate(item.expiryDate!)}',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  color: item.isExpired
                                      ? const Color(0xFFDC2626)
                                      : textSecondary,
                                  fontWeight: item.isExpired
                                      ? FontWeight.w700
                                      : FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ] else if (item.daysRemaining <= 5) ...[
                          Text('•',
                              style: TextStyle(
                                  fontSize: 10, color: textSecondary)),
                          Text(
                            '~${item.daysRemaining}d restantes',
                            style: const TextStyle(
                              fontSize: 11.5,
                              color: Color(0xFFD97706),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                        if (widget.controller.getQuantityOnShoppingList(item.name) > 0) ...[
                          Text('•',
                              style: TextStyle(
                                  fontSize: 10, color: textSecondary)),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2.5,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.primaryGreen.withValues(
                                alpha: isDark ? 0.20 : 0.10,
                              ),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: AppColors.primaryGreen.withValues(
                                  alpha: isDark ? 0.40 : 0.25,
                                ),
                                width: 1,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.playlist_add_check_rounded,
                                  size: 11,
                                  color: AppColors.primaryGreen,
                                ),
                                const SizedBox(width: 3),
                                Text(
                                  'Na lista: ${widget.controller.getQuantityOnShoppingList(item.name) % 1 == 0 ? widget.controller.getQuantityOnShoppingList(item.name).toInt() : widget.controller.getQuantityOnShoppingList(item.name)} ${item.unit}',
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primaryGreen,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 10),

              // Stepper Vertical (+ / número / -)
              _buildVerticalStepper(context, item),
            ],
          ),
        ),
      ),
    );
  }
}
