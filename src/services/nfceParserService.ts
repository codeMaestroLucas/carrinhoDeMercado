import type { NfceParsedResult, ScannedReceiptItem } from '../types/shopping';
import { AppFormatters } from '../utils/formatters';
import { CategoryClassifier } from './categoryClassifier';
import {
  accumulateScannedItems,
  cleanReceiptProductName,
  isTotalProductName,
} from './receiptParserService';

const UF_BY_CODE: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
  '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR',
  '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};

export function verifyCheckDigit(key: string): boolean {
  if (key.length !== 44) return false;
  const weights = [2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;
  let weightIdx = 0;
  for (let i = 42; i >= 0; i--) {
    const digit = Number.parseInt(key[i], 10);
    if (Number.isNaN(digit)) return false;
    sum += digit * weights[weightIdx % weights.length];
    weightIdx++;
  }
  const remainder = sum % 11;
  const expectedDv = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
  return Number.parseInt(key[43], 10) === expectedDv;
}

function scoreAccessKey(key: string): number {
  if (key.length !== 44) return 0;
  let score = 10;
  if (key.slice(0, 2) in UF_BY_CODE) score += 30;
  const model = key.slice(20, 22);
  if (model === '65' || model === '59' || model === '55') score += 30;
  if (verifyCheckDigit(key)) score += 50;
  return score;
}

export function extractAccessKey(rawInput: string): string | null {
  const candidates = new Set<string>();

  for (const m of rawInput.matchAll(/\b(\d{44})\b/g)) {
    candidates.add(m[1]);
  }

  const paramMatch = /[?&]p=([0-9]{44})/.exec(rawInput);
  if (paramMatch) candidates.add(paramMatch[1]);

  const spacedMatch = /\b\d{4}(?:[\s.-]+?\d{4}){10}\b/i.exec(rawInput);
  if (spacedMatch) {
    const keyDigits = spacedMatch[0].replace(/\D/g, '');
    if (keyDigits.length === 44) candidates.add(keyDigits);
  }

  const lines = rawInput.split('\n').map((l) => l.trim());
  for (let i = 0; i < lines.length; i++) {
    const lineUpper = lines[i].toUpperCase();
    if (
      lineUpper.includes('CHAVE') ||
      lineUpper.includes('ACESSO') ||
      lineUpper.includes('CONSULTA')
    ) {
      let buffer = '';
      for (let j = i; j < lines.length && j <= i + 4; j++) {
        const subline = lines[j];
        if (j > i) {
          const upper = subline.toUpperCase();
          if (
            upper.startsWith('PROTOCOLO') ||
            upper.startsWith('CNPJ') ||
            upper.startsWith('CONSUMIDOR') ||
            upper.startsWith('VALOR') ||
            upper.startsWith('EMISSAO') ||
            upper.startsWith('DATA')
          ) {
            break;
          }
        }

        let cleaned = subline;
        if (j === i) {
          const upper = subline.toUpperCase();
          const maxIdx = Math.max(
            upper.lastIndexOf('ACESSO') !== -1
              ? upper.lastIndexOf('ACESSO') + 6
              : -1,
            upper.lastIndexOf('CHAVE') !== -1
              ? upper.lastIndexOf('CHAVE') + 5
              : -1,
            upper.lastIndexOf('CONSULTA') !== -1
              ? upper.lastIndexOf('CONSULTA') + 8
              : -1,
          );
          cleaned = maxIdx !== -1 && maxIdx < subline.length ? subline.slice(maxIdx) : '';
        }

        cleaned = cleaned
          .replace(/[OoQD]/g, '0')
          .replace(/[lI|!]/g, '1')
          .replace(/[Ss]/g, '5')
          .replace(/[Zz]/g, '2')
          .replace(/b/g, '6')
          .replace(/B/g, '8');

        buffer += cleaned.replace(/\D/g, '');
      }

      if (buffer.length === 44) candidates.add(buffer);
      else if (buffer.length > 44) candidates.add(buffer.slice(0, 44));
    }
  }

  const cleanOCR = rawInput
    .replace(/[Oo]/g, '0')
    .replace(/[lI|]/g, '1');
  const blocks = Array.from(cleanOCR.matchAll(/\b\d{4}\b/g)).map((m) => m[0]);
  if (blocks.length >= 11) {
    for (let i = 0; i <= blocks.length - 11; i++) {
      const candidate = blocks.slice(i, i + 11).join('');
      if (candidate.length === 44) candidates.add(candidate);
    }
  }

  if (rawInput.length <= 160) {
    const cleanDigits = cleanOCR.replace(/\D/g, '');
    if (cleanDigits.length === 44) candidates.add(cleanDigits);
    else {
      const sub44 = /\d{44}/.exec(cleanDigits);
      if (sub44) candidates.add(sub44[0]);
    }
  }

  if (candidates.size === 0) return null;

  let bestScore = -1;
  let bestKey: string | null = null;
  for (const cand of candidates) {
    const score = scoreAccessKey(cand);
    if (score > bestScore) {
      bestScore = score;
      bestKey = cand;
    }
  }
  return bestKey;
}

export function extractSefazUrl(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (
    (trimmed.startsWith('http://') || trimmed.startsWith('https://')) &&
    !trimmed.includes('\n') &&
    !trimmed.includes(' ')
  ) {
    return trimmed;
  }

  const lines = rawInput
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const lineNoSpace = lines[i].replace(/\s+/g, '').toLowerCase();
    if (
      lineNoSpace.includes('fazenda') ||
      lineNoSpace.includes('sefaz') ||
      lineNoSpace.includes('nfce') ||
      lineNoSpace.includes('.gov.br') ||
      lineNoSpace.includes('satsp') ||
      lineNoSpace.includes('comsat') ||
      lineNoSpace.includes('dfe-portal')
    ) {
      const urlParts = [lines[i]];
      for (let j = i + 1; j < lines.length && j <= i + 4; j++) {
        const nextLine = lines[j];
        const upper = nextLine.toUpperCase();
        if (
          upper.startsWith('CHAVE') ||
          upper.startsWith('PROTOCOLO') ||
          upper.startsWith('CNPJ') ||
          upper.startsWith('CONSUMIDOR') ||
          upper.startsWith('VALOR') ||
          upper.startsWith('TOTAL') ||
          upper.startsWith('EMISSAO') ||
          upper.startsWith('DATA')
        ) {
          break;
        }
        if (
          nextLine.includes('/') ||
          nextLine.includes('?') ||
          nextLine.includes('=') ||
          nextLine.includes('|') ||
          nextLine.includes('&') ||
          nextLine.includes('%') ||
          /^[0-9a-zA-Z|]+$/.test(nextLine.replace(/\s+/g, ''))
        ) {
          urlParts.push(nextLine);
        } else {
          break;
        }
      }

      let joined = urlParts.join('').replace(/\s+/g, '');
      const startsWithHttp = urlParts[0].toLowerCase().startsWith('http://');
      joined = joined.replace(/^https?:\/\//i, '');
      let finalUrl = `${startsWithHttp ? 'http://' : 'https://'}${joined}`;
      finalUrl = finalUrl.replace(
        /[^a-zA-Z0-9_\-.:/?#[\]@!$&'()*+,;=|%]+$/,
        '',
      );
      return finalUrl;
    }
  }

  for (const m of rawInput.matchAll(/https?:\/\/[^\s<>"]+/gi)) {
    const candidate = m[0];
    const lower = candidate.toLowerCase();
    if (
      lower.includes('fazenda') ||
      lower.includes('sefaz') ||
      lower.includes('nfce') ||
      lower.includes('nfe') ||
      lower.includes('satsp') ||
      lower.includes('comsat') ||
      lower.includes('.gov.br') ||
      lower.includes('dfe-portal') ||
      lower.includes('p=')
    ) {
      return candidate;
    }
  }

  const noProtoMatch =
    /\b(?:www\.)?([a-zA-Z0-9.-]+\.(?:gov\.br|fazenda\.[a-z]{2}\.gov\.br|sefaz\.[a-z]{2}\.gov\.br)[^\s<>"]*)/i.exec(
      rawInput,
    );
  if (noProtoMatch) {
    return `https://${noProtoMatch[0]}`;
  }

  return null;
}

export function getUfFromAccessKey(key: string): string | null {
  if (key.length < 2) return null;
  return UF_BY_CODE[key.slice(0, 2)] ?? null;
}

export function getCnpjFromAccessKey(key: string): string | null {
  if (key.length < 20) return null;
  const cnpjRaw = key.slice(6, 20);
  if (cnpjRaw.length === 14) {
    return `${cnpjRaw.slice(0, 2)}.${cnpjRaw.slice(2, 5)}.${cnpjRaw.slice(5, 8)}/${cnpjRaw.slice(8, 12)}-${cnpjRaw.slice(12, 14)}`;
  }
  return cnpjRaw;
}

export function buildPortalUrlFromKey(key: string): string {
  const uf = getUfFromAccessKey(key);
  switch (uf) {
    case 'SP':
      return `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaPublica.aspx?p=${key}|2|1|1|`;
    case 'RS':
      return `https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=${key}|2|1|1|`;
    case 'PR':
      return `http://www.fazenda.pr.gov.br/nfce/qrcode?p=${key}|2|1|1|`;
    case 'MG':
      return `https://nfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml?p=${key}|2|1|1|`;
    case 'RJ':
      return `http://www.fazenda.rj.gov.br/nfc-e/qrcode?p=${key}|2|1|1|`;
    case 'BA':
      return `http://nfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx?p=${key}|2|1|1|`;
    default:
      return `https://www.fazenda.pr.gov.br/nfce/qrcode?p=${key}|2|1|1|`;
  }
}

export function resolveUrlFromInput(rawInput: string): string | null {
  const clean = rawInput.trim();
  const url = extractSefazUrl(clean);
  if (url) return url;
  const key = extractAccessKey(clean);
  if (key) return buildPortalUrlFromKey(key);
  return null;
}

export function parseNfceQuantity(raw: string): number {
  let s = raw.trim().replace(/[^0-9,.]/g, '');
  if (!s) return 1.0;

  const dotCount = (s.match(/\./g) ?? []).length;
  const commaCount = (s.match(/,/g) ?? []).length;

  if (dotCount === 1 && commaCount === 0) {
    const [intP, decP] = s.split('.');
    return (Number(intP) || 0) + (Number(`0.${decP}`) || 0);
  }
  if (commaCount === 1 && dotCount === 0) {
    const [intP, decP] = s.split(',');
    return (Number(intP) || 0) + (Number(`0.${decP}`) || 0);
  }
  if (dotCount >= 1 && commaCount === 1) {
    const normalized = s.replace(/\./g, '').replace(',', '.');
    return Number(normalized) || 1.0;
  }

  return Number(s.replace(',', '.')) || 1.0;
}

export function cleanNfceProductName(raw: string): string {
  return cleanReceiptProductName(raw);
}

const NAMED_HTML_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  ordm: 'º',
  ordf: 'ª',
  deg: '°',
  ndash: '-',
  mdash: '-',
  aacute: 'á',
  agrave: 'à',
  acirc: 'â',
  atilde: 'ã',
  auml: 'ä',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  euml: 'ë',
  iacute: 'í',
  igrave: 'ì',
  icirc: 'î',
  iuml: 'ï',
  oacute: 'ó',
  ograve: 'ò',
  ocirc: 'ô',
  otilde: 'õ',
  ouml: 'ö',
  uacute: 'ú',
  ugrave: 'ù',
  ucirc: 'û',
  uuml: 'ü',
  ccedil: 'ç',
  ntilde: 'ñ',
  Aacute: 'Á',
  Agrave: 'À',
  Acirc: 'Â',
  Atilde: 'Ã',
  Eacute: 'É',
  Ecirc: 'Ê',
  Iacute: 'Í',
  Oacute: 'Ó',
  Ocirc: 'Ô',
  Otilde: 'Õ',
  Uacute: 'Ú',
  Uuml: 'Ü',
  Ccedil: 'Ç',
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number.parseInt(code, 10);
      return Number.isFinite(n) ? String.fromCharCode(n) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const n = Number.parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCharCode(n) : '';
    })
    .replace(/&([a-zA-Z]+);/g, (full, name: string) => {
      return NAMED_HTML_ENTITIES[name] ?? NAMED_HTML_ENTITIES[name.toLowerCase()] ?? full;
    });
}

function stripTags(html: string): string {
  const withoutTags = html.replace(/<[^>]*>/g, ' ');
  return decodeHtmlEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

function stripTagsPreserveLines(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:tr|div|p|li|td|th|h[1-6])>/gi, '\n');
  const withoutTags = withBreaks.replace(/<[^>]*>/g, ' ');
  return decodeHtmlEntities(withoutTags)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function stripEmbeddedCodeTags(htmlFragment: string): string {
  return htmlFragment
    .replace(/<small[^>]*>[\s\S]*?<\/small>/gi, ' ')
    .replace(
      /<span[^>]*class="[^"]*(?:RCod|fixo-prod-cod|codigo)[^"]*"[^>]*>[\s\S]*?<\/span>/gi,
      ' ',
    );
}

export function cleanMarketName(raw: string): string {
  const s = stripTags(raw)
    .replace(/\s*-\s*filial\s*\d+.*$/i, '')
    .replace(/\s*\/\s*filial\s*\d+.*$/i, '')
    .replace(/\s*-\s*matriz.*$/i, '')
    .replace(/\b(?:s\.?a\.?|s\/a|ltda\.?|eireli\.?|me|epp)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const words = s.split(' ');
  const minor = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return words
    .map((w) => {
      const lower = w.toLowerCase();
      if (minor.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function extractMarketName(html: string): string | undefined {
  // 1. Try trade name (Nome Fantasia) first
  const fantasiaMatch =
    /<(?:span|div|td|p|b)[^>]*class="[^"]*(?:txtFantasia|nomeFantasia|fantasia|lblFantasia)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|td|p|b)>/i.exec(
      html,
    );
  if (fantasiaMatch) {
    const clean = stripTags(fantasiaMatch[1]);
    if (clean.length > 2 && !clean.toLowerCase().includes('consumidor')) {
      return clean;
    }
  }

  // 2. Try card-header, txtTopo or preceding CNPJ
  const cardHeaderMatch =
    /card-header[^>]*>[\s\S]*?<div[^>]*class="col"[^>]*style="[^"]*font-weight:\s*bold[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(
      html,
    );
  if (cardHeaderMatch) {
    const clean = stripTags(cardHeaderMatch[1]);
    if (
      clean.length > 2 &&
      !clean.toLowerCase().includes('consumidor') &&
      !clean.toLowerCase().includes('chave')
    ) {
      return clean;
    }
  }

  const cnpjPrevMatch =
    /([^\n<>]{3,80})[\s\r\n]*(?:<[^>]*>[\s\r\n]*)*CNPJ:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i.exec(
      html,
    );
  if (cnpjPrevMatch) {
    const clean = stripTags(cnpjPrevMatch[1]);
    const lower = clean.toLowerCase();
    if (
      clean.length > 2 &&
      !lower.includes('documento') &&
      !lower.includes('danfe') &&
      !lower.includes('consulta') &&
      !lower.includes('eletrônica') &&
      !lower.includes('consumidor')
    ) {
      return clean;
    }
  }

  const topoMatch = /<div[^>]*class="[^"]*txtTopo[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html);
  if (topoMatch) {
    const clean = stripTags(topoMatch[1]);
    if (clean.length > 2) return clean;
  }

  const h3Match = /<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(html);
  if (h3Match) {
    const clean = stripTags(h3Match[1]);
    if (clean.length > 2 && !clean.toLowerCase().includes('consulta')) return clean;
  }

  const boldMatch = /<b[^>]*class="[^"]*razaoSocial[^"]*"[^>]*>([\s\S]*?)<\/b>/i.exec(html);
  if (boldMatch) {
    const clean = stripTags(boldMatch[1]);
    if (clean.length > 2) return clean;
  }

  return undefined;
}

function extractPurchaseDate(html: string): string | undefined {
  const m = /(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(html);
  if (m) {
    const day = Number(m[1]) || 1;
    const month = (Number(m[2]) || 1) - 1;
    const year = Number(m[3]) || new Date().getFullYear();
    const hour = Number(m[4] ?? '12') || 12;
    const min = Number(m[5] ?? '0') || 0;
    const sec = Number(m[6] ?? '0') || 0;
    return new Date(year, month, day, hour, min, sec).toISOString();
  }
  return undefined;
}

function extractTotalAmount(html: string): number | undefined {
  const plainText = stripTags(html);
  const rx =
    /(?:valor\s+a\s+pagar|valor\s+total|total\s+a\s+pagar|vPag)[^0-9]*?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i;
  const totalMatch = rx.exec(plainText) ?? rx.exec(html);
  if (totalMatch) {
    return AppFormatters.parsePrice(totalMatch[1]) ?? undefined;
  }
  return undefined;
}

function buildScannedItem(
  rawName: string,
  price: number | null,
  qty: number,
  unit: string,
  unitPrice: number | null,
  itemIndex: number,
): ScannedReceiptItem | null {
  let effectiveTotal = price;
  if (effectiveTotal == null || effectiveTotal <= 0) {
    if (unitPrice != null && unitPrice > 0) effectiveTotal = unitPrice * qty;
  } else if (qty > 1 && unitPrice != null && effectiveTotal <= unitPrice) {
    effectiveTotal = unitPrice * qty;
  }

  if (effectiveTotal == null || effectiveTotal <= 0) return null;

  const effectiveUnitPrice =
    unitPrice ??
    (qty > 0
      ? Number((effectiveTotal / qty).toFixed(4))
      : effectiveTotal);
  const cleanedName = cleanNfceProductName(rawName);
  if (cleanedName.length < 2) return null;
  if (isTotalProductName(cleanedName)) return null;

  return {
    name: cleanedName,
    price: effectiveTotal,
    unitPrice: effectiveUnitPrice,
    quantity: qty > 0 ? qty : 1.0,
    unit: unit ? AppFormatters.normalizeUnit(unit) : 'un',
    category: CategoryClassifier.classify(cleanedName),
    itemIndex,
  };
}

function parseTableLayoutSp(html: string): ScannedReceiptItem[] {
  const items: ScannedReceiptItem[] = [];
  for (const row of html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/gi)) {
    const rowHtml = row[0];
    if (!rowHtml.includes('txtTit')) continue;

    const titleMatch = /<span[^>]*class="[^"]*txtTit[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(rowHtml);
    const priceMatch = /<span[^>]*class="[^"]*valor[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(rowHtml);
    if (!titleMatch || !priceMatch) continue;

    const rawName = stripTags(stripEmbeddedCodeTags(titleMatch[1]));
    const price = AppFormatters.parsePrice(stripTags(priceMatch[1]));

    let qty = 1.0;
    let unit = 'un';
    let unitPrice: number | null = null;

    const qtyMatch = /<span[^>]*class="[^"]*Rqtd[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(rowHtml);
    if (qtyMatch) {
      const qStr = stripTags(qtyMatch[1]).replace(/[^0-9,.]/g, '');
      const parsedQ = parseNfceQuantity(qStr);
      if (parsedQ > 0) qty = parsedQ;
    }

    const unitMatch = /<span[^>]*class="[^"]*RUN[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(rowHtml);
    if (unitMatch) {
      const uStr = stripTags(unitMatch[1]).replace(/UN:\s*/i, '').trim().toLowerCase();
      if (uStr) unit = uStr;
    }

    const unitPriceMatch = /<span[^>]*class="[^"]*RvlUnit[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(rowHtml);
    if (unitPriceMatch) {
      unitPrice = AppFormatters.parsePrice(
        stripTags(unitPriceMatch[1]).replace(/[^0-9,.]/g, ''),
      );
    }

    const item = buildScannedItem(rawName, price, qty, unit, unitPrice, items.length + 1);
    if (item) items.push(item);
  }
  return items;
}

function parseTableLayoutStandard(html: string): ScannedReceiptItem[] {
  const items: ScannedReceiptItem[] = [];
  for (const row of html.matchAll(/<tr[^>]*id="Item[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = row[1];
    const nameMatch =
      /<span[^>]*class="[^"]*(?:txtTit|fixo-prod-nome|descricao)[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(
        rowHtml,
      ) ??
      /<td[^>]*class="[^"]*(?:txtTit|fixo-prod-nome|descricao)[^"]*"[^>]*>([\s\S]*?)<\/td>/i.exec(
        rowHtml,
      );
    const priceMatch =
      /<(?:span|td)[^>]*class="[^"]*(?:valor|fixo-prod-vl-total)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|td)>/i.exec(
        rowHtml,
      );
    if (!nameMatch || !priceMatch) continue;

    const rawName = stripTags(stripEmbeddedCodeTags(nameMatch[1]));
    const price = AppFormatters.parsePrice(stripTags(priceMatch[1]));

    let qty = 1.0;
    let unit = 'un';
    let unitPrice: number | null = null;

    const qtyMatch =
      /<(?:span|td)[^>]*class="[^"]*(?:Rqtd|fixo-prod-qtd)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|td)>/i.exec(
        rowHtml,
      );
    if (qtyMatch) {
      const parsedQ = parseNfceQuantity(
        stripTags(qtyMatch[1]).replace(/[^0-9,.]/g, ''),
      );
      if (parsedQ > 0) qty = parsedQ;
    }

    const unitMatch =
      /<(?:span|td)[^>]*class="[^"]*(?:RUN|fixo-prod-unidade)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|td)>/i.exec(
        rowHtml,
      );
    if (unitMatch) {
      const uStr = stripTags(unitMatch[1]).replace(/UN:\s*/i, '').trim().toLowerCase();
      if (uStr) unit = uStr;
    }

    const unitPriceMatch =
      /<(?:span|td)[^>]*class="[^"]*(?:RvlUnit|fixo-prod-vl-unit)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|td)>/i.exec(
        rowHtml,
      );
    if (unitPriceMatch) {
      unitPrice = AppFormatters.parsePrice(
        stripTags(unitPriceMatch[1]).replace(/[^0-9,.]/g, ''),
      );
    }

    const item = buildScannedItem(rawName, price, qty, unit, unitPrice, items.length + 1);
    if (item) items.push(item);
  }
  return items;
}

function extractDanfeDetails(text: string): {
  qty: number;
  unit: string;
  unitPrice: number | null;
} {
  let qty = 1.0;
  let unit = 'un';
  let unitPrice: number | null = null;

  const qtyMatch = /(?:qtde|qtd|quant|quantidade)\.?:?\s*(\d+(?:[,.]\d+)?)/i.exec(text);
  if (qtyMatch) {
    const pq = parseNfceQuantity(qtyMatch[1]);
    if (pq > 0) qty = pq;
  }
  const unMatch = /\bUN\s*:\s*([A-Za-z]{1,6})\b/i.exec(text);
  if (unMatch) unit = unMatch[1].trim().toLowerCase() || 'un';
  const upMatch = /Vl\.?\s*Unit\.?:?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2,4})/i.exec(text);
  if (upMatch) unitPrice = AppFormatters.parsePrice(upMatch[1]);

  return { qty, unit, unitPrice };
}

function parseTableDanfe(html: string): ScannedReceiptItem[] {
  const items: ScannedReceiptItem[] = [];

  // Method 1: Bootstrap NFC-e <li class="list-group-item"> containers (SEFAZ-DF & modern portals)
  for (const liMatch of html.matchAll(
    /<li[^>]*class="[^"]*list-group-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
  )) {
    const liContent = liMatch[1];
    const liText = stripTags(liContent);
    const lower = liText.toLowerCase();
    if (!lower.includes('qtde') && !lower.includes('vl. unit')) continue;
    if (
      lower.includes('qtd. total') ||
      lower.includes('valor a pagar') ||
      lower.includes('forma de pagamento') ||
      lower.includes('tributos')
    ) {
      continue;
    }

    let rawName: string | undefined;
    const h6Match = /<p[^>]*class="[^"]*h6[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(liContent);
    if (h6Match) {
      rawName = stripTags(stripEmbeddedCodeTags(h6Match[1]));
    } else {
      const col9Match = /<div[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(
        liContent,
      );
      if (col9Match) rawName = stripTags(stripEmbeddedCodeTags(col9Match[1]));
    }
    if (!rawName) continue;

    let price: number | null = null;
    const col3Matches = Array.from(
      liContent.matchAll(/<div[^>]*class="[^"]*col-(?:3|4)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi),
    ).reverse();
    for (const col3 of col3Matches) {
      const pMatch = /(\d{1,3}(?:\.\d{3})*,\d{2})/.exec(stripTags(col3[1]));
      if (pMatch) {
        const cand = AppFormatters.parsePrice(pMatch[1]);
        if (cand != null && cand > 0) {
          price = cand;
          break;
        }
      }
    }
    if (price == null || price <= 0) {
      const allPrices = Array.from(liText.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})/g));
      if (allPrices.length > 0) {
        price = AppFormatters.parsePrice(allPrices[allPrices.length - 1][1]);
      }
    }

    const { qty, unit, unitPrice } = extractDanfeDetails(liText);
    const item = buildScannedItem(rawName, price, qty, unit, unitPrice, items.length + 1);
    if (item) items.push(item);
  }

  if (items.length > 0) return items;

  // Method 2: Generic block containers (<tr>, <div>, <p>) containing Vl. Total
  const danfeLineRegex =
    /([^\n<>]+?)(?:\s*\(c[óo]d(?:igo)?:\s*\d+\))?\s+Vl\.?\s*Total:?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})\b/i;
  for (const block of html.matchAll(/<(?:tr|div|p)[^>]*>([\s\S]*?)<\/(?:tr|div|p)>/gi)) {
    if (/txtTit|fixo-prod-nome/i.test(block[1])) continue;
    const blockText = stripTags(stripEmbeddedCodeTags(block[1]));
    const lower = blockText.toLowerCase();
    if (!lower.includes('vl. total') && !lower.includes('vl.total')) continue;
    if (
      lower.includes('qtd. total') ||
      lower.includes('valor a pagar') ||
      lower.includes('forma de pagamento') ||
      lower.includes('tributos')
    ) {
      continue;
    }

    const match = danfeLineRegex.exec(blockText);
    if (match) {
      const rawName = match[1].replace(/\b(?:qtde?|un|vl\.?\s*unit).*$/i, '').trim();
      const price = AppFormatters.parsePrice(match[2]);
      const { qty, unit, unitPrice } = extractDanfeDetails(blockText);
      const item = buildScannedItem(rawName, price, qty, unit, unitPrice, items.length + 1);
      if (item) items.push(item);
    }
  }

  return items;
}

function parseTableDanfePlainText(html: string): ScannedReceiptItem[] {
  const items: ScannedReceiptItem[] = [];
  const rawLines = stripTagsPreserveLines(html).split('\n');
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const lower = line.toLowerCase();
    if (!lower.includes('qtde') && !lower.includes('vl. unit')) continue;
    if (
      lower.includes('qtd. total') ||
      lower.includes('valor a pagar') ||
      lower.includes('forma de pagamento') ||
      lower.includes('tributos')
    ) {
      continue;
    }

    let price: number | null = null;
    const pMatchNext =
      i + 1 < rawLines.length ? /^(\d{1,3}(?:\.\d{3})*,\d{2})$/.exec(rawLines[i + 1]) : null;
    if (pMatchNext) {
      price = AppFormatters.parsePrice(pMatchNext[1]);
    } else {
      const pMatchThis = Array.from(line.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})\b/g));
      if (pMatchThis.length > 0) {
        price = AppFormatters.parsePrice(pMatchThis[pMatchThis.length - 1][1]);
      }
    }

    const { qty, unit, unitPrice } = extractDanfeDetails(line);
    let candidateName: string | undefined;
    if (i >= 2 && rawLines[i - 1].toLowerCase().includes('total')) {
      candidateName = rawLines[i - 2];
    } else if (i >= 1) {
      candidateName = rawLines[i - 1];
    }

    if (candidateName && price != null && price > 0) {
      const cLower = candidateName.toLowerCase();
      if (
        !cLower.includes('documento') &&
        !cLower.includes('consumidor') &&
        !cLower.includes('cnpj') &&
        !cLower.includes('danfe')
      ) {
        const item = buildScannedItem(
          candidateName,
          price,
          qty,
          unit,
          unitPrice,
          items.length + 1,
        );
        if (item) items.push(item);
      }
    }
  }

  return items;
}

function parseTableGeneric(html: string): ScannedReceiptItem[] {
  const items: ScannedReceiptItem[] = [];
  const priceRegex = /(\d{1,3}(?:\.\d{3})*,\d{2})\b/g;

  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const text = stripTags(stripEmbeddedCodeTags(row[1]));
    if (!text) continue;
    const lower = text.toLowerCase();
    if (
      lower.includes('qtd. total') ||
      lower.includes('valor total') ||
      lower.includes('valor a pagar') ||
      lower.includes('desconto') ||
      lower.includes('tributo') ||
      lower.includes('troco') ||
      lower.includes('forma de pagamento')
    ) {
      continue;
    }

    const matches = Array.from(text.matchAll(priceRegex));
    if (matches.length === 0) continue;

    const lastPriceStr = matches[matches.length - 1][1];
    const price = AppFormatters.parsePrice(lastPriceStr);

    const { qty, unit, unitPrice } = extractDanfeDetails(text);

    const firstPriceIdx = matches[0].index ?? text.length;
    const metaIdx = text.search(/\b(?:qtde?|un\s*:|vl\.?\s*unit|vl\.?\s*total)/i);
    const cutIdx = metaIdx !== -1 && metaIdx < firstPriceIdx ? metaIdx : firstPriceIdx;
    const nameSection = text.slice(0, cutIdx).trim();

    if (price != null && price > 0 && price < 10000) {
      const item = buildScannedItem(
        nameSection,
        price,
        qty,
        unit,
        unitPrice,
        items.length + 1,
      );
      if (item) items.push(item);
    }
  }
  return items;
}

export function parseNfceHtml(
  html: string,
  fallbackKey?: string | null,
): NfceParsedResult {
  let items: ScannedReceiptItem[] = [];

  const marketName = extractMarketName(html);
  const purchaseDate = extractPurchaseDate(html);
  const keyMatch = extractAccessKey(html) ?? fallbackKey ?? undefined;
  const totalAmount = extractTotalAmount(html);

  items = parseTableDanfe(html);
  if (items.length === 0) items = parseTableLayoutSp(html);
  if (items.length === 0) items = parseTableLayoutStandard(html);
  if (items.length === 0) items = parseTableDanfePlainText(html);
  if (items.length === 0) items = parseTableGeneric(html);

  const accumulatedItems = accumulateScannedItems(items);

  return {
    items: accumulatedItems,
    marketName,
    cnpj: keyMatch ? getCnpjFromAccessKey(keyMatch) ?? undefined : undefined,
    accessKey: keyMatch,
    date: purchaseDate,
    totalAmount,
    stateUf: keyMatch ? getUfFromAccessKey(keyMatch) ?? undefined : undefined,
    rawHtml: html,
    errorMessage:
      accumulatedItems.length === 0
        ? 'Nenhum item pôde ser extraído da página. O portal da SEFAZ pode requerer Captcha. Tente colar o conteúdo da nota ou usar a Foto do Cupom (OCR).'
        : undefined,
  };
}

/**
 * Fetches NFC-e via optional proxy endpoint (VITE_NFCE_PROXY_URL).
 * Because browsers block cross-origin SEFAZ iframes/fetches (CORS / X-Frame-Options),
 * a proxy function is used when available; otherwise returns a helpful fallback instruction.
 */
export async function fetchAndParseNfceViaProxy(
  urlOrKey: string,
): Promise<NfceParsedResult> {
  const cleanInput = urlOrKey.trim();
  const accessKey = extractAccessKey(cleanInput) ?? undefined;
  const targetUrl =
    extractSefazUrl(cleanInput) ??
    (accessKey ? buildPortalUrlFromKey(accessKey) : undefined);

  if (!targetUrl) {
    return {
      items: [],
      accessKey,
      errorMessage:
        'Não foi possível identificar uma URL válida de NFC-e ou chave de 44 dígitos.',
    };
  }

  const proxyUrl = import.meta.env.VITE_NFCE_PROXY_URL as string | undefined;
  if (!proxyUrl) {
    return {
      items: [],
      accessKey,
      stateUf: accessKey ? getUfFromAccessKey(accessKey) ?? undefined : undefined,
      cnpj: accessKey ? getCnpjFromAccessKey(accessKey) ?? undefined : undefined,
      errorMessage:
        'Consulta direta à SEFAZ indisponível no navegador por restrição de CORS/Captcha. Abra a nota em nova aba e cole o texto/HTML copiado, ou use a Foto do Cupom (OCR).',
    };
  }

  try {
    const res = await fetch(
      `${proxyUrl}?url=${encodeURIComponent(targetUrl)}`,
      { method: 'GET' },
    );
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const json = (await res.json()) as NfceParsedResult;
      if (Array.isArray(json.items)) {
        json.items = accumulateScannedItems(
          json.items
            .map((it): ScannedReceiptItem | null => {
              const cleaned = cleanNfceProductName(it.name);
              if (cleaned.length < 2 || isTotalProductName(cleaned)) return null;
              return {
                ...it,
                name: cleaned,
                unit: it.unit ? AppFormatters.normalizeUnit(it.unit) : 'un',
                category: CategoryClassifier.classify(cleaned),
              };
            })
            .filter((it): it is ScannedReceiptItem => it !== null),
        );
      }
      return json;
    }
    const html = await res.text();
    return parseNfceHtml(html, accessKey);
  } catch (err) {
    return {
      items: [],
      accessKey,
      stateUf: accessKey ? getUfFromAccessKey(accessKey) ?? undefined : undefined,
      errorMessage: `Não foi possível consultar via proxy SEFAZ (${String(err)}). Use a opção de colar o conteúdo da nota ou Foto do Cupom (OCR).`,
    };
  }
}

export const NfceScannerService = {
  verifyCheckDigit,
  extractAccessKey,
  extractSefazUrl,
  getUfFromAccessKey,
  getCnpjFromAccessKey,
  buildPortalUrlFromKey,
  resolveUrlFromInput,
  parseNfceQuantity,
  cleanNfceProductName,
  parseNfceHtml,
  fetchAndParseNfceViaProxy,
};
