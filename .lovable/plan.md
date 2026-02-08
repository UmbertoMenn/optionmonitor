

## Obiettivo
Migliorare `useSectorMappings` per cercare nel database i mapping per ticker estratti dai nomi degli underlying dei derivati, non solo per ISIN. Questo risolverà il problema della strategia META PLATFORMS Iron Condor che risulta con settore errato.

## Problema identificato

Il database contiene già il mapping corretto:
- `META` → `Communication Services` (ISIN: US30303M1027)

Ma il flusso attuale del hook:
1. Cerca nel DB solo per ISIN (i derivati non hanno ISIN)
2. Per i nomi derivati come "META PLATFORMS", cerca solo nelle mappature già caricate
3. Se non trova nulla, delega all'AI resolution
4. Se l'AI resolution fallisce o non viene chiamata, cade sul mapping statico che ha META → Technology (errato)

## Soluzione proposta

Aggiungere una query supplementare nel hook che cerca nel database anche per **ticker**, oltre che per ISIN. Questo permetterà di utilizzare i mapping già presenti nel DB per i derivati.

## Modifiche tecniche

### useSectorMappings.ts

Dopo la query per ISIN, aggiungere una seconda query per cercare i mapping per ticker estratti dai nomi dei derivati:

```typescript
// 1. Fetch existing mappings from DB (by ISIN)
// ... existing code ...

// 1b. Extract potential tickers from derivative names and fetch by ticker
const potentialTickers: string[] = [];
for (const name of derivativeNames) {
  const upperName = name.toUpperCase();
  // Extract ticker pattern (1-5 uppercase letters at start or after space)
  const tickerMatch = upperName.match(/^([A-Z]{1,5})(?:\s|$)/);
  if (tickerMatch) {
    potentialTickers.push(tickerMatch[1]);
  }
  // Also try extracting from known patterns like "META PLATFORMS"
  const words = upperName.split(/\s+/);
  for (const word of words) {
    if (/^[A-Z]{2,5}$/.test(word)) {
      potentialTickers.push(word);
    }
  }
}

// Fetch by ticker for derivatives
if (potentialTickers.length > 0) {
  const { data: tickerData } = await supabase
    .from('isin_mappings')
    .select('isin, ticker, sector, industry')
    .in('ticker', [...new Set(potentialTickers)]);
  
  if (tickerData) {
    for (const row of tickerData) {
      if (row.sector && row.ticker) {
        // Store by ticker key
        newMappings[`ticker:${row.ticker.toUpperCase()}`] = {
          ticker: row.ticker,
          sector: row.sector,
          industry: row.industry || '',
        };
      }
    }
  }
}
```

### Flusso aggiornato

```text
┌──────────────────────────────────────────────────────┐
│                  fetchMappings()                      │
├───────────────────────────┬──────────────────────────┤
│  Input: stocks (ISIN)     │  Input: derivativeNames   │
└───────────────────────────┴──────────────────────────┘
              │                          │
              ▼                          ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│  Query DB by ISIN       │   │  Extract tickers from   │
│  (existing logic)       │   │  derivative names       │
└─────────────────────────┘   └─────────────────────────┘
              │                          │
              │                          ▼
              │               ┌─────────────────────────┐
              │               │  Query DB by ticker     │  ← NUOVO
              │               │  (META, AAPL, etc.)     │
              │               └─────────────────────────┘
              │                          │
              └──────────┬───────────────┘
                         ▼
              ┌─────────────────────────┐
              │  Merge mappings         │
              │  (ISIN + ticker keys)   │
              └─────────────────────────┘
                         │
                         ▼
              ┌─────────────────────────┐
              │  AI resolution only for │
              │  items NOT found in DB  │
              └─────────────────────────┘
```

## Benefici

- **META PLATFORMS** Iron Condor → Troverà `ticker:META` nel DB → `Communication Services`
- Riduce le chiamate all'AI resolution (i ticker comuni sono già nel DB)
- Nessuna modifica necessaria a `sectorExposure.ts` (la funzione `getStockSectorWithMapping` già cerca per `ticker:*`)

## Considerazioni aggiuntive

### Correzione mapping statico (opzionale ma consigliato)

Come backup, aggiornare anche `STOCK_SECTORS` in `sectorExposure.ts`:

```typescript
// Communication Services (non Technology!)
'META': 'Communication Services', 
'GOOGL': 'Communication Services',
'GOOG': 'Communication Services',
```

Questo serve come fallback nel caso il DB non sia raggiungibile.

## File da modificare

| File | Modifica |
|------|----------|
| `src/hooks/useSectorMappings.ts` | Aggiungere query per ticker estratti dai nomi derivati |
| `src/lib/sectorExposure.ts` | (Opzionale) Correggere mapping statico META → Communication Services |

