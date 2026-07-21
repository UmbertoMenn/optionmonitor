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

  it('senza alcuna selezione, T0 è la prima data e T1 è l’ultima (storico completo)', () => {
    expect(resolveAttributionPeriod(DATES)).toEqual({ startDate: '2024-01-31', endDate: '2025-06-30' });
  });

  it('con solo T0 selezionato, T1 resta l’ultima data', () => {
    expect(resolveAttributionPeriod(DATES, '2024-06-30')).toEqual({ startDate: '2024-06-30', endDate: '2025-06-30' });
  });

  it('con solo T1 selezionato, T0 resta la prima data', () => {
    expect(resolveAttributionPeriod(DATES, null, '2024-09-30')).toEqual({ startDate: '2024-01-31', endDate: '2024-09-30' });
  });

  it('con entrambi selezionati e coerenti (T0 < T1), usa esattamente quella coppia', () => {
    expect(resolveAttributionPeriod(DATES, '2024-03-31', '2024-12-31')).toEqual({ startDate: '2024-03-31', endDate: '2024-12-31' });
  });

  it('T0 selezionato non tra le date attribuibili → fallback sulla prima data', () => {
    expect(resolveAttributionPeriod(DATES, '2024-07-15')).toEqual({ startDate: '2024-01-31', endDate: '2025-06-30' });
  });

  it('T1 selezionato non tra le date attribuibili → fallback sull’ultima data', () => {
    expect(resolveAttributionPeriod(DATES, null, '2024-07-15')).toEqual({ startDate: '2024-01-31', endDate: '2025-06-30' });
  });

  it('T0 selezionato ≥ T1 selezionato → T0 ripiega sulla prima data', () => {
    expect(resolveAttributionPeriod(DATES, '2024-12-31', '2024-06-30')).toEqual({ startDate: '2024-01-31', endDate: '2024-06-30' });
  });

  it('T1 selezionato uguale alla prima data (nessun T0 valido possibile) → null', () => {
    expect(resolveAttributionPeriod(DATES, null, '2024-01-31')).toBeNull();
  });

  it('date duplicate vengono deduplicate prima di risolvere il periodo', () => {
    expect(resolveAttributionPeriod([...DATES, '2024-01-31', '2025-06-30']))
      .toEqual({ startDate: '2024-01-31', endDate: '2025-06-30' });
  });
});
