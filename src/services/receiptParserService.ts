import type { ScannedReceiptItem } from '../types/shopping';
import { AppFormatters } from '../utils/formatters';
import {
  CategoryClassifier,
  DEFAULT_KEYWORD_DICTIONARY,
} from './categoryClassifier';

const IGNORED_RECEIPT_KEYWORDS = [
  'cnpj', 'cpf', 'inscricao estadual', 'documento auxiliar',
  'nota fiscal', 'cupom fiscal', 'consumidor', 'danfe',
  'qtd. total', 'qtd total', 'valor total', 'ualor total',
  'valor total a pagar', 'ualor total a pagar', 'total a pagar',
  'valor a pagar', 'ualor a pagar', 'total geral', 'valor geral',
  'ualor geral', 'total pago', 'valor pago', 'ualor pago',
  'total liquido', 'valor liquido', 'ualor liquido', 'total bruto',
  'valor bruto', 'ualor bruto', 'total produtos', 'valor produtos',
  'ualor produtos', 'total dos produtos', 'valor dos produtos',
  'ualor dos produtos', 'valor da nota', 'ualor da nota',
  'valor do cupom', 'ualor do cupom', 'total cupom', 'total nota',
  'vlr total', 'ulr total', 'vl total', 'ul total',
  'vlr total a pagar', 'ulr total a pagar', 'vl total a pagar',
  'ul total a pagar', 'subtotal', 'sub-total', 'sub total', 't0tal',
  'desconto', 'descontos', 'valor desconto', 'ualor desconto',
  'acrescimo', 'acrescimos', 'valor acrescimo', 'forma de pagamento',
  'forma pagamento', 'meio de pagamento', 'cartao de credito',
  'cartao de debito', 'cartao credito', 'cartao debito', 'credito',
  'debito', 'dinheiro', 'troco', 'valor troco', 'ualor troco',
  'valor recebido', 'ualor recebido', 'total recebido', 'tributos',
  'aproximados', 'lei federal', 'ibpt', 'procon', 'decon',
  'chave de acesso', 'consulte pela', 'protocolo', 'autorizacao',
  'serie', 'emissao', 'operador', 'caixa', 'extrato', 'sat ',
  'qrcode', 'http', 'www.', 'sefaz', 'fazenda',
];

export const PHRASE_ABBREV_MAP: Record<string, string> = {
  'CHOC BARRA': 'Chocolate em Barra',
  'CHOCOLATE BARRA': 'Chocolate em Barra',
  'CR LEITE': 'Creme de Leite',
  'CREM LEIT': 'Creme de Leite',
  'CR DE LEITE': 'Creme de Leite',
  'L MOV': 'Lava Móveis',
  'L MOVEIS': 'Lava Móveis',
  'L ROUP': 'Lava Roupas',
  'L ROUPAS': 'Lava Roupas',
  'L LOUC': 'Lava Louças',
  'L LOUCA': 'Lava Louças',
  'L LOUCAS': 'Lava Louças',
  'AG SANIT': 'Água Sanitária',
  'AGUA SANIT': 'Água Sanitária',
  'AG SANITARIA': 'Água Sanitária',
  'AG MIN': 'Água Mineral',
  'AG MINER': 'Água Mineral',
  'AGUA MIN': 'Água Mineral',
  'SAB EM PO': 'Sabão em Pó',
  'SAB PO': 'Sabão em Pó',
  'SAB BARRA': 'Sabão em Barra',
  'PAPEL HIG': 'Papel Higiênico',
  'PAP HIG': 'Papel Higiênico',
  'CREM DENT': 'Creme Dental',
  'CR DENT': 'Creme Dental',
  'PAO FRANC': 'Pão Francês',
  'PAO FORM': 'Pão de Forma',
  'P DE FORMA': 'Pão de Forma',
  'P FRANCES': 'Pão Francês',
  'C/ CAROCO': 'Com Caroço',
  'S/ CAROCO': 'Sem Caroço',
  'C/ LACTOSE': 'Com Lactose',
  'S/ LACTOSE': 'Sem Lactose',
  'BAT PALHA': 'Batata Palha',
  'BAT FRITA': 'Batata Frita',
  'BAT DOCE': 'Batata Doce',
  'CH VERD': 'Cheiro Verde',
  'CH VERDE': 'Cheiro Verde',
  'CHEIRO VERD': 'Cheiro Verde',
  'MOLHO TOM': 'Molho de Tomate',
  'MOLH TOM': 'Molho de Tomate',
  'MOL TOM': 'Molho de Tomate',
  'EXTR TOM': 'Extrato de Tomate',
  'EXT TOM': 'Extrato de Tomate',
  'POLP TOM': 'Polpa de Tomate',
  'POL TOM': 'Polpa de Tomate',
  'LEIT COND': 'Leite Condensado',
  'LEITE COND': 'Leite Condensado',
  'L COND': 'Leite Condensado',
  'LEIT CONDENS': 'Leite Condensado',
  'LEITE CONDENS': 'Leite Condensado',
  'LEIT UHT': 'Leite UHT',
  'LEITE UHT': 'Leite UHT',
  'LEIT INT': 'Leite Integral',
  'LEITE INT': 'Leite Integral',
  'LEIT DESN': 'Leite Desnatado',
  'LEITE DESN': 'Leite Desnatado',
  'LEIT SEMI': 'Leite Semidesnatado',
  'LEITE SEMI': 'Leite Semidesnatado',
  'PEIT PERU': 'Peito de Peru',
  'PEITO PERU': 'Peito de Peru',
  'PEIT FRANG': 'Peito de Frango',
  'PEITO FRANG': 'Peito de Frango',
  'FILE PEIT': 'Filé de Peito',
  'FILE DE PEITO': 'Filé de Peito',
  'FILE MIGNON': 'Filé Mignon',
  'F MIGNON': 'Filé Mignon',
  'CONTRA FILE': 'Contrafilé',
  'C FILE': 'Contrafilé',
  'COX SOBRECOX': 'Coxa e Sobrecoxa',
  'C SOBRECOX': 'Coxa e Sobrecoxa',
  'CARN MOID': 'Carne Moída',
  'CARNE MOID': 'Carne Moída',
  'LING CALAB': 'Linguiça Calabresa',
  'LINGUICA CALAB': 'Linguiça Calabresa',
  'LING TOSC': 'Linguiça Toscana',
  'LINGUICA TOSC': 'Linguiça Toscana',
  'DOCE LEIT': 'Doce de Leite',
  'DOCE DE LEIT': 'Doce de Leite',
  'AZEIT EXTR VIRG': 'Azeite Extra Virgem',
  'AZEITE EV': 'Azeite Extra Virgem',
  'AZ EXT VIRG': 'Azeite Extra Virgem',
  'P CAFE': 'Pó de Café',
  'PO CAFE': 'Pó de Café',
  'PO DE CAFE': 'Pó de Café',
  'C/ GAS': 'Com Gás',
  'COM GAS': 'Com Gás',
  'S/ GAS': 'Sem Gás',
  'SEM GAS': 'Sem Gás',
  'C/ LACT': 'Com Lactose',
  'COM LACT': 'Com Lactose',
  'S/ LACT': 'Sem Lactose',
  'SEM LACT': 'Sem Lactose',
  'ZERO LACT': 'Zero Lactose',
  'C/ CAROC': 'Com Caroço',
  'COM CAROC': 'Com Caroço',
  'S/ CAROC': 'Sem Caroço',
  'SEM CAROC': 'Sem Caroço',
  'FOLHA DUPLA': 'Folha Dupla',
  'FD DUPLA': 'Folha Dupla',
  'FOLHA TRIPLA': 'Folha Tripla',
  'FD TRIPLA': 'Folha Tripla',
  'SACO P/ LIXO': 'Saco para Lixo',
  'SC LIXO': 'Saco para Lixo',
  'SACO LIX': 'Saco para Lixo',
  'SAB LIQ': 'Sabonete Líquido',
  'SAB LIQUIDO': 'Sabonete Líquido',
  'DESOD AER': 'Desodorante Aerossol',
  'DESOD AEROS': 'Desodorante Aerossol',
  'LIMP MULT': 'Limpador Multiuso',
  'LIMP MULTIUSO': 'Limpador Multiuso',
  'AMAC CONC': 'Amaciante Concentrado',
  'MAC INST': 'Macarrão Instantâneo',
  'MACARR INST': 'Macarrão Instantâneo',
  'PAO HAMB': 'Pão de Hambúrguer',
  'PAO BURGUER': 'Pão de Hambúrguer',
  'PAO HOT DOG': 'Pão de Hot Dog',
  'PAO HD': 'Pão de Hot Dog',
  'PAO QUEIJ': 'Pão de Queijo',
  'P DE QUEIJO': 'Pão de Queijo',
  'AG COCO': 'Água de Coco',
  'AGUA COCO': 'Água de Coco',
  'BEB LACT': 'Bebida Láctea',
  'IORG GREGO': 'Iogurte Grego',
  'IOG GREGO': 'Iogurte Grego',
  'QUEIJ MIN': 'Queijo Minas',
  'QUEIJO MINAS': 'Queijo Minas',
  'QUEIJ PRAT': 'Queijo Prato',
  'QUEIJO PRATO': 'Queijo Prato',
  'QUEIJ MUSSA': 'Queijo Mussarela',
  'QUEIJO MUSSARELA': 'Queijo Mussarela',
  'QUEIJ PARM': 'Queijo Parmesão',
  'QUEIJO PARMESAO': 'Queijo Parmesão',
  'QUEIJ COALH': 'Queijo Coalho',
  'QUEIJO COALHO': 'Queijo Coalho',
  'REQUEIJ CREM': 'Requeijão Cremoso',
  'MANTEIG C/SAL': 'Manteiga com Sal',
  'MANTEIG S/SAL': 'Manteiga sem Sal',
  'LAV PERF': 'Lavagem Perfeita',
  'LAVAGEM PERF': 'Lavagem Perfeita',
};

export const ABBREV_MAP: Record<string, string> = {
  LT: 'Leite', LEIT: 'Leite', LTE: 'Leite', INT: 'Integral', INTEG: 'Integral',
  DESN: 'Desnatado', DESL: 'Desnatado', DESNAT: 'Desnatado', SEMI: 'Semidesnatado',
  SEMIDESN: 'Semidesnatado', PAST: 'Pasteurizado', PASTEU: 'Pasteurizado',
  CONDENS: 'Condensado', COND: 'Condicionador', CONDIC: 'Condicionador',
  MARG: 'Margarina', MARGAR: 'Margarina', MANTEIG: 'Manteiga', MANT: 'Manteiga',
  IORG: 'Iogurte', IOG: 'Iogurte', IOGUR: 'Iogurte', QUEIJ: 'Queijo',
  QUEJ: 'Queijo', QJ: 'Queijo', QJO: 'Queijo', PRES: 'Presunto',
  PRESUN: 'Presunto', MUSSA: 'Mussarela', MUSS: 'Mussarela', MUSSAR: 'Mussarela',
  MOZZ: 'Mussarela', MOZ: 'Mussarela', PARM: 'Parmesão', PARMES: 'Parmesão',
  PRAT: 'Prato', PROV: 'Provolone', RICOT: 'Ricota', CHED: 'Cheddar',
  CHEDD: 'Cheddar', REQ: 'Requeijão', REQUEIJ: 'Requeijão', BEB: 'Bebida',
  LACT: 'Láctea', LAC: 'Zero Lactose', 'C/LAC': 'Com Lactose',
  'S/LAC': 'Sem Lactose', SLAC: 'Sem Lactose', FAT: 'Fatiado', FATIAD: 'Fatiado',
  RAL: 'Ralado', RALAD: 'Ralado', PED: 'Pedaço',
  BOV: 'Bovino', BOVINA: 'Bovina', SUIN: 'Suíno', SUINA: 'Suína',
  CARN: 'Carne', FRANG: 'Frango', PEIT: 'Peito', ALCAT: 'Alcatra',
  ALCATR: 'Alcatra', PATIN: 'Patinho', PAT: 'Patinho', COST: 'Costela',
  COSTEL: 'Costela', LING: 'Linguiça', LINGU: 'Linguiça', SALS: 'Salsicha',
  SALSI: 'Salsicha', MOID: 'Moída', MOIDA: 'Moída', PIC: 'Picado',
  PICAD: 'Picado', ACEM: 'Acém', MUSC: 'Músculo', MUSCUL: 'Músculo',
  COX: 'Coxão', MOLE: 'Mole', DUR: 'Duro', FRALD: 'Fraldinha',
  FRALDINH: 'Fraldinha', MAMINH: 'Maminha', PICANH: 'Picanha',
  CONTRA: 'Contrafilé', 'C/FILE': 'Contrafilé', FILE: 'Filé', LOMB: 'Lombo',
  LOMBO: 'Lombo', BIST: 'Bisteca', BISTEC: 'Bisteca', CUPIM: 'Cupim',
  SOBRECOX: 'Sobrecoxa', 'S/COXA': 'Sobrecoxa', CORAC: 'Coração',
  CORACAO: 'Coração', MOEG: 'Moela', SARD: 'Sardinha', SARDIN: 'Sardinha',
  ATU: 'Atum', BACALH: 'Bacalhau', TILAP: 'Tilápia', SALM: 'Salmão',
  CAMAR: 'Camarão', DEF: 'Defumado', DEFUM: 'Defumado', DEFUMAD: 'Defumado',
  CONG: 'Congelado', CONGEL: 'Congelado', EMP: 'Empanado', EMPAN: 'Empanado',
  NUGG: 'Nuggets', HAMB: 'Hambúrguer', HAMBURG: 'Hambúrguer',
  BURGUER: 'Hambúrguer', ALMOND: 'Almôndegas', LASANH: 'Lasanha', PIZZ: 'Pizza',
  ARR: 'Arroz', FEIJ: 'Feijão', FAR: 'Farinha', FARIN: 'Farinha',
  TRG: 'Trigo', TRIG: 'Trigo', ACUC: 'Açúcar', ACU: 'Açúcar',
  CRIST: 'Cristal', REFIN: 'Refinado', MAC: 'Macarrão', MACARR: 'Macarrão',
  MACARRAO: 'Macarrão', ESPAG: 'Espaguete', PARAF: 'Parafuso', PENNE: 'Penne',
  MOLH: 'Molho', EXTR: 'Extrato', POLP: 'Polpa', TEMPR: 'Tempero',
  TEMP: 'Tempero', COMPL: 'Completo', OREG: 'Orégano', OREGAN: 'Orégano',
  AZEIT: 'Azeite', VINAG: 'Vinagre', VIN: 'Vinagre', MAION: 'Maionese',
  MAIONESE: 'Maionese', KETCH: 'Ketchup', KET: 'Ketchup', MOST: 'Mostarda',
  MILH: 'Milho', ERVILH: 'Ervilha', ERV: 'Ervilha', PALM: 'Palmito',
  COGUM: 'Cogumelo', CHAMP: 'Champignon', AZEITON: 'Azeitona',
  'S/CAROÇO': 'Sem Caroço', 'S/CAROCO': 'Sem Caroço',
  'C/CAROÇO': 'Com Caroço', 'C/CAROCO': 'Com Caroço',
  SC: 'Saco', SACO: 'Saco', SCL: 'Sacola', SACOL: 'Sacola',
  OL: 'Óleo', OLEO: 'Óleo', ÓLEO: 'Óleo', SOJ: 'Soja',
  GIRASS: 'Girassol', MIL: 'Milho', CANOL: 'Canola',
  VEG: 'Vegetal', VEGET: 'Vegetal', HORT: 'Hortifruti', LEG: 'Legumes',
  VERD: 'Verduras', FRUT: 'Frutas', TOMAT: 'Tomate', TOM: 'Tomate',
  CEB: 'Cebola', BAT: 'Batata', BATAT: 'Batata', CEN: 'Cenoura',
  CENOUR: 'Cenoura', ALF: 'Alface', BAN: 'Banana', LAR: 'Laranja',
  LARANJ: 'Laranja', MACA: 'Maçã', LIM: 'Limão', LIMAO: 'Limão',
  MAM: 'Mamão', MAMAO: 'Mamão', MELANC: 'Melancia', ABAC: 'Abacaxi',
  ABOB: 'Abóbora', ABOBR: 'Abobrinha', CHUCH: 'Chuchu', PIM: 'Pimentão',
  PIMENT: 'Pimenta', ALH: 'Alho', PORO: 'Poró', CHEIV: 'Cheiro Verde',
  'CH/VERD': 'Cheiro Verde', 'CH/VERDE': 'Cheiro Verde',
  BISC: 'Biscoito', BOL: 'Bolacha', RECH: 'Recheado', RECHEAD: 'Recheado',
  SALG: 'Salgado', SALGAD: 'Salgado', DOC: 'Doce', CRACK: 'Cracker',
  WAFF: 'Wafer', TORR: 'Torrada', TORRAD: 'Torrada',
  'PAO FRANC': 'Pão Francês', 'PAO FORM': 'Pão de Forma', BISNAG: 'Bisnaguinha',
  CHOC: 'Chocolate', ACHOC: 'Achocolatado', ACHOCOL: 'Achocolatado',
  CAC: 'Cacau', AVEI: 'Aveia', CEREAL: 'Cereal', BAR: 'Barra',
  SBRM: 'Sobremesa', GELAT: 'Gelatina', GELE: 'Geleia', GELEIA: 'Geleia',
  ADOC: 'Adoçante', ADOCANT: 'Adoçante', MEL: 'Mel', PUD: 'Pudim', PUDIM: 'Pudim',
  REFRIG: 'Refrigerante', REF: 'Refrigerante', REFRI: 'Refrigerante',
  CAFE: 'Café', CAFÉ: 'Café', PILAO: 'Pilão', PILÃO: 'Pilão',
  FEIJAO: 'Feijão', FEIJÃO: 'Feijão', ACUCAR: 'Açúcar', AÇUCAR: 'Açúcar',
  PAO: 'Pão', PÃO: 'Pão', SABAO: 'Sabão', SABÃO: 'Sabão',
  AGUA: 'Água', ÁGUA: 'Água', MELAO: 'Melão', MELÃO: 'Melão',
  YPE: 'Ypê', YPÊ: 'Ypê',
  CERV: 'Cerveja', CERVEJ: 'Cerveja', CHOP: 'Chopp', SUC: 'Suco',
  AG: 'Água', AGU: 'Água', MIN: 'Mineral', MINER: 'Mineral',
  'S/GAS': 'Sem Gás', SGAS: 'Sem Gás', 'C/GAS': 'Com Gás', CGAS: 'Com Gás',
  TON: 'Tônica', TONIC: 'Tônica', ESPUM: 'Espumante', ENERG: 'Energético',
  ISOT: 'Isotônico', CHA: 'Chá',
  SAB: 'Sabonete', SABON: 'Sabonete', SH: 'Shampoo', SHAMP: 'Shampoo',
  SHAMPO: 'Shampoo', SHP: 'Shampoo', CND: 'Condicionador',
  DESOD: 'Desodorante', DES: 'Desodorante', AER: 'Aerossol', AEROS: 'Aerossol',
  ROLL: 'Roll-on', 'CREM DENT': 'Creme Dental', 'CR DENT': 'Creme Dental',
  DENT: 'Dental', CREM: 'Creme', CR: 'Creme', ESCOV: 'Escova', ESCOUA: 'Escova',
  HIDRAT: 'Hidratante', HIDR: 'Hidratante', HID: 'Hidratante', FRAL: 'Fralda',
  ABS: 'Absorvente', ABSORV: 'Absorvente', PROT: 'Protetor', SOL: 'Solar',
  ANTISS: 'Antisséptico', ANTISSEP: 'Antisséptico', ENXAG: 'Enxaguante',
  BUCAL: 'Bucal', HAST: 'Hastes Flexíveis', COTON: 'Cotonetes',
  ALGOD: 'Algodão', LENCO: 'Lenço Umedecido', UMED: 'Umedecido',
  DESC: 'Descartável', DET: 'Detergente', DETERG: 'Detergente',
  AMAC: 'Amaciante', AMACIANT: 'Amaciante', CONC: 'Concentrado',
  LIMP: 'Limpador', DESINF: 'Desinfetante', DESINFET: 'Desinfetante',
  MULT: 'Multiuso', MULTIUS: 'Multiuso', ESPONJA: 'Esponja', ESP: 'Esponja',
  PANO: 'Pano', FLAN: 'Flanela', UASSOURA: 'Vassoura', ROD: 'Rodo',
  LAV: 'Lava', ROUP: 'Roupas', ROUPA: 'Roupas', LOUC: 'Louças', LOUCA: 'Louças',
  MOV: 'Móveis', MOVEIS: 'Móveis', DESENG: 'Desengordurante',
  DESENGORD: 'Desengordurante', ALVEJ: 'Alvejante', SANIT: 'Sanitário',
  SANITARIA: 'Sanitária', SANITARIO: 'Sanitário', CLOR: 'Cloro',
  'AG SANIT': 'Água Sanitária', 'AGUA SANIT': 'Água Sanitária',
  'SAB EM PO': 'Sabão em Pó', 'SAB PO': 'Sabão em Pó',
  'SAB BARRA': 'Sabão em Barra', 'PAPEL HIG': 'Papel Higiênico',
  GUARD: 'Guardanapo', TOALH: 'Toalha', LIX: 'Lixo', LIXO: 'Lixo',
  INSET: 'Inseticida', REPEL: 'Repelente', ODOR: 'Odorizador',
  AROMAT: 'Aromatizador', PCT: 'Pacote', PACOT: 'Pacote', CX: 'Caixa',
  CXA: 'Caixa', FD: 'Fardo', FARDO: 'Fardo', GAR: 'Garrafa', GARRAF: 'Garrafa',
  LAT: 'Lata', LATA: 'Lata', EMB: 'Embalagem', EMBAL: 'Embalagem',
  BDJ: 'Bandeja', BANDEJ: 'Bandeja', PET: 'Pet', REFIL: 'Refil',
  ECON: 'Econômica', ECONOM: 'Econômico', LEVE: 'Leve', PAG: 'Pague',
  PAGUE: 'Pague', PROM: 'Promoção', PROMO: 'Promoção', TRAD: 'Tradicional',
  TRADIC: 'Tradicional', ORIG: 'Original', NAT: 'Natural', NATUR: 'Natural',
  SABOR: 'Sabor', LIQ: 'Líquido', LIQUID: 'Líquido', PO: 'Pó',
  UN: 'Unidade', UND: 'Unidade', 'C/': 'Com', 'S/': 'Sem', 'P/': 'Para',
  UHT: 'UHT', EV: 'Extra Virgem', VIRG: 'Virgem',
  TOSC: 'Toscana', CALAB: 'Calabresa', CALABR: 'Calabresa', APRES: 'Apresuntado', APRESUNT: 'Apresuntado',
  LAVAND: 'Lavanda', PINH: 'Pinho', EUCAL: 'Eucalipto', CITR: 'Cítrico',
  MARAC: 'Maracujá', MORANG: 'Morango', PESSEG: 'Pêssego', GOIAB: 'Goiaba',
  COCO: 'Coco', BAUN: 'Baunilha', BAUNILH: 'Baunilha', CANEL: 'Canela', CRAV: 'Cravo',
  AMEND: 'Amendoim', GEL: 'Gel', SOLUV: 'Solúvel', CAPS: 'Cápsulas', SACH: 'Sachê', SACHE: 'Sachê', FLOC: 'Flocos',
  TP: 'Tipo', T1: 'Tipo 1', T2: 'Tipo 2', INTENS: 'Intenso',
  PERF: 'Perfeita', FRESC: 'Fresco',
  UALOR: 'Valor', VALOR: 'Valor',
};

const RECEIPT_WORD_FIXES: Record<string, string> = {
  ESCOUA: 'Escova', ESCOU: 'Escova', ESCOUAS: 'Escovas',
  ESCOUINHA: 'Escovinha', ESCOUINHAS: 'Escovinhas', DESCOUA: 'Descova',
  UASSOURA: 'Vassoura', UASSOUR: 'Vassoura', UAPOR: 'Vapor', CAME: 'Carne',
  UALOR: 'Valor', UALORES: 'Valores', ULR: 'Vlr', T0TAL: 'Total', TOTA1: 'Total',
  CERUEJA: 'Cerveja', CERUEJ: 'Cerveja', AUEIA: 'Aveia', OLIUA: 'Oliva',
  OIUA: 'Oliva', COUUE: 'Couve', SORUETE: 'Sorvete', SUAUE: 'Suave',
  UINHO: 'Vinho', UINAGRE: 'Vinagre', UINAG: 'Vinagre', UAGEM: 'Vagem',
  UERDE: 'Verde', UERMELHO: 'Vermelho', UERM: 'Vermelho', ERUA: 'Erva',
  SERUIR: 'Servir', UIGOR: 'Vigor', UITA: 'Vita', UALE: 'Vale',
  UANISH: 'Vanish', UASILHA: 'Vasilha', NOUO: 'Novo', NOUA: 'Nova',
  OUO: 'Ovo', OUOS: 'Ovos', LAUA: 'Lava', LAUAR: 'Lavar', PROUA: 'Prova',
  ATIUO: 'Ativo', ATIUA: 'Ativa', LEUE: 'Leve', LEUISSIMO: 'Levissimo',
  AUELA: 'Avela', AUELAS: 'Avelas', SALUIA: 'Salvia',
  SVCO: 'Suco', FRVTA: 'Fruta', FRVTAS: 'Frutas', IOGVRTE: 'Iogurte',
  AGVA: 'Água', ACVCAR: 'Açúcar', QVEIJO: 'Queijo', ATVN: 'Atum',
  MVLTI: 'Multi', PVRO: 'Puro', PERV: 'Peru', GVARA: 'Guara',
  GVARANA: 'Guarana', NATVRAL: 'Natural', NATVR: 'Natur',
  CHVRRASCO: 'Churrasco', CACAV: 'Cacau', BVRGUER: 'Burguer',
  MVFFIN: 'Muffin', TRVFA: 'Trufa', SAGV: 'Sagu', GLVTEN: 'Gluten',
  LVA: 'Lua', PLVS: 'Plus', SVRF: 'Surf', AZVL: 'Azul', LVZ: 'Luz',
  CRVNCH: 'Crunch', LEGVM: 'Legum', MVSSE: 'Musse',
};

const KNOWN_SINGLE_WORDS: Set<string> = (() => {
  const set = new Set<string>([
    'esponja', 'escova', 'escovinha', 'escovas', 'sabonete', 'shampoo',
    'condicionador', 'detergente', 'amaciante', 'limpador', 'desinfetante',
    'multiuso', 'desodorante', 'hidratante', 'chocolate', 'refrigerante',
    'margarina', 'manteiga', 'presunto', 'queijo', 'iogurte', 'macarrao',
    'biscoito', 'bolacha', 'farinha', 'acucar', 'cebola', 'batata', 'tomate',
    'laranja', 'banana', 'azeite', 'azeitona', 'maionese', 'vinagre', 'tempero',
    'torrada', 'salgado', 'fralda', 'guardanapo', 'sanitario', 'higienico',
    'vassoura', 'cerveja', 'aveia', 'oliva', 'couve', 'sorvete', 'suave',
    'vinho', 'vagem', 'verde', 'vermelho', 'lavanderia', 'mistura', 'salsicha',
    'linguica', 'hamburguer', 'churrasco', 'requeijao', 'espaguete', 'lasanha',
    'extrato', 'palmito', 'ervilha', 'abobora', 'abobrinha', 'cenoura',
    'beterraba', 'brocolis', 'espinafre', 'melancia', 'abacaxi', 'morango',
    'maracuja', 'pessego', 'castanha', 'amendoim', 'amido', 'polvilho',
    'fermento', 'gelatina', 'achocolatado', 'adocante', 'patinho', 'alcatra',
    'picanha', 'costela', 'sobrecoxa', 'sardinha', 'camarao', 'bisnaguinha',
    'alface', 'mandioca', 'pimenta', 'cominho', 'colorau', 'paprica', 'creme',
    'leite', 'arroz', 'feijao', 'carne', 'frango', 'peixe', 'peito', 'coxa',
    'bacon', 'salame', 'mortadela', 'fuba', 'milho', 'trigo', 'alho', 'maca',
    'pera', 'limao', 'mamao', 'melao', 'uva', 'goiaba', 'roupas', 'vanish',
    'comfort', 'downy', 'ariel', 'brilhante', 'omo', 'ype', 'limpol', 'veja',
    'pinho', 'sadia', 'seara', 'perdigao', 'heineken', 'brahma', 'skol',
    'amstel', 'budweiser', 'stella', 'corona', 'piracanjuba', 'itambe', 'vigor',
    'tirolez', 'danone', 'nestle', 'coca', 'cola', 'pepsi', 'fanta', 'sprite',
    'schweppes', 'guarana', 'tang', 'maguary', 'delvalle', 'rexona', 'dove',
    'nivea', 'colgate', 'sorriso', 'oralb', 'sensodyne', 'gillette', 'pantene',
    'palmolive', 'listerine', 'pampers', 'huggies', 'trakinas', 'passatempo',
    'oreo', 'bono', 'wafer', 'cracker', 'maizena', 'toddy', 'nescau', 'nutella',
    'yakult', 'toddynho', 'chamyto', 'chambinho', 'almondega', 'empanado',
    'nuggets', 'mostarda', 'ketchup', 'molho', 'flan', 'pudim', 'doce',
    'geleia', 'goiabada', 'bala', 'chiclete', 'bombom', 'barra', 'tablete',
    'algodao', 'curativo', 'alcool', 'inseticida', 'repelente', 'palito',
    'filtro', 'coador', 'espeto', 'carvao', 'acendedor', 'pilha', 'bateria',
    'lampada', 'vela', 'fosforo', 'isqueiro', 'balde', 'bacia', 'rodo', 'luva',
    'prendedor', 'varal', 'flanela', 'perfex', 'cera', 'cloro', 'alvejante',
    'sanitaria', 'integral', 'desnatado', 'semidesnatado', 'refinado',
    'cristal', 'caseiro', 'fresco', 'congelado', 'defumado', 'temperado',
    'recheado', 'crocante', 'granulado', 'moido', 'fatiado', 'picado', 'ralado',
  ]);
  for (const list of Object.values(DEFAULT_KEYWORD_DICTIONARY)) {
    for (const kw of list) {
      const trimmed = kw.trim();
      if (!trimmed.includes(' ') && !trimmed.includes('-')) {
        const clean = CategoryClassifier.normalize(trimmed);
        if (clean.length >= 4) {
          set.add(clean);
        }
      }
    }
  }
  return set;
})();

function normalizeWordForLookup(word: string): string {
  return CategoryClassifier.normalize(word);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function repairOcrPricesInLine(line: string): string {
  let s = line.replace(/(?<=[,.])([Oo0-9]{2,3})\b/g, (m) =>
    m.replace(/[Oo]/g, '0'),
  );
  s = s.replace(/\b([0-9]*[Oo]+[0-9]*)(?=[,.])/g, (m) =>
    m.replace(/[Oo]/g, '0'),
  );
  return s;
}

function isReceiptTotalOrSummaryLine(line: string): boolean {
  let clean = line
    .toLowerCase()
    .trim()
    .replace(/^\s*(?:item|it|cod|cód)?\s*#?\s*\d{1,6}[\s.-]+/i, '')
    .trim()
    .replace(/\s+/g, ' ');

  const normalized = clean
    .replace(/\bualor\b/g, 'valor')
    .replace(/\bulr\b/g, 'vlr')
    .replace(/\bul\b/g, 'vl')
    .replace(/\bt0tal\b|\btota1\b/g, 'total')
    .replace(/\bt\s*o\s*t\s*a\s*l\b/g, 'total');

  const summaryStartPattern =
    /^(?:total|vlr?\.?\s*total(?:\s*a\s*pagar)?|vl\s*total(?:\s*a\s*pagar)?|valor\s*total(?:\s*a\s*pagar)?|subtotal|sub-total|sub\s+total|total\s*a\s*pagar|valor\s*a\s*pagar|total\s*pago|valor\s*pago|total\s*l[ií]quido|valor\s*l[ií]quido|total\s*bruto|valor\s*bruto|total\s*(?:dos\s*)?produtos|valor\s*(?:dos\s*)?produtos|valor\s*recebido|total\s*recebido|valor\s*troco|troco|desconto|descontos|acrescimo|acrescimos|forma\s*de\s*pagamento|total\s*geral|valor\s*geral)\b/i;

  if (summaryStartPattern.test(normalized)) return true;

  if (
    /\b(?:valor|vlr?\.?|vl)\s*(?:total(?:\s*a\s*pagar)?|geral|pago|a\s*pagar|l[ií]quido|bruto|recebido|troco|da\s*nota|do\s*cupom|(?:dos\s*)?produtos)\b/i.test(
      normalized,
    )
  ) {
    return true;
  }

  if (
    /\b(?:total)\s*(?:geral|pago|a\s*pagar|l[ií]quido|bruto|recebido|(?:dos\s*)?produtos|da\s*nota|do\s*cupom)\b/i.test(
      normalized,
    )
  ) {
    return true;
  }

  if (
    normalized.includes('total') ||
    normalized.includes('subtotal') ||
    normalized.includes('pagar') ||
    normalized.includes('pago') ||
    normalized.includes('troco')
  ) {
    const nonPriceText = normalized
      .replace(/\d{1,3}(?:\.\d{3})*[,.]\d{2}/g, '')
      .replace(/\b\d+\b/g, '')
      .replace(/r\$\s*/g, '')
      .replace(/[:=\-*#.,><_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (
      !nonPriceText ||
      /^(?:total|vlr?|vl|valor|liq|liquido|líquido|bruto|a|pagar|pago|geral|subtotal|sub|dos|produtos|itens|item|de|da|do|nota|cupom|fiscal|r\$|\s)+$/.test(
        nonPriceText,
      )
    ) {
      return true;
    }
  }

  return false;
}

function shouldIgnoreReceiptLine(line: string): boolean {
  const lower = line.toLowerCase();
  for (const keyword of IGNORED_RECEIPT_KEYWORDS) {
    if (lower.includes(keyword)) return true;
  }
  if (isReceiptTotalOrSummaryLine(lower)) return true;
  const digitsOnly = line.replace(/\D/g, '');
  if (digitsOnly.length >= 35 && !/[a-zA-ZÀ-ÿ]{3,}/.test(line)) return true;
  if (/^\d{2}\/\d{2}\/\d{2,4}/.test(line)) return true;
  return false;
}

export function isTotalProductName(name: string): boolean {
  let lower = name
    .toLowerCase()
    .trim()
    .replace(/\bualor\b/g, 'valor')
    .replace(/\bulr\b/g, 'vlr')
    .replace(/\bul\b/g, 'vl')
    .replace(/\bt0tal\b|\btota1\b/g, 'total')
    .replace(/\bt\s*o\s*t\s*a\s*l\b/g, 'total')
    .replace(/[:=\-*#.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const totalExactNames = new Set([
    'total', 'subtotal', 'sub total', 'sub-total', 'valor', 'vlr', 'vl',
    'valor total', 'vlr total', 'vl total', 'valor total a pagar',
    'vlr total a pagar', 'vl total a pagar', 'total geral', 'valor geral',
    'total a pagar', 'valor a pagar', 'total pago', 'valor pago',
    'total liquido', 'valor liquido', 'total bruto', 'valor bruto',
    'total produtos', 'valor produtos', 'total dos produtos',
    'valor dos produtos', 'valor da nota', 'total da nota', 'valor do cupom',
    'total do cupom', 'troco', 'valor troco', 'desconto', 'descontos',
    'valor desconto', 'acrescimo', 'acrescimos', 'valor acrescimo',
    'pagamento', 'forma de pagamento', 'valor recebido', 'total recebido',
  ]);

  if (totalExactNames.has(lower)) return true;

  if (
    lower.includes('tributo') ||
    lower.includes('tributos') ||
    lower.includes('imposto') ||
    lower.includes('troco') ||
    lower.includes('forma de pagamento') ||
    lower.includes('cartao') ||
    lower.includes('cartão') ||
    lower.includes('dinheiro') ||
    lower.includes('pix') ||
    lower.includes('valor pago') ||
    lower.includes('total pago') ||
    lower.includes('total a pagar') ||
    lower.includes('valor a pagar')
  ) {
    return true;
  }

  if (
    lower.startsWith('total ') ||
    lower.startsWith('valor total') ||
    lower.startsWith('vlr total') ||
    lower.startsWith('vl total') ||
    lower.startsWith('subtotal') ||
    lower.startsWith('total a pagar') ||
    lower.startsWith('valor a pagar') ||
    lower.startsWith('valor total a pagar') ||
    lower.startsWith('vlr total a pagar') ||
    lower.startsWith('vl total a pagar') ||
    lower.startsWith('total pago') ||
    lower.startsWith('valor pago') ||
    lower.startsWith('total:')
  ) {
    return true;
  }

  if (
    /\b(?:valor\s*)?total\s*a\s*pagar\b/.test(lower) ||
    /\bvalor\s*a\s*pagar\b/.test(lower) ||
    /\b(?:valor\s*)?total\s*pago\b/.test(lower)
  ) {
    return true;
  }

  const summaryWords =
    /^(?:total|vlr?|vl|valor|liq|liquido|líquido|bruto|a|pagar|pago|geral|subtotal|sub|dos|produtos|itens|item|de|da|do|nota|cupom|fiscal|\s)+$/;
  if (
    summaryWords.test(lower) &&
    (lower.includes('total') ||
      lower.includes('valor') ||
      lower.includes('vlr') ||
      lower.includes('subtotal'))
  ) {
    return true;
  }

  return false;
}

export function repairReceiptWord(word: string): string {
  if (!word) return word;
  const upperWord = word.toUpperCase();
  if (upperWord === 'OL' || upperWord === 'SC') return word;

  const isMeasurement =
    /^\d*(?:[,.]\d+)?[Oo0-9]+(?:g|kg|ml|l|lt|un|pc|pct|cx|emb|%)$/i.test(
      word,
    ) || /^C\/\d*$/i.test(word);

  let w = word;
  if (isMeasurement) {
    return w.replace(/[Oo]/g, '0');
  }

  // 1. Repair digit '0' to letter 'O' in words
  if (/[a-zA-ZÀ-ÿ]/.test(w) && w.includes('0')) {
    w = w.replace(
      /(?<=[a-zA-ZÀ-ÿ])0+|0+(?=[a-zA-ZÀ-ÿ])/g,
      (m) => 'O'.repeat(m.length),
    );
    if (w.startsWith('0') && w.length >= 2) w = `O${w.slice(1)}`;
    if (w.endsWith('0') && w.length >= 3) w = `${w.slice(0, -1)}O`;
  }

  // 2. Repair digit '1' to letter 'I' in alphabetical words (e.g. B1SCOITO, LE1TE, 1OGURTE)
  if (/[a-zA-ZÀ-ÿ]{2,}/.test(w) && w.includes('1')) {
    w = w.replace(
      /(?<=[a-zA-ZÀ-ÿ])1+|1+(?=[a-zA-ZÀ-ÿ])/g,
      (m) => 'I'.repeat(m.length),
    );
    if (w.startsWith('1') && w.length >= 3 && /[a-zA-ZÀ-ÿ]{2,}/.test(w)) {
      w = `I${w.slice(1)}`;
    }
  }

  // 3. Repair digit '5' to letter 'S' in alphabetical words (e.g. 5UCO, 5ABONETE, MA5SA)
  if (/[a-zA-ZÀ-ÿ]{2,}/.test(w) && w.includes('5')) {
    w = w.replace(
      /(?<=[a-zA-ZÀ-ÿ])5+|5+(?=[a-zA-ZÀ-ÿ])/g,
      (m) => 'S'.repeat(m.length),
    );
    if (w.startsWith('5') && w.length >= 3 && /[a-zA-ZÀ-ÿ]{2,}/.test(w)) {
      w = `S${w.slice(1)}`;
    }
  }

  // 4. Repair digit '8' to letter 'B' at start of words (e.g. 8ISCOITO, 8ANANA)
  if (w.startsWith('8') && w.length >= 3 && /[a-zA-ZÀ-ÿ]{2,}/.test(w)) {
    w = `B${w.slice(1)}`;
  }

  const upper = w.toUpperCase();
  if (upper in RECEIPT_WORD_FIXES) {
    return RECEIPT_WORD_FIXES[upper];
  }

  if (upper.startsWith('QV')) {
    w = `QU${w.slice(2)}`;
  } else {
    w = w.replace(/qv/gi, 'qu');
  }

  w = w.replace(/([bcdfghjklmnpqrstz])ou([aeo])/gi, '$1ov$2');
  w = w.replace(/^ou([aeo])/gi, 'ov$1');
  w = w.replace(/([bcdfghjklmnpqrstz])v([bcdfghjklmnpqrstz])/gi, '$1u$2');
  w = w.replace(/([bcdfghjklmnpqrstz]|ca)v$/gi, '$1u');
  w = w.replace(/rue/gi, 'rve');
  w = w.replace(/auei/gi, 'avei');
  w = w.replace(/oliua|oiua/gi, 'oliva');
  w = w.replace(/couue/gi, 'couve');
  w = w.replace(/erua/gi, 'erva');
  w = w.replace(/suaue/gi, 'suave');

  const upperW = w.toUpperCase();
  if (
    (upperW.startsWith('UAL') ||
      upperW.startsWith('UIN') ||
      upperW.startsWith('UAG') ||
      upperW.startsWith('UER') ||
      upperW.startsWith('UIG') ||
      upperW.startsWith('UAN') ||
      upperW.startsWith('UAS') ||
      upperW.startsWith('UAP')) &&
    upperW.length >= 4
  ) {
    w = `V${w.slice(1)}`;
  } else if (upperW.startsWith('UITA') && upperW.length >= 5) {
    w = `V${w.slice(1)}`;
  }

  return w;
}

export function mergeSplitWords(rawTokens: string[]): string[] {
  if (rawTokens.length <= 1) return rawTokens;
  const result: string[] = [];
  let i = 0;
  const minorPrepositions = new Set([
    'de', 'da', 'do', 'das', 'dos', 'em', 'com', 'sem', 'e', 'para',
  ]);

  while (i < rawTokens.length) {
    const token = rawTokens[i];
    const lowerToken = token.toLowerCase();

    if (minorPrepositions.has(lowerToken)) {
      result.push(token);
      i++;
      continue;
    }

    if (i + 2 < rawTokens.length) {
      const t1 = rawTokens[i + 1].toLowerCase();
      const t2 = rawTokens[i + 2].toLowerCase();
      if (!minorPrepositions.has(t1) && !minorPrepositions.has(t2)) {
        const triple = `${rawTokens[i]}${rawTokens[i + 1]}${rawTokens[i + 2]}`;
        const repairedTriple = repairReceiptWord(triple);
        if (KNOWN_SINGLE_WORDS.has(normalizeWordForLookup(repairedTriple))) {
          result.push(repairedTriple);
          i += 3;
          continue;
        }
      }
    }
    if (i + 1 < rawTokens.length) {
      const t1 = rawTokens[i + 1].toLowerCase();
      if (!minorPrepositions.has(t1)) {
        const pair = `${rawTokens[i]}${rawTokens[i + 1]}`;
        const repairedPair = repairReceiptWord(pair);
        if (KNOWN_SINGLE_WORDS.has(normalizeWordForLookup(repairedPair))) {
          result.push(repairedPair);
          i += 2;
          continue;
        }
      }
    }
    result.push(rawTokens[i]);
    i++;
  }

  return result;
}

export function cleanReceiptProductName(raw: string): string {
  let s = raw;

  // 0. Remove bracketed / parenthesized codes e.g. (Código: 1234), (Cód: 5678), (Cod: 90), (PLU: 4011), (Ref: 99)
  s = s.replace(/\s*\((?:c[óo]d(?:igo)?|plu|ref|ean|gtin|item)\s*:[^)]*\)\s*/gi, ' ');
  s = s.replace(/\s*\[(?:c[óo]d(?:igo)?|plu|ref|ean|gtin|item)\s*:[^\]]*\]\s*/gi, ' ');
  s = s.replace(/\b(?:c[óo]d(?:igo)?|plu|ref|ean|gtin)\s*:\s*\d+\b/gi, ' ');
  s = s.replace(/\bNCM(?:\s*:)?\s*[\d.-]+\b/gi, ' ');

  // 1. Remove leading item index, codes, and barcodes (e.g. "001 7891000315507 ", "ITEM 01 12345 ")
  s = s.replace(/^\s*(?:ITEM|IT|COD|CÓD)?\s*#?\s*\d{1,6}\s+\d{4,14}\s+/i, '');
  s = s.replace(/^\s*(?:ITEM|IT|COD|CÓD)?\s*#?\s*\d{1,14}[\s.-]+/i, '');
  s = s.replace(/^\s*\d{7,14}\s+/, '');

  // 2. Remove trailing quantity multipliers, fiscal tags and unit markers
  s = s.replace(/\s+\d+(?:[,.]\d+)?\s*(?:UN|KG|PC|PCT|CX|EMB)\s*[xX*]\s*[\d,.]+.*$/i, '');
  s = s.replace(/\s*(?:UN|KG|LT|PC)\s*:\s*[A-Z0-9]+.*$/i, '');
  s = s.replace(/\s*V(?:L|LR)?\.?\s*UNIT(?:\.|ÁRIO)?\s*:?.*$/i, '');
  s = s.replace(/\s+(?:F\d+|T\d+(?:[,.]\d+)?%?|I\d+|N\d+|II|FF|NN|ST|ICMS(?:\s*\d+%)?|PIS|COFINS)\b.*$/gi, '');
  s = s.replace(/\s+(?:UN|PC|R\$)\s*$/i, '');

  // 3. Remove stray symbols like ***, ===, ---, >>>, <<<, #, |, ~
  s = s.replace(/[*=_#|~<>]+/g, ' ');

  for (const [key, val] of Object.entries(PHRASE_ABBREV_MAP)) {
    const pattern = new RegExp(`\\b${escapeRegExp(key)}\\b`, 'gi');
    s = s.replace(pattern, val);
  }

  let rawTokens = s
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  rawTokens = mergeSplitWords(rawTokens);

  const cleanedWords: string[] = [];
  for (const w of rawTokens) {
    const rawUpper = w.toUpperCase();
    if (rawUpper in ABBREV_MAP) {
      cleanedWords.push(ABBREV_MAP[rawUpper]);
      continue;
    }
    const repaired = repairReceiptWord(w);
    const upper = repaired.toUpperCase();
    if (upper in ABBREV_MAP) {
      cleanedWords.push(ABBREV_MAP[upper]);
    } else {
      cleanedWords.push(repaired);
    }
  }
  s = cleanedWords.join(' ');

  const trailingMatch = /\s+([A-Za-z0-9]{1,2}(?:\s+[A-Za-z0-9]{1,2})*)\s*$/.exec(
    s,
  );
  if (trailingMatch) {
    const trailingToken = trailingMatch[1].trim().toLowerCase();
    const validShortWords = new Set([
      'po', 'pó', 'cha', 'chá', 'sal', 'uva', 'mel', 'ovo', 'pao', 'pão',
      'de', 'em', 'un', 'kg', 'ml', 'g', 'l', 'ev', '1', '2', '3', '4', '5', '6', '7', '8', '9', '12',
    ]);
    if (
      !validShortWords.has(trailingToken) &&
      !/^\d+[a-z]{1,2}$/i.test(trailingToken)
    ) {
      s = s.slice(0, trailingMatch.index).trim();
    }
  }

  s = s.replace(/\s+/g, ' ').trim();
  if (!s || !/[a-zA-ZÀ-ÿ]/.test(s)) return '';

  const minorPrepositions = new Set([
    'de', 'da', 'do', 'das', 'dos', 'em', 'com', 'sem', 'e', 'para',
  ]);
  return s
    .split(' ')
    .map((p) => {
      if (!p) return '';
      if (/^\d+(?:[,.]\d+)?[a-zA-Z]{1,3}$/.test(p)) return p.toLowerCase();
      if (p.toUpperCase() === 'UHT' || p.toUpperCase() === 'EV') return p.toUpperCase();
      const lower = p.toLowerCase();
      if (minorPrepositions.has(lower)) return lower;
      return lower[0].toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function extractItemIndex(line: string): number | undefined {
  const match = /^\s*(?:item|it|cod|cód)?\s*#?\s*(\d{1,4})\b/i.exec(line);
  if (match) {
    const val = Number.parseInt(match[1], 10);
    if (val >= 1 && val <= 999) return val;
  }
  return undefined;
}

export function accumulateScannedItems(
  items: ScannedReceiptItem[],
): ScannedReceiptItem[] {
  if (items.length === 0) return items;
  const result: ScannedReceiptItem[] = [];
  const map = new Map<string, ScannedReceiptItem>();

  for (const item of items) {
    const key = CategoryClassifier.normalize(item.name);
    if (!key) {
      result.push(item);
      continue;
    }

    const existing = map.get(key);
    if (existing) {
      const itemQty = item.quantity > 0 ? item.quantity : 1.0;
      existing.quantity += itemQty;
      existing.price += item.price;
      if (existing.quantity > 0) {
        existing.unitPrice = existing.price / existing.quantity;
      }
      if (!existing.unit || existing.unit === 'un') {
        if (item.unit && item.unit !== 'un') {
          existing.unit = item.unit;
        }
      }
    } else {
      const itemQty = item.quantity > 0 ? item.quantity : 1.0;
      const copy: ScannedReceiptItem = {
        name: item.name,
        price: item.price,
        unitPrice:
          item.unitPrice ?? (itemQty > 0 ? item.price / itemQty : item.price),
        category: item.category,
        quantity: itemQty,
        unit: item.unit || 'un',
        itemIndex: item.itemIndex,
      };
      map.set(key, copy);
      result.push(copy);
    }
  }

  return result;
}

export function parseReceiptText(rawText: string): ScannedReceiptItem[] {
  if (!rawText.trim()) return [];

  const lines = rawText
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const items: ScannedReceiptItem[] = [];
  let pendingProductName: string | null = null;
  let pendingItemIndex: number | undefined;

  const priceRegex = /(\d{1,3}(?:\.\d{3})*[,.]\d{2})\b/g;
  const qtyMultiplierRegex =
    /(\d+(?:[,.]\d+)?)\s*(un|kg|g|l|lt|ml|pc|pct|cx|emb)?\s*[xX*]\s*(\d+[,.]\d{2})/i;

  for (const line of lines) {
    const rawLine = repairOcrPricesInLine(line);

    if (
      shouldIgnoreReceiptLine(rawLine) ||
      isReceiptTotalOrSummaryLine(rawLine)
    ) {
      pendingProductName = null;
      pendingItemIndex = undefined;
      continue;
    }

    const qtyMatch = qtyMultiplierRegex.exec(rawLine);
    const nameBeforeQty = qtyMatch
      ? cleanReceiptProductName(rawLine.slice(0, qtyMatch.index).trim())
      : '';
    if (
      qtyMatch &&
      nameBeforeQty.length < 2 &&
      pendingProductName &&
      !isTotalProductName(pendingProductName)
    ) {
      const matches = Array.from(rawLine.matchAll(priceRegex));
      if (matches.length > 0) {
        const parsedPrice = AppFormatters.parsePrice(
          matches[matches.length - 1][1],
        );
        if (parsedPrice != null && parsedPrice > 0 && parsedPrice < 10000) {
          const parsedQty = AppFormatters.parsePrice(qtyMatch[1]) ?? 1.0;
          const unitStr = (qtyMatch[2] ?? 'un').toLowerCase();
          const itemIdx = pendingItemIndex ?? extractItemIndex(rawLine);
          const parsedUnitPrice = qtyMatch[3]
            ? AppFormatters.parsePrice(qtyMatch[3])
            : null;
          const effectiveTotalPrice =
            parsedQty > 1 &&
            parsedUnitPrice != null &&
            (parsedPrice <= parsedUnitPrice || matches.length === 1)
              ? parsedUnitPrice * parsedQty
              : parsedPrice;
          const effectiveUnitPrice =
            parsedUnitPrice ??
            (parsedQty > 0
              ? effectiveTotalPrice / parsedQty
              : effectiveTotalPrice);

          items.push({
            name: pendingProductName,
            price: effectiveTotalPrice,
            unitPrice: effectiveUnitPrice,
            quantity: parsedQty > 0 ? parsedQty : 1.0,
            unit: unitStr || 'un',
            category: CategoryClassifier.classify(pendingProductName),
            itemIndex: itemIdx,
          });
          pendingProductName = null;
          pendingItemIndex = undefined;
          continue;
        }
      }
    }

    const priceMatches = Array.from(rawLine.matchAll(priceRegex));
    if (priceMatches.length > 0) {
      const lastMatch = priceMatches[priceMatches.length - 1];
      const parsedPrice = AppFormatters.parsePrice(lastMatch[1]);
      const firstMatch = priceMatches[0];
      let beforePrices = rawLine.slice(0, firstMatch.index).trim();

      let parsedQty = 1.0;
      let parsedUnit = 'un';
      let parsedUnitPrice: number | null = null;
      if (qtyMatch && qtyMatch.index < (firstMatch.index ?? 0)) {
        beforePrices = rawLine.slice(0, qtyMatch.index).trim();
        parsedUnit = (qtyMatch[2] ?? 'un').toLowerCase();
        parsedQty = AppFormatters.parsePrice(qtyMatch[1]) ?? 1.0;
        if (qtyMatch[3]) {
          parsedUnitPrice = AppFormatters.parsePrice(qtyMatch[3]);
        }
      }

      const lineItemIdx = extractItemIndex(rawLine) ?? pendingItemIndex;
      const cleanedName = cleanReceiptProductName(beforePrices);

      if (parsedPrice != null && parsedPrice > 0 && parsedPrice < 10000) {
        const effectiveTotalPrice =
          parsedQty > 1 &&
          parsedUnitPrice != null &&
          parsedPrice <= parsedUnitPrice
            ? parsedUnitPrice * parsedQty
            : parsedPrice;
        const effectiveUnitPrice =
          parsedUnitPrice ??
          (parsedQty > 0
            ? effectiveTotalPrice / parsedQty
            : effectiveTotalPrice);

        if (cleanedName.length >= 2 && !isTotalProductName(cleanedName)) {
          items.push({
            name: cleanedName,
            price: effectiveTotalPrice,
            unitPrice: effectiveUnitPrice,
            quantity: parsedQty > 0 ? parsedQty : 1.0,
            unit: parsedUnit || 'un',
            category: CategoryClassifier.classify(cleanedName),
            itemIndex: lineItemIdx,
          });
          pendingProductName = null;
          pendingItemIndex = undefined;
          continue;
        } else if (
          pendingProductName &&
          !isTotalProductName(pendingProductName)
        ) {
          items.push({
            name: pendingProductName,
            price: effectiveTotalPrice,
            unitPrice: effectiveUnitPrice,
            quantity: parsedQty > 0 ? parsedQty : 1.0,
            unit: parsedUnit || 'un',
            category: CategoryClassifier.classify(pendingProductName),
            itemIndex: pendingItemIndex ?? lineItemIdx,
          });
          pendingProductName = null;
          pendingItemIndex = undefined;
          continue;
        }
      }
    }

    const candidateName = cleanReceiptProductName(rawLine);
    if (candidateName.length >= 3 && !isTotalProductName(candidateName)) {
      pendingProductName = candidateName;
      pendingItemIndex = extractItemIndex(rawLine);
    }
  }

  const filtered = items.filter((item) => !isTotalProductName(item.name));

  const indexedCount = filtered.filter((it) => it.itemIndex != null).length;
  if (indexedCount >= 2 && indexedCount >= filtered.length * 0.5) {
    let lastIdx = 0;
    for (const it of filtered) {
      if (it.itemIndex != null) {
        lastIdx = it.itemIndex;
      } else {
        lastIdx++;
        it.itemIndex = lastIdx;
      }
    }
    filtered.sort((a, b) => (a.itemIndex ?? 0) - (b.itemIndex ?? 0));
  } else {
    for (let i = 0; i < filtered.length; i++) {
      filtered[i].itemIndex = i + 1;
    }
  }

  return accumulateScannedItems(filtered);
}

/**
 * Client-side OCR fallback using Tesseract.js with canvas preprocessing
 * (grayscale + contrast boost) for browser/PWA environments.
 */
export async function recognizeTextFromImageFile(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const preprocessedUrl = await preprocessImageForOcr(file);
  const worker = await createWorker('por', undefined, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round((m.progress ?? 0) * 100));
      }
    },
  });
  try {
    const {
      data: { text },
    } = await worker.recognize(preprocessedUrl);
    return text;
  } finally {
    await worker.terminate();
    if (preprocessedUrl.startsWith('blob:')) {
      URL.revokeObjectURL(preprocessedUrl);
    }
  }
}

async function preprocessImageForOcr(file: File): Promise<string> {
  const imgUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = imgUrl;
    });

    const maxDim = 1800;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return imgUrl;

    ctx.filter = 'grayscale(100%) contrast(140%)';
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    );
    if (!blob) return imgUrl;
    URL.revokeObjectURL(imgUrl);
    return URL.createObjectURL(blob);
  } catch {
    return imgUrl;
  }
}

export const ReceiptScannerService = {
  parseReceiptText,
  accumulateScannedItems,
  cleanReceiptProductName,
  repairReceiptWord,
  mergeSplitWords,
  isTotalProductName,
  phraseAbbrevMap: PHRASE_ABBREV_MAP,
  abbrevMap: ABBREV_MAP,
  recognizeTextFromImageFile,
};
