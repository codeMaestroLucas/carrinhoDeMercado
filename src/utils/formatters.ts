export const AppFormatters = {
  formatCurrency(value: number): string {
    const isNegative = value < 0;
    const absVal = Math.abs(value);
    const [intPart, decPart] = absVal.toFixed(2).split('.');

    let formattedInt = '';
    for (let i = 0; i < intPart.length; i++) {
      const reverseIndex = intPart.length - i;
      formattedInt += intPart[i];
      if (reverseIndex > 1 && reverseIndex % 3 === 1) {
        formattedInt += '.';
      }
    }

    return `${isNegative ? '-' : ''}R$ ${formattedInt},${decPart}`;
  },

  parsePrice(rawInput: string): number | null {
    const cleaned = rawInput.replace(/R\$/g, '').replace(/\s+/g, '').trim();
    if (!cleaned) return null;

    let normalized: string;
    if (cleaned.includes(',') && cleaned.includes('.')) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
      normalized = cleaned.replace(',', '.');
    } else {
      normalized = cleaned;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed;
  },

  parseQuantity(rawInput: string, unit?: string): number | null {
    const cleaned = rawInput.trim().replace(/\s+/g, '');
    if (!cleaned) return null;

    let normalized: string;
    if (cleaned.includes(',') && cleaned.includes('.')) {
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        normalized = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        normalized = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',')) {
      normalized = cleaned.replace(',', '.');
    } else {
      normalized = cleaned;
    }

    let parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;

    const normUnit = unit ? AppFormatters.normalizeUnit(unit) : '';
    if (normUnit !== 'g') {
      if (parsed >= 10000 && parsed % 10000 === 0) {
        parsed = parsed / 10000;
      } else if (parsed >= 1000 && parsed % 1000 === 0) {
        parsed = parsed / 1000;
      }
    }

    return parsed;
  },

  formatDate(dateInput: Date | string): string {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} às ${hour}:${minute}`;
  },

  formatShortDate(dateInput: Date | string): string {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  },

  normalizeUnit(rawUnit: string): string {
    const u = rawUnit
      .toLowerCase()
      .replace(/[^a-zà-ÿ]/gi, '')
      .trim();
    if (['kg', 'kilo', 'kilos', 'quilo', 'quilos'].includes(u)) return 'kg';
    if (['g', 'gr', 'grs', 'grama', 'gramas'].includes(u)) return 'g';
    if (['dz', 'duzia', 'dúzia', 'duzias', 'dúzias'].includes(u)) return 'dz';
    if (['cx', 'cxa', 'caixa', 'caixas'].includes(u)) return 'cx';
    if (['pct', 'pc', 'pacote', 'pacotes'].includes(u)) return 'pct';
    if (['l', 'lt', 'lts', 'litro', 'litros'].includes(u)) return 'L';
    if (['ml', 'mls'].includes(u)) return 'ml';
    return 'un';
  },

  formatQuantity(quantity: number, unit = 'un'): string {
    const cleanUnit = AppFormatters.normalizeUnit(unit);
    let qtyStr: string;
    if (quantity === Math.round(quantity)) {
      qtyStr = String(Math.round(quantity));
    } else {
      let s = quantity.toFixed(3);
      while (s.endsWith('0')) {
        s = s.slice(0, -1);
      }
      if (s.endsWith('.')) {
        s = s.slice(0, -1);
      }
      qtyStr = s.replace('.', ',');
    }
    return `${qtyStr} ${cleanUnit}`;
  },
};
