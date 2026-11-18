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

  /// Verifies if a 44-digit access key satisfies the official SEFAZ Modulo 11 check digit (DV).
  static bool verifyCheckDigit(String key) {
    if (key.length != 44) return false;
    const weights = [2, 3, 4, 5, 6, 7, 8, 9];
    var sum = 0;
    var weightIdx = 0;
    for (var i = 42; i >= 0; i--) {
      final digit = int.tryParse(key[i]);
      if (digit == null) return false;
      sum += digit * weights[weightIdx % weights.length];
      weightIdx++;
    }
    final remainder = sum % 11;
    final expectedDv =
        (remainder == 0 || remainder == 1) ? 0 : 11 - remainder;
    return int.tryParse(key[43]) == expectedDv;
  }

  /// Calculates confidence score for a 44-digit key candidate.
  /// Higher score means candidate is more likely to be a valid NFC-e key.
  static int _scoreAccessKey(String key) {
    if (key.length != 44) return 0;
    var score = 10;

    // Check UF code (positions 0-1)
    final ufCode = key.substring(0, 2);
    if (_ufByCode.containsKey(ufCode)) {
      score += 30;
    }

    // Check Model (positions 20-21): 65 (NFC-e), 59 (SAT CF-e), 55 (NF-e)
    final model = key.substring(20, 22);
    if (model == '65' || model == '59' || model == '55') {
      score += 30;
    }

    // Check modulo 11 check digit
    if (verifyCheckDigit(key)) {
      score += 50;
    }

    return score;
  }

  /// Extracts a 44-digit access key from a raw string, URL or OCR text with OCR noise tolerance.
  static String? extractAccessKey(String rawInput) {
    final candidates = <String>{};

    // 1. Direct 44 consecutive digits
    final directMatches = RegExp(r'\b(\d{44})\b').allMatches(rawInput);
    for (final m in directMatches) {
      candidates.add(m.group(1)!);
    }

    // 2. Chave de acesso inside URL param "p=..." (e.g. p=352309...|2|1|1|...)
    final paramMatch = RegExp(r'[?&]p=([0-9]{44})').firstMatch(rawInput);
    if (paramMatch != null) {
      candidates.add(paramMatch.group(1)!);
    }

    // 3. 11 groups of 4 digits (e.g. "5326 1104 9720 9200 6163 6520 2000 2167 9411 9768 4255")
    final spacedMatch = RegExp(
      r'\b\d{4}(?:[\s\.\-]+?\d{4}){10}\b',
      caseSensitive: false,
    ).firstMatch(rawInput);
    if (spacedMatch != null) {
      final keyDigits = spacedMatch.group(0)!.replaceAll(RegExp(r'\D'), '');
      if (keyDigits.length == 44) candidates.add(keyDigits);
    }

    // 4. Targeted search near "CHAVE" or "ACESSO" or "CONSULTA" with OCR character repair
    final lines = rawInput.split('\n').map((l) => l.trim()).toList();
    for (var i = 0; i < lines.length; i++) {
      final lineUpper = lines[i].toUpperCase();
      if (lineUpper.contains('CHAVE') ||
          lineUpper.contains('ACESSO') ||
          lineUpper.contains('CONSULTA')) {
        final buffer = StringBuffer();
        for (var j = i; j < lines.length && j <= i + 4; j++) {
          final subline = lines[j];
          if (j > i) {
            final upper = subline.toUpperCase();
            if (upper.startsWith('PROTOCOLO') ||
                upper.startsWith('CNPJ') ||
                upper.startsWith('CONSUMIDOR') ||
                upper.startsWith('VALOR') ||
                upper.startsWith('EMISSAO') ||
                upper.startsWith('DATA')) {
              break;
            }
          }

          var cleaned = subline;
          if (j == i) {
            final upper = subline.toUpperCase();
            final lastAcesso = upper.lastIndexOf('ACESSO');
            final lastChave = upper.lastIndexOf('CHAVE');
            final lastConsulta = upper.lastIndexOf('CONSULTA');
            final indices = [
              lastAcesso != -1 ? lastAcesso + 6 : -1,
              lastChave != -1 ? lastChave + 5 : -1,
              lastConsulta != -1 ? lastConsulta + 8 : -1,
            ];
            final maxIdx = indices.reduce((a, b) => a > b ? a : b);
            if (maxIdx != -1 && maxIdx < subline.length) {
              cleaned = subline.substring(maxIdx);
            } else {
              cleaned = '';
            }
          }

          // Replace common OCR letter-to-digit confusions
          cleaned = cleaned
              .replaceAll('O', '0')
              .replaceAll('o', '0')
              .replaceAll('Q', '0')
              .replaceAll('D', '0')
              .replaceAll('l', '1')
              .replaceAll('I', '1')
              .replaceAll('|', '1')
              .replaceAll('!', '1')
              .replaceAll('S', '5')
              .replaceAll('s', '5')
              .replaceAll('Z', '2')
              .replaceAll('z', '2')
              .replaceAll('b', '6')
              .replaceAll('B', '8');

          final digitsOnly = cleaned.replaceAll(RegExp(r'\D'), '');
          buffer.write(digitsOnly);
        }

        final combined = buffer.toString();
        if (combined.length == 44) {
          candidates.add(combined);
        } else if (combined.length > 44) {
          candidates.add(combined.substring(0, 44));
        }
      }
    }

    // 5. Look for any sequence of 4-digit blocks separated by spaces/newlines
    final cleanOCR = rawInput
        .replaceAll('O', '0')
        .replaceAll('o', '0')
        .replaceAll('l', '1')
        .replaceAll('I', '1')
        .replaceAll('|', '1');

    final blocks = RegExp(r'\b\d{4}\b')
        .allMatches(cleanOCR)
        .map((m) => m.group(0)!)
        .toList();
    if (blocks.length >= 11) {
      for (var i = 0; i <= blocks.length - 11; i++) {
        final candidate = blocks.sublist(i, i + 11).join('');
        if (candidate.length == 44) {
          candidates.add(candidate);
        }
      }
    }

    // 6. Direct cleaning fallback
    if (rawInput.length <= 160) {
      final cleanDigits = cleanOCR.replaceAll(RegExp(r'\D'), '');
      if (cleanDigits.length == 44) {
        candidates.add(cleanDigits);
      } else {
        final sub44 = RegExp(r'\d{44}').firstMatch(cleanDigits);
        if (sub44 != null) candidates.add(sub44.group(0)!);
      }
    }

    if (candidates.isEmpty) return null;

    // Rank candidates by validity score
    var bestScore = -1;
    String? bestKey;

    for (final cand in candidates) {
      final score = _scoreAccessKey(cand);
      if (score > bestScore) {
        bestScore = score;
        bestKey = cand;
      }
    }

    return bestKey;
  }

  /// Extracts a valid SEFAZ NFC-e QR code URL or web link from a string/OCR text with multiline joining.
  static String? extractSefazUrl(String rawInput) {
    final trimmed = rawInput.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (!trimmed.contains('\n') && !trimmed.contains(' ')) {
        return trimmed;
      }
    }

    // 1. Multiline and spacing repair for thermal receipt URLs
    final lines = rawInput
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();

    for (var i = 0; i < lines.length; i++) {
      final lineNoSpace = lines[i].replaceAll(' ', '').toLowerCase();
      if (lineNoSpace.contains('fazenda') ||
          lineNoSpace.contains('sefaz') ||
          lineNoSpace.contains('nfce') ||
          lineNoSpace.contains('.gov.br') ||
          lineNoSpace.contains('satsp') ||
          lineNoSpace.contains('comsat') ||
          lineNoSpace.contains('dfe-portal')) {
        final urlParts = <String>[lines[i]];

        // Join continuation lines (narrow thermal paper splits long URLs over 2-4 lines)
        for (var j = i + 1; j < lines.length && j <= i + 4; j++) {
          final nextLine = lines[j];
          final upper = nextLine.toUpperCase();
          if (upper.startsWith('CHAVE') ||
              upper.startsWith('PROTOCOLO') ||
              upper.startsWith('CNPJ') ||
              upper.startsWith('CONSUMIDOR') ||
              upper.startsWith('VALOR') ||
              upper.startsWith('TOTAL') ||
              upper.startsWith('EMISSAO') ||
              upper.startsWith('DATA')) {
            break;
          }

          if (nextLine.contains('/') ||
              nextLine.contains('?') ||
              nextLine.contains('=') ||
              nextLine.contains('|') ||
              nextLine.contains('&') ||
              nextLine.contains('%') ||
              RegExp(r'^[0-9a-zA-Z\|]+$').hasMatch(nextLine.replaceAll(' ', ''))) {
            urlParts.add(nextLine);
          } else {
            break;
          }
        }

        var joined = urlParts.join('').replaceAll(RegExp(r'\s+'), '');
        final startsWithHttp =
            urlParts.first.toLowerCase().startsWith('http://');

        // Remove broken protocol tokens
        joined = joined.replaceFirst(
          RegExp(r'^https?://', caseSensitive: false),
          '',
        );

        var finalUrl = startsWithHttp ? 'http://$joined' : 'https://$joined';

        // Clean trailing non-url artifacts
        finalUrl = finalUrl.replaceAll(
          RegExp(r"[^a-zA-Z0-9_\-\.\:\/\?\#\[\]\@\!\$\&'\(\)\*\+\,\;\=\|\%]+$"),
          '',
        );

        return finalUrl;
      }
    }

    // 2. Direct regex match fallback
    final urlRegex = RegExp(r'https?://[^\s<>"]+', caseSensitive: false);
    final matches = urlRegex.allMatches(rawInput);
    for (final m in matches) {
      final candidate = m.group(0)!;
      final lower = candidate.toLowerCase();
      if (lower.contains('fazenda') ||
          lower.contains('sefaz') ||
          lower.contains('nfce') ||
          lower.contains('nfe') ||
          lower.contains('satsp') ||
          lower.contains('comsat') ||
          lower.contains('.gov.br') ||
          lower.contains('dfe-portal') ||
          lower.contains('p=')) {
        return candidate;
      }
    }

    // 3. Missing protocol fallback
    final noProtoRegex = RegExp(
      r'\b(?:www\.)?([a-zA-Z0-9\.\-]+\.(?:gov\.br|fazenda\.[a-z]{2}\.gov\.br|sefaz\.[a-z]{2}\.gov\.br)[^\s<>"]*)',
      caseSensitive: false,
    ).firstMatch(rawInput);
    if (noProtoRegex != null) {
      final matchedUrl = noProtoRegex.group(0)!;
      return 'https://$matchedUrl';
    }

    return null;
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
      case 'SP':
        return 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaPublica.aspx?p=$key|2|1|1|';
      case 'RS':
        return 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=$key|2|1|1|';
      case 'PR':
        return 'http://www.fazenda.pr.gov.br/nfce/qrcode?p=$key|2|1|1|';
      case 'MG':
        return 'https://nfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml?p=$key|2|1|1|';
      case 'RJ':
        return 'http://www.fazenda.rj.gov.br/nfc-e/qrcode?p=$key|2|1|1|';
      case 'BA':
        return 'http://nfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx?p=$key|2|1|1|';
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

    final accumulatedItems = ReceiptScannerService.accumulateScannedItems(items);

    return NfceParsedResult(
      items: accumulatedItems,
      marketName: marketName,
      cnpj: keyMatch != null ? getCnpjFromAccessKey(keyMatch) : null,
      accessKey: keyMatch,
      date: purchaseDate,
      totalAmount: totalAmount,
      stateUf: keyMatch != null ? getUfFromAccessKey(keyMatch) : null,
      rawHtml: html,
      errorMessage: accumulatedItems.isEmpty
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
      final lower = liContent.toLowerCase();

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
        final pMatch = RegExp(r'(\d{1,4},\d{2})').firstMatch(col3Text);
        if (pMatch != null) {
          final candidate = AppFormatters.parsePrice(pMatch.group(1)!);
          if (candidate != null && candidate > 0) {
            price = candidate;
            break;
          }
        }
      }

      if (price == null || price <= 0) {
        final allPrices = RegExp(r'(\d{1,4},\d{2})').allMatches(liContent);
        if (allPrices.isNotEmpty) {
          price = AppFormatters.parsePrice(allPrices.last.group(1)!);
        }
      }

      double qty = 1.0;
      String unit = 'un';
      double? unitPrice;

      final qtyMatch = RegExp(r'Qtde\.?:?\s*(\d+(?:[,\.]\d+)?)', caseSensitive: false).firstMatch(liContent);
      if (qtyMatch != null) {
        final parsedQ = parseNfceQuantity(qtyMatch.group(1)!);
        if (parsedQ > 0) qty = parsedQ;
      }

      final unMatch = RegExp(r'UN:\s*([A-Za-z]+)', caseSensitive: false).firstMatch(liContent);
      if (unMatch != null) {
        final uStr = unMatch.group(1)!.trim().toLowerCase();
        if (uStr.isNotEmpty) unit = uStr;
      }

      final upMatch = RegExp(r'Vl\.\s*Unit\.?:?\s*(?:R\$\s*)?(\d{1,4},\d{2})', caseSensitive: false).firstMatch(liContent);
      if (upMatch != null) {
        unitPrice = AppFormatters.parsePrice(upMatch.group(1)!);
      }

      if (price == null || price <= 0) {
        if (unitPrice != null && unitPrice > 0) {
          price = unitPrice * qty;
        }
      } else if (qty > 1 && unitPrice != null && price <= unitPrice) {
        price = unitPrice * qty;
      }

      final effectiveUnitPrice = unitPrice ?? (price != null && qty > 0 ? price / qty : price);

      if (rawName != null && price != null && price > 0) {
        final cleanName = _cleanNfceProductName(rawName);
        if (cleanName.length >= 2) {
          items.add(
            ScannedReceiptItem(
              name: cleanName,
              price: price,
              unitPrice: effectiveUnitPrice,
              quantity: qty > 0 ? qty : 1.0,
              unit: unit,
              category: CategoryClassifier.classify(cleanName),
              itemIndex: items.length + 1,
            ),
          );
        }
      }
    }

    if (items.isNotEmpty) return items;

    // Method 2: Scan generic block containers (<tr...>, <div...>) with Vl. Total
    final danfeLineRegex = RegExp(
      r'([^\n<>]+?)(?:\s*\(c[óo]d(?:igo)?:\s*\d+\))?\s+Vl\.\s*Total:?\s*(?:R\$\s*)?(\d{1,4},\d{2})',
      caseSensitive: false,
    );

    final blockRegex =
        RegExp(r'<(?:tr|div|p)[^>]*>(.*?)</(?:tr|div|p)>', dotAll: true);
    final blocks = blockRegex.allMatches(html);

    for (final block in blocks) {
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
        final priceStr = match.group(2)!;
        var price = AppFormatters.parsePrice(priceStr);

        double qty = 1.0;
        String unit = 'un';
        double? unitPrice;

        final qMatch = RegExp(r'Qtde\.?:?\s*(\d+(?:[,\.]\d+)?)', caseSensitive: false).firstMatch(blockText);
        if (qMatch != null) {
          final parsedQ = parseNfceQuantity(qMatch.group(1)!);
          if (parsedQ > 0) qty = parsedQ;
        }

        final uMatch = RegExp(r'UN:\s*([A-Za-z]+)', caseSensitive: false).firstMatch(blockText);
        if (uMatch != null) {
          final uStr = uMatch.group(1)!.trim().toLowerCase();
          if (uStr.isNotEmpty) unit = uStr;
        }

        final upMatch = RegExp(r'Vl\.\s*Unit\.?:?\s*(?:R\$\s*)?(\d{1,4},\d{2})', caseSensitive: false).firstMatch(blockText);
        if (upMatch != null) {
          unitPrice = AppFormatters.parsePrice(upMatch.group(1)!);
        }

        if (price == null || price <= 0) {
          if (unitPrice != null) price = unitPrice * qty;
        } else if (qty > 1 && unitPrice != null && price <= unitPrice) {
          price = unitPrice * qty;
        }

        final effectiveUnitPrice = unitPrice ??
            (price != null && qty > 0
                ? double.parse((price / qty).toStringAsFixed(4))
                : price);

        final cleanedName = _cleanNfceProductName(rawName);
        if (cleanedName.length >= 2 && price != null && price > 0) {
          items.add(
            ScannedReceiptItem(
              name: cleanedName,
              price: price,
              unitPrice: effectiveUnitPrice,
              quantity: qty > 0 ? qty : 1.0,
              unit: unit,
              category: CategoryClassifier.classify(cleanedName),
              itemIndex: items.length + 1,
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
          final pMatchNext = (i + 1 < rawLines.length) ? RegExp(r'^(\d{1,4},\d{2})$').firstMatch(rawLines[i + 1]) : null;
          if (pMatchNext != null) {
            price = AppFormatters.parsePrice(pMatchNext.group(1)!);
          } else {
            final pMatchThis = RegExp(r'(\d{1,4},\d{2})').allMatches(line);
            if (pMatchThis.isNotEmpty) {
              price = AppFormatters.parsePrice(pMatchThis.last.group(1)!);
            }
          }

          double qty = 1.0;
          String unit = 'un';
          double? unitPrice;

          final qMatch = RegExp(r'Qtde\.?:?\s*(\d+(?:[,\.]\d+)?)', caseSensitive: false).firstMatch(line);
          if (qMatch != null) {
            final parsedQ = parseNfceQuantity(qMatch.group(1)!);
            if (parsedQ > 0) qty = parsedQ;
          }

          final uMatch = RegExp(r'UN:\s*([A-Za-z]+)', caseSensitive: false).firstMatch(line);
          if (uMatch != null) {
            final uStr = uMatch.group(1)!.trim().toLowerCase();
            if (uStr.isNotEmpty) unit = uStr;
          }

          final upMatch = RegExp(r'Vl\.\s*Unit\.?:?\s*(?:R\$\s*)?(\d{1,4},\d{2})', caseSensitive: false).firstMatch(line);
          if (upMatch != null) {
            unitPrice = AppFormatters.parsePrice(upMatch.group(1)!);
          }

          if (price == null || price <= 0) {
            if (unitPrice != null) price = unitPrice * qty;
          } else if (qty > 1 && unitPrice != null && price <= unitPrice) {
            price = unitPrice * qty;
          }

          final effectiveUnitPrice = unitPrice ??
            (price != null && qty > 0
                ? double.parse((price / qty).toStringAsFixed(4))
                : price);

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
              final cleanedName = _cleanNfceProductName(candidateName);
              if (cleanedName.length >= 2) {
                items.add(
                  ScannedReceiptItem(
                    name: cleanedName,
                    price: price,
                    unitPrice: effectiveUnitPrice,
                    quantity: qty > 0 ? qty : 1.0,
                    unit: unit,
                    category: CategoryClassifier.classify(cleanedName),
                    itemIndex: items.length + 1,
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

      if (titleMatch != null && priceMatch != null) {
        final rawName = _stripTags(titleMatch.group(1)!);
        final priceStr = _stripTags(priceMatch.group(1)!);
        var price = AppFormatters.parsePrice(priceStr);

        double qty = 1.0;
        String unit = 'un';
        double? unitPrice;

        final qtyMatch = RegExp(r'<span[^>]*class="[^"]*Rqtd[^"]*"[^>]*>(.*?)</span>', dotAll: true).firstMatch(rowHtml);
        if (qtyMatch != null) {
          final qStr = _stripTags(qtyMatch.group(1)!).replaceAll(RegExp(r'[^0-9,\.]'), '');
          final parsedQ = parseNfceQuantity(qStr);
          if (parsedQ > 0) qty = parsedQ;
        }

        final unitMatch = RegExp(r'<span[^>]*class="[^"]*RUN[^"]*"[^>]*>(.*?)</span>', dotAll: true).firstMatch(rowHtml);
        if (unitMatch != null) {
          final uStr = _stripTags(unitMatch.group(1)!).replaceAll(RegExp(r'UN:\s*', caseSensitive: false), '').trim().toLowerCase();
          if (uStr.isNotEmpty) unit = uStr;
        }

        final unitPriceMatch = RegExp(r'<span[^>]*class="[^"]*RvlUnit[^"]*"[^>]*>(.*?)</span>', dotAll: true).firstMatch(rowHtml);
        if (unitPriceMatch != null) {
          final upStr = _stripTags(unitPriceMatch.group(1)!).replaceAll(RegExp(r'[^0-9,\.]'), '');
          unitPrice = AppFormatters.parsePrice(upStr);
        }

        if (price == null || price <= 0) {
          if (unitPrice != null) price = unitPrice * qty;
        } else if (qty > 1 && unitPrice != null && price <= unitPrice) {
          price = unitPrice * qty;
        }

        final effectiveUnitPrice = unitPrice ??
            (price != null && qty > 0
                ? double.parse((price / qty).toStringAsFixed(4))
                : price);

        final cleanedName = _cleanNfceProductName(rawName);
        if (cleanedName.isNotEmpty && price != null && price > 0) {
          items.add(
            ScannedReceiptItem(
              name: cleanedName,
              price: price,
              unitPrice: effectiveUnitPrice,
              quantity: qty > 0 ? qty : 1.0,
              unit: unit,
              category: CategoryClassifier.classify(cleanedName),
              itemIndex: items.length + 1,
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

      if (nameMatch != null && priceMatch != null) {
        final rawName = _stripTags(nameMatch.group(1)!);
        final priceStr = _stripTags(priceMatch.group(1)!);
        var price = AppFormatters.parsePrice(priceStr);

        double qty = 1.0;
        String unit = 'un';
        double? unitPrice;

        final qtyMatch = RegExp(r'<(?:span|td)[^>]*class="[^"]*(?:Rqtd|fixo-prod-qtd)[^"]*"[^>]*>(.*?)</(?:span|td)>', dotAll: true).firstMatch(rowHtml);
        if (qtyMatch != null) {
          final qStr = _stripTags(qtyMatch.group(1)!).replaceAll(RegExp(r'[^0-9,\.]'), '');
          final parsedQ = parseNfceQuantity(qStr);
          if (parsedQ > 0) qty = parsedQ;
        }

        final unitMatch = RegExp(r'<(?:span|td)[^>]*class="[^"]*(?:RUN|fixo-prod-unidade)[^"]*"[^>]*>(.*?)</(?:span|td)>', dotAll: true).firstMatch(rowHtml);
        if (unitMatch != null) {
          final uStr = _stripTags(unitMatch.group(1)!).replaceAll(RegExp(r'UN:\s*', caseSensitive: false), '').trim().toLowerCase();
          if (uStr.isNotEmpty) unit = uStr;
        }

        final unitPriceMatch = RegExp(r'<(?:span|td)[^>]*class="[^"]*(?:RvlUnit|fixo-prod-vl-unit)[^"]*"[^>]*>(.*?)</(?:span|td)>', dotAll: true).firstMatch(rowHtml);
        if (unitPriceMatch != null) {
          final upStr = _stripTags(unitPriceMatch.group(1)!).replaceAll(RegExp(r'[^0-9,\.]'), '');
          unitPrice = AppFormatters.parsePrice(upStr);
        }

        if (price == null || price <= 0) {
          if (unitPrice != null) price = unitPrice * qty;
        } else if (qty > 1 && unitPrice != null && price <= unitPrice) {
          price = unitPrice * qty;
        }

        final effectiveUnitPrice = unitPrice ??
            (price != null && qty > 0
                ? double.parse((price / qty).toStringAsFixed(4))
                : price);

        final cleanedName = _cleanNfceProductName(rawName);
        if (cleanedName.isNotEmpty && price != null && price > 0) {
          items.add(
            ScannedReceiptItem(
              name: cleanedName,
              price: price,
              unitPrice: effectiveUnitPrice,
              quantity: qty > 0 ? qty : 1.0,
              unit: unit,
              category: CategoryClassifier.classify(cleanedName),
              itemIndex: items.length + 1,
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
        var price = AppFormatters.parsePrice(lastPriceStr);

        double qty = 1.0;
        String unit = 'un';
        double? unitPrice;

        final qMatch = RegExp(r'Qtde\.?:?\s*(\d+(?:[,\.]\d+)?)', caseSensitive: false).firstMatch(text);
        if (qMatch != null) {
          final parsedQ = parseNfceQuantity(qMatch.group(1)!);
          if (parsedQ > 0) qty = parsedQ;
        }

        final uMatch = RegExp(r'UN:\s*([A-Za-z]+)', caseSensitive: false).firstMatch(text);
        if (uMatch != null) {
          final uStr = uMatch.group(1)!.trim().toLowerCase();
          if (uStr.isNotEmpty) unit = uStr;
        }

        final upMatch = RegExp(r'Vl\.\s*Unit\.?:?\s*(?:R\$\s*)?(\d{1,4},\d{2})', caseSensitive: false).firstMatch(text);
        if (upMatch != null) {
          unitPrice = AppFormatters.parsePrice(upMatch.group(1)!);
        }

        if (price == null || price <= 0) {
          if (unitPrice != null) price = unitPrice * qty;
        } else if (qty > 1 && unitPrice != null && price <= unitPrice) {
          price = unitPrice * qty;
        }

        final effectiveUnitPrice = unitPrice ??
            (price != null && qty > 0
                ? double.parse((price / qty).toStringAsFixed(4))
                : price);

        // Name is the string before the first price
        final firstMatch = matches.first;
        final nameSection = text.substring(0, firstMatch.start).trim();
        final cleanedName = _cleanNfceProductName(nameSection);

        if (cleanedName.length >= 2 && price != null && price > 0 && price < 10000) {
          items.add(
            ScannedReceiptItem(
              name: cleanedName,
              price: price,
              unitPrice: effectiveUnitPrice,
              quantity: qty > 0 ? qty : 1.0,
              unit: unit,
              category: CategoryClassifier.classify(cleanedName),
              itemIndex: items.length + 1,
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

  /// Parses quantities formatted by SEFAZ NFC-e/NFe systems.
  /// SEFAZ represents quantities with 3 or 4 decimal places (e.g. 1.000, 2.000, 1.0000, 0.450).
  /// In Brazilian Portuguese punctuation, "1.000" can be mistaken as one thousand (1000)
  /// instead of 1 unit if parsed by standard price formatters.
  /// This parser accurately interprets:
  /// - 1.000 / 1,000 -> 1.0 unit
  /// - 2.000 / 2,000 -> 2.0 units
  /// - 1.0000 / 1,0000 -> 1.0 unit
  /// - 0.450 / 0,450 -> 0.450 kg
  /// - 10 / 12 -> 10.0 / 12.0 units
  static double parseNfceQuantity(String raw) {
    var s = raw.trim();
    if (s.isEmpty) return 1.0;

    // Remove any trailing or leading non-numeric chars except . and ,
    s = s.replaceAll(RegExp(r'[^0-9,\.]'), '');
    if (s.isEmpty) return 1.0;

    // Pattern for SEFAZ 3 or 4 decimal places with dot or comma (e.g., "1.000", "2.0000", "1,000")
    // When there is only one dot or comma followed by 3 or 4 zeros/digits, it's a decimal quantity.
    final dotCount = '.'.allMatches(s).length;
    final commaCount = ','.allMatches(s).length;

    if (dotCount == 1 && commaCount == 0) {
      final parts = s.split('.');
      final intPart = double.tryParse(parts[0]) ?? 1.0;
      final decPart = double.tryParse('0.${parts[1]}') ?? 0.0;
      return intPart + decPart;
    } else if (commaCount == 1 && dotCount == 0) {
      final parts = s.split(',');
      final intPart = double.tryParse(parts[0]) ?? 1.0;
      final decPart = double.tryParse('0.${parts[1]}') ?? 0.0;
      return intPart + decPart;
    } else if (dotCount >= 1 && commaCount == 1) {
      // Formats like 1.250,50 (rare for quantities, but standard BR number)
      final normalized = s.replaceAll('.', '').replaceAll(',', '.');
      return double.tryParse(normalized) ?? 1.0;
    }

    return double.tryParse(s.replaceAll(',', '.')) ?? 1.0;
  }

  /// Cleans and sanitizes product names extracted from NFC-e pages and raw strings:
  /// - Removes (Cód: 70), (Código: 12345), (Cod: 123)
  /// - Removes leading item indexes (e.g. "001 7891234567890 ", "01 ")
  /// - Removes trailing tax flags and fiscal tokens (F1, T18%, I1, N1, etc.)
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

    // 4. Multi-word phrase expansions (e.g. "CR LEITE" -> "Creme de Leite", "L MOV" -> "Lava Móveis")
    for (final entry in ReceiptScannerService.phraseAbbrevMap.entries) {
      final pattern = RegExp(r'\b' + RegExp.escape(entry.key) + r'\b', caseSensitive: false);
      s = s.replaceAll(pattern, entry.value);
    }

    // 5. Tokenize, expand abbreviations (e.g. SC -> Saco, OL -> Óleo, LT -> Leite, QJ -> Queijo, SH -> Shampoo, OREG -> Orégano), and capitalize words nicely
    s = s.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (s.isEmpty) return '';

    const minorPrepositions = {'de', 'da', 'do', 'das', 'dos', 'em', 'com', 'sem', 'e', 'para'};
    final words = s.split(' ');
    final formatted = words.map((w) {
      if (w.isEmpty) return '';
      final upper = w.toUpperCase();
      final expanded = ReceiptScannerService.abbrevMap[upper] ?? w;
      if (RegExp(r'^\d+(?:[,\.]\d+)?[a-zA-Z]{1,3}$').hasMatch(expanded)) {
        return expanded.toLowerCase();
      }
      final lower = expanded.toLowerCase();
      if (minorPrepositions.contains(lower)) {
        return lower;
      }
      return lower[0].toUpperCase() + lower.substring(1);
    }).join(' ');

    return formatted;
  }
}
