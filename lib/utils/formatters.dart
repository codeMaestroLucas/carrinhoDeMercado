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
}
