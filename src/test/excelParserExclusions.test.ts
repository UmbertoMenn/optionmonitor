import { describe, expect, it } from 'vitest';
import { parsePortfolioData } from '@/lib/excelParser';

describe('parsePortfolioData exclusions', () => {
  it('esclude una posizione per descrizione esatta normalizzata', () => {
    const rows = [
      ['AZIONI ED ETF'],
      ['ISIN', 'DESCRIZIONE', 'DIVISA', 'QUANTITA', 'VALORIZZAZIONE EUR'],
      ['IT0005056236', ' BIO   ON ', 'EUR', 10, 2704],
      ['US0378331005', 'APPLE INC', 'USD', 10, 2000],
    ];

    const result = parsePortfolioData(rows, {
      excludedPositionDescriptions: ['BIO ON'],
    });

    expect(result.positions.map(position => position.description)).toEqual(['APPLE INC']);
  });

  it('esclude una posizione per ISIN indipendentemente dalla descrizione', () => {
    const rows = [
      ['AZIONI ED ETF'],
      ['ISIN', 'DESCRIZIONE', 'DIVISA', 'QUANTITA', 'VALORIZZAZIONE EUR'],
      ['IT0005056236', 'BIO-ON SPA AZ ORD', 'EUR', 10, 2704],
      ['US0378331005', 'APPLE INC', 'USD', 10, 2000],
    ];

    const result = parsePortfolioData(rows, {
      excludedPositionIsins: ['IT0005056236'],
    });

    expect(result.positions.map(position => position.description)).toEqual(['APPLE INC']);
    expect(result.positionsSnapshotPresent).toBe(true);
  });
});
