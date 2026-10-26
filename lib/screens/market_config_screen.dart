import 'package:flutter/material.dart';
import '../models/shopping_models.dart';
import '../services/category_classifier.dart';
import '../services/shopping_controller.dart';

class MarketConfigScreen extends StatefulWidget {
  const MarketConfigScreen({
    super.key,
    required this.controller,
  });

  final ShoppingController controller;

  @override
  State<MarketConfigScreen> createState() => _MarketConfigScreenState();
}

enum _ConfigTab { marketOrder, categoryKeywords }

class _MarketConfigScreenState extends State<MarketConfigScreen> {
  _ConfigTab _selectedTab = _ConfigTab.marketOrder;
  ProductCategory _selectedCategoryForKeywords = ProductCategory.alimentos;
  final TextEditingController _keywordSearchController =
      TextEditingController();
  final TextEditingController _newKeywordController = TextEditingController();

  @override
  void dispose() {
    _keywordSearchController.dispose();
    _newKeywordController.dispose();
    super.dispose();
  }

  Future<void> _showAddOrEditMarketDialog({
    MarketProfile? existingMarket,
  }) async {
    final textController = TextEditingController(
      text: existingMarket?.name ?? '',
    );

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          backgroundColor: Colors.white,
          title: Text(
            existingMarket == null ? 'Novo Mercado' : 'Renomear Mercado',
          ),
          content: TextField(
            controller: textController,
            autofocus: true,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(
              labelText: 'Nome do mercado',
              hintText: 'Ex: Atacadão, Carrefour...',
              border: OutlineInputBorder(),
            ),
            onSubmitted: (value) {
              if (value.trim().isEmpty) return;
              if (existingMarket == null) {
                widget.controller.addMarket(value);
              } else {
                widget.controller.renameMarket(existingMarket.id, value);
              }
              Navigator.of(dialogContext).pop();
            },
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () {
                final name = textController.text.trim();
                if (name.isEmpty) return;
                if (existingMarket == null) {
                  widget.controller.addMarket(name);
                } else {
                  widget.controller.renameMarket(existingMarket.id, name);
                }
                Navigator.of(dialogContext).pop();
              },
              child: const Text('Salvar'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _confirmDeleteMarket(MarketProfile market) async {
    if (widget.controller.markets.length <= 1) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Colors.white,
        title: const Text('Excluir Mercado'),
        content: Text('Deseja excluir o mercado "${market.name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
            ),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      widget.controller.deleteMarket(market.id);
    }
  }

  void _handleAddKeyword() {
    final text = _newKeywordController.text.trim();
    if (text.isEmpty) return;
    final added = widget.controller.addKeywordToCategory(
      _selectedCategoryForKeywords,
      text,
    );
    _newKeywordController.clear();
    if (added && mounted) {
      ScaffoldMessenger.of(context).clearSnackBars();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '"$text" vinculado à categoria ${_selectedCategoryForKeywords.label}.',
          ),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _showEditKeywordDialog(
    ProductCategory category,
    String oldKeyword,
  ) async {
    final controller = TextEditingController(text: oldKeyword);
    ProductCategory targetCategory = category;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: Colors.white,
              title: const Text('Editar Palavra-Chave'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: controller,
                    autofocus: true,
                    decoration: const InputDecoration(
                      labelText: 'Produto / Palavra-chave',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<ProductCategory>(
                    initialValue: targetCategory,
                    decoration: const InputDecoration(
                      labelText: 'Categoria',
                      border: OutlineInputBorder(),
                    ),
                    items: ProductCategory.values.map((cat) {
                      return DropdownMenuItem(
                        value: cat,
                        child: Row(
                          children: [
                            Icon(cat.icon, color: cat.color, size: 18),
                            const SizedBox(width: 8),
                            Text(cat.label),
                          ],
                        ),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setDialogState(() => targetCategory = val);
                      }
                    },
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    widget.controller.removeKeywordFromCategory(
                      category,
                      oldKeyword,
                    );
                    Navigator.of(dialogContext).pop();
                  },
                  child: const Text(
                    'Excluir',
                    style: TextStyle(color: Color(0xFFEF4444)),
                  ),
                ),
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('Cancelar'),
                ),
                FilledButton(
                  onPressed: () {
                    final newText = controller.text.trim();
                    if (newText.isEmpty) return;
                    if (targetCategory == category) {
                      widget.controller.editKeywordInCategory(
                        category,
                        oldKeyword,
                        newText,
                      );
                    } else {
                      widget.controller.removeKeywordFromCategory(
                        category,
                        oldKeyword,
                      );
                      widget.controller.addKeywordToCategory(
                        targetCategory,
                        newText,
                      );
                    }
                    Navigator.of(dialogContext).pop();
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Configurações'),
        actions: [
          if (_selectedTab == _ConfigTab.marketOrder)
            TextButton.icon(
              onPressed: () => _showAddOrEditMarketDialog(),
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Novo Mercado'),
            )
          else
            TextButton.icon(
              onPressed: () async {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    backgroundColor: Colors.white,
                    title: const Text('Restaurar Padrão'),
                    content: Text(
                      'Deseja restaurar os itens padrão da categoria "${_selectedCategoryForKeywords.label}"?',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.of(ctx).pop(false),
                        child: const Text('Cancelar'),
                      ),
                      FilledButton(
                        onPressed: () => Navigator.of(ctx).pop(true),
                        child: const Text('Restaurar'),
                      ),
                    ],
                  ),
                );
                if (confirm == true) {
                  widget.controller.resetCategoryDictionary(
                    onlyCategory: _selectedCategoryForKeywords,
                  );
                }
              },
              icon: const Icon(Icons.restore_rounded, size: 18),
              label: const Text('Restaurar'),
            ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(
                bottom: BorderSide(color: Color(0xFFE2E8F0)),
              ),
            ),
            child: SegmentedButton<_ConfigTab>(
              segments: const [
                ButtonSegment(
                  value: _ConfigTab.marketOrder,
                  icon: Icon(Icons.swap_vert_rounded, size: 18),
                  label: Text('Ordem por Mercado'),
                ),
                ButtonSegment(
                  value: _ConfigTab.categoryKeywords,
                  icon: Icon(Icons.sell_outlined, size: 18),
                  label: Text('Itens por Categoria'),
                ),
              ],
              selected: {_selectedTab},
              onSelectionChanged: (s) {
                setState(() {
                  _selectedTab = s.first;
                });
              },
            ),
          ),
          Expanded(
            child: _selectedTab == _ConfigTab.marketOrder
                ? _buildMarketOrderSection(context)
                : _buildCategoryKeywordsSection(context),
          ),
        ],
      ),
    );
  }

  Widget _buildMarketOrderSection(BuildContext context) {
    final controller = widget.controller;
    final activeMarket = controller.selectedMarket;
    final categories = activeMarket.categoryOrder;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
          color: Colors.white,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: controller.markets.map((market) {
                    final isSelected = market.id == activeMarket.id;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        visualDensity: VisualDensity.compact,
                        label: Text(market.name),
                        selected: isSelected,
                        onSelected: (_) => controller.selectMarket(market.id),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Arraste para definir a ordem dos produtos no mercado "${activeMarket.name}":',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: () => _showAddOrEditMarketDialog(
                      existingMarket: activeMarket,
                    ),
                    style: TextButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                    ),
                    child: const Text('Renomear', style: TextStyle(fontSize: 12)),
                  ),
                  if (controller.markets.length > 1)
                    TextButton(
                      onPressed: () => _confirmDeleteMarket(activeMarket),
                      style: TextButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                      ),
                      child: const Text(
                        'Excluir',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFFEF4444),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
        const Divider(height: 1, color: Color(0xFFE2E8F0)),
        Expanded(
          child: Material(
            color: Colors.white,
            child: ReorderableListView.builder(
              padding: const EdgeInsets.only(bottom: 24),
              itemCount: categories.length,
              onReorderItem: (oldIndex, newIndex) {
                controller.moveMarketCategory(
                  activeMarket.id,
                  oldIndex,
                  newIndex,
                );
              },
              itemBuilder: (context, index) {
                final category = categories[index];
                final keywordCount =
                    controller.keywordsForCategory(category).length;

                return Material(
                  key: ValueKey('${activeMarket.id}_${category.id}'),
                  color: Colors.white,
                  child: DecoratedBox(
                    decoration: const BoxDecoration(
                      border: Border(
                        bottom: BorderSide(color: Color(0xFFF1F5F9)),
                      ),
                    ),
                    child: ListTile(
                    dense: true,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 2,
                    ),
                    leading: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 24,
                          child: Text(
                            '${index + 1}º',
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ),
                        Icon(category.icon, color: category.color, size: 20),
                      ],
                    ),
                    title: Text(
                      category.label,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                    subtitle: Text(
                      '$keywordCount palavras configuradas',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF94A3B8),
                      ),
                    ),
                    onTap: () {
                      setState(() {
                        _selectedCategoryForKeywords = category;
                        _selectedTab = _ConfigTab.categoryKeywords;
                      });
                    },
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: 'Subir',
                          visualDensity: VisualDensity.compact,
                          icon: const Icon(
                            Icons.keyboard_arrow_up_rounded,
                            size: 20,
                            color: Color(0xFF64748B),
                          ),
                          onPressed: index > 0
                              ? () => controller.moveMarketCategory(
                                    activeMarket.id,
                                    index,
                                    index - 1,
                                  )
                              : null,
                        ),
                        IconButton(
                          tooltip: 'Descer',
                          visualDensity: VisualDensity.compact,
                          icon: const Icon(
                            Icons.keyboard_arrow_down_rounded,
                            size: 20,
                            color: Color(0xFF64748B),
                          ),
                          onPressed: index < categories.length - 1
                              ? () => controller.moveMarketCategory(
                                    activeMarket.id,
                                    index,
                                    index + 1,
                                  )
                              : null,
                        ),
                        ReorderableDragStartListener(
                          index: index,
                          child: const Padding(
                            padding: EdgeInsets.only(left: 4),
                            child: Icon(
                              Icons.drag_handle_rounded,
                              size: 20,
                              color: Color(0xFFCBD5E1),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  ),
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCategoryKeywordsSection(BuildContext context) {
    final controller = widget.controller;
    final allKeywords =
        controller.keywordsForCategory(_selectedCategoryForKeywords);
    final search = CategoryClassifier.normalize(_keywordSearchController.text);
    final filteredKeywords = search.isEmpty
        ? allKeywords
        : allKeywords
            .where((k) => CategoryClassifier.normalize(k).contains(search))
            .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Escolha uma categoria para personalizar quais produtos são reconhecidos automaticamente nela:',
                style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 8),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: ProductCategory.values.map((cat) {
                    final isSelected = cat == _selectedCategoryForKeywords;
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(
                        visualDensity: VisualDensity.compact,
                        avatar: Icon(cat.icon, size: 15, color: cat.color),
                        label: Text(cat.label),
                        selected: isSelected,
                        onSelected: (_) {
                          setState(() {
                            _selectedCategoryForKeywords = cat;
                          });
                        },
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 40,
                      child: TextField(
                        controller: _newKeywordController,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _handleAddKeyword(),
                        style: const TextStyle(fontSize: 14),
                        decoration: InputDecoration(
                          hintText:
                              'Adicionar item em ${_selectedCategoryForKeywords.label}...',
                          hintStyle: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF94A3B8),
                          ),
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(
                              color: Color(0xFFE2E8F0),
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(
                              color: Color(0xFFE2E8F0),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 40,
                    child: FilledButton.icon(
                      onPressed: _handleAddKeyword,
                      icon: const Icon(Icons.add_rounded, size: 18),
                      label: const Text('Adicionar'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              SizedBox(
                height: 38,
                child: TextField(
                  controller: _keywordSearchController,
                  onChanged: (_) => setState(() {}),
                  style: const TextStyle(fontSize: 13),
                  decoration: InputDecoration(
                    hintText:
                        'Filtrar itens de ${_selectedCategoryForKeywords.label} (${allKeywords.length})...',
                    hintStyle: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF94A3B8),
                    ),
                    prefixIcon: const Icon(Icons.search_rounded, size: 18),
                    suffixIcon: _keywordSearchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded, size: 16),
                            onPressed: () {
                              setState(() {
                                _keywordSearchController.clear();
                              });
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1, color: Color(0xFFE2E8F0)),
        Expanded(
          child: Material(
            color: Colors.white,
            child: filteredKeywords.isEmpty
                ? const Center(
                    child: Text(
                      'Nenhum item cadastrado para este filtro.',
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.only(bottom: 24),
                    itemCount: filteredKeywords.length,
                    separatorBuilder: (_, _) => const Divider(
                      height: 1,
                      color: Color(0xFFF1F5F9),
                    ),
                    itemBuilder: (context, index) {
                      final keyword = filteredKeywords[index];
                      return ListTile(
                        dense: true,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                        ),
                        leading: Icon(
                          _selectedCategoryForKeywords.icon,
                          size: 18,
                          color: _selectedCategoryForKeywords.color,
                        ),
                        title: Text(
                          keyword,
                          style: const TextStyle(
                            fontSize: 14,
                            color: Color(0xFF1E293B),
                          ),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              tooltip: 'Editar palavra ou trocar categoria',
                              visualDensity: VisualDensity.compact,
                              icon: const Icon(
                                Icons.edit_outlined,
                                size: 18,
                                color: Color(0xFF94A3B8),
                              ),
                              onPressed: () => _showEditKeywordDialog(
                                _selectedCategoryForKeywords,
                                keyword,
                              ),
                            ),
                            IconButton(
                              tooltip: 'Remover',
                              visualDensity: VisualDensity.compact,
                              icon: const Icon(
                                Icons.close_rounded,
                                size: 18,
                                color: Color(0xFFCBD5E1),
                              ),
                              onPressed: () {
                                controller.removeKeywordFromCategory(
                                  _selectedCategoryForKeywords,
                                  keyword,
                                );
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
    );
  }
}
