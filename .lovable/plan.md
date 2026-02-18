
## Aggiungere scadenze opzioni al briefing giornaliero

### Problema
Nel messaggio di briefing della mattina, gli strike delle opzioni vengono mostrati senza la data di scadenza. Ad esempio: `AAPL strike 200` invece di `AAPL strike 200 (21 mar)`.

### Soluzione

**File: `supabase/functions/daily-briefing/index.ts`**

I dati di scadenza sono gia disponibili nella `strategy_cache` (`sold_call_expiry`, `sold_put_expiry`). Basta formattarli e aggiungerli accanto agli strike in ogni sezione del briefing.

1. Aggiungere una funzione helper `formatExpiry(dateStr)` che converte `"2026-03-20"` in `"20 mar"` (formato compatto giorno + mese abbreviato italiano)

2. Aggiornare ogni sezione per includere la scadenza:
   - **Covered Call ITM**: `AAPL strike 200 (20 mar)` -- usa `sold_call_expiry`
   - **Naked Put ITM**: `AAPL strike 180 (20 mar)` -- usa `sold_put_expiry`
   - **Iron Condor OOR**: `AAPL P170/C210 (20 mar)` -- usa `sold_call_expiry` o `sold_put_expiry`
   - **Double Diagonal OOR**: stessa logica dell'Iron Condor
   - **Altre Strategie OOR**: usa la scadenza rilevante in base al tipo di strategia
   - **Leap Call in Gain**: usa `sold_call_expiry` (o la expiry dalla posizione)

Nessuna modifica al database o ad altri file necessaria.
