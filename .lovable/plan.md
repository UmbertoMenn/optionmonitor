

## Fix OptionStrat URL Generation

### Problemi identificati

1. **Data scadenza errata**: attualmente usa la data di scadenza grezza dalla posizione. Deve invece calcolare il 3o venerdi del mese di scadenza.
2. **Nomi strategie errati nell'URL**: i nomi devono corrispondere esattamente ai slug di OptionStrat (minuscolo, con trattini).
3. **Formato Covered Call diverso**: richiede `{TICKER}x100` come prima gamba per rappresentare i titoli sottostanti.

---

### 1. Calcolo 3o venerdi del mese

In `src/lib/optionStratUrl.ts`, la funzione `formatExpiry` verra modificata per calcolare il 3o venerdi del mese/anno della scadenza, invece di usare il giorno esatto.

Logica:
- Prendere mese e anno dalla data di scadenza
- Trovare il primo giorno del mese
- Calcolare il giorno della settimana del 1o del mese
- Derivare il 3o venerdi: `giorno = 15 + (5 - dayOfWeek + 7) % 7` (con aggiustamento se il 1o e gia venerdi)

### 2. Mapping nomi strategie -> slug OptionStrat

Tabella di mapping basata sull'immagine fornita e i nomi usati in `detectStrategyName`:

| Nome interno (detectStrategyName) | Slug OptionStrat |
|---|---|
| Covered Call | `covered-call` |
| Naked Put (Cash-Secured Put) | `cash-secured-put` |
| Iron Condor | `iron-condor` |
| Double Diagonal | `double-diagonal` |
| Short Strangle | `short-strangle` |
| Long Strangle | `long-strangle` |
| Short Straddle | `short-straddle` |
| Long Straddle | `long-straddle` |
| Diagonal Put Spread | `diagonal-put-spread` |
| Diagonal Call Spread | `diagonal-call-spread` |
| Bull Call Spread | `bull-call-spread` |
| Bear Call Spread | `bear-call-spread` |
| Bear Put Spread | `bear-put-spread` |
| Bull Put Spread | `bull-put-spread` |
| Calendar Call Spread | `calendar-call-spread` |
| Calendar Put Spread | `calendar-put-spread` |
| Collar | `collar` |
| Long Put Butterfly | `long-put-butterfly` |
| Long Call Butterfly | `long-call-butterfly` |
| Short Put Butterfly | `short-put-butterfly` |
| Put Broken Wing Butterfly (BWB) | `put-broken-wing` |
| Call Broken Wing Butterfly | `call-broken-wing` |
| Leap Call | `long-call` |
| Long Put / Protection | `long-put` |

### 3. Formato Covered Call

L'URL per le covered call ha un formato speciale:
```
https://optionstrat.com/build/covered-call/BABA/BABAx100,-.BABA260515C190@8.05
```

La prima gamba e `{TICKER}x100` (rappresenta 100 azioni del sottostante), seguita dalla call venduta separata da virgola.

---

### Modifiche tecniche

**File: `src/lib/optionStratUrl.ts`**

1. Riscrivere `formatExpiry` per calcolare il 3o venerdi del mese:
```typescript
function thirdFriday(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const dayOfWeek = first.getDay();
  const firstFriday = 1 + ((5 - dayOfWeek + 7) % 7);
  return new Date(year, month, firstFriday + 14);
}

function formatExpiry(date: string | null | undefined): string {
  if (!date) return '000000';
  const d = new Date(date);
  const tf = thirdFriday(d.getFullYear(), d.getMonth());
  const yy = String(tf.getFullYear()).slice(-2);
  const mm = String(tf.getMonth() + 1).padStart(2, '0');
  const dd = String(tf.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}
```

2. Aggiungere mappa di conversione nomi interni -> slug OptionStrat:
```typescript
const STRATEGY_SLUG_MAP: Record<string, string> = {
  'Short Strangle': 'short-strangle',
  'Long Strangle': 'long-strangle',
  'Short Straddle': 'short-straddle',
  'Long Straddle': 'long-straddle',
  'Diagonal Put Spread': 'diagonal-put-spread',
  'Diagonal Call Spread': 'diagonal-call-spread',
  'Bull Call Spread': 'bull-call-spread',
  'Bear Call Spread': 'bear-call-spread',
  'Bear Put Spread': 'bear-put-spread',
  'Bull Put Spread': 'bull-put-spread',
  'Calendar Call Spread': 'calendar-call-spread',
  'Calendar Put Spread': 'calendar-put-spread',
  'Collar': 'collar',
  'Long Put Butterfly': 'long-put-butterfly',
  'Long Call Butterfly': 'long-call-butterfly',
  'Short Put Butterfly': 'short-put-butterfly',
  'Put Broken Wing Butterfly': 'put-broken-wing',
  'Call Broken Wing Butterfly': 'call-broken-wing',
};
```

3. Modificare `buildCoveredCallUrl` per generare il formato con `{TICKER}x100`:
```typescript
export function buildCoveredCallUrl(ticker: string, option: Position): string {
  const stockLeg = `${ticker}x100`;
  const optionLeg = formatLeg(ticker, option);
  return `https://optionstrat.com/build/covered-call/${ticker}/${stockLeg},${optionLeg}`;
}
```

4. Modificare `buildGroupedStrategyUrl` per usare la mappa di slug:
```typescript
export function buildGroupedStrategyUrl(
  ticker: string, options: Position[], strategyName: string | null
): string {
  const strategyType = (strategyName && STRATEGY_SLUG_MAP[strategyName]) || 'custom';
  return buildOptionStratUrl({ strategyType, ticker, legs: options });
}
```

5. Aggiornare `buildNakedPutUrl` per usare `cash-secured-put` come slug.

6. Rimuovere il tipo `OptionStratStrategy` (union type restrittivo) e usare `string` per `strategyType` nel tipo `BuildUrlParams`, cosi da supportare tutti gli slug dinamicamente.

**File: `src/pages/Derivatives.tsx`** - nessuna modifica necessaria, la logica e gia delegata ai builder.

