class AppFormatters {
  static String formatCurrency(double value) {
    final isNegative = value < 0;
    final absVal = value.abs();
    final parts = absVal.toStringAsFixed(2).split('.');
    final intPart = parts[0];
    final decPart = parts[1];

    final buffer = StringBuffer();
    for (var i = 0; i < intPart.length; i++) {
      final reverseIndex = intPart.length - i;
      buffer.write(intPart[i]);
      if (reverseIndex > 1 && reverseIndex % 3 == 1) {
        buffer.write('.');
      }
    }

    return '${isNegative ? '-' : ''}R\$ ${buffer.toString()},$decPart';
  }

  static double? parsePrice(String rawInput) {
    final cleaned = rawInput
        .replaceAll('R\$', '')
        .replaceAll(' ', '')
        .trim();
    if (cleaned.isEmpty) return null;

    // Handle 1.234,56 vs 12,50 vs 12.50
    String normalized;
    if (cleaned.contains(',') && cleaned.contains('.')) {
      normalized = cleaned.replaceAll('.', '').replaceAll(',', '.');
    } else if (cleaned.contains(',')) {
      normalized = cleaned.replaceAll(',', '.');
    } else {
      normalized = cleaned;
    }

    final parsed = double.tryParse(normalized);
    if (parsed == null || parsed < 0) return null;
    return parsed;
  }

  /// Parses a quantity string from NFC-e, receipts, or user input.
  /// Handles formats like "1,000", "1.000", "1,0000", "1.0000", "2.000", "0,450", "12".
  /// In Brazilian fiscal NFC-e documents, quantity has up to 4 decimal places without
  /// thousands separators (e.g. 1.0000 UN, 0.450 KG).
  /// If a quantity was captured as an unscaled multiple of 1000 or 10000 (like 1000 for 1x, 2000 for 2x)
  /// and unit is not grams ('g'), it normalizes it back to units (1.0, 2.0).
  static double? parseQuantity(String rawInput, {String? unit}) {
    final cleaned = rawInput.trim().replaceAll(' ', '');
    if (cleaned.isEmpty) return null;

    String normalized;
    if (cleaned.contains(',') && cleaned.contains('.')) {
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        normalized = cleaned.replaceAll('.', '').replaceAll(',', '.');
      } else {
        normalized = cleaned.replaceAll(',', '');
      }
    } else if (cleaned.contains(',')) {
      normalized = cleaned.replaceAll(',', '.');
    } else {
      normalized = cleaned;
    }

    double? parsed = double.tryParse(normalized);
    if (parsed == null || parsed <= 0) return null;

    final normUnit = (unit != null) ? normalizeUnit(unit) : '';
    // If unit is not grams ('g') and value is a multiple of 1000 or 10000 from fiscal 3-4 decimal parsing
    if (normUnit != 'g') {
      if (parsed >= 10000 && parsed % 10000 == 0) {
        parsed = parsed / 10000;
      } else if (parsed >= 1000 && parsed % 1000 == 0) {
        parsed = parsed / 1000;
      }
    }

    return parsed;
  }

  static String formatDate(DateTime date) {
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final year = date.year;
    final hour = date.hour.toString().padLeft(2, '0');
    final minute = date.minute.toString().padLeft(2, '0');
    return '$day/$month/$year às $hour:$minute';
  }

  static String formatShortDate(DateTime date) {
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final year = date.year;
    return '$day/$month/$year';
  }

  /// Normalizes any raw unit token into one of the canonical app units:
  /// 'un', 'kg', 'g', 'L', 'ml', 'dz', 'cx', 'pct'
  static String normalizeUnit(String rawUnit) {
    final u = rawUnit.toLowerCase().replaceAll(RegExp(r'[^a-zÀ-ÿ]'), '').trim();
    if (u == 'kg' || u == 'kilo' || u == 'kilos' || u == 'quilo' || u == 'quilos') {
      return 'kg';
    }
    if (u == 'g' || u == 'gr' || u == 'grs' || u == 'grama' || u == 'gramas') {
      return 'g';
    }
    if (u == 'dz' || u == 'duzia' || u == 'dúzia' || u == 'duzias' || u == 'dúzias') {
      return 'dz';
    }
    if (u == 'cx' || u == 'cxa' || u == 'caixa' || u == 'caixas') {
      return 'cx';
    }
    if (u == 'pct' || u == 'pc' || u == 'pacote' || u == 'pacotes') {
      return 'pct';
    }
    if (u == 'l' || u == 'lt' || u == 'lts' || u == 'litro' || u == 'litros') {
      return 'L';
    }
    if (u == 'ml' || u == 'mls') {
      return 'ml';
    }
    return 'un';
  }

  /// Formats quantity with unit, e.g.:
  /// 1.0, 'un' -> '1 un'
  /// 2.0, 'un' -> '2 un'
  /// 0.54, 'kg' -> '0,54 kg'
  static String formatQuantity(double quantity, [String unit = 'un']) {
    final cleanUnit = normalizeUnit(unit);
    final String qtyStr;
    if (quantity == quantity.roundToDouble()) {
      qtyStr = quantity.toInt().toString();
    } else {
      var s = quantity.toStringAsFixed(3);
      while (s.endsWith('0')) {
        s = s.substring(0, s.length - 1);
      }
      if (s.endsWith('.')) {
        s = s.substring(0, s.length - 1);
      }
      qtyStr = s.replaceAll('.', ',');
    }
    return '$qtyStr $cleanUnit';
  }
}
