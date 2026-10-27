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
      final assignedMarket = widget.controller.marketById(item.marketId);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '"${item.name}" adicionado na lista de ${assignedMarket.name}',
          ),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _showEditItemModal(
    ShoppingItem item, {
    bool focusPrice = true,
  }) async {
    final nameController = TextEditingController(text: item.name);
    final priceController = TextEditingController(
      text: item.price != null
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
                            'Editar Produto',
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
                    DropdownButtonFormField<String>(
                      initialValue: selectedMarketId,
                      isExpanded: true,
                      decoration: InputDecoration(
                        labelText: 'Mercado para compra (Lista)',
                        filled: true,
                        fillColor: subtleBg,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      items: widget.controller.markets.map((market) {
                        final rec = recByMarketId[market.id];
                        final isCheapest = market.id == cheapestMarketId &&
                            recommendations.isNotEmpty;
                        String label = market.name;
                        if (rec != null) {
                          label +=
                              ' • média ${AppFormatters.formatCurrency(rec.averagePrice)}';
                          if (isCheapest) {
                            label += ' (Mais barato)';
                          }
                        }
                        return DropdownMenuItem<String>(
                          value: market.id,
                          child: Text(
                            label,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: isCheapest
                                  ? FontWeight.w600
                                  : FontWeight.normal,
                              color: isCheapest
                                  ? AppColors.accentGreen
                                  : textPrimary,
                            ),
                          ),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setModalState(() {
                            selectedMarketId = val;
                          });
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
                    const SizedBox(height: 12),
                    TextField(
                      controller: priceController,
                      autofocus: focusPrice,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      style: TextStyle(color: textPrimary),
                      decoration: InputDecoration(
                        labelText: 'Preço pago (R\$)',
                        hintText: 'Ex: 12,90',
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
                          borderRadius: BorderRadius.circular(10),
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
                            'Último preço: ${AppFormatters.formatCurrency(lastHistoricalPrice)}',
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
                    const SizedBox(height: 18),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primaryGreen,
                        foregroundColor: Colors.white,
                      ),
                      onPressed: () {
                        final newName = nameController.text.trim();
                        if (newName.isEmpty) return;
                        final parsedPrice =
                            AppFormatters.parsePrice(priceController.text);
                        final shouldClearPrice =
                            priceController.text.trim().isEmpty;

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
                      },
                      child: const Text('Salvar'),
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
    final singleTypedProduct =
        detectedItems.length == 1 ? detectedItems.first : rawInput;

    final bestMarketRec =
        (!isMultipleDetected && singleTypedProduct.isNotEmpty)
            ? controller.recommendCheapestMarketForProduct(singleTypedProduct)
            : null;
    final effectiveTargetMarketId = _manualMarketOverrideForQuickAdd ??
        bestMarketRec?.market.id ??
        activeMarket.id;
    final effectiveTargetMarket =
        controller.marketById(effectiveTargetMarketId);

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = AppColors.background(context);
    final surfaceColor = AppColors.surface(context);
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);

    final listTitle = controller.filterBySelectedMarket
        ? activeMarket.name
        : 'Lista de Compras';

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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 2, 18, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Dynamic Feedback Banner when typing/pasting 1 or multiple products
                      if (rawInput.isNotEmpty) ...[
                        Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: (bestMarketRec != null || isMultipleDetected)
                                ? AppColors.primaryGreen.withValues(alpha: 0.12)
                                : surfaceColor,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color:
                                  (bestMarketRec != null || isMultipleDetected)
                                      ? AppColors.primaryGreen
                                          .withValues(alpha: 0.35)
                                      : AppColors.border(context),
                            ),
                          ),
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            alignment: WrapAlignment.spaceBetween,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    isMultipleDetected
                                        ? Icons.playlist_add_check_rounded
                                        : (bestMarketRec != null
                                            ? Icons.trending_down_rounded
                                            : Icons.storefront_outlined),
                                    size: 16,
                                    color: (bestMarketRec != null ||
                                            isMultipleDetected)
                                        ? AppColors.accentGreen
                                        : textSecondary,
                                  ),
                                  const SizedBox(width: 6),
                                  Flexible(
                                    child: Text(
                                      isMultipleDetected
                                          ? '${detectedItems.length} produtos identificados automaticamente no texto!'
                                          : (bestMarketRec != null
                                              ? 'Compensa mais no ${bestMarketRec.market.name} (média ${AppFormatters.formatCurrency(bestMarketRec.averagePrice)})'
                                              : 'Sem histórico de preço para "$singleTypedProduct"'),
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: (bestMarketRec != null ||
                                                isMultipleDetected)
                                            ? FontWeight.w600
                                            : FontWeight.normal,
                                        color: (bestMarketRec != null ||
                                                isMultipleDetected)
                                            ? AppColors.accentGreen
                                            : textSecondary,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              PopupMenuButton<String>(
                                tooltip: 'Escolher mercado para adicionar',
                                onSelected: (marketId) {
                                  setState(() {
                                    _manualMarketOverrideForQuickAdd = marketId;
                                  });
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: surfaceColor,
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(
                                      color: AppColors.border(context),
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        _manualMarketOverrideForQuickAdd ==
                                                    null &&
                                                isMultipleDetected
                                            ? 'Auto (Mais barato)'
                                            : 'Ir p/ ${effectiveTargetMarket.name}',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                          color: textPrimary,
                                        ),
                                      ),
                                      const SizedBox(width: 2),
                                      Icon(
                                        Icons.arrow_drop_down_rounded,
                                        size: 16,
                                        color: textSecondary,
                                      ),
                                    ],
                                  ),
                                ),
                                itemBuilder: (context) {
                                  return controller.markets.map((m) {
                                    return PopupMenuItem<String>(
                                      value: m.id,
                                      child: Text(m.name),
                                    );
                                  }).toList();
                                },
                              ),
                            ],
                          ),
                        ),
                      ],

                      // Subtitle inspired by "Shared with..." / Market status
                      Text(
                        controller.isCloudConnected
                            ? 'Sincronizado • Espaço ${controller.sharedSpaceCode}'
                            : 'Selecione o mercado da lista',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: textSecondary,
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Market Selector Pills
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            ChoiceChip(
                              visualDensity: VisualDensity.compact,
                              avatar: Icon(
                                Icons.layers_outlined,
                                size: 15,
                                color: !controller.filterBySelectedMarket
                                    ? AppColors.primaryGreen
                                    : textSecondary,
                              ),
                              label: Text(
                                'Todos Mercados (${controller.totalItemsCount})',
                              ),
                              selected: !controller.filterBySelectedMarket,
                              onSelected: (_) =>
                                  controller.setFilterBySelectedMarket(false),
                            ),
                            const SizedBox(width: 6),
                            ...controller.markets.map((market) {
                              final count =
                                  controller.itemCountForMarket(market.id);
                              final isSelected =
                                  controller.filterBySelectedMarket &&
                                      activeMarket.id == market.id;
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
                                  label: Text('${market.name} ($count)'),
                                  selected: isSelected,
                                  onSelected: (_) {
                                    controller.setFilterBySelectedMarket(
                                      true,
                                      marketId: market.id,
                                    );
                                  },
                                ),
                              );
                            }),
                          ],
                        ),
                      ),

                      const SizedBox(height: 12),

                      // Prominent Title + Filter Sliders Icon (matching inspiration image)
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              listTitle,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.4,
                                color: textPrimary,
                              ),
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
                                      'Sem ticados',
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
                        ],
                      ),
                    ],
                  ),
                ),

                // Table-style continuous list of items with sleek circular action buttons
                Expanded(
                  child: items.isEmpty
                      ? _buildEmptyState(context)
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(18, 0, 18, 84),
                          itemCount: items.length,
                          separatorBuilder: (_, _) => Divider(
                            height: 1,
                            thickness: 1,
                            color: AppColors.divider(context),
                          ),
                          itemBuilder: (context, index) {
                            return _buildStylizedRow(context, items[index]);
                          },
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
      floatingActionButton: controller.checkedItemsCount > 0
          ? FloatingActionButton.extended(
              onPressed: _showFinishPurchaseDialog,
              backgroundColor: AppColors.primaryGreen,
              foregroundColor: Colors.white,
              elevation: 3,
              icon: const Icon(Icons.check_rounded, size: 18),
              label: Text(
                'Finalizar (${controller.checkedItemsCount})',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            )
          : null,
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
      height: topPadding + 190,
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

          // 2. Top Actions Row (Theme Toggle + List Options)
          Positioned(
            top: topPadding + 6,
            left: 14,
            right: 14,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Dark/Light Mode Glass Pill Button
                _GlassCircleIconButton(
                  tooltip: isDark ? 'Modo Claro' : 'Modo Escuro',
                  icon: isDark
                      ? Icons.light_mode_rounded
                      : Icons.dark_mode_outlined,
                  onTap: controller.toggleDarkMode,
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (controller.totalItemsCount > 0)
                      PopupMenuButton<String>(
                        tooltip: 'Opções da lista',
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
                            child: Text('Finalizar compra (salvar histórico)'),
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
                        child: const _GlassCircleIcon(
                          icon: Icons.more_horiz_rounded,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),

          // 3. Frosted Glass "Add Items" Pill Bar inside the image (inspired by reference image)
          Positioned(
            top: topPadding + 62,
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
                      // Add action button supporting both single "+" style and label for accessibility/tests
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

  Widget _buildStylizedRow(BuildContext context, ShoppingItem item) {
    final itemMarket = widget.controller.marketById(item.marketId);
    final showMarketTag = !widget.controller.filterBySelectedMarket;
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);

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
      child: InkWell(
        onTap: () => _showEditItemModal(item, focusPrice: true),
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 11),
          child: Row(
            children: [
              // Category subtle icon indicator + Tappable Product Name
              Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => widget.controller.toggleItemChecked(item.id),
                  child: Row(
                    children: [
                      Icon(
                        item.category.icon,
                        size: 18,
                        color: item.isChecked
                            ? item.category.color.withValues(alpha: 0.4)
                            : item.category.color,
                      ),
                      const SizedBox(width: 10),
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
                                decoration: item.isChecked
                                    ? TextDecoration.lineThrough
                                    : null,
                                color: item.isChecked
                                    ? textSecondary
                                    : textPrimary,
                              ),
                            ),
                            if (showMarketTag)
                              Text(
                                itemMarket.name,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: textSecondary,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(width: 8),

              // Price / Value column (inspired by the clean number column in reference image)
              GestureDetector(
                onTap: () => _showEditItemModal(item, focusPrice: true),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: item.price != null && item.price! > 0
                      ? Text(
                          AppFormatters.formatCurrency(item.price!),
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            color: item.isChecked ? textSecondary : textPrimary,
                          ),
                        )
                      : Tooltip(
                          message: 'Informar preço',
                          child: Text(
                            'R\$ --',
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w500,
                              color: textSecondary.withValues(alpha: 0.7),
                            ),
                          ),
                        ),
                ),
              ),

              const SizedBox(width: 6),

              // Circular Outlined Check/Add Button (Green like the "+" circle in reference image)
              Tooltip(
                message: item.isChecked ? 'Desmarcar item' : 'Marcar item',
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () => widget.controller.toggleItemChecked(item.id),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: item.isChecked
                          ? AppColors.primaryGreen
                          : Colors.transparent,
                      border: Border.all(
                        color: AppColors.primaryGreen,
                        width: 1.5,
                      ),
                    ),
                    child: Icon(
                      Icons.check_rounded,
                      size: 16,
                      color: item.isChecked
                          ? Colors.white
                          : AppColors.primaryGreen,
                    ),
                  ),
                ),
              ),

              const SizedBox(width: 8),

              // Circular Outlined Minus/Options Button (Grey like the "-" circle in reference image)
              Tooltip(
                message: 'Editar ou remover item',
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () => _showEditItemModal(item, focusPrice: true),
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: textSecondary.withValues(alpha: 0.45),
                        width: 1.4,
                      ),
                    ),
                    child: Icon(
                      Icons.more_horiz_rounded,
                      size: 16,
                      color: textSecondary,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    final controller = widget.controller;
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);

    if (controller.totalItemsCount > 0) {
      return Center(
        child: SingleChildScrollView(
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
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.checklist_rounded,
              size: 40,
              color: textSecondary.withValues(alpha: 0.5),
            ),
            const SizedBox(height: 10),
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
          width: 34,
          height: 34,
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
            size: 18,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}
