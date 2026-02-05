
# Piano: Aggiornamento Prezzi Sottostanti con Cache Centralizzata

## Obiettivo
Implementare un sistema di aggiornamento prezzi centralizzato per i sottostanti dei derivati, con:
- Cron job ogni **5 minuti** durante le ore di mercato (8-22, lun-ven)
- Cache condivisa per tutti gli utenti (evita chiamate duplicate)
- Yahoo Finance come fonte dati (delay ~15 minuti)

---

## Architettura

```text
┌─────────────────────────────────────────────────────────────────┐
│                      CRON JOB (ogni 5 min)                      │
│                  update-underlying-prices-cron                  │
│                                                                 │
│  1. Legge ticker unici da underlying_mappings                   │
│  2. Fetch batch da Yahoo Finance                                │
│  3. Upsert in tabella underlying_prices                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TABELLA underlying_prices                    │
│  (cache centralizzata - lettura pubblica)                       │
│                                                                 │
│  ticker | price  | currency | updated_at                       │
│  NVDA   | 125.50 | USD      | 2026-02-05 14:30:00              │
│  AMZN   | 185.20 | USD      | 2026-02-05 14:30:00              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                useUnderlyingPrices (Frontend)                   │
│                                                                 │
│  1. Query DB → underlying_prices (istantanea)                   │
│  2. Per ticker mancanti → edge function on-demand               │
│  3. Return prezzi combinati                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Modifiche da Implementare

### 1. Nuova Tabella `underlying_prices`

**Scopo**: Cache centralizzata dei prezzi, aggiornata dal cron e letta da tutti gli utenti.

```sql
CREATE TABLE underlying_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL UNIQUE,
  price DECIMAL(15, 4) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indice per lookup veloce
CREATE INDEX idx_underlying_prices_ticker ON underlying_prices(ticker);

-- RLS: lettura pubblica (dati non sensibili - prezzi di mercato)
ALTER TABLE underlying_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read underlying prices"
  ON underlying_prices FOR SELECT USING (true);
```

### 2. Nuova Edge Function: `update-underlying-prices-cron`

**File**: `supabase/functions/update-underlying-prices-cron/index.ts`

**Logica**:
1. Legge tutti i ticker unici dalla tabella `underlying_mappings`
2. Per ogni ticker, chiama Yahoo Finance (con rate limiting 100ms tra chiamate)
3. Upsert dei prezzi nella tabella `underlying_prices`
4. Log del numero di prezzi aggiornati

```typescript
// Pseudo-codice
serve(async (req) => {
  // 1. Leggi tutti i ticker unici
  const { data: mappings } = await supabase
    .from('underlying_mappings')
    .select('ticker');
  
  const uniqueTickers = [...new Set(mappings.map(m => m.ticker))];
  
  // 2. Fetch batch da Yahoo Finance
  for (const ticker of uniqueTickers) {
    const price = await fetchYahooPrice(ticker);
    if (price) {
      await supabase
        .from('underlying_prices')
        .upsert({ ticker, price: price.price, currency: price.currency });
    }
    await delay(100); // Rate limiting
  }
  
  return { updated: count };
});
```

### 3. Attivazione Cron Job

**Schedule**: `*/5 8-22 * * 1-5` (ogni 5 minuti, 8:00-22:00, lunedì-venerdì)

```sql
SELECT cron.schedule(
  'update-underlying-prices-every-5-min',
  '*/5 8-22 * * 1-5',
  $$
  SELECT net.http_post(
    url:='https://uareyloxlpvaxmzygpgo.supabase.co/functions/v1/update-underlying-prices-cron',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    ),
    body:='{}'::jsonb
  );
  $$
);
```

### 4. Modifica Hook `useUnderlyingPrices`

**File**: `src/hooks/useUnderlyingPrices.ts`

**Nuovo flusso**:
1. Prima query sulla tabella `underlying_prices` per ottenere prezzi dalla cache
2. Identifica ticker mancanti (non in cache o non mappati)
3. Solo per i mancanti, chiama l'edge function `fetch-underlying-prices`
4. Combina risultati cache + fresh

```typescript
// Nuovo flusso nel hook
async function fetchPrices() {
  // 1. Risolvi underlying -> ticker usando underlying_mappings
  const { data: mappings } = await supabase
    .from('underlying_mappings')
    .select('underlying, ticker')
    .in('underlying', uniqueUnderlyings);
  
  // 2. Leggi prezzi dalla cache
  const tickers = mappings.map(m => m.ticker);
  const { data: cachedPrices } = await supabase
    .from('underlying_prices')
    .select('*')
    .in('ticker', tickers);
  
  // 3. Costruisci risultato dalla cache
  const results = {};
  for (const underlying of uniqueUnderlyings) {
    const mapping = mappings.find(m => m.underlying === underlying);
    if (mapping) {
      const cached = cachedPrices.find(p => p.ticker === mapping.ticker);
      if (cached) {
        results[underlying] = { 
          price: cached.price, 
          currency: cached.currency, 
          ticker: mapping.ticker 
        };
      }
    }
  }
  
  // 4. Per mancanti, chiama edge function
  const missingUnderlyings = uniqueUnderlyings.filter(u => !results[u]);
  if (missingUnderlyings.length > 0) {
    const { data } = await supabase.functions.invoke('fetch-underlying-prices', {
      body: { underlyings: missingUnderlyings }
    });
    Object.assign(results, data.prices);
  }
  
  return results;
}
```

### 5. Modifica `fetch-underlying-prices` Edge Function

**File**: `supabase/functions/fetch-underlying-prices/index.ts`

**Modifica**: Dopo aver recuperato il prezzo, salvarlo anche nella cache `underlying_prices`:

```typescript
// Dopo aver ottenuto il prezzo da Yahoo
if (priceResult) {
  // Salva nella cache underlying_prices
  await supabase
    .from('underlying_prices')
    .upsert({
      ticker,
      price: priceResult.price,
      currency: priceResult.currency,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'ticker' });
  
  results[underlying] = { ... };
}
```

### 6. Configurazione `config.toml`

Aggiungere la nuova edge function:

```toml
[functions.update-underlying-prices-cron]
verify_jwt = false
```

---

## Vantaggi della Soluzione

| Aspetto | Prima | Dopo |
|---------|-------|------|
| Chiamate Yahoo/utente | N chiamate per utente | 0 (cache) |
| Latenza UI | 2-5 sec (API calls) | ~100ms (query DB) |
| Aggiornamento | On-demand | Automatico ogni 5 min |
| Duplicazione | Chiamate duplicate per stesso ticker | Cache condivisa |
| Fallback | - | Edge function per ticker nuovi |

---

## File da Creare/Modificare

| File | Azione | Descrizione |
|------|--------|-------------|
| **Migrazione SQL** | Creare | Tabella `underlying_prices`, indici, RLS |
| `supabase/functions/update-underlying-prices-cron/index.ts` | Creare | Edge function per cron job |
| `supabase/config.toml` | Modificare | Aggiungere configurazione nuova function |
| `src/hooks/useUnderlyingPrices.ts` | Modificare | Query cache prima, fallback edge function |
| `supabase/functions/fetch-underlying-prices/index.ts` | Modificare | Salvare prezzi in cache dopo fetch |
| **Cron SQL** | Eseguire | Attivare job schedulato |

---

## Note Tecniche

- **Yahoo Finance delay**: I dati gratuiti hanno un ritardo di ~15 minuti
- **Rate limiting**: 100ms delay tra chiamate per evitare blocchi
- **Extensioni richieste**: `pg_cron` e `pg_net` (già disponibili)
- **Ore mercato**: 8:00-22:00 CET copre sia mercati US che EU
