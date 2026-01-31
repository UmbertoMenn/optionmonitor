
# Piano: Sistema di Aggiornamento Prezzi Server-Side con Cron Job

## Obiettivo
Implementare un sistema di aggiornamento prezzi automatico lato server che aggiorni i prezzi nel database ogni 5 minuti, indipendentemente dalla connessione dell'utente. Questo garantisce dati sempre freschi anche quando nessun utente è online.

---

## Situazione Attuale

### Come funziona ora
- **Client-side polling**: Il browser chiama `fetch-market-prices` ogni 5 minuti
- **Nessuna persistenza**: I prezzi live rimangono solo in memoria (React state)
- **Utente offline = prezzi vecchi**: Se l'utente chiude il browser, i prezzi non si aggiornano

### Cosa cambierà
- **Server-side cron**: Un job PostgreSQL chiama l'Edge Function ogni 5 minuti automaticamente
- **Persistenza nel database**: I prezzi vengono salvati nella tabella `positions`
- **Sempre aggiornati**: Anche a browser chiuso, i prezzi continuano ad aggiornarsi

---

## Architettura della Soluzione

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     PostgreSQL Cron Job                              │
│               (pg_cron + pg_net ogni 5 minuti)                       │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ HTTP POST
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│           update-prices-cron (NUOVA Edge Function)                   │
│                                                                      │
│  1. Legge TUTTE le posizioni dal database                           │
│  2. Chiama fetch-market-prices internamente                         │
│  3. Aggiorna current_price, market_value, profit_loss              │
│  4. Salva tutto nel database                                        │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Tabella positions                                 │
│  - current_price: aggiornato ogni 5 min                             │
│  - market_value: ricalcolato                                        │
│  - profit_loss: ricalcolato                                         │
│  - updated_at: timestamp ultimo aggiornamento                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Fasi di Implementazione

### Fase 1: Creare Edge Function `update-prices-cron`

**Nuovo file: `supabase/functions/update-prices-cron/index.ts`**

Questa Edge Function:
1. Usa `SUPABASE_SERVICE_ROLE_KEY` per accedere a tutte le posizioni (bypass RLS)
2. Legge tutte le posizioni stock/etf/derivative
3. Costruisce la lista di ticker, ISIN e opzioni
4. Chiama la logica di `fetch-market-prices` internamente
5. Aggiorna i record nel database

```typescript
// Pseudocodice
serve(async (req) => {
  // 1. Verifica che sia una chiamata autorizzata (cron o manuale con secret)
  const authHeader = req.headers.get('Authorization');
  
  // 2. Leggi tutte le posizioni
  const { data: positions } = await supabase
    .from('positions')
    .select('*')
    .in('asset_type', ['stock', 'etf', 'derivative']);
  
  // 3. Raggruppa per tipo
  const stocks = positions.filter(p => p.asset_type !== 'derivative');
  const options = positions.filter(p => p.asset_type === 'derivative');
  
  // 4. Estrai ISIN (i ticker sono null per la maggior parte)
  const isins = [...new Set(stocks.map(p => p.isin).filter(Boolean))];
  
  // 5. Fetch prezzi (usa logica esistente)
  const prices = await fetchAllPrices(isins, options);
  
  // 6. Aggiorna database
  for (const position of positions) {
    const price = getPriceForPosition(position, prices);
    if (price) {
      await supabase.from('positions').update({
        current_price: price.price,
        market_value: calculateMarketValue(position, price.price),
        profit_loss: calculateProfitLoss(position, price.price),
        updated_at: new Date().toISOString(),
      }).eq('id', position.id);
    }
  }
  
  return new Response(JSON.stringify({ 
    updated: updatedCount, 
    timestamp: new Date().toISOString() 
  }));
});
```

### Fase 2: Abilitare pg_cron e pg_net

**Migrazione SQL per abilitare le estensioni:**

```sql
-- Abilita pg_cron per job schedulati
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Abilita pg_net per chiamate HTTP
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Concedi permessi
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
```

### Fase 3: Creare il Cron Job

**Inserimento del job schedulato (via insert tool, NON migrazione):**

```sql
SELECT cron.schedule(
  'update-prices-every-5-min',    -- nome del job
  '*/5 * * * *',                  -- ogni 5 minuti
  $$
  SELECT net.http_post(
    url := 'https://uareyloxlpvaxmzygpgo.supabase.co/functions/v1/update-prices-cron',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhcmV5bG94bHB2YXhtenlncGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NzY5MjYsImV4cCI6MjA4NTI1MjkyNn0.XRdbbCpwFPq-TgEB8FUUaGvs6F_RXM0YFahUzXmkzLY", "Content-Type": "application/json"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);
```

### Fase 4: Tabella di Log (Opzionale ma Consigliata)

**Nuova tabella per tracciare gli aggiornamenti:**

```sql
CREATE TABLE price_update_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  positions_updated INTEGER DEFAULT 0,
  positions_failed INTEGER DEFAULT 0,
  error_message TEXT,
  source TEXT DEFAULT 'cron' -- 'cron' o 'manual'
);
```

Questo permette di:
- Verificare che il cron stia funzionando
- Debuggare eventuali errori
- Vedere statistiche di aggiornamento

### Fase 5: Aggiornare il Client per Usare Prezzi dal Database

**Modifiche al frontend:**

Il client continuerà a usare `LivePricesContext`, ma ora i dati nel database saranno già aggiornati. Il context può:
1. **Polling ridotto**: Invece di 5 min, può fare polling ogni 1 min solo per verificare se ci sono aggiornamenti
2. **Fallback**: Se il fetch live fallisce, i dati nel database sono comunque recenti
3. **Indicatore "ultimo aggiornamento"**: Mostra quando il server ha aggiornato i prezzi

---

## File da Creare

| File | Descrizione |
|------|-------------|
| `supabase/functions/update-prices-cron/index.ts` | Edge Function chiamata dal cron job |
| `supabase/migrations/xxx_enable_pg_cron.sql` | Abilita pg_cron e pg_net |

## File da Modificare

| File | Modifiche |
|------|-----------|
| `supabase/config.toml` | Aggiungere configurazione per la nuova function |
| `src/contexts/LivePricesContext.tsx` | Opzionale: ridurre polling o aggiungere fallback DB |

---

## Dettagli Tecnici

### Sicurezza della Edge Function

```typescript
// Accetta chiamate dal cron job (con anon key) o chiamate manuali autenticate
const authHeader = req.headers.get('Authorization');
const isValidCronCall = authHeader?.includes(Deno.env.get('SUPABASE_ANON_KEY'));

// Oppure: usa un secret dedicato per il cron
const cronSecret = Deno.env.get('CRON_SECRET');
const providedSecret = req.headers.get('X-Cron-Secret');
const isValidSecret = cronSecret && providedSecret === cronSecret;

if (!isValidCronCall && !isValidSecret) {
  return new Response('Unauthorized', { status: 401 });
}
```

### Calcolo Market Value e Profit/Loss

```typescript
function calculateMarketValue(position: Position, newPrice: number): number {
  const multiplier = position.asset_type === 'derivative' ? 100 : 1;
  const exchangeRate = position.exchange_rate ?? 1;
  return (newPrice * position.quantity * multiplier) / exchangeRate;
}

function calculateProfitLoss(position: Position, newPrice: number): number {
  const marketValue = calculateMarketValue(position, newPrice);
  const avgCost = position.avg_cost ?? 0;
  const multiplier = position.asset_type === 'derivative' ? 100 : 1;
  const exchangeRate = position.exchange_rate ?? 1;
  const costBasis = (avgCost * Math.abs(position.quantity) * multiplier) / exchangeRate;
  return position.quantity < 0 ? -(marketValue + costBasis) : marketValue - costBasis;
}
```

### Batch Updates per Performance

```typescript
// Invece di singole UPDATE, usa upsert batch
const updates = positions.map(p => ({
  id: p.id,
  current_price: prices[p.isin]?.price ?? p.current_price,
  market_value: calculateMarketValue(p, prices[p.isin]?.price),
  profit_loss: calculateProfitLoss(p, prices[p.isin]?.price),
  updated_at: new Date().toISOString(),
}));

// Esegui in batch di 50 per evitare timeout
for (let i = 0; i < updates.length; i += 50) {
  const batch = updates.slice(i, i + 50);
  await supabase.from('positions').upsert(batch);
}
```

---

## Monitoraggio e Debug

### Verificare che il Cron funzioni

```sql
-- Lista tutti i job schedulati
SELECT * FROM cron.job;

-- Lista le esecuzioni recenti
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

### Verificare gli aggiornamenti

```sql
-- Posizioni aggiornate di recente
SELECT id, isin, current_price, updated_at 
FROM positions 
WHERE updated_at > NOW() - INTERVAL '10 minutes'
ORDER BY updated_at DESC;
```

---

## Vantaggi del Sistema Server-Side

| Aspetto | Prima (Client) | Dopo (Server) |
|---------|---------------|---------------|
| Aggiornamento offline | Non funziona | Funziona sempre |
| Consistenza dati | Ogni utente vede dati diversi | Tutti vedono gli stessi dati |
| Carico API | Ogni utente fa chiamate separate | Una sola chiamata ogni 5 min |
| Storico prezzi | Perso alla chiusura browser | Sempre nel database |
| Affidabilità | Dipende da connessione utente | Gestita dal server |

---

## Stima Effort

- **Fase 1** (Edge Function): ~1 messaggio
- **Fase 2-3** (pg_cron setup): ~1 messaggio
- **Fase 4** (Tabella log): opzionale, ~0.5 messaggi
- **Fase 5** (Update client): opzionale, ~0.5 messaggi

**Totale stimato**: 2-3 messaggi per implementazione completa
