import 'package:flutter/material.dart';
import '../models/shopping_models.dart';
import '../services/category_classifier.dart';
import '../services/shopping_controller.dart';
import '../theme/app_colors.dart';
import '../utils/formatters.dart';
import 'history_screen.dart';
import 'pantry_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.controller,
  });

  final ShoppingController controller;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _searchController = TextEditingController();
  String? _selectedMarketNameFilter;
  int _priceIndexDays = 60;
  String _variationTab = 'up'; // 'up' or 'down'

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

  List<ProductHistoryAggregate> _buildProductAggregates(
    List<PurchaseRecord> records,
    String query, {
    String? marketFilter,
  }) {
    final normalizedQuery = CategoryClassifier.normalize(query);
    final grouped = <String, List<ProductHistoryOccurrence>>{};
    final displayNames = <String, String>{};
    final categories = <String, ProductCategory>{};

    for (final record in records) {
      if (marketFilter != null && record.marketName != marketFilter) {
        continue;
      }

      for (final item in record.items) {
        final key = CategoryClassifier.normalize(item.name);
        if (key.isEmpty) continue;
        if (normalizedQuery.isNotEmpty && !key.contains(normalizedQuery)) {
          continue;
        }

        displayNames.putIfAbsent(key, () => item.name);
        categories.putIfAbsent(key, () => item.category);
        grouped.putIfAbsent(key, () => []).add(
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

    final aggregates = grouped.entries.map((entry) {
      return ProductHistoryAggregate(
        normalizedKey: entry.key,
        displayName: displayNames[entry.key]!,
        category: categories[entry.key]!,
        occurrences: entry.value,
      );
    }).toList();

    aggregates.sort(
      (a, b) => a.displayName.toLowerCase().compareTo(
            b.displayName.toLowerCase(),
          ),
    );
    return aggregates;
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

  static const List<String> _monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final allRecords = controller.history;
    final marketNames = _availableMarketNames(allRecords);
    final query = _searchController.text.trim();

    final allProductAggregates = _buildProductAggregates(allRecords, '');
    final filteredProducts = _buildProductAggregates(
      allRecords,
      query,
      marketFilter: _selectedMarketNameFilter,
    );

    // 1. Monthly Summary Calculations
    final now = DateTime.now();
    final prevMonthDate = DateTime(now.year, now.month - 1, 1);

    final currentMonthRecords = allRecords
        .where((r) => r.date.year == now.year && r.date.month == now.month)
        .toList();
    final prevMonthRecords = allRecords
        .where(
          (r) =>
              r.date.year == prevMonthDate.year &&
              r.date.month == prevMonthDate.month,
        )
        .toList();

    final currentMonthTotal = currentMonthRecords.fold<double>(
      0.0,
      (sum, r) => sum + r.totalAmount,
    );
    final prevMonthTotal = prevMonthRecords.fold<double>(
      0.0,
      (sum, r) => sum + r.totalAmount,
    );
    final allTimeTotal = allRecords.fold<double>(
      0.0,
      (sum, r) => sum + r.totalAmount,
    );

    double? monthDiffPercent;
    if (prevMonthTotal > 0) {
      monthDiffPercent =
          ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100.0;
    }

    // 2. Top Price Variations (Products that changed price the most recently)
    final productsWithVariation = allProductAggregates
        .where(
          (p) =>
              p.variationPercentFromLastTime != null &&
              p.variationPercentFromLastTime!.abs() >= 0.5,
        )
        .toList()
      ..sort(
        (a, b) => b.variationPercentFromLastTime!
            .abs()
            .compareTo(a.variationPercentFromLastTime!.abs()),
      );

    final priceIndex =
        controller.calculatePriceIndex(daysWindow: _priceIndexDays);
    final categorySpending = controller.calculateCategorySpending(
      startDate: now.subtract(Duration(days: _priceIndexDays)),
    );

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);
    final surfaceColor = AppColors.surface(context);
    final borderColor = AppColors.border(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Início & Análises'),
        actions: [
          IconButton(
            tooltip: 'Minha Despensa',
            icon: Badge(
              isLabelVisible: controller.lowStockPantryCount > 0,
              backgroundColor: const Color(0xFFD97706),
              label: Text('${controller.lowStockPantryCount}'),
              child: const Icon(Icons.kitchen_outlined, size: 21),
            ),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => PantryScreen(controller: controller),
                ),
              );
            },
          ),
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
      body: allRecords.isEmpty
          ? _buildEmptyHomeState(context)
          : CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Card 1: Resumo de Gastos do Mês Atual (com banner gocery.jpg)
                        _buildMonthlySpendingCard(
                          context,
                          monthName: _monthNames[now.month - 1],
                          currentMonthTotal: currentMonthTotal,
                          currentMonthPurchasesCount:
                              currentMonthRecords.length,
                          prevMonthTotal: prevMonthTotal,
                          monthDiffPercent: monthDiffPercent,
                          allTimeTotal: allTimeTotal,
                          allTimePurchasesCount: allRecords.length,
                        ),

                        // Card 2: Atalho da Despensa Inteligente
                        _buildPantryShortcutCard(context),

                        // Card 3: Índice de Preços e Inflação da Cesta
                        _buildPriceIndexCard(context, priceIndex),

                        // Card 4: Gastos por Categoria
                        _buildCategorySpendingCard(context, categorySpending),

                        // Card 5: Maiores Variações de Preço Recentes
                        if (productsWithVariation.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              const Icon(
                                Icons.insights_rounded,
                                size: 18,
                                color: AppColors.accentGreen,
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  'Maiores Variações Recentes',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    color: textPrimary,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                          ),
                          const SizedBox(height: 10),
                          SizedBox(
                            height: 110,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: productsWithVariation.length > 8
                                  ? 8
                                  : productsWithVariation.length,
                              separatorBuilder: (_, _) =>
                                  const SizedBox(width: 10),
                              itemBuilder: (context, idx) {
                                final prod = productsWithVariation[idx];
                                return _buildVariationHighlightCard(
                                  context,
                                  prod,
                                );
                              },
                            ),
                          ),
                        ],

                        const SizedBox(height: 20),

                        // Seção: Análise por Produto
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Análise por Produto',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w700,
                                  color: textPrimary,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '${filteredProducts.length} ${filteredProducts.length == 1 ? 'produto' : 'produtos'}',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: textSecondary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),

                        // Barra de busca de produtos
                        SizedBox(
                          height: 42,
                          child: TextField(
                            controller: _searchController,
                            onChanged: (_) => setState(() {}),
                            style: TextStyle(fontSize: 14, color: textPrimary),
                            decoration: InputDecoration(
                              hintText:
                                  'Buscar produto para ver análise de preços...',
                              hintStyle: TextStyle(
                                fontSize: 13,
                                color: textSecondary,
                              ),
                              prefixIcon: Icon(
                                Icons.search_rounded,
                                size: 19,
                                color: textSecondary,
                              ),
                              suffixIcon: _searchController.text.isNotEmpty
                                  ? IconButton(
                                      icon: Icon(
                                        Icons.clear_rounded,
                                        size: 17,
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
                              fillColor: surfaceColor,
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 14,
                              ),
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

                        // Filtro por mercado
                        if (marketNames.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [
                                ChoiceChip(
                                  visualDensity: VisualDensity.compact,
                                  label: const Text('Todos Mercados'),
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
                        const SizedBox(height: 6),
                      ],
                    ),
                  ),
                ),

                // Lista de Produtos Analisados
                if (filteredProducts.isEmpty)
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          'Nenhum produto encontrado para este filtro.',
                          style: TextStyle(color: textSecondary),
                        ),
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 28),
                    sliver: SliverList.separated(
                      itemCount: filteredProducts.length,
                      separatorBuilder: (_, _) => Divider(
                        height: 1,
                        color: AppColors.divider(context),
                      ),
                      itemBuilder: (context, index) {
                        final product = filteredProducts[index];
                        final variation = product.variationPercentFromLastTime;

                        return Material(
                          color: surfaceColor,
                          borderRadius: BorderRadius.vertical(
                            top: index == 0
                                ? const Radius.circular(14)
                                : Radius.zero,
                            bottom: index == filteredProducts.length - 1
                                ? const Radius.circular(14)
                                : Radius.zero,
                          ),
                          child: ListTile(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.vertical(
                                top: index == 0
                                    ? const Radius.circular(14)
                                    : Radius.zero,
                                bottom: index == filteredProducts.length - 1
                                    ? const Radius.circular(14)
                                    : Radius.zero,
                              ),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 4,
                            ),
                            onTap: () => _openProductAnalytics(
                              context,
                              product.displayName,
                            ),
                            leading: Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: product.category.color.withValues(
                                  alpha: 0.14,
                                ),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                product.category.icon,
                                color: product.category.color,
                                size: 18,
                              ),
                            ),
                            title: Text(
                              product.displayName,
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                color: textPrimary,
                              ),
                            ),
                            subtitle: Text(
                              'Média: ${AppFormatters.formatCurrency(product.averagePrice)} • ${product.lastMarket}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 12,
                                color: textSecondary,
                              ),
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      AppFormatters.formatCurrency(
                                        product.lastPrice,
                                      ),
                                      style: TextStyle(
                                        fontWeight: FontWeight.w700,
                                        fontSize: 14,
                                        color: textPrimary,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    VariationBadge(variationPercent: variation),
                                  ],
                                ),
                                const SizedBox(width: 4),
                                Icon(
                                  Icons.chevron_right_rounded,
                                  size: 18,
                                  color: textSecondary,
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
              ],
            ),
    );
  }

  Widget _buildPantryShortcutCard(BuildContext context) {
    final controller = widget.controller;
    final pantryCount = controller.pantryItems.length;
    final lowStock = controller.lowStockPantryCount;
    final surfaceColor = AppColors.surface(context);
    final borderColor = AppColors.border(context);
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);

    return InkWell(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => PantryScreen(controller: controller),
          ),
        );
      },
      borderRadius: BorderRadius.circular(16),
      child: Container(
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: surfaceColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: borderColor),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.kitchen_outlined,
                color: AppColors.primaryGreen,
                size: 22,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 6,
                    runSpacing: 2,
                    children: [
                      Text(
                        'Minha Despensa',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: textPrimary,
                        ),
                      ),
                      if (lowStock > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '$lowStock acabando',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFFB45309),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    pantryCount == 0
                        ? 'Controle o que você tem em casa e evite comprar repetido'
                        : '$pantryCount produtos cadastrados em estoque',
                    style: TextStyle(fontSize: 12, color: textSecondary),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: textSecondary, size: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildPriceIndexCard(
    BuildContext context,
    PriceIndexSummary indexSummary,
  ) {
    final surfaceColor = AppColors.surface(context);
    final borderColor = AppColors.border(context);
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final overall = indexSummary.overallVariationPercent;
    final isInflation = overall > 0.05;
    final isDeflation = overall < -0.05;

    final badgeColor = isInflation
        ? const Color(0xFFDC2626)
        : (isDeflation
            ? const Color(0xFF15803D)
            : textSecondary);
    final badgeBg = isInflation
        ? const Color(0xFFFEE2E2)
        : (isDeflation
            ? const Color(0xFFDCFCE7)
            : AppColors.subtleSurface(context));

    final activeList = _variationTab == 'up'
        ? indexSummary.topIncreases
        : indexSummary.topDecreases;

    return Container(
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.accentGreen.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.trending_up_rounded,
                  size: 18,
                  color: AppColors.accentGreen,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Índice de Preços da Cesta',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [30, 60, 90].map((days) {
                  final isSelected = _priceIndexDays == days;
                  return Padding(
                    padding: const EdgeInsets.only(left: 4),
                    child: InkWell(
                      onTap: () => setState(() => _priceIndexDays = days),
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppColors.primaryGreen
                              : (isDark
                                  ? const Color(0xFF232832)
                                  : const Color(0xFFF3F4F6)),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '${days}d',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: isSelected ? Colors.white : textSecondary,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (indexSummary.totalComparedItems == 0) ...[
            Text(
              'Ainda não há dados suficientes para calcular a inflação da sua cesta nos últimos $_priceIndexDays dias. Conforme você cadastrar mais compras com produtos recomprados, o índice será gerado automaticamente.',
              style: TextStyle(
                fontSize: 12.5,
                color: textSecondary,
                height: 1.35,
              ),
            ),
          ] else ...[
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              runSpacing: 4,
              children: [
                Text(
                  '${overall > 0 ? '+' : ''}${overall.toStringAsFixed(1)}%',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    color: badgeColor,
                    letterSpacing: -0.5,
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: badgeBg,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    isInflation
                        ? 'Inflação Pessoal ↗'
                        : (isDeflation
                            ? 'Economia / Queda ↘'
                            : 'Preços Estáveis'),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: badgeColor,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Baseado em ${indexSummary.totalComparedItems} produtos recomprados nos últimos $_priceIndexDays dias',
              style: TextStyle(fontSize: 12, color: textSecondary),
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: SizedBox(
                height: 8,
                child: Row(
                  children: [
                    if (indexSummary.decreasedCount > 0)
                      Expanded(
                        flex: indexSummary.decreasedCount,
                        child: Container(color: const Color(0xFF22C55E)),
                      ),
                    if (indexSummary.stableCount > 0)
                      Expanded(
                        flex: indexSummary.stableCount,
                        child: Container(
                          color: isDark
                              ? const Color(0xFF4B5563)
                              : const Color(0xFFCBD5E1),
                        ),
                      ),
                    if (indexSummary.increasedCount > 0)
                      Expanded(
                        flex: indexSummary.increasedCount,
                        child: Container(color: const Color(0xFFEF4444)),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              spacing: 8,
              runSpacing: 4,
              children: [
                Text(
                  '🟢 ${indexSummary.decreasedCount} mais baratos',
                  style: TextStyle(fontSize: 11, color: textSecondary),
                ),
                Text(
                  '⚪ ${indexSummary.stableCount} estáveis',
                  style: TextStyle(fontSize: 11, color: textSecondary),
                ),
                Text(
                  '🔴 ${indexSummary.increasedCount} subiram',
                  style: TextStyle(fontSize: 11, color: textSecondary),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Divider(height: 1, color: AppColors.divider(context)),
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  ChoiceChip(
                    visualDensity: VisualDensity.compact,
                    label: Text(
                      'Maiores Altas ↗ (${indexSummary.topIncreases.length})',
                    ),
                    selected: _variationTab == 'up',
                    selectedColor: const Color(0xFFFEE2E2),
                    labelStyle: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: _variationTab == 'up'
                          ? const Color(0xFFB91C1C)
                          : textSecondary,
                    ),
                    onSelected: (_) => setState(() => _variationTab = 'up'),
                  ),
                  const SizedBox(width: 6),
                  ChoiceChip(
                    visualDensity: VisualDensity.compact,
                    label: Text(
                      'Maiores Quedas ↘ (${indexSummary.topDecreases.length})',
                    ),
                    selected: _variationTab == 'down',
                    selectedColor: const Color(0xFFDCFCE7),
                    labelStyle: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: _variationTab == 'down'
                          ? const Color(0xFF15803D)
                          : textSecondary,
                    ),
                    onSelected: (_) => setState(() => _variationTab = 'down'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            if (activeList.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  _variationTab == 'up'
                      ? 'Nenhum produto teve aumento significativo no período.'
                      : 'Nenhum produto teve queda de preço no período.',
                  style: TextStyle(fontSize: 12, color: textSecondary),
                ),
              )
            else
              ...activeList.map((item) {
                final isUp = item.variationPercent > 0;
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                    children: [
                      Icon(item.category.icon,
                          size: 16, color: item.category.color),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.productName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: textPrimary,
                              ),
                            ),
                            Text(
                              '${AppFormatters.formatCurrency(item.previousPrice)} ➔ ${AppFormatters.formatCurrency(item.currentPrice)} (${item.marketName})',
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
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: isUp
                              ? const Color(0xFFFEE2E2)
                              : const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '${isUp ? '+' : ''}${item.variationPercent.toStringAsFixed(1)}%',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: isUp
                                ? const Color(0xFFDC2626)
                                : const Color(0xFF15803D),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }),
          ],
        ],
      ),
    );
  }

  Widget _buildCategorySpendingCard(
    BuildContext context,
    List<CategorySpendingSummary> spendingList,
  ) {
    if (spendingList.isEmpty) return const SizedBox.shrink();

    final surfaceColor = AppColors.surface(context);
    final borderColor = AppColors.border(context);
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.pie_chart_outline_rounded,
                  size: 18,
                  color: AppColors.primaryGreen,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Gastos por Categoria',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: textPrimary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...spendingList.take(6).map((cat) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Column(
                children: [
                  Row(
                    children: [
                      Icon(cat.category.icon,
                          size: 15, color: cat.category.color),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          cat.category.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: textPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${cat.percentage.toStringAsFixed(0)}% • ${AppFormatters.formatCurrency(cat.totalSpent)}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: textSecondary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: (cat.percentage / 100.0).clamp(0.01, 1.0),
                      minHeight: 5,
                      backgroundColor: isDark
                          ? const Color(0xFF282D37)
                          : const Color(0xFFF3F4F6),
                      valueColor:
                          AlwaysStoppedAnimation<Color>(cat.category.color),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildMonthlySpendingCard(
    BuildContext context, {
    required String monthName,
    required double currentMonthTotal,
    required int currentMonthPurchasesCount,
    required double prevMonthTotal,
    required double? monthDiffPercent,
    required double allTimeTotal,
    required int allTimePurchasesCount,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceColor = AppColors.surface(context);
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);
    final borderColor = AppColors.border(context);

    final hasCurrentMonthData = currentMonthPurchasesCount > 0;
    final displayTotal = hasCurrentMonthData ? currentMonthTotal : allTimeTotal;
    final displayCount =
        hasCurrentMonthData ? currentMonthPurchasesCount : allTimePurchasesCount;
    final periodTitle =
        hasCurrentMonthData ? 'Gastos em $monthName' : 'Total Acumulado';

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: borderColor),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
      ),
      child: Stack(
        children: [
          // Decorative gocery.jpg visual accent on the right side
          Positioned(
            right: 0,
            top: 0,
            bottom: 0,
            width: 135,
            child: ShaderMask(
              shaderCallback: (rect) {
                return const LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [Colors.transparent, Colors.black],
                ).createShader(rect);
              },
              blendMode: BlendMode.dstIn,
              child: Opacity(
                opacity: isDark ? 0.22 : 0.18,
                child: Image.asset(
                  'assets/imgs/gocery.jpg',
                  fit: BoxFit.cover,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(7),
                            decoration: BoxDecoration(
                              color: AppColors.primaryGreen.withValues(
                                alpha: 0.14,
                              ),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(
                              Icons.account_balance_wallet_outlined,
                              size: 18,
                              color: AppColors.primaryGreen,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Flexible(
                            child: Text(
                              periodTitle,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: textSecondary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.subtleSurface(context),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '$displayCount ${displayCount == 1 ? 'compra' : 'compras'}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 10,
                  runSpacing: 4,
                  children: [
                    Text(
                      AppFormatters.formatCurrency(displayTotal),
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: textPrimary,
                        letterSpacing: -0.5,
                      ),
                    ),
                    if (monthDiffPercent != null && hasCurrentMonthData)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: monthDiffPercent > 0
                              ? const Color(0xFFFEE2E2)
                              : const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '${monthDiffPercent > 0 ? '+' : ''}${monthDiffPercent.toStringAsFixed(0)}% vs mês ant.',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: monthDiffPercent > 0
                                ? const Color(0xFFDC2626)
                                : const Color(0xFF15803D),
                          ),
                        ),
                      ),
                  ],
                ),
                if (hasCurrentMonthData &&
                    allRecordsCountOtherThanCurrent(
                      allTimeTotal,
                      currentMonthTotal,
                    )) ...[
                  const SizedBox(height: 10),
                  Divider(height: 1, color: AppColors.divider(context)),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          prevMonthTotal > 0
                              ? 'Mês anterior: ${AppFormatters.formatCurrency(prevMonthTotal)}'
                              : 'Histórico geral ($allTimePurchasesCount compras)',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 12, color: textSecondary),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Total: ${AppFormatters.formatCurrency(allTimeTotal)}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: textPrimary,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  bool allRecordsCountOtherThanCurrent(double allTime, double current) {
    return (allTime - current).abs() > 0.01;
  }

  Widget _buildVariationHighlightCard(
    BuildContext context,
    ProductHistoryAggregate product,
  ) {
    final variation = product.variationPercentFromLastTime ?? 0.0;
    final isUp = variation > 0;
    final surfaceColor = AppColors.surface(context);
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);
    final borderColor = AppColors.border(context);

    return InkWell(
      onTap: () => _openProductAnalytics(context, product.displayName),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        width: 195,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: surfaceColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Icon(
                  product.category.icon,
                  size: 16,
                  color: product.category.color,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    product.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: textPrimary,
                    ),
                  ),
                ),
              ],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Último',
                        style: TextStyle(fontSize: 10, color: textSecondary),
                      ),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          AppFormatters.formatCurrency(product.lastPrice),
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: isUp
                          ? const Color(0xFFFEE2E2)
                          : const Color(0xFFDCFCE7),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '${isUp ? '+' : ''}${variation.toStringAsFixed(0)}% ${isUp ? '↗' : '↘'}',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: isUp
                            ? const Color(0xFFDC2626)
                            : const Color(0xFF15803D),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            Text(
              product.lastMarket,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 10.5, color: textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyHomeState(BuildContext context) {
    final textPrimary = AppColors.textPrimary(context);
    final textSecondary = AppColors.textSecondary(context);

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 170,
              height: 115,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.border(context)),
              ),
              clipBehavior: Clip.antiAlias,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Image.asset(
                    'assets/imgs/gocery.jpg',
                    fit: BoxFit.cover,
                  ),
                  Container(
                    color: Colors.black.withValues(alpha: 0.25),
                    child: const Center(
                      child: Icon(
                        Icons.insights_rounded,
                        size: 40,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Suas análises aparecerão aqui',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Assim que você finalizar uma compra na aba Lista ou escanear uma Nota Fiscal no Histórico, você verá o resumo mensal, variações de preços e comparativo por produto aqui.',
              style: TextStyle(fontSize: 13, color: textSecondary, height: 1.4),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
