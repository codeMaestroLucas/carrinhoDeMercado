import 'dart:ui';
import 'package:flutter/material.dart';
import '../models/shopping_models.dart';
import '../services/category_classifier.dart';
import '../services/shopping_controller.dart';
import '../theme/app_colors.dart';
import '../utils/formatters.dart';

class ShoppingListScreen extends StatefulWidget {
  const ShoppingListScreen({
    super.key,
    required this.controller,
  });

  final ShoppingController controller;

  @override
  State<ShoppingListScreen> createState() => _ShoppingListScreenState();
}

class _MarketBargainItem {
  const _MarketBargainItem({
    required this.item,
    required this.cheapestMarketPrice,
    required this.savingsAmount,
    required this.savingsPercent,
  });

  final ShoppingItem item;
  final double cheapestMarketPrice;
  final double? savingsAmount;
  final double? savingsPercent;
}

class _MarketBargainGroup {
  const _MarketBargainGroup({
    required this.market,
    required this.bargains,
  });

  final MarketProfile market;
  final List<_MarketBargainItem> bargains;

  double get totalSavings => bargains.fold<double>(
        0.0,
        (sum, b) => sum + (b.savingsAmount ?? 0.0),
      );
}

class _ShoppingListScreenState extends State<ShoppingListScreen> {
  final TextEditingController _quickAddController = TextEditingController();
  final FocusNode _quickAddFocus = FocusNode();
  String? _manualMarketOverrideForQuickAdd;

  @override
  void dispose() {
    _quickAddController.dispose();
    _quickAddFocus.dispose();
    super.dispose();
  }

  /// Dynamically detects whether the user typed a single item or pasted/typed multiple items.
  List<String> _detectItemsFromInput(String rawText) {
    return CategoryClassifier.parsePastedList(rawText);
  }

  void _handleQuickAdd() {
    final text = _quickAddController.text.trim();
    if (text.isEmpty) return;

    final detectedItems = _detectItemsFromInput(text);

    // Dynamically handle multiple items vs single item
    if (detectedItems.length > 1 ||
        text.contains('\n') ||
        text.contains(';')) {
      final result = widget.controller.addItemsFromPastedTextWithReport(
        text,
        overrideMarketId: _manualMarketOverrideForQuickAdd,
      );
      setState(() {
        _quickAddController.clear();
        _manualMarketOverrideForQuickAdd = null;
      });
      if (mounted) {
        final msg = result.skippedDuplicatesCount > 0
            ? '${result.addedCount} itens adicionados (${result.skippedDuplicatesCount} duplicados ignorados)'
            : '${result.addedCount} itens adicionados à lista!';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return;
    }

    final item = widget.controller.addSingleItem(
      text,
      marketId: _manualMarketOverrideForQuickAdd,
    );
    setState(() {
      _quickAddController.clear();
      _manualMarketOverrideForQuickAdd = null;
    });
    _quickAddFocus.requestFocus();

    if (!mounted) return;
    ScaffoldMessenger.of(context).clearSnackBars();
    if (item == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('"$text" já está na sua lista.'),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('"${item.name}" adicionado à lista!'),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  /// Computes which items in the current shopping list are historically cheaper at each market.
  List<_MarketBargainGroup> _computeMarketBargainGroups(
    List<ShoppingItem> items,
  ) {
    final byMarket = <String, List<_MarketBargainItem>>{};
    final marketProfiles = <String, MarketProfile>{};

    for (final item in items) {
      final recs = widget.controller.marketRecommendationsForProduct(item.name);
      if (recs.isEmpty) continue;

      final cheapest = recs.first;
      double? savingsAmt;
      double? savingsPct;
      if (recs.length >= 2) {
        final nextPrice = recs[1].averagePrice;
        final diff = nextPrice - cheapest.averagePrice;
        if (diff > 0.05 && nextPrice > 0) {
          savingsAmt = diff;
          savingsPct = (diff / nextPrice) * 100.0;
        }
      }

      marketProfiles[cheapest.market.id] = cheapest.market;
      byMarket.putIfAbsent(cheapest.market.id, () => []).add(
            _MarketBargainItem(
              item: item,
              cheapestMarketPrice: cheapest.averagePrice,
              savingsAmount: savingsAmt,
              savingsPercent: savingsPct,
            ),
          );
    }

    final groups = byMarket.entries.map((entry) {
      return _MarketBargainGroup(
        market: marketProfiles[entry.key]!,
        bargains: entry.value,
      );
    }).toList();

    groups.sort((a, b) => b.bargains.length.compareTo(a.bargains.length));
    return groups;
  }

  void _showMarketSavingsModal(List<_MarketBargainGroup> groups) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppColors.surface(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (modalContext) {
        final textPrimary = AppColors.textPrimary(modalContext);
        final textSecondary = AppColors.textSecondary(modalContext);
        final borderColor = AppColors.border(modalContext);

        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.65,
          minChildSize: 0.4,
          maxChildSize: 0.9,
          builder: (context, scrollController) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.primaryGreen.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          Icons.savings_outlined,
                          color: AppColors.primaryGreen,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Onde Comprar Mais Barato',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: textPrimary,
                              ),
                            ),
                            Text(
                              'Itens da sua lista agrupados pelo mercado com menor preço',
                              style: TextStyle(
                                fontSize: 12,
                                color: textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: Icon(Icons.close, size: 20, color: textSecondary),
                        onPressed: () => Navigator.of(modalContext).pop(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Expanded(
                    child: ListView.separated(
                      controller: scrollController,
                      itemCount: groups.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (context, idx) {
                        final group = groups[idx];
                        return Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppColors.subtleSurface(context),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: borderColor),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Row(
                                      children: [
                                        const Icon(
                                          Icons.storefront_rounded,
                                          size: 18,
                                          color: AppColors.primaryGreen,
                                        ),
                                        const SizedBox(width: 8),
                                        Flexible(
                                          child: Text(
                                            group.market.name,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w700,
                                              color: textPrimary,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 3,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppColors.primaryGreen.withValues(
                                        alpha: 0.15,
                                      ),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      '${group.bargains.length} ${group.bargains.length == 1 ? 'item mais barato' : 'itens mais baratos'}',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.accentGreen,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              if (group.totalSavings > 0.05) ...[
                                const SizedBox(height: 4),
                                Text(
                                  'Economia estimada de ${AppFormatters.formatCurrency(group.totalSavings)} comprando estes itens aqui',
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.accentGreen,
                                  ),
                                ),
                              ],
                              const SizedBox(height: 10),
                              Wrap(
                                spacing: 6,
                                runSpacing: 6,
                                children: group.bargains.map((b) {
                                  return Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 6,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppColors.surface(context),
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: borderColor),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          b.item.category.icon,
                                          size: 14,
                                          color: b.item.category.color,
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          b.item.name,
                                          style: TextStyle(
                                            fontSize: 12.5,
                                            fontWeight: FontWeight.w600,
                                            color: textPrimary,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          AppFormatters.formatCurrency(
                                            b.cheapestMarketPrice,
                                          ),
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.accentGreen,
                                          ),
                                        ),
                                        if (b.savingsPercent != null) ...[
                                          const SizedBox(width: 4),
                                          Text(
                                            '(-${b.savingsPercent!.toStringAsFixed(0)}%)',
                                            style: const TextStyle(
                                              fontSize: 10.5,
                                              fontWeight: FontWeight.w700,
                                              color: AppColors.primaryGreen,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  );
                                }).toList(),
                              ),
                            ],
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
      },
    );
  }

  Future<void> _showEditItemModal(
    ShoppingItem item, {
    bool focusPrice = true,
  }) async {
    final nameController = TextEditingController(text: item.name);
    final priceController = TextEditingController(
      text: item.price != null && item.price! > 0
          ? item.price!.toStringAsFixed(2).replaceAll('.', ',')
          : '',
    );
    ProductCategory selectedCategory = item.category;
    String selectedMarketId =
        item.marketId ?? widget.controller.selectedMarket.id;
    if (!widget.controller.markets.any((m) => m.id == selectedMarketId)) {
      selectedMarketId = widget.controller.selectedMarket.id;
    }

    String? errorText;
    final recommendations =
        widget.controller.marketRecommendationsForProduct(item.name);
    final recByMarketId = {
      for (final r in recommendations) r.market.id: r,
    };
    final cheapestMarketId =
        recommendations.isNotEmpty ? recommendations.first.market.id : null;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppColors.surface(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (modalContext) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final lastHistoricalPrice =
                widget.controller.findLastHistoricalPrice(
              nameController.text,
              marketId: selectedMarketId,
            );
            final textPrimary = AppColors.textPrimary(context);
            final textSecondary = AppColors.textSecondary(context);
            final subtleBg = AppColors.subtleSurface(context);

            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 16,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Icon(
                          selectedCategory.icon,
                          color: selectedCategory.color,
                          size: 22,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Configurar Preço e Produto',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: textPrimary,
                                ),
                          ),
                        ),
                        IconButton(
                          tooltip: 'Excluir item',
                          icon: const Icon(
                            Icons.delete_outline_rounded,
                            color: Color(0xFFEF4444),
                            size: 20,
                          ),
                          onPressed: () {
                            widget.controller.removeItem(item.id);
                            Navigator.of(modalContext).pop();
                          },
                        ),
                        IconButton(
                          icon: Icon(
                            Icons.close,
                            size: 20,
                            color: textSecondary,
                          ),
                          onPressed: () => Navigator.of(modalContext).pop(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    // Primary field: Price configuration right at the top
                    TextField(
                      controller: priceController,
                      autofocus: focusPrice,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      style: TextStyle(
                        color: textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                      decoration: InputDecoration(
                        labelText: 'Preço pago (R\$)',
                        hintText: 'Ex: 12,90',
                        prefixIcon: const Icon(
                          Icons.attach_money_rounded,
                          color: AppColors.primaryGreen,
                        ),
                        filled: true,
                        fillColor: subtleBg,
                        suffixIcon: priceController.text.isNotEmpty
                            ? IconButton(
                                icon: Icon(
                                  Icons.clear,
                                  size: 18,
                                  color: textSecondary,
                                ),
                                onPressed: () {
                                  setModalState(() {
                                    priceController.clear();
                                  });
                                },
                              )
                            : null,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onChanged: (_) => setModalState(() {}),
                    ),
                    if (lastHistoricalPrice != null) ...[
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: ActionChip(
                          avatar: const Icon(Icons.history_rounded, size: 15),
                          label: Text(
                            'Usar último preço: ${AppFormatters.formatCurrency(lastHistoricalPrice)}',
                            style: const TextStyle(fontSize: 12),
                          ),
                          onPressed: () {
                            setModalState(() {
                              priceController.text = lastHistoricalPrice
                                  .toStringAsFixed(2)
                                  .replaceAll('.', ',');
                            });
                          },
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    TextField(
                      controller: nameController,
                      autofocus: !focusPrice,
                      textCapitalization: TextCapitalization.sentences,
                      style: TextStyle(color: textPrimary),
                      decoration: InputDecoration(
                        labelText: 'Nome do produto',
                        errorText: errorText,
                        filled: true,
                        fillColor: subtleBg,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      onChanged: (_) {
                        if (errorText != null) {
                          setModalState(() => errorText = null);
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<ProductCategory>(
                      initialValue: selectedCategory,
                      decoration: InputDecoration(
                        labelText: 'Categoria',
                        filled: true,
                        fillColor: subtleBg,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      items: ProductCategory.values.map((cat) {
                        return DropdownMenuItem<ProductCategory>(
                          value: cat,
                          child: Row(
                            children: [
                              Icon(cat.icon, color: cat.color, size: 18),
                              const SizedBox(width: 10),
                              Text(cat.label),
                            ],
                          ),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setModalState(() {
                            selectedCategory = val;
                          });
                        }
                      },
                    ),
                    if (selectedCategory != item.category) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(
                            Icons.auto_awesome_rounded,
                            size: 14,
                            color: AppColors.accentGreen,
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'Este produto será salvo automaticamente na categoria "${selectedCategory.label}".',
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: AppColors.accentGreen,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 18),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primaryGreen,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                      ),
                      onPressed: () {
                        final newName = nameController.text.trim();
                        if (newName.isEmpty) return;
                        final parsedPrice =
                            AppFormatters.parsePrice(priceController.text);
                        final shouldClearPrice =
                            priceController.text.trim().isEmpty;
                        final categoryChanged =
                            selectedCategory != item.category;

                        final success = widget.controller.updateItem(
                          item.id,
                          name: newName,
                          category: selectedCategory,
                          marketId: selectedMarketId,
                          price: parsedPrice,
                          clearPrice: shouldClearPrice,
                        );
                        if (!success) {
                          setModalState(() {
                            errorText =
                                'Já existe um produto com esse nome na lista.';
                          });
                          return;
                        }
                        Navigator.of(modalContext).pop();
                        if (categoryChanged && this.mounted) {
                          ScaffoldMessenger.of(this.context).showSnackBar(
                            SnackBar(
                              content: Text(
                                '"$newName" registrado na categoria ${selectedCategory.label}!',
                              ),
                              behavior: SnackBarBehavior.floating,
                              duration: const Duration(seconds: 2),
                            ),
                          );
                        }
                      },
                      child: const Text(
                        'Salvar',
                        style: TextStyle(fontWeight: FontWeight.w700),
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

  Future<void> _showFinishPurchaseDialog() async {
    final checkedCount = widget.controller.checkedItemsCount;
    final totalCount = widget.controller.totalItemsCount;
    if (totalCount == 0) return;

    bool onlyChecked = checkedCount > 0;
    String selectedMarketId = widget.controller.selectedMarket.id;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final itemsToSave = onlyChecked
                ? widget.controller.allItems.where((e) => e.isChecked).toList()
                : widget.controller.allItems;
            final totalValue = itemsToSave.fold<double>(
              0.0,
              (sum, e) => sum + (e.price ?? 0.0),
            );

            return AlertDialog(
              backgroundColor: AppColors.surface(context),
              title: const Text('Finalizar Compra'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: selectedMarketId,
                    decoration: const InputDecoration(
                      labelText: 'Mercado',
                      border: OutlineInputBorder(),
                    ),
                    items: widget.controller.markets.map((m) {
                      return DropdownMenuItem<String>(
                        value: m.id,
                        child: Text(m.name),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setDialogState(() {
                          selectedMarketId = val;
                        });
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  if (checkedCount > 0 && checkedCount < totalCount)
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text(
                        'Apenas itens marcados',
                        style: TextStyle(fontSize: 14),
                      ),
                      value: onlyChecked,
                      onChanged: (val) {
                        setDialogState(() {
                          onlyChecked = val;
                        });
                      },
                    ),
                  const SizedBox(height: 8),
                  Text(
                    'Itens: ${itemsToSave.length}  •  Total: ${AppFormatters.formatCurrency(totalValue)}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('Cancelar'),
                ),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primaryGreen,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: itemsToSave.isEmpty
                      ? null
                      : () {
                          final record = widget.controller.finishPurchase(
                            marketId: selectedMarketId,
                            onlyChecked: onlyChecked,
                          );
                          Navigator.of(dialogContext).pop();
                          if (mounted && record != null) {
                            ScaffoldMessenger.of(this.context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'Compra salva no histórico (${record.marketName})!',
                                ),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          }
                        },
                  child: const Text('Salvar no Histórico'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _showFiltersBottomSheet() async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (modalContext) {
        return ListenableBuilder(
          listenable: widget.controller,
          builder: (context, _) {
            final controller = widget.controller;
            final activeMarket = controller.selectedMarket;
            final textPrimary = AppColors.textPrimary(context);
            final textSecondary = AppColors.textSecondary(context);

            return Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Filtros da Lista',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: textPrimary,
                        ),
                      ),
                      IconButton(
                        icon: Icon(Icons.close, size: 20, color: textSecondary),
                        onPressed: () => Navigator.of(modalContext).pop(),
                      ),
                    ],
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    activeThumbColor: AppColors.primaryGreen,
                    title: Text(
                      'Mostrar itens marcados',
                      style: TextStyle(fontSize: 14, color: textPrimary),
                    ),
                    value: controller.showCheckedItems,
                    onChanged: controller.setShowCheckedItems,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Filtrar por Categoria:',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: textSecondary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      ChoiceChip(
                        visualDensity: VisualDensity.compact,
                        label: const Text('Todas Categorias'),
                        selected: controller.categoryFilter == null,
                        onSelected: (_) => controller.setCategoryFilter(null),
                      ),
                      ...activeMarket.categoryOrder.map((cat) {
                        final isSelected = controller.categoryFilter == cat;
                        return ChoiceChip(
                          visualDensity: VisualDensity.compact,
                          avatar: Icon(
                            cat.icon,
                            size: 15,
                            color: cat.color,
                          ),
                          label: Text(cat.label),
                          selected: isSelected,
                          onSelected: (_) {
                            controller.setCategoryFilter(
                              isSelected ? null : cat,
                            );
                          },
                        );
                      }),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final items = controller.filteredAndSortedItems;
    final activeMarket = controller.selectedMarket;

    final rawInput = _quickAddController.text.trim();
    final detectedItems = _detectItemsFromInput(rawInput);
    final isMultipleDetected = detectedItems.length > 1;

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = AppColors.background(context);
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);

    final listTitle = 'Lista • ${activeMarket.name}';

    // Compute intuitive market bargain groups for the items currently in the list
    final bargainGroups = _computeMarketBargainGroups(controller.allItems);
    final activeMarketBargainGroup = bargainGroups
        .where((g) => g.market.id == activeMarket.id)
        .firstOrNull;

    return Scaffold(
      backgroundColor: bgColor,
      body: Column(
        children: [
          // Stylized Hero Header with ListTop.jpg & Curved Bottom Wave + Frosted Add Input
          _buildStylizedTopBanner(
            context,
            controller: controller,
            isDark: isDark,
            bgColor: bgColor,
            rawInput: rawInput,
            isMultipleDetected: isMultipleDetected,
            detectedCount: detectedItems.length,
          ),

          // Main Content Area seamlessly flowing from the curved header
          Expanded(
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 2, 18, 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Market Selector Pills (switches active market & reorganizes all items by its category order)
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: controller.markets.map((market) {
                              final isSelected = activeMarket.id == market.id;
                              return Padding(
                                padding: const EdgeInsets.only(right: 6),
                                child: ChoiceChip(
                                  visualDensity: VisualDensity.compact,
                                  avatar: Icon(
                                    Icons.storefront_outlined,
                                    size: 15,
                                    color: isSelected
                                        ? AppColors.primaryGreen
                                        : textSecondary,
                                  ),
                                  label: Text(market.name),
                                  selected: isSelected,
                                  onSelected: (_) {
                                    controller.selectMarket(market.id);
                                  },
                                ),
                              );
                            }).toList(),
                          ),
                        ),

                        // Intuitive Market Savings Guide ("Quais itens podem ser comprados mais baratos em tal mercado")
                        if (bargainGroups.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          _buildMarketBargainBanner(
                            context,
                            bargainGroups: bargainGroups,
                            activeMarketGroup: activeMarketBargainGroup,
                          ),
                        ],

                        const SizedBox(height: 10),

                        // Prominent Title + Filter Sliders Icon + Finish Purchase Action
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    listTitle,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 21,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: -0.4,
                                      color: textPrimary,
                                    ),
                                  ),
                                  Text(
                                    'Itens organizados na ordem de setores de ${activeMarket.name}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 11.5,
                                      color: textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (controller.categoryFilter != null ||
                                !controller.showCheckedItems)
                              Padding(
                                padding: const EdgeInsets.only(right: 4),
                                child: ActionChip(
                                  visualDensity: VisualDensity.compact,
                                  label: Text(
                                    controller.categoryFilter?.label ??
                                        'Sem marcados',
                                    style: const TextStyle(fontSize: 11),
                                  ),
                                  onPressed: () {
                                    controller.setCategoryFilter(null);
                                    controller.setShowCheckedItems(true);
                                  },
                                ),
                              ),
                            IconButton(
                              tooltip: 'Filtrar categorias e itens',
                              onPressed: _showFiltersBottomSheet,
                              icon: Icon(
                                Icons.tune_rounded,
                                color: (controller.categoryFilter != null ||
                                        !controller.showCheckedItems)
                                    ? AppColors.primaryGreen
                                    : textPrimary,
                                size: 22,
                              ),
                            ),
                            if (controller.totalItemsCount > 0)
                              PopupMenuButton<String>(
                                tooltip: 'Opções da lista',
                                icon: Icon(
                                  Icons.more_vert_rounded,
                                  color: textSecondary,
                                  size: 21,
                                ),
                                onSelected: (action) {
                                  if (action == 'finish') {
                                    _showFinishPurchaseDialog();
                                  } else if (action == 'clear_checked') {
                                    controller.clearCheckedItems();
                                  } else if (action == 'clear_all') {
                                    controller.clearAllItems();
                                  }
                                },
                                itemBuilder: (context) => [
                                  const PopupMenuItem(
                                    value: 'finish',
                                    child: Text(
                                      'Finalizar compra (salvar histórico)',
                                    ),
                                  ),
                                  if (controller.checkedItemsCount > 0)
                                    const PopupMenuItem(
                                      value: 'clear_checked',
                                      child: Text('Remover itens marcados'),
                                    ),
                                  const PopupMenuItem(
                                    value: 'clear_all',
                                    child: Text('Limpar toda a lista'),
                                  ),
                                ],
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                // Continuous list of items or empty state inside slivers to prevent vertical overflow when keyboard opens
                if (items.isEmpty)
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: _buildEmptyState(context),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(18, 0, 18, 84),
                    sliver: SliverList.separated(
                      itemCount: items.length,
                      separatorBuilder: (_, _) => Divider(
                        height: 1,
                        thickness: 1,
                        color: AppColors.divider(context),
                      ),
                      itemBuilder: (context, index) {
                        final item = items[index];
                        final bestRec = controller
                            .recommendCheapestMarketForProduct(item.name);
                        final isCheaperHere = bestRec != null;

                        return _buildStylizedRow(
                          context,
                          item,
                          isCheaperHighlight: isCheaperHere,
                          cheapestMarketName: bestRec?.market.name,
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
      floatingActionButton: controller.totalItemsCount > 0
          ? FloatingActionButton.extended(
              onPressed: _showFinishPurchaseDialog,
              backgroundColor: AppColors.primaryGreen,
              foregroundColor: Colors.white,
              elevation: 3,
              icon: const Icon(Icons.shopping_bag_outlined, size: 18),
              label: Text(
                controller.checkedItemsCount > 0
                    ? 'Finalizar (${controller.checkedItemsCount})'
                    : 'Finalizar Compra',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            )
          : null,
    );
  }

  Widget _buildMarketBargainBanner(
    BuildContext context, {
    required List<_MarketBargainGroup> bargainGroups,
    required _MarketBargainGroup? activeMarketGroup,
  }) {
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);

    // If a specific market tab is selected and has cheaper items, highlight those specific items
    if (activeMarketGroup != null && activeMarketGroup.bargains.isNotEmpty) {
      final itemNames =
          activeMarketGroup.bargains.map((b) => b.item.name).join(', ');
      return InkWell(
        onTap: () => _showMarketSavingsModal(bargainGroups),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          decoration: BoxDecoration(
            color: AppColors.primaryGreen.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: AppColors.primaryGreen.withValues(alpha: 0.35),
            ),
          ),
          child: Row(
            children: [
              const Icon(
                Icons.local_offer_rounded,
                size: 17,
                color: AppColors.primaryGreen,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Mais baratos no ${activeMarketGroup.market.name}: $itemNames',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 4),
              const Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.accentGreen,
              ),
            ],
          ),
        ),
      );
    }

    // Otherwise show a compact summary across markets so user can tap and see which items are cheaper where
    final topGroup = bargainGroups.first;
    final sampleNames =
        topGroup.bargains.take(3).map((b) => b.item.name).join(', ');
    return InkWell(
      onTap: () => _showMarketSavingsModal(bargainGroups),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: AppColors.primaryGreen.withValues(alpha: 0.11),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: AppColors.primaryGreen.withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.savings_outlined,
              size: 18,
              color: AppColors.primaryGreen,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Veja onde seus itens estão mais baratos',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: textPrimary,
                    ),
                  ),
                  Text(
                    '${topGroup.market.name}: $sampleNames${topGroup.bargains.length > 3 ? ' +${topGroup.bargains.length - 3}' : ''}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11.5,
                      color: textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'Ver itens',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStylizedTopBanner(
    BuildContext context, {
    required ShoppingController controller,
    required bool isDark,
    required Color bgColor,
    required String rawInput,
    required bool isMultipleDetected,
    required int detectedCount,
  }) {
    final topPadding = MediaQuery.of(context).padding.top;

    return SizedBox(
      height: topPadding + 185,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Clipped Image with Smooth Wave at the bottom
          ClipPath(
            clipper: _WaveHeaderClipper(),
            child: Stack(
              fit: StackFit.expand,
              children: [
                Image.asset(
                  'assets/imgs/ListTop.jpg',
                  fit: BoxFit.cover,
                  alignment: Alignment.center,
                ),
                // Subtle gradient overlay for contrast
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.black.withValues(alpha: isDark ? 0.50 : 0.28),
                        Colors.black.withValues(alpha: isDark ? 0.35 : 0.10),
                        bgColor.withValues(alpha: isDark ? 0.25 : 0.15),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 2. Top Actions Row: Dark/Light Mode Button in the exact top-right corner across all screens
          Positioned(
            top: topPadding + 6,
            left: 14,
            right: 12,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                _GlassCircleIconButton(
                  tooltip: isDark ? 'Modo Claro' : 'Modo Escuro',
                  icon: isDark
                      ? Icons.light_mode_rounded
                      : Icons.dark_mode_outlined,
                  onTap: controller.toggleDarkMode,
                ),
              ],
            ),
          ),

          // 3. Frosted Glass "Add Items" Pill Bar inside the image (inspired by reference image)
          Positioned(
            top: topPadding + 58,
            left: 18,
            right: 18,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.darkSurface.withValues(alpha: 0.84)
                        : Colors.white.withValues(alpha: 0.86),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: isDark
                          ? Colors.white.withValues(alpha: 0.14)
                          : Colors.white.withValues(alpha: 0.75),
                      width: 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.10),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _quickAddController,
                          focusNode: _quickAddFocus,
                          minLines: 1,
                          maxLines: 3,
                          textCapitalization: TextCapitalization.sentences,
                          onChanged: (_) => setState(() {}),
                          onSubmitted: (_) => _handleQuickAdd(),
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: isDark
                                ? AppColors.darkTextPrimary
                                : AppColors.lightTextPrimary,
                          ),
                          decoration: InputDecoration(
                            hintText:
                                'Adicionar itens (digite ou cole vários)...',
                            hintStyle: TextStyle(
                              color: isDark
                                  ? AppColors.darkTextSecondary
                                  : AppColors.lightTextSecondary,
                              fontSize: 13.5,
                            ),
                            border: InputBorder.none,
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                              vertical: 10,
                            ),
                            suffixIcon: rawInput.isNotEmpty
                                ? IconButton(
                                    tooltip: 'Limpar texto',
                                    visualDensity: VisualDensity.compact,
                                    icon: Icon(
                                      Icons.clear_rounded,
                                      size: 18,
                                      color: isDark
                                          ? AppColors.darkTextSecondary
                                          : AppColors.lightTextSecondary,
                                    ),
                                    onPressed: () {
                                      setState(() {
                                        _quickAddController.clear();
                                        _manualMarketOverrideForQuickAdd = null;
                                      });
                                    },
                                  )
                                : null,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Material(
                        color: AppColors.primaryGreen,
                        borderRadius: BorderRadius.circular(12),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: _handleQuickAdd,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.add_rounded,
                                  size: 18,
                                  color: Colors.white,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  isMultipleDetected
                                      ? 'Adicionar ($detectedCount)'
                                      : 'Adicionar',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStylizedRow(
    BuildContext context,
    ShoppingItem item, {
    required bool isCheaperHighlight,
    required String? cheapestMarketName,
  }) {
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);
    final hasPrice = item.price != null && item.price! > 0;
    final isChecked = item.isChecked;

    return Dismissible(
      key: ValueKey(item.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(
          color: const Color(0xFFFEE2E2),
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Icon(
          Icons.delete_outline_rounded,
          color: Color(0xFFEF4444),
          size: 20,
        ),
      ),
      onDismissed: (_) => widget.controller.removeItem(item.id),
      child: Row(
        children: [
          // Left 75%: Tapping toggles checked (ticado) state; long-pressing opens item configuration
          Expanded(
            flex: 3,
            child: InkWell(
              onTap: () => widget.controller.toggleItemChecked(item.id),
              onLongPress: () => _showEditItemModal(item, focusPrice: true),
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Row(
                  children: [
                    // Category Icon / Checked Badge
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: isChecked
                            ? AppColors.primaryGreen.withValues(alpha: 0.16)
                            : item.category.color.withValues(alpha: 0.13),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        isChecked ? Icons.check_rounded : item.category.icon,
                        size: 17,
                        color: isChecked
                            ? AppColors.primaryGreen
                            : item.category.color,
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Product Name + subtle bargain badge if cheaper in a known market
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.name,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: isChecked ? textSecondary : textPrimary,
                              decoration: isChecked
                                  ? TextDecoration.lineThrough
                                  : TextDecoration.none,
                              decorationColor: textSecondary,
                            ),
                          ),
                          if (isCheaperHighlight && cheapestMarketName != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.trending_down_rounded,
                                    size: 13,
                                    color: AppColors.accentGreen,
                                  ),
                                  const SizedBox(width: 4),
                                  Flexible(
                                    child: Text(
                                      'Mais barato no $cheapestMarketName',
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.accentGreen,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Right 25%: Priced status indicator icon + 3 dots button to open item configuration
          Expanded(
            flex: 1,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Tooltip(
                    message:
                        hasPrice ? 'Produto precificado' : 'Sem preço definido',
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: () => _showEditItemModal(item, focusPrice: true),
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: hasPrice
                              ? AppColors.primaryGreen.withValues(alpha: 0.14)
                              : Colors.transparent,
                          border: Border.all(
                            color: hasPrice
                                ? AppColors.primaryGreen
                                : textSecondary.withValues(alpha: 0.35),
                            width: 1.4,
                          ),
                        ),
                        child: Icon(
                          hasPrice
                              ? Icons.sell_rounded
                              : Icons.sell_outlined,
                          size: 14,
                          color: hasPrice
                              ? AppColors.primaryGreen
                              : textSecondary.withValues(alpha: 0.65),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Tooltip(
                    message: 'Configurar item',
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: () => _showEditItemModal(item, focusPrice: true),
                      child: Padding(
                        padding: const EdgeInsets.all(6),
                        child: Icon(
                          Icons.more_vert_rounded,
                          size: 20,
                          color: textSecondary,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    final controller = widget.controller;
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);

    if (controller.totalItemsCount > 0) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Nenhum item para este filtro.',
                style: TextStyle(color: textSecondary, fontSize: 14),
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () {
                  controller.setCategoryFilter(null);
                  controller.setShowCheckedItems(true);
                  controller.setFilterBySelectedMarket(false);
                },
                child: const Text('Mostrar todos os itens'),
              ),
            ],
          ),
        ),
      );
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.shopping_basket_outlined,
              size: 72,
              color: textSecondary.withValues(alpha: 0.45),
            ),
            const SizedBox(height: 14),
            Text(
              'Sua lista está vazia',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Digite um produto ou cole uma lista inteira na barra acima e toque em Adicionar.',
              style: TextStyle(fontSize: 13, color: textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

/// Custom S-curve wave clipper matching the organic curved header from the design reference image
class _WaveHeaderClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final path = Path();
    path.lineTo(0, size.height - 28);

    // First gentle hill up, then swooping down on the right
    final firstControlPoint = Offset(size.width * 0.26, size.height - 48);
    final firstEndPoint = Offset(size.width * 0.54, size.height - 22);
    path.quadraticBezierTo(
      firstControlPoint.dx,
      firstControlPoint.dy,
      firstEndPoint.dx,
      firstEndPoint.dy,
    );

    final secondControlPoint = Offset(size.width * 0.80, size.height + 4);
    final secondEndPoint = Offset(size.width, size.height - 18);
    path.quadraticBezierTo(
      secondControlPoint.dx,
      secondControlPoint.dy,
      secondEndPoint.dx,
      secondEndPoint.dy,
    );

    path.lineTo(size.width, 0);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

class _GlassCircleIconButton extends StatelessWidget {
  const _GlassCircleIconButton({
    required this.icon,
    required this.onTap,
    this.tooltip,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip ?? '',
      child: GestureDetector(
        onTap: onTap,
        child: _GlassCircleIcon(icon: icon),
      ),
    );
  }
}

class _GlassCircleIcon extends StatelessWidget {
  const _GlassCircleIcon({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return ClipOval(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.black.withValues(alpha: 0.28),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.35),
              width: 1,
            ),
          ),
          child: Icon(
            icon,
            size: 19,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}
