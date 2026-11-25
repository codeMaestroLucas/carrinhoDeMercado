import type { ScannedReceiptItem } from '../types/shopping';
import { AppFormatters } from '../utils/formatters';
import {
  CategoryClassifier,
  DEFAULT_KEYWORD_DICTIONARY,
} from './categoryClassifier';

const IGNORED_RECEIPT_KEYWORDS = [
  'cnpj', 'cpf', 'inscricao estadual', 'documento auxiliar',
  'nota fiscal', 'cupom fiscal', 'consumidor', 'danfe',
  'qtd. total', 'qtd total', 'qtde. total', 'qtde total',
  'total de itens', 'total itens', 'qtd itens', 'qtde itens',
  'valor total', 'ualor total',
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
  'trib aprox', 'trib. aprox', 'val aprox', 'fonte ibpt',
  'aproximados', 'lei federal', 'ibpt', 'procon', 'decon',
  'chave de acesso', 'consulte pela', 'protocolo', 'autorizacao',
  'serie', 'emissao', 'operador', 'caixa', 'extrato', 'sat ',
  'qrcode', 'http', 'www.', 'sefaz', 'fazenda',
  'codigo descricao', 'cod descricao', 'item codigo',
  'razao social', 'nome fantasia', 'via consumidor', 'via estabelecimento',
];

export const PHRASE_ABBREV_MAP: Record<string, string> = {
  'CHOC BARRA': 'Chocolate em Barra',
  'CHOCOLATE BARRA': 'Chocolate em Barra',
  'CR LEITE': 'Creme de Leite',
  'CR LT': 'Creme de Leite',
  'CRM LEITE': 'Creme de Leite',
  'CREM LEITE': 'Creme de Leite',
  'CREM LEIT': 'Creme de Leite',
  'CR DE LEITE': 'Creme de Leite',
  'L MOV': 'Lava Móveis',
  'L MOVEIS': 'Lava Móveis',
  'LIMP MOV': 'Limpa Móveis',
  'LUSTR MOV': 'Lustra Móveis',
  'LUSTRA MOV': 'Lustra Móveis',
  'TIRA MAN': 'Tira Manchas',
  'L ROUP': 'Lava Roupas',
  'L ROUPAS': 'Lava Roupas',
  'L LOUC': 'Lava Louças',
  'L LOUCA': 'Lava Louças',
  'L LOUCAS': 'Lava Louças',
  'AG SANIT': 'Água Sanitária',
  'AQ SANIT': 'Água Sanitária',
  'AGUA SANIT': 'Água Sanitária',
  'AG SANITARIA': 'Água Sanitária',
  'CLOR ATIV': 'Cloro Ativo',
  'LIMP VID': 'Limpa Vidros',
  'LIMPA VID': 'Limpa Vidros',
  'LIMP ALUM': 'Limpa Alumínio',
  'LIMPA ALUM': 'Limpa Alumínio',
  'ESP ACO': 'Esponja de Aço',
  'ESP MULT': 'Esponja Multiuso',
  'PAN PRAT': 'Pano de Prato',
  'PANO PRAT': 'Pano de Prato',
  'PAN CHAO': 'Pano de Chão',
  'PANO CHAO': 'Pano de Chão',
  'PANO MULT': 'Pano Multiuso',
  'AG MIN': 'Água Mineral',
  'AG MINER': 'Água Mineral',
  'AGUA MIN': 'Água Mineral',
  'AG TONICA': 'Água Tônica',
  'AG TONIC': 'Água Tônica',
  'AGUA TON': 'Água Tônica',
  'AG MICE': 'Água Micelar',
  'AGUA MICE': 'Água Micelar',
  'SAB EM PO': 'Sabão em Pó',
  'SAB PO': 'Sabão em Pó',
  'SAB BARRA': 'Sabão em Barra',
  'SAB DE COCO': 'Sabão de Coco',
  'SAB COCO': 'Sabão de Coco',
  'PAPEL HIG': 'Papel Higiênico',
  'PAP HIG': 'Papel Higiênico',
  'PAPEL TOALH': 'Papel Toalha',
  'PAP TOALH': 'Papel Toalha',
  'PAPEL ALUM': 'Papel Alumínio',
  'PAP ALUM': 'Papel Alumínio',
  'PAPEL MANT': 'Papel Manteiga',
  'CREM DENT': 'Creme Dental',
  'CR DENT': 'Creme Dental',
  'CRM DENT': 'Creme Dental',
  'ESC DENT': 'Escova Dental',
  'ESC DENTE': 'Escova Dental',
  'CD COLG': 'Creme Dental Colgate',
  'CD SORR': 'Creme Dental Sorriso',
  'CD ORAL': 'Creme Dental Oral-B',
  'CD SENSOD': 'Creme Dental Sensodyne',
  'CD CLOSE': 'Creme Dental Closeup',
  'FIO DENT': 'Fio Dental',
  'ENX BUCAL': 'Enxaguante Bucal',
  'ENXAG BUCAL': 'Enxaguante Bucal',
  'AP BARB': 'Aparelho de Barbear',
  'APAR BARB': 'Aparelho de Barbear',
  'ESP BARB': 'Espuma de Barbear',
  'CR BARB': 'Creme de Barbear',
  'LAM BARB': 'Lâmina de Barbear',
  'LENC UMED': 'Lenço Umedecido',
  'LENCO UMED': 'Lenço Umedecido',
  'LENC UMEDEC': 'Lenço Umedecido',
  'PROT SOLAR': 'Protetor Solar',
  'PROT SOL': 'Protetor Solar',
  'PROT DIAR': 'Protetor Diário',
  'PAO FRANC': 'Pão Francês',
  'PAO FRAN': 'Pão Francês',
  'PAO FORM': 'Pão de Forma',
  'PAO FORMA': 'Pão de Forma',
  'P DE FORMA': 'Pão de Forma',
  'P FRANCES': 'Pão Francês',
  'C/ CAROCO': 'Com Caroço',
  'S/ CAROCO': 'Sem Caroço',
  'C/ LACTOSE': 'Com Lactose',
  'S/ LACTOSE': 'Sem Lactose',
  'BAT PALHA': 'Batata Palha',
  'BAT FRITA': 'Batata Frita',
  'BAT DOCE': 'Batata Doce',
  'BAT CHIPS': 'Batata Chips',
  'CH VERD': 'Cheiro Verde',
  'CH VERDE': 'Cheiro Verde',
  'CHEIRO VERD': 'Cheiro Verde',
  'MOLHO TOM': 'Molho de Tomate',
  'MOLH TOM': 'Molho de Tomate',
  'MOL TOM': 'Molho de Tomate',
  'M TARANT': 'Molho Tarantella',
  'MOLH SHOYU': 'Molho Shoyu',
  'MOLH INGLES': 'Molho Inglês',
  'EXTR TOM': 'Extrato de Tomate',
  'EXT TOM': 'Extrato de Tomate',
  'POLP TOM': 'Polpa de Tomate',
  'POL TOM': 'Polpa de Tomate',
  'LEIT COND': 'Leite Condensado',
  'LEITE COND': 'Leite Condensado',
  'LT COND': 'Leite Condensado',
  'L COND': 'Leite Condensado',
  'LEIT CONDENS': 'Leite Condensado',
  'LEITE CONDENS': 'Leite Condensado',
  'LT PO': 'Leite em Pó',
  'LT EM PO': 'Leite em Pó',
  'LEITE PO': 'Leite em Pó',
  'LT SD': 'Leite Semidesnatado',
  'LEIT UHT': 'Leite UHT',
  'LEITE UHT': 'Leite UHT',
  'LEIT INT': 'Leite Integral',
  'LEITE INT': 'Leite Integral',
  'LEIT DESN': 'Leite Desnatado',
  'LEITE DESN': 'Leite Desnatado',
  'LEIT SEMI': 'Leite Semidesnatado',
  'LEITE SEMI': 'Leite Semidesnatado',
  'PEIT PERU': 'Peito de Peru',
  'PEI PERU': 'Peito de Peru',
  'PEITO PERU': 'Peito de Peru',
  'PEIT FRANG': 'Peito de Frango',
  'PEI FRANG': 'Peito de Frango',
  'PEITO FRANG': 'Peito de Frango',
  'FILE PEIT': 'Filé de Peito',
  'FILE DE PEITO': 'Filé de Peito',
  'FIL FRANG': 'Filé de Frango',
  'FILE FRANG': 'Filé de Frango',
  'COX FRANG': 'Coxa de Frango',
  'CX FRANG': 'Coxa de Frango',
  'S COXA': 'Sobrecoxa',
  'SOBR COXA': 'Sobrecoxa',
  'FILE MIGNON': 'Filé Mignon',
  'FIL MIGNON': 'Filé Mignon',
  'FL MIGNON': 'Filé Mignon',
  'F MIGNON': 'Filé Mignon',
  'CONTRA FILE': 'Contrafilé',
  'CONTRA FIL': 'Contrafilé',
  'CNT FILE': 'Contrafilé',
  'C FILE': 'Contrafilé',
  'COX SOBRECOX': 'Coxa e Sobrecoxa',
  'C SOBRECOX': 'Coxa e Sobrecoxa',
  'CARN MOID': 'Carne Moída',
  'CARNE MOID': 'Carne Moída',
  'COST BOV': 'Costela Bovina',
  'COST SUIN': 'Costela Suína',
  'LING CALAB': 'Linguiça Calabresa',
  'LINGUICA CALAB': 'Linguiça Calabresa',
  'LI CAL': 'Linguiça Calabresa',
  'LING TOSC': 'Linguiça Toscana',
  'LINGUICA TOSC': 'Linguiça Toscana',
  'LI TOSC': 'Linguiça Toscana',
  'LI FGO': 'Linguiça de Frango',
  'LING FRANG': 'Linguiça de Frango',
  'CAL DEF': 'Calabresa Defumada',
  'DOCE LEIT': 'Doce de Leite',
  'DOCE DE LEIT': 'Doce de Leite',
  'AZEIT EXTR VIRG': 'Azeite Extra Virgem',
  'AZEITE EV': 'Azeite Extra Virgem',
  'AZ EXT VIRG': 'Azeite Extra Virgem',
  'AZ EXTRAVIRGEM': 'Azeite Extra Virgem',
  'AZEITE EXTRAV': 'Azeite Extra Virgem',
  'AZEITE EXT VIRGEM': 'Azeite Extra Virgem',
  'AZ OLIVA': 'Azeite de Oliva',
  'EXT VIRGEM': 'Extra Virgem',
  'EXT VIRG': 'Extra Virgem',
  'OL SOJA': 'Óleo de Soja',
  'OL SJ': 'Óleo de Soja',
  'OLEO SOJ': 'Óleo de Soja',
  'OL GIRASSOL': 'Óleo de Girassol',
  'OL MILHO': 'Óleo de Milho',
  'FAR TRIGO': 'Farinha de Trigo',
  'FAR MANDIOCA': 'Farinha de Mandioca',
  'FAR MAND': 'Farinha de Mandioca',
  'MIST BOLO': 'Mistura para Bolo',
  'ACUC REFIN': 'Açúcar Refinado',
  'ACUC CRIST': 'Açúcar Cristal',
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
  'S LACT': 'Sem Lactose',
  'S LACTOSE': 'Sem Lactose',
  'ZERO LACT': 'Zero Lactose',
  'S GLUT': 'Sem Glúten',
  'S GLUTEN': 'Sem Glúten',
  'S ACUC': 'Sem Açúcar',
  'C/ CAROC': 'Com Caroço',
  'COM CAROC': 'Com Caroço',
  'S/ CAROC': 'Sem Caroço',
  'SEM CAROC': 'Sem Caroço',
  'FOLHA DUPLA': 'Folha Dupla',
  'FD DUPLA': 'Folha Dupla',
  'FOLHA TRIPLA': 'Folha Tripla',
  'FD TRIPLA': 'Folha Tripla',
  'SACO P/ LIXO': 'Saco para Lixo',
  'SC LIXO': 'Saco de Lixo',
  'SC LIX': 'Saco de Lixo',
  'SACO LIX': 'Saco de Lixo',
  'SACO LIXO': 'Saco de Lixo',
  'COP DESC': 'Copo Descartável',
  'COPO DESC': 'Copo Descartável',
  'PRAT DESC': 'Prato Descartável',
  'PRATO DESC': 'Prato Descartável',
  'TALH DESC': 'Talher Descartável',
  'SAC PLAST': 'Sacola Plástica',
  'SACOLA PLAST': 'Sacola Plástica',
  'FRALD DESC': 'Fralda Descartável',
  'FRALDA DESC': 'Fralda Descartável',
  'FRALD INF': 'Fralda Infantil',
  'FRALD GER': 'Fralda Geriátrica',
  'FILT PAP': 'Filtro de Papel',
  'FILTRO PAP': 'Filtro de Papel',
  'PILH ALC': 'Pilha Alcalina',
  'PILHA ALC': 'Pilha Alcalina',
  'SAB LIQ': 'Sabonete Líquido',
  'SAB LIQUIDO': 'Sabonete Líquido',
  'DESOD AER': 'Desodorante Aerossol',
  'DESOD AERO': 'Desodorante Aerossol',
  'DESOD AEROS': 'Desodorante Aerossol',
  'DESOD ROLL': 'Desodorante Roll-on',
  'DESOD ROLON': 'Desodorante Roll-on',
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
  'PAO QUEIJO': 'Pão de Queijo',
  'PAO QJ': 'Pão de Queijo',
  'PAO QJO': 'Pão de Queijo',
  'P DE QUEIJO': 'Pão de Queijo',
  'AG COCO': 'Água de Coco',
  'AGUA COCO': 'Água de Coco',
  'BEB LACT': 'Bebida Láctea',
  'IORG GREGO': 'Iogurte Grego',
  'IOG GREGO': 'Iogurte Grego',
  'IOG NAT': 'Iogurte Natural',
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
  'QJ RAL': 'Queijo Ralado',
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
  REFRIG: 'Refrigerante', REFRI: 'Refrigerante',
  CAFE: 'Café', CAFÉ: 'Café', PILAO: 'Pilão', PILÃO: 'Pilão',
  FEIJAO: 'Feijão', FEIJÃO: 'Feijão', ACUCAR: 'Açúcar', AÇUCAR: 'Açúcar',
  PAO: 'Pão', PÃO: 'Pão', SABAO: 'Sabão', SABÃO: 'Sabão',
  AGUA: 'Água', ÁGUA: 'Água', MELAO: 'Melão', MELÃO: 'Melão',
  YPE: 'Ypê', YPÊ: 'Ypê', UNIAO: 'União', UNIÃO: 'União',
  REQUEIJAO: 'Requeijão', LINGUICA: 'Linguiça', ALMONDEGA: 'Almôndega',
  BROCOLIS: 'Brócolis', ABOBORA: 'Abóbora', PESSEGO: 'Pêssego',
  MARACUJA: 'Maracujá', GUARANA: 'Guaraná', ACAI: 'Açaí',
  FUBA: 'Fubá', ALCOOL: 'Álcool', ORGANICO: 'Orgânico', ORGANICA: 'Orgânica',
  SALMAO: 'Salmão', CAMARAO: 'Camarão', AVELA: 'Avelã', FRANCES: 'Francês',
  PARMESAO: 'Parmesão', MUSCULO: 'Músculo', COXAO: 'Coxão',
  PACOCA: 'Paçoca', CAFEINA: 'Cafeína', SOLUVEL: 'Solúvel',
  CERV: 'Cerveja', CERVEJ: 'Cerveja', CHOP: 'Chopp', SUC: 'Suco',
  AG: 'Água', AGU: 'Água', MIN: 'Mineral', MINER: 'Mineral',
  'S/GAS': 'Sem Gás', SGAS: 'Sem Gás', 'C/GAS': 'Com Gás', CGAS: 'Com Gás',
  TON: 'Tônica', TONIC: 'Tônica', ESPUM: 'Espumante', ENERG: 'Energético',
  ISOT: 'Isotônico', CHA: 'Chá', NECT: 'Néctar',
  SAB: 'Sabonete', SBT: 'Sabonete', SABON: 'Sabonete', SH: 'Shampoo', SHAMP: 'Shampoo',
  SHAMPO: 'Shampoo', SHP: 'Shampoo', CND: 'Condicionador',
  DESOD: 'Desodorante', DESODOR: 'Desodorante', DES: 'Desodorante', AER: 'Aerossol', AEROS: 'Aerossol',
  ROLL: 'Roll-on', 'CREM DENT': 'Creme Dental', 'CR DENT': 'Creme Dental',
  DENT: 'Dental', CREM: 'Creme', CR: 'Creme', ESCOV: 'Escova', ESCOUA: 'Escova', ESC: 'Escova',
  HIDRAT: 'Hidratante', HIDR: 'Hidratante', HID: 'Hidratante', FRAL: 'Fralda',
  ABS: 'Absorvente', ABSORV: 'Absorvente', PROT: 'Protetor',
  ANTISS: 'Antisséptico', ANTISSEP: 'Antisséptico', ENXAG: 'Enxaguante',
  BUCAL: 'Bucal', HAST: 'Hastes Flexíveis', COTON: 'Cotonetes',
  ALGOD: 'Algodão', LENCO: 'Lenço Umedecido', UMED: 'Umedecido',
  DESC: 'Descartável', DET: 'Detergente', DETERG: 'Detergente',
  AMAC: 'Amaciante', AMACIANT: 'Amaciante', AM: 'Amaciante', CONC: 'Concentrado',
  LIMP: 'Limpador', DESINF: 'Desinfetante', DESINFET: 'Desinfetante', DESF: 'Desinfetante',
  MULT: 'Multiuso', MULTIUS: 'Multiuso', ESPONJA: 'Esponja', ESP: 'Esponja',
  PANO: 'Pano', FLAN: 'Flanela', UASSOURA: 'Vassoura', ROD: 'Rodo',
  LAV: 'Lava', ROUP: 'Roupas', ROUPA: 'Roupas', LOUC: 'Louças', LOUCA: 'Louças',
  MOV: 'Móveis', MOVEIS: 'Móveis', DESENG: 'Desengordurante',
  DESENGORD: 'Desengordurante', ALVEJ: 'Alvejante', SANIT: 'Sanitário',
  SANITARIA: 'Sanitária', SANITARIO: 'Sanitário', CLOR: 'Cloro',
  'AG SANIT': 'Água Sanitária', 'AGUA SANIT': 'Água Sanitária',
  'SAB EM PO': 'Sabão em Pó', 'SAB PO': 'Sabão em Pó',
  'SAB BARRA': 'Sabão em Barra', 'PAPEL HIG': 'Papel Higiênico',
  GUARD: 'Guardanapo', GUARDAN: 'Guardanapo', TOALH: 'Toalha', LIX: 'Lixo', LIXO: 'Lixo',
  INSET: 'Inseticida', INSETIC: 'Inseticida', REPEL: 'Repelente', ODOR: 'Odorizador', ODORIZ: 'Odorizador',
  AROMAT: 'Aromatizador', PCT: 'Pacote', PCTE: 'Pacote', PACOT: 'Pacote', CX: 'Caixa',
  CXA: 'Caixa', FD: 'Fardo', FARDO: 'Fardo', GAR: 'Garrafa', GARRAF: 'Garrafa', GRF: 'Garrafa',
  LAT: 'Lata', LATA: 'Lata', EMB: 'Embalagem', EMBAL: 'Embalagem',
  BDJ: 'Bandeja', BANDEJ: 'Bandeja', PET: 'Pet', REFIL: 'Refil',
  ECON: 'Econômica', ECONOM: 'Econômico', LEVE: 'Leve', PAG: 'Pague',
  PAGUE: 'Pague', PROM: 'Promoção', PROMO: 'Promoção', TRAD: 'Tradicional',
  TRADIC: 'Tradicional', ORIG: 'Original', NAT: 'Natural', NATUR: 'Natural',
  SABOR: 'Sabor', LIQ: 'Líquido', LIQUID: 'Líquido', LIQUIDA: 'Líquida', PO: 'Pó',
  UNID: 'Unidade', 'C/': 'Com', 'S/': 'Sem', 'P/': 'Para',
  UHT: 'UHT', EV: 'Extra Virgem', VIRG: 'Virgem',
  TOSC: 'Toscana', CALAB: 'Calabresa', CALABR: 'Calabresa', APRES: 'Apresuntado', APRESUNT: 'Apresuntado',
  LAVAND: 'Lavanda', PINH: 'Pinho', EUCAL: 'Eucalipto', CITR: 'Cítrico',
  MARAC: 'Maracujá', MORANG: 'Morango', PESSEG: 'Pêssego', GOIAB: 'Goiaba',
  COCO: 'Coco', BAUN: 'Baunilha', BAUNILH: 'Baunilha', CANEL: 'Canela', CRAV: 'Cravo',
  AMEND: 'Amendoim', GEL: 'Gel', SOLUV: 'Solúvel', CAPS: 'Cápsulas', SACH: 'Sachê', SACHE: 'Sachê', FLOC: 'Flocos',
  TP: 'Tipo', T1: 'Tipo 1', T2: 'Tipo 2', INTENS: 'Intenso',
  PERF: 'Perfeita', FRESC: 'Fresco', PIP: 'Pipoca', PEI: 'Peito',
  FEJ: 'Feijão', MACAR: 'Macarrão', MACC: 'Macarrão', TARANT: 'Tarantella',
  AMID: 'Amido', FERM: 'Fermento', FERMENT: 'Fermento', CROIS: 'Croissant',
  BAUD: 'Bauducco', FGO: 'Frango', MORT: 'Mortadela', MORTAD: 'Mortadela', SALAM: 'Salame',
  POLIF: 'Poliflor', GLAD: 'Glade', COZ: 'Cozinha', COLG: 'Colgate',
  ACET: 'Acetona', CICATR: 'Cicatricure', PH: 'Papel Higiênico', HIG: 'Higiênico',
  ALCAL: 'Alcalina', ALMOF: 'Almofadado', INTEGR: 'Integral', INST: 'Instantâneo', INSTANT: 'Instantâneo',
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
  let s = line
    .replace(/\bR[S5]\s*(?=\d)/g, 'R$ ')
    .replace(/(\d)\s*,\s*(\d{2})\b/g, '$1,$2')
    .replace(/(?<=[,.])([Oo0-9]{2,3})\b/g, (m) => m.replace(/[Oo]/g, '0'));
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
  if (
    /\b(?:pix|mastercard|visa\s*(?:electron|cr[eé]dito|d[eé]bito)?|elo\s*(?:cr[eé]dito|d[eé]bito)?|hipercard|amex|alelo|sodexo|pluxee|vale\s*alimenta[çc][ãa]o|vale\s*refei[çc][ãa]o)\b/i.test(
      lower,
    )
  ) {
    return true;
  }
  if (/^\s*desc(?:onto)?\.?\s*(?:item|sobre|no|na|do|:|-|\d)/i.test(lower)) {
    return true;
  }
  if (
    /^\s*(?:rua|av\.?|avenida|rod\.?|rodovia|cep|tel(?:efone)?|fone)\b.*?(?:\d{4,5}-?\d{3}|\(\d{2}\))/i.test(
      lower,
    )
  ) {
    return true;
  }
  if (
    /\b(?:supermercado|hipermercado|ltda|eireli)\b/i.test(lower) &&
    !/\d{1,3}(?:\.\d{3})*[,.]\d{2}\b/.test(lower)
  ) {
    return true;
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
    /^\d*(?:[,.]\d+)?[Oo0-9]+(?:g|kg|ml|l|lt|mg|un|pc|pct|cx|emb|%)$/i.test(
      word,
    ) ||
    /^\d+\s*[xX*]\s*\d+(?:[,.]\d+)?(?:g|kg|ml|l|lt|mg|un|pc|pct|cx|emb)?$/i.test(
      word,
    ) ||
    /^\d+em\d+$/i.test(word) ||
    /^C\/\d*$/i.test(word);

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
  if (!raw) return '';

  // 0. Normalize unicode spaces & invisible chars
  let s = raw
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';

  // 1. Remove bracketed / parenthesized fiscal & internal codes
  // e.g. (Código: 12345), (Cód.: 1019816), (Cód 70), (PLU: 4011), (Ref: 99), [EAN: 789...], (123456), (UN)
  s = s.replace(
    /\s*\((?:c[óo]d(?:igo)?|plu|ref|ean|gtin|sku|ncm|cest|cfop|item|it|lote)\s*[:.]?\s*[^)]*\)\s*/gi,
    ' ',
  );
  s = s.replace(
    /\s*\[(?:c[óo]d(?:igo)?|plu|ref|ean|gtin|sku|ncm|cest|cfop|item|it|lote)\s*[:.]?\s*[^\]]*\]\s*/gi,
    ' ',
  );
  // Unclosed trailing "(Cód: 1234" from OCR cutoff
  s = s.replace(
    /\s*\((?:c[óo]d(?:igo)?|plu|ref|ean|gtin|sku|ncm)\s*[:.]?\s*[A-Z0-9.-]*$/gi,
    '',
  );
  // Numeric-only or unit/tax-only parenthesized/bracketed tokens e.g. (12345), (01), (UN), (F1)
  s = s.replace(
    /\s*\(\s*(?:\d[\d.\s/-]*|un|und|kg|pc|pct|cx|f\d+|t\d+(?:[,.]\d+)?%?|i\d+|n\d+|st)\s*\)\s*/gi,
    ' ',
  );
  s = s.replace(
    /\s*\[\s*(?:\d[\d.\s/-]*|un|und|kg|pc|pct|cx|f\d+|t\d+(?:[,.]\d+)?%?|i\d+|n\d+|st)\s*\]\s*/gi,
    ' ',
  );

  // Inline key-value codes & tax identifiers
  s = s.replace(
    /\b(?:c[óo]d(?:igo)?|plu|ref|ean|gtin|sku|lote)\s*[:.#-]?\s*[\d.-]{1,}(?:\/[\d.-]+)?\b/gi,
    ' ',
  );
  s = s.replace(/\b(?:ncm|cest|cfop)\b(?:\s*[:.]?\s*[\d.-]+)?/gi, ' ');
  s = s.replace(/#\s*\d+\b/g, ' ');

  // 2. Remove SEFAZ / receipt inline quantity, unit, multiplier, and price remnants
  s = s.replace(/\b(?:qtde?|quant(?:idade)?)\.?\s*:?\s*[\d.,]+.*$/i, '');
  s = s.replace(/\b(?:un|und|unid|kg|lt|pc|pct|cx|fd)\s*:\s*[A-Z0-9.,/-]+.*$/i, '');
  s = s.replace(/\bv(?:l|lr)?\.?\s*(?:unit(?:[áa]rio)?|total|tot)\s*[:.]?.*$/i, '');
  s = s.replace(
    /\b\d+(?:[,.]\d+)?\s*(?:un|und|unid|kg|g|l|lt|ml|pc|pct|cx|emb|dz|fd|bdj)?\s*[xX*]\s*\d+[,.]\d{2,4}.*$/i,
    '',
  );
  s = s.replace(
    /\s+\d+(?:[,.]\d+)?\s*(?:un|und|unid|kg|pc|pct|cx|emb|dz|fd|bdj)\s*[xX*]\s*$/i,
    '',
  );
  s = s.replace(/\s+r\$\s*[\d.,]*.*$/i, '');

  // 3. Remove leading stray symbols, item sequence indexes, and codes/barcodes
  const stripLeadingNoise = (input: string): string => {
    let cur = input.replace(/^[\s*=_#|~<>.,;:/\\+\-()[\]{}•·—–"'`^°]+/, '');
    cur = cur.replace(
      /^(?:item|it|c[óo]d(?:igo)?|n[º°o]?\.?)\s*#?[:.-]?\s*\d{1,18}(?:[-/]\d+)?[\s.:/)-]*/i,
      '',
    );
    cur = cur.replace(/^\d{1,6}\s+\d{4,18}(?:[-/]\d{1,3})?[\s.:/)-]+/, '');
    cur = cur.replace(/^\d{4,18}(?:[-/]\d{1,3})?(?=[\s.:/)-])[\s.:/)-]+/, '');
    cur = cur.replace(/^0\d{1,4}(?=[\s.:/)-])[\s.:/)-]+/, '');
    cur = cur.replace(/^\d{1,3}\s*[.):/-]+\s*/, '');
    cur = cur.replace(
      /^(?!\d+\s*(?:cora[çc][õo]es|queijos?|em\s+\d|belo|ervas?|cereais|gr[ãa]os|frutas?|leites?|un|kg|g|l|ml|mg|cm|m|rolos?|folhas?)\b)\d{1,3}\s+(?=[a-zA-ZÀ-ÿ])/i,
      '',
    );
    return cur.replace(/^[\s*=_#|~<>.,;:/\\+\-()[\]{}•·—–"'`^°]+/, '').trim();
  };
  s = stripLeadingNoise(s);
  s = stripLeadingNoise(s);

  // 4. Preserve "Tipo 1" / "Tipo 2" before fiscal tag stripping
  s = s.replace(/\bTIPO\s+II\b/gi, 'Tipo 2');
  s = s.replace(/\bTIPO\s+I\b/gi, 'Tipo 1');
  s = s.replace(
    /\b(arroz|feij[aã]o|arr|feij|a[çc][uú]car|acuc|farinha|far|milho|caf[eé])\b(.*?)\bT([12])\b/gi,
    '$1$2Tipo $3',
  );
  s = s.replace(
    /\bT([12])\b(?=\s+\d+(?:[,.]\d+)?\s*(?:kg|kilos?|quilos?|g|gr|l|lt|ml)\b)/gi,
    'Tipo $1',
  );

  // 5. Remove trailing tax flags, ICMS rates, and fiscal tags
  s = s.replace(
    /(?:^|\s+)(?:F\d+|T\d{1,2}(?:[,.]\d+)?%?|I\d+|N\d+|II|FF|NN|IS|NT|ST|ISENTO|TRIB(?:UTADO)?|ICMS(?:\s*[\d,.]+%?)?|PIS|COFINS)\b.*$/gi,
    '',
  );
  s = s.replace(/(?:^|\s+)\d{1,2},\d{2}%.*$/i, '');
  s = s.replace(/(?:^|\s+)(?:7|12|17|18|19|25|27)%.*$/i, '');

  // 6. Remove trailing receipt quantity / bare commercial unit columns
  s = s.replace(
    /(?:^|\s+)\d+[,.]\d{3,4}\s*(?:un|und|unid|kg|g|l|lt|ml|pc|pct|cx|dz|bdj|fd)\b.*$/i,
    '',
  );
  s = s.replace(
    /(?:^|\s+)(?:\d{1,3}\s+(?:un|und|unid|pc|pct|cx|bdj|fd)|0\d{1,2}(?:un|und|unid))\s*$/i,
    '',
  );
  s = s.replace(
    /(?<=\b\d+(?:[,.]\d+)?\s*(?:g|kg|ml|l|mg)\b.*)\s+\d{1,2}(?:un|und|unid)\s*$/i,
    '',
  );
  s = s.replace(/(?:^|\s+)(?:un|und|unid|pc|kg|lt|r\$)\s*$/i, '');

  // 7. Remove trailing & middle standalone 4+ digit codes (PLU/EAN/SKU) and hyphenated numeric codes
  s = s.replace(
    /(?:^|\s+)\d{4,18}\b(?!\s*(?:g|gr|grs|gramas?|kg|kilos?|quilos?|ml|mls|l|lt|lts|litros?|mg|m|cm|mm|folhas?|rolos?|un|und|pc|pct|%))/gi,
    '',
  );
  s = s.replace(
    /(?:^|\s+)\d{1,6}[-/]\d{1,6}\b(?!\s*(?:g|gr|grs|gramas?|kg|kilos?|quilos?|ml|mls|l|lt|lts|litros?|mg|m|cm|mm|%))/gi,
    '',
  );

  // 8. Clean stray punctuation & OCR symbols while preserving decimals, C/12, S/LACT, Coca-Cola
  s = s.replace(/[*=_#|~<>•·…—–«»"'`^°¨§¬¢£¤¦©®™\\;!?@$]+/g, ' ');
  s = s.replace(/[()[\]{}]+/g, ' ');
  // Abbreviation dots attached to letters: "CR.LEITE" -> "CR LEITE", "BISC." -> "BISC"
  s = s.replace(/([a-zA-ZÀ-ÿ])\.([a-zA-ZÀ-ÿ])/g, '$1 $2');
  s = s.replace(/(?<!\d)\.|\.(?!\d)/g, ' ');
  s = s.replace(/(?<!\d),|,(?!\d)/g, ' ');
  s = s.replace(/[:]+/g, ' ');
  // Normalize slash notations (preserve C/12, CH/VERD, expand C/, S/, P/ before letters, drop stray slashes)
  s = s.replace(/\bS\/S\b/gi, 'Sem Semente');
  s = s.replace(/\bC\/(?=[a-zA-ZÀ-ÿ])/gi, 'Com ');
  s = s.replace(/\bS\/(?=[a-zA-ZÀ-ÿ])/gi, 'Sem ');
  s = s.replace(/\bP\/(?=[a-zA-ZÀ-ÿ])/gi, 'Para ');
  s = s.replace(/(?<![cCsSpP])\/|\/(?![a-zA-ZÀ-ÿ0-9])/g, ' ');
  // Drop stray hyphens not joining two word characters (keep "COCA-COLA")
  s = s.replace(/(?<![a-zA-ZÀ-ÿ0-9])-+|-+(?![a-zA-ZÀ-ÿ0-9])/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  // 9. Standardize attached weight/volume tokens BEFORE abbreviation expansion
  // (e.g. "1 LT" -> "1l", preventing "LT" -> "Leite"!)
  s = s.replace(
    /\b(\d+(?:[,.]\d+)?)\s*(?:l|lt|lts|litros?)\b/gi,
    (_, n: string) => `${n.replace('.', ',')}l`,
  );
  s = s.replace(
    /\b(\d+(?:[,.]\d+)?)\s*(?:ml|mls)\b/gi,
    (_, n: string) => `${n.replace('.', ',')}ml`,
  );
  s = s.replace(
    /\b(\d+(?:[,.]\d+)?)\s*(?:kg|kilos?|quilos?)\b/gi,
    (_, n: string) => `${n.replace('.', ',')}kg`,
  );
  s = s.replace(
    /\b([1235]|10|0[,.]\d+)\s*k\b/gi,
    (_, n: string) => `${n.replace('.', ',')}kg`,
  );
  s = s.replace(
    /\b(\d+(?:[,.]\d+)?)\s*(?:g|gr|grs|gramas?)\b/gi,
    (_, n: string) => `${n.replace('.', ',')}g`,
  );
  s = s.replace(
    /\b(\d+(?:[,.]\d+)?)\s*mg\b/gi,
    (_, n: string) => `${n.replace('.', ',')}mg`,
  );

  // 10. Expand multi-word phrases, merge split OCR fragments, repair OCR word confusions, expand abbreviations
  const applyPhraseMap = (text: string): string => {
    let out = text;
    for (const [key, val] of Object.entries(PHRASE_ABBREV_MAP)) {
      const pattern = new RegExp(`\\b${escapeRegExp(key)}\\b`, 'gi');
      out = out.replace(pattern, val);
    }
    return out;
  };

  s = applyPhraseMap(s);

  let rawTokens = s
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  rawTokens = mergeSplitWords(rawTokens);

  const repairedTokens = rawTokens.map((w) => {
    const rawUpper = w.toUpperCase();
    if (rawUpper in ABBREV_MAP) return w;
    return repairReceiptWord(w);
  });

  // Re-run phrase map after OCR word repairs (e.g. "CR LE1TE" -> "CR LEITE" -> "Creme de Leite")
  s = applyPhraseMap(repairedTokens.join(' '));
  const isBigMac = /\bbig\s+mac\b/i.test(s);

  const expandedTokens = s
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w, idx) => {
      const upper = w.toUpperCase();
      if (upper === 'MAC' && isBigMac) return w;
      if (upper === 'REF' && idx === 0) return 'Refrigerante';
      if (upper in ABBREV_MAP) return ABBREV_MAP[upper];
      return w;
    });

  // 11. Strip dangling leading/trailing OCR noise, meaningless numbers, and stray 1-2 char tokens
  while (expandedTokens.length > 1) {
    const first = expandedTokens[0];
    const firstLower = first.toLowerCase();
    const secondLower = expandedTokens[1]?.toLowerCase() ?? '';
    if (/^\d{1,3}$/.test(first)) {
      const keepLeadingDigit =
        /^(?:cora[çc][õo]es|queijos?|em|belo|ervas?|cereais|gr[ãa]os|frutas?|leites?|un|rolos?|folhas?)$/.test(
          secondLower,
        );
      if (!keepLeadingDigit) {
        expandedTokens.shift();
        continue;
      }
    }
    if (first.length === 1 && /^[a-zA-Z]$/.test(first)) {
      if (!(firstLower === 'q' && secondLower === 'boa')) {
        expandedTokens.shift();
        continue;
      }
    }
    break;
  }

  const middleCleaned = expandedTokens.filter((tok, idx) => {
    if (idx > 0 && idx < expandedTokens.length - 1) {
      if (/^0\d{1,3}$/.test(tok)) return false;
    }
    return true;
  });

  const validTrailingShortWords = new Set([
    'po', 'pó', 'cha', 'chá', 'sal', 'uva', 'mel', 'ovo', 'pao', 'pão',
    'no', 'luz', 'sol', 'bem', 'mix',
  ]);
  const numericContextPredecessors = new Set([
    'tipo', 'tp', 'total', 'n', 'nº', 'no', 'nro', 'numero', 'número',
    'filtro', 'coador', 'melitta', 'leve', 'pague', 'zero', 'em',
    'cachaca', 'cachaça', 'pirassununga', 'coracoes', 'corações',
  ]);
  const trailingAcronymModifiers = new Set([
    'p', 'm', 'g', 'xg', 'xxg', 'aa', 'aaa', 'uht', 'ev',
  ]);

  while (middleCleaned.length > 1) {
    const last = middleCleaned[middleCleaned.length - 1];
    const lastLower = last.toLowerCase();
    const prevLower = middleCleaned[middleCleaned.length - 2].toLowerCase();

    if (
      /^\d+(?:[,.]\d+)?(?:g|kg|ml|l|mg|m|cm|mm|un|%)$/i.test(last) ||
      /^c\/\d+$/i.test(last)
    ) {
      break;
    }
    if (/^\d{1,3}$/.test(last) && numericContextPredecessors.has(prevLower)) {
      break;
    }
    if (
      (/^[a-e]$/i.test(last) &&
        (prevLower === 'vitamina' || prevLower === 'tipo')) ||
      (trailingAcronymModifiers.has(lastLower) &&
        /^(?:fralda|fraldas|luva|luvas|pilha|pilhas|bateria|baterias|absorvente|absorventes|leite|azeite|tam|tamanho)$/.test(
          prevLower,
        ))
    ) {
      break;
    }
    if (validTrailingShortWords.has(lastLower)) {
      break;
    }
    if (
      last.length <= 2 ||
      /^\d+$/.test(last) ||
      [
        'de', 'da', 'do', 'das', 'dos', 'em', 'com', 'sem', 'para',
        'un', 'und', 'unid', 'kg', 'lt', 'pc',
      ].includes(lastLower)
    ) {
      middleCleaned.pop();
      continue;
    }
    break;
  }

  s = middleCleaned.join(' ').replace(/\s+/g, ' ').trim();
  if (!s || !/[a-zA-ZÀ-ÿ]/.test(s)) return '';

  // 12. Format Title Case nicely while preserving units, minor prepositions, and acronyms
  const minorPrepositions = new Set([
    'de', 'da', 'do', 'das', 'dos', 'em', 'com', 'sem', 'e', 'para',
  ]);
  const uppercaseAcronyms = new Set(['UHT', 'EV', 'AA', 'AAA', 'XG', 'XXG', 'PVC']);
  const finalTokens = s.split(' ');

  return finalTokens
    .map((p, idx) => {
      if (!p) return '';
      if (/^\d+(?:[,.]\d+)?[a-zA-Z]{1,3}$/.test(p)) return p.toLowerCase();
      if (/^c\/\d+$/i.test(p)) return p.toLowerCase();
      const upper = p.toUpperCase();
      if (uppercaseAcronyms.has(upper)) return upper;
      if (/^[a-zA-Z]$/.test(p) && idx > 0) {
        const prev = finalTokens[idx - 1]?.toLowerCase() ?? '';
        if (
          prev === 'vitamina' ||
          prev === 'tipo' ||
          prev === 'fralda' ||
          prev === 'luva'
        ) {
          return upper;
        }
      }
      const lower = p.toLowerCase();
      if (idx > 0 && minorPrepositions.has(lower)) return lower;
      if (lower.includes('-')) {
        return lower
          .split('-')
          .map((seg, segIdx) => {
            if (!seg) return '';
            if (segIdx > 0 && (seg === 'on' || minorPrepositions.has(seg))) {
              return seg;
            }
            return seg[0].toUpperCase() + seg.slice(1);
          })
          .join('-');
      }
      return lower[0].toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function extractItemIndex(line: string): number | undefined {
  const match =
    /^\s*(?:item|it|cod|cód)?\s*#?\s*(\d{1,4})(?![,.]\d|[a-zA-ZÀ-ÿ])(?:\s|$|[.):/-])/i.exec(
      line,
    );
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
  let pendingSefazDetail: {
    qty: number;
    unit: string;
    unitPrice: number | null;
  } | null = null;

  const priceRegex = /(\d{1,3}(?:\.\d{3})*[,.]\d{2})\b/g;
  const qtyMultiplierRegex =
    /(\d+(?:[,.]\d+)?)\s*(un|und|unid|kg|g|l|lt|ml|pc|pct|cx|emb|dz|fd|bdj)?\s*[xX*]\s*(\d+[,.]\d{2,4})/i;
  const sefazDetailRegex =
    /\b(?:qtde?|quant(?:idade)?)\.?\s*:?\s*\d|\bvl\.?\s*unit\.?\s*:|\bun\s*:\s*[a-z]{1,6}\b/i;
  const sefazItemTotalLabelRegex =
    /^\s*v(?:l|lr)?\.?\s*total\s*:?\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*[,.]\d{2})?\s*$/i;
  const trailingTabularQtyRegex =
    /\s+(\d+(?:[,.]\d+)?)\s+(un|und|unid|pc|pct|cx|dz|bdj|fd)(?:\s+(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*[,.]\d{2,4}))?\s*$/i;
  const trailingWeightQtyRegex =
    /\s+(\d+[,.]\d{2,4})\s*(kg|g|l|lt|ml)(?:\s+(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*[,.]\d{2,4}))?\s*$/i;
  const trailingAttachedUnitQtyRegex =
    /\s+(\d+[,.]\d{3,4}|0\d{1,2})\s*(un|und|unid|pc|pct|cx)(?:\s+(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*[,.]\d{2,4}))?\s*$/i;

  const getPendingDetail = () => pendingSefazDetail;

  const flushPendingSefazDetail = () => {
    const detail = pendingSefazDetail;
    if (
      pendingProductName &&
      !isTotalProductName(pendingProductName) &&
      detail?.unitPrice != null &&
      detail.unitPrice > 0
    ) {
      const qty = detail.qty > 0 ? detail.qty : 1.0;
      const total = Number((detail.unitPrice * qty).toFixed(2));
      if (total > 0 && total < 10000) {
        items.push({
          name: pendingProductName,
          price: total,
          unitPrice: detail.unitPrice,
          quantity: qty,
          unit: detail.unit || 'un',
          category: CategoryClassifier.classify(pendingProductName),
          itemIndex: pendingItemIndex,
        });
      }
    }
    pendingProductName = null;
    pendingItemIndex = undefined;
    pendingSefazDetail = null;
  };

  for (const line of lines) {
    const rawLine = repairOcrPricesInLine(line);

    // Handle SEFAZ copied "Vl. Total" / "Vl. Total: 29,94" line for an active pending item
    const itemTotalMatch = sefazItemTotalLabelRegex.exec(rawLine);
    if (itemTotalMatch && pendingProductName && !isTotalProductName(pendingProductName)) {
      const priceStr = itemTotalMatch[1];
      const activeDetail = getPendingDetail();
      if (priceStr) {
        const parsedTotal = AppFormatters.parsePrice(priceStr);
        if (parsedTotal != null && parsedTotal > 0 && parsedTotal < 10000) {
          const qty = activeDetail?.qty && activeDetail.qty > 0 ? activeDetail.qty : 1.0;
          const unit = activeDetail?.unit || 'un';
          const unitPrice =
            activeDetail?.unitPrice ??
            (qty > 0 ? Number((parsedTotal / qty).toFixed(4)) : parsedTotal);
          items.push({
            name: pendingProductName,
            price: parsedTotal,
            unitPrice,
            quantity: qty,
            unit,
            category: CategoryClassifier.classify(pendingProductName),
            itemIndex: pendingItemIndex,
          });
          pendingProductName = null;
          pendingItemIndex = undefined;
          pendingSefazDetail = null;
        }
      }
      continue;
    }

    if (
      shouldIgnoreReceiptLine(rawLine) ||
      isReceiptTotalOrSummaryLine(rawLine)
    ) {
      flushPendingSefazDetail();
      continue;
    }

    // Handle SEFAZ pasted detail lines (single-line or multi-line: "Qtde.: 2 UN: UN Vl. Unit.: 4,50 Vl. Total: 9,00")
    if (sefazDetailRegex.test(rawLine)) {
      const metaStart = rawLine.search(
        /\b(?:qtde?|quant(?:idade)?\.?\s*:|un\s*:|vl\.?\s*unit\.?\s*:|vl\.?\s*total\s*:)/i,
      );
      const beforeMeta = metaStart > 0 ? rawLine.slice(0, metaStart).trim() : '';
      const leadingName = beforeMeta ? cleanReceiptProductName(beforeMeta) : '';

      if (leadingName.length >= 2 && !isTotalProductName(leadingName)) {
        flushPendingSefazDetail();
        pendingProductName = leadingName;
        pendingItemIndex = extractItemIndex(beforeMeta);
      }

      if (pendingProductName && !isTotalProductName(pendingProductName)) {
        const prevDetail = getPendingDetail();
        let qty: number = prevDetail?.qty ?? 1.0;
        let unit: string = prevDetail?.unit ?? 'un';
        let unitPrice: number | null = prevDetail?.unitPrice ?? null;

        const qm = /(?:qtde?|quant(?:idade)?)\.?:?\s*(\d+(?:[,.]\d+)?)/i.exec(rawLine);
        if (qm) {
          const pq = AppFormatters.parseQuantity(qm[1], unit);
          if (pq != null && pq > 0) qty = pq;
        }
        const um = /\bun\s*:\s*([a-zA-ZÀ-ÿ]+)/i.exec(rawLine);
        if (um) {
          unit = AppFormatters.normalizeUnit(um[1]);
          if (qm) {
            const pq = AppFormatters.parseQuantity(qm[1], unit);
            if (pq != null && pq > 0) qty = pq;
          }
        }
        const upm = /vl\.?\s*unit\.?:?\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*[,.]\d{2,4})/i.exec(rawLine);
        if (upm) {
          const parsedUp = AppFormatters.parsePrice(upm[1]);
          if (parsedUp != null && parsedUp > 0) unitPrice = parsedUp;
        }

        const totm = /vl\.?\s*total\.?:?\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*[,.]\d{2})/i.exec(rawLine);
        if (totm) {
          const parsedTotal = AppFormatters.parsePrice(totm[1]);
          if (parsedTotal != null && parsedTotal > 0 && parsedTotal < 10000) {
            const effectiveTotal =
              qty > 1 && unitPrice != null && parsedTotal <= unitPrice
                ? Number((unitPrice * qty).toFixed(2))
                : parsedTotal;
            items.push({
              name: pendingProductName,
              price: effectiveTotal,
              unitPrice:
                unitPrice ??
                (qty > 0 ? Number((effectiveTotal / qty).toFixed(4)) : effectiveTotal),
              quantity: qty > 0 ? qty : 1.0,
              unit: unit || 'un',
              category: CategoryClassifier.classify(pendingProductName),
              itemIndex: pendingItemIndex,
            });
            pendingProductName = null;
            pendingItemIndex = undefined;
            pendingSefazDetail = null;
            continue;
          }
        }

        pendingSefazDetail = { qty, unit, unitPrice };
      }
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
          const unitStr = AppFormatters.normalizeUnit(qtyMatch[2] ?? 'un');
          const parsedQty =
            AppFormatters.parseQuantity(qtyMatch[1], unitStr) ?? 1.0;
          const itemIdx = pendingItemIndex ?? extractItemIndex(rawLine);
          const parsedUnitPrice = qtyMatch[3]
            ? AppFormatters.parsePrice(qtyMatch[3])
            : null;
          const effectiveTotalPrice =
            parsedQty > 1 &&
            parsedUnitPrice != null &&
            (parsedPrice <= parsedUnitPrice || matches.length === 1)
              ? Number((parsedUnitPrice * parsedQty).toFixed(2))
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
          pendingSefazDetail = null;
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

      let parsedQty = pendingSefazDetail?.qty ?? 1.0;
      let parsedUnit = pendingSefazDetail?.unit ?? 'un';
      let parsedUnitPrice: number | null = pendingSefazDetail?.unitPrice ?? null;
      if (qtyMatch && qtyMatch.index < (firstMatch.index ?? 0)) {
        beforePrices = rawLine.slice(0, qtyMatch.index).trim();
        parsedUnit = AppFormatters.normalizeUnit(qtyMatch[2] ?? 'un');
        parsedQty =
          AppFormatters.parseQuantity(qtyMatch[1], parsedUnit) ?? 1.0;
        if (qtyMatch[3]) {
          parsedUnitPrice = AppFormatters.parsePrice(qtyMatch[3]);
        }
      } else {
        // Tabular receipt line without 'x': "ARROZ CAMIL 5KG 2 UN 25,90 51,80" or "LEITE 1L 2,0000 UN 4,5000 9,00"
        const tabMatch =
          trailingTabularQtyRegex.exec(beforePrices) ??
          trailingAttachedUnitQtyRegex.exec(beforePrices) ??
          (priceMatches.length >= 2 || /\d+[,.]\d{2,4}\s*$/.test(beforePrices)
            ? trailingWeightQtyRegex.exec(beforePrices)
            : null);
        if (tabMatch) {
          const u = AppFormatters.normalizeUnit(tabMatch[2]);
          const q = AppFormatters.parseQuantity(tabMatch[1], u);
          if (q != null && q > 0) {
            parsedQty = q;
            parsedUnit = u;
            beforePrices = beforePrices.slice(0, tabMatch.index).trim();
            if (tabMatch[3]) {
              const up = AppFormatters.parsePrice(tabMatch[3]);
              if (up != null && up > 0) parsedUnitPrice = up;
            } else if (priceMatches.length >= 2) {
              parsedUnitPrice = AppFormatters.parsePrice(firstMatch[1]);
            }
          }
        }
      }

      const lineItemIdx = extractItemIndex(rawLine) ?? pendingItemIndex;
      const cleanedName = cleanReceiptProductName(beforePrices);

      if (parsedPrice != null && parsedPrice > 0 && parsedPrice < 10000) {
        const effectiveTotalPrice =
          parsedQty > 1 &&
          parsedUnitPrice != null &&
          parsedPrice <= parsedUnitPrice
            ? Number((parsedUnitPrice * parsedQty).toFixed(2))
            : parsedPrice;
        const effectiveUnitPrice =
          parsedUnitPrice ??
          (parsedQty > 0
            ? effectiveTotalPrice / parsedQty
            : effectiveTotalPrice);

        if (cleanedName.length >= 2 && !isTotalProductName(cleanedName)) {
          flushPendingSefazDetail();
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
          pendingSefazDetail = null;
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
          pendingSefazDetail = null;
          continue;
        }
      }
    }

    const candidateName = cleanReceiptProductName(rawLine);
    if (candidateName.length >= 3 && !isTotalProductName(candidateName)) {
      flushPendingSefazDetail();
      pendingProductName = candidateName;
      pendingItemIndex = extractItemIndex(rawLine);
      pendingSefazDetail = null;
    }
  }

  flushPendingSefazDetail();

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

    const maxDim = 2200;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return imgUrl;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    try {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const contrast = 1.45;
      for (let i = 0; i < data.length; i += 4) {
        const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const boosted = Math.max(0, Math.min(255, (luma - 128) * contrast + 128));
        data[i] = boosted;
        data[i + 1] = boosted;
        data[i + 2] = boosted;
      }
      ctx.putImageData(imageData, 0, 0);
    } catch {
      // Fallback if tainted canvas
    }

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
