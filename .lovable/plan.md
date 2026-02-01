
# Piano: Rendere la Risoluzione Ticker Dinamica per Qualsiasi Portfolio

## Stato Attuale

Ho analizzato il flusso completo di aggiornamento prezzi e identificato un **problema critico** che impedirebbe il funzionamento per un portfolio completamente diverso.

### Cosa Funziona Già (Nessuna Modifica Necessaria)

| Tipo Asset | Meccanismo | Adattabile? |
|------------|------------|-------------|
| Azioni/ETF con ticker | Yahoo Finance API | Si, qualsiasi ticker |
| Azioni/ETF con ISIN | OpenFIGI + Yahoo Search + JustETF | Si, risoluzione automatica |
| Bond | Non prezzati (solo valore Excel) | N/A |
| Cash | Valore fisso da Excel | N/A |

### Il Problema: Opzioni con Underlying Sconosciuti

Attualmente le opzioni richiedono una **mappatura hardcoded** da nome descrittivo a ticker:

```text
UNDERLYING_TO_TICKER = {
  'NVIDIA CORP': 'NVDA',
  'APPLE INC': 'AAPL',
  // ~150 entry manuali...
}
```

**Cosa succede con un underlying nuovo:**
1. Excel contiene: `RIVIAN AUTOMOTIVE INC OPTION CALL 15 DEC/25`
2. Il sistema cerca "RIVIAN AUTOMOTIVE INC" nella lookup table
3. Non trova nulla → **Errore: opzione non prezzata**

---

## Soluzione: Risoluzione Dinamica degli Underlying

### Approccio

Invece di dipendere da una lookup table hardcoded, creare un sistema che:

1. **Prova prima la lookup table** (per velocita)
2. **Se non trova, usa OpenFIGI/Yahoo** per risolvere automaticamente
3. **Salva il risultato in cache** per usi futuri

### Nuova Architettura

```text
Underlying dall'Excel: "RIVIAN AUTOMOTIVE INC"
         │
         ▼
┌─────────────────────────────────────────┐
│  1. Lookup Table Locale (istantaneo)    │
│     UNDERLYING_TO_TICKER['RIVIAN...']   │
│     → Non trovato                       │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  2. Cache Database (isin_mappings)      │
│     → Cerca per "underlying" column     │
│     → Non trovato                       │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  3. Yahoo Finance Search (API)          │
│     GET /search?q=RIVIAN+AUTOMOTIVE     │
│     → Trova "RIVN" ticker               │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  4. Cache per Usi Futuri                │
│     INSERT INTO underlying_mappings     │
│     ('RIVIAN AUTOMOTIVE INC', 'RIVN')   │
└─────────────────────────────────────────┘
         │
         ▼
    Return: "RIVN"
```

---

## Modifiche da Implementare

### 1. Nuova Tabella Database: `underlying_mappings`

Creare una tabella dedicata per le mappature underlying-to-ticker che non passano per ISIN.

```sql
CREATE TABLE public.underlying_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  underlying TEXT NOT NULL UNIQUE,
  ticker TEXT NOT NULL,
  source TEXT DEFAULT 'yahoo',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Migrare le entry esistenti dalla lookup table
INSERT INTO public.underlying_mappings (underlying, ticker, source)
VALUES
  ('NVIDIA CORP', 'NVDA', 'manual'),
  ('APPLE INC', 'AAPL', 'manual'),
  ...
  -- Tutte le ~150 entry attuali
ON CONFLICT (underlying) DO NOTHING;
```

### 2. Modificare la Edge Function `fetch-market-prices`

#### Prima: Lookup Hardcoded
```typescript
function underlyingToTicker(underlying: string): string | null {
  // Solo lookup table locale
  return UNDERLYING_TO_TICKER[underlying] || null;
}
```

#### Dopo: Risoluzione Dinamica
```typescript
async function underlyingToTicker(
  underlying: string,
  supabase: SupabaseClient
): Promise<string | null> {
  const normalized = underlying.toUpperCase().trim();
  
  // 1. Try local lookup first (fast)
  if (UNDERLYING_TO_TICKER[normalized]) {
    return UNDERLYING_TO_TICKER[normalized];
  }
  
  // 2. Check database cache
  const { data: cached } = await supabase
    .from('underlying_mappings')
    .select('ticker')
    .eq('underlying', normalized)
    .maybeSingle();
  
  if (cached?.ticker) {
    return cached.ticker;
  }
  
  // 3. Resolve via Yahoo Finance Search
  try {
    // Clean up for search (remove INC, CORP, etc.)
    const searchTerm = normalized
      .replace(/\s+(INC|CORP|CORPORATION|CO|LTD|LLC|PLC)\.?$/i, '')
      .trim();
    
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(searchTerm)}&quotesCount=5`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      const quotes = data?.quotes || [];
      
      // Find best match (prefer EQUITY type)
      const match = quotes.find((q: any) => 
        q.quoteType === 'EQUITY' && 
        q.symbol && 
        !q.symbol.includes('.')
      ) || quotes[0];
      
      if (match?.symbol) {
        // Cache the result
        await supabase.from('underlying_mappings').upsert({
          underlying: normalized,
          ticker: match.symbol,
          source: 'yahoo',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'underlying' });
        
        console.log(`[underlyingToTicker] Resolved "${underlying}" → ${match.symbol}`);
        return match.symbol;
      }
    }
  } catch (error) {
    console.error(`[underlyingToTicker] Yahoo search error for "${underlying}":`, error);
  }
  
  // 4. If ticker pattern already (1-5 chars), return as-is
  if (/^[A-Z]{1,5}$/.test(normalized)) {
    return normalized;
  }
  
  console.log(`[underlyingToTicker] Could not resolve: "${underlying}"`);
  return null;
}
```

### 3. Pre-risolvere Underlying Prima del Loop Opzioni

Per evitare chiamate Yahoo duplicate, pre-risolvere tutti gli underlying unici in batch:

```typescript
// In fetchYahooOptionPrices:
async function resolveAllUnderlyings(
  options: OptionRequest[],
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const underlyings = [...new Set(options.map(o => o.underlying.toUpperCase().trim()))];
  const results = new Map<string, string>();
  
  // 1. Batch check local lookup
  for (const u of underlyings) {
    if (UNDERLYING_TO_TICKER[u]) {
      results.set(u, UNDERLYING_TO_TICKER[u]);
    }
  }
  
  // 2. Batch check database
  const uncached = underlyings.filter(u => !results.has(u));
  if (uncached.length > 0) {
    const { data: cached } = await supabase
      .from('underlying_mappings')
      .select('underlying, ticker')
      .in('underlying', uncached);
    
    for (const c of cached || []) {
      results.set(c.underlying, c.ticker);
    }
  }
  
  // 3. Resolve remaining via Yahoo (one by one with delay)
  const stillMissing = underlyings.filter(u => !results.has(u));
  for (const underlying of stillMissing) {
    const ticker = await resolveViaYahooSearch(underlying);
    if (ticker) {
      results.set(underlying, ticker);
      
      // Cache it
      await supabase.from('underlying_mappings').upsert({
        underlying,
        ticker,
        source: 'yahoo',
      }, { onConflict: 'underlying' });
    }
    
    // Rate limit: 100ms between requests
    await new Promise(r => setTimeout(r, 100));
  }
  
  return results;
}
```

---

## File da Modificare

| File | Modifiche |
|------|-----------|
| **Database** | Creare tabella `underlying_mappings` |
| `supabase/functions/fetch-market-prices/index.ts` | Rendere `underlyingToTicker` asincrono con fallback Yahoo + caching |
| `src/lib/underlyingToTicker.ts` | Mantenere per uso client-side (opzionale) |

---

## Vantaggi della Soluzione

| Prima | Dopo |
|-------|------|
| Solo ~150 underlying supportati | Qualsiasi underlying USA |
| Richiede aggiornamento codice per nuovi titoli | Auto-risoluzione dinamica |
| Errori per titoli nuovi/esotici | Fallback graceful a Yahoo Search |
| Mappature disperse nel codice | Cache centralizzata nel database |

---

## Esempio Pratico

**Portfolio nuovo con titoli mai visti:**

```text
RIVIAN AUTOMOTIVE INC OPTION CALL 15 DEC/25
ROBINHOOD MARKETS INC OPTION PUT 25 JAN/26
DUOLINGO INC OPTION CALL 300 MAR/26
```

**Flusso:**
1. "RIVIAN AUTOMOTIVE INC" → Non in lookup → Yahoo Search → "RIVN" → Cache → Prezzato
2. "ROBINHOOD MARKETS INC" → Non in lookup → Yahoo Search → "HOOD" → Cache → Prezzato
3. "DUOLINGO INC" → Non in lookup → Yahoo Search → "DUOL" → Cache → Prezzato

**Prossimo aggiornamento (5 min dopo):**
1. Tutti e tre trovati in cache → Nessuna chiamata Yahoo → Prezzati istantaneamente

---

## Considerazioni Performance

- **Prima chiamata**: +100-300ms per ogni underlying nuovo (Yahoo Search)
- **Chiamate successive**: 0ms (tutto in cache)
- **Rate limiting**: Delay di 100ms tra ricerche Yahoo per evitare blocchi
- **Batch optimization**: Pre-risoluzione di tutti gli underlying prima del loop opzioni

---

## Riepilogo

Con queste modifiche, il sistema diventerà **completamente adattabile** a qualsiasi portfolio. Un utente diverso che carica un Excel con titoli completamente nuovi vedrà:

1. **Azioni/ETF**: Funzionano già (ISIN → OpenFIGI/Yahoo, ticker → Yahoo direct)
2. **Opzioni**: Ora funzioneranno anche con underlying mai visti prima, grazie alla risoluzione dinamica
3. **Cache**: Ogni mappatura viene salvata per velocizzare gli aggiornamenti successivi
