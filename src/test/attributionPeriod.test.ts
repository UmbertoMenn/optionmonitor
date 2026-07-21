import { describe, expect, it } from 'vitest';
import { resolveAttributionPeriod } from '@/lib/attributionPeriod';

const DATES = [
  '2024-01-31', '2024-03-31', '2024-06-30', '2024-09-30', '2024-12-31', '2025-06-30',
];

describe('resolveAttributionPeriod', () => {
  it('ritorna null con meno di due date attribuibili', () => {
    expect(resolveAttributionPeriod([])).toBeNull();
    expect(resolveAttributionPeriod(['2024-12-31'])).toBeNull();
  });

  it('senza selezione, T0 è la prima data e T1 è sempre l’ultima', () => {
    expect(resolveAttributionPeriod(DATES)).toEqual({ startDate: '2024-01-31', endDate: '2025-06-30' });
  });

  it('con una selezione valida, T0 è la data scelta e T1 resta l’ultima', () => {
    expect(resolveAttributionPeriod(DATES, '2024-06-30')).toEqual({ startDate: '2024-06-30', endDate: '2025-06-30' });
  });

  it('selezione non tra le date attribuibili → fallback sulla prima data', () => {
    expect(resolveAttributionPeriod(DATES, '2024-07-15')).toEqual({ startDate: '2024-01-31', endDate: '2025-06-30' });
  });

  it('selezione uguale all’ultima data (T0 = T1) → fallback sulla prima data', () => {
    expect(resolveAttributionPeriod(DATES, '2025-06-30')).toEqual({ startDate: '2024-01-31', endDate: '2025-06-30' });
  });

  it('selezione successiva all’ultima data → fallback sulla prima data', () => {
    expect(resolveAttributionPeriod(DATES, '2025-12-31')).toEqual({ startDate: '2024-01-31', endDate: '2025-06-30' });
  });

  it('selezione null/undefined equivale a nessuna selezione', () => {
    expect(resolveAttributionPeriod(DATES, null)).toEqual({ startDate: '2024-01-31', endDate: '2025-06-30' });
    expect(resolveAttributionPeriod(DATES)).toEqual({ startDate: '2024-01-31', endDate: '2025-06-30' });
  });

  it('date duplicate vengono deduplicate prima di risolvere il periodo', () => {
    expect(resolveAttributionPeriod([...DATES, '2024-01-31', '2025-06-30']))
      .toEqual({ startDate: '2024-01-31', endDate: '2025-06-30' });
  });
});
