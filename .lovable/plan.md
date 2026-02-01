

# Piano: Riconoscimento Avanzato degli ETF nel Parser Excel

## Problema Identificato

Lo strumento "ISHSIII-MSCI S.A.C.UE DLA" (ISIN: IE00BYYR0489) è un ETF iShares ma viene classificato come "stock" perché:

1. Il parser Excel cerca solo le parole "ETF" o "UCITS"
2. "ISHSIII" è un'abbreviazione di "iShares III" che non viene riconosciuta
3. La logica avanzata in altri file (currencyExposure.ts, RiskAnalyzer.tsx) usa pattern più ampi ma solo per l'analisi, non per la classificazione iniziale

## Soluzione

Espandere la logica di riconoscimento ETF nel parser Excel con:

1. Lista completa di keyword emittenti ETF (ISHARES, ISHSIII, VANGUARD, SPDR, etc.)
2. Riconoscimento pattern ISIN tipici degli ETF (prefissi IE, LU)
3. Pattern aggiuntivi comuni negli ETF

---

## Modifiche a `src/lib/excelParser.ts`

### Aggiungere lista di emittenti ETF

```typescript
// Pattern per riconoscere ETF dai principali emittenti
const ETF_ISSUER_PATTERNS = [
  'ETF', 'UCITS',
  // iShares (BlackRock)
  'ISHARES', 'ISHSIII', 'ISHSIV', 'ISHSV', 'ISHSVII',
  // Vanguard
  'VANGUARD', 'VNG',
  // State Street (SPDR)
  'SPDR', 'SSG',
  // Lyxor (Amundi)
  'LYXOR', 'AMUNDI',
  // Xtrackers (DWS)
  'XTRACKERS', 'XTRK',
  // Invesco
  'INVESCO',
  // VanEck
  'VANECK',
  // WisdomTree
  'WISDOMTREE', 'WTR',
  // UBS
  'UBS ETF',
  // HSBC
  'HSBC ETF',
  // Franklin Templeton
  'FRANKLIN'
];
```

### Aggiungere riconoscimento ISIN

```typescript
// ISINs che iniziano con IE (Irlanda) o LU (Lussemburgo) 
// sono spesso ETF domiciliati in Europa
function isLikelyETFByISIN(isin: string | undefined): boolean {
  if (!isin) return false;
  const prefix = isin.substring(0, 2).toUpperCase();
  return prefix === 'IE' || prefix === 'LU';
}
```

### Migliorare la funzione di riconoscimento

```typescript
function isETF(description: string, isin?: string): boolean {
  const descUpper = description.toUpperCase();
  
  // Check emitter patterns
  for (const pattern of ETF_ISSUER_PATTERNS) {
    if (descUpper.includes(pattern)) {
      return true;
    }
  }
  
  // Check ISIN prefix (IE/LU) + description patterns
  if (isLikelyETFByISIN(isin)) {
    // If ISIN is Irish/Luxembourg and description contains 
    // common ETF terms like "MSCI", "FTSE", "S&P", etc.
    const etfIndexPatterns = ['MSCI', 'FTSE', 'S&P', 'STOXX', 'NASDAQ', 'DOW'];
    if (etfIndexPatterns.some(p => descUpper.includes(p))) {
      return true;
    }
  }
  
  return false;
}
```

---

## Sincronizzazione con Altri File

Aggiornare la stessa lista anche in:

| File | Funzione | Azione |
|------|----------|--------|
| `src/lib/currencyExposure.ts` | `isETFByDescription()` | Aggiungere pattern mancanti |
| `src/pages/RiskAnalyzer.tsx` | Regex inline | Allineare con nuovi pattern |

---

## Flusso di Correzione

```text
┌─────────────────────────────────────────────────────────┐
│  1. Aggiornare excelParser.ts                           │
├─────────────────────────────────────────────────────────┤
│  • Aggiungere ETF_ISSUER_PATTERNS                       │
│  • Aggiungere isLikelyETFByISIN()                       │
│  • Modificare parsePositionRow per usare nuova logica   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  2. Sincronizzare currencyExposure.ts                   │
├─────────────────────────────────────────────────────────┤
│  • Aggiornare isETFByDescription() con stessi pattern   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  3. Sincronizzare RiskAnalyzer.tsx                      │
├─────────────────────────────────────────────────────────┤
│  • Aggiornare regex con nuovi pattern                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  4. Ricaricare Excel per aggiornare classificazioni     │
├─────────────────────────────────────────────────────────┤
│  • L'utente ricarica il file Excel                      │
│  • Parser classifica correttamente ISHSIII come ETF     │
│  • Currency Exposure include lo strumento               │
└─────────────────────────────────────────────────────────┘
```

---

## Pattern da Riconoscere

| Pattern | Esempio | Tipo |
|---------|---------|------|
| ISHSIII | ISHSIII-MSCI S.A.C.UE DLA | iShares ETF |
| ISHSIV | ISHSIV-MSCI WORLD | iShares ETF |
| VANGUARD | VANGUARD FTSE ALL-WORLD | Vanguard ETF |
| VNG | VNG LIFESTRAT 80 | Vanguard ETF |
| SPDR | SPDR S&P 500 | State Street ETF |
| LYXOR | LYXOR MSCI EUROPE | Lyxor ETF |
| XTRK | XTRK MSCI EM | Xtrackers ETF |

---

## File da Modificare

| File | Azione |
|------|--------|
| `src/lib/excelParser.ts` | Aggiungere logica avanzata riconoscimento ETF |
| `src/lib/currencyExposure.ts` | Sincronizzare pattern ETF |
| `src/pages/RiskAnalyzer.tsx` | Sincronizzare pattern ETF |

---

## Risultato Atteso

Dopo la modifica:

| Strumento | Prima | Dopo |
|-----------|-------|------|
| ISHSIII-MSCI S.A.C.UE DLA | stock ❌ | etf ✅ |
| ISHSIV-MSCI WORLD | stock ❌ | etf ✅ |
| VNG LIFESTRAT 80 | stock ❌ | etf ✅ |

L'ETF verrà:
1. Classificato correttamente come "etf" nel database
2. Incluso nell'analisi Currency Exposure
3. Lo scraper fetch-etf-allocation recupererà la sua allocazione geografica

