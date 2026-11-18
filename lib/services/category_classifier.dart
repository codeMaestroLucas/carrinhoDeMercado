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

  /// Dictionary of common multi-word abbreviations found on Brazilian supermarket receipts and NFC-e
  static const Map<String, String> commonPhraseAbbreviations = {
    // Creme de leite
    'cr leite': 'creme de leite',
    'cr lt': 'creme de leite',
    'crm leite': 'creme de leite',
    'crem leite': 'creme de leite',
    // Leite condensado & derivados
    'l cond': 'leite condensado',
    'lt cond': 'leite condensado',
    'leit cond': 'leite condensado',
    'lt sd': 'leite semidesnatado',
    // Limpa móveis & Casa & Banheiro
    'l mov': 'limpa moveis',
    'limp mov': 'limpa moveis',
    'lustr mov': 'lustra moveis',
    'lustra mov': 'lustra moveis',
    'tira man': 'tira manchas',
    'cx acop': 'caixa acoplada',
    'assento sanit': 'assento sanitario',
    // Água sanitária & Limpeza pesada
    'agua sanit': 'agua sanitaria',
    'ag sanit': 'agua sanitaria',
    'aq sanit': 'agua sanitaria',
    'clor ativ': 'cloro ativo',
    'limp vid': 'limpa vidros',
    'limpa vid': 'limpa vidros',
    'limp alum': 'limpa aluminio',
    'limpa alum': 'limpa aluminio',
    'limp forn': 'limpa forno',
    'limpa forn': 'limpa forno',
    'esp aco': 'esponja de aco',
    'esp mult': 'esponja multiuso',
    'pan prat': 'pano de prato',
    'pano prat': 'pano de prato',
    'pan chao': 'pano de chao',
    'pano chao': 'pano de chao',
    'pano mult': 'pano multiuso',
    'saco lix': 'saco de lixo',
    'sc lixo': 'saco de lixo',
    'sc lix': 'saco de lixo',
    'sab po': 'sabao em po',
    'sab em po': 'sabao em po',
    'sab barra': 'sabao em barra',
    'sab de coco': 'sabao de coco',
    'sab coco': 'sabao de coco',
    // Higiene & Papéis & Perfumaria
    'papel hig': 'papel higienico',
    'pap hig': 'papel higienico',
    'papel toalh': 'papel toalha',
    'pap toalh': 'papel toalha',
    'esc dent': 'escova dental',
    'esc dente': 'escova dental',
    'cr dent': 'creme dental',
    'crm dent': 'creme dental',
    'cd colg': 'creme dental colgate',
    'cd sorr': 'creme dental sorriso',
    'cd oral': 'creme dental oral',
    'cd sensod': 'creme dental sensodyne',
    'cd close': 'creme dental closeup',
    'fio dent': 'fio dental',
    'enx bucal': 'enxaguante bucal',
    'enxag bucal': 'enxaguante bucal',
    'ap barb': 'aparelho de barbear',
    'apar barb': 'aparelho de barbear',
    'esp barb': 'espuma de barbear',
    'cr barb': 'creme de barbear',
    'lam barb': 'lamina de barbear',
    'lenc umed': 'lenco umedecido',
    'lenco umed': 'lenco umedecido',
    'lenc umedec': 'lenco umedecido',
    'prot solar': 'protetor solar',
    'prot sol': 'protetor solar',
    'prot diar': 'protetor diario',
    'prot diario': 'protetor diario',
    'desod aer': 'desodorante aerosol',
    'desod aero': 'desodorante aerosol',
    'desod roll': 'desodorante roll on',
    'desod rolon': 'desodorante roll on',
    'd giov': 'desodorante giovanna',
    'giov bab': 'giovanna baby',
    'giov ba': 'giovanna baby',
    'giov baby': 'giovanna baby',
    'sh else': 'shampoo elseve',
    'cond else': 'condicionador elseve',
    'ag mice': 'agua micelar',
    'agua mice': 'agua micelar',
    'sab liq': 'sabonete liquido',
    // Molho / Extrato / Óleos / Matinais
    'molh tom': 'molho de tomate',
    'ext tom': 'extrato de tomate',
    'm tarant': 'molho tarantella',
    'molh shoyu': 'molho shoyu',
    'molh ingles': 'molho ingles',
    'az oliva': 'azeite de oliva',
    'az extravirgem': 'azeite extravirgem',
    'azeite extrav': 'azeite extravirgem',
    'azeite ext virgem': 'azeite extravirgem',
    'ext virgem': 'extravirgem',
    'ext virg': 'extravirgem',
    'ol soja': 'oleo de soja',
    'ol sj': 'oleo de soja',
    'oleo soj': 'oleo de soja',
    'ol girassol': 'oleo de girassol',
    'ol milho': 'oleo de milho',
    'far trigo': 'farinha de trigo',
    'far mandioca': 'farinha de mandioca',
    'far mand': 'farinha de mandioca',
    'mist bolo': 'mistura para bolo',
    'acuc refin': 'acucar refinado',
    'acuc crist': 'acucar cristal',
    'lt po': 'leite em po',
    'lt em po': 'leite em po',
    'leite po': 'leite em po',
    // Padaria & Laticínios
    'pao forma': 'pao de forma',
    'pao franc': 'pao frances',
    'pao fran': 'pao frances',
    'pao queijo': 'pao de queijo',
    'pao qj': 'pao de queijo',
    'pao qjo': 'pao de queijo',
    'beb lact': 'bebida lactea',
    'iog nat': 'iogurte natural',
    'qj ral': 'queijo ralado',
    // Batatas & Salgadinhos
    'bat palha': 'batata palha',
    'bat frita': 'batata frita',
    'bat chips': 'batata chips',
    // Carnes & Frios
    'peito frang': 'peito de frango',
    'pei frang': 'peito de frango',
    'peit frang': 'peito de frango',
    'fil frang': 'file de frango',
    'file frang': 'file de frango',
    'cox frang': 'coxa de frango',
    'cx frang': 'coxa de frango',
    's coxa': 'sobrecoxa',
    'sobr coxa': 'sobrecoxa',
    'c file': 'contra file',
    'cnt file': 'contra file',
    'contra fil': 'contra file',
    'fil mignon': 'file mignon',
    'fl mignon': 'file mignon',
    'carn moid': 'carne moida',
    'carne moid': 'carne moida',
    'carn moida': 'carne moida',
    'cost bov': 'costela bovina',
    'cost suin': 'costela suina',
    'li fgo': 'linguica de frango',
    'li cal': 'linguica calabresa',
    'li tosc': 'linguica toscana',
    'ling calab': 'linguica calabresa',
    'ling tosc': 'linguica toscana',
    'ling toscana': 'linguica toscana',
    'ling frang': 'linguica de frango',
    'cal def': 'calabresa defumada',
    'pei peru': 'peito de peru',
    'sand ipan': 'sandalia ipanema',
    // Bebidas
    'ag miner': 'agua mineral',
    'ag mineral': 'agua mineral',
    'agua min': 'agua mineral',
    'ag min': 'agua mineral',
    'ag tonica': 'agua tonica',
    'ag tonic': 'agua tonica',
    'agua ton': 'agua tonica',
    'ag coco': 'agua de coco',
    'agua coco': 'agua de coco',
    // Descartáveis & Embalagens
    'papel alum': 'papel aluminio',
    'pap alum': 'papel aluminio',
    'film pvc': 'filme pvc',
    'plast film': 'plastico filme',
    'papel mant': 'papel manteiga',
    'cop desc': 'copo descartavel',
    'copo desc': 'copo descartavel',
    'prat desc': 'prato descartavel',
    'prato desc': 'prato descartavel',
    'talh desc': 'talher descartavel',
    'sac plast': 'sacola plastica',
    'sacola plast': 'sacola plastica',
    'frald desc': 'fralda descartavel',
    'fralda desc': 'fralda descartavel',
    'frald inf': 'fralda infantil',
    'fralda inf': 'fralda infantil',
    'frald ger': 'fralda geriatrica',
    'fralda ger': 'fralda geriatrica',
    'filt pap': 'filtro de papel',
    'filtro pap': 'filtro de papel',
    'pilh alc': 'pilha alcalina',
    'pilha alc': 'pilha alcalina',
    // Restrições e modificadores
    's lact': 'sem lactose',
    'zero lact': 'zero lactose',
    's lactose': 'sem lactose',
    's glut': 'sem gluten',
    's gluten': 'sem gluten',
    's acuc': 'sem acucar',
    's gas': 'sem gas',
    'c gas': 'com gas',
    's sal': 'sem sal',
    'c sal': 'com sal',
  };

  /// Dictionary of common single-word abbreviations found on Brazilian supermarket receipts and NFC-e
  static const Map<String, String> commonAbbreviations = {
    // Specifically requested abbreviations:
    'lt': 'leite',
    'am': 'amaciante',
    'det': 'detergente',
    'deseng': 'desengordurante',
    'hid': 'hidratante',
    'cond': 'condicionador',
    'sh': 'shampoo',
    'esc': 'escova',
    'pip': 'pipoca',
    'qj': 'queijo',
    'oreg': 'oregano',
    'pei': 'peito',
    'esp': 'esponja',
    'bisc': 'biscoito',
    'iog': 'iogurte',

    // Supermarket single-word abbreviations:
    // Alimentos & Grãos
    'arr': 'arroz',
    'feij': 'feijao',
    'fej': 'feijao',
    'mac': 'macarrao',
    'macar': 'macarrao',
    'macarr': 'macarrao',
    'macc': 'macarrao',
    'espag': 'espaguete',
    'tarant': 'tarantella',
    'vinag': 'vinagre',
    'amid': 'amido',
    'ferm': 'fermento',
    'ferment': 'fermento',
    'far': 'farinha',
    'farin': 'farinha',
    'torrad': 'torrada',
    'torr': 'torrada',
    'crois': 'croissant',
    'gelat': 'gelatina',
    'acuc': 'acucar',
    'adoc': 'adocante',
    'azeit': 'azeitona',
    'temp': 'tempero',
    'temper': 'temperado',
    'molh': 'molho',
    'ext': 'extrato',
    'tom': 'tomate',
    'cen': 'cenoura',
    'bat': 'batata',
    'ceb': 'cebola',
    'baud': 'bauducco',

    // Laticínios e Matinais
    'iorg': 'iogurte',
    'iogurt': 'iogurte',
    'leit': 'leite',
    'qjo': 'queijo',
    'queij': 'queijo',
    'mussar': 'mussarela',
    'muss': 'mussarela',
    'parmes': 'parmesao',
    'parm': 'parmesao',
    'prov': 'provolone',
    'ricot': 'ricota',
    'gorg': 'gorgonzola',
    'requeij': 'requeijao',
    'req': 'requeijao',
    'manteig': 'manteiga',
    'mant': 'manteiga',
    'margar': 'margarina',
    'marg': 'margarina',
    'choc': 'chocolate',
    'achoc': 'achocolatado',
    'bol': 'bolacha',
    'bolach': 'bolacha',

    // Carnes & Frios
    'carn': 'carne',
    'alcatr': 'alcatra',
    'hamb': 'hamburguer',
    'frang': 'frango',
    'fgo': 'frango',
    'presun': 'presunto',
    'pres': 'presunto',
    'sard': 'sardinha',
    'picanh': 'picanha',
    'cost': 'costela',
    'ling': 'linguica',
    'lingui': 'linguica',
    'sals': 'salsicha',
    'salsich': 'salsicha',
    'mort': 'mortadela',
    'mortad': 'mortadela',
    'salam': 'salame',
    'cong': 'congelado',
    'fat': 'fatiado',
    'ft': 'fatiado',
    'ral': 'ralado',
    'moid': 'moida',
    'def': 'defumada',
    'apim': 'apimentada',

    // Bebidas
    'ag': 'agua',
    'refri': 'refrigerante',
    'refrig': 'refrigerante',
    'cerv': 'cerveja',
    'cervej': 'cerveja',
    'aguard': 'aguardente',
    'energ': 'energetico',
    'isot': 'isotonico',
    'nect': 'nectar',

    // Limpeza
    'desinf': 'desinfetante',
    'desf': 'desinfetante',
    'deterg': 'detergente',
    'amaciant': 'amaciante',
    'amac': 'amaciante',
    'dowc': 'downy concentrado',
    'polif': 'poliflor',
    'glad': 'glade',
    'coz': 'cozinha',
    'limp': 'limpador',
    'alvej': 'alvejante',
    'multius': 'multiuso',
    'inset': 'inseticida',
    'insetic': 'inseticida',
    'odoriz': 'odorizador',
    'aromat': 'aromatizador',

    // Higiene & Perfumaria & Infantil
    'sab': 'sabonete',
    'sbt': 'sabonete',
    'sabon': 'sabonete',
    'desod': 'desodorante',
    'desodor': 'desodorante',
    'shamp': 'shampoo',
    'shp': 'shampoo',
    'hidrat': 'hidratante',
    'hidr': 'hidratacao',
    'condic': 'condicionador',
    'colg': 'colgate',
    'acet': 'acetona',
    'cicatr': 'cicatricure',
    'hast': 'hastes',
    'cottonb': 'cottonbaby',
    'absorv': 'absorvente',
    'abs': 'absorvente',
    'frald': 'fralda',
    'prot': 'protetor',
    'ph': 'papel higienico',
    'sanit': 'sanitaria',
    'hig': 'higienico',
    'toalh': 'toalha',
    'guardan': 'guardanapo',

    // Especificações / Embalagem / Atributos
    'liq': 'liquido',
    'lq': 'liquido',
    'conc': 'concentrado',
    'rechead': 'recheado',
    'rech': 'recheado',
    'int': 'integral',
    'integr': 'integral',
    'trad': 'tradicional',
    'orig': 'original',
    'nat': 'natural',
    'desn': 'desnatado',
    'desnat': 'desnatado',
    'semidesn': 'semidesnatado',
    'instant': 'instantaneo',
    'inst': 'instantaneo',
    'alcal': 'alcalina',
    'almof': 'almofadado',
    'sach': 'sache',
    'pct': 'pacote',
    'pcte': 'pacote',
    'cx': 'caixa',
    'grf': 'garrafa',
    'unid': 'unidade',
    'emb': 'embalagem',
  };

  /// Expands multi-word phrases and common abbreviations in a text.
  /// Standardizes volume tokens (e.g. "1 lt" -> "1L") before expanding standalone "lt" -> "leite".
  static String expandAbbreviations(String text) {
    if (text.isEmpty) return text;

    // 1. Standardize volume/package tokens attached to numbers so "1 lt" -> "1L", "1K" -> "1kg", avoiding "1 leite"
    var result = text.replaceAllMapped(
      RegExp(r'\b(\d+(?:[,\.]\d+)?)\s*(?:l|lt|lts|litros?)\b', caseSensitive: false),
      (m) => '${m.group(1)!.replaceAll('.', ',')}L',
    );
    result = result.replaceAllMapped(
      RegExp(r'\b([1235]|10|0[,\.]\d+)\s*k\b', caseSensitive: false),
      (m) => '${m.group(1)!.replaceAll('.', ',')}kg',
    );

    // 2. Standardize slash notations ("s/s" -> "sem semente", "c/" -> "com ", "s/" -> "sem ", "p/" -> "para ")
    result = result.replaceAll(RegExp(r'\bs/s\b', caseSensitive: false), 'sem semente');
    result = result.replaceAll(RegExp(r'\bc/\s*', caseSensitive: false), 'com ');
    result = result.replaceAll(RegExp(r'\bs/\s*', caseSensitive: false), 'sem ');
    result = result.replaceAll(RegExp(r'\bp/\s*(?=[a-zA-ZÀ-ÿ])', caseSensitive: false), 'para ');

    // 3. Expand multi-word phrase abbreviations first (matching with word boundaries and flexible whitespace)
    for (final entry in commonPhraseAbbreviations.entries) {
      final phrasePattern = entry.key.split(' ').map(RegExp.escape).join(r'\s+');
      final pattern = RegExp(r'\b' + phrasePattern + r'\b', caseSensitive: false);
      result = result.replaceAll(pattern, entry.value);
    }

    // 4. Expand single-word abbreviations
    final lowerText = result.toLowerCase();
    final isBigMac = lowerText.contains('big mac');
    final words = result.split(RegExp(r'\s+'));
    final expanded = words.map((w) {
      final lower = w.replaceAll(RegExp(r'[^\w]'), '').toLowerCase();
      if (lower == 'mac' && isBigMac) {
        return w;
      }
      if (commonAbbreviations.containsKey(lower)) {
        return commonAbbreviations[lower]!;
      }
      return w;
    });

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
      'fralda descartável',
      'fralda descartavel',
      'fralda infantil',
      'lenço umedecido',
      'lenco umedecido',
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
      'sacola',
      'sacola plástica',
      'sacola plastica',
      'sacola biodegradável',
      'sacola biodegradavel',
      'sacola retornável',
      'sacola retornavel',
      'papel toalha',
      'guardanapo',
      'papel alumínio',
      'papel aluminio',
      'filme pvc',
      'plástico filme',
      'plastico filme',
      'papel manteiga',
      'copo descartável',
      'copo descartavel',
      'prato descartável',
      'prato descartavel',
      'talher descartável',
      'talher descartavel',
      'garfo descartável',
      'colher descartável',
      'canudo',
      'palito de dente',
      'espetinho',
      'saco de lixo',
      'saco lixo',
      'saco freezer',
      'embalagem descartável',
      'filtro de papel',
      'filtro de café',
      'coador de papel',
      'descartável',
      'descartavel',
    ],
    ProductCategory.perfumariaHigiene: [
      'papel higiênico',
      'papel higienico',
      'sabonete',
      'sabonete líquido',
      'sabonete liquido',
      'sabonete em barra',
      'shampoo',
      'xampu',
      'condicionador',
      'creme de pentear',
      'máscara capilar',
      'pasta de dente',
      'creme dental',
      'escova de dente',
      'escova dental',
      'escova de dentes',
      'escova',
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
      'hastes',
      'cottonbaby',
      'algodão',
      'algodao',
      'aparelho de barbear',
      'gillette',
      'espuma de barbear',
      'hidratante',
      'hidratante corporal',
      'agua micelar',
      'água micelar',
      'cicatricure',
      'giovanna baby',
      'elseve',
      'leite de rosas',
      'leite de colônia',
      'leite de colonia',
      'óleo corporal',
      'oleo corporal',
      'óleo capilar',
      'oleo capilar',
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
      'tixan',
      'minuano',
      'ajax',
      'harpic',
      'poliflor',
      'glade',
      'caixa acoplada',
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
      'pano de chao',
      'pano multiuso',
      'perfex',
      'flanela',
      'vassoura',
      'rodo',
      'pá de lixo',
      'balde',
      'lustra móveis',
      'lustra moveis',
      'limpa móveis',
      'limpa moveis',
      'limpador',
      'limpa vidro',
      'limpa vidros',
      'limpa alumínio',
      'limpa aluminio',
      'limpa forno',
      'alvejante',
      'cloro ativo',
      'aromatizador',
      'odorizador',
      'esponja de aço',
      'esponja de aco',
      'esponja multiuso',
      'escova sanitária',
      'escova sanitaria',
      'escova de limpeza',
      'óleo de peroba',
      'oleo de peroba',
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
      'álcool em gel',
      'alcool em gel',
      'limpeza',
      'luva de borracha',
      'prendedor de roupa',
    ],
    ProductCategory.bebidas: [
      'água mineral',
      'agua mineral',
      'água com gás',
      'agua com gas',
      'água tônica',
      'agua tonica',
      'água de coco',
      'agua de coco',
      'aguardente',
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
      'chá',
      'cha',
      'chá leão',
      'cha leao',
      'matte leão',
      'matte leao',
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
      'ralinho',
      'assento sanitário',
      'assento sanitario',
    ],
    ProductCategory.alimentos: [
      'arroz',
      'feijão',
      'feijao',
      'macarrão',
      'macarrao',
      'espaguete',
      'lasanha',
      'miojo',
      'massa de pastel',
      'massa de pizza',
      'massa folhada',
      'óleo de soja',
      'oleo de soja',
      'óleo de girassol',
      'oleo de girassol',
      'óleo de canola',
      'oleo de canola',
      'óleo de milho',
      'oleo de milho',
      'óleo vegetal',
      'oleo vegetal',
      'azeite',
      'vinagre',
      'sal refinado',
      'sal grosso',
      'sal marinho',
      'sal de cozinha',
      'sal',
      'açúcar',
      'acucar',
      'adoçante',
      'adocante',
      'café',
      'cafe',
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
      'provolone',
      'gorgonzola',
      'ricota',
      'presunto',
      'peito de peru',
      'mortadela',
      'salame',
      'linguiça',
      'linguica',
      'linguiça calabresa',
      'linguica calabresa',
      'linguiça toscana',
      'linguica toscana',
      'salsicha',
      'bacon',
      'carne',
      'bife',
      'patinho',
      'acém',
      'acem',
      'alcatra',
      'contra filé',
      'contra file',
      'filé mignon',
      'file mignon',
      'picanha',
      'costela',
      'carne moída',
      'carne moida',
      'frango',
      'sassami',
      'peito de frango',
      'peito bovino',
      'peito',
      'coxa de frango',
      'sobrecoxa',
      'asa de frango',
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
      'pão francês',
      'pao frances',
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
      'doce de leite',
      'goiabada',
      'sorvete',
      'iogurte',
      'danone',
      'molho de tomate',
      'extrato de tomate',
      'pomarola',
      'tarantella',
      'yoki',
      'freegells',
      'halls',
      'trident',
      'mentos',
      'bala',
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
      'batata chips',
      'chips de batata',
      'chips batata',
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
      'caldo de galinha',
      'caldo de carne',
      'tempero sazon',
      'tempero arisco',
      'tempero completo',
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
    const minConfidenceScore = 12;

    for (final entry in dictionary.entries) {
      if (entry.key == ProductCategory.diversos) continue;

      for (final rawKeyword in entry.value) {
        final keyword = normalize(rawKeyword);
        if (keyword.isEmpty) continue;

        int score = 0;

        // Exact match against expanded name
        if (keyword == expanded || keyword == normalized) {
          score = max(keyword.length * 10, 24);
        }
        // Multi-word phrase match (e.g. "pao de forma", "coca cola", "saco de lixo")
        else if (keyword.contains(' ')) {
          if (expanded.contains(keyword) || normalized.contains(keyword)) {
            score = max(keyword.length * 6, 20);
          }
        }
        // Single word matching & fuzzy approximation
        else {
          for (final word in expandedWords) {
            if (word == keyword) {
              score = max(score, max(keyword.length * 4, 14));
            }
            // Controlled prefix matching for abbreviations or words >= 4 letters
            else if (word.length >= 4 && keyword.length >= 5 && keyword.startsWith(word)) {
              score = max(score, word.length * 3);
            }
            else if (keyword.length >= 5 && word.length >= 5 && word.startsWith(keyword)) {
              score = max(score, keyword.length * 3);
            }
            // Fuzzy string similarity (Levenshtein distance) - only for longer words
            else if (word.length >= 5 && keyword.length >= 5) {
              final sim = stringSimilarity(word, keyword);
              if (sim >= 0.82) {
                score = max(score, (keyword.length * sim * 2.5).round());
              }
            }
          }

          // Check original item words too if they differ from expanded
          if (score == 0 && expanded != normalized) {
            for (final word in itemWords) {
              if (word == keyword) {
                score = max(score, max(keyword.length * 4, 14));
              } else if (word.length >= 4 && keyword.length >= 5 && keyword.startsWith(word)) {
                score = max(score, word.length * 3);
              } else if (word.length >= 5 && keyword.length >= 5) {
                final sim = stringSimilarity(word, keyword);
                if (sim >= 0.82) {
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

    if (bestScore < minConfidenceScore) {
      return ProductCategory.diversos;
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
