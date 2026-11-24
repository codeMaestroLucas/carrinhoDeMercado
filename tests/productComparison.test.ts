import { describe, expect, it } from 'vitest';
import { CategoryClassifier } from '../src/services/categoryClassifier';
import {
  buildAllProductAggregates,
  findSimilarProducts,
  matchesAggregateSearchQuery,
} from '../src/services/productHistoryService';
import type { PurchaseRecord } from '../src/types/shopping';

describe('CategoryClassifier.normalizeForComparison', () => {
  it('strips receipt codes and noise tokens while preserving product name', () => {
    expect(CategoryClassifier.normalizeForComparison('Melão Amarelo 4821')).toBe('melao amarelo');
    expect(CategoryClassifier.normalizeForComparison('MELAO AMARELO COD 9102')).toBe('melao amarelo');
    expect(CategoryClassifier.normalizeForComparison('004521 MELAO AMARELO KG')).toBe('melao amarelo');
    expect(CategoryClassifier.normalizeForComparison('Melão Amarelo (REF: 1234)')).toBe('melao amarelo');
    expect(CategoryClassifier.normalizeForComparison('Melão Amarelo #789 PROM')).toBe('melao amarelo');
  });

  it('preserves meaningful numbers and unit quantities', () => {
    expect(CategoryClassifier.normalizeForComparison('Arroz Tipo 1 Camil 5kg')).toBe(
      'arroz tipo 1 camil 5kg',
    );
    expect(CategoryClassifier.normalizeForComparison('Leite Integral 1L')).toBe(
      'leite integral 1l',
    );
    expect(CategoryClassifier.normalizeForComparison('Papel Higiênico 12 Rolos')).toBe(
      'papel higienico 12 rolo',
    );
  });

  it('expands common abbreviations for receipt matching', () => {
    expect(CategoryClassifier.normalizeForComparison('FRANG PEIT KG')).toBe('frango peito');
  });
});

describe('CategoryClassifier.productSimilarity', () => {
  it('returns 1.0 for same product with different receipt codes', () => {
    const score = CategoryClassifier.productSimilarity(
      'Melão Amarelo 4821',
      'MELAO AMARELO COD 9102',
      { categoryA: 'hortifruti', categoryB: 'hortifruti' },
    );
    expect(score).toBe(1.0);
  });

  it('scores similar products higher than unrelated products', () => {
    const similarScore = CategoryClassifier.productSimilarity(
      'Melão Amarelo',
      'Melão Espanhol',
      { categoryA: 'hortifruti', categoryB: 'hortifruti' },
    );
    const unrelatedScore = CategoryClassifier.productSimilarity(
      'Melão Amarelo',
      'Detergente Líquido',
      { categoryA: 'hortifruti', categoryB: 'limpeza' },
    );

    expect(similarScore).toBeGreaterThanOrEqual(0.42);
    expect(unrelatedScore).toBeLessThan(0.35);
    expect(similarScore).toBeGreaterThan(unrelatedScore);
  });
});

describe('ProductHistoryAggregate grouping and similarity', () => {
  it('groups purchases of the same product with different receipt codes', () => {
    const records: PurchaseRecord[] = [
      {
        id: 'r1',
        marketId: 'm1',
        marketName: 'Mercado A',
        date: new Date(2026, 9, 1).toISOString(),
        items: [{ name: 'Melão Amarelo 4821', category: 'hortifruti', price: 8.9, quantity: 1, unit: 'un' }],
      },
      {
        id: 'r2',
        marketId: 'm2',
        marketName: 'Mercado B',
        date: new Date(2026, 9, 15).toISOString(),
        items: [{ name: 'Melão Amarelo', category: 'hortifruti', price: 7.5, quantity: 1, unit: 'un' }],
      },
      {
        id: 'r3',
        marketId: 'm1',
        marketName: 'Mercado A',
        date: new Date(2026, 10, 1).toISOString(),
        items: [{ name: 'MELAO AMARELO COD 9102', category: 'hortifruti', price: 9.2, quantity: 1, unit: 'un' }],
      },
    ];

    const aggregates = buildAllProductAggregates(records);
    expect(aggregates).toHaveLength(1);
    expect(aggregates[0].normalizedKey).toBe('melao amarelo');
    expect(aggregates[0].displayName).toBe('Melão Amarelo');
    expect(aggregates[0].occurrences).toHaveLength(3);
    expect(aggregates[0].lastPrice).toBe(9.2);
    expect(aggregates[0].previousPrice).toBe(7.5);
  });

  it('findSimilarProducts returns related items first and supports fuzzy search', () => {
    const records: PurchaseRecord[] = [
      {
        id: 'r1',
        marketId: 'm1',
        marketName: 'Mercado A',
        date: new Date(2026, 10, 1).toISOString(),
        items: [
          { name: 'Melão Amarelo 4821', category: 'hortifruti', price: 8.9, quantity: 1, unit: 'un' },
          { name: 'Melão Espanhol', category: 'hortifruti', price: 10.5, quantity: 1, unit: 'un' },
          { name: 'Melão Rei', category: 'hortifruti', price: 9.9, quantity: 1, unit: 'un' },
          { name: 'Sabão em Pó Omo', category: 'limpeza', price: 22.0, quantity: 1, unit: 'un' },
        ],
      },
    ];

    const aggregates = buildAllProductAggregates(records);
    const target = aggregates.find((a) => a.normalizedKey === 'melao amarelo')!;
    const similar = findSimilarProducts(target, aggregates);

    const similarKeys = similar.map((e) => e.product.normalizedKey);
    expect(similarKeys).toContain('melao espanhol');
    expect(similarKeys).toContain('melao rei');
    expect(similarKeys).not.toContain('sabao em po omo');
    expect(matchesAggregateSearchQuery(target, 'melao')).toBe(true);
    expect(matchesAggregateSearchQuery(target, 'sabao')).toBe(false);
  });
});

describe('CategoryClassifier Alimentos / Hortifruti / Congelados split', () => {
  it('classifies hortifruti, congelados and alimentos into distinct categories', () => {
    expect(CategoryClassifier.classify('Melão Amarelo')).toBe('hortifruti');
    expect(CategoryClassifier.classify('Tomate Italiano')).toBe('hortifruti');
    expect(CategoryClassifier.classify('Pizza Congelada')).toBe('congelados');
    expect(CategoryClassifier.classify('Sorvete de Chocolate')).toBe('congelados');
    expect(CategoryClassifier.classify('Arroz Tipo 1')).toBe('alimentos');
  });
});
