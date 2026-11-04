import 'dart:math';
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
    // Replace hyphens, slashes and underscores with spaces so 'coca-cola' matches 'coca cola'
    final rawNorm = buffer
        .toString()
        .replaceAll(RegExp(r'[-_/]'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
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
          resultWords.add(word.substring(0, word.length - 2));
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

  /// Dictionary of common abbreviations found on supermarket receipts and NFC-e
  static const Map<String, String> commonAbbreviations = {
    'refri': 'refrigerante',
    'refrig': 'refrigerante',
    'bisc': 'biscoito',
    'bol': 'bolacha',
    'prot': 'protetor',
    'liq': 'liquido',
    'conc': 'concentrado',
    'choc': 'chocolate',
    'achoc': 'achocolatado',
    'manteig': 'manteiga',
    'margar': 'margarina',
    'iog': 'iogurte',
    'iorg': 'iogurte',
    'sab': 'sabonete',
    'desod': 'desodorante',
    'cond': 'condicionador',
    'shamp': 'shampoo',
    'desinf': 'desinfetante',
    'deterg': 'detergente',
    'amaciant': 'amaciante',
    'amac': 'amaciante',
    'alcatr': 'alcatra',
    'mussar': 'mussarela',
    'parmes': 'parmesao',
    'presun': 'presunto',
    'far': 'farinha',
    'farin': 'farinha',
    'torrad': 'torrada',
    'gelat': 'gelatina',
    'hamb': 'hamburguer',
    'rechead': 'recheado',
    'rech': 'recheado',
    'int': 'integral',
    'trad': 'tradicional',
  };

  /// Expands abbreviations in a normalized string.
  static String expandAbbreviations(String normalizedText) {
    final words = normalizedText.split(RegExp(r'\s+'));
    final expanded = words.map((w) => commonAbbreviations[w] ?? w);
    return expanded.join(' ');
  }

  /// Computes the Levenshtein distance between two strings.
  static int levenshteinDistance(String s1, String s2) {
    if (s1 == s2) return 0;
    if (s1.isEmpty) return s2.length;
    if (s2.isEmpty) return s1.length;

    List<int> v0 = List<int>.generate(s2.length + 1, (i) => i);
    List<int> v1 = List<int>.filled(s2.length + 1, 0);

    for (int i = 0; i < s1.length; i++) {
      v1[0] = i + 1;
      for (int j = 0; j < s2.length; j++) {
        final cost = (s1[i] == s2[j]) ? 0 : 1;
        v1[j + 1] = min(v1[j] + 1, min(v0[j + 1] + 1, v0[j] + cost));
      }
      for (int j = 0; j <= s2.length; j++) {
        v0[j] = v1[j];
      }
    }
    return v0[s2.length];
  }

  /// Returns string similarity ratio between 0.0 and 1.0 based on Levenshtein distance.
  static double stringSimilarity(String s1, String s2) {
    final maxLen = max(s1.length, s2.length);
    if (maxLen == 0) return 1.0;
    return 1.0 - (levenshteinDistance(s1, s2) / maxLen);
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
      'bepantol',
      'shampoo infantil',
      'sabonete infantil',
      'leite nan',
      'aptamil',
      'nestogeno',
      'mucilon',
      'farinha láctea',
      'bebê',
      'infantil',
      'pampers',
      'huggies',
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
      'pedigree',
      'whiskas',
      'friskies',
      'golden',
      'premier',
      'purina',
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
      'saco lixo',
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
      'oral b',
      'sensodyne',
      'desodorante',
      'rexona',
      'dove',
      'nivea',
      'carefree',
      'sempre livre',
      'intimus',
      'absorvente',
      'protetor diário',
      'protetor diario',
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
      'seda',
      'pantene',
      'palmolive',
      'lux',
    ],
    ProductCategory.limpeza: [
      'detergente',
      'sabão em pó',
      'sabao em po',
      'sabão líquido',
      'sabao liquido',
      'sabão em barra',
      'sabao em barra',
      'sabão de coco',
      'sabão',
      'sabao',
      'lava roupas',
      'omo',
      'brilhante',
      'ariel',
      'amaciante',
      'downy',
      'comfort',
      'água sanitária',
      'agua sanitaria',
      'cândida',
      'cloro',
      'qboa',
      'desinfetante',
      'pinho sol',
      'multiuso',
      'veja',
      'ypê',
      'ype',
      'limpa vidro',
      'limpa alumínio',
      'desengordurante',
      'esponja',
      'bucha',
      'bombril',
      'assolan',
      'scotch brite',
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
      'alcool',
      'limpeza',
      'luva de borracha',
      'prendedor de roupa',
    ],
    ProductCategory.bebidas: [
      'água mineral',
      'agua mineral',
      'água com gás',
      'agua com gas',
      'água de coco',
      'agua de coco',
      'refrigerante',
      'refri',
      'coca-cola',
      'coca cola',
      'coca',
      'pepsi',
      'guaraná',
      'guarana',
      'fanta',
      'sprite',
      'schweppes',
      'suco',
      'néctar',
      'del valle',
      'tang',
      'clight',
      'maguary',
      'cerveja',
      'heineken',
      'amstel',
      'brahma',
      'skol',
      'stella',
      'corona',
      'budweiser',
      'spaten',
      'vinho',
      'espumante',
      'whisky',
      'vodka',
      'gin',
      'cachaça',
      'cachaca',
      'energético',
      'energetico',
      'red bull',
      'monster',
      'isotônico',
      'isotonico',
      'gatorade',
      'chá mate',
      'cha mate',
      'chá gelado',
      'cha gelado',
      'achocolatado líquido',
      'toddynho',
      'chamyto',
      'yakult',
      'bebida láctea',
      'bebida lactea',
    ],
    ProductCategory.bazar: [
      'pilha',
      'bateria',
      'lâmpada',
      'lampada',
      'vela',
      'fósforo',
      'fosforo',
      'isqueiro',
      'pote',
      'tupperware',
      'vasilha',
      'forma de bolo',
      'assadeira',
      'panela',
      'frigideira',
      'copo de vidro',
      'xícara',
      'xicara',
      'caneca',
      'prato',
      'talher',
      'faca',
      'garfo',
      'colher',
      'abridor',
      'tábua',
      'tabua',
      'jarra',
      'garrafa térmica',
      'garrafa termica',
      'pano de prato',
      'toalha',
      'cabide',
      'fita adesiva',
      'super bonder',
      'cola escolar',
      'cola bastão',
      'extensão',
      'extensao',
      'adaptador',
      'caderno',
      'caneta',
    ],
    ProductCategory.alimentos: [
      'arroz',
      'feijão',
      'feijao',
      'macarrão',
      'macarrao',
      'massa',
      'espaguete',
      'lasanha',
      'miojo',
      'óleo',
      'oleo',
      'azeite',
      'vinagre',
      'sal',
      'açúcar',
      'acucar',
      'adoçante',
      'adocante',
      'café',
      'cafe',
      'chá',
      'cha',
      'leite',
      'leite condensado',
      'creme de leite',
      'manteiga',
      'margarina',
      'requeijão',
      'requeijao',
      'queijo',
      'mussarela',
      'mozzarella',
      'parmesão',
      'parmesao',
      'ricota',
      'presunto',
      'peito de peru',
      'mortadela',
      'salame',
      'linguiça',
      'linguica',
      'salsicha',
      'bacon',
      'carne',
      'bife',
      'patinho',
      'acém',
      'acem',
      'alcatra',
      'picanha',
      'costela',
      'carne moída',
      'carne moida',
      'frango',
      'peito de frango',
      'coxa',
      'sobrecoxa',
      'asa',
      'peixe',
      'tilápia',
      'tilapia',
      'salmão',
      'salmao',
      'atum',
      'sardinha',
      'camarão',
      'camarao',
      'ovo',
      'ovos',
      'pão',
      'pao',
      'pão de forma',
      'pao de forma',
      'pao forma',
      'bauducco',
      'pullman',
      'wickbold',
      'visconti',
      'torrada',
      'bisnaguinha',
      'bolo',
      'biscoito',
      'bolacha',
      'passatempo',
      'trakinas',
      'oreo',
      'bono',
      'wafer',
      'cream cracker',
      'maizena',
      'amido de milho',
      'farinha',
      'fubá',
      'fuba',
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
      'nestle',
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
      'chips',
      'batata palha',
      'batata frita',
      'cebola',
      'alho',
      'tomate',
      'alface',
      'rúcula',
      'rucula',
      'agrião',
      'agriao',
      'couve',
      'brócolis',
      'brocolis',
      'couve-flor',
      'couve flor',
      'cenoura',
      'beterraba',
      'abobrinha',
      'berinjela',
      'chuchu',
      'pepino',
      'pimentão',
      'pimentao',
      'mandioca',
      'aipim',
      'inhame',
      'abóbora',
      'abobora',
      'cheiro verde',
      'coentro',
      'salsinha',
      'cebolinha',
      'manjericão',
      'manjericao',
      'orégano',
      'oregano',
      'pimenta',
      'cominho',
      'colorau',
      'páprica',
      'paprica',
      'caldo knorr',
      'tempero',
      'sazon',
      'banana',
      'maçã',
      'maca',
      'laranja',
      'limão',
      'limao',
      'mamão',
      'mamao',
      'melancia',
      'melão',
      'melao',
      'uva',
      'morango',
      'abacaxi',
      'manga',
      'pera',
      'abacate',
      'kiwi',
      'maracujá',
      'maracuja',
      'goiaba',
      'pêssego',
      'pessego',
      'ameixa',
      'castanha',
      'amendoim',
      'nozes',
      'pipoca',
      'salgadinho',
      'doritos',
      'ruffles',
      'cheetos',
      'pringles',
      'lays',
      'fandangos',
      'pizza',
      'hambúrguer',
      'hamburguer',
      'nuggets',
      'pão de queijo',
      'pao de queijo',
      'lentilha',
      'grão de bico',
      'grao de bico',
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

  /// Classifies a product name into a [ProductCategory] using:
  /// 1. Exact match in user memory
  /// 2. Exact match in keyword dictionary
  /// 3. Partial match in user memory
  /// 4. Substring / multi-word keyword matching (with abbreviation expansion)
  /// 5. Word-level similarity & fuzzy approximation (prefix matching & Levenshtein)
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

    // 4. Multi-word phrase & word match with abbreviation expansion and scoring
    final expanded = expandAbbreviations(normalized);
    final itemWords = normalized.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    final expandedWords = expanded.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();

    ProductCategory? bestMatch;
    int bestScore = 0;

    for (final entry in dictionary.entries) {
      for (final rawKeyword in entry.value) {
        final keyword = normalize(rawKeyword);
        if (keyword.isEmpty) continue;

        int score = 0;

        // Exact match against expanded name
        if (keyword == expanded || keyword == normalized) {
          score = keyword.length * 10;
        }
        // Multi-word phrase match (e.g. "pao de forma", "coca cola", "saco de lixo")
        else if (keyword.contains(' ')) {
          if (expanded.contains(keyword) || normalized.contains(keyword)) {
            score = keyword.length * 6;
          }
        }
        // Single word matching & fuzzy approximation
        else {
          for (final word in expandedWords) {
            if (word == keyword) {
              score = max(score, keyword.length * 4);
            }
            // Prefix matching for abbreviations (e.g. "refri" -> "refrigerante", "prot" -> "protetor")
            else if (word.length >= 3 && keyword.length >= 4 && keyword.startsWith(word)) {
              score = max(score, word.length * 3);
            }
            else if (keyword.length >= 4 && word.length >= 4 && word.startsWith(keyword)) {
              score = max(score, keyword.length * 3);
            }
            // Fuzzy string similarity (Levenshtein distance)
            else if (word.length >= 4 && keyword.length >= 4) {
              final sim = stringSimilarity(word, keyword);
              if (sim >= 0.78) {
                score = max(score, (keyword.length * sim * 2.5).round());
              }
            }
          }

          // Check original item words too if they differ from expanded
          if (score == 0 && expanded != normalized) {
            for (final word in itemWords) {
              if (word == keyword) {
                score = max(score, keyword.length * 4);
              } else if (word.length >= 3 && keyword.length >= 4 && keyword.startsWith(word)) {
                score = max(score, word.length * 3);
              } else if (word.length >= 4 && keyword.length >= 4) {
                final sim = stringSimilarity(word, keyword);
                if (sim >= 0.78) {
                  score = max(score, (keyword.length * sim * 2.5).round());
                }
              }
            }
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = entry.key;
        }
      }
    }

    return bestMatch ?? ProductCategory.diversos;
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
