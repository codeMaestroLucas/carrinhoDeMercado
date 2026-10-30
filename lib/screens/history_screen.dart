import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../models/shopping_models.dart';
import '../services/category_classifier.dart';
import '../services/receipt_scanner_service.dart';
import '../services/shopping_controller.dart';
import '../theme/app_colors.dart';
import '../utils/formatters.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({
    super.key,
    required this.controller,
  });

  final ShoppingController controller;

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class ProductHistoryOccurrence {
  const ProductHistoryOccurrence({
    required this.productName,
    required this.category,
    required this.price,
    required this.marketName,
    required this.date,
  });

  final String productName;
  final ProductCategory category;
  final double price;
  final String marketName;
  final DateTime date;
}

class MarketProductStats {
  const MarketProductStats({
    required this.marketName,
    required this.averagePrice,
    required this.lastPrice,
    required this.lastDate,
    required this.purchaseCount,
  });

  final String marketName;
  final double averagePrice;
  final double lastPrice;
  final DateTime lastDate;
  final int purchaseCount;
}

class ProductHistoryAggregate {
  ProductHistoryAggregate({
    required this.normalizedKey,
    required this.displayName,
    required this.category,
    required List<ProductHistoryOccurrence> occurrences,
  }) : occurrences = List<ProductHistoryOccurrence>.from(occurrences)
          ..sort((a, b) => b.date.compareTo(a.date));

  final String normalizedKey;
  final String displayName;
  final ProductCategory category;

  /// Sorted from newest (index 0) to oldest
  final List<ProductHistoryOccurrence> occurrences;

  /// Occurrences that have a valid price > 0 (newest first)
  List<ProductHistoryOccurrence> get pricedOccurrences =>
      occurrences.where((e) => e.price > 0).toList();

  /// Chronological order (oldest to newest) for time-series chart
  List<ProductHistoryOccurrence> get chronologicalPricedOccurrences =>
      pricedOccurrences.reversed.toList();

  double get lastPrice =>
      pricedOccurrences.isNotEmpty ? pricedOccurrences.first.price : 0.0;

  String get lastMarket =>
      pricedOccurrences.isNotEmpty
          ? pricedOccurrences.first.marketName
          : occurrences.first.marketName;

  DateTime get lastDate =>
      pricedOccurrences.isNotEmpty
          ? pricedOccurrences.first.date
          : occurrences.first.date;

  /// Percentage variation comparing the latest price against the immediately previous purchase price.
  double? get variationPercentFromLastTime {
    final priced = pricedOccurrences;
    if (priced.length < 2) return null;
    final latest = priced[0].price;
    final previous = priced[1].price;
    if (previous <= 0) return null;
    return ((latest - previous) / previous) * 100.0;
  }

  double? get previousPrice {
    final priced = pricedOccurrences;
    if (priced.length < 2) return null;
    return priced[1].price;
  }

  double get averagePrice {
    final priced = pricedOccurrences;
    if (priced.isEmpty) return 0.0;
    final sum = priced.fold<double>(0.0, (acc, item) => acc + item.price);
    return sum / priced.length;
  }

  ProductHistoryOccurrence? get minPriceOccurrence {
    final priced = pricedOccurrences;
    if (priced.isEmpty) return null;
    return priced.reduce((a, b) => a.price <= b.price ? a : b);
  }

  ProductHistoryOccurrence? get maxPriceOccurrence {
    final priced = pricedOccurrences;
    if (priced.isEmpty) return null;
    return priced.reduce((a, b) => a.price >= b.price ? a : b);
  }

  /// Markets ranked from cheapest average price to most expensive
  List<MarketProductStats> get marketRanking {
    final byMarket = <String, List<ProductHistoryOccurrence>>{};
    for (final occ in pricedOccurrences) {
      byMarket.putIfAbsent(occ.marketName, () => []).add(occ);
    }

    final stats = byMarket.entries.map((entry) {
      final list = entry.value..sort((a, b) => b.date.compareTo(a.date));
      final avg =
          list.fold<double>(0.0, (s, e) => s + e.price) / list.length;
      return MarketProductStats(
        marketName: entry.key,
        averagePrice: avg,
        lastPrice: list.first.price,
        lastDate: list.first.date,
        purchaseCount: list.length,
      );
    }).toList();

    stats.sort((a, b) => a.averagePrice.compareTo(b.averagePrice));
    return stats;
  }

  /// Insight comparing the cheapest market with the most expensive / second market
  String? get marketComparisonInsight {
    final ranking = marketRanking;
    if (ranking.length < 2) return null;
    final cheapest = ranking.first;
    final compared = ranking.last;
    if (compared.averagePrice <= 0) return null;
    final diffPercent =
        ((compared.averagePrice - cheapest.averagePrice) /
                compared.averagePrice) *
            100.0;
    if (diffPercent < 0.5) {
      return '${cheapest.marketName} e ${compared.marketName} têm preços médios praticamente iguais para este item.';
    }
    return '${cheapest.marketName} é ${diffPercent.toStringAsFixed(0)}% mais barato para este item que ${compared.marketName}.';
  }
}

class _HistoryScreenState extends State<HistoryScreen> {
  final TextEditingController _searchController = TextEditingController();
  String? _selectedMarketNameFilter;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<String> _availableMarketNames(List<PurchaseRecord> records) {
    final names = <String>{};
    for (final m in widget.controller.markets) {
      names.add(m.name);
    }
    for (final r in records) {
      names.add(r.marketName);
    }
    final sorted = names.toList()..sort();
    return sorted;
  }

  ProductHistoryAggregate? _buildAggregateForProduct(
    String productName, {
    List<PurchaseRecord>? sourceRecords,
  }) {
    final targetKey = CategoryClassifier.normalize(productName);
    if (targetKey.isEmpty) return null;

    final records = sourceRecords ?? widget.controller.history;
    final occurrences = <ProductHistoryOccurrence>[];
    String? displayName;
    ProductCategory? category;

    for (final record in records) {
      for (final item in record.items) {
        if (CategoryClassifier.normalize(item.name) == targetKey) {
          displayName ??= item.name;
          category ??= item.category;
          occurrences.add(
            ProductHistoryOccurrence(
              productName: item.name,
              category: item.category,
              price: item.price,
              marketName: record.marketName,
              date: record.date,
            ),
          );
        }
      }
    }

    if (occurrences.isEmpty) return null;
    return ProductHistoryAggregate(
      normalizedKey: targetKey,
      displayName: displayName!,
      category: category!,
      occurrences: occurrences,
    );
  }

  void _openProductAnalytics(BuildContext context, String productName) {
    final aggregate = _buildAggregateForProduct(
      productName,
      sourceRecords: widget.controller.history,
    );
    if (aggregate == null) return;

    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ProductAnalyticsScreen(aggregate: aggregate),
      ),
    );
  }

  Future<void> _showAddReceiptPurchaseModal() async {
    final imagePicker = ImagePicker();
    String selectedMarketId = widget.controller.selectedMarket.id;
    final newMarketController = TextEditingController();
    bool isCreatingNewMarket = false;
    bool isScanning = false;
    String? scanError;
    final scannedItems = <ScannedReceiptItem>[];

    final manualNameController = TextEditingController();
    final manualPriceController = TextEditingController();

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
            final textPrimary = AppColors.textPrimary(context);
            final textSecondary = AppColors.textSecondary(context);
            final subtleBg = AppColors.subtleSurface(context);

            Future<void> showEditScannedItemDialog(int idx) async {
              final item = scannedItems[idx];
              final editNameController = TextEditingController(text: item.name);
              final editPriceController = TextEditingController(
                text: item.price.toStringAsFixed(2).replaceAll('.', ','),
              );
              ProductCategory currentCategory = item.category ??
                  widget.controller.predictCategory(item.name);

              await showDialog<void>(
                context: context,
                builder: (dialogCtx) {
                  return StatefulBuilder(
                    builder: (context, setDialogState) {
                      return AlertDialog(
                        backgroundColor: AppColors.surface(context),
                        title: const Text('Editar Item Identificado'),
                        content: SingleChildScrollView(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              TextField(
                                controller: editNameController,
                                textCapitalization: TextCapitalization.sentences,
                                decoration: InputDecoration(
                                  labelText: 'Nome do produto',
                                  filled: true,
                                  fillColor: subtleBg,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),
                                onChanged: (val) {
                                  // Update category prediction dynamically if user changes product name
                                  if (item.category == null && val.trim().isNotEmpty) {
                                    setDialogState(() {
                                      currentCategory = widget.controller
                                          .predictCategory(val.trim());
                                    });
                                  }
                                },
                              ),
                              const SizedBox(height: 12),
                              TextField(
                                controller: editPriceController,
                                keyboardType: const TextInputType.numberWithOptions(
                                  decimal: true,
                                ),
                                decoration: InputDecoration(
                                  labelText: 'Valor pago (R\$)',
                                  prefixIcon: const Icon(
                                    Icons.attach_money_rounded,
                                    color: AppColors.primaryGreen,
                                  ),
                                  filled: true,
                                  fillColor: subtleBg,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 12),
                              DropdownButtonFormField<ProductCategory>(
                                initialValue: currentCategory,
                                isExpanded: true,
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
                                    setDialogState(() {
                                      currentCategory = val;
                                    });
                                  }
                                },
                              ),
                            ],
                          ),
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.of(dialogCtx).pop(),
                            child: const Text('Cancelar'),
                          ),
                          FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: AppColors.primaryGreen,
                              foregroundColor: Colors.white,
                            ),
                            onPressed: () {
                              final newName = editNameController.text.trim();
                              final newPrice = AppFormatters.parsePrice(
                                editPriceController.text,
                              );
                              if (newName.isEmpty || newPrice == null || newPrice <= 0) {
                                return;
                              }
                              setModalState(() {
                                scannedItems[idx] = ScannedReceiptItem(
                                  name: newName,
                                  price: newPrice,
                                  category: currentCategory,
                                );
                              });
                              Navigator.of(dialogCtx).pop();
                            },
                            child: const Text('Salvar'),
                          ),
                        ],
                      );
                    },
                  );
                },
              );
            }

            Future<void> pickAndScanImage(ImageSource source) async {
              try {
                final pickedFile = await imagePicker.pickImage(
                  source: source,
                  imageQuality: 90,
                );
                if (pickedFile == null) return;

                setModalState(() {
                  isScanning = true;
                  scanError = null;
                });

                final rawText =
                    await ReceiptScannerService.recognizeTextFromImage(
                  pickedFile.path,
                );
                final extracted =
                    ReceiptScannerService.parseReceiptText(rawText);

                setModalState(() {
                  isScanning = false;
                  if (extracted.isEmpty) {
                    scanError =
                        'Não foi possível identificar produtos e preços automaticamente nesta imagem. Tente tirar uma foto mais próxima dos itens da nota ou adicione abaixo.';
                  } else {
                    scannedItems
                      ..clear()
                      ..addAll(extracted);
                  }
                });
              } catch (e) {
                setModalState(() {
                  isScanning = false;
                  scanError =
                      'Erro ao ler imagem da Nota Fiscal. Verifique as permissões de câmera/galeria.';
                });
              }
            }

            final totalScannedValue = scannedItems.fold<double>(
              0.0,
              (sum, item) => sum + item.price,
            );

            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 16,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(context).size.height * 0.85,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.receipt_long_rounded,
                          color: AppColors.primaryGreen,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Adicionar Compra por Nota Fiscal',
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
                          icon: Icon(Icons.close, size: 20, color: textSecondary),
                          onPressed: () => Navigator.of(modalContext).pop(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Step 1: Select or Create the Market where the purchase was made
                    if (!isCreatingNewMarket)
                      Row(
                        children: [
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              initialValue: selectedMarketId,
                              isExpanded: true,
                              decoration: InputDecoration(
                                labelText: 'Mercado onde fez a compra',
                                isDense: true,
                                filled: true,
                                fillColor: subtleBg,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                              items: widget.controller.markets.map((m) {
                                return DropdownMenuItem<String>(
                                  value: m.id,
                                  child: Text(
                                    m.name,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                );
                              }).toList(),
                              onChanged: (val) {
                                if (val != null) {
                                  setModalState(() => selectedMarketId = val);
                                }
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          TextButton.icon(
                            onPressed: () {
                              setModalState(() => isCreatingNewMarket = true);
                            },
                            icon: const Icon(Icons.add_rounded, size: 16),
                            label: const Text('Novo'),
                          ),
                        ],
                      )
                    else
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: newMarketController,
                              autofocus: true,
                              textCapitalization: TextCapitalization.words,
                              decoration: InputDecoration(
                                labelText: 'Nome do novo mercado',
                                hintText: 'Ex: Supermercado Extra',
                                isDense: true,
                                filled: true,
                                fillColor: subtleBg,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          TextButton(
                            onPressed: () {
                              setModalState(() => isCreatingNewMarket = false);
                            },
                            child: const Text('Cancelar'),
                          ),
                        ],
                      ),

                    const SizedBox(height: 12),

                    // Step 2: Camera / Gallery buttons to scan the Nota Fiscal image
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: isScanning
                                ? null
                                : () => pickAndScanImage(ImageSource.camera),
                            icon: const Icon(
                              Icons.camera_alt_outlined,
                              size: 18,
                            ),
                            label: const Text('Fotografar Nota'),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 11),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: isScanning
                                ? null
                                : () => pickAndScanImage(ImageSource.gallery),
                            icon: const Icon(
                              Icons.photo_library_outlined,
                              size: 18,
                            ),
                            label: const Text('Escolher Imagem'),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 11),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),

                    if (isScanning) ...[
                      const SizedBox(height: 16),
                      Center(
                        child: Column(
                          children: [
                            const CircularProgressIndicator(
                              color: AppColors.primaryGreen,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Identificando produtos e preços da Nota Fiscal...',
                              style: TextStyle(
                                fontSize: 13,
                                color: textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    if (scanError != null) ...[
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFFECACA)),
                        ),
                        child: Text(
                          scanError!,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFFB91C1C),
                          ),
                        ),
                      ),
                    ],

                    const SizedBox(height: 12),

                    // Manual / Quick Add item row so user can also add/complement any item
                    Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: SizedBox(
                            height: 38,
                            child: TextField(
                              controller: manualNameController,
                              textCapitalization: TextCapitalization.sentences,
                              style: TextStyle(fontSize: 13, color: textPrimary),
                              decoration: InputDecoration(
                                hintText: 'Produto...',
                                isDense: true,
                                filled: true,
                                fillColor: subtleBg,
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 8,
                                ),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          flex: 2,
                          child: SizedBox(
                            height: 38,
                            child: TextField(
                              controller: manualPriceController,
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                decimal: true,
                              ),
                              style: TextStyle(fontSize: 13, color: textPrimary),
                              decoration: InputDecoration(
                                hintText: 'R\$ 0,00',
                                isDense: true,
                                filled: true,
                                fillColor: subtleBg,
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 8,
                                ),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        IconButton.filledTonal(
                          tooltip: 'Adicionar item à nota',
                          visualDensity: VisualDensity.compact,
                          onPressed: () {
                            final name = manualNameController.text.trim();
                            final price = AppFormatters.parsePrice(
                              manualPriceController.text,
                            );
                            if (name.isEmpty || price == null || price <= 0) {
                              return;
                            }
                            setModalState(() {
                              scannedItems.insert(
                                0,
                                ScannedReceiptItem(name: name, price: price),
                              );
                              manualNameController.clear();
                              manualPriceController.clear();
                            });
                          },
                          icon: const Icon(Icons.add_rounded, size: 18),
                        ),
                      ],
                    ),

                    const SizedBox(height: 10),

                    // Extracted Items List
                    if (scannedItems.isNotEmpty) ...[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Itens identificados (${scannedItems.length}):',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: textSecondary,
                            ),
                          ),
                          Text(
                            'Total: ${AppFormatters.formatCurrency(totalScannedValue)}',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppColors.accentGreen,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Flexible(
                        child: Material(
                          color: AppColors.surface(context),
                          child: ListView.separated(
                            shrinkWrap: true,
                            itemCount: scannedItems.length,
                            separatorBuilder: (_, _) => Divider(
                              height: 1,
                              color: AppColors.divider(context),
                            ),
                            itemBuilder: (context, idx) {
                              final item = scannedItems[idx];
                              final cat = item.category ??
                                  widget.controller.predictCategory(item.name);
                              return ListTile(
                                dense: true,
                                contentPadding: EdgeInsets.zero,
                                leading: Icon(
                                  cat.icon,
                                  color: cat.color,
                                  size: 18,
                                ),
                                title: Text(
                                  item.name,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                    color: textPrimary,
                                  ),
                                ),
                                subtitle: Text(
                                  cat.label,
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: cat.color,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                onTap: () => showEditScannedItemDialog(idx),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      AppFormatters.formatCurrency(item.price),
                                      style: TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13,
                                        color: textPrimary,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    IconButton(
                                      visualDensity: VisualDensity.compact,
                                      tooltip: 'Remover',
                                      icon: Icon(
                                        Icons.close_rounded,
                                        size: 16,
                                        color: textSecondary,
                                      ),
                                      onPressed: () {
                                        setModalState(() {
                                          scannedItems.removeAt(idx);
                                        });
                                      },
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                    ],

                    const SizedBox(height: 14),
                    FilledButton.icon(
                      onPressed: scannedItems.isEmpty
                          ? null
                          : () {
                              String targetMarketId = selectedMarketId;
                              if (isCreatingNewMarket &&
                                  newMarketController.text.trim().isNotEmpty) {
                                final created = widget.controller.addMarket(
                                  newMarketController.text.trim(),
                                );
                                targetMarketId = created.id;
                              }

                              final historyItems = scannedItems.map((s) {
                                return PurchaseHistoryItem(
                                  name: s.name,
                                  category: s.category ??
                                      widget.controller.predictCategory(s.name),
                                  price: s.price,
                                );
                              }).toList();

                              final record =
                                  widget.controller.addPurchaseFromItems(
                                marketId: targetMarketId,
                                items: historyItems,
                              );
                              Navigator.of(modalContext).pop();
                              if (mounted && record != null) {
                                ScaffoldMessenger.of(this.context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      'Nota Fiscal salva em ${record.marketName} (${record.items.length} itens)!',
                                    ),
                                    behavior: SnackBarBehavior.floating,
                                  ),
                                );
                              }
                            },
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primaryGreen,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      icon: const Icon(Icons.check_rounded, size: 18),
                      label: Text(
                        scannedItems.isEmpty
                            ? 'Fotografe ou selecione a Nota Fiscal'
                            : 'Salvar Compra (${scannedItems.length} itens)',
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

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final allRecords = controller.history;
    final marketNames = _availableMarketNames(allRecords);
    final query = _searchController.text.trim();
    final normalizedQuery = CategoryClassifier.normalize(query);

    final filteredRecords = allRecords.where((record) {
      if (_selectedMarketNameFilter != null &&
          record.marketName != _selectedMarketNameFilter) {
        return false;
      }
      if (normalizedQuery.isNotEmpty) {
        final marketMatch = CategoryClassifier.normalize(record.marketName)
            .contains(normalizedQuery);
        final itemMatch = record.items.any(
          (i) =>
              CategoryClassifier.normalize(i.name).contains(normalizedQuery),
        );
        return marketMatch || itemMatch;
      }
      return true;
    }).toList();

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceColor = AppColors.surface(context);
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);
    final borderColor = AppColors.border(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Histórico de Compras'),
        actions: [
          FilledButton.icon(
            onPressed: _showAddReceiptPurchaseModal,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primaryGreen,
              foregroundColor: Colors.white,
              visualDensity: VisualDensity.compact,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            icon: const Icon(Icons.document_scanner_outlined, size: 15),
            label: const Text(
              'Adicionar Compra',
              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600),
            ),
          ),
          const SizedBox(width: 4),
          IconButton(
            tooltip: isDark ? 'Modo Claro' : 'Modo Escuro',
            onPressed: controller.toggleDarkMode,
            icon: Icon(
              isDark ? Icons.light_mode_rounded : Icons.dark_mode_outlined,
              size: 21,
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          Material(
            color: surfaceColor,
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: borderColor),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(
                    height: 40,
                    child: TextField(
                      controller: _searchController,
                      onChanged: (_) => setState(() {}),
                      style: TextStyle(fontSize: 14, color: textPrimary),
                      decoration: InputDecoration(
                        hintText: 'Buscar mercado ou produto nas compras...',
                        hintStyle: TextStyle(
                          fontSize: 13,
                          color: textSecondary,
                        ),
                        prefixIcon: Icon(
                          Icons.search_rounded,
                          size: 18,
                          color: textSecondary,
                        ),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: Icon(
                                  Icons.clear_rounded,
                                  size: 16,
                                  color: textSecondary,
                                ),
                                onPressed: () {
                                  setState(() {
                                    _searchController.clear();
                                  });
                                },
                              )
                            : null,
                        filled: true,
                        fillColor: AppColors.subtleSurface(context),
                        contentPadding:
                            const EdgeInsets.symmetric(horizontal: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(color: borderColor),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(color: borderColor),
                        ),
                      ),
                    ),
                  ),
                  if (marketNames.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          ChoiceChip(
                            visualDensity: VisualDensity.compact,
                            label: const Text('Todos'),
                            selected: _selectedMarketNameFilter == null,
                            onSelected: (_) {
                              setState(() {
                                _selectedMarketNameFilter = null;
                              });
                            },
                          ),
                          const SizedBox(width: 6),
                          ...marketNames.map((name) {
                            final isSelected =
                                _selectedMarketNameFilter == name;
                            return Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: ChoiceChip(
                                visualDensity: VisualDensity.compact,
                                label: Text(name),
                                selected: isSelected,
                                onSelected: (_) {
                                  setState(() {
                                    _selectedMarketNameFilter =
                                        isSelected ? null : name;
                                  });
                                },
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          Expanded(
            child: allRecords.isEmpty
                ? _buildEmptyHistoryState(context)
                : Material(
                    color: surfaceColor,
                    child: _buildByMarketView(context, filteredRecords),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildByMarketView(
    BuildContext context,
    List<PurchaseRecord> records,
  ) {
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);

    if (records.isEmpty) {
      return Center(
        child: Text(
          'Nenhuma compra encontrada.',
          style: TextStyle(color: textSecondary),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.only(bottom: 24),
      itemCount: records.length,
      separatorBuilder: (_, _) => Divider(
        height: 1,
        color: AppColors.divider(context),
      ),
      itemBuilder: (context, index) {
        final record = records[index];
        return ExpansionTile(
          shape: const Border(),
          collapsedShape: const Border(),
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
          leading: Icon(
            Icons.storefront_outlined,
            color: textSecondary,
            size: 20,
          ),
          title: Text(
            record.marketName,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 14,
              color: textPrimary,
            ),
          ),
          subtitle: Text(
            '${AppFormatters.formatDate(record.date)} • ${record.items.length} ${record.items.length == 1 ? 'item' : 'itens'}',
            style: TextStyle(
              fontSize: 12,
              color: textSecondary,
            ),
          ),
          trailing: Text(
            AppFormatters.formatCurrency(record.totalAmount),
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 14,
              color: AppColors.accentGreen,
            ),
          ),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 4, 24, 4),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Toque em um produto abaixo para abrir a análise individual:',
                  style: TextStyle(
                    fontSize: 11,
                    color: textSecondary,
                  ),
                ),
              ),
            ),
            ...record.items.map((item) {
              return ListTile(
                dense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 24),
                onTap: () => _openProductAnalytics(context, item.name),
                leading: Icon(
                  item.category.icon,
                  size: 17,
                  color: item.category.color,
                ),
                title: Text(
                  item.name,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: textPrimary,
                  ),
                ),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      AppFormatters.formatCurrency(item.price),
                      style: TextStyle(
                        fontWeight: FontWeight.w500,
                        fontSize: 13,
                        color: textSecondary,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 18,
                      color: textSecondary,
                    ),
                  ],
                ),
              );
            }),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton.icon(
                    onPressed: () {
                      var added = 0;
                      for (final item in record.items) {
                        final res = widget.controller.addSingleItem(
                          item.name,
                          category: item.category,
                          price: item.price > 0 ? item.price : null,
                        );
                        if (res != null) added++;
                      }
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            '$added itens adicionados à lista atual!',
                          ),
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    },
                    icon: const Icon(Icons.replay_rounded, size: 15),
                    label: const Text(
                      'Repetir na lista',
                      style: TextStyle(fontSize: 12),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Excluir registro',
                    visualDensity: VisualDensity.compact,
                    icon: Icon(
                      Icons.delete_outline_rounded,
                      size: 18,
                      color: textSecondary,
                    ),
                    onPressed: () {
                      widget.controller.deletePurchaseRecord(record.id);
                    },
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildEmptyHistoryState(BuildContext context) {
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: double.infinity,
              constraints: const BoxConstraints(maxWidth: 340),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFFFF),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppColors.border(context)),
              ),
              clipBehavior: Clip.antiAlias,
              child: Image.asset(
                'assets/imgs/cartoonIcons.jpg',
                fit: BoxFit.contain,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Nenhuma compra finalizada',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Ao finalizar uma compra na aba Lista ou escanear uma Nota Fiscal acima, o registro completo aparecerá aqui.',
              style: TextStyle(fontSize: 13, color: textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class VariationBadge extends StatelessWidget {
  const VariationBadge({
    super.key,
    required this.variationPercent,
    this.fontSize = 11,
  });

  final double? variationPercent;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    if (variationPercent == null) {
      return Text(
        '1ª compra',
        style: TextStyle(
          fontSize: fontSize,
          color: AppColors.textSecondary(context),
        ),
      );
    }

    final val = variationPercent!;
    if (val.abs() < 0.1) {
      return Text(
        '0% →',
        style: TextStyle(
          fontSize: fontSize,
          fontWeight: FontWeight.w600,
          color: AppColors.textSecondary(context),
        ),
      );
    }

    final isUp = val > 0;
    final sign = isUp ? '+' : '';
    final arrow = isUp ? '↗' : '↘';
    final color = isUp ? const Color(0xFFDC2626) : AppColors.primaryGreen;

    return Text(
      '$sign${val.toStringAsFixed(0)}% $arrow',
      style: TextStyle(
        fontSize: fontSize,
        fontWeight: FontWeight.w700,
        color: color,
      ),
    );
  }
}

/// Dedicated Screen for Individual Product Price & Market Analytics
/// Built with responsive Wrap/Expanded/LayoutBuilder to avoid any pixel overflow on small screens.
class ProductAnalyticsScreen extends StatelessWidget {
  const ProductAnalyticsScreen({
    super.key,
    required this.aggregate,
  });

  final ProductHistoryAggregate aggregate;

  @override
  Widget build(BuildContext context) {
    final minOcc = aggregate.minPriceOccurrence;
    final maxOcc = aggregate.maxPriceOccurrence;
    final variation = aggregate.variationPercentFromLastTime;
    final prevPrice = aggregate.previousPrice;
    final marketRanking = aggregate.marketRanking;
    final insight = aggregate.marketComparisonInsight;
    final chronological = aggregate.chronologicalPricedOccurrences;

    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);

    String pricePositionLabel = 'Dentro da média histórica';
    Color pricePositionColor = textSecondary;
    Color pricePositionBg = AppColors.subtleSurface(context);
    if (minOcc != null && maxOcc != null && minOcc.price != maxOcc.price) {
      if (aggregate.lastPrice <= minOcc.price * 1.02) {
        pricePositionLabel = 'Comprado perto da mínima histórica';
        pricePositionColor = const Color(0xFF15803D);
        pricePositionBg = const Color(0xFFDCFCE7);
      } else if (aggregate.lastPrice >= maxOcc.price * 0.98) {
        pricePositionLabel = 'Próximo ao recorde mais caro';
        pricePositionColor = const Color(0xFFB91C1C);
        pricePositionBg = const Color(0xFFFEE2E2);
      } else if (aggregate.lastPrice < aggregate.averagePrice) {
        pricePositionLabel = 'Abaixo do preço médio';
        pricePositionColor = const Color(0xFF15803D);
        pricePositionBg = const Color(0xFFDCFCE7);
      } else {
        pricePositionLabel = 'Acima do preço médio';
        pricePositionColor = const Color(0xFFB45309);
        pricePositionBg = const Color(0xFFFEF3C7);
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Icon(
              aggregate.category.icon,
              color: aggregate.category.color,
              size: 20,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                aggregate.displayName,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          // 1. Top Key Metrics: Responsive side-by-side cards using IntrinsicHeight
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: _AnalyticsCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Último Preço Pago',
                          style: TextStyle(
                            fontSize: 12,
                            color: textSecondary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 2,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              AppFormatters.formatCurrency(aggregate.lastPrice),
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: textPrimary,
                              ),
                            ),
                            VariationBadge(
                              variationPercent: variation,
                              fontSize: 12,
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          prevPrice != null
                              ? 'Anterior: ${AppFormatters.formatCurrency(prevPrice)}'
                              : aggregate.lastMarket,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11,
                            color: textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _AnalyticsCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Preço Médio Histórico',
                          style: TextStyle(
                            fontSize: 12,
                            color: textSecondary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          AppFormatters.formatCurrency(aggregate.averagePrice),
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: AppColors.accentGreen,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Em ${aggregate.pricedOccurrences.length} ${aggregate.pricedOccurrences.length == 1 ? 'compra' : 'compras'}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11,
                            color: textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // 2. Price Record Card (Min & Max Recorded Price)
          _AnalyticsCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.emoji_events_outlined,
                          size: 18,
                          color: textSecondary,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'Recordes de Preço',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                            color: textPrimary,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: pricePositionBg,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        pricePositionLabel,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: pricePositionColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (minOcc != null)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'Menor',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF15803D),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Menor preço já pago: ${AppFormatters.formatCurrency(minOcc.price)} em ${AppFormatters.formatShortDate(minOcc.date)} (${minOcc.marketName})',
                          style: TextStyle(
                            fontSize: 13,
                            color: textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                if (maxOcc != null) ...[
                  const SizedBox(height: 8),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEE2E2),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'Maior',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFFB91C1C),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Maior preço pago: ${AppFormatters.formatCurrency(maxOcc.price)} em ${AppFormatters.formatShortDate(maxOcc.date)} (${maxOcc.marketName})',
                          style: TextStyle(
                            fontSize: 13,
                            color: textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 12),

          // 3. Temporal Price Trend Line Chart (Interactive on tap/drag)
          _AnalyticsCard(
            child: _InteractivePriceTrendChart(
              points: chronological,
              averagePrice: aggregate.averagePrice,
            ),
          ),

          const SizedBox(height: 12),

          // 4. Market Comparison ("Onde vale mais a pena comprar isso?")
          _AnalyticsCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.storefront_outlined,
                      size: 18,
                      color: textSecondary,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Onde vale mais a pena comprar?',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          color: textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
                if (insight != null) ...[
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: AppColors.primaryGreen.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Text(
                      insight,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.accentGreen,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Text(
                  'Ranking de Mercados e último preço por estabelecimento:',
                  style: TextStyle(
                    fontSize: 12,
                    color: textSecondary,
                  ),
                ),
                const SizedBox(height: 8),
                ...List.generate(marketRanking.length, (index) {
                  final stat = marketRanking[index];
                  final maxAvg = marketRanking.last.averagePrice;
                  final ratio = maxAvg > 0
                      ? (stat.averagePrice / maxAvg).clamp(0.15, 1.0)
                      : 1.0;
                  final isCheapest = index == 0 && marketRanking.length > 1;

                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 7),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Wrap(
                                spacing: 6,
                                runSpacing: 4,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  Text(
                                    '${index + 1}º ${stat.marketName}',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                      color: textPrimary,
                                    ),
                                  ),
                                  if (isCheapest)
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 2,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFDCFCE7),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: const Text(
                                        'Mais barato',
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF15803D),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Último: ${AppFormatters.formatCurrency(stat.lastPrice)}',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: textPrimary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 5),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: ratio,
                            minHeight: 6,
                            backgroundColor: AppColors.subtleSurface(context),
                            color: isCheapest
                                ? AppColors.primaryGreen
                                : textSecondary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Flexible(
                              child: Text(
                                'Média no local: ${AppFormatters.formatCurrency(stat.averagePrice)}',
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: textSecondary,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Em ${AppFormatters.formatShortDate(stat.lastDate)}',
                              style: TextStyle(
                                fontSize: 11,
                                color: textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // 5. Complete Timeline of Purchases for this Product
          _AnalyticsCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Histórico de Compras deste Item',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                ...aggregate.occurrences.map((occ) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        Icon(
                          Icons.calendar_today_outlined,
                          size: 15,
                          color: textSecondary,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                occ.marketName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: textPrimary,
                                ),
                              ),
                              Text(
                                AppFormatters.formatDate(occ.date),
                                style: TextStyle(
                                  fontSize: 11,
                                  color: textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          AppFormatters.formatCurrency(occ.price),
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: textPrimary,
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AnalyticsCard extends StatelessWidget {
  const _AnalyticsCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface(context),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border(context)),
      ),
      child: child,
    );
  }
}

class _InteractivePriceTrendChart extends StatefulWidget {
  const _InteractivePriceTrendChart({
    required this.points,
    required this.averagePrice,
  });

  final List<ProductHistoryOccurrence> points;
  final double averagePrice;

  @override
  State<_InteractivePriceTrendChart> createState() =>
      _InteractivePriceTrendChartState();
}

class _InteractivePriceTrendChartState
    extends State<_InteractivePriceTrendChart> {
  int? _selectedIndex;

  static const double _leftPad = 48.0;
  static const double _rightPad = 16.0;

  void _handleTouch(Offset localPosition, double maxWidth) {
    final pts = widget.points;
    if (pts.isEmpty) return;
    if (pts.length == 1) {
      setState(() => _selectedIndex = 0);
      return;
    }

    final chartWidth = math.max(10.0, maxWidth - _leftPad - _rightPad);
    final relativeX = (localPosition.dx - _leftPad).clamp(0.0, chartWidth);
    final ratio = relativeX / chartWidth;
    final nearestIndex =
        (ratio * (pts.length - 1)).round().clamp(0, pts.length - 1);

    if (_selectedIndex != nearestIndex) {
      setState(() {
        _selectedIndex = nearestIndex;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final pts = widget.points;
    final effectiveIndex = _selectedIndex != null && _selectedIndex! < pts.length
        ? _selectedIndex
        : (pts.isNotEmpty ? pts.length - 1 : null);
    final selectedPoint =
        effectiveIndex != null ? pts[effectiveIndex] : null;
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.show_chart_rounded,
              size: 18,
              color: textSecondary,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                'Evolução de Preço no Tempo',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                  color: textPrimary,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          'Toque ou arraste sobre os pontos do gráfico para visualizar o preço exato, data e mercado.',
          style: TextStyle(fontSize: 12, color: textSecondary),
        ),
        if (selectedPoint != null) ...[
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.subtleSurface(context),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border(context)),
            ),
            child: Wrap(
              spacing: 8,
              runSpacing: 4,
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  'Preço: ${AppFormatters.formatCurrency(selectedPoint.price)}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: AppColors.accentGreen,
                  ),
                ),
                Text(
                  '${selectedPoint.marketName} • ${AppFormatters.formatShortDate(selectedPoint.date)}',
                  style: TextStyle(
                    fontSize: 12,
                    color: textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 14),
        SizedBox(
          height: 185,
          width: double.infinity,
          child: pts.isEmpty
              ? Center(
                  child: Text(
                    'Sem preços informados para gerar gráfico.',
                    style: TextStyle(
                      fontSize: 12,
                      color: textSecondary,
                    ),
                  ),
                )
              : LayoutBuilder(
                  builder: (context, constraints) {
                    return GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTapDown: (details) => _handleTouch(
                        details.localPosition,
                        constraints.maxWidth,
                      ),
                      onHorizontalDragUpdate: (details) => _handleTouch(
                        details.localPosition,
                        constraints.maxWidth,
                      ),
                      child: CustomPaint(
                        size: Size(constraints.maxWidth, 185),
                        painter: _PriceTrendLineChartPainter(
                          points: pts,
                          averagePrice: widget.averagePrice,
                          selectedIndex: effectiveIndex,
                          gridColor: AppColors.divider(context),
                          labelColor: textSecondary,
                          surfaceColor: AppColors.surface(context),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _PriceTrendLineChartPainter extends CustomPainter {
  _PriceTrendLineChartPainter({
    required this.points,
    required this.averagePrice,
    required this.selectedIndex,
    required this.gridColor,
    required this.labelColor,
    required this.surfaceColor,
  });

  final List<ProductHistoryOccurrence> points;
  final double averagePrice;
  final int? selectedIndex;
  final Color gridColor;
  final Color labelColor;
  final Color surfaceColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;

    const leftPad = 48.0;
    const rightPad = 16.0;
    const topPad = 24.0;
    const bottomPad = 26.0;

    final chartWidth = math.max(10.0, size.width - leftPad - rightPad);
    final chartHeight = math.max(10.0, size.height - topPad - bottomPad);

    var minVal = points.map((e) => e.price).reduce(math.min);
    var maxVal = points.map((e) => e.price).reduce(math.max);
    if ((maxVal - minVal).abs() < 0.01) {
      minVal = math.max(0.0, minVal * 0.85);
      maxVal = maxVal * 1.15 + 1.0;
    } else {
      final margin = (maxVal - minVal) * 0.15;
      minVal = math.max(0.0, minVal - margin);
      maxVal = maxVal + margin;
    }

    final gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 1;

    for (var i = 0; i <= 2; i++) {
      final ratio = i / 2.0;
      final y = topPad + chartHeight * ratio;
      canvas.drawLine(
        Offset(leftPad, y),
        Offset(leftPad + chartWidth, y),
        gridPaint,
      );

      final priceVal = maxVal - (maxVal - minVal) * ratio;
      final tp = TextPainter(
        text: TextSpan(
          text: 'R\$${priceVal.toStringAsFixed(0)}',
          style: TextStyle(
            fontSize: 10,
            color: labelColor,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(0, y - tp.height / 2));
    }

    Offset pointOffset(int index) {
      final xRatio =
          points.length == 1 ? 0.5 : index / (points.length - 1).toDouble();
      final yRatio = (points[index].price - minVal) / (maxVal - minVal);
      final x = leftPad + xRatio * chartWidth;
      final y = topPad + chartHeight * (1.0 - yRatio);
      return Offset(x, y);
    }

    final offsets = List.generate(points.length, pointOffset);

    if (offsets.length >= 2) {
      final fillPath = Path()..moveTo(offsets.first.dx, topPad + chartHeight);
      for (final o in offsets) {
        fillPath.lineTo(o.dx, o.dy);
      }
      fillPath.lineTo(offsets.last.dx, topPad + chartHeight);
      fillPath.close();

      final fillPaint = Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppColors.primaryGreen.withValues(alpha: 0.2),
            AppColors.primaryGreen.withValues(alpha: 0.0),
          ],
        ).createShader(Rect.fromLTWH(leftPad, topPad, chartWidth, chartHeight));
      canvas.drawPath(fillPath, fillPaint);

      final linePath = Path()..moveTo(offsets.first.dx, offsets.first.dy);
      for (var i = 1; i < offsets.length; i++) {
        linePath.lineTo(offsets[i].dx, offsets[i].dy);
      }

      final linePaint = Paint()
        ..color = AppColors.primaryGreen
        ..strokeWidth = 2.2
        ..style = PaintingStyle.stroke;
      canvas.drawPath(linePath, linePaint);
    }

    // Draw vertical guide line for selected point
    if (selectedIndex != null &&
        selectedIndex! >= 0 &&
        selectedIndex! < offsets.length) {
      final selOffset = offsets[selectedIndex!];
      final guidePaint = Paint()
        ..color = AppColors.primaryGreen.withValues(alpha: 0.35)
        ..strokeWidth = 1.2;
      canvas.drawLine(
        Offset(selOffset.dx, topPad),
        Offset(selOffset.dx, topPad + chartHeight),
        guidePaint,
      );
    }

    final dotFill = Paint()..color = AppColors.primaryGreen;
    final selectedDotFill = Paint()..color = AppColors.accentGreen;
    final dotBorder = Paint()
      ..color = surfaceColor
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    final step = math.max(1, (points.length / 5).ceil());
    for (var i = 0; i < offsets.length; i++) {
      final o = offsets[i];
      final isSelected = i == selectedIndex;
      canvas.drawCircle(o, isSelected ? 6.0 : 4.0, isSelected ? selectedDotFill : dotFill);
      canvas.drawCircle(o, isSelected ? 6.0 : 4.0, dotBorder);

      if (i % step == 0 || i == offsets.length - 1) {
        final d = points[i].date;
        final label =
            '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}';
        final tp = TextPainter(
          text: TextSpan(
            text: label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: isSelected ? FontWeight.w700 : FontWeight.normal,
              color: isSelected
                  ? AppColors.primaryGreen
                  : labelColor,
            ),
          ),
          textDirection: TextDirection.ltr,
        )..layout();
        tp.paint(
          canvas,
          Offset(o.dx - tp.width / 2, topPad + chartHeight + 6),
        );
      }
    }

    // Draw floating price tag above selected point
    if (selectedIndex != null &&
        selectedIndex! >= 0 &&
        selectedIndex! < offsets.length) {
      final selOffset = offsets[selectedIndex!];
      final selPrice = AppFormatters.formatCurrency(points[selectedIndex!].price);
      final tp = TextPainter(
        text: TextSpan(
          text: selPrice,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();

      final pillWidth = tp.width + 12;
      final pillHeight = tp.height + 6;
      final clampedX = (selOffset.dx - pillWidth / 2)
          .clamp(leftPad, size.width - pillWidth - 4);
      final pillY = math.max(0.0, selOffset.dy - pillHeight - 8);

      final rrect = RRect.fromRectAndRadius(
        Rect.fromLTWH(clampedX, pillY, pillWidth, pillHeight),
        const Radius.circular(6),
      );
      canvas.drawRRect(rrect, Paint()..color = AppColors.accentGreen);
      tp.paint(canvas, Offset(clampedX + 6, pillY + 3));
    }
  }

  @override
  bool shouldRepaint(covariant _PriceTrendLineChartPainter oldDelegate) {
    return oldDelegate.points != points ||
        oldDelegate.averagePrice != averagePrice ||
        oldDelegate.selectedIndex != selectedIndex ||
        oldDelegate.gridColor != gridColor;
  }
}
