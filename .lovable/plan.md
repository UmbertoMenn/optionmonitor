

# Piano: Aggiornamento Prezzi Basato su Posizioni Attive

## Obiettivo
Modificare il cron job per aggiornare solo i ticker effettivamente presenti nei portafogli attivi di tutti gli utenti, mantenendo le tabelle di mappatura come cache permanente.

---

## Architettura Proposta

```text
┌─────────────────────────────────────────────────────────────────┐
│                      CRON JOB (ogni 5 min)                      │
│                  update-underlying-prices-cron                  │
│                                                                 │
│  NUOVO FLUSSO:                                                  │
│  1. Query posizioni ATTIVE da TUTTI i portafogli               │
│     - Azioni (stock) → estrai ISIN                              │
│     - Derivati (derivative) → estrai underlying                 │
│                                                                 │
│  2. Risolvi ticker usando cache esistenti                       │
│     - ISIN → isin_mappings → ticker                            │
│     - underlying → underlying_mappings → ticker                 │
│                                                                 │
│  3. Consolida ticker unici (rimuovi duplicati)                  │
│                                                                 │
│  4. Fetch prezzi da Yahoo Finance                               │
│                                                                 │
│  5. Upsert in underlying_prices                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│             TABELLE CACHE (NON MODIFICATE - LOOKUP)             │
│                                                                 │
│  underlying_mappings:    isin_mappings:                         │
│  ├─ NVIDIA CORP → NVDA   ├─ US67066G1040 → NVDA                │
│  ├─ APPLE INC → AAPL     ├─ US0231351067 → AMZN                │
│  └─ (288 mappings)       └─ (cache settori + ticker)           │
│                                                                 │
│  → MAI cancellate, solo aggiunte (cache permanente)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dettaglio Query Posizioni Attive

```sql
-- Step 1: Ticker da AZIONI (via ISIN)
SELECT DISTINCT im.ticker
FROM positions pos
JOIN isin_mappings im ON pos.isin = im.isin
WHERE pos.asset_type = 'stock'
  AND pos.isin IS NOT NULL

UNION

-- Step 2: Ticker da DERIVATI (via underlying)
SELECT DISTINCT um.ticker  
FROM positions pos
JOIN underlying_mappings um ON UPPER(pos.underlying) = UPPER(um.underlying)
WHERE pos.asset_type = 'derivative'
  AND pos.underlying IS NOT NULL
```

---

## Modifiche da Implementare

### 1. Edge Function `update-underlying-prices-cron`

La logica attuale:
```typescript
// ATTUALE: prende TUTTI i ticker da underlying_mappings
const { data: mappings } = await supabase
  .from('underlying_mappings')
  .select('ticker');
```

Nuova logica:
```typescript
// NUOVO: prende solo ticker da posizioni ATTIVE
// Step 1: Ticker da azioni (via isin_mappings)
const { data: stockTickers } = await supabase
  .from('positions')
  .select('isin')
  .eq('asset_type', 'stock')
  .not('isin', 'is', null);

const stockIsins = [...new Set(stockTickers?.map(p => p.isin).filter(Boolean))];

let tickersFromStocks: string[] = [];
if (stockIsins.length > 0) {
  const { data: isinMappings } = await supabase
    .from('isin_mappings')
    .select('ticker')
    .in('isin', stockIsins);
  
  tickersFromStocks = isinMappings?.map(m => m.ticker).filter(Boolean) || [];
}

// Step 2: Ticker da derivati (via underlying_mappings)
const { data: derivativePositions } = await supabase
  .from('positions')
  .select('underlying')
  .eq('asset_type', 'derivative')
  .not('underlying', 'is', null);

const underlyings = [...new Set(derivativePositions?.map(p => p.underlying).filter(Boolean))];

let tickersFromDerivatives: string[] = [];
if (underlyings.length > 0) {
  const { data: underlyingMappings } = await supabase
    .from('underlying_mappings')
    .select('ticker, underlying')
    .in('underlying', underlyings);
  
  tickersFromDerivatives = underlyingMappings?.map(m => m.ticker).filter(Boolean) || [];
}

// Step 3: Consolida e rimuovi duplicati
const uniqueTickers = [...new Set([...tickersFromStocks, ...tickersFromDerivatives])];
console.log(`Found ${uniqueTickers.length} unique tickers from active positions`);
```

---

## Confronto Prima/Dopo

| Aspetto | Prima | Dopo |
|---------|-------|------|
| Ticker aggiornati | ~288 (tutti in underlying_mappings) | ~25-40 (solo posizioni attive) |
| Tempo esecuzione | ~30 sec | ~5-10 sec |
| Chiamate Yahoo | 288 | ~25-40 |
| Copertura multi-user | Parziale | Completa |
| Cache mappature | Usata per update | Solo lookup |

---

## File da Modificare

| File | Modifica |
|------|----------|
| `supabase/functions/update-underlying-prices-cron/index.ts` | Riscrivere logica query ticker |

---

## Note Tecniche

- **Le tabelle `underlying_mappings` e `isin_mappings` restano intatte**: sono cache permanenti usate solo per lookup, mai cancellate
- **Multi-user ready**: la query su `positions` non filtra per `user_id`, quindi copre tutti gli utenti
- **Fallback edge function**: rimane invariato - se un nuovo underlying non ha mappatura, viene risolto on-demand da `fetch-underlying-prices`
- **Scalabilità**: con 10 utenti e 50 posizioni ciascuno, i ticker unici saranno comunque molto meno di 288 grazie alla deduplicazione

