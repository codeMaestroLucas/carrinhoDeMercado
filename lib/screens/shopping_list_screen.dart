import 'package:flutter/material.dart';
import '../models/shopping_models.dart';
import '../services/category_classifier.dart';
import '../services/shopping_controller.dart';
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
      backgroundColor: Colors.white,
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
                                  color: const Color(0xFF1E293B),
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
                          icon: const Icon(Icons.close, size: 20),
                          onPressed: () => Navigator.of(modalContext).pop(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: nameController,
                      autofocus: !focusPrice,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: InputDecoration(
                        labelText: 'Nome do produto',
                        errorText: errorText,
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
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
                        fillColor: const Color(0xFFF8FAFC),
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
                                  ? const Color(0xFF0F766E)
                                  : const Color(0xFF1E293B),
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
                        fillColor: const Color(0xFFF8FAFC),
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
                      decoration: InputDecoration(
                        labelText: 'Preço pago (R\$)',
                        hintText: 'Ex: 12,90',
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        suffixIcon: priceController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear, size: 18),
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
              backgroundColor: Colors.white,
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

    return Scaffold(
      appBar: AppBar(
        title: const Text('Lista de Compras'),
        actions: [
          if (controller.totalItemsCount > 0)
            PopupMenuButton<String>(
              tooltip: 'Opções da lista',
              icon: const Icon(Icons.more_horiz_rounded),
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
            ),
        ],
      ),
      body: Column(
        children: [
          // Clean Header: Dynamic Single/Multi Input + Prominent Add Button + Market Lists + Category Filters
          Container(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(
                bottom: BorderSide(color: Color(0xFFE2E8F0), width: 1),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _quickAddController,
                        focusNode: _quickAddFocus,
                        minLines: 1,
                        maxLines: 4,
                        textCapitalization: TextCapitalization.sentences,
                        onChanged: (_) => setState(() {}),
                        style: const TextStyle(fontSize: 14, height: 1.4),
                        decoration: InputDecoration(
                          hintText:
                              'Digite um produto ou cole vários itens...',
                          hintStyle: const TextStyle(
                            color: Color(0xFF94A3B8),
                            fontSize: 14,
                            height: 1.4,
                          ),
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                          isDense: true,
                          constraints: const BoxConstraints(minHeight: 44),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                          suffixIcon: rawInput.isNotEmpty
                              ? IconButton(
                                  tooltip: 'Limpar texto',
                                  icon: const Icon(
                                    Icons.clear_rounded,
                                    size: 18,
                                    color: Color(0xFF94A3B8),
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      _quickAddController.clear();
                                      _manualMarketOverrideForQuickAdd = null;
                                    });
                                  },
                                )
                              : null,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFFE2E8F0),
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFFE2E8F0),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(
                      height: 44,
                      child: FilledButton.icon(
                        onPressed: _handleQuickAdd,
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF0D9488),
                          foregroundColor: Colors.white,
                          elevation: 1,
                          minimumSize: const Size(0, 44),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        icon: const Icon(
                          Icons.add_circle_outline_rounded,
                          size: 18,
                        ),
                        label: Text(
                          isMultipleDetected
                              ? 'Adicionar (${detectedItems.length})'
                              : 'Adicionar',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),

                // Dynamic Feedback Banner when typing/pasting 1 or multiple products
                if (rawInput.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: (bestMarketRec != null || isMultipleDetected)
                          ? const Color(0xFFF0FDFA)
                          : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: (bestMarketRec != null || isMultipleDetected)
                            ? const Color(0xFFCCFBF1)
                            : const Color(0xFFE2E8F0),
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
                              color: (bestMarketRec != null || isMultipleDetected)
                                  ? const Color(0xFF0F766E)
                                  : const Color(0xFF64748B),
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
                                      ? const Color(0xFF0F766E)
                                      : const Color(0xFF64748B),
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
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: const Color(0xFFCBD5E1),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  _manualMarketOverrideForQuickAdd == null &&
                                          isMultipleDetected
                                      ? 'Auto (Mais barato)'
                                      : 'Ir p/ ${effectiveTargetMarket.name}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF334155),
                                  ),
                                ),
                                const SizedBox(width: 2),
                                const Icon(
                                  Icons.arrow_drop_down_rounded,
                                  size: 16,
                                  color: Color(0xFF64748B),
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

                const SizedBox(height: 8),
                // Simultaneous Lists by Market selector bar
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      ChoiceChip(
                        visualDensity: VisualDensity.compact,
                        avatar: const Icon(
                          Icons.layers_outlined,
                          size: 15,
                          color: Color(0xFF475569),
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
                        final count = controller.itemCountForMarket(market.id);
                        final isSelected = controller.filterBySelectedMarket &&
                            activeMarket.id == market.id;
                        return Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            visualDensity: VisualDensity.compact,
                            avatar: const Icon(
                              Icons.storefront_outlined,
                              size: 15,
                              color: Color(0xFF0F766E),
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

                const SizedBox(height: 6),
                // Category Filter Bar
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      FilterChip(
                        visualDensity: VisualDensity.compact,
                        selected: controller.showCheckedItems,
                        onSelected: controller.setShowCheckedItems,
                        label: const Text('Mostrar ticados'),
                      ),
                      const SizedBox(width: 6),
                      ChoiceChip(
                        visualDensity: VisualDensity.compact,
                        label: const Text('Todas Categorias'),
                        selected: controller.categoryFilter == null,
                        onSelected: (_) => controller.setCategoryFilter(null),
                      ),
                      const SizedBox(width: 6),
                      ...activeMarket.categoryOrder.map((cat) {
                        final isSelected = controller.categoryFilter == cat;
                        return Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
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
                          ),
                        );
                      }),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Table-style continuous list of items
          Expanded(
            child: items.isEmpty
                ? _buildEmptyState(context)
                : Material(
                    color: Colors.white,
                    child: ListView.separated(
                      padding: const EdgeInsets.only(bottom: 80),
                      itemCount: items.length,
                      separatorBuilder: (_, _) => const Divider(
                        height: 1,
                        thickness: 1,
                        color: Color(0xFFF1F5F9),
                      ),
                      itemBuilder: (context, index) {
                        return _buildTableRow(context, items[index]);
                      },
                    ),
                  ),
          ),
        ],
      ),
      floatingActionButton: controller.checkedItemsCount > 0
          ? FloatingActionButton.extended(
              onPressed: _showFinishPurchaseDialog,
              elevation: 2,
              icon: const Icon(Icons.check_rounded, size: 18),
              label: Text(
                'Finalizar (${controller.checkedItemsCount})',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            )
          : null,
    );
  }

  Widget _buildTableRow(BuildContext context, ShoppingItem item) {
    final itemMarket = widget.controller.marketById(item.marketId);
    final showMarketTag = !widget.controller.filterBySelectedMarket;

    return Dismissible(
      key: ValueKey(item.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        color: const Color(0xFFFEE2E2),
        child: const Icon(
          Icons.delete_outline_rounded,
          color: Color(0xFFEF4444),
          size: 20,
        ),
      ),
      onDismissed: (_) => widget.controller.removeItem(item.id),
      child: InkWell(
        onTap: () => _showEditItemModal(item, focusPrice: true),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          child: Row(
            children: [
              // Tapping on the Checkbox OR the Product Name ticks the item
              Flexible(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => widget.controller.toggleItemChecked(item.id),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Checkbox(
                          value: item.isChecked,
                          onChanged: (_) =>
                              widget.controller.toggleItemChecked(item.id),
                          visualDensity: VisualDensity.compact,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: Text(
                              item.name,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w400,
                                decoration: item.isChecked
                                    ? TextDecoration.lineThrough
                                    : null,
                                color: item.isChecked
                                    ? const Color(0xFF94A3B8)
                                    : const Color(0xFF1E293B),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const Spacer(),
              if (showMarketTag)
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 95),
                  child: Text(
                    itemMarket.name,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                ),
              if (item.price == null || item.price! <= 0)
                const Tooltip(
                  message: 'Sem preço preenchido (toque para informar)',
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 4),
                    child: Icon(
                      Icons.money_off_csred_outlined,
                      size: 18,
                      color: Color(0xFFF59E0B),
                    ),
                  ),
                ),
              Tooltip(
                message: item.category.label,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: Icon(
                    item.category.icon,
                    size: 19,
                    color: item.isChecked
                        ? item.category.color.withValues(alpha: 0.45)
                        : item.category.color,
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Editar produto, mercado e preço',
                visualDensity: VisualDensity.compact,
                icon: const Icon(
                  Icons.more_vert_rounded,
                  size: 19,
                  color: Color(0xFF94A3B8),
                ),
                onPressed: () => _showEditItemModal(item, focusPrice: true),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    final controller = widget.controller;

    if (controller.totalItemsCount > 0) {
      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Nenhum item para este filtro.',
                style: TextStyle(color: Color(0xFF64748B), fontSize: 14),
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

    return const Center(
      child: SingleChildScrollView(
        padding: EdgeInsets.symmetric(horizontal: 32, vertical: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.checklist_rounded,
              size: 40,
              color: Color(0xFFCBD5E1),
            ),
            SizedBox(height: 10),
            Text(
              'Sua lista está vazia',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Color(0xFF334155),
              ),
            ),
            SizedBox(height: 6),
            Text(
              'Digite um produto ou cole uma lista inteira no campo acima e toque em Adicionar.',
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
