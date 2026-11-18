import 'dart:math' as math;
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import '../models/shopping_models.dart';
import '../utils/formatters.dart';
import 'category_classifier.dart';

class ScannedReceiptItem {
  ScannedReceiptItem({
    required this.name,
    required this.price,
    this.unitPrice,
    this.category,
    this.quantity = 1.0,
    this.unit = 'un',
    this.itemIndex,
  });

  String name;
  double price;
  double? unitPrice;
  ProductCategory? category;
  double quantity;
  String unit;
  int? itemIndex;

  double get effectiveUnitPrice {
    if (unitPrice != null && unitPrice! > 0) return unitPrice!;
    if (quantity > 0) {
      final raw = price / quantity;
      return double.parse(raw.toStringAsFixed(4));
    }
    return price;
  }
}

class ReceiptScannerService {
  static final List<String> _ignoredReceiptKeywords = [
    'cnpj',
    'cpf',
    'inscricao estadual',
    'documento auxiliar',
    'nota fiscal',
    'cupom fiscal',
    'consumidor',
    'danfe',
    'qtd. total',
    'qtd total',
    'valor total',
    'ualor total',
    'valor total a pagar',
    'ualor total a pagar',
    'total a pagar',
    'valor a pagar',
    'ualor a pagar',
    'total geral',
    'valor geral',
    'ualor geral',
    'total pago',
    'valor pago',
    'ualor pago',
    'total liquido',
    'valor liquido',
    'ualor liquido',
    'total bruto',
    'valor bruto',
    'ualor bruto',
    'total produtos',
    'valor produtos',
    'ualor produtos',
    'total dos produtos',
    'valor dos produtos',
    'ualor dos produtos',
    'valor da nota',
    'ualor da nota',
    'valor do cupom',
    'ualor do cupom',
    'total cupom',
    'total nota',
    'vlr total',
    'ulr total',
    'vl total',
    'ul total',
    'vlr total a pagar',
    'ulr total a pagar',
    'vl total a pagar',
    'ul total a pagar',
    'subtotal',
    'sub-total',
    'sub total',
    't0tal',
    'desconto',
    'descontos',
    'valor desconto',
    'ualor desconto',
    'acrescimo',
    'acrescimos',
    'valor acrescimo',
    'forma de pagamento',
    'forma pagamento',
    'meio de pagamento',
    'cartao de credito',
    'cartao de debito',
    'cartao credito',
    'cartao debito',
    'credito',
    'debito',
    'dinheiro',
    'troco',
    'valor troco',
    'ualor troco',
    'valor recebido',
    'ualor recebido',
    'total recebido',
    'tributos',
    'aproximados',
    'lei federal',
    'ibpt',
    'procon',
    'decon',
    'chave de acesso',
    'consulte pela',
    'protocolo',
    'autorizacao',
    'serie',
    'emissao',
    'operador',
    'caixa',
    'extrato',
    'sat ',
    'qrcode',
    'http',
    'www.',
    'sefaz',
    'fazenda',
  ];

  /// Extracts text from an image file using on-device ML Kit OCR, reconstructing
  /// horizontal receipt rows by sorting and grouping text lines from top to bottom
  /// in the exact physical order of the receipt, accounting for camera angle/skew.
  static Future<String> recognizeTextFromImage(String imagePath) async {
    final inputImage = InputImage.fromFilePath(imagePath);
    final textRecognizer = TextRecognizer(script: TextRecognitionScript.latin);

    try {
      final recognizedText = await textRecognizer.processImage(inputImage);
      final allLines = <TextLine>[];
      for (final block in recognizedText.blocks) {
        allLines.addAll(block.lines);
      }

      if (allLines.isEmpty) {
        return recognizedText.text;
      }

      // Calculate the median text tilt/skew angle from corner points
      final angles = <double>[];
      for (final line in allLines) {
        if (line.cornerPoints.length >= 2) {
          final p0 = line.cornerPoints[0];
          final p1 = line.cornerPoints[1];
          final dx = (p1.x - p0.x).toDouble();
          final dy = (p1.y - p0.y).toDouble();
          if (dx.abs() > 20) {
            final angle = math.atan2(dy, dx);
            if (angle.abs() < math.pi / 4) {
              angles.add(angle);
            }
          }
        }
      }

      angles.sort();
      final medianAngle = angles.isNotEmpty ? angles[angles.length ~/ 2] : 0.0;
      final cosAngle = math.cos(medianAngle);
      final sinAngle = math.sin(medianAngle);

      double getProjectedY(TextLine l) {
        final cx = l.boundingBox.center.dx;
        final cy = l.boundingBox.center.dy;
        return -cx * sinAngle + cy * cosAngle;
      }

      double getProjectedX(TextLine l) {
        final cx = l.boundingBox.center.dx;
        final cy = l.boundingBox.center.dy;
        return cx * cosAngle + cy * sinAngle;
      }

      // Sort lines strictly from top to bottom according to the receipt's perspective
      allLines.sort(
        (a, b) => getProjectedY(a).compareTo(getProjectedY(b)),
      );

      // Group lines that are on the same horizontal row (within vertical tolerance)
      final groupedRows = <List<TextLine>>[];
      for (final line in allLines) {
        if (groupedRows.isEmpty) {
          groupedRows.add([line]);
          continue;
        }
        final lastRow = groupedRows.last;
        final avgProjY = lastRow
                .map(getProjectedY)
                .reduce((a, b) => a + b) /
            lastRow.length;
        final avgHeight = lastRow
                .map((l) => l.boundingBox.height)
                .reduce((a, b) => a + b) /
            lastRow.length;

        if ((getProjectedY(line) - avgProjY).abs() <= avgHeight * 0.70) {
          lastRow.add(line);
        } else {
          groupedRows.add([line]);
        }
      }

      final buffer = StringBuffer();
      for (final row in groupedRows) {
        row.sort((a, b) => getProjectedX(a).compareTo(getProjectedX(b)));
        buffer.writeln(row.map((l) => l.text.trim()).join(' '));
      }

      return buffer.toString();
    } finally {
      await textRecognizer.close();
    }
  }

  /// Parses raw OCR text from a Brazilian receipt (NFC-e / Cupom Fiscal) into
  /// a list of [ScannedReceiptItem] containing product name, price, quantity, unit,
  /// item sequence index, and automatically assigned category.
  static List<ScannedReceiptItem> parseReceiptText(String rawText) {
    if (rawText.trim().isEmpty) return [];

    final lines = rawText
        .split(RegExp(r'[\r\n]+'))
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();

    final items = <ScannedReceiptItem>[];
    String? pendingProductName;
    int? pendingItemIndex;

    // Matches Brazilian decimal prices like 12,90 or 1.234,56 or 8.50 at end of line
    final priceRegex = RegExp(r'(\d{1,3}(?:\.\d{3})*[,\.]\d{2})\b');

    // Matches quantity X unit price lines like "1 UN X 12,90", "0,540 KG X 29,90", "2 X 5,50"
    final qtyMultiplierRegex = RegExp(
      r'(\d+(?:[,\.]\d+)?)\s*(un|kg|g|l|lt|ml|pc|pct|cx|emb)?\s*[xX*]\s*(\d+[,\.]\d{2})',
      caseSensitive: false,
    );

    for (var i = 0; i < lines.length; i++) {
      var rawLine = lines[i];

      // Repair price OCR confusions in the line (e.g. 12,9O -> 12,90 or 5,O0 -> 5,00)
      rawLine = _repairOcrPricesInLine(rawLine);

      if (_shouldIgnoreReceiptLine(rawLine) || _isReceiptTotalOrSummaryLine(rawLine)) {
        pendingProductName = null;
        pendingItemIndex = null;
        continue;
      }

      // Case 1: Line is a quantity * unit_price = total_price multiplier line following a pending product name
      final qtyMatch = qtyMultiplierRegex.firstMatch(rawLine);
      if (qtyMatch != null && pendingProductName != null && !_isTotalProductName(pendingProductName)) {
        final matches = priceRegex.allMatches(rawLine).toList();
        if (matches.isNotEmpty) {
          final lastPriceStr = matches.last.group(1)!;
          final parsedPrice = AppFormatters.parsePrice(lastPriceStr);
          if (parsedPrice != null && parsedPrice > 0 && parsedPrice < 10000) {
            final qtyStr = qtyMatch.group(1)!;
            final unitStr = (qtyMatch.group(2) ?? 'un').toLowerCase();
            final parsedQty = AppFormatters.parsePrice(qtyStr) ?? 1.0;
            final itemIdx = pendingItemIndex ?? _extractItemIndex(rawLine);
            final unitPriceStr = qtyMatch.group(3);
            final parsedUnitPrice = unitPriceStr != null ? AppFormatters.parsePrice(unitPriceStr) : null;
            final effectiveTotalPrice = (parsedQty > 1 && parsedUnitPrice != null && (parsedPrice <= parsedUnitPrice || matches.length == 1))
                ? parsedUnitPrice * parsedQty
                : parsedPrice;
            final effectiveUnitPrice = parsedUnitPrice ?? (parsedQty > 0 ? effectiveTotalPrice / parsedQty : effectiveTotalPrice);

            items.add(
              ScannedReceiptItem(
                name: pendingProductName,
                price: effectiveTotalPrice,
                unitPrice: effectiveUnitPrice,
                quantity: parsedQty > 0 ? parsedQty : 1.0,
                unit: unitStr.isNotEmpty ? unitStr : 'un',
                category: CategoryClassifier.classify(pendingProductName),
                itemIndex: itemIdx,
              ),
            );
            pendingProductName = null;
            pendingItemIndex = null;
            continue;
          }
        }
      }

      // Case 2: Line contains both product description and price(s)
      final priceMatches = priceRegex.allMatches(rawLine).toList();
      if (priceMatches.isNotEmpty) {
        final lastMatch = priceMatches.last;
        final priceStr = lastMatch.group(1)!;
        final parsedPrice = AppFormatters.parsePrice(priceStr);

        // Extract product name before the price or quantity section
        final firstMatch = priceMatches.first;
        var beforePrices = rawLine.substring(0, firstMatch.start).trim();

        // Also check if there was a multiplier in the line (e.g. "ITEM 1 UN X 10,00 10,00")
        double parsedQty = 1.0;
        String parsedUnit = 'un';
        double? parsedUnitPrice;
        if (qtyMatch != null && qtyMatch.start < firstMatch.start) {
          beforePrices = rawLine.substring(0, qtyMatch.start).trim();
          final qtyStr = qtyMatch.group(1)!;
          parsedUnit = (qtyMatch.group(2) ?? 'un').toLowerCase();
          parsedQty = AppFormatters.parsePrice(qtyStr) ?? 1.0;
          final unitPriceStr = qtyMatch.group(3);
          if (unitPriceStr != null) {
            parsedUnitPrice = AppFormatters.parsePrice(unitPriceStr);
          }
        }

        final lineItemIdx = _extractItemIndex(rawLine) ?? pendingItemIndex;
        final cleanedName = _cleanReceiptProductName(beforePrices);

        if (parsedPrice != null && parsedPrice > 0 && parsedPrice < 10000) {
          final effectiveTotalPrice = (parsedQty > 1 && parsedUnitPrice != null && parsedPrice <= parsedUnitPrice)
              ? parsedUnitPrice * parsedQty
              : parsedPrice;
          final effectiveUnitPrice = parsedUnitPrice ?? (parsedQty > 0 ? effectiveTotalPrice / parsedQty : effectiveTotalPrice);

          if (cleanedName.length >= 2 && !_isTotalProductName(cleanedName)) {
            items.add(
              ScannedReceiptItem(
                name: cleanedName,
                price: effectiveTotalPrice,
                unitPrice: effectiveUnitPrice,
                quantity: parsedQty > 0 ? parsedQty : 1.0,
                unit: parsedUnit.isNotEmpty ? parsedUnit : 'un',
                category: CategoryClassifier.classify(cleanedName),
                itemIndex: lineItemIdx,
              ),
            );
            pendingProductName = null;
            pendingItemIndex = null;
            continue;
          } else if (pendingProductName != null && !_isTotalProductName(pendingProductName)) {
            items.add(
              ScannedReceiptItem(
                name: pendingProductName,
                price: effectiveTotalPrice,
                unitPrice: effectiveUnitPrice,
                quantity: parsedQty > 0 ? parsedQty : 1.0,
                unit: parsedUnit.isNotEmpty ? parsedUnit : 'un',
                category: CategoryClassifier.classify(pendingProductName),
                itemIndex: pendingItemIndex ?? lineItemIdx,
              ),
            );
            pendingProductName = null;
            pendingItemIndex = null;
            continue;
          }
        }
      }

      // Case 3: Line has no valid price, might be the product name for the following line
      final candidateName = _cleanReceiptProductName(rawLine);
      if (candidateName.length >= 3 && !_isTotalProductName(candidateName)) {
        pendingProductName = candidateName;
        pendingItemIndex = _extractItemIndex(rawLine);
      }
    }

    // Final safety: remove ANY items whose name is a Total, Subtotal, or Payment summary
    items.removeWhere((item) => _isTotalProductName(item.name));

    // Ensure items appear in the exact chronological order of the receipt (NFC-e / Cupom Fiscal):
    // 1. If explicit item sequence numbers (001, 002, 003...) were read from the receipt,
    //    sort by this printed sequence to fix any minor vertical OCR inversions.
    final indexedCount = items.where((it) => it.itemIndex != null).length;
    if (indexedCount >= 2 && indexedCount >= (items.length * 0.5)) {
      var lastIdx = 0;
      for (final it in items) {
        if (it.itemIndex != null) {
          lastIdx = it.itemIndex!;
        } else {
          lastIdx++;
          it.itemIndex = lastIdx;
        }
      }
      items.sort((a, b) => a.itemIndex!.compareTo(b.itemIndex!));
    } else {
      // If the receipt has no printed numbers, assign sequential indices 1..N
      // preserving their physical top-to-bottom layout from the photo
      for (var i = 0; i < items.length; i++) {
        items[i].itemIndex = i + 1;
      }
    }

    return accumulateScannedItems(items);
  }

  /// Merges repeated items with the same normalized name.
  /// Sums quantity and total price, and recomputes effective unit price.
  static List<ScannedReceiptItem> accumulateScannedItems(List<ScannedReceiptItem> items) {
    if (items.isEmpty) return items;
    final result = <ScannedReceiptItem>[];
    final map = <String, ScannedReceiptItem>{};

    for (final item in items) {
      final key = CategoryClassifier.normalize(item.name);
      if (key.isEmpty) {
        result.add(item);
        continue;
      }

      if (map.containsKey(key)) {
        final existing = map[key]!;
        final itemQty = item.quantity > 0 ? item.quantity : 1.0;
        existing.quantity += itemQty;
        existing.price += item.price;
        if (existing.quantity > 0) {
          existing.unitPrice = existing.price / existing.quantity;
        }
        if (existing.unit.isEmpty || existing.unit == 'un') {
          if (item.unit.isNotEmpty && item.unit != 'un') {
            existing.unit = item.unit;
          }
        }
      } else {
        final itemQty = item.quantity > 0 ? item.quantity : 1.0;
        final copy = ScannedReceiptItem(
          name: item.name,
          price: item.price,
          unitPrice: item.unitPrice ?? (itemQty > 0 ? item.price / itemQty : item.price),
          category: item.category,
          quantity: itemQty,
          unit: item.unit.isNotEmpty ? item.unit : 'un',
          itemIndex: item.itemIndex,
        );
        map[key] = copy;
        result.add(copy);
      }
    }

    return result;
  }

  /// Extracts the printed item sequence number (e.g. "001", "02", "1", "ITEM 01")
  /// from the beginning of a receipt line.
  static int? _extractItemIndex(String line) {
    final match = RegExp(
      r'^\s*(?:item|it|cod|cód)?\s*#?\s*(\d{1,4})\b',
      caseSensitive: false,
    ).firstMatch(line);

    if (match != null) {
      final valStr = match.group(1)!;
      final val = int.tryParse(valStr);
      if (val != null && val >= 1 && val <= 999) {
        return val;
      }
    }
    return null;
  }

  /// Normalizes numbers and prices where OCR confused 'O'/'o' with zero '0'.
  /// Examples: "12,9O" -> "12,90", "5,O0" -> "5,00", "1O,50" -> "10,50".
  static String _repairOcrPricesInLine(String line) {
    var s = line;
    // Replace 'O'/'o' after decimal comma or dot (e.g. ,9O -> ,90, .O0 -> .00)
    s = s.replaceAllMapped(
      RegExp(r'(?<=[,\.])([Oo0-9]{2,3})\b'),
      (m) => m.group(1)!.replaceAll(RegExp(r'[Oo]'), '0'),
    );
    // Replace 'O'/'o' inside numeric groups around digits (e.g. 1O, -> 10,)
    s = s.replaceAllMapped(
      RegExp(r'\b([0-9]*[Oo]+[0-9]*)(?=[,\.])'),
      (m) => m.group(1)!.replaceAll(RegExp(r'[Oo]'), '0'),
    );
    return s;
  }

  static bool _shouldIgnoreReceiptLine(String line) {
    final lower = line.toLowerCase();
    for (final keyword in _ignoredReceiptKeywords) {
      if (lower.contains(keyword)) return true;
    }
    // Check if the line is a receipt Total, Subtotal, or Payment summary line
    if (_isReceiptTotalOrSummaryLine(lower)) {
      return true;
    }
    // Ignore lines that are purely long numeric keys (44-digit NFC-e access key) without product words
    final digitsOnly = line.replaceAll(RegExp(r'\D'), '');
    if (digitsOnly.length >= 35 && !RegExp(r'[a-zA-ZÀ-ÿ]{3,}').hasMatch(line)) {
      return true;
    }
    if (RegExp(r'^\d{2}/\d{2}/\d{2,4}').hasMatch(line)) return true;
    return false;
  }

  /// Returns true if a receipt line represents a Total, Subtotal, or Payment summary.
  /// Protects actual products with 'total' in their name (e.g. "Colgate Total 12").
  static bool _isReceiptTotalOrSummaryLine(String line) {
    var clean = line.toLowerCase().trim();

    // 1. Strip leading item index or sequence if OCR confused summary for an item line
    // e.g. "004 VALOR TOTAL", "04 UALOR TOTAL", "ITEM 05 TOTAL"
    clean = clean.replaceFirst(
      RegExp(r'^\s*(?:item|it|cod|cód)?\s*#?\s*\d{1,6}[\s\.\-]+', caseSensitive: false),
      '',
    ).trim();

    // Normalize multiple spaces into single space
    clean = clean.replaceAll(RegExp(r'\s+'), ' ');

    // Normalize OCR variations: ualor -> valor, ulr -> vlr, t0tal/tota1 -> total
    final normalized = clean
        .replaceAll(RegExp(r'\bualor\b'), 'valor')
        .replaceAll(RegExp(r'\bulr\b'), 'vlr')
        .replaceAll(RegExp(r'\bul\b'), 'vl')
        .replaceAll(RegExp(r'\bt0tal\b|\btota1\b'), 'total')
        .replaceAll(RegExp(r'\bt\s*o\s*t\s*a\s*l\b'), 'total');

    // 2. Direct regex match on common receipt summary patterns at start
    final summaryStartPattern = RegExp(
      r'^(?:total|vlr?\.?\s*total(?:\s*a\s*pagar)?|vl\s*total(?:\s*a\s*pagar)?|valor\s*total(?:\s*a\s*pagar)?|subtotal|sub-total|sub\s+total|total\s*a\s*pagar|valor\s*a\s*pagar|total\s*pago|valor\s*pago|total\s*l[ií]quido|valor\s*l[ií]quido|total\s*bruto|valor\s*bruto|total\s*(?:dos\s*)?produtos|valor\s*(?:dos\s*)?produtos|valor\s*recebido|total\s*recebido|valor\s*troco|troco|desconto|descontos|acrescimo|acrescimos|forma\s*de\s*pagamento|total\s*geral|valor\s*geral)\b',
      caseSensitive: false,
    );

    if (summaryStartPattern.hasMatch(normalized)) {
      return true;
    }

    // 3. Match explicit total phrases anywhere in the line (e.g. "004 UALOR TOTAL R$ 50,00", "VALOR TOTAL A PAGAR R$ 50,00", "*** VALOR TOTAL: 50,00 ***")
    if (RegExp(
      r'\b(?:valor|vlr?\.?|vl)\s*(?:total(?:\s*a\s*pagar)?|geral|pago|a\s*pagar|l[ií]quido|bruto|recebido|troco|da\s*nota|do\s*cupom|(?:dos\s*)?produtos)\b',
      caseSensitive: false,
    ).hasMatch(normalized)) {
      return true;
    }

    if (RegExp(
      r'\b(?:total)\s*(?:geral|pago|a\s*pagar|l[ií]quido|bruto|recebido|(?:dos\s*)?produtos|da\s*nota|do\s*cupom)\b',
      caseSensitive: false,
    ).hasMatch(normalized)) {
      return true;
    }

    // 4. Line contains total/summary and the text part is just summary words (e.g. "VALOR A PAGAR R$ 42,29")
    if (normalized.contains('total') ||
        normalized.contains('subtotal') ||
        normalized.contains('pagar') ||
        normalized.contains('pago') ||
        normalized.contains('troco')) {
      final nonPriceText = normalized
          .replaceAll(RegExp(r'\d{1,3}(?:\.\d{3})*[,\.]\d{2}'), '')
          .replaceAll(RegExp(r'\b\d+\b'), '')
          .replaceAll(RegExp(r'r\$\s*'), '')
          .replaceAll(RegExp(r'[:=\-\*\#\.\,\>\<\_]'), ' ')
          .replaceAll(RegExp(r'\s+'), ' ')
          .trim();

      if (nonPriceText.isEmpty ||
          RegExp(r'^(?:total|vlr?|vl|valor|liq|liquido|líquido|bruto|a|pagar|pago|geral|subtotal|sub|dos|produtos|itens|item|de|da|do|nota|cupom|fiscal|r\$|\s)+$')
              .hasMatch(nonPriceText)) {
        return true;
      }
    }

    return false;
  }

  /// Returns true if a candidate product name is actually a Total / Summary word.
  static bool _isTotalProductName(String name) {
    var lower = name.toLowerCase().trim();

    // Normalize OCR variations: ualor -> valor, ulr -> vlr, t0tal/tota1 -> total
    lower = lower
        .replaceAll(RegExp(r'\bualor\b'), 'valor')
        .replaceAll(RegExp(r'\bulr\b'), 'vlr')
        .replaceAll(RegExp(r'\bul\b'), 'vl')
        .replaceAll(RegExp(r'\bt0tal\b|\btota1\b'), 'total')
        .replaceAll(RegExp(r'\bt\s*o\s*t\s*a\s*l\b'), 'total');

    // Strip punctuation
    lower = lower
        .replaceAll(RegExp(r'[:=\-\*\#\.\,]'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();

    const totalExactNames = {
      'total',
      'subtotal',
      'sub total',
      'sub-total',
      'valor',
      'vlr',
      'vl',
      'valor total',
      'vlr total',
      'vl total',
      'valor total a pagar',
      'vlr total a pagar',
      'vl total a pagar',
      'total geral',
      'valor geral',
      'total a pagar',
      'valor a pagar',
      'total pago',
      'valor pago',
      'total liquido',
      'valor liquido',
      'total bruto',
      'valor bruto',
      'total produtos',
      'valor produtos',
      'total dos produtos',
      'valor dos produtos',
      'valor da nota',
      'total da nota',
      'valor do cupom',
      'total do cupom',
      'troco',
      'valor troco',
      'desconto',
      'descontos',
      'valor desconto',
      'acrescimo',
      'acrescimos',
      'valor acrescimo',
      'pagamento',
      'forma de pagamento',
      'valor recebido',
      'total recebido',
    };

    if (totalExactNames.contains(lower)) return true;

    // Check if starts with total / summary keywords
    if (lower.startsWith('total ') ||
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
        lower.startsWith('total:')) {
      return true;
    }

    // Match explicit summary phrases anywhere in candidate name
    if (RegExp(r'\b(?:valor\s*)?total\s*a\s*pagar\b').hasMatch(lower) ||
        RegExp(r'\bvalor\s*a\s*pagar\b').hasMatch(lower) ||
        RegExp(r'\b(?:valor\s*)?total\s*pago\b').hasMatch(lower)) {
      return true;
    }

    // If the name is made entirely of summary words
    final summaryWords = RegExp(
      r'^(?:total|vlr?|vl|valor|liq|liquido|líquido|bruto|a|pagar|pago|geral|subtotal|sub|dos|produtos|itens|item|de|da|do|nota|cupom|fiscal|\s)+$',
    );
    if (summaryWords.hasMatch(lower) &&
        (lower.contains('total') || lower.contains('valor') || lower.contains('vlr') || lower.contains('subtotal'))) {
      return true;
    }

    return false;
  }

  /// Cleans a raw receipt line into a human-readable product name:
  /// 1. Strips item indexes, codes, and barcodes.
  /// 2. Repairs character confusions ('0' vs 'O', 'v' vs 'u', escoua -> escova).
  /// 3. Reassembles split word fragments (e.g. "espon ja" -> "esponja", "es coua" -> "escova").
  /// 4. Removes trailing fiscal tags and tax rates (F1, T19%, etc.).
  /// 5. Expands common supermarket receipt abbreviations into readable names.
  static String _cleanReceiptProductName(String raw) {
    var s = raw;

    // 1. Remove leading item index and barcode (e.g. "001 08871124 ", "01 12345 ", "ITEM 01 7891000 ")
    s = s.replaceFirst(RegExp(r'^\s*(?:ITEM|IT|COD|CÓD)?\s*#?\s*\d{1,6}\s+\d{4,14}\s+', caseSensitive: false), '');
    s = s.replaceFirst(RegExp(r'^\s*(?:ITEM|IT|COD|CÓD)?\s*#?\s*\d{1,14}[\s\.\-]+', caseSensitive: false), '');
    // Also remove any lone leading barcode numbers remaining
    s = s.replaceFirst(RegExp(r'^\s*\d{7,14}\s+'), '');

    // 2. Remove trailing tax tags, fiscal flags and unit markers:
    // e.g.: "1un F1 10,39", "1un T19,00% 6,99", "1 UN X", "F1", "T19,00%", "T18%", "I1", "N1", "II", "FF", "NN"
    s = s.replaceAll(
      RegExp(r'\b\d+(?:[,\.]\d+)?\s*(?:UN|KG|G|L|LT|ML|PC|PCT|CX|EMB)\b.*$', caseSensitive: false),
      '',
    );
    s = s.replaceAll(
      RegExp(r'\b(?:F\d+|T\d+(?:[,\.]\d+)?%?|I\d+|N\d+|II|FF|NN)\b.*$', caseSensitive: false),
      '',
    );
    s = s.replaceAll(
      RegExp(r'\s+(?:UN|KG|LT|PC|R\$)\s*$', caseSensitive: false),
      '',
    );

    // 3. Tokenize words, merge split fragments (e.g. "espon ja" -> "esponja", "es coua" -> "escova"),
    // repair OCR character confusions ('0' vs 'o', 'v' vs 'u', escoua -> escova), and expand abbreviations
    // First expand multi-word phrases (e.g. "CR LEITE" -> "Creme de Leite", "L MOV" -> "Lava Móveis")
    for (final entry in _phraseAbbrevMap.entries) {
      final pattern = RegExp(r'\b' + RegExp.escape(entry.key) + r'\b', caseSensitive: false);
      s = s.replaceAll(pattern, entry.value);
    }

    var rawTokens = s.split(RegExp(r'\s+')).where((w) => w.trim().isNotEmpty).toList();

    // Merge fragments of words split by thermal printer gaps or OCR
    rawTokens = _mergeSplitWords(rawTokens);

    final cleanedWords = <String>[];

    for (var w in rawTokens) {
      if (w.trim().isEmpty) continue;

      final rawUpper = w.toUpperCase();
      if (_abbrevMap.containsKey(rawUpper)) {
        cleanedWords.add(_abbrevMap[rawUpper]!);
        continue;
      }

      // First repair OCR characters in word ('0' vs 'O', 'v' vs 'u', escoua -> escova)
      final repaired = _repairReceiptWord(w);
      final upper = repaired.toUpperCase();

      if (_abbrevMap.containsKey(upper)) {
        cleanedWords.add(_abbrevMap[upper]!);
      } else {
        cleanedWords.add(repaired);
      }
    }
    s = cleanedWords.join(' ');

    // 4. Remove dangling isolated noise tokens at the end like " M ", " X ", " 01 "
    final trailingMatch = RegExp(r'\s+([A-Za-z0-9]{1,2}(?:\s+[A-Za-z0-9]{1,2})*)\s*$').firstMatch(s);
    if (trailingMatch != null) {
      final trailingToken = trailingMatch.group(1)!.trim().toLowerCase();
      const validShortWords = {'po', 'pó', 'cha', 'chá', 'sal', 'uva', 'mel', 'ovo', 'pao', 'pão', 'de', 'em', 'un', 'kg', 'ml', 'g', 'l'};
      if (!validShortWords.contains(trailingToken)) {
        s = s.substring(0, trailingMatch.start).trim();
      }
    }
    s = s.replaceAll(RegExp(r'\s+'), ' ').trim();

    if (s.isEmpty || !RegExp(r'[a-zA-ZÀ-ÿ]').hasMatch(s)) {
      return '';
    }

    // Format nicely: Capitalize each word nicely (e.g. "Esponja Scotch Brite 90g")
    const minorPrepositions = {'de', 'da', 'do', 'das', 'dos', 'em', 'com', 'sem', 'e', 'para'};
    final parts = s.split(' ');
    final formatted = parts.map((p) {
      if (p.isEmpty) return '';
      // Preserve measurements lowercase (e.g. 500g, 1kg, 350ml)
      if (RegExp(r'^\d+(?:[,\.]\d+)?[a-zA-Z]{1,3}$').hasMatch(p)) {
        return p.toLowerCase();
      }
      final lower = p.toLowerCase();
      if (minorPrepositions.contains(lower)) {
        return lower;
      }
      return lower[0].toUpperCase() + lower.substring(1);
    }).join(' ');

    return formatted;
  }

  /// Merges adjacent word fragments that were split by receipt printer spacing or OCR errors.
  /// Examples:
  /// - "ESPON" + "JA" -> "ESPONJA"
  /// - "ES" + "COVA" -> "ESCOVA"
  /// - "ES" + "COUA" -> "ESCOVA"
  /// - "ESCO" + "VA" -> "ESCOVA"
  /// - "ES" + "CO" + "VA" -> "ESCOVA"
  /// - "MA" + "CA" + "RRAO" -> "MACARRAO"
  /// - "SA" + "BO" + "NETE" -> "SABONETE"
  /// - "CHO" + "CO" + "LATE" -> "CHOCOLATE"
  /// - "MULTI" + "USO" -> "MULTIUSO"
  static List<String> _mergeSplitWords(List<String> rawTokens) {
    if (rawTokens.length <= 1) return rawTokens;
    final result = <String>[];
    var i = 0;

    while (i < rawTokens.length) {
      // 1. Try 3-token merge (e.g. "ES" + "CO" + "VA" -> "ESCOVA", "MA" + "CA" + "RRAO" -> "MACARRAO")
      if (i + 2 < rawTokens.length) {
        final triple = '${rawTokens[i]}${rawTokens[i + 1]}${rawTokens[i + 2]}';
        final repairedTriple = _repairReceiptWord(triple);
        final normTriple = _normalizeWordForLookup(repairedTriple);
        if (_knownSingleWords.contains(normTriple)) {
          result.add(repairedTriple);
          i += 3;
          continue;
        }
      }

      // 2. Try 2-token merge (e.g. "ESPON" + "JA" -> "ESPONJA", "ES" + "COUA" -> "ESCOVA")
      if (i + 1 < rawTokens.length) {
        final pair = '${rawTokens[i]}${rawTokens[i + 1]}';
        final repairedPair = _repairReceiptWord(pair);
        final normPair = _normalizeWordForLookup(repairedPair);
        if (_knownSingleWords.contains(normPair)) {
          result.add(repairedPair);
          i += 2;
          continue;
        }
      }

      result.add(rawTokens[i]);
      i++;
    }

    return result;
  }

  /// Removes accents and converts to lowercase for dictionary lookup.
  static String _normalizeWordForLookup(String word) {
    var s = word.toLowerCase().trim();
    const diacritics = {
      'á': 'a', 'à': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a',
      'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
      'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
      'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
      'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
      'ç': 'c', 'ñ': 'n',
    };
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      buf.write(diacritics[s[i]] ?? s[i]);
    }
    return buf.toString();
  }

  /// Repairs OCR character confusions in receipt product words:
  /// a. Number '0' vs letter 'O':
  ///    - Words with letters (e.g. BISC0IT0, C0CA, ARR0Z, 0LEO, FEIJÃ0, M0LHO, QUEIJ0): '0' -> 'O'
  ///    - Measures (e.g. 500g, 350ml, 1kg, 200g): keeps zeros; repairs 'O' in digits (5O0g -> 500g).
  /// b. Letter 'v' vs 'u':
  ///    - Known thermal print confusions:
  ///      * ESCOUA -> ESCOVA, COUUA -> COUVE, NOUA -> NOVA, NOUO -> NOVO, OUO -> OVO
  ///      * CERUEJA -> CERVEJA, AUEIA -> AVEIA, OLIUA -> OLIVA
  ///      * SVCO -> SUCO, FRVTA -> FRUTA, IOGVRTE -> IOGURTE, QVEIJO -> QUEIJO, ACVCAR -> ACUCAR
  ///    - Preserves legitimate words like 'Uva', 'Louro', 'Muito', 'Suave'.
  static String _repairReceiptWord(String word) {
    if (word.isEmpty) return word;

    final upperWord = word.toUpperCase();
    if (upperWord == 'OL' || upperWord == 'SC') {
      return word;
    }

    // Check if the token is a measurement or unit quantity (e.g. 500G, 350ML, 1KG, 200G, C/10, 100%)
    final isMeasurement = RegExp(
      r'^\d*(?:[,\.]\d+)?[Oo0-9]+(?:g|kg|ml|l|lt|un|pc|pct|cx|emb|%)$',
      caseSensitive: false,
    ).hasMatch(word) || RegExp(r'^C/\d*$', caseSensitive: false).hasMatch(word);

    var w = word;

    if (isMeasurement) {
      // In measurements, 'O'/'o' is the digit '0' (e.g. 5O0g -> 500g, 35Oml -> 350ml, C/1O -> C/10)
      w = w.replaceAll(RegExp(r'[Oo]'), '0');
      return w;
    }

    // A. Confusing letter 'O' with digit '0':
    // If the word has letters, any '0' inside or at borders of alphabetical context is the letter 'O'
    if (RegExp(r'[a-zA-ZÀ-ÿ]').hasMatch(w) && w.contains('0')) {
      // 0 preceded or followed by letters (e.g. BISC0IT0 -> BISCOITO, C0CA -> COCA, ARR0Z -> ARROZ)
      w = w.replaceAllMapped(
        RegExp(r'(?<=[a-zA-ZÀ-ÿ])0+|0+(?=[a-zA-ZÀ-ÿ])'),
        (m) => 'O' * m.group(0)!.length,
      );
      // Word starting with 0 followed by letters (e.g. 0LEO -> OLEO, 0RG -> ORG)
      if (w.startsWith('0') && w.length >= 2) {
        w = 'O${w.substring(1)}';
      }
      // Word ending in 0 preceded by letters (e.g. FEIJA0 -> FEIJAO, PÃ0 -> PÃO)
      if (w.endsWith('0') && w.length >= 3) {
        w = '${w.substring(0, w.length - 1)}O';
      }
    }

    // B. Confusing letter 'v' with 'u':
    final upper = w.toUpperCase();

    // 1. Direct dictionary matches for known receipt words & brands
    if (_receiptWordFixes.containsKey(upper)) {
      return _receiptWordFixes[upper]!;
    }

    // 2. Phonotactic rules for Portuguese receipt words:

    // Portuguese never has 'QV'; always 'QU' (e.g. QVEIJO -> QUEIJO, QVE -> QUE, QVI -> QUI)
    if (upper.startsWith('QV')) {
      w = 'QU${w.substring(2)}';
    } else {
      w = w.replaceAllMapped(
        RegExp(r'qv', caseSensitive: false),
        (_) => 'qu',
      );
    }

    // 'ou[aeo]' where 'u' is actually 'v' (e.g. ESCOUA -> ESCOVA, COUUA -> COUVE, NOUA -> NOVA, NOUO -> NOVO, OUO -> OVO, PROUA -> PROVA, DESCOUA -> DESCOVA)
    // Note: Valid words like 'louro', 'roupa', 'ouro', 'cenoura' have a consonant after 'ou' (r, p, s, t), so they never match.
    w = w.replaceAllMapped(
      RegExp(r'([bcdfghjklmnpqrstz])ou([aeo])', caseSensitive: false),
      (m) => '${m[1]}ov${m[2]}',
    );
    // Word starting with 'ou' followed by vowel (e.g. OUO -> OVO, OUOS -> OVOS)
    w = w.replaceAllMapped(
      RegExp(r'^ou([aeo])', caseSensitive: false),
      (m) => 'ov${m[1]}',
    );

    // Consonant + 'V' + Consonant is phonotactically impossible in Portuguese -> 'U'
    // (e.g. FRVT -> FRUT, ACVC -> ACUC, IOGVR -> IOGUR, SVCO -> SUCO, ATVN -> ATUM/ATUN, MVLT -> MULT, BVRG -> BURG)
    w = w.replaceAllMapped(
      RegExp(r'([bcdfghjklmnpqrstz])v([bcdfghjklmnpqrstz])', caseSensitive: false),
      (m) => '${m[1]}u${m[2]}',
    );

    // Consonant + 'V' at end of word -> 'U' (e.g. PERV -> PERU, SAGV -> SAGU, CACAV -> CACAU)
    w = w.replaceAllMapped(
      RegExp(r'([bcdfghjklmnpqrstz]|ca)v$', caseSensitive: false),
      (m) => '${m[1]}u',
    );

    // 'RUE' -> 'RVE' (e.g. CERUEJA -> CERVEJA, SORUETE -> SORVETE, SERUIR -> SERVIR)
    w = w.replaceAllMapped(
      RegExp(r'rue', caseSensitive: false),
      (_) => 'rve',
    );

    // 'AUEI' -> 'AVEI' (e.g. AUEIA -> AVEIA)
    w = w.replaceAllMapped(
      RegExp(r'auei', caseSensitive: false),
      (_) => 'avei',
    );

    // 'OLIUA' / 'OIUA' -> 'OLIVA'
    w = w.replaceAllMapped(
      RegExp(r'oliua|oiua', caseSensitive: false),
      (_) => 'oliva',
    );

    // 'COUUE' -> 'COUVE'
    w = w.replaceAllMapped(
      RegExp(r'couue', caseSensitive: false),
      (_) => 'couve',
    );

    // 'ERUA' -> 'ERVA'
    w = w.replaceAllMapped(
      RegExp(r'erua', caseSensitive: false),
      (_) => 'erva',
    );

    // 'SUAUE' -> 'SUAVE'
    w = w.replaceAllMapped(
      RegExp(r'suaue', caseSensitive: false),
      (_) => 'suave',
    );

    // Prefixes where 'U' is 'V':
    final upperW = w.toUpperCase();
    if (upperW.startsWith('UAL') && upperW.length >= 4) {
      w = 'V${w.substring(1)}'; // UALOR -> VALOR, UALE -> VALE, UALIDADE -> VALIDADE
    } else if (upperW.startsWith('UIN') && upperW.length >= 4) {
      w = 'V${w.substring(1)}'; // UINHO -> VINHO, UINAGRE -> VINAGRE
    } else if (upperW.startsWith('UAG') && upperW.length >= 4) {
      w = 'V${w.substring(1)}'; // UAGEM -> VAGEM
    } else if (upperW.startsWith('UER') && upperW.length >= 4) {
      w = 'V${w.substring(1)}'; // UERDE -> VERDE, UERMELHO -> VERMELHO
    } else if (upperW.startsWith('UITA') && upperW.length >= 5) {
      w = 'V${w.substring(1)}'; // UITA -> VITA
    } else if (upperW.startsWith('UIG') && upperW.length >= 4) {
      w = 'V${w.substring(1)}'; // UIGOR -> VIGOR
    } else if (upperW.startsWith('UAN') && upperW.length >= 4) {
      w = 'V${w.substring(1)}'; // UANISH -> VANISH
    } else if (upperW.startsWith('UAS') && upperW.length >= 4) {
      w = 'V${w.substring(1)}'; // UASILHA -> VASILHA, UASSOURA -> VASSOURA
    } else if (upperW.startsWith('UAP') && upperW.length >= 4) {
      w = 'V${w.substring(1)}'; // UAPOR -> VAPOR
    }

    return w;
  }

  /// Known OCR word corrections for 'v' vs 'u', escoua -> escova, and common receipt misreadings.
  static final Map<String, String> _receiptWordFixes = {
    // escoua / escou -> escova
    'ESCOUA': 'Escova',
    'ESCOU': 'Escova',
    'ESCOUAS': 'Escovas',
    'ESCOUINHA': 'Escovinha',
    'ESCOUINHAS': 'Escovinhas',
    'DESCOUA': 'Descova',
    'UASSOURA': 'Vassoura',
    'UASSOUR': 'Vassoura',
    'UAPOR': 'Vapor',
    'CAME': 'Carne',

    // 'u' mistyped for 'v'
    'UALOR': 'Valor',
    'UALORES': 'Valores',
    'ULR': 'Vlr',
    'T0TAL': 'Total',
    'TOTA1': 'Total',
    'CERUEJA': 'Cerveja',
    'CERUEJ': 'Cerveja',
    'AUEIA': 'Aveia',
    'OLIUA': 'Oliva',
    'OIUA': 'Oliva',
    'COUUE': 'Couve',
    'SORUETE': 'Sorvete',
    'SUAUE': 'Suave',
    'UINHO': 'Vinho',
    'UINAGRE': 'Vinagre',
    'UINAG': 'Vinagre',
    'UAGEM': 'Vagem',
    'UERDE': 'Verde',
    'UERMELHO': 'Vermelho',
    'UERM': 'Vermelho',
    'ERUA': 'Erva',
    'SERUIR': 'Servir',
    'UIGOR': 'Vigor',
    'UITA': 'Vita',
    'UALE': 'Vale',
    'UANISH': 'Vanish',
    'UASILHA': 'Vasilha',
    'NOUO': 'Novo',
    'NOUA': 'Nova',
    'OUO': 'Ovo',
    'OUOS': 'Ovos',
    'LAUA': 'Lava',
    'LAUAR': 'Lavar',
    'PROUA': 'Prova',
    'ATIUO': 'Ativo',
    'ATIUA': 'Ativa',
    'LEUE': 'Leve',
    'LEUISSIMO': 'Levissimo',
    'AUELA': 'Avela',
    'AUELAS': 'Avelas',
    'SALUIA': 'Salvia',

    // 'v' mistyped for 'u'
    'SVCO': 'Suco',
    'FRVTA': 'Fruta',
    'FRVTAS': 'Frutas',
    'IOGVRTE': 'Iogurte',
    'AGVA': 'Água',
    'ACVCAR': 'Açúcar',
    'QVEIJO': 'Queijo',
    'ATVN': 'Atum',
    'MVLTI': 'Multi',
    'PVRO': 'Puro',
    'PERV': 'Peru',
    'GVARA': 'Guara',
    'GVARANA': 'Guarana',
    'NATVRAL': 'Natural',
    'NATVR': 'Natur',
    'CHVRRASCO': 'Churrasco',
    'CACAV': 'Cacau',
    'BVRGUER': 'Burguer',
    'MVFFIN': 'Muffin',
    'TRVFA': 'Trufa',
    'SAGV': 'Sagu',
    'GLVTEN': 'Gluten',
    'LVA': 'Lua',
    'PLVS': 'Plus',
    'SVRF': 'Surf',
    'AZVL': 'Azul',
    'LVZ': 'Luz',
    'CRVNCH': 'Crunch',
    'LEGVM': 'Legum',
    'MVSSE': 'Musse',
  };

  /// Multi-word compound abbreviations expanded before token-level substitution
  static final Map<String, String> _phraseAbbrevMap = {
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
    'EXTR TOM': 'Extrato de Tomate',
    'POLP TOM': 'Polpa de Tomate',
  };

  /// Common Brazilian supermarket receipt abbreviations expanded into clean words.
  static final Map<String, String> _abbrevMap = {
    // --- Laticínios e Frios ---
    'LT': 'Leite',
    'LEIT': 'Leite',
    'LTE': 'Leite',
    'INT': 'Integral',
    'INTEG': 'Integral',
    'DESN': 'Desnatado',
    'DESL': 'Desnatado',
    'DESNAT': 'Desnatado',
    'SEMI': 'Semidesnatado',
    'SEMIDESN': 'Semidesnatado',
    'PAST': 'Pasteurizado',
    'PASTEU': 'Pasteurizado',
    'CONDENS': 'Condensado',
    'COND': 'Condicionador', // Pode ser condicionador em higiene ou condensado dependendo do contexto
    'CONDIC': 'Condicionador',
    'MARG': 'Margarina',
    'MARGAR': 'Margarina',
    'MANTEIG': 'Manteiga',
    'MANT': 'Manteiga',
    'IORG': 'Iogurte',
    'IOG': 'Iogurte',
    'IOGUR': 'Iogurte',
    'QUEIJ': 'Queijo',
    'QUEJ': 'Queijo',
    'QJ': 'Queijo',
    'QJO': 'Queijo',
    'PRES': 'Presunto',
    'PRESUN': 'Presunto',
    'MUSSA': 'Mussarela',
    'MUSS': 'Mussarela',
    'MUSSAR': 'Mussarela',
    'MOZZ': 'Mussarela',
    'MOZ': 'Mussarela',
    'PARM': 'Parmesão',
    'PARMES': 'Parmesão',
    'PRAT': 'Prato',
    'PROV': 'Provolone',
    'RICOT': 'Ricota',
    'CHED': 'Cheddar',
    'CHEDD': 'Cheddar',
    'REQ': 'Requeijão',
    'REQUEIJ': 'Requeijão',
    'BEB': 'Bebida',
    'LACT': 'Láctea',
    'LAC': 'Zero Lactose',
    'C/LAC': 'Com Lactose',
    'S/LAC': 'Sem Lactose',
    'SLAC': 'Sem Lactose',
    'FAT': 'Fatiado',
    'FATIAD': 'Fatiado',
    'RAL': 'Ralado',
    'RALAD': 'Ralado',
    'PED': 'Pedaço',

    // --- Carnes, Aves, Peixes e Embutidos ---
    'BOV': 'Bovino',
    'BOVINA': 'Bovina',
    'SUIN': 'Suíno',
    'SUINA': 'Suína',
    'CARN': 'Carne',
    'FRANG': 'Frango',
    'PEIT': 'Peito',
    'ALCAT': 'Alcatra',
    'ALCATR': 'Alcatra',
    'PATIN': 'Patinho',
    'PAT': 'Patinho',
    'COST': 'Costela',
    'COSTEL': 'Costela',
    'LING': 'Linguiça',
    'LINGU': 'Linguiça',
    'SALS': 'Salsicha',
    'SALSI': 'Salsicha',
    'MOID': 'Moída',
    'MOIDA': 'Moída',
    'PIC': 'Picado',
    'PICAD': 'Picado',
    'ACEM': 'Acém',
    'MUSC': 'Músculo',
    'MUSCUL': 'Músculo',
    'COX': 'Coxão',
    'MOLE': 'Mole',
    'DUR': 'Duro',
    'FRALD': 'Fraldinha',
    'FRALDINH': 'Fraldinha',
    'MAMINH': 'Maminha',
    'PICANH': 'Picanha',
    'CONTRA': 'Contrafilé',
    'C/FILE': 'Contrafilé',
    'FILE': 'Filé',
    'LOMB': 'Lombo',
    'LOMBO': 'Lombo',
    'BIST': 'Bisteca',
    'BISTEC': 'Bisteca',
    'CUPIM': 'Cupim',
    'SOBRECOX': 'Sobrecoxa',
    'S/COXA': 'Sobrecoxa',
    'CORAC': 'Coração',
    'CORACAO': 'Coração',
    'MOEG': 'Moela',
    'SARD': 'Sardinha',
    'SARDIN': 'Sardinha',
    'ATU': 'Atum',
    'BACALH': 'Bacalhau',
    'TILAP': 'Tilápia',
    'SALM': 'Salmão',
    'CAMAR': 'Camarão',
    'DEF': 'Defumado',
    'DEFUM': 'Defumado',
    'DEFUMAD': 'Defumado',

    // --- Congelados & Prontos ---
    'CONG': 'Congelado',
    'CONGEL': 'Congelado',
    'EMP': 'Empanado',
    'EMPAN': 'Empanado',
    'NUGG': 'Nuggets',
    'HAMB': 'Hambúrguer',
    'HAMBURG': 'Hambúrguer',
    'BURGUER': 'Hambúrguer',
    'ALMOND': 'Almôndegas',
    'LASANH': 'Lasanha',
    'PIZZ': 'Pizza',

    // --- Mercearia & Grãos ---
    'ARR': 'Arroz',
    'FEIJ': 'Feijão',
    'FAR': 'Farinha',
    'FARIN': 'Farinha',
    'TRG': 'Trigo',
    'TRIG': 'Trigo',
    'ACUC': 'Açúcar',
    'ACU': 'Açúcar',
    'CRIST': 'Cristal',
    'REFIN': 'Refinado',
    'MAC': 'Macarrão',
    'MACARR': 'Macarrão',
    'MACARRAO': 'Macarrão',
    'ESPAG': 'Espaguete',
    'PARAF': 'Parafuso',
    'PENNE': 'Penne',
    'MOLH': 'Molho',
    'EXTR': 'Extrato',
    'POLP': 'Polpa',
    'TEMPR': 'Tempero',
    'TEMP': 'Tempero',
    'COMPL': 'Completo',
    'OREG': 'Orégano',
    'OREGAN': 'Orégano',
    'AZEIT': 'Azeite',
    'VINAG': 'Vinagre',
    'VIN': 'Vinagre',
    'MAION': 'Maionese',
    'MAIONESE': 'Maionese',
    'KETCH': 'Ketchup',
    'KET': 'Ketchup',
    'MOST': 'Mostarda',
    'MILH': 'Milho',
    'ERVILH': 'Ervilha',
    'ERV': 'Ervilha',
    'PALM': 'Palmito',
    'COGUM': 'Cogumelo',
    'CHAMP': 'Champignon',
    'AZEITON': 'Azeitona',
    'S/CAROÇO': 'Sem Caroço',
    'S/CAROCO': 'Sem Caroço',
    'C/CAROÇO': 'Com Caroço',
    'C/CAROCO': 'Com Caroço',
    'SC': 'Saco',
    'SACO': 'Saco',
    'SCL': 'Sacola',
    'SACOL': 'Sacola',
    'OL': 'Óleo',
    'OLEO': 'Óleo',
    'ÓLEO': 'Óleo',
    'SOJ': 'Soja',
    'GIRASS': 'Girassol',
    'MIL': 'Milho',
    'CANOL': 'Canola',

    // --- Hortifruti & Vegetais ---
    'VEG': 'Vegetal',
    'VEGET': 'Vegetal',
    'HORT': 'Hortifruti',
    'LEG': 'Legumes',
    'VERD': 'Verduras',
    'FRUT': 'Frutas',
    'TOMAT': 'Tomate',
    'TOM': 'Tomate',
    'CEB': 'Cebola',
    'BAT': 'Batata',
    'BATAT': 'Batata',
    'CEN': 'Cenoura',
    'CENOUR': 'Cenoura',
    'ALF': 'Alface',
    'BAN': 'Banana',
    'LAR': 'Laranja',
    'LARANJ': 'Laranja',
    'MACA': 'Maçã',
    'LIM': 'Limão',
    'LIMAO': 'Limão',
    'MAM': 'Mamão',
    'MAMAO': 'Mamão',
    'MELANC': 'Melancia',
    'ABAC': 'Abacaxi',
    'ABOB': 'Abóbora',
    'ABOBR': 'Abobrinha',
    'CHUCH': 'Chuchu',
    'PIM': 'Pimentão',
    'PIMENT': 'Pimenta',
    'ALH': 'Alho',
    'PORO': 'Poró',
    'CHEIV': 'Cheiro Verde',
    'CH/VERD': 'Cheiro Verde',
    'CH/VERDE': 'Cheiro Verde',

    // --- Matinais, Doces & Sobremesas ---
    'BISC': 'Biscoito',
    'BOL': 'Bolacha',
    'RECH': 'Recheado',
    'RECHEAD': 'Recheado',
    'SALG': 'Salgado',
    'SALGAD': 'Salgado',
    'DOC': 'Doce',
    'CRACK': 'Cracker',
    'WAFF': 'Wafer',
    'TORR': 'Torrada',
    'TORRAD': 'Torrada',
    'PAO FRANC': 'Pão Francês',
    'PAO FORM': 'Pão de Forma',
    'BISNAG': 'Bisnaguinha',
    'CHOC': 'Chocolate',
    'ACHOC': 'Achocolatado',
    'ACHOCOL': 'Achocolatado',
    'CAC': 'Cacau',
    'AVEI': 'Aveia',
    'CEREAL': 'Cereal',
    'BAR': 'Barra',
    'SBRM': 'Sobremesa',
    'GELAT': 'Gelatina',
    'GELE': 'Geleia',
    'GELEIA': 'Geleia',
    'ADOC': 'Adoçante',
    'ADOCANT': 'Adoçante',
    'MEL': 'Mel',
    'PUD': 'Pudim',
    'PUDIM': 'Pudim',

    // --- Bebidas ---
    'REFRIG': 'Refrigerante',
    'REF': 'Refrigerante',
    'REFRI': 'Refrigerante',
    'CERV': 'Cerveja',
    'CERVEJ': 'Cerveja',
    'CHOP': 'Chopp',
    'SUC': 'Suco',
    'AG': 'Água',
    'AGU': 'Água',
    'MIN': 'Mineral',
    'MINER': 'Mineral',
    'S/GAS': 'Sem Gás',
    'SGAS': 'Sem Gás',
    'C/GAS': 'Com Gás',
    'CGAS': 'Com Gás',
    'TON': 'Tônica',
    'TONIC': 'Tônica',
    'ESPUM': 'Espumante',
    'ENERG': 'Energético',
    'ISOT': 'Isotônico',
    'CHA': 'Chá',

    // --- Higiene & Beleza ---
    'SAB': 'Sabonete',
    'SABON': 'Sabonete',
    'SH': 'Shampoo',
    'SHAMP': 'Shampoo',
    'SHAMPO': 'Shampoo',
    'SHP': 'Shampoo',
    'COND': 'Condicionador',
    'CONDIC': 'Condicionador',
    'CND': 'Condicionador',
    'DESOD': 'Desodorante',
    'DES': 'Desodorante',
    'AER': 'Aerossol',
    'AEROS': 'Aerossol',
    'ROLL': 'Roll-on',
    'CREM DENT': 'Creme Dental',
    'CR DENT': 'Creme Dental',
    'DENT': 'Dental',
    'CREM': 'Creme',
    'CR': 'Creme',
    'ESCOV': 'Escova',
    'ESCOUA': 'Escova',
    'HIDRAT': 'Hidratante',
    'HIDR': 'Hidratante',
    'HID': 'Hidratante',
    'FRAL': 'Fralda',
    'ABS': 'Absorvente',
    'ABSORV': 'Absorvente',
    'PROT': 'Protetor',
    'SOL': 'Solar',
    'ANTISS': 'Antisséptico',
    'ANTISSEP': 'Antisséptico',
    'ENXAG': 'Enxaguante',
    'BUCAL': 'Bucal',
    'HAST': 'Hastes Flexíveis',
    'COTON': 'Cotonetes',
    'ALGOD': 'Algodão',
    'LENCO': 'Lenço Umedecido',
    'UMED': 'Umedecido',
    'DESC': 'Descartável',

    // --- Limpeza & Utilidades ---
    'DET': 'Detergente',
    'DETERG': 'Detergente',
    'AMAC': 'Amaciante',
    'AMACIANT': 'Amaciante',
    'CONC': 'Concentrado',
    'LIMP': 'Limpador',
    'DESINF': 'Desinfetante',
    'DESINFET': 'Desinfetante',
    'MULT': 'Multiuso',
    'MULTIUS': 'Multiuso',
    'ESPONJA': 'Esponja',
    'ESP': 'Esponja',
    'PANO': 'Pano',
    'FLAN': 'Flanela',
    'UASSOURA': 'Vassoura',
    'ROD': 'Rodo',
    'LAV': 'Lava',
    'ROUP': 'Roupas',
    'ROUPA': 'Roupas',
    'LOUC': 'Louças',
    'LOUCA': 'Louças',
    'MOV': 'Móveis',
    'MOVEIS': 'Móveis',
    'DESENG': 'Desengordurante',
    'DESENGORD': 'Desengordurante',
    'ALVEJ': 'Alvejante',
    'SANIT': 'Sanitário',
    'SANITARIA': 'Sanitária',
    'SANITARIO': 'Sanitário',
    'CLOR': 'Cloro',
    'AG SANIT': 'Água Sanitária',
    'AGUA SANIT': 'Água Sanitária',
    'SAB EM PO': 'Sabão em Pó',
    'SAB PO': 'Sabão em Pó',
    'SAB BARRA': 'Sabão em Barra',
    'PAPEL HIG': 'Papel Higiênico',
    'GUARD': 'Guardanapo',
    'TOALH': 'Toalha',
    'LIX': 'Lixo',
    'LIXO': 'Lixo',
    'INSET': 'Inseticida',
    'REPEL': 'Repelente',
    'ODOR': 'Odorizador',
    'AROMAT': 'Aromatizador',

    // --- Embalagens, Medidas e Termos Comerciais ---
    'PCT': 'Pacote',
    'PACOT': 'Pacote',
    'CX': 'Caixa',
    'CXA': 'Caixa',
    'FD': 'Fardo',
    'FARDO': 'Fardo',
    'GAR': 'Garrafa',
    'GARRAF': 'Garrafa',
    'LAT': 'Lata',
    'LATA': 'Lata',
    'EMB': 'Embalagem',
    'EMBAL': 'Embalagem',
    'BDJ': 'Bandeja',
    'BANDEJ': 'Bandeja',
    'PET': 'Pet',
    'REFIL': 'Refil',
    'ECON': 'Econômica',
    'ECONOM': 'Econômico',
    'LEVE': 'Leve',
    'PAG': 'Pague',
    'PAGUE': 'Pague',
    'PROM': 'Promoção',
    'PROMO': 'Promoção',
    'TRAD': 'Tradicional',
    'TRADIC': 'Tradicional',
    'ESP': 'Especial', // Tratado como Esponja se isolado ou produto de limpeza
    'ORIG': 'Original',
    'NAT': 'Natural',
    'NATUR': 'Natural',
    'SABOR': 'Sabor',
    'SAB': 'Sabonete', // Padrão sabonete se em maiúsculo
    'LIQ': 'Líquido',
    'LIQUID': 'Líquido',
    'PO': 'Pó',
    'UN': 'Unidade',
    'UND': 'Unidade',
    'C/': 'Com',
    'S/': 'Sem',
    'UALOR': 'Valor',
    'VALOR': 'Valor',
  };

  /// Public access to phrase-level abbreviations.
  static Map<String, String> get phraseAbbrevMap => _phraseAbbrevMap;

  /// Public access to common supermarket abbreviations.
  static Map<String, String> get abbrevMap => _abbrevMap;

  /// Single-word supermarket dictionary for detecting and merging split word fragments.
  static final Set<String> _knownSingleWords = _buildKnownSingleWords();

  static Set<String> _buildKnownSingleWords() {
    final set = <String>{
      'esponja',
      'escova',
      'escovinha',
      'escovas',
      'sabonete',
      'shampoo',
      'condicionador',
      'detergente',
      'amaciante',
      'limpador',
      'desinfetante',
      'multiuso',
      'desodorante',
      'hidratante',
      'chocolate',
      'refrigerante',
      'margarina',
      'manteiga',
      'presunto',
      'queijo',
      'iogurte',
      'macarrao',
      'biscoito',
      'bolacha',
      'farinha',
      'acucar',
      'cebola',
      'batata',
      'tomate',
      'laranja',
      'banana',
      'azeite',
      'azeitona',
      'maionese',
      'vinagre',
      'tempero',
      'torrada',
      'salgado',
      'fralda',
      'guardanapo',
      'sanitario',
      'higienico',
      'vassoura',
      'cerveja',
      'aveia',
      'oliva',
      'couve',
      'sorvete',
      'suave',
      'vinho',
      'vagem',
      'verde',
      'vermelho',
      'lavanderia',
      'mistura',
      'salsicha',
      'linguica',
      'hamburguer',
      'churrasco',
      'requeijao',
      'espaguete',
      'lasanha',
      'extrato',
      'palmito',
      'ervilha',
      'abobora',
      'abobrinha',
      'cenoura',
      'beterraba',
      'brocolis',
      'espinafre',
      'melancia',
      'abacaxi',
      'morango',
      'maracuja',
      'pessego',
      'castanha',
      'amendoim',
      'amido',
      'polvilho',
      'fermento',
      'gelatina',
      'achocolatado',
      'adocante',
      'patinho',
      'alcatra',
      'picanha',
      'costela',
      'sobrecoxa',
      'sardinha',
      'camarao',
      'bisnaguinha',
      'alface',
      'mandioca',
      'pimenta',
      'cominho',
      'colorau',
      'paprica',
      'creme',
      'leite',
      'arroz',
      'feijao',
      'carne',
      'frango',
      'peixe',
      'peito',
      'coxa',
      'bacon',
      'salame',
      'mortadela',
      'fuba',
      'milho',
      'trigo',
      'alho',
      'maca',
      'pera',
      'limao',
      'mamao',
      'melao',
      'uva',
      'goiaba',
      'roupas',
      'vanish',
      'comfort',
      'downy',
      'ariel',
      'brilhante',
      'omo',
      'ype',
      'limpol',
      'veja',
      'pinho',
      'sadia',
      'seara',
      'perdigao',
      'heineken',
      'brahma',
      'skol',
      'amstel',
      'budweiser',
      'stella',
      'corona',
      'piracanjuba',
      'itambe',
      'vigor',
      'tirolez',
      'danone',
      'nestle',
      'coca',
      'cola',
      'pepsi',
      'fanta',
      'sprite',
      'schweppes',
      'guarana',
      'tang',
      'maguary',
      'delvalle',
      'rexona',
      'dove',
      'nivea',
      'colgate',
      'sorriso',
      'oralb',
      'sensodyne',
      'gillette',
      'pantene',
      'palmolive',
      'listerine',
      'pampers',
      'huggies',
      'trakinas',
      'passatempo',
      'oreo',
      'bono',
      'wafer',
      'cracker',
      'maizena',
      'toddy',
      'nescau',
      'nutella',
      'yakult',
      'toddynho',
      'chamyto',
      'chambinho',
      'almondega',
      'empanado',
      'nuggets',
      'mostarda',
      'ketchup',
      'molho',
      'flan',
      'pudim',
      'doce',
      'geleia',
      'goiabada',
      'bala',
      'chiclete',
      'bombom',
      'barra',
      'tablete',
      'algodao',
      'curativo',
      'alcool',
      'inseticida',
      'repelente',
      'palito',
      'filtro',
      'coador',
      'espeto',
      'carvao',
      'acendedor',
      'pilha',
      'bateria',
      'lampada',
      'vela',
      'fosforo',
      'isqueiro',
      'balde',
      'bacia',
      'rodo',
      'luva',
      'prendedor',
      'varal',
      'flanela',
      'perfex',
      'cera',
      'cloro',
      'alvejante',
      'sanitaria',
      'integral',
      'desnatado',
      'semidesnatado',
      'refinado',
      'cristal',
      'caseiro',
      'fresco',
      'congelado',
      'defumado',
      'temperado',
      'recheado',
      'crocante',
      'granulado',
      'moido',
      'fatiado',
      'picado',
      'ralado',
    };

    // Load single words from CategoryClassifier keyword dictionary
    for (final list in CategoryClassifier.defaultKeywordDictionary.values) {
      for (final kw in list) {
        final clean = _normalizeWordForLookup(kw);
        if (!clean.contains(' ') && clean.length >= 4) {
          set.add(clean);
        }
      }
    }

    return set;
  }
}
