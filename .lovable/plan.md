
# Piano: Correggere Estrazione Top Holdings ETF

## Problema Identificato

Lo scraping delle top holdings nell'edge function `fetch-etf-allocation` estrae dati **errati**:
- "Method 2" cattura righe con percentuali da sezioni errate (paesi, "Other")
- Esempio: `topHoldings: [{ name: "Other", percentage: 37.15 }, { name: "Japan", percentage: 5.41 }]`
- Poiché l'array non è vuoto, il **fallback AI non viene mai attivato**

I log confermano il problema:
```
Holdings Method 1 failed, trying Method 2...
Found holding (Method 2): Other = 37.15%
Found holding (Method 2): Japan = 5.41%
Found holding (Method 2): Canada = 2.94%
```

## Soluzione

### Modifica 1: Validare le Top Holdings prima del Fallback AI

**File**: `supabase/functions/fetch-etf-allocation/index.ts`

Invece di controllare solo se `topHoldings.length === 0`, verificare che le holdings siano **valide** (non contengano paesi o parole generiche):

```typescript
// Helper function to validate if holdings are real companies
function hasValidTopHoldings(holdings: TopHolding[]): boolean {
  if (holdings.length === 0) return false;
  
  const invalidNames = [
    'Other', 'Others', 'Cash', 'Liquidità',
    // Countries that might get scraped incorrectly
    'United States', 'USA', 'Japan', 'Canada', 'United Kingdom', 'UK',
    'Germany', 'France', 'China', 'Switzerland', 'Australia',
    // Generic terms
    'Technology', 'Financials', 'Healthcare', 'Energy', 'Materials'
  ];
  
  // Check if at least 3 holdings are valid company names (not in invalid list)
  const validHoldings = holdings.filter(h => 
    !invalidNames.some(invalid => 
      h.name.toUpperCase() === invalid.toUpperCase()
    )
  );
  
  return validHoldings.length >= 3;
}
```

Poi modificare la condizione per il fallback AI (linea ~1032):

```typescript
// AI Fallback for ETFs without VALID top holdings data
if (!hasValidTopHoldings(data.topHoldings)) {
  console.log(`No valid top holdings scraped for ${isin} (found ${data.topHoldings.length} invalid entries), trying Lovable AI...`);
  const aiHoldings = await fetchETFTopHoldingsWithAI(isin, data.name);
  
  if (aiHoldings.length > 0) {
    data.topHoldings = aiHoldings; // Replace invalid data with AI data
    console.log(`AI populated top holdings for ${data.name}:`, aiHoldings);
  }
}
```

### Modifica 2: Migliorare Method 2 Holdings Scraping

Aggiungere un filtro più rigoroso nel Method 2 per escludere paesi e termini generici:

```typescript
// Additional filter: exclude country names and generic terms
const EXCLUDED_HOLDING_NAMES = [
  'Other', 'Others', 'United States', 'USA', 'Japan', 'UK', 
  'United Kingdom', 'Canada', 'Germany', 'France', 'China',
  'Switzerland', 'Australia', 'Netherlands', 'Sweden', 'Spain'
];

// In Method 2 loop:
const isExcluded = EXCLUDED_HOLDING_NAMES.some(name =>
  holdingName.toUpperCase() === name.toUpperCase()
);
if (!isSector && !isExcluded) {
  topHoldings.push({ name: holdingName, percentage });
}
```

## File da Modificare

| File | Modifica |
|------|----------|
| `supabase/functions/fetch-etf-allocation/index.ts` | Aggiungere validazione holdings + migliorare filtri Method 2 |

## Risultato Atteso

Dopo le modifiche, l'edge function per `IE00B4L5Y983` (iShares Core MSCI World) dovrebbe:

1. **Rilevare** che le holdings estratte ("Other", "Japan", "Canada") sono **invalide**
2. **Attivare** il fallback AI per ottenere le vere top holdings
3. **Restituire** holdings come:
   ```json
   {
     "topHoldings": [
       {"name": "Apple Inc.", "percentage": 5.2},
       {"name": "Microsoft Corp.", "percentage": 4.8},
       {"name": "NVIDIA Corp.", "percentage": 4.1},
       {"name": "Amazon.com Inc.", "percentage": 2.8},
       ...
     ]
   }
   ```

## Sequenza di Implementazione

1. Aggiungere helper `hasValidTopHoldings()`
2. Aggiungere lista `EXCLUDED_HOLDING_NAMES` 
3. Modificare filtro nel Method 2 per escludere paesi
4. Modificare condizione fallback AI per usare `hasValidTopHoldings()`
5. Deploy edge function
6. Testare con `forceRefresh: true` su `IE00B4L5Y983`
7. Verificare che le top holdings siano aziende reali (Apple, Microsoft, etc.)

## Test di Verifica

Dopo il deploy, chiamare:
```bash
curl -X POST ... -d '{"isin": "IE00B4L5Y983", "forceRefresh": true}'
```

Aspettarsi nei log:
```
No valid top holdings scraped for IE00B4L5Y983 (found 4 invalid entries), trying Lovable AI...
Calling Lovable AI for ETF top holdings: iShares Core MSCI World UCITS ETF USD (Acc)...
AI resolved 15 top holdings for iShares Core MSCI World UCITS ETF USD (Acc)
```
