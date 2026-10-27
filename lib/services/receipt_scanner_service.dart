import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import '../utils/formatters.dart';

class ScannedReceiptItem {
  ScannedReceiptItem({
    required this.name,
    required this.price,
  });

  String name;
  double price;
}

class ReceiptScannerService {
  static final List<String> _ignoredReceiptKeywords = [
    'cnpj',
    'inscricao estadual',
    'documento auxiliar',
    'nota fiscal',
    'cupom fiscal',
    'consumidor',
    'qtd. total',
    'qtd total',
    'valor total',
    'valor a pagar',
    'subtotal',
    'sub-total',
    'desconto',
    'acrescimo',
    'forma de pagamento',
    'forma pagamento',
    'cartao de credito',
    'cartao de debito',
    'credito',
    'debito',
    'dinheiro',
    'troco',
    'tributos',
    'aproximados',
    'lei federal',
    'ibpt',
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
  ];

  /// Extracts text from an image file using on-device ML Kit OCR, reconstructing
  /// horizontal receipt rows by sorting and grouping text lines by Y coordinate.
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

      // Sort lines top-to-bottom
      allLines.sort(
        (a, b) => a.boundingBox.top.compareTo(b.boundingBox.top),
      );

      // Group lines that are on the same horizontal row (within vertical tolerance)
      final groupedRows = <List<TextLine>>[];
      for (final line in allLines) {
        if (groupedRows.isEmpty) {
          groupedRows.add([line]);
          continue;
        }
        final lastRow = groupedRows.last;
        final avgTop = lastRow
                .map((l) => l.boundingBox.center.dy)
                .reduce((a, b) => a + b) /
            lastRow.length;
        final avgHeight = lastRow
                .map((l) => l.boundingBox.height)
                .reduce((a, b) => a + b) /
            lastRow.length;

        if ((line.boundingBox.center.dy - avgTop).abs() <= avgHeight * 0.65) {
          lastRow.add(line);
        } else {
          groupedRows.add([line]);
        }
      }

      final buffer = StringBuffer();
      for (final row in groupedRows) {
        row.sort((a, b) => a.boundingBox.left.compareTo(b.boundingBox.left));
        buffer.writeln(row.map((l) => l.text.trim()).join(' '));
      }

      return buffer.toString();
    } finally {
      await textRecognizer.close();
    }
  }

  /// Parses raw OCR text from a Brazilian receipt (NFC-e / Cupom Fiscal) into
  /// a list of [ScannedReceiptItem] containing product name and price paid.
  static List<ScannedReceiptItem> parseReceiptText(String rawText) {
    if (rawText.trim().isEmpty) return [];

    final lines = rawText
        .split(RegExp(r'[\r\n]+'))
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();

    final items = <ScannedReceiptItem>[];
    String? pendingProductName;

    // Matches Brazilian decimal prices like 12,90 or 1.234,56 or 8.50 at end of line
    final priceRegex = RegExp(r'(\d{1,3}(?:\.\d{3})*[,\.]\d{2})\b');
    // Matches quantity X unit price lines like "1 UN X 12,90" or "0,540 KG X 29,90"
    final qtyMultiplierRegex = RegExp(
      r'^\d+(?:[,\.]\d+)?\s*(?:un|kg|g|l|lt|ml|pc|pct|cx|emb)?\s*[xX*]\s*\d+[,\.]\d{2}',
      caseSensitive: false,
    );

    for (var i = 0; i < lines.length; i++) {
      final rawLine = lines[i];
      if (_shouldIgnoreReceiptLine(rawLine)) {
        pendingProductName = null;
        continue;
      }

      // Case 1: Line is purely a quantity * unit_price = total_price line following a product name line
      if (qtyMultiplierRegex.hasMatch(rawLine) && pendingProductName != null) {
        final matches = priceRegex.allMatches(rawLine).toList();
        if (matches.isNotEmpty) {
          final lastPriceStr = matches.last.group(1)!;
          final parsedPrice = AppFormatters.parsePrice(lastPriceStr);
          if (parsedPrice != null && parsedPrice > 0 && parsedPrice < 10000) {
            items.add(
              ScannedReceiptItem(
                name: pendingProductName,
                price: parsedPrice,
              ),
            );
            pendingProductName = null;
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

        // Extract product name before the price/quantity section
        final firstMatch = priceMatches.first;
        final beforePrices = rawLine.substring(0, firstMatch.start).trim();
        final cleanedName = _cleanReceiptProductName(beforePrices);

        if (parsedPrice != null && parsedPrice > 0 && parsedPrice < 10000) {
          if (cleanedName.length >= 2) {
            items.add(
              ScannedReceiptItem(
                name: cleanedName,
                price: parsedPrice,
              ),
            );
            pendingProductName = null;
            continue;
          } else if (pendingProductName != null) {
            items.add(
              ScannedReceiptItem(
                name: pendingProductName,
                price: parsedPrice,
              ),
            );
            pendingProductName = null;
            continue;
          }
        }
      }

      // Case 3: Line has no valid price, might be the product name for the next line
      final candidateName = _cleanReceiptProductName(rawLine);
      if (candidateName.length >= 3) {
        pendingProductName = candidateName;
      }
    }

    return items;
  }

  static bool _shouldIgnoreReceiptLine(String line) {
    final lower = line.toLowerCase();
    for (final keyword in _ignoredReceiptKeywords) {
      if (lower.contains(keyword)) return true;
    }
    // Ignore lines that are just dates/times or long numeric keys (44-digit NFC-e access key)
    final digitsOnly = line.replaceAll(RegExp(r'\D'), '');
    if (digitsOnly.length >= 18) return true;
    if (RegExp(r'^\d{2}/\d{2}/\d{2,4}').hasMatch(line)) return true;
    return false;
  }

  static String _cleanReceiptProductName(String raw) {
    var s = raw;
    // Remove leading item index + barcode (e.g. "001 7891000100103 " or "01 12345 ")
    s = s.replaceFirst(RegExp(r'^\s*\d{1,4}\s+\d{4,14}\s+'), '');
    // Remove leading item index or barcode alone (e.g. "001 " or "7891000100103 ")
    s = s.replaceFirst(RegExp(r'^\s*\d{1,14}[\s\.\-]+'), '');
    // Remove trailing quantity/unit markers like "1 UN X", "1,000 KG", "UN", "R$"
    s = s.replaceAll(
      RegExp(
        r'\b\d+(?:[,\.]\d+)?\s*(?:UN|KG|G|L|LT|ML|PC|PCT|CX|EMB)\s*[xX*]?\s*$',
        caseSensitive: false,
      ),
      '',
    );
    s = s.replaceAll(
      RegExp(r'\s+(?:UN|KG|LT|PC|R\$)\s*$', caseSensitive: false),
      '',
    );
    s = s.replaceAll(RegExp(r'\s+'), ' ').trim();

    if (s.isEmpty || !RegExp(r'[a-zA-ZÀ-ÿ]').hasMatch(s)) {
      return '';
    }

    // Format nicely: Capitalize first letter, lowercase rest if ALL CAPS
    if (s == s.toUpperCase() && s.length > 1) {
      final lower = s.toLowerCase();
      return lower[0].toUpperCase() + lower.substring(1);
    }
    return s[0].toUpperCase() + s.substring(1);
  }
}
