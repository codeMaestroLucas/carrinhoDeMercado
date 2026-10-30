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
    final rawNorm = buffer.toString().replaceAll(RegExp(r'\s+'), ' ').trim();
    return singularize(rawNorm);
  }

  /// Converts common Portuguese plural words to their singular form.
  /// Examples: "leites" -> "leite", "sabonetes" -> "sabonete", "matoes" -> "tomate",
  /// "pães" -> "pao", "bananas" -> "banana", "ovos" -> "ovo".
  static String singularize(String text) {
    if (text.isEmpty) return text;
    final words = text.split(' ');
    final resultWords = <String>[];

    for (final word in words) {
      if (word.length <= 3) {
        resultWords.add(word);
        continue;
      }

      // Words ending in 's'
      if (word.endsWith('s')) {
        // Words ending in 'oes' -> 'ao' (e.g. limoes -> limao, feijoes -> feijao)
        if (word.endsWith('oes') && word.length > 4) {
          resultWords.add('${word.substring(0, word.length - 3)}ao');
          continue;
        }
        // Words ending in 'aes' -> 'ao' (e.g. paes -> pao)
        if (word.endsWith('aes') && word.length > 4) {
          resultWords.add('${word.substring(0, word.length - 3)}ao');
          continue;
        }
        // Words ending in 'res' -> 'r' (e.g. bombons, hambúrgueres -> hamburguer)
        if (word.endsWith('res') && word.length > 4) {
          resultWords.add('${word.substring(0, word.length - 2)}');
          continue;
        }
        // Words ending in 'is' (e.g. pasteis -> pastel, pinceis -> pincel)
        if (word.endsWith('eis') && word.length > 4) {
          resultWords.add('${word.substring(0, word.length - 3)}el');
          continue;
        }
        // Words ending in 'ns' -> 'm' (e.g. bombons -> bombom)
        if (word.endsWith('ns') && word.length > 3) {
          resultWords.add('${word.substring(0, word.length - 2)}m');
          continue;
        }
        // Standard regular plural ending in vowel + s:
        // "leites" -> "leite", "bananas" -> "banana", "ovos" -> "ovo", "mangas" -> "manga"
        // Avoid stripping if word ends in 'is' or 'os' where base ends with s like "lapis", "pires", "onibus"
        final nonPluralWords = {'onibus', 'lapis', 'pires', 'virus', 'status', 'tenis', 'ouro', 'arroz', 'noz'};
        if (nonPluralWords.contains(word)) {
          resultWords.add(word);
          continue;
        }

        resultWords.add(word.substring(0, word.length - 1));
        continue;
      }

      resultWords.add(word);
    }

    return resultWords.join(' ');
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

  /// Parsed item with extracted name, quantity, and unit.
  static ({String name, int quantity, String unit, bool isPriceTotalByDefault}) extractQuantityAndName(String rawText) {
    var text = rawText.trim();
    if (text.isEmpty) {
      return (name: '', quantity: 1, unit: 'un', isPriceTotalByDefault: false);
    }

    // Helper to normalize unit string to canonical keys: 'un', 'kg', 'g', 'dz', 'cx', 'L'
    String normalizeUnit(String rawUnit) {
      final u = rawUnit.toLowerCase().trim();
      if (u == 'kg' || u == 'kilo' || u == 'kilos' || u == 'quilo' || u == 'quilos') {
        return 'kg';
      }
      if (u == 'g' || u == 'gr' || u == 'grama' || u == 'gramas') {
        return 'g';
      }
      if (u == 'dz' || u == 'duzia' || u == 'dúzia' || u == 'duzias' || u == 'dúzias') {
        return 'dz';
      }
      if (u == 'cx' || u == 'cxa' || u == 'caixa' || u == 'caixas' || u == 'pct' || u == 'pacote' || u == 'pacotes') {
        return 'cx';
      }
      if (u == 'l' || u == 'lt' || u == 'litro' || u == 'litros' || u == 'ml') {
        return 'L';
      }
      return 'un';
    }

    // 1. Suffix pattern with unit:
    // e.g.: "batata (2kg)", "leite [3cx]", "ovos (1dz)", "batata 2kg", "queijo 300g"
    final parenUnitSuffixRegex = RegExp(
      r'[\(\[]\s*(\d{1,4})\s*([a-zA-ZÀ-ÿ]{1,10})\s*[\)\]]\s*$',
      caseSensitive: false,
    );
    var match = parenUnitSuffixRegex.firstMatch(text);
    if (match != null) {
      final qty = int.tryParse(match.group(1) ?? '1') ?? 1;
      final unit = normalizeUnit(match.group(2) ?? 'un');
      final cleanedName = text.substring(0, match.start).trim();
      if (cleanedName.isNotEmpty) {
        final isWeightOrDoz = unit == 'kg' || unit == 'g' || unit == 'dz';
        return (
          name: cleanedName,
          quantity: qty > 0 ? qty : 1,
          unit: unit,
          isPriceTotalByDefault: isWeightOrDoz,
        );
      }
    }

    // Plain suffix with unit: e.g.: "batata 2kg", "leite 3cx", "ovos 1dz", "arroz 5kg", "suco 2L"
    final suffixUnitRegex = RegExp(
      r'(?:[-–—:]\s*)?(\d{1,4})\s*(kg|kilos?|quilos?|g|gr|gramas?|dz|d[uú]zias?|cx|caixas?|pct|pacotes?|l|litros?|un|und|unid|unidades?|[xX])\s*$',
      caseSensitive: false,
    );
    match = suffixUnitRegex.firstMatch(text);
    if (match != null) {
      final qty = int.tryParse(match.group(1) ?? '1') ?? 1;
      final rawU = match.group(2) ?? 'un';
      final unit = rawU.toLowerCase() == 'x' ? 'un' : normalizeUnit(rawU);
      final cleanedName = text.substring(0, match.start).trim();
      if (cleanedName.isNotEmpty) {
        final isWeightOrDoz = unit == 'kg' || unit == 'g' || unit == 'dz';
        return (
          name: cleanedName,
          quantity: qty > 0 ? qty : 1,
          unit: unit,
          isPriceTotalByDefault: isWeightOrDoz,
        );
      }
    }

    // 2. Prefix pattern with multi-letter unit:
    // e.g.: "2kg batata", "1dz ovos", "3cx leite", "5kg de arroz", "2x leite", "2un leite"
    // (Note: Require multi-letter units or explicit space after single letter units like 'L' or 'g'
    // so words starting with L or G like "leite", "goiaba", "garrafa" are NOT misparsed!)
    final prefixMultiUnitRegex = RegExp(
      r'^(\d{1,4})\s*(kg|kilos?|quilos?|gramas?|dz|d[uú]zias?|cx|caixas?|pct|pacotes?|litros?|un|und|unid|unidades?|[xX])\s*(?:de\s+)?(?:[-–—:]\s*)?',
      caseSensitive: false,
    );
    match = prefixMultiUnitRegex.firstMatch(text);
    if (match != null) {
      final qty = int.tryParse(match.group(1) ?? '1') ?? 1;
      final rawU = match.group(2) ?? 'un';
      final unit = rawU.toLowerCase() == 'x' ? 'un' : normalizeUnit(rawU);
      final cleanedName = text.substring(match.end).trim();
      if (cleanedName.isNotEmpty) {
        final isWeightOrDoz = unit == 'kg' || unit == 'g' || unit == 'dz';
        return (
          name: cleanedName,
          quantity: qty > 0 ? qty : 1,
          unit: unit,
          isPriceTotalByDefault: isWeightOrDoz,
        );
      }
    }

    // Prefix with single letter unit ('L' or 'g') REQUIRES whitespace before product name:
    // e.g. "2L leite", "2 L de leite", "500g queijo"
    final prefixSingleLetterUnitRegex = RegExp(
      r'^(\d{1,4})\s*([lLgG])\s+(?:de\s+)?(?:[-–—:]\s*)?',
      caseSensitive: false,
    );
    match = prefixSingleLetterUnitRegex.firstMatch(text);
    if (match != null) {
      final qty = int.tryParse(match.group(1) ?? '1') ?? 1;
      final rawU = match.group(2) ?? 'un';
      final unit = normalizeUnit(rawU);
      final cleanedName = text.substring(match.end).trim();
      if (cleanedName.isNotEmpty) {
        final isWeightOrDoz = unit == 'kg' || unit == 'g' || unit == 'dz';
        return (
          name: cleanedName,
          quantity: qty > 0 ? qty : 1,
          unit: unit,
          isPriceTotalByDefault: isWeightOrDoz,
        );
      }
    }

    // 3. Simple Parenthetical without unit: e.g.: "Leite (2)", "Leite [3]"
    final parenSuffixRegex = RegExp(r'[\(\[]\s*(\d{1,4})\s*[\)\]]\s*$');
    match = parenSuffixRegex.firstMatch(text);
    if (match != null) {
      final qty = int.tryParse(match.group(1) ?? '1') ?? 1;
      final cleanedName = text.substring(0, match.start).trim();
      if (cleanedName.isNotEmpty) {
        return (name: cleanedName, quantity: qty > 0 ? qty : 1, unit: 'un', isPriceTotalByDefault: false);
      }
    }

    // 4. "2 Leite" (digits at the start followed by space and letters, e.g. "3 Sabonetes")
    final simpleDigitPrefixRegex = RegExp(r'^(\d{1,4})\s+(?=[a-zA-ZÀ-ÿ])');
    match = simpleDigitPrefixRegex.firstMatch(text);
    if (match != null) {
      final qty = int.tryParse(match.group(1) ?? '1') ?? 1;
      final cleanedName = text.substring(match.end).trim();
      if (cleanedName.isNotEmpty) {
        return (name: cleanedName, quantity: qty > 0 ? qty : 1, unit: 'un', isPriceTotalByDefault: false);
      }
    }

    return (name: text, quantity: 1, unit: 'un', isPriceTotalByDefault: false);
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
        final parsed = extractQuantityAndName(cleaned);
        final baseName = parsed.name.isNotEmpty ? parsed.name : cleaned;
        final norm = normalize(baseName);
        if (norm.isNotEmpty && seenNormalized.add(norm)) {
          cleaned = cleaned[0].toUpperCase() + cleaned.substring(1);
          cleanedItems.add(cleaned);
        }
      }
    }
    return cleanedItems;
  }
}
