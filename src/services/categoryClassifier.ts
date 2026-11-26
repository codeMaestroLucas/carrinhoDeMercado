import {
  PRODUCT_CATEGORIES,
  type ProductCategoryId,
} from '../types/shopping';

const DIACRITICS_MAP: Record<string, string> = {
  á: 'a',
  à: 'a',
  â: 'a',
  ã: 'a',
  ä: 'a',
  é: 'e',
  è: 'e',
  ê: 'e',
  ë: 'e',
  í: 'i',
  ì: 'i',
  î: 'i',
  ï: 'i',
  ó: 'o',
  ò: 'o',
  ô: 'o',
  õ: 'o',
  ö: 'o',
  ú: 'u',
  ù: 'u',
  û: 'u',
  ü: 'u',
  ç: 'c',
  ñ: 'n',
};

const RECEIPT_NOISE_TOKENS = new Set([
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
]);

const CONNECTOR_WORDS = new Set([
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
]);

const NON_PLURAL_WORDS = new Set([
  'onibus',
  'lapis',
  'pires',
  'virus',
  'status',
  'tenis',
  'ouro',
  'arroz',
  'noz',
]);

export const COMMON_ABBREVIATIONS: Record<string, string> = {
  // Embalagens, medidas e sacolas
  sc: 'saco',
  saco: 'saco',
  ol: 'oleo',
  oleo: 'oleo',
  scl: 'sacola',
  sacol: 'sacola',
  pct: 'pacote',
  pacot: 'pacote',
  cx: 'caixa',
  cxa: 'caixa',
  fd: 'fardo',
  fardo: 'fardo',
  lix: 'lixo',
  gar: 'garrafa',
  garraf: 'garrafa',
  lat: 'lata',
  emb: 'embalagem',
  bdj: 'bandeja',
  bandej: 'bandeja',
  refil: 'refil',
  econ: 'economica',
  econom: 'economico',

  // Carnes & Frios
  bov: 'bovino',
  bovina: 'bovina',
  suin: 'suino',
  suina: 'suina',
  carn: 'carne',
  frang: 'frango',
  peit: 'peito',
  alcat: 'alcatra',
  alcatr: 'alcatra',
  patin: 'patinho',
  pat: 'patinho',
  cost: 'costela',
  costel: 'costela',
  ling: 'linguica',
  lingu: 'linguica',
  sals: 'salsicha',
  salsi: 'salsicha',
  moid: 'moida',
  moida: 'moida',
  pic: 'picado',
  acem: 'acem',
  musc: 'musculo',
  frald: 'fraldinha',
  maminh: 'maminha',
  picanh: 'picanha',
  contra: 'contrafile',
  file: 'file',
  lomb: 'lombo',
  bist: 'bisteca',
  cupim: 'cupim',
  sobrecox: 'sobrecoxa',
  corac: 'coracao',
  sard: 'sardinha',
  atu: 'atum',
  bacalh: 'bacalhau',
  mussa: 'mussarela',
  muss: 'mussarela',
  mussar: 'mussarela',
  parm: 'parmesao',
  parmes: 'parmesao',
  presun: 'presunto',
  pres: 'presunto',
  prov: 'provolone',
  ricot: 'ricota',
  qj: 'queijo',
  queij: 'queijo',
  lt: 'leite',
  leit: 'leite',
  req: 'requeijao',
  requeij: 'requeijao',
  fat: 'fatiado',
  ral: 'ralado',

  // Congelados
  cong: 'congelado',
  congel: 'congelado',
  emp: 'empanado',
  empan: 'empanado',
  nugg: 'nuggets',
  hamb: 'hamburguer',
  hamburg: 'hamburguer',
  lasanh: 'lasanha',
  pizz: 'pizza',

  // Vegetais & Hortifruti
  veg: 'vegetal',
  veget: 'vegetal',
  hort: 'hortifruti',
  leg: 'legume',
  verd: 'verdura',
  frut: 'fruta',
  tomat: 'tomate',
  tom: 'tomate',
  ceb: 'cebola',
  bat: 'batata',
  batat: 'batata',
  cen: 'cenoura',
  cenour: 'cenoura',
  alf: 'alface',
  ban: 'banana',
  lar: 'laranja',
  maca: 'maca',
  lim: 'limao',
  mam: 'mamao',
  melanc: 'melancia',
  abac: 'abacaxi',
  abob: 'abobora',
  abobr: 'abobrinha',
  chuch: 'chuchu',
  alh: 'alho',

  // Mercearia & Bebidas
  arr: 'arroz',
  feij: 'feijao',
  far: 'farinha',
  farin: 'farinha',
  trg: 'trigo',
  trig: 'trigo',
  acuc: 'acucar',
  crist: 'cristal',
  refin: 'refinado',
  mac: 'macarrao',
  macarr: 'macarrao',
  molh: 'molho',
  extr: 'extrato',
  polp: 'polpa',
  tempr: 'tempero',
  temp: 'tempero',
  oreg: 'oregano',
  oregan: 'oregano',
  azeit: 'azeite',
  vinag: 'vinagre',
  maion: 'maionese',
  ketch: 'ketchup',
  most: 'mostarda',
  milh: 'milho',
  ervilh: 'ervilha',
  palm: 'palmito',
  refri: 'refrigerante',
  refrig: 'refrigerante',
  cerv: 'cerveja',
  cervej: 'cerveja',
  chop: 'chopp',
  suc: 'suco',
  agu: 'agua',
  miner: 'mineral',
  bisc: 'biscoito',
  bol: 'bolacha',
  torrad: 'torrada',
  torr: 'torrada',
  choc: 'chocolate',
  achoc: 'achocolatado',
  manteig: 'manteiga',
  margar: 'margarina',
  iog: 'iogurte',
  iorg: 'iogurte',
  int: 'integral',
  desn: 'desnatado',
  desl: 'desnatado',
  semi: 'semidesnatado',
  gelat: 'gelatina',
  rechead: 'recheado',
  rech: 'recheado',
  trad: 'tradicional',
  tradiciona: 'tradicional',
  lv: 'longa vida',
  bj: 'bandeja',
  csl: 'casal',
  forn: 'forno',
  api: 'apis',
  lay: 'lays',
  chip: 'chips',
  batav: 'batavo',
  freegell: 'freegells',
  churro: 'churros',

  // Higiene & Limpeza
  sab: 'sabonete',
  sabon: 'sabonete',
  sh: 'shampoo',
  shamp: 'shampoo',
  shp: 'shampoo',
  cond: 'condicionador',
  desod: 'desodorante',
  des: 'desodorante',
  aer: 'aerossol',
  roll: 'roll-on',
  cr: 'creme',
  crem: 'creme',
  cren: 'cremoso',
  dent: 'dental',
  escov: 'escova',
  hid: 'hidratante',
  hidr: 'hidratante',
  hidrat: 'hidratante',
  fral: 'fralda',
  abs: 'absorvente',
  prot: 'protetor',
  liq: 'liquido',
  conc: 'concentrado',
  det: 'detergente',
  deterg: 'detergente',
  amac: 'amaciante',
  amaciant: 'amaciante',
  limp: 'limpador',
  desinf: 'desinfetante',
  mult: 'multiuso',
  esp: 'esponja',
  esponja: 'esponja',
  flan: 'flanela',
  alvej: 'alvejante',
  sanit: 'sanitario',
  clor: 'cloro',
  mov: 'moveis',
  moveis: 'moveis',
  roup: 'roupas',
  roupa: 'roupas',
  louc: 'loucas',
  louca: 'loucas',
  paraf: 'parafuso',
  tesou: 'tesoura',
  ft: 'fatiado',
  bco: 'branco',
  scotc: 'scotch',
  eucalipt: 'eucalipto',
  laranj: 'laranja',
  sapon: 'saponaceo',
  arom: 'aromatizador',
  ba: 'baby',
  bab: 'baby',
  cla: 'classic',
  blu: 'blue',
  johnsom: 'johnsons',
  cohdor: 'condor',
  charhe: 'charme',
};

export const DEFAULT_KEYWORD_DICTIONARY: Record<ProductCategoryId, string[]> = {
  bebe_crianca: [
    'fralda', 'lenço umedecido', 'papinha', 'mamadeira', 'chupeta',
    'pomada assadura', 'hipoglós', 'bepantol baby', 'bepantol',
    'shampoo infantil', 'sabonete infantil', 'leite nan', 'aptamil',
    'nestogeno', 'mucilon', 'farinha láctea', 'bebê', 'infantil',
    'pampers', 'huggies',
  ],
  pet_shop: [
    'ração', 'petisco', 'areia higiênica', 'areia de gato',
    'tapete higiênico', 'sachê gato', 'sachê cachorro', 'antipulga',
    'coleira', 'shampoo pet', 'pedigree', 'whiskas', 'friskies',
    'golden', 'premier', 'purina', 'osso', 'petshop', 'cachorro', 'gato',
  ],
  descartaveis: [
    'papel toalha', 'guardanapo', 'papel alumínio', 'filme pvc',
    'plástico filme', 'papel manteiga', 'copo descartável',
    'prato descartável', 'talher descartável', 'garfo descartável',
    'colher descartável', 'canudo', 'palito de dente', 'espetinho',
    'saco de lixo', 'saco lixo', 'sacola plástica', 'saco freezer',
    'embalagem descartável', 'filtro de papel', 'filtro de café',
    'coador de papel', 'descartável',
  ],
  perfumaria_higiene: [
    'papel higiênico', 'sabonete', 'shampoo', 'xampu', 'condicionador',
    'creme de pentear', 'máscara capilar', 'pasta de dente', 'creme dental',
    'escova de dente', 'fio dental', 'enxaguante bucal', 'listerine',
    'colgate', 'sorriso', 'oral-b', 'oral b', 'sensodyne', 'desodorante',
    'rexona', 'dove', 'nivea', 'carefree', 'sempre livre', 'intimus',
    'absorvente', 'protetor diário', 'protetor diario', 'cotonete',
    'hastes flexíveis', 'algodão', 'aparelho de barbear', 'gillette',
    'espuma de barbear', 'hidratante', 'protetor solar', 'perfume',
    'colônia', 'acetona', 'esmalte', 'lixa de unha', 'tintura',
    'gel de cabelo', 'seda', 'pantene', 'palmolive', 'lux',
  ],
  limpeza: [
    'detergente', 'sabão em pó', 'sabao em po', 'sabão líquido',
    'sabao liquido', 'sabão em barra', 'sabao em barra', 'sabão de coco',
    'sabão', 'sabao', 'lava roupas', 'omo', 'brilhante', 'ariel',
    'amaciante', 'downy', 'comfort', 'água sanitária', 'agua sanitaria',
    'cândida', 'cloro', 'qboa', 'desinfetante', 'pinho sol', 'multiuso',
    'veja', 'ypê', 'ype', 'limpa vidro', 'limpa vidros', 'limpa alumínio',
    'limpa aluminio', 'limpa móvel', 'limpa movel', 'limpa móveis',
    'limpa moveis', 'lustra móvel', 'lustra movel', 'lustra móveis',
    'lustra moveis', 'desengordurante', 'esponja', 'bucha', 'bombril',
    'assolan', 'scotch brite', 'lã de aço', 'palha de aço', 'pano de chão',
    'pano multiuso', 'perfex', 'flanela', 'vassoura', 'rodo', 'pá de lixo',
    'balde', 'lustra móveis', 'cera', 'tira manchas', 'vanish',
    'pedra sanitária', 'pato purific', 'inseticida', 'sbp', 'raid',
    'álcool', 'alcool', 'limpeza', 'luva de borracha', 'prendedor de roupa',
  ],
  bebidas: [
    'água mineral', 'agua mineral', 'água com gás', 'agua com gas',
    'água de coco', 'agua de coco', 'refrigerante', 'refri', 'coca-cola',
    'coca cola', 'coca', 'pepsi', 'guaraná', 'guarana', 'fanta', 'sprite',
    'schweppes', 'suco', 'néctar', 'del valle', 'tang', 'clight',
    'maguary', 'cerveja', 'heineken', 'amstel', 'brahma', 'skol',
    'stella', 'corona', 'budweiser', 'spaten', 'vinho', 'espumante',
    'whisky', 'vodka', 'gin', 'cachaça', 'cachaca', 'energético',
    'energetico', 'red bull', 'monster', 'isotônico', 'isotonico',
    'gatorade', 'chá mate', 'cha mate', 'chá gelado', 'cha gelado',
    'achocolatado líquido', 'toddynho', 'chamyto', 'yakult',
    'bebida láctea', 'bebida lactea',
  ],
  bazar: [
    'pilha', 'bateria', 'lâmpada', 'lampada', 'vela', 'fósforo', 'fosforo',
    'isqueiro', 'pote', 'tupperware', 'vasilha', 'forma de bolo', 'assadeira',
    'panela', 'frigideira', 'copo de vidro', 'xícara', 'xicara', 'caneca',
    'prato', 'talher', 'faca', 'garfo', 'colher', 'abridor', 'tábua',
    'tabua', 'jarra', 'garrafa térmica', 'garrafa termica', 'pano de prato',
    'toalha', 'cabide', 'fita adesiva', 'fita dupla face', 'fita isolante',
    'super bonder', 'cola escolar', 'cola bastão', 'extensão', 'extensao',
    'adaptador', 'filtro de linha', 'tomada', 'pino t', 'pino 3 saidas',
    'pino adaptador', 'parafuso', 'prego', 'alicate', 'estilete',
    'chave allen', 'chave de fenda', 'tesoura', 'wd-40', 'desengripante',
    'tramontina', 'ferramenta', 'caderno', 'caneta',
  ],
  hortifruti: [
    'tomate', 'cebola', 'alho', 'alface', 'rúcula', 'rucula', 'agrião',
    'agriao', 'couve', 'brócolis', 'brocolis', 'couve-flor', 'couve flor',
    'cenoura', 'beterraba', 'abobrinha', 'berinjela', 'chuchu', 'pepino',
    'pimentão', 'pimentao', 'mandioca', 'aipim', 'inhame', 'abóbora',
    'abobora', 'batata', 'batata doce', 'gengibre', 'rabanete', 'espinafre',
    'repolho', 'vagem', 'quiabo', 'palmito fresco', 'palmito', 'cheiro verde',
    'coentro', 'salsinha', 'cebolinha', 'manjericão', 'manjericao', 'orégano',
    'oregano', 'alecrim', 'hortelã', 'hortela', 'louro', 'banana', 'maçã',
    'maca', 'laranja', 'limão', 'limao', 'mamão', 'mamao', 'melancia',
    'melão', 'melao', 'uva', 'morango', 'abacaxi', 'manga', 'pera',
    'abacate', 'kiwi', 'maracujá', 'maracuja', 'goiaba', 'pêssego',
    'pessego', 'ameixa', 'tangerina', 'mexerica', 'bergamota', 'caqui',
    'caju', 'acerola', 'framboesa', 'mirtilo', 'amora', 'jabuticaba', 'figo',
    'coco', 'vegetal', 'vegetais', 'legumes', 'legume', 'verduras', 'verdura',
    'frutas', 'fruta', 'hortifruti',
  ],
  congelados: [
    'congelado', 'congelada', 'congelados', 'pizza', 'pizza congelada',
    'pizza 4 queijos', 'pizza quatro queijos', 'pizza calabresa',
    'pizza de calabresa', 'pizza mussarela', 'pizza de mussarela',
    'pizza de frango', 'sorvete de chocolate', 'sorvete de morango',
    'sorvete de creme', 'sorvete de baunilha', 'sorvete de flocos',
    'hambúrguer', 'hamburguer', 'hambúrguer congelado', 'nuggets', 'nugget',
    'empanado', 'lasanha congelada', 'batata congelada', 'batata pré-frita',
    'batata pre frita', 'sorvete', 'picolé', 'picole', 'açaí', 'acai',
    'polpa de fruta', 'polpa congelada', 'pão de queijo congelado',
    'torta congelada', 'legumes congelados', 'vegetais congelados',
    'refeição congelada', 'prato congelado', 'hambúrguer bovino',
    'hambúrguer de frango', 'isca de frango', 'steak congelado',
    'almôndega', 'almondega', 'quibe congelado', 'coxinha congelada',
    'salgadinho congelado', 'gelo', 'gelo saborizado', 'cubos de gelo',
  ],
  alimentos: [
    'arroz', 'feijão', 'feijao', 'macarrão', 'macarrao', 'massa',
    'espaguete', 'lasanha', 'miojo', 'óleo', 'oleo', 'azeite', 'vinagre',
    'sal', 'açúcar', 'acucar', 'adoçante', 'adocante', 'café', 'cafe',
    'chá', 'cha', 'leite', 'leite condensado', 'creme de leite', 'manteiga',
    'margarina', 'requeijão', 'requeijao', 'queijo', 'mussarela',
    'mozzarella', 'parmesão', 'parmesao', 'ricota', 'presunto',
    'peito de peru', 'mortadela', 'salame', 'linguiça', 'linguica',
    'salsicha', 'bacon', 'carne', 'bife', 'patinho', 'acém', 'acem',
    'alcatra', 'picanha', 'costela', 'carne moída', 'carne moida', 'frango',
    'peito de frango', 'coxa', 'sobrecoxa', 'asa', 'peixe', 'tilápia',
    'tilapia', 'salmão', 'salmao', 'atum', 'sardinha', 'camarão', 'camarao',
    'ovo', 'ovos', 'pão', 'pao', 'pão de forma', 'pao de forma',
    'pao forma', 'bauducco', 'pullman', 'wickbold', 'visconti', 'torrada',
    'bisnaguinha', 'bolo', 'biscoito', 'bolacha', 'passatempo', 'trakinas',
    'oreo', 'bono', 'wafer', 'cream cracker', 'maizena', 'amido de milho',
    'farinha', 'fubá', 'fuba', 'aveia', 'granola', 'cereal', 'tapioca',
    'polvilho', 'fermento', 'gelatina', 'chocolate', 'bombom',
    'achocolatado', 'nescau', 'toddy', 'nutella', 'geleia', 'mel', 'doce',
    'goiabada', 'iogurte', 'danone', 'nestle', 'molho de tomate',
    'extrato de tomate', 'pomarola', 'ketchup', 'mostarda', 'maionese',
    'shoyu', 'azeitona', 'milho verde', 'ervilha', 'seleta', 'chips',
    'batata palha', 'batata frita', 'batata chips', 'chips batata',
    'chips de batata', 'pimenta', 'cominho', 'colorau', 'páprica',
    'paprica', 'caldo knorr', 'tempero', 'sazon', 'castanha', 'amendoim',
    'nozes', 'pipoca', 'salgado', 'salgadinho', 'doritos', 'ruffles', 'cheetos',
    'pringles', 'lays', 'fandangos', 'pão de queijo', 'pao de queijo',
    'lentilha', 'grão de bico', 'grao de bico',
  ],
  diversos: [],
};

export function stripDiacritics(input: string): string {
  const lower = input.trim().toLowerCase();
  let out = '';
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    out += DIACRITICS_MAP[ch] ?? ch;
  }
  return out;
}

export function singularize(text: string): string {
  if (!text) return text;
  const words = text.split(' ');
  const resultWords: string[] = [];

  for (const word of words) {
    if (word.length <= 3) {
      resultWords.push(word);
      continue;
    }

    if (word.endsWith('s')) {
      if (word.endsWith('oes') && word.length > 4) {
        resultWords.push(`${word.slice(0, -3)}ao`);
        continue;
      }
      if (word.endsWith('aes') && word.length > 4) {
        resultWords.push(`${word.slice(0, -3)}ao`);
        continue;
      }
      if (word.endsWith('res') && word.length > 4) {
        resultWords.push(word.slice(0, -2));
        continue;
      }
      if (word.endsWith('eis') && word.length > 4) {
        resultWords.push(`${word.slice(0, -3)}el`);
        continue;
      }
      if (word.endsWith('ns') && word.length > 3) {
        resultWords.push(`${word.slice(0, -2)}m`);
        continue;
      }
      if (NON_PLURAL_WORDS.has(word)) {
        resultWords.push(word);
        continue;
      }
      resultWords.push(word.slice(0, -1));
      continue;
    }

    resultWords.push(word);
  }

  return resultWords.join(' ');
}

export function normalize(input: string): string {
  const rawNorm = stripDiacritics(input)
    .replace(/[-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return singularize(rawNorm);
}

export function expandAbbreviations(normalizedText: string): string {
  return normalizedText
    .split(/\s+/)
    .map((w) => COMMON_ABBREVIATIONS[w] ?? w)
    .join(' ');
}

const SPLIT_OCR_WORD_PAIRS: Record<string, string> = {
  'alve+jado': 'alvejado',
  'rlve+jado': 'alvejado',
};

function canonicalizeUnitSuffix(rawUnit: string): string {
  const u = rawUnit.toLowerCase();
  if (u === 'lt' || u === 'litro' || u === 'litros' || u === 'l') return 'l';
  if (u === 'gr' || u === 'grama' || u === 'gramas' || u === 'g') return 'g';
  if (u === 'kilo' || u === 'kilos' || u === 'quilo' || u === 'quilos' || u === 'kg')
    return 'kg';
  return u;
}

function normalizeComparisonMeasurements(text: string): string {
  // Join decimal quantities with units (e.g. "1,5lt" or "1 5l" -> "1.5l")
  let out = text.replace(
    /\b(\d+)[,.](\d+)\s*(lt|litros?|l|kg|kilos?|quilos?|gr|gramas?|g|ml)\b/g,
    (_m, whole: string, frac: string, unit: string) =>
      `${whole}.${frac}${canonicalizeUnitSuffix(unit)}`,
  );
  out = out.replace(
    /\b(\d+)\s+(\d)\s*(lt|litros?|l|kg|kilos?|quilos?|gr|gramas?|g|ml)\b/g,
    (_m, whole: string, frac: string, unit: string) =>
      `${whole}.${frac}${canonicalizeUnitSuffix(unit)}`,
  );
  // Canonicalize integer or decimal unit forms (e.g. "2lt" -> "2l", "500 gr" -> "500g")
  out = out.replace(
    /\b(\d+(?:\.\d+)?)\s*(lt|litros?|l|kg|kilos?|quilos?|gr|gramas?|g|ml)\b/g,
    (_m, num: string, unit: string) => `${num}${canonicalizeUnitSuffix(unit)}`,
  );
  return out;
}

export function extractMeasurementSignatures(normalizedText: string): string[] {
  const signatures: string[] = [];
  const regex = /\b(\d+(?:\.\d+)?)(ml|l|g|kg)\b/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(normalizedText)) !== null) {
    const val = Number.parseFloat(match[1]);
    const unit = match[2];
    if (!Number.isFinite(val) || val <= 0) continue;
    if (unit === 'l') {
      signatures.push(`${Math.round(val * 1000)}ml`);
    } else if (unit === 'ml') {
      signatures.push(`${Math.round(val)}ml`);
    } else if (unit === 'kg') {
      signatures.push(`${Math.round(val * 1000)}g`);
    } else if (unit === 'g') {
      signatures.push(`${Math.round(val)}g`);
    }
  }
  return Array.from(new Set(signatures)).sort();
}

export function areMeasurementsCompatible(
  normalizedA: string,
  normalizedB: string,
): boolean {
  const measA = extractMeasurementSignatures(normalizedA);
  const measB = extractMeasurementSignatures(normalizedB);
  if (measA.length === 0 || measB.length === 0) return true;
  if (measA.length !== measB.length) return false;
  return measA.every((m, idx) => m === measB[idx]);
}

const MEASUREMENT_TOKEN_REGEX = /^\d+(?:\.\d+)?(?:ml|l|g|kg)$/;

function comparisonTokenScore(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) {
    const minLen = Math.min(a.length, b.length);
    const maxLen = Math.max(a.length, b.length);
    if (minLen / maxLen >= 0.7) {
      return 0.94;
    }
  }
  const hasDigit = /\d/.test(a) || /\d/.test(b);
  if (a.length >= 4 && b.length >= 4) {
    const sim = stringSimilarity(a, b);
    if (sim >= (hasDigit ? 0.65 : 0.75)) {
      return sim;
    }
  }
  return 0;
}

/**
 * Determines whether two normalized comparison keys represent variants of the
 * same product (handling NFC-e truncations, OCR typos, and subset phrasing)
 * while keeping distinct sizes/volumes and distinct product varieties apart.
 */
export function areComparisonKeysEquivalent(
  keyA: string,
  keyB: string,
  options?: {
    categoryA?: ProductCategoryId;
    categoryB?: ProductCategoryId;
  },
): boolean {
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;

  if (!areMeasurementsCompatible(keyA, keyB)) return false;

  if (
    options?.categoryA &&
    options?.categoryB &&
    options.categoryA !== options.categoryB &&
    options.categoryA !== 'diversos' &&
    options.categoryB !== 'diversos'
  ) {
    return false;
  }

  const extractTokens = (key: string) =>
    Array.from(
      new Set(
        key
          .split(' ')
          .filter(
            (t) =>
              t.length >= 2 &&
              !CONNECTOR_WORDS.has(t) &&
              !MEASUREMENT_TOKEN_REGEX.test(t),
          ),
      ),
    );

  const tokensA = extractTokens(keyA);
  const tokensB = extractTokens(keyB);

  if (tokensA.length < 2 || tokensB.length < 2) return false;

  const [shorter, longer] =
    tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];

  const usedLonger = new Set<number>();
  let totalScore = 0;

  for (const ts of shorter) {
    let bestIdx = -1;
    let bestScore = 0;
    for (let j = 0; j < longer.length; j++) {
      if (usedLonger.has(j)) continue;
      const score = comparisonTokenScore(ts, longer[j]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = j;
      }
    }
    if (bestIdx === -1) {
      return false;
    }
    usedLonger.add(bestIdx);
    totalScore += bestScore;
  }

  return totalScore / shorter.length >= 0.86;
}

export function normalizeForComparison(input: string): string {
  let cleaned = stripDiacritics(input);
  cleaned = cleaned.replace(
    /\b(?:cod|codigo|ref|referencia|plu|ean|gtin|sku|lote)\s*[:.#-]?\s*\d+\b/g,
    ' ',
  );
  cleaned = cleaned.replace(/#\s*\d+\b/g, ' ');
  cleaned = normalizeComparisonMeasurements(cleaned);
  cleaned = cleaned.replace(/[-_/()[\]{}:;,#*]|(?<!\d)\.(?!\d)/g, ' ');

  const rawTokens = cleaned.split(/\s+/).filter((t) => t.length > 0);
  const mergedTokens: string[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const cur = rawTokens[i];
    const next = rawTokens[i + 1];
    if (next && SPLIT_OCR_WORD_PAIRS[`${cur}+${next}`]) {
      mergedTokens.push(SPLIT_OCR_WORD_PAIRS[`${cur}+${next}`]);
      i++;
      continue;
    }
    mergedTokens.push(cur);
  }

  const filteredTokens: string[] = [];
  for (const token of mergedTokens) {
    if (RECEIPT_NOISE_TOKENS.has(token)) continue;
    if (CONNECTOR_WORDS.has(token)) continue;
    if (/^\d{3,}$/.test(token)) continue;
    filteredTokens.push(token);
  }

  if (filteredTokens.length === 0) {
    return normalize(input);
  }

  const expanded = expandAbbreviations(filteredTokens.join(' '));
  const result = singularize(expanded).trim();
  return result.length === 0 ? normalize(input) : result;
}

export function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const v0 = Array.from({ length: s2.length + 1 }, (_, i) => i);
  const v1 = new Array<number>(s2.length + 1).fill(0);

  for (let i = 0; i < s1.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < s2.length; j++) {
      const cost = s1[i] === s2[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= s2.length; j++) {
      v0[j] = v1[j];
    }
  }
  return v0[s2.length];
}

export function stringSimilarity(s1: string, s2: string): number {
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - levenshteinDistance(s1, s2) / maxLen;
}

export function productSimilarity(
  a: string,
  b: string,
  options?: {
    categoryA?: ProductCategoryId;
    categoryB?: ProductCategoryId;
  },
): number {
  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);
  if (!normA || !normB) return 0.0;
  if (normA === normB) return 1.0;

  const tokensA = Array.from(
    new Set(
      normA.split(' ').filter((t) => t.length > 1 && !CONNECTOR_WORDS.has(t)),
    ),
  );
  const tokensB = Array.from(
    new Set(
      normB.split(' ').filter((t) => t.length > 1 && !CONNECTOR_WORDS.has(t)),
    ),
  );

  let tokenScore = 0.0;
  if (tokensA.length > 0 && tokensB.length > 0) {
    let matchedA = 0.0;
    for (const ta of tokensA) {
      let best = 0.0;
      for (const tb of tokensB) {
        if (ta === tb) {
          best = 1.0;
          break;
        }
        const sim = stringSimilarity(ta, tb);
        if (sim >= 0.8 && sim > best) {
          best = sim;
        }
      }
      matchedA += best;
    }

    const unionCount = new Set([...tokensA, ...tokensB]).size;
    const jaccard = unionCount > 0 ? matchedA / unionCount : 0.0;
    const minCount = Math.min(tokensA.length, tokensB.length);
    const containment = minCount > 0 ? matchedA / minCount : 0.0;
    tokenScore = 0.55 * jaccard + 0.45 * containment;
  }

  const wholeSim = stringSimilarity(normA, normB);
  let score = 0.6 * tokenScore + 0.4 * wholeSim;

  if (
    options?.categoryA &&
    options?.categoryB &&
    options.categoryA === options.categoryB &&
    (tokenScore > 0.0 || wholeSim >= 0.45)
  ) {
    score = Math.min(1.0, score + 0.08);
  }

  return Math.max(0.0, Math.min(1.0, score));
}

export function cloneDefaultDictionary(): Record<ProductCategoryId, string[]> {
  const result = {} as Record<ProductCategoryId, string[]>;
  for (const cat of PRODUCT_CATEGORIES) {
    result[cat.id] = [...(DEFAULT_KEYWORD_DICTIONARY[cat.id] ?? [])];
  }
  return result;
}

export function classifyProduct(
  itemName: string,
  options?: {
    customMemory?: Record<string, ProductCategoryId>;
    customDictionary?: Record<ProductCategoryId, string[]>;
  },
): ProductCategoryId {
  const normalized = normalize(itemName);
  if (!normalized) return 'diversos';

  const customMemory = options?.customMemory ?? {};
  if (normalized in customMemory) {
    return customMemory[normalized];
  }

  const dictionary = options?.customDictionary ?? DEFAULT_KEYWORD_DICTIONARY;

  for (const [catId, keywords] of Object.entries(dictionary) as [
    ProductCategoryId,
    string[],
  ][]) {
    for (const rawKeyword of keywords) {
      if (normalize(rawKeyword) === normalized) {
        return catId;
      }
    }
  }

  for (const [memKey, memCat] of Object.entries(customMemory)) {
    if (
      memKey.length >= 3 &&
      (normalized.includes(memKey) || memKey.includes(normalized))
    ) {
      return memCat;
    }
  }

  const expanded = expandAbbreviations(normalized);
  const itemWords = normalized.split(/\s+/).filter(Boolean);
  const expandedWords = expanded.split(/\s+/).filter(Boolean);

  let bestMatch: ProductCategoryId | null = null;
  let bestScore = 0;

  for (const [catId, keywords] of Object.entries(dictionary) as [
    ProductCategoryId,
    string[],
  ][]) {
    for (const rawKeyword of keywords) {
      const keyword = normalize(rawKeyword);
      if (!keyword) continue;

      let score = 0;

      if (keyword === expanded || keyword === normalized) {
        score = keyword.length * 10;
      } else if (keyword.includes(' ')) {
        if (expanded.includes(keyword) || normalized.includes(keyword)) {
          score = keyword.length * 6;
        }
      } else {
        for (const word of expandedWords) {
          if (word === keyword) {
            let wScore = keyword.length * 4;
            if (expandedWords[0] === word) {
              wScore += 14;
            }
            score = Math.max(score, wScore);
          } else if (
            word.length >= 3 &&
            keyword.length >= 4 &&
            keyword.startsWith(word)
          ) {
            score = Math.max(score, word.length * 3);
          } else if (
            keyword.length >= 4 &&
            word.length >= 4 &&
            word.startsWith(keyword)
          ) {
            score = Math.max(score, keyword.length * 3);
          } else if (word.length >= 4 && keyword.length >= 4) {
            const sim = stringSimilarity(word, keyword);
            if (sim >= 0.78) {
              score = Math.max(score, Math.round(keyword.length * sim * 2.5));
            }
          }
        }

        if (score === 0 && expanded !== normalized) {
          for (const word of itemWords) {
            if (word === keyword) {
              let wScore = keyword.length * 4;
              if (itemWords[0] === word) {
                wScore += 14;
              }
              score = Math.max(score, wScore);
            } else if (
              word.length >= 3 &&
              keyword.length >= 4 &&
              keyword.startsWith(word)
            ) {
              score = Math.max(score, word.length * 3);
            } else if (word.length >= 4 && keyword.length >= 4) {
              const sim = stringSimilarity(word, keyword);
              if (sim >= 0.78) {
                score = Math.max(score, Math.round(keyword.length * sim * 2.5));
              }
            }
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = catId;
      }
    }
  }

  if (bestScore >= 9 && bestMatch) {
    return bestMatch;
  }

  return 'diversos';
}

export interface ExtractedQuantityAndName {
  name: string;
  quantity: number;
  unit: string;
  isPriceTotalByDefault: boolean;
}

function normalizeExtractedUnit(rawUnit: string): string {
  const u = rawUnit.toLowerCase().trim();
  if (['kg', 'kilo', 'kilos', 'quilo', 'quilos'].includes(u)) return 'kg';
  if (['g', 'gr', 'grama', 'gramas'].includes(u)) return 'g';
  if (['dz', 'duzia', 'dúzia', 'duzias', 'dúzias'].includes(u)) return 'dz';
  if (['cx', 'cxa', 'caixa', 'caixas', 'pct', 'pacote', 'pacotes'].includes(u))
    return 'cx';
  if (['l', 'lt', 'litro', 'litros', 'ml'].includes(u)) return 'L';
  return 'un';
}

export function extractQuantityAndName(
  rawText: string,
): ExtractedQuantityAndName {
  const text = rawText.trim();
  if (!text) {
    return { name: '', quantity: 1, unit: 'un', isPriceTotalByDefault: false };
  }

  let match = /[(\[]\s*(\d{1,4})\s*([a-zA-ZÀ-ÿ]{1,10})\s*[)\]]\s*$/i.exec(text);
  if (match) {
    const qty = Number.parseInt(match[1] ?? '1', 10) || 1;
    const unit = normalizeExtractedUnit(match[2] ?? 'un');
    const cleanedName = text.slice(0, match.index).trim();
    if (cleanedName) {
      const isWeightOrDoz = unit === 'kg' || unit === 'g' || unit === 'dz';
      return {
        name: cleanedName,
        quantity: qty > 0 ? qty : 1,
        unit,
        isPriceTotalByDefault: isWeightOrDoz,
      };
    }
  }

  const suffixUnitRegex =
    /(?:[-–—:]\s*)?(\d{1,4})\s*(kg|kilos?|quilos?|g|gr|gramas?|dz|d[uú]zias?|cx|caixas?|pct|pacotes?|l|litros?|un|und|unid|unidades?|[xX])\s*$/i;
  match = suffixUnitRegex.exec(text);
  if (match) {
    const qty = Number.parseInt(match[1] ?? '1', 10) || 1;
    const rawU = match[2] ?? 'un';
    const unit =
      rawU.toLowerCase() === 'x' ? 'un' : normalizeExtractedUnit(rawU);
    const cleanedName = text.slice(0, match.index).trim();
    if (cleanedName) {
      const isWeightOrDoz = unit === 'kg' || unit === 'g' || unit === 'dz';
      return {
        name: cleanedName,
        quantity: qty > 0 ? qty : 1,
        unit,
        isPriceTotalByDefault: isWeightOrDoz,
      };
    }
  }

  const prefixMultiUnitRegex =
    /^(\d{1,4})\s*(kg|kilos?|quilos?|gramas?|dz|d[uú]zias?|cx|caixas?|pct|pacotes?|litros?|un|und|unid|unidades?|[xX])\s*(?:de\s+)?(?:[-–—:]\s*)?/i;
  match = prefixMultiUnitRegex.exec(text);
  if (match) {
    const qty = Number.parseInt(match[1] ?? '1', 10) || 1;
    const rawU = match[2] ?? 'un';
    const unit =
      rawU.toLowerCase() === 'x' ? 'un' : normalizeExtractedUnit(rawU);
    const cleanedName = text.slice(match[0].length).trim();
    if (cleanedName) {
      const isWeightOrDoz = unit === 'kg' || unit === 'g' || unit === 'dz';
      return {
        name: cleanedName,
        quantity: qty > 0 ? qty : 1,
        unit,
        isPriceTotalByDefault: isWeightOrDoz,
      };
    }
  }

  const prefixSingleLetterUnitRegex =
    /^(\d{1,4})\s*([lLgG])\s+(?:de\s+)?(?:[-–—:]\s*)?/i;
  match = prefixSingleLetterUnitRegex.exec(text);
  if (match) {
    const qty = Number.parseInt(match[1] ?? '1', 10) || 1;
    const unit = normalizeExtractedUnit(match[2] ?? 'un');
    const cleanedName = text.slice(match[0].length).trim();
    if (cleanedName) {
      const isWeightOrDoz = unit === 'kg' || unit === 'g' || unit === 'dz';
      return {
        name: cleanedName,
        quantity: qty > 0 ? qty : 1,
        unit,
        isPriceTotalByDefault: isWeightOrDoz,
      };
    }
  }

  const parenSuffixRegex = /[(\[]\s*(\d{1,4})\s*[)\]]\s*$/;
  match = parenSuffixRegex.exec(text);
  if (match) {
    const qty = Number.parseInt(match[1] ?? '1', 10) || 1;
    const cleanedName = text.slice(0, match.index).trim();
    if (cleanedName) {
      return {
        name: cleanedName,
        quantity: qty > 0 ? qty : 1,
        unit: 'un',
        isPriceTotalByDefault: false,
      };
    }
  }

  const simpleDigitPrefixRegex = /^(\d{1,4})\s+(?=[a-zA-ZÀ-ÿ])/;
  match = simpleDigitPrefixRegex.exec(text);
  if (match) {
    const qty = Number.parseInt(match[1] ?? '1', 10) || 1;
    const cleanedName = text.slice(match[0].length).trim();
    if (cleanedName) {
      return {
        name: cleanedName,
        quantity: qty > 0 ? qty : 1,
        unit: 'un',
        isPriceTotalByDefault: false,
      };
    }
  }

  // Trailing bare quantity: e.g. "Laranjas 4", "Laranjas - 4"
  const simpleDigitSuffixRegex = /(?:[-–—:]\s*|\s+)(\d{1,3})\s*$/;
  match = simpleDigitSuffixRegex.exec(text);
  if (match) {
    const qty = Number.parseInt(match[1] ?? '1', 10) || 1;
    const cleanedName = text.slice(0, match.index).trim();
    if (
      qty >= 1 &&
      qty <= 99 &&
      cleanedName &&
      !/\b(?:tipo|n[°ºo]?|tam(?:anho)?)\s*$/i.test(cleanedName)
    ) {
      return {
        name: cleanedName,
        quantity: qty,
        unit: 'un',
        isPriceTotalByDefault: false,
      };
    }
  }

  return { name: text, quantity: 1, unit: 'un', isPriceTotalByDefault: false };
}

export function parsePastedList(rawText: string): string[] {
  if (!rawText.trim()) return [];

  let rawSegments = rawText.split(/[\r\n;]+/);
  if (rawSegments.length === 1 && rawText.includes(',')) {
    rawSegments = rawText.split(',');
  }

  const cleanedItems: string[] = [];
  const seenNormalized = new Set<string>();
  const prefixRegex =
    /^(\s*[-*•◦▪▫▸▹▻✓✔✗✘☐☑☒]\s*|\s*\[[ xX]?\]\s*|\s*\d+[.)-]\s*)+/;

  for (const segment of rawSegments) {
    let cleaned = segment.replace(prefixRegex, '').trim();
    if (cleaned) {
      const parsed = extractQuantityAndName(cleaned);
      const baseName = parsed.name || cleaned;
      const norm = normalize(baseName);
      if (norm && !seenNormalized.has(norm)) {
        seenNormalized.add(norm);
        cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
        cleanedItems.push(cleaned);
      }
    }
  }

  return cleanedItems;
}

export const CategoryClassifier = {
  normalize,
  normalizeForComparison,
  singularize,
  expandAbbreviations,
  levenshteinDistance,
  stringSimilarity,
  productSimilarity,
  areMeasurementsCompatible,
  areComparisonKeysEquivalent,
  cloneDefaultDictionary,
  classify: classifyProduct,
  extractQuantityAndName,
  parsePastedList,
  defaultKeywordDictionary: DEFAULT_KEYWORD_DICTIONARY,
};
