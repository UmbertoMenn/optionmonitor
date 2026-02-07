

## Fix: Sincronizzare Logica Avvisi con Strategie Derivati

### Problema Attuale

La Edge Function `check-alerts` genera classificazioni diverse dal frontend perché:

1. **Non esclude le protezioni**: Le Long PUT con stock sottostante non vengono marcate come "usate", quindi finiscono raggruppate in "Altre Strategie"
2. **Genera nomi strategia indipendenti**: La funzione `detectStrategyName` può produrre nomi diversi da quelli mostrati nell'UI
3. **Il ticker mostrato è il nome lungo**: Es. "WESTERN" invece di "WDC", "Rigetti" invece di "RGTI"

### Esempio Rigetti

| Posizione | Frontend | Edge Function (attuale) |
|-----------|----------|------------------------|
| CALL venduta $32 | Covered Call | Covered Call |
| PUT venduta $33 | Naked Put | Parte di "Diagonal Put Spread" |
| PUT comprata $17 | Protezione | Parte di "Diagonal Put Spread" |

---

## Soluzione Proposta

### Approccio Nuovo: Leggere le Strategie dal Database

Invece di replicare la logica di categorizzazione (che può divergere), la Edge Function dovrebbe:

1. **Memorizzare le strategie calcolate dal frontend** in una tabella dedicata (popolata quando l'utente visualizza la pagina Derivatives)
2. **Leggere le strategie salvate** durante il check degli avvisi
3. **Generare avvisi coerenti** con quanto mostrato nell'UI

Questo garantisce che gli avvisi corrispondano **esattamente** a ciò che l'utente vede.

### Flusso Proposto

```text
Frontend (Derivatives.tsx)            Edge Function (check-alerts)
         │                                      │
         │  1. categorizeDerivatives()          │
         │  2. Salva in "strategy_cache"   ──>  │
         │                                      │  3. Legge da "strategy_cache"
         │                                      │  4. Genera avvisi coerenti
```

---

## Modifiche Tecniche

### 1. Nuova Tabella `strategy_cache`

```sql
CREATE TABLE strategy_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  strategy_key TEXT NOT NULL,           -- es. "IC_nvidia_123_456_789_012"
  strategy_type TEXT NOT NULL,          -- "Iron Condor", "Double Diagonal", "Covered Call", etc.
  underlying TEXT NOT NULL,             -- nome sottostante
  ticker TEXT,                          -- ticker risolto (WDC, RGTI, etc.)
  position_ids TEXT[] NOT NULL,         -- array di position.id inclusi
  sold_put_strike NUMERIC,
  sold_call_strike NUMERIC,
  is_range_strategy BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, strategy_key)
);
```

### 2. Modifica Frontend (`Derivatives.tsx`)

Dopo `categorizeDerivatives()`, salvare le strategie nel database:

```typescript
useEffect(() => {
  if (categories && portfolio?.id) {
    saveStrategyCache(portfolio.id, categories);
  }
}, [categories, portfolio?.id]);
```

### 3. Modifica Edge Function

Sostituire la logica di categorizzazione con una lettura dalla cache:

```typescript
// Invece di ricalcolare le strategie...
const { data: strategiesFromCache } = await supabase
  .from('strategy_cache')
  .select('*')
  .eq('portfolio_id', portfolioId);

// Costruire usedPositionIds dai position_ids delle strategie
for (const strategy of strategiesFromCache) {
  for (const posId of strategy.position_ids) {
    usedPositionIds.add(posId);
  }
}

// Generare avvisi basati sulle strategie in cache
for (const strategy of strategiesFromCache) {
  // Usa strategy.strategy_type per decidere quale alert generare
  // Usa strategy.ticker per il messaggio
  // Usa strategy.sold_put_strike / sold_call_strike per i calcoli
}
```

### 4. Formato Messaggi Notifica

Modificare il messaggio in `check-alerts` e `send-notification`:

```typescript
// Nuovo formato messaggio
const message = {
  severity: 'critical' | 'warning' | 'info',
  ticker: resolvedTicker,        // "WDC" non "WESTERN"
  strategy: strategyName,        // "Double Diagonal" o "Altre Strategie"
  alertType: 'distanza' | 'prezzo' | 'stato',
  details: specificMessage,      // "WDC si avvicina allo strike della call venduta"
  strike: {
    type: 'PUT' | 'CALL',
    value: strikePrice
  },
  underlyingPrice: currentPrice
};
```

Telegram/Email:

```text
🚨 Avviso Portafoglio
🔴 Critical

Ticker: WDC
Strategia: Double Diagonal
Tipo Alert: Avviso di distanza
Messaggio: WDC si avvicina allo strike della call venduta
Strike: CALL $50.00

**Prezzo WDC**: $48.75
```

---

## File da Modificare/Creare

| File | Azione | Descrizione |
|------|--------|-------------|
| `migrations/` | Creare | Tabella `strategy_cache` |
| `src/lib/derivativeStrategies.ts` | Modificare | Esportare funzione `saveStrategyCache` |
| `src/pages/Derivatives.tsx` | Modificare | Chiamare `saveStrategyCache` quando le categorie cambiano |
| `supabase/functions/check-alerts/index.ts` | Riscrivere | Leggere da cache invece di ricalcolare |
| `supabase/functions/send-notification/index.ts` | Modificare | Nuovo formato messaggio |

---

## Vantaggi

1. **Coerenza garantita**: Gli avvisi corrispondono esattamente a ciò che l'utente vede
2. **Manutenzione semplificata**: La logica di categorizzazione esiste solo nel frontend
3. **Ticker corretti**: Il frontend già risolve i ticker tramite `underlying_prices`, basta salvarli
4. **Performance**: La Edge Function non deve più eseguire la logica di categorizzazione

## Svantaggi

1. **Dipendenza dal frontend**: Gli avvisi funzionano solo se l'utente ha visitato la pagina Derivatives almeno una volta
2. **Latenza**: Le strategie vengono aggiornate solo quando l'utente apre la pagina

## Mitigazione

Per gestire il caso in cui la cache non esiste (utente non ha mai visitato Derivatives):
- La Edge Function può fallback sulla logica attuale
- Oppure può saltare l'utente e loggare un warning

---

## Stima Complessita'

- **Migrazione DB**: Bassa
- **Frontend**: Media (aggiungere salvataggio cache)
- **Edge Function**: Alta (riscrivere la logica principale)
- **Notifiche**: Bassa (modificare formato messaggio)

**Tempo stimato**: 2-3 ore

