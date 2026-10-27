import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/shopping_models.dart';
import '../services/category_classifier.dart';
import '../services/cloud_sync_service.dart';
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

enum _ConfigTab { marketOrder, categoryKeywords, cloudSync }

class _MarketConfigScreenState extends State<MarketConfigScreen> {
  _ConfigTab _selectedTab = _ConfigTab.marketOrder;
  ProductCategory _selectedCategoryForKeywords = ProductCategory.alimentos;
  final TextEditingController _keywordSearchController =
      TextEditingController();
  final TextEditingController _newKeywordController = TextEditingController();
  final TextEditingController _joinSpaceCodeController =
      TextEditingController();
  bool _isSyncBusy = false;

  @override
  void dispose() {
    _keywordSearchController.dispose();
    _newKeywordController.dispose();
    _joinSpaceCodeController.dispose();
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
          else if (_selectedTab == _ConfigTab.categoryKeywords)
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
              showSelectedIcon: false,
              style: SegmentedButton.styleFrom(
                visualDensity: VisualDensity.compact,
                padding: const EdgeInsets.symmetric(horizontal: 6),
              ),
              segments: const [
                ButtonSegment(
                  value: _ConfigTab.marketOrder,
                  icon: Icon(Icons.swap_vert_rounded, size: 15),
                  label: Text(
                    'Mercados',
                    maxLines: 1,
                    softWrap: false,
                    style: TextStyle(fontSize: 11.5),
                  ),
                ),
                ButtonSegment(
                  value: _ConfigTab.categoryKeywords,
                  icon: Icon(Icons.sell_outlined, size: 15),
                  label: Text(
                    'Categorias',
                    maxLines: 1,
                    softWrap: false,
                    style: TextStyle(fontSize: 11.5),
                  ),
                ),
                ButtonSegment(
                  value: _ConfigTab.cloudSync,
                  icon: Icon(Icons.cloud_sync_outlined, size: 15),
                  label: Text(
                    'Compartilhar',
                    maxLines: 1,
                    softWrap: false,
                    style: TextStyle(fontSize: 11.5),
                  ),
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
                : _selectedTab == _ConfigTab.categoryKeywords
                    ? _buildCategoryKeywordsSection(context)
                    : _buildCloudSyncSection(context),
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

  Widget _buildCloudSyncSection(BuildContext context) {
    final controller = widget.controller;
    final isFirebaseReady = CloudSyncService.isFirebaseReady;
    final isConnected = controller.isCloudConnected;
    final currentSpaceCode = controller.sharedSpaceCode;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // 1. Status Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isConnected
                  ? const Color(0xFF99F6E4)
                  : const Color(0xFFE2E8F0),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    isConnected
                        ? Icons.cloud_done_rounded
                        : Icons.cloud_off_rounded,
                    color: isConnected
                        ? const Color(0xFF0D9488)
                        : const Color(0xFF64748B),
                    size: 22,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      isConnected
                          ? 'Sincronização em Tempo Real Ativa'
                          : 'Modo Local (Apenas neste aparelho)',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (isConnected && currentSpaceCode != null) ...[
                const Text(
                  'Compartilhe o código abaixo para sincronizarem a mesma lista, mercados e histórico em tempo real:',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDFA),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFCCFBF1)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(
                            currentSpaceCode,
                            maxLines: 1,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                              color: Color(0xFF0F766E),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      TextButton.icon(
                        style: TextButton.styleFrom(
                          visualDensity: VisualDensity.compact,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        onPressed: () {
                          Clipboard.setData(
                            ClipboardData(text: currentSpaceCode),
                          );
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'Código copiado para a área de transferência!',
                              ),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        },
                        icon: const Icon(Icons.copy_rounded, size: 15),
                        label: const Text(
                          'Copiar',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: () async {
                      await controller.disconnectSharedSpace();
                    },
                    icon: const Icon(
                      Icons.link_off_rounded,
                      size: 16,
                      color: Color(0xFFEF4444),
                    ),
                    label: const Text(
                      'Desconectar deste espaço',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFFEF4444),
                      ),
                    ),
                  ),
                ),
              ] else ...[
                const Text(
                  'Crie um código de espaço compartilhado ou digite o código gerado no outro celular para manterem a lista e o histórico sempre sincronizados.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
              ],
            ],
          ),
        ),

        const SizedBox(height: 12),

        // 2. Create or Join Shared Space Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Vincular Aparelhos (Espaço Familiar)',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  color: Color(0xFF1E293B),
                ),
              ),
              const SizedBox(height: 10),
              FilledButton.icon(
                onPressed: _isSyncBusy
                    ? null
                    : () async {
                        setState(() => _isSyncBusy = true);
                        try {
                          final code = await controller.createNewSharedSpace();
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'Espaço compartilhado "$code" criado!',
                                ),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('$e'),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          }
                        } finally {
                          if (mounted) setState(() => _isSyncBusy = false);
                        }
                      },
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0D9488),
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 12,
                  ),
                ),
                icon: const Icon(Icons.add_link_rounded, size: 16),
                label: const Text(
                  'Gerar Código Compartilhamento',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(height: 14),
              const Divider(height: 1, color: Color(0xFFF1F5F9)),
              const SizedBox(height: 14),
              const Text(
                'Já tem um código do outro aparelho?',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF475569),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 42,
                      child: TextField(
                        controller: _joinSpaceCodeController,
                        textCapitalization: TextCapitalization.characters,
                        decoration: InputDecoration(
                          hintText: 'Ex: CASA-4829',
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
                    height: 42,
                    child: OutlinedButton(
                      onPressed: _isSyncBusy
                          ? null
                          : () async {
                              final code = _joinSpaceCodeController.text.trim();
                              if (code.isEmpty) return;
                              setState(() => _isSyncBusy = true);
                              try {
                                await controller.joinExistingSharedSpace(code);
                                _joinSpaceCodeController.clear();
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        'Conectado ao espaço "$code"!',
                                      ),
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                }
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('$e'),
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                }
                              } finally {
                                if (mounted) {
                                  setState(() => _isSyncBusy = false);
                                }
                              }
                            },
                      child: const Text('Conectar'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        // 3. Setup Guide Box if Firebase project credentials aren't added yet
        if (!isFirebaseReady) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFDE68A)),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.info_outline_rounded,
                      size: 18,
                      color: Color(0xFFB45309),
                    ),
                    SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Como finalizar a conexão com seu Firebase gratuito:',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: Color(0xFF92400E),
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 6),
                Text(
                  '1. Crie um projeto gratuito em console.firebase.google.com\n'
                  '2. Ative o "Cloud Firestore"\n'
                  '3. No terminal do projeto, rode: flutterfire configure (ou coloque o arquivo google-services.json em android/app/ e GoogleService-Info.plist em ios/Runner/).',
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFF92400E),
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
