import 'dart:async';
import 'dart:convert';
import 'dart:io';
import '../utils/formatters.dart';
import 'category_classifier.dart';
import 'receipt_scanner_service.dart';

class NfceParsedResult {
  NfceParsedResult({
    required this.items,
    this.marketName,
    this.cnpj,
    this.accessKey,
    this.date,
    this.totalAmount,
    this.stateUf,
    this.errorMessage,
    this.rawHtml,
  });

  final List<ScannedReceiptItem> items;
  final String? marketName;
  final String? cnpj;
  final String? accessKey;
  final DateTime? date;
  final double? totalAmount;
  final String? stateUf;
  final String? errorMessage;
  final String? rawHtml;

  bool get isSuccess => items.isNotEmpty;
}

class NfceInputValidationResult {
  const NfceInputValidationResult({
    this.isValid = false,
    this.statusMessage,
    this.accessKey,
    this.url,
    this.uf,
  });

  final bool isValid;
  final String? statusMessage;
  final String? accessKey;
  final String? url;
  final String? uf;
}

class NfceScannerService {
  static const Map<String, String> _ufByCode = {
    '11': 'RO',
    '12': 'AC',
    '13': 'AM',
    '14': 'RR',
    '15': 'PA',
    '16': 'AP',
    '17': 'TO',
    '21': 'MA',
    '22': 'PI',
    '23': 'CE',
    '24': 'RN',
    '25': 'PB',
    '26': 'PE',
    '27': 'AL',
    '28': 'SE',
    '29': 'BA',
    '31': 'MG',
    '32': 'ES',
    '33': 'RJ',
    '35': 'SP',
    '41': 'PR',
    '42': 'SC',
    '43': 'RS',
    '50': 'MS',
    '51': 'MT',
    '52': 'GO',
    '53': 'DF',
  };

  static const Map<String, String> _ufNames = {
    'AC': 'Acre',
    'AL': 'Alagoas',
    'AP': 'Amapá',
    'AM': 'Amazonas',
    'BA': 'Bahia',
    'CE': 'Ceará',
    'DF': 'Distrito Federal',
    'ES': 'Espírito Santo',
    'GO': 'Goiás',
    'MA': 'Maranhão',
    'MT': 'Mato Grosso',
    'MS': 'Mato Grosso do Sul',
    'MG': 'Minas Gerais',
    'PA': 'Pará',
    'PB': 'Paraíba',
    'PR': 'Paraná',
    'PE': 'Pernambuco',
    'PI': 'Piauí',
    'RJ': 'Rio de Janeiro',
    'RN': 'Rio Grande do Norte',
    'RS': 'Rio Grande do Sul',
    'RO': 'Rondônia',
    'RR': 'Roraima',
    'SC': 'Santa Catarina',
    'SP': 'São Paulo',
    'SE': 'Sergipe',
    'TO': 'Tocantins',
  };

  static bool _isValidUfCode(String code) => _ufByCode.containsKey(code);

  /// Returns full friendly name of a Brazilian state given its 2-letter UF.
  static String? getStateName(String? uf) {
    if (uf == null) return null;
    return _ufNames[uf.toUpperCase()];
  }

  /// Extracts a 44-digit access key from a raw string, URL or OCR text.
  static String? extractAccessKey(String rawInput) {
    if (rawInput.trim().isEmpty) return null;
    var text = rawInput.replaceAll('\u00A0', ' ').trim();

    // Decode URL if percent encoded
    if (text.contains('%')) {
      try {
        text = Uri.decodeComponent(text);
      } catch (_) {}
    }

    // 1. Chave de acesso inside URL param (p=, chNFe=, chave=, chaveDeAcesso=, nfe=)
    final paramMatch = RegExp(
      r'[?&](?:p|chNFe|chave|chaveDeAcesso|nfe)=([0-9]{44})(?:[|%&]|$)',
      caseSensitive: false,
    ).firstMatch(text);
    if (paramMatch != null) {
      final key = paramMatch.group(1)!;
      if (_isValidUfCode(key.substring(0, 2))) return key;
    }

    // 2. Direct 44 consecutive digits
    final directMatches = RegExp(r'\b(\d{44})\b').allMatches(text);
    for (final m in directMatches) {
      final candidate = m.group(1)!;
      if (_isValidUfCode(candidate.substring(0, 2))) return candidate;
    }
    if (directMatches.isNotEmpty) return directMatches.first.group(1);

    // 3. 11 groups of 4 digits (e.g. "5326 1104 9720 9200 6163 6520 2000 2167 9411 9768 4255")
    final spacedMatch = RegExp(
      r'\b\d{4}(?:[\s\.\-]+[0-9]{4}){10}\b',
      caseSensitive: false,
    ).firstMatch(text);
    if (spacedMatch != null) {
      final keyDigits = spacedMatch.group(0)!.replaceAll(RegExp(r'\D'), '');
      if (keyDigits.length == 44 && _isValidUfCode(keyDigits.substring(0, 2))) {
        return keyDigits;
      }
    }

    // 4. Preceded by keywords like "chave de acesso" or "nfc-e"
    final keywordMatch = RegExp(
      r'(?:chave(?:(?:\s+de)?\s+acesso)?|nfc-?e)[\s:]*([0-9\s\.\-]{44,60})',
      caseSensitive: false,
    ).firstMatch(text);
    if (keywordMatch != null) {
      final digits = keywordMatch.group(1)!.replaceAll(RegExp(r'\D'), '');
      if (digits.length == 44 && _isValidUfCode(digits.substring(0, 2))) {
        return digits;
      }
      if (digits.length >= 44) {
        final sub = digits.substring(0, 44);
        if (_isValidUfCode(sub.substring(0, 2))) return sub;
      }
    }

    // 5. Look for any 44-digit sequence with a valid UF in all extracted digits
    final allDigits = text.replaceAll(RegExp(r'\D'), '');
    if (allDigits.length == 44 && _isValidUfCode(allDigits.substring(0, 2))) {
      return allDigits;
    }
    if (allDigits.length > 44) {
      for (int i = 0; i <= allDigits.length - 44; i++) {
        final slice = allDigits.substring(i, i + 44);
        if (_isValidUfCode(slice.substring(0, 2))) {
          return slice;
        }
      }
    }

    return null;
  }

  /// Extracts a valid SEFAZ NFC-e QR code URL from a string or clipboard input.
  static String? extractSefazUrl(String rawInput) {
    if (rawInput.trim().isEmpty) return null;
    var text = rawInput.trim();

    // Strip enclosing quotes, brackets, parentheses
    text = text.replaceAll(RegExp(r'^["\x27<(\[]+|["\x27>)\]]+$'), '').trim();

    // If input lacks scheme but starts with a known government portal domain
    if (!text.startsWith('http://') && !text.startsWith('https://')) {
      final domainMatch = RegExp(
        r'^((?:www\.)?(?:[a-zA-Z0-9-]+\.)*(?:fazenda|sefaz|sefin|receita|portalsped|satsp|dec\.fazenda)[a-zA-Z0-9-._~:/?#\[\]@!$&()*+,;=%|]+)',
        caseSensitive: false,
      ).firstMatch(text);
      if (domainMatch != null) {
        text = 'https://${domainMatch.group(1)}';
      }
    }

    if (text.startsWith('http://') || text.startsWith('https://')) {
      return _cleanTrailingUrlPunctuation(text);
    }

    final urlRegex = RegExp(r'https?://[^\s<>"]+');
    final matches = urlRegex.allMatches(rawInput);
    for (final m in matches) {
      final candidate = _cleanTrailingUrlPunctuation(m.group(0)!);
      final lower = candidate.toLowerCase();
      if (lower.contains('fazenda') ||
          lower.contains('sefaz') ||
          lower.contains('sefin') ||
          lower.contains('nfce') ||
          lower.contains('nfe') ||
          lower.contains('satsp') ||
          lower.contains('comsat') ||
          lower.contains('.gov.br') ||
          lower.contains('p=')) {
        return candidate;
      }
    }
    if (matches.isNotEmpty) {
      return _cleanTrailingUrlPunctuation(matches.first.group(0)!);
    }
    return null;
  }

  static String _cleanTrailingUrlPunctuation(String url) {
    return url.replaceAll(RegExp(r'[.,;:!?)\]\>]+$'), '');
  }

  /// Extracts UF State from a 44-digit access key.
  static String? getUfFromAccessKey(String key) {
    if (key.length < 2) return null;
    final code = key.substring(0, 2);
    return _ufByCode[code];
  }

  /// Formats CNPJ from key (digits 6 to 20).
  static String? getCnpjFromAccessKey(String key) {
    if (key.length < 20) return null;
    final cnpjRaw = key.substring(6, 20);
    if (cnpjRaw.length == 14) {
      return '${cnpjRaw.substring(0, 2)}.${cnpjRaw.substring(2, 5)}.${cnpjRaw.substring(5, 8)}/${cnpjRaw.substring(8, 12)}-${cnpjRaw.substring(12, 14)}';
    }
    return cnpjRaw;
  }

  /// Validates pasted/typed NFC-e URL or access key and produces user-friendly feedback.
  static NfceInputValidationResult validateInput(String rawInput) {
    final text = rawInput.trim();
    if (text.isEmpty) {
      return const NfceInputValidationResult();
    }

    final key = extractAccessKey(text);
    final url = extractSefazUrl(text);

    if (url != null) {
      final uf = key != null ? getUfFromAccessKey(key) : null;
      final ufName = uf != null ? getStateName(uf) : null;
      return NfceInputValidationResult(
        isValid: true,
        url: url,
        accessKey: key,
        uf: uf,
        statusMessage: ufName != null
            ? '✓ Link SEFAZ identificado ($ufName - $uf)'
            : '✓ Link SEFAZ identificado',
      );
    }

    if (key != null) {
      final uf = getUfFromAccessKey(key);
      final ufName = uf != null ? getStateName(uf) : null;
      return NfceInputValidationResult(
        isValid: true,
        accessKey: key,
        uf: uf,
        statusMessage: ufName != null
            ? '✓ Chave de acesso válida ($ufName - $uf)'
            : '✓ Chave de 44 dígitos válida',
      );
    }

    final digits = text.replaceAll(RegExp(r'\D'), '');
    if (digits.isNotEmpty && digits.length < 44) {
      return NfceInputValidationResult(
        isValid: false,
        statusMessage: '${digits.length} de 44 dígitos digitados',
      );
    }

    return const NfceInputValidationResult(
      isValid: false,
      statusMessage: 'Formato não reconhecido',
    );
  }

  /// Fetches the NFC-e web page and parses its items, market name, and totals.
  static Future<NfceParsedResult> fetchAndParseNfce(String urlOrKey) async {
    final cleanInput = urlOrKey.trim();
    String? accessKey = extractAccessKey(cleanInput);
    String? targetUrl = extractSefazUrl(cleanInput);

    // If input is purely a 44-digit key without URL, we construct state-specific portal URL
    if (targetUrl == null && accessKey != null) {
      targetUrl = buildPortalUrlFromKey(accessKey);
    }

    if (targetUrl == null) {
      return NfceParsedResult(
        items: [],
        accessKey: accessKey,
        errorMessage:
            'Não foi possível identificar uma URL válida de NFC-e ou chave de 44 dígitos.',
      );
    }

    try {
      final html = await _downloadHtml(targetUrl);
      if (html == null || html.trim().isEmpty) {
        return NfceParsedResult(
          items: [],
          accessKey: accessKey,
          stateUf: accessKey != null ? getUfFromAccessKey(accessKey) : null,
          cnpj: accessKey != null ? getCnpjFromAccessKey(accessKey) : null,
          errorMessage:
              'Não foi possível obter os dados da SEFAZ. O portal exige resolução de Captcha contra robôs. Recomendamos usar a "Foto do Cupom" (OCR offline) logo abaixo.',
        );
      }

      final parsed = parseNfceHtml(html, fallbackKey: accessKey);
      return parsed;
    } catch (e) {
      return NfceParsedResult(
        items: [],
        accessKey: accessKey,
        stateUf: accessKey != null ? getUfFromAccessKey(accessKey) : null,
        errorMessage: 'Erro ao consultar a SEFAZ: $e',
      );
    }
  }

  /// Resolves a full SEFAZ URL from either a direct URL, QR Code content, or 44-digit key.
  static String? resolveUrlFromInput(String rawInput) {
    final clean = rawInput.trim();
    final url = extractSefazUrl(clean);
    if (url != null) return url;
    final key = extractAccessKey(clean);
    if (key != null) return buildPortalUrlFromKey(key);
    return null;
  }

  /// Builds a state-specific SEFAZ query URL from a 44-digit access key.
  static String? buildPortalUrlFromKey(String key) {
    final uf = getUfFromAccessKey(key);
    switch (uf) {
      case 'AC':
        return 'http://sefaz.ac.gov.br/nfce/qrcode?p=$key|2|1|1|';
      case 'AL':
        return 'http://nfce.sefaz.al.gov.br/consultaNFCe.aspx?p=$key|2|1|1|';
      case 'AM':
        return 'http://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp?p=$key|2|1|1|';
      case 'AP':
        return 'https://www.sefaz.ap.gov.br/nfce/qrcode?p=$key|2|1|1|';
      case 'BA':
        return 'http://nfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx?p=$key|2|1|1|';
      case 'CE':
        return 'http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p=$key|2|1|1|';
      case 'DF':
        return 'https://dec.fazenda.df.gov.br/ConsultarNFCe.aspx?p=$key|2|1|1|';
      case 'ES':
        return 'http://app.sefaz.es.gov.br/ConsultaNFCe/qrcode.aspx?p=$key|2|1|1|';
      case 'GO':
        return 'http://www.sefaz.go.gov.br/nfce/qrcode?p=$key|2|1|1|';
      case 'MA':
        return 'http://www.sefaz.ma.gov.br/nfce/qrcode?p=$key|2|1|1|';
      case 'MG':
        return 'https://nfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml?p=$key|2|1|1|';
      case 'MS':
        return 'http://www.dfe.ms.gov.br/nfce/qrcode?p=$key|2|1|1|';
      case 'MT':
        return 'http://www.sefaz.mt.gov.br/nfce/consultanfce?p=$key|2|1|1|';
      case 'PA':
        return 'https://appnfc.sefa.pa.gov.br/portal/view/consultas/nfce/nfceForm.faces?p=$key|2|1|1|';
      case 'PB':
        return 'https://www.sefaz.pb.gov.br/nfce?p=$key|2|1|1|';
      case 'PE':
        return 'http://nfce.sefaz.pe.gov.br/nfce-web/consultarNFCe?p=$key|2|1|1|';
      case 'PI':
        return 'https://www.sefaz.pi.gov.br/nfce/qrcode?p=$key|2|1|1|';
      case 'PR':
        return 'http://www.fazenda.pr.gov.br/nfce/qrcode?p=$key|2|1|1|';
      case 'RJ':
        return 'http://www.fazenda.rj.gov.br/nfc-e/qrcode?p=$key|2|1|1|';
      case 'RN':
        return 'http://nfce.set.rn.gov.br/consultarNFCe.aspx?p=$key|2|1|1|';
      case 'RO':
        return 'http://www.sefin.ro.gov.br/nfce/qrcode?p=$key|2|1|1|';
      case 'RR':
        return 'https://www.sefaz.rr.gov.br/nfce/servlet/qrcode?p=$key|2|1|1|';
      case 'RS':
        return 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=$key|2|1|1|';
      case 'SC':
        return 'https://sat.sef.sc.gov.br/nfce/consulta?p=$key|2|1|1|';
      case 'SE':
        return 'http://www.nfe.se.gov.br/portal/consultarNFCe.jsp?p=$key|2|1|1|';
      case 'SP':
        return 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaPublica.aspx?p=$key|2|1|1|';
      case 'TO':
        return 'http://www.sefaz.to.gov.br/nfce/qrcode?p=$key|2|1|1|';
      default:
        return 'https://www.fazenda.pr.gov.br/nfce/qrcode?p=$key|2|1|1|';
    }
  }

  static Future<String?> _downloadHtml(String url) async {
    final client = HttpClient();
    client.connectionTimeout = const Duration(seconds: 12);
    // Ignore SSL certificate discrepancies often found in governmental test endpoints
    client.badCertificateCallback =
        (X509Certificate cert, String host, int port) => true;

    try {
      final uri = Uri.parse(url);
      final request = await client.getUrl(uri);
      request.headers.set(
        HttpHeaders.userAgentHeader,
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      );
      request.headers.set(HttpHeaders.acceptHeader,
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
      request.headers.set(HttpHeaders.acceptLanguageHeader, 'pt-BR,pt;q=0.9');

      final response = await request.close();
      if (response.statusCode >= 200 && response.statusCode < 400) {
        final bytes = await response.fold<List<int>>(
          <int>[],
          (prev, elem) => prev..addAll(elem),
        );

        // Try UTF-8 first, fallback to Latin1 / Windows-1252
        try {
          return utf8.decode(bytes);
        } catch (_) {
          return latin1.decode(bytes);
        }
      }
      return null;
    } finally {
      client.close();
    }
  }

  /// Merges identical items across SEFAZ rows (same name, unit, unit price, and product code when present).
  static List<ScannedReceiptItem> mergeDuplicateItems(
    List<ScannedReceiptItem> items,
  ) =>
      ReceiptScannerService.mergeDuplicateItems(items);

  /// Parses raw HTML from any state's NFC-e portal (SP, RS, PR, MG, RJ, BA, etc.)
  static NfceParsedResult parseNfceHtml(String html, {String? fallbackKey}) {
    final items = <ScannedReceiptItem>[];

    // 1. Extract Market / Establishment Name
    String? marketName = _extractMarketName(html);

    // 2. Extract Date of Purchase
    DateTime? purchaseDate = _extractPurchaseDate(html);

    // 3. Extract Access Key if embedded in HTML
    final keyMatch = extractAccessKey(html) ?? fallbackKey;

    // 4. Extract Total Amount
    double? totalAmount = _extractTotalAmount(html);

    // 5. Parse Item Rows
    // Approach A: Standard DANFE NFC-e layout (DF, GO, TO, MT, MS, etc.)
    items.addAll(_parseTableDanfe(html));

    // Approach B: São Paulo (SP) & SAT NFC-e structure
    if (items.isEmpty) {
      items.addAll(_parseTableLayoutSp(html));
    }

    // Approach C: Standard ENCAT / RS / PR / MG table layout
    if (items.isEmpty) {
      items.addAll(_parseTableLayoutStandard(html));
    }

    // Approach D: Generic fallback
    if (items.isEmpty) {
      items.addAll(_parseTableGeneric(html));
    }

    final mergedItems = mergeDuplicateItems(items);

    return NfceParsedResult(
      items: mergedItems,
      marketName: marketName,
      cnpj: keyMatch != null ? getCnpjFromAccessKey(keyMatch) : null,
      accessKey: keyMatch,
      date: purchaseDate,
      totalAmount: totalAmount,
      stateUf: keyMatch != null ? getUfFromAccessKey(keyMatch) : null,
      rawHtml: html,
      errorMessage: mergedItems.isEmpty
          ? 'Nenhum item pôde ser extraído da página. O portal da SEFAZ pode requerer Captcha. Recomendamos usar a "Foto do Cupom" (OCR offline) logo abaixo.'
          : null,
    );
  }

  static String? _extractMarketName(String html) {
    // 1. Look for <div class="col" style="font-weight: bold;"> inside card-header or #heading1 (DF Accordion)
    final cardHeaderMatch = RegExp(
      r'card-header[^>]*>.*?<div[^>]*class="col"[^>]*style="[^"]*font-weight:\s*bold[^"]*"[^>]*>(.*?)</div>',
      dotAll: true,
      caseSensitive: false,
    ).firstMatch(html);
    if (cardHeaderMatch != null) {
      final clean = _stripTags(cardHeaderMatch.group(1)!).trim();
      if (clean.length > 2 &&
          !clean.toLowerCase().contains('consumidor') &&
          !clean.toLowerCase().contains('chave')) {
        return clean;
      }
    }

    // 2. Look right before CNPJ: xx.xxx.xxx/xxxx-xx (standard DANFE NFC-e header, e.g. DF)
    final cnpjPrevMatch = RegExp(
      r'([^\n<>]{3,80})[\s\r\n]*(?:<[^>]*>[\s\r\n]*)*CNPJ:\s*(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})',
      caseSensitive: false,
    ).firstMatch(html);
    if (cnpjPrevMatch != null) {
      final clean = _stripTags(cnpjPrevMatch.group(1)!).trim();
      final lower = clean.toLowerCase();
      if (clean.length > 2 &&
          !lower.contains('documento') &&
          !lower.contains('danfe') &&
          !lower.contains('consulta') &&
          !lower.contains('eletrônica') &&
          !lower.contains('consumidor')) {
        return clean;
      }
    }

    // 3. Look for <div class="txtTopo"> or class="empresa" or <h3>
    final topoMatch =
        RegExp(r'<div[^>]*class="[^"]*txtTopo[^"]*"[^>]*>(.*?)</div>', dotAll: true)
            .firstMatch(html);
    if (topoMatch != null) {
      final clean = _stripTags(topoMatch.group(1)!);
      if (clean.length > 2) return clean;
    }

    final h3Match = RegExp(r'<h3[^>]*>(.*?)</h3>', dotAll: true).firstMatch(html);
    if (h3Match != null) {
      final clean = _stripTags(h3Match.group(1)!);
      if (clean.length > 2 && !clean.toLowerCase().contains('consulta')) {
        return clean;
      }
    }

    final boldMatch =
        RegExp(r'<b[^>]*class="[^"]*razaoSocial[^"]*"[^>]*>(.*?)</b>', dotAll: true)
            .firstMatch(html);
    if (boldMatch != null) {
      return _stripTags(boldMatch.group(1)!);
    }

    return null;
  }

  static DateTime? _extractPurchaseDate(String html) {
    // Looks for "dd/mm/yyyy hh:mm:ss" or "dd/mm/yyyy"
    final dateMatch =
        RegExp(r'(\d{2})/(\d{2})/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?')
            .firstMatch(html);
    if (dateMatch != null) {
      final day = int.tryParse(dateMatch.group(1)!) ?? 1;
      final month = int.tryParse(dateMatch.group(2)!) ?? 1;
      final year = int.tryParse(dateMatch.group(3)!) ?? DateTime.now().year;
      final hour = int.tryParse(dateMatch.group(4) ?? '12') ?? 12;
      final min = int.tryParse(dateMatch.group(5) ?? '00') ?? 0;
      final sec = int.tryParse(dateMatch.group(6) ?? '00') ?? 0;
      return DateTime(year, month, day, hour, min, sec);
    }
    return null;
  }

  static double? _extractTotalAmount(String html) {
    // 1. Strip tags first to prevent CSS class numbers (e.g., col-8, col-4) from interfering
    final plainText = _stripTags(html);
    final totalMatch = RegExp(
      r'(?:valor\s+a\s+pagar|valor\s+total|total\s+a\s+pagar|vPag)[^0-9]*?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})',
      caseSensitive: false,
    ).firstMatch(plainText);
    if (totalMatch != null) {
      return AppFormatters.parsePrice(totalMatch.group(1)!);
    }

    // 2. Fallback on raw html
    final rawMatch = RegExp(
      r'(?:valor\s+a\s+pagar|valor\s+total|total\s+a\s+pagar|vPag)[^0-9]*?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})',
      caseSensitive: false,
    ).firstMatch(html);
    if (rawMatch != null) {
      return AppFormatters.parsePrice(rawMatch.group(1)!);
    }
    return null;
  }

  /// Parses standard DANFE NFC-e layout (used by DF, GO, MT, MS, TO, etc.)
  /// Supports Bootstrap accordion list-group-items, tables, and multi-line structures.
  static List<ScannedReceiptItem> _parseTableDanfe(String html) {
    final items = <ScannedReceiptItem>[];

    // Method 1: Target Bootstrap NFC-e <li class="list-group-item"> containers (SEFAZ-DF)
    final liRegex = RegExp(
      r'<li[^>]*class="[^"]*list-group-item[^"]*"[^>]*>(.*?)</li>',
      dotAll: true,
      caseSensitive: false,
    );
    final liMatches = liRegex.allMatches(html);

    for (final liMatch in liMatches) {
      final liContent = liMatch.group(1)!;
      final liText = _stripTags(liContent);
      final lower = liText.toLowerCase();

      // Must be an item row (contains Qtde. or Vl. Unit.) and NOT summary rows
      if (!lower.contains('qtde') && !lower.contains('vl. unit')) {
        continue;
      }
      if (lower.contains('qtd. total') ||
          lower.contains('valor a pagar') ||
          lower.contains('forma de pagamento') ||
          lower.contains('tributos')) {
        continue;
      }

      // Extract product code if present: e.g. (Cód: 1019816)
      final codeMatch = RegExp(
        r'\(c[óo]d(?:igo)?:\s*(\d+)\)',
        caseSensitive: false,
      ).firstMatch(liText);
      final productCode = codeMatch?.group(1);

      // Product Name: look inside <p class="h6"> or .col-9, stripping <small>
      String? rawName;
      final h6Match = RegExp(
        r'<p[^>]*class="[^"]*h6[^"]*"[^>]*>(.*?)</p>',
        dotAll: true,
        caseSensitive: false,
      ).firstMatch(liContent);

      if (h6Match != null) {
        final withoutSmall = h6Match.group(1)!.replaceAll(
          RegExp(r'<small[^>]*>.*?</small>', dotAll: true, caseSensitive: false),
          '',
        );
        rawName = _stripTags(withoutSmall);
      } else {
        final col9Match = RegExp(
          r'<div[^>]*class="[^"]*col-9[^"]*"[^>]*>(.*?)</div>',
          dotAll: true,
          caseSensitive: false,
        ).firstMatch(liContent);
        if (col9Match != null) {
          rawName = _stripTags(col9Match.group(1)!);
        }
      }

      // Price: look for .col-3 or .col-4 price span, or last price in li
      double? price;
      final col3Matches = RegExp(
        r'<div[^>]*class="[^"]*col-(?:3|4)[^"]*"[^>]*>(.*?)</div>',
        dotAll: true,
        caseSensitive: false,
      ).allMatches(liContent);

      for (final col3 in col3Matches.toList().reversed) {
        final col3Text = _stripTags(col3.group(1)!);
        final pMatch = RegExp(r'(\d{1,3}(?:\.\d{3})*,\d{2})').firstMatch(col3Text);
        if (pMatch != null) {
          final candidate = AppFormatters.parsePrice(pMatch.group(1)!);
          if (candidate != null && candidate > 0) {
            price = candidate;
            break;
          }
        }
      }

      if (price == null || price <= 0) {
        final allPrices = RegExp(r'(\d{1,3}(?:\.\d{3})*,\d{2})').allMatches(liText);
        if (allPrices.isNotEmpty) {
          price = AppFormatters.parsePrice(allPrices.last.group(1)!);
        }
      }

      // Explicit Unit Price (Vl. Unit.: XX,XX)
      double? unitPrice;
      final uvMatch = RegExp(
        r'vl\.?\s*unit\.?:?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})',
        caseSensitive: false,
      ).firstMatch(liText);
      if (uvMatch != null) {
        unitPrice = AppFormatters.parsePrice(uvMatch.group(1)!);
      }

      // Quantity & Unit extraction (from stripped plain text so <strong> doesn't break labels)
      String unit = 'un';
      final uMatch = RegExp(
        r'\bUN\s*:\s*([a-zA-Z]{1,4})\b',
        caseSensitive: false,
      ).firstMatch(liText);
      if (uMatch != null) {
        unit = AppFormatters.normalizeUnit(uMatch.group(1)!);
      }

      double quantity = 1.0;
      final qMatch = RegExp(
        r'(?:qtde|qtd|quant|quantidade)\.?:?\s*(\d+(?:[,\.]\d+)?)',
        caseSensitive: false,
      ).firstMatch(liText);
      if (qMatch != null) {
        final parsedQ = AppFormatters.parseQuantity(qMatch.group(1)!, unit: unit);
        if (parsedQ != null && parsedQ > 0) {
          quantity = parsedQ;
        }
      }

      if (rawName != null && price != null && price > 0) {
        final cleanName = _cleanNfceProductName(rawName);
        if (cleanName.length >= 2) {
          items.add(
            ScannedReceiptItem(
              name: cleanName,
              price: price,
              quantity: quantity > 0 ? quantity : 1.0,
              unit: unit,
              unitPrice: unitPrice,
              productCode: productCode,
              category: CategoryClassifier.classify(cleanName),
            ),
          );
        }
      }
    }

    if (items.isNotEmpty) return items;

    // Method 2: Scan generic block containers (<tr...>, <div...>) with Vl. Total
    final danfeLineRegex = RegExp(
      r'([^\n<>]+?)(?:\s*\(c[óo]d(?:igo)?:\s*(\d+)\))?\s+Vl\.\s*Total:?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})',
      caseSensitive: false,
    );

    final blockRegex =
        RegExp(r'<(?:tr|div|p)[^>]*>(.*?)</(?:tr|div|p)>', dotAll: true);
    final blocks = blockRegex.allMatches(html).toList();

    for (var b = 0; b < blocks.length; b++) {
      final block = blocks[b];
      final blockText = _stripTags(block.group(1)!);
      if (!blockText.toLowerCase().contains('vl. total') &&
          !blockText.toLowerCase().contains('vl.total')) {
        continue;
      }

      final lower = blockText.toLowerCase();
      if (lower.contains('qtd. total') ||
          lower.contains('valor a pagar') ||
          lower.contains('forma de pagamento') ||
          lower.contains('tributos')) {
        continue;
      }

      final match = danfeLineRegex.firstMatch(blockText);
      if (match != null) {
        final rawName = match.group(1)!.trim();
        final productCode = match.group(2);
        final priceStr = match.group(3)!;
        final price = AppFormatters.parsePrice(priceStr);

        double quantity = 1.0;
        String unit = 'un';

        final qText = blockText.toLowerCase().contains('qtde')
            ? blockText
            : (b + 1 < blocks.length ? _stripTags(blocks[b + 1].group(1)!) : '');
        final uMatch = RegExp(
          r'\bUN\s*:\s*([a-zA-Z]{1,4})\b',
          caseSensitive: false,
        ).firstMatch(qText);
        if (uMatch != null) {
          unit = AppFormatters.normalizeUnit(uMatch.group(1)!);
        }

        final qMatch = RegExp(
          r'(?:qtde|qtd|quant|quantidade)\.?:?\s*(\d+(?:[,\.]\d+)?)',
          caseSensitive: false,
        ).firstMatch(qText);
        if (qMatch != null) {
          final parsedQ = AppFormatters.parseQuantity(qMatch.group(1)!, unit: unit);
          if (parsedQ != null && parsedQ > 0) {
            quantity = parsedQ;
          }
        }

        double? unitPrice;
        final uvMatch = RegExp(
          r'vl\.?\s*unit\.?:?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})',
          caseSensitive: false,
        ).firstMatch(qText);
        if (uvMatch != null) {
          unitPrice = AppFormatters.parsePrice(uvMatch.group(1)!);
        }

        final cleanedName = _cleanNfceProductName(rawName);
        if (cleanedName.length >= 2 && price != null && price > 0) {
          items.add(
            ScannedReceiptItem(
              name: cleanedName,
              price: price,
              quantity: quantity > 0 ? quantity : 1.0,
              unit: unit,
              unitPrice: unitPrice,
              productCode: productCode,
              category: CategoryClassifier.classify(cleanedName),
            ),
          );
        }
      }
    }

    // Method 3: Multi-line plain text scanning
    if (items.isEmpty) {
      final plainText = _stripTags(html);
      final rawLines = plainText.split(RegExp(r'[\r\n]+')).map((l) => l.trim()).where((l) => l.isNotEmpty).toList();

      for (var i = 0; i < rawLines.length; i++) {
        final line = rawLines[i];
        final lower = line.toLowerCase();

        if (lower.contains('qtde') || lower.contains('vl. unit')) {
          // Find price on this line or line i+1
          double? price;
          final pMatchNext = (i + 1 < rawLines.length) ? RegExp(r'^(\d{1,3}(?:\.\d{3})*,\d{2})$').firstMatch(rawLines[i + 1]) : null;
          if (pMatchNext != null) {
            price = AppFormatters.parsePrice(pMatchNext.group(1)!);
          } else {
            final pMatchThis = RegExp(r'(\d{1,3}(?:\.\d{3})*,\d{2})').allMatches(line);
            if (pMatchThis.isNotEmpty) {
              price = AppFormatters.parsePrice(pMatchThis.last.group(1)!);
            }
          }

          double? unitPrice;
          final uvMatch = RegExp(
            r'vl\.?\s*unit\.?:?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})',
            caseSensitive: false,
          ).firstMatch(line);
          if (uvMatch != null) {
            unitPrice = AppFormatters.parsePrice(uvMatch.group(1)!);
          }

          String unit = 'un';
          final um = RegExp(
            r'\bUN\s*:\s*([a-zA-Z]{1,4})\b',
            caseSensitive: false,
          ).firstMatch(line);
          if (um != null) {
            unit = AppFormatters.normalizeUnit(um.group(1)!);
          }

          // Quantity & Unit extraction from line
          double quantity = 1.0;
          final qm = RegExp(
            r'(?:qtde|qtd|quant|quantidade)\.?:?\s*(\d+(?:[,\.]\d+)?)',
            caseSensitive: false,
          ).firstMatch(line);
          if (qm != null) {
            final parsedQ = AppFormatters.parseQuantity(qm.group(1)!, unit: unit);
            if (parsedQ != null && parsedQ > 0) {
              quantity = parsedQ;
            }
          }

          // Find product name: if line i-1 is "Vl. Total", then name is at line i-2
          String? candidateName;
          if (i >= 2 && rawLines[i - 1].toLowerCase().contains('total')) {
            candidateName = rawLines[i - 2];
          } else if (i >= 1) {
            candidateName = rawLines[i - 1];
          }

          if (candidateName != null && price != null && price > 0) {
            final cLower = candidateName.toLowerCase();
            if (!cLower.contains('documento') &&
                !cLower.contains('consumidor') &&
                !cLower.contains('cnpj') &&
                !cLower.contains('danfe')) {
              final codeMatch = RegExp(
                r'\(c[óo]d(?:igo)?:\s*(\d+)\)',
                caseSensitive: false,
              ).firstMatch(candidateName);
              final productCode = codeMatch?.group(1);

              final cleanedName = _cleanNfceProductName(candidateName);
              if (cleanedName.length >= 2) {
                items.add(
                  ScannedReceiptItem(
                    name: cleanedName,
                    price: price,
                    quantity: quantity > 0 ? quantity : 1.0,
                    unit: unit,
                    unitPrice: unitPrice,
                    productCode: productCode,
                    category: CategoryClassifier.classify(cleanedName),
                  ),
                );
              }
            }
          }
        }
      }
    }

    return items;
  }

  /// Parses São Paulo (SP) & SAT NFC-e structure:
  /// <span class="txtTit">PRODUTO</span> ... <span class="Rqtd">Qtde.: 1</span> ... <span class="valor">10,50</span>
  static List<ScannedReceiptItem> _parseTableLayoutSp(String html) {
    final items = <ScannedReceiptItem>[];
    // Find all item containers: <tr id="Item + ..."> or rows containing txtTit
    final rowRegex = RegExp(r'<tr[^>]*>.*?</tr>', dotAll: true);
    final rows = rowRegex.allMatches(html);

    for (final row in rows) {
      final rowHtml = row.group(0)!;
      if (!rowHtml.contains('txtTit')) continue;

      final titleMatch =
          RegExp(r'<span[^>]*class="[^"]*txtTit[^"]*"[^>]*>(.*?)</span>',
                  dotAll: true)
              .firstMatch(rowHtml);
      final priceMatch = RegExp(
              r'<span[^>]*class="[^"]*valor[^"]*"[^>]*>(.*?)</span>',
              dotAll: true)
          .firstMatch(rowHtml);

      String unit = 'un';
      final runMatch = RegExp(
        r'<span[^>]*class="[^"]*RUN[^"]*"[^>]*>(.*?)</span>',
        dotAll: true,
        caseSensitive: false,
      ).firstMatch(rowHtml);
      if (runMatch != null) {
        unit = AppFormatters.normalizeUnit(_stripTags(runMatch.group(1)!));
      }

      double quantity = 1.0;
      final qtdMatch = RegExp(
        r'<span[^>]*class="[^"]*Rqtd[^"]*"[^>]*>(.*?)</span>',
        dotAll: true,
        caseSensitive: false,
      ).firstMatch(rowHtml);
      if (qtdMatch != null) {
        final qText = _stripTags(qtdMatch.group(1)!);
        final qm = RegExp(r'(\d+(?:[,\.]\d+)?)').firstMatch(qText);
        if (qm != null) {
          final parsedQ = AppFormatters.parseQuantity(qm.group(1)!, unit: unit);
          if (parsedQ != null && parsedQ > 0) {
            quantity = parsedQ;
          }
        }
      }

      double? unitPrice;
      final rvlUnitMatch = RegExp(
        r'<span[^>]*class="[^"]*RvlUnit[^"]*"[^>]*>(.*?)</span>',
        dotAll: true,
        caseSensitive: false,
      ).firstMatch(rowHtml);
      if (rvlUnitMatch != null) {
        final uText = _stripTags(rvlUnitMatch.group(1)!);
        final uPm = RegExp(r'(\d{1,3}(?:\.\d{3})*,\d{2})').firstMatch(uText);
        if (uPm != null) {
          unitPrice = AppFormatters.parsePrice(uPm.group(1)!);
        }
      }

      String? productCode;
      final rCodMatch = RegExp(
        r'<span[^>]*class="[^"]*RCod[^"]*"[^>]*>(.*?)</span>',
        dotAll: true,
        caseSensitive: false,
      ).firstMatch(rowHtml);
      if (rCodMatch != null) {
        final cDigits = RegExp(r'(\d+)').firstMatch(_stripTags(rCodMatch.group(1)!));
        productCode = cDigits?.group(1);
      }

      if (titleMatch != null && priceMatch != null) {
        final rawName = _stripTags(titleMatch.group(1)!);
        final priceStr = _stripTags(priceMatch.group(1)!);
        final price = AppFormatters.parsePrice(priceStr);

        final cleanedName = _cleanNfceProductName(rawName);
        if (cleanedName.isNotEmpty && price != null && price > 0) {
          items.add(
            ScannedReceiptItem(
              name: cleanedName,
              price: price,
              quantity: quantity > 0 ? quantity : 1.0,
              unit: unit,
              unitPrice: unitPrice,
              productCode: productCode,
              category: CategoryClassifier.classify(cleanedName),
            ),
          );
        }
      }
    }

    return items;
  }

  /// Parses Standard ENCAT / RS / PR / MG table layout
  static List<ScannedReceiptItem> _parseTableLayoutStandard(String html) {
    final items = <ScannedReceiptItem>[];
    final rowRegex = RegExp(r'<tr[^>]*id="Item[^"]*"[^>]*>(.*?)</tr>', dotAll: true);
    final rows = rowRegex.allMatches(html);

    for (final row in rows) {
      final rowHtml = row.group(1)!;

      // Product name in <span class="txtTit"> or <td class="fixo-prod-nome">
      final nameMatch = RegExp(
        r'<(?:span|td)[^>]*class="[^"]*(?:txtTit|fixo-prod-nome|descricao)[^"]*"[^>]*>(.*?)</(?:span|td)>',
        dotAll: true,
      ).firstMatch(rowHtml);

      // Price in <span class="valor"> or <td class="fixo-prod-vl-total">
      final priceMatch = RegExp(
        r'<(?:span|td)[^>]*class="[^"]*(?:valor|fixo-prod-vl-total)[^"]*"[^>]*>(.*?)</(?:span|td)>',
        dotAll: true,
      ).firstMatch(rowHtml);

      String unit = 'un';
      final runMatch = RegExp(
        r'<(?:span|td)[^>]*class="[^"]*(?:RUN|fixo-prod-un|unidade)[^"]*"[^>]*>(.*?)</(?:span|td)>',
        dotAll: true,
        caseSensitive: false,
      ).firstMatch(rowHtml);
      if (runMatch != null) {
        unit = AppFormatters.normalizeUnit(_stripTags(runMatch.group(1)!));
      }

      double quantity = 1.0;
      final qtdMatch = RegExp(
        r'<(?:span|td)[^>]*class="[^"]*(?:Rqtd|fixo-prod-qtd|qtd)[^"]*"[^>]*>(.*?)</(?:span|td)>',
        dotAll: true,
        caseSensitive: false,
      ).firstMatch(rowHtml);
      if (qtdMatch != null) {
        final qText = _stripTags(qtdMatch.group(1)!);
        final qm = RegExp(r'(\d+(?:[,\.]\d+)?)').firstMatch(qText);
        if (qm != null) {
          final parsedQ = AppFormatters.parseQuantity(qm.group(1)!, unit: unit);
          if (parsedQ != null && parsedQ > 0) {
            quantity = parsedQ;
          }
        }
      }

      double? unitPrice;
      final rvlUnitMatch = RegExp(
        r'<(?:span|td)[^>]*class="[^"]*(?:RvlUnit|fixo-prod-vl-unit)[^"]*"[^>]*>(.*?)</(?:span|td)>',
        dotAll: true,
        caseSensitive: false,
      ).firstMatch(rowHtml);
      if (rvlUnitMatch != null) {
        final uText = _stripTags(rvlUnitMatch.group(1)!);
        final uPm = RegExp(r'(\d{1,3}(?:\.\d{3})*,\d{2})').firstMatch(uText);
        if (uPm != null) {
          unitPrice = AppFormatters.parsePrice(uPm.group(1)!);
        }
      }

      String? productCode;
      final rCodMatch = RegExp(
        r'<(?:span|td)[^>]*class="[^"]*(?:RCod|fixo-prod-cod)[^"]*"[^>]*>(.*?)</(?:span|td)>',
        dotAll: true,
        caseSensitive: false,
      ).firstMatch(rowHtml);
      if (rCodMatch != null) {
        final cDigits = RegExp(r'(\d+)').firstMatch(_stripTags(rCodMatch.group(1)!));
        productCode = cDigits?.group(1);
      }

      if (nameMatch != null && priceMatch != null) {
        final rawName = _stripTags(nameMatch.group(1)!);
        final priceStr = _stripTags(priceMatch.group(1)!);
        final price = AppFormatters.parsePrice(priceStr);

        final cleanedName = _cleanNfceProductName(rawName);
        if (cleanedName.isNotEmpty && price != null && price > 0) {
          items.add(
            ScannedReceiptItem(
              name: cleanedName,
              price: price,
              quantity: quantity > 0 ? quantity : 1.0,
              unit: unit,
              unitPrice: unitPrice,
              productCode: productCode,
              category: CategoryClassifier.classify(cleanedName),
            ),
          );
        }
      }
    }

    return items;
  }

  /// Generic fallback parsing any table row with name + decimal price
  static List<ScannedReceiptItem> _parseTableGeneric(String html) {
    final items = <ScannedReceiptItem>[];
    final rowRegex = RegExp(r'<tr[^>]*>(.*?)</tr>', dotAll: true);
    final rows = rowRegex.allMatches(html);

    final priceRegex = RegExp(r'(\d{1,3}(?:\.\d{3})*,\d{2})\b');

    for (final row in rows) {
      final rowHtml = row.group(1)!;
      final text = _stripTags(rowHtml).trim();
      if (text.isEmpty) continue;

      final lower = text.toLowerCase();
      if (lower.contains('total') ||
          lower.contains('desconto') ||
          lower.contains('tributo') ||
          lower.contains('troco') ||
          lower.contains('forma')) {
        continue;
      }

      final matches = priceRegex.allMatches(text).toList();
      if (matches.isNotEmpty) {
        final lastPriceStr = matches.last.group(1)!;
        final price = AppFormatters.parsePrice(lastPriceStr);

        String unit = 'un';
        final uMatch = RegExp(
          r'\bUN\s*:\s*([a-zA-Z]{1,4})\b',
          caseSensitive: false,
        ).firstMatch(text);
        if (uMatch != null) {
          unit = AppFormatters.normalizeUnit(uMatch.group(1)!);
        }

        double quantity = 1.0;
        final qMatch = RegExp(
          r'(?:qtde|qtd|quant|quantidade)\.?:?\s*(\d+(?:[,\.]\d+)?)',
          caseSensitive: false,
        ).firstMatch(text);
        if (qMatch != null) {
          final parsedQ = AppFormatters.parseQuantity(qMatch.group(1)!, unit: unit);
          if (parsedQ != null && parsedQ > 0) {
            quantity = parsedQ;
          }
        }

        // Name is the string before the first price
        final firstMatch = matches.first;
        final nameSection = text.substring(0, firstMatch.start).trim();
        final cleanedName = _cleanNfceProductName(nameSection);

        if (cleanedName.length >= 2 && price != null && price > 0 && price < 10000) {
          items.add(
            ScannedReceiptItem(
              name: cleanedName,
              price: price,
              quantity: quantity > 0 ? quantity : 1.0,
              unit: unit,
              category: CategoryClassifier.classify(cleanedName),
            ),
          );
        }
      }
    }

    return items;
  }

  static String _stripTags(String html) {
    var s = html.replaceAll(RegExp(r'<[^>]*>'), ' ');
    // HTML entities
    s = s.replaceAll('&nbsp;', ' ');
    s = s.replaceAll('&amp;', '&');
    s = s.replaceAll('&lt;', '<');
    s = s.replaceAll('&gt;', '>');
    s = s.replaceAll('&quot;', '"');
    s = s.replaceAll('&#39;', "'");
    s = s.replaceAll(RegExp(r'\s+'), ' ').trim();
    return s;
  }

  static String _cleanNfceProductName(String raw) => cleanNfceProductName(raw);

  /// Cleans and sanitizes product names extracted from NFC-e pages and raw strings:
  /// - Removes (Cód: 70), (Código: 12345), (Cod: 123)
  /// - Removes leading item indexes (e.g. "001 7891234567890 ", "01 ")
  /// - Removes trailing tax flags and fiscal tokens (F1, T18%, I1, N1, etc.)
  /// - Standardizes volume/weight package units (e.g. 1,5L, 2L, 500ml, 5kg, 100g)
  /// - Capitalizes words into Title Case nicely
  static String cleanNfceProductName(String raw) {
    var s = raw;
    // 1. Remove (Cód: 70), (Código: 12345), (Cod: 123) anywhere
    s = s.replaceAll(
      RegExp(r'\s*\(c[óo]d(?:igo)?:\s*\d+\)\s*', caseSensitive: false),
      ' ',
    );
    // 2. Remove leading item codes like (Código: 12345) or 001 08871124
    s = s.replaceFirst(RegExp(r'^\s*\(?código:[^\)]*\)?\s*', caseSensitive: false), '');
    s = s.replaceFirst(RegExp(r'^\s*\d{1,4}\s+\d{4,14}\s+'), '');
    s = s.replaceFirst(RegExp(r'^\s*\d{1,14}[\s\.\-]+'), '');

    // 3. Remove trailing fiscal flags (F1, T19,00%, II, FF, NN)
    s = s.replaceAll(
      RegExp(r'\b(?:F\d+|T\d+(?:[,\.]\d+)?%?|I\d+|N\d+|II|FF|NN)\b.*$', caseSensitive: false),
      '',
    );

    // 4. Standardize volume/weight unit tokens before capitalization:
    // "1,5 L" or "1.5l" -> "1,5L", "2 L" or "2l" -> "2L", "500 ML" -> "500ml", "5 KG" -> "5kg"
    s = s.replaceAllMapped(
      RegExp(r'\b(\d+(?:[,\.]\d+)?)\s*(l|lt|lts|litros?)\b', caseSensitive: false),
      (m) => '${m.group(1)!.replaceAll('.', ',')}L',
    );
    s = s.replaceAllMapped(
      RegExp(r'\b(\d+)\s*(ml|mls)\b', caseSensitive: false),
      (m) => '${m.group(1)}ml',
    );
    s = s.replaceAllMapped(
      RegExp(r'\b(\d+(?:[,\.]\d+)?)\s*(kg|kilos?|quilos?)\b', caseSensitive: false),
      (m) => '${m.group(1)!.replaceAll('.', ',')}kg',
    );
    s = s.replaceAllMapped(
      RegExp(r'\b(\d+)\s*(g|gr|grs|gramas?)\b', caseSensitive: false),
      (m) => '${m.group(1)}g',
    );

    // 5. Expand abbreviations (e.g. "lt" -> "leite", "cr lt" -> "creme de leite", "am" -> "amaciante")
    s = CategoryClassifier.expandAbbreviations(s);

    // 6. Capitalize words nicely
    s = s.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (s.isEmpty) return '';

    final words = s.split(' ');
    final formatted = words.map((w) {
      if (w.isEmpty) return '';
      // Preserve uppercase L for liters: e.g. 1,5L, 2L, 1L
      if (RegExp(r'^\d+(?:[,\.]\d+)?L$').hasMatch(w)) {
        return w;
      }
      // Preserve ml, kg, g
      if (RegExp(r'^\d+(?:[,\.]\d+)?(?:ml|kg|g)$', caseSensitive: false).hasMatch(w)) {
        return w.toLowerCase();
      }
      final lower = w.toLowerCase();
      return lower[0].toUpperCase() + lower.substring(1);
    }).join(' ');

    return formatted;
  }
}
