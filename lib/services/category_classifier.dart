import '../models/shopping_models.dart';

class CategoryClassifier {
  static String normalize(String input) {
    final lower = input.trim().toLowerCase();
    const diacriticsMap = {
      'á': 'a',
      'à': 'a',
      'â': 'a',
      'ã': 'a',
      'ä': 'a',
      'é': 'e',
      'è': 'e',
      'ê': 'e',
      'ë': 'e',
      'í': 'i',
      'ì': 'i',
      'î': 'i',
      'ï': 'i',
      'ó': 'o',
      'ò': 'o',
      'ô': 'o',
      'õ': 'o',
      'ö': 'o',
      'ú': 'u',
      'ù': 'u',
      'û': 'u',
      'ü': 'u',
      'ç': 'c',
      'ñ': 'n',
    };

    final buffer = StringBuffer();
    for (var i = 0; i < lower.length; i++) {
      final char = lower[i];
      buffer.write(diacriticsMap[char] ?? char);
    }
    return buffer.toString().replaceAll(RegExp(r'\s+'), ' ').trim();
  }

  static final Map<ProductCategory, List<String>> defaultKeywordDictionary = {
    ProductCategory.bebeCrianca: [
      'fralda',
      'lenço umedecido',
      'papinha',
      'mamadeira',
      'chupeta',
      'pomada assadura',
      'hipoglós',
      'bepantol baby',
      'shampoo infantil',
      'sabonete infantil',
      'leite nan',
      'aptamil',
      'nestogeno',
      'mucilon',
      'farinha láctea',
      'bebê',
      'infantil',
    ],
    ProductCategory.petShop: [
      'ração',
      'petisco',
      'areia higiênica',
      'areia de gato',
      'tapete higiênico',
      'sachê gato',
      'sachê cachorro',
      'antipulga',
      'coleira',
      'shampoo pet',
      'osso',
      'petshop',
      'cachorro',
      'gato',
    ],
    ProductCategory.descartaveis: [
      'papel toalha',
      'guardanapo',
      'papel alumínio',
      'filme pvc',
      'plástico filme',
      'papel manteiga',
      'copo descartável',
      'prato descartável',
      'talher descartável',
      'garfo descartável',
      'colher descartável',
      'canudo',
      'palito de dente',
      'espetinho',
      'saco de lixo',
      'sacola plástica',
      'saco freezer',
      'embalagem descartável',
      'filtro de papel',
      'filtro de café',
      'coador de papel',
      'descartável',
    ],
    ProductCategory.perfumariaHigiene: [
      'papel higiênico',
      'sabonete',
      'shampoo',
      'xampu',
      'condicionador',
      'creme de pentear',
      'máscara capilar',
      'pasta de dente',
      'creme dental',
      'escova de dente',
      'fio dental',
      'enxaguante bucal',
      'listerine',
      'colgate',
      'sorriso',
      'oral-b',
      'desodorante',
      'rexona',
      'dove',
      'nivea',
      'absorvente',
      'protetor diário',
      'cotonete',
      'hastes flexíveis',
      'algodão',
      'aparelho de barbear',
      'gillette',
      'espuma de barbear',
      'hidratante',
      'protetor solar',
      'perfume',
      'colônia',
      'acetona',
      'esmalte',
      'lixa de unha',
      'tintura',
      'gel de cabelo',
    ],
    ProductCategory.limpeza: [
      'detergente',
      'sabão em pó',
      'sabão líquido',
      'sabão em barra',
      'sabão de coco',
      'amaciante',
      'água sanitária',
      'cândida',
      'cloro',
      'desinfetante',
      'multiuso',
      'veja',
      'ypê',
      'limpa vidro',
      'limpa alumínio',
      'desengordurante',
      'esponja',
      'bucha',
      'bombril',
      'lã de aço',
      'palha de aço',
      'pano de chão',
      'pano multiuso',
      'perfex',
      'flanela',
      'vassoura',
      'rodo',
      'pá de lixo',
      'balde',
      'lustra móveis',
      'cera',
      'tira manchas',
      'vanish',
      'pedra sanitária',
      'pato purific',
      'inseticida',
      'sbp',
      'raid',
      'álcool',
      'limpeza',
      'luva de borracha',
      'prendedor de roupa',
    ],
    ProductCategory.bebidas: [
      'água mineral',
      'água com gás',
      'água de coco',
      'refrigerante',
      'coca-cola',
      'guaraná',
      'pepsi',
      'fanta',
      'sprite',
      'suco',
      'néctar',
      'del valle',
      'tang',
      'clight',
      'cerveja',
      'heineken',
      'brahma',
      'skol',
      'stella',
      'corona',
      'vinho',
      'espumante',
      'whisky',
      'vodka',
      'gin',
      'cachaça',
      'energético',
      'red bull',
      'monster',
      'isotônico',
      'gatorade',
      'chá mate',
      'chá gelado',
      'achocolatado líquido',
      'toddynho',
      'chamyto',
      'yakult',
      'bebida láctea',
    ],
    ProductCategory.bazar: [
      'pilha',
      'bateria',
      'lâmpada',
      'vela',
      'fósforo',
      'isqueiro',
      'pote',
      'tupperware',
      'vasilha',
      'forma',
      'assadeira',
      'panela',
      'frigideira',
      'copo de vidro',
      'xícara',
      'caneca',
      'prato',
      'talher',
      'faca',
      'garfo',
      'colher',
      'abridor',
      'tábua',
      'jarra',
      'garrafa térmica',
      'pano de prato',
      'toalha',
      'cabide',
      'fita adesiva',
      'super bonder',
      'cola',
      'extensão',
      'adaptador',
      'caderno',
      'caneta',
    ],
    ProductCategory.alimentos: [
      'arroz',
      'feijão',
      'macarrão',
      'massa',
      'espaguete',
      'lasanha',
      'miojo',
      'óleo',
      'azeite',
      'vinagre',
      'sal',
      'açúcar',
      'adoçante',
      'café',
      'chá',
      'leite',
      'leite condensado',
      'creme de leite',
      'manteiga',
      'margarina',
      'requeijão',
      'queijo',
      'mussarela',
      'parmesão',
      'ricota',
      'presunto',
      'peito de peru',
      'mortadela',
      'salame',
      'linguiça',
      'salsicha',
      'bacon',
      'carne',
      'bife',
      'patinho',
      'acém',
      'alcatra',
      'picanha',
      'costela',
      'carne moída',
      'frango',
      'peito de frango',
      'coxa',
      'sobrecoxa',
      'asa',
      'peixe',
      'tilápia',
      'salmão',
      'atum',
      'sardinha',
      'camarão',
      'ovo',
      'ovos',
      'pão',
      'torrada',
      'bisnaguinha',
      'bolo',
      'biscoito',
      'bolacha',
      'wafer',
      'cream cracker',
      'maizena',
      'amido de milho',
      'farinha',
      'fubá',
      'aveia',
      'granola',
      'cereal',
      'tapioca',
      'polvilho',
      'fermento',
      'gelatina',
      'chocolate',
      'bombom',
      'achocolatado',
      'nescau',
      'toddy',
      'nutella',
      'geleia',
      'mel',
      'doce',
      'goiabada',
      'sorvete',
      'iogurte',
      'danone',
      'molho de tomate',
      'extrato de tomate',
      'pomarola',
      'ketchup',
      'mostarda',
      'maionese',
      'shoyu',
      'azeitona',
      'palmito',
      'milho verde',
      'ervilha',
      'seleta',
      'batata',
      'batata palha',
      'batata frita',
      'cebola',
      'alho',
      'tomate',
      'alface',
      'rúcula',
      'agrião',
      'couve',
      'brócolis',
      'couve-flor',
      'cenoura',
      'beterraba',
      'abobrinha',
      'berinjela',
      'chuchu',
      'pepino',
      'pimentão',
      'mandioca',
      'aipim',
      'inhame',
      'abóbora',
      'cheiro verde',
      'coentro',
      'salsinha',
      'cebolinha',
      'manjericão',
      'orégano',
      'pimenta',
      'cominho',
      'colorau',
      'páprica',
      'caldo knorr',
      'tempero',
      'sazon',
      'banana',
      'maçã',
      'laranja',
      'limão',
      'mamão',
      'melancia',
      'melão',
      'uva',
      'morango',
      'abacaxi',
      'manga',
      'pera',
      'abacate',
      'kiwi',
      'maracujá',
      'goiaba',
      'pêssego',
      'ameixa',
      'castanha',
      'amendoim',
      'nozes',
      'pipoca',
      'salgadinho',
      'pizza',
      'hambúrguer',
      'nuggets',
      'pão de queijo',
      'lentilha',
      'grão de bico',
    ],
    ProductCategory.diversos: [],
  };

  static Map<ProductCategory, List<String>> cloneDefaultDictionary() {
    return {
      for (final category in ProductCategory.values)
        category: List<String>.from(
          defaultKeywordDictionary[category] ?? const [],
        ),
    };
  }

  static ProductCategory classify(
    String itemName, {
    Map<String, ProductCategory> customMemory = const {},
    Map<ProductCategory, List<String>>? customDictionary,
  }) {
    final normalized = normalize(itemName);
    if (normalized.isEmpty) {
      return ProductCategory.diversos;
    }

    // 1. Exact match in user's learned memory
    if (customMemory.containsKey(normalized)) {
      return customMemory[normalized]!;
    }

    final dictionary = customDictionary ?? defaultKeywordDictionary;

    // 2. Exact match in dictionary first
    for (final entry in dictionary.entries) {
      for (final rawKeyword in entry.value) {
        if (normalize(rawKeyword) == normalized) {
          return entry.key;
        }
      }
    }

    // 3. Partial match in user's learned memory
    for (final entry in customMemory.entries) {
      if (entry.key.length >= 3 &&
          (normalized.contains(entry.key) || entry.key.contains(normalized))) {
        return entry.value;
      }
    }

    // 4. Keyword / phrase match in dictionary
    ProductCategory? bestMatch;
    var bestMatchLength = 0;

    for (final entry in dictionary.entries) {
      for (final rawKeyword in entry.value) {
        final keyword = normalize(rawKeyword);
        if (keyword.isEmpty) continue;
        if (_matchesKeyword(normalized, keyword)) {
          if (keyword.length > bestMatchLength) {
            bestMatchLength = keyword.length;
            bestMatch = entry.key;
          }
        }
      }
    }

    return bestMatch ?? ProductCategory.diversos;
  }

  static bool _matchesKeyword(String normalizedItem, String keyword) {
    if (normalizedItem == keyword) return true;
    if (keyword.contains(' ')) {
      return normalizedItem.contains(keyword);
    }
    final words = normalizedItem.split(RegExp(r'[^a-z0-9]+'));
    for (final word in words) {
      if (word == keyword) return true;
      if (word.length > 3 &&
          word.endsWith('s') &&
          word.substring(0, word.length - 1) == keyword) {
        return true;
      }
      if (keyword.length >= 4 && word.startsWith(keyword)) {
        return true;
      }
    }
    return false;
  }

  /// Splits a pasted multi-line or comma/semicolon-separated text into clean, deduplicated item names.
  static List<String> parsePastedList(String rawText) {
    if (rawText.trim().isEmpty) return [];

    var rawSegments = rawText.split(RegExp(r'[\r\n;]+'));
    if (rawSegments.length == 1 && rawText.contains(',')) {
      rawSegments = rawText.split(',');
    }

    final cleanedItems = <String>[];
    final seenNormalized = <String>{};
    final prefixRegex = RegExp(
      r'^(\s*[-*•◦▪▫▸▹▻✓✔✗✘☐☑☒]\s*|\s*\[[ xX]?\]\s*|\s*\d+[\.\)\-]\s*)+',
    );

    for (final segment in rawSegments) {
      var cleaned = segment.replaceFirst(prefixRegex, '').trim();
      if (cleaned.isNotEmpty) {
        final norm = normalize(cleaned);
        if (norm.isNotEmpty && seenNormalized.add(norm)) {
          cleaned = cleaned[0].toUpperCase() + cleaned.substring(1);
          cleanedItems.add(cleaned);
        }
      }
    }
    return cleanedItems;
  }
}
