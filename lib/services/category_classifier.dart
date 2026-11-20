import 'dart:math';
import '../models/shopping_models.dart';

class CategoryClassifier {
  static String _stripDiacritics(String input) {
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
    return buffer.toString();
  }

  static String normalize(String input) {
    // Replace hyphens, slashes and underscores with spaces so 'coca-cola' matches 'coca cola'
    final rawNorm = _stripDiacritics(input)
        .replaceAll(RegExp(r'[-_/]'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    return singularize(rawNorm);
  }

  static const Set<String> _receiptNoiseTokens = {
    'cod',
    'codigo',
    'ref',
    'referencia',
    'plu',
    'ean',
    'gtin',
    'sku',
    'lote',
    'prom',
    'promocao',
    'oferta',
    'desc',
    'desconto',
    'kg',
    'un',
    'und',
    'unid',
    'unidade',
    'gr',
    'lt',
  };

  static const Set<String> _connectorWords = {
    'de',
    'da',
    'do',
    'das',
    'dos',
    'e',
    'em',
    'com',
    'para',
    'sem',
    'ao',
    'a',
    'o',
  };

  /// Normalizes a product name for price history grouping and comparison.
  /// Strips receipt codes (e.g. "COD 123", "#456", standalone 3+ digit PLU/EAN
  /// numbers), receipt noise tokens ("kg", "un", "prom"), expands common
  /// abbreviations, and singularizes words.
  static String normalizeForComparison(String input) {
    var cleaned = _stripDiacritics(input);

    // Remove explicit code prefixes with numbers (e.g. "cod 123", "ref: 45", "#987")
    cleaned = cleaned.replaceAll(
      RegExp(
        r'\b(?:cod|codigo|ref|referencia|plu|ean|gtin|sku|lote)\s*[:.#-]?\s*\d+\b',
      ),
      ' ',
    );
    cleaned = cleaned.replaceAll(RegExp(r'#\s*\d+\b'), ' ');

    // Replace common receipt punctuation with spaces
    cleaned = cleaned.replaceAll(RegExp(r'[-_/()\[\]{}:;.,#*]'), ' ');

    final rawTokens = cleaned
        .split(RegExp(r'\s+'))
        .where((t) => t.isNotEmpty)
        .toList();

    final filteredTokens = <String>[];
    for (final token in rawTokens) {
      if (_receiptNoiseTokens.contains(token)) continue;
      // Strip standalone numeric codes of 3+ digits (PLU, EAN, internal codes),
      // while keeping 1-2 digit numbers (e.g. "tipo 1", "12 rolos") and
      // numbers attached to units (e.g. "500g", "1l", "2kg").
      if (RegExp(r'^\d{3,}$').hasMatch(token)) continue;
      filteredTokens.add(token);
    }

    if (filteredTokens.isEmpty) {
      return normalize(input);
    }

    final expanded = expandAbbreviations(filteredTokens.join(' '));
    final result = singularize(expanded).trim();
    return result.isEmpty ? normalize(input) : result;
  }

  /// Computes a similarity score between 0.0 and 1.0 for two product names,
  /// combining token overlap (with fuzzy token matching) and Levenshtein ratio.
  static double productSimilarity(
    String a,
    String b, {
    ProductCategory? categoryA,
    ProductCategory? categoryB,
  }) {
    final normA = normalizeForComparison(a);
    final normB = normalizeForComparison(b);
    if (normA.isEmpty || normB.isEmpty) return 0.0;
    if (normA == normB) return 1.0;

    final tokensA = normA
        .split(' ')
        .where((t) => t.length > 1 && !_connectorWords.contains(t))
        .toSet()
        .toList();
    final tokensB = normB
        .split(' ')
        .where((t) => t.length > 1 && !_connectorWords.contains(t))
        .toSet()
        .toList();

    double tokenScore = 0.0;
    if (tokensA.isNotEmpty && tokensB.isNotEmpty) {
      var matchedA = 0.0;
      for (final ta in tokensA) {
        var best = 0.0;
        for (final tb in tokensB) {
          if (ta == tb) {
            best = 1.0;
            break;
          }
          final sim = stringSimilarity(ta, tb);
          if (sim >= 0.80 && sim > best) {
            best = sim;
          }
        }
        matchedA += best;
      }

      final unionCount = {...tokensA, ...tokensB}.length;
      final jaccard = unionCount > 0 ? matchedA / unionCount : 0.0;
      final minCount = min(tokensA.length, tokensB.length);
      final containment = minCount > 0 ? matchedA / minCount : 0.0;
      tokenScore = (0.55 * jaccard) + (0.45 * containment);
    }

    final wholeSim = stringSimilarity(normA, normB);
    var score = (0.60 * tokenScore) + (0.40 * wholeSim);

    if (categoryA != null &&
        categoryB != null &&
        categoryA == categoryB &&
        (tokenScore > 0.0 || wholeSim >= 0.45)) {
      score = min(1.0, score + 0.08);
    }

    return score.clamp(0.0, 1.0);
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
    // Embalagens, medidas e sacolas
    'sc': 'saco',
    'saco': 'saco',
    'ol': 'oleo',
    'oleo': 'oleo',
    'scl': 'sacola',
    'sacol': 'sacola',
    'pct': 'pacote',
    'pacot': 'pacote',
    'cx': 'caixa',
    'cxa': 'caixa',
    'fd': 'fardo',
    'fardo': 'fardo',
    'lix': 'lixo',
    'gar': 'garrafa',
    'garraf': 'garrafa',
    'lat': 'lata',
    'emb': 'embalagem',
    'bdj': 'bandeja',
    'bandej': 'bandeja',
    'refil': 'refil',
    'econ': 'economica',
    'econom': 'economico',

    // Carnes & Frios
    'bov': 'bovino',
    'bovina': 'bovina',
    'suin': 'suino',
    'suina': 'suina',
    'carn': 'carne',
    'frang': 'frango',
    'peit': 'peito',
    'alcat': 'alcatra',
    'alcatr': 'alcatra',
    'patin': 'patinho',
    'pat': 'patinho',
    'cost': 'costela',
    'costel': 'costela',
    'ling': 'linguica',
    'lingu': 'linguica',
    'sals': 'salsicha',
    'salsi': 'salsicha',
    'moid': 'moida',
    'moida': 'moida',
    'pic': 'picado',
    'acem': 'acem',
    'musc': 'musculo',
    'frald': 'fraldinha',
    'maminh': 'maminha',
    'picanh': 'picanha',
    'contra': 'contrafile',
    'file': 'file',
    'lomb': 'lombo',
    'bist': 'bisteca',
    'cupim': 'cupim',
    'sobrecox': 'sobrecoxa',
    'corac': 'coracao',
    'sard': 'sardinha',
    'atu': 'atum',
    'bacalh': 'bacalhau',
    'mussa': 'mussarela',
    'muss': 'mussarela',
    'mussar': 'mussarela',
    'parm': 'parmesao',
    'parmes': 'parmesao',
    'presun': 'presunto',
    'pres': 'presunto',
    'prov': 'provolone',
    'ricot': 'ricota',
    'qj': 'queijo',
    'queij': 'queijo',
    'lt': 'leite',
    'leit': 'leite',
    'req': 'requeijao',
    'requeij': 'requeijao',
    'fat': 'fatiado',
    'ral': 'ralado',

    // Congelados
    'cong': 'congelado',
    'congel': 'congelado',
    'emp': 'empanado',
    'empan': 'empanado',
    'nugg': 'nuggets',
    'hamb': 'hamburguer',
    'hamburg': 'hamburguer',
    'lasanh': 'lasanha',
    'pizz': 'pizza',

    // Vegetais & Hortifruti
    'veg': 'vegetal',
    'veget': 'vegetal',
    'hort': 'hortifruti',
    'leg': 'legume',
    'verd': 'verdura',
    'frut': 'fruta',
    'tomat': 'tomate',
    'tom': 'tomate',
    'ceb': 'cebola',
    'bat': 'batata',
    'batat': 'batata',
    'cen': 'cenoura',
    'cenour': 'cenoura',
    'alf': 'alface',
    'ban': 'banana',
    'lar': 'laranja',
    'maca': 'maca',
    'lim': 'limao',
    'mam': 'mamao',
    'melanc': 'melancia',
    'abac': 'abacaxi',
    'abob': 'abobora',
    'abobr': 'abobrinha',
    'chuch': 'chuchu',
    'alh': 'alho',

    // Mercearia & Bebidas
    'arr': 'arroz',
    'feij': 'feijao',
    'far': 'farinha',
    'farin': 'farinha',
    'trg': 'trigo',
    'trig': 'trigo',
    'acuc': 'acucar',
    'crist': 'cristal',
    'refin': 'refinado',
    'mac': 'macarrao',
    'macarr': 'macarrao',
    'molh': 'molho',
    'extr': 'extrato',
    'polp': 'polpa',
    'tempr': 'tempero',
    'temp': 'tempero',
    'oreg': 'oregano',
    'oregan': 'oregano',
    'azeit': 'azeite',
    'vinag': 'vinagre',
    'maion': 'maionese',
    'ketch': 'ketchup',
    'most': 'mostarda',
    'milh': 'milho',
    'ervilh': 'ervilha',
    'palm': 'palmito',
    'refri': 'refrigerante',
    'refrig': 'refrigerante',
    'cerv': 'cerveja',
    'cervej': 'cerveja',
    'chop': 'chopp',
    'suc': 'suco',
    'agu': 'agua',
    'miner': 'mineral',
    'bisc': 'biscoito',
    'bol': 'bolacha',
    'torrad': 'torrada',
    'torr': 'torrada',
    'choc': 'chocolate',
    'achoc': 'achocolatado',
    'manteig': 'manteiga',
    'margar': 'margarina',
    'iog': 'iogurte',
    'iorg': 'iogurte',
    'int': 'integral',
    'desn': 'desnatado',
    'desl': 'desnatado',
    'semi': 'semidesnatado',
    'gelat': 'gelatina',
    'rechead': 'recheado',
    'rech': 'recheado',
    'trad': 'tradicional',

    // Higiene & Limpeza
    'sab': 'sabonete',
    'sabon': 'sabonete',
    'sh': 'shampoo',
    'shamp': 'shampoo',
    'shp': 'shampoo',
    'cond': 'condicionador',
    'desod': 'desodorante',
    'des': 'desodorante',
    'aer': 'aerossol',
    'roll': 'roll-on',
    'cr': 'creme',
    'crem': 'creme',
    'dent': 'dental',
    'escov': 'escova',
    'hid': 'hidratante',
    'hidr': 'hidratante',
    'hidrat': 'hidratante',
    'fral': 'fralda',
    'abs': 'absorvente',
    'prot': 'protetor',
    'liq': 'liquido',
    'conc': 'concentrado',
    'det': 'detergente',
    'deterg': 'detergente',
    'amac': 'amaciante',
    'amaciant': 'amaciante',
    'limp': 'limpador',
    'desinf': 'desinfetante',
    'mult': 'multiuso',
    'esp': 'esponja',
    'esponja': 'esponja',
    'flan': 'flanela',
    'alvej': 'alvejante',
    'sanit': 'sanitario',
    'clor': 'cloro',
    'mov': 'moveis',
    'moveis': 'moveis',
    'roup': 'roupas',
    'roupa': 'roupas',
    'louc': 'loucas',
    'louca': 'loucas',
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
      'limpa vidros',
      'limpa alumínio',
      'limpa aluminio',
      'limpa móvel',
      'limpa movel',
      'limpa móveis',
      'limpa moveis',
      'lustra móvel',
      'lustra movel',
      'lustra móveis',
      'lustra moveis',
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
    ProductCategory.hortifruti: [
      'tomate',
      'cebola',
      'alho',
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
      'batata',
      'batata doce',
      'gengibre',
      'rabanete',
      'espinafre',
      'repolho',
      'vagem',
      'quiabo',
      'palmito fresco',
      'palmito',
      'cheiro verde',
      'coentro',
      'salsinha',
      'cebolinha',
      'manjericão',
      'manjericao',
      'orégano',
      'oregano',
      'alecrim',
      'hortelã',
      'hortela',
      'louro',
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
      'tangerina',
      'mexerica',
      'bergamota',
      'caqui',
      'caju',
      'acerola',
      'framboesa',
      'mirtilo',
      'amora',
      'jabuticaba',
      'figo',
      'coco',
      'vegetal',
      'vegetais',
      'legumes',
      'legume',
      'verduras',
      'verdura',
      'frutas',
      'fruta',
      'hortifruti',
    ],
    ProductCategory.congelados: [
      'congelado',
      'congelada',
      'congelados',
      'pizza',
      'pizza congelada',
      'pizza 4 queijos',
      'pizza quatro queijos',
      'pizza calabresa',
      'pizza de calabresa',
      'pizza mussarela',
      'pizza de mussarela',
      'pizza de frango',
      'sorvete de chocolate',
      'sorvete de morango',
      'sorvete de creme',
      'sorvete de baunilha',
      'sorvete de flocos',
      'hambúrguer',
      'hamburguer',
      'hambúrguer congelado',
      'nuggets',
      'nugget',
      'empanado',
      'lasanha congelada',
      'batata congelada',
      'batata pré-frita',
      'batata pre frita',
      'sorvete',
      'picolé',
      'picole',
      'açaí',
      'acai',
      'polpa de fruta',
      'polpa congelada',
      'pão de queijo congelado',
      'torta congelada',
      'legumes congelados',
      'vegetais congelados',
      'refeição congelada',
      'prato congelado',
      'hambúrguer bovino',
      'hambúrguer de frango',
      'isca de frango',
      'steak congelado',
      'almôndega',
      'almondega',
      'quibe congelado',
      'coxinha congelada',
      'salgadinho congelado',
      'gelo',
      'gelo saborizado',
      'cubos de gelo',
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
      'milho verde',
      'ervilha',
      'seleta',
      'chips',
      'batata palha',
      'batata frita',
      'batata chips',
      'chips batata',
      'chips de batata',
      'pimenta',
      'cominho',
      'colorau',
      'páprica',
      'paprica',
      'caldo knorr',
      'tempero',
      'sazon',
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
              int wScore = keyword.length * 4;
              if (expandedWords.isNotEmpty && expandedWords.first == word) {
                wScore += 14; // Priority boost for head noun / first word
              }
              score = max(score, wScore);
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
                int wScore = keyword.length * 4;
                if (itemWords.isNotEmpty && itemWords.first == word) {
                  wScore += 14;
                }
                score = max(score, wScore);
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

    // Require a minimum confidence score to avoid false positives for unclassified items
    // (e.g. unknown products fall back to Diversos).
    if (bestScore >= 9 && bestMatch != null) {
      return bestMatch;
    }

    return ProductCategory.diversos;
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
