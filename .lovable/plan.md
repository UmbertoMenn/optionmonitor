

## Fix: Calcolo data OCC errato + 128/234 opzioni non aggiornate

### Problema identificato

Il broker salva la data di scadenza sempre come il **21 del mese** (es. 2026-04-21, 2026-05-21). Ma il formato OCC richiede il **3o venerdi del mese** (la vera data di scadenza delle opzioni USA).

Il codice attuale corregge solo sabato e domenica:
- Feb 21 = sabato -> venerdi 20 (3o venerdi, funziona per caso)
- Mar 21 = sabato -> venerdi 20 (3o venerdi, funziona per caso)
- **Apr 21 = martedi -> NON corretto -> 404**
- **Mag 21 = giovedi -> NON corretto -> 404**
- **Lug 21 = martedi -> NON corretto -> 404**
- ...e cosi via per 8 mesi su 13

Risultato: **128 opzioni su 234 (55%) restituiscono 404** da Yahoo Finance.

### Indicatore stale

L'indicatore stale (triangolino rosso) funziona correttamente: appare per le opzioni con `updated_at` vecchio di oltre 10 minuti e per quelle con mercato chiuso. Le opzioni senza triangolino sono quelle aggiornate con successo di recente (Feb/26 e Mar/26).

### Soluzione

**File: `supabase/functions/update-option-prices-cron/index.ts`**

Sostituire la logica di aggiustamento sabato/domenica con il calcolo del **3o venerdi del mese di scadenza**:

```typescript
function getThirdFriday(year: number, month: number): Date {
  // month is 0-indexed (0=Jan)
  const firstDay = new Date(year, month, 1);
  // Find first Friday: dayOfWeek 5 = Friday
  const firstFriday = 1 + ((5 - firstDay.getDay() + 7) % 7);
  // Third Friday = first Friday + 14
  const thirdFriday = firstFriday + 14;
  return new Date(year, month, thirdFriday);
}

function buildOCCSymbol(ticker, expiryDate, optionType, strikePrice) {
  const d = new Date(expiryDate);
  // Calcola il 3o venerdi del mese di scadenza
  const thirdFri = getThirdFriday(d.getFullYear(), d.getMonth());
  const yy = thirdFri.getFullYear().toString().slice(-2);
  const mm = (thirdFri.getMonth() + 1).toString().padStart(2, '0');
  const dd = thirdFri.getDate().toString().padStart(2, '0');
  // ... rest
}
```

Questo corregge TUTTI i mesi, non solo quelli dove il 21 cade di sabato/domenica.

### Riepilogo

| Problema | Causa | Fix |
|----------|-------|-----|
| 128/234 opzioni 404 | Data OCC errata (usa il 21 invece del 3o venerdi) | Calcolare il 3o venerdi del mese |
| Triangolino rosso su alcune opzioni | Funziona correttamente: mostra stale per opzioni non aggiornate | Nessun fix necessario |
| Nessun triangolino su altre opzioni | Funziona correttamente: opzioni Feb/Mar aggiornate di recente | Nessun fix necessario |

Un solo file da modificare: `supabase/functions/update-option-prices-cron/index.ts`

