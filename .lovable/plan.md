
Obiettivo: correggere definitivamente il caso SAP (prezzo ADR USD al posto di Xetra EUR) e l’errore “Call non coperte” nel briefing mattutino.

1) Diagnosi confermata (con dati reali)
- In database c’è una mappatura errata: `underlying_mappings` contiene `SAP -> SAP` (fonte auto), mentre dovrebbe essere `SAP -> SAP.DE`.
- In `underlying_prices` esistono entrambi i prezzi:
  - `SAP` in USD (ADR USA)
  - `SAP.DE` in EUR (Xetra)
- Nel briefing, per AndreaZ:
  - lo stock `SAP SE` viene risolto su chiave `SAP.DE`
  - ma `strategy_cache` salva le strategie SAP con `ticker = SAP`
  - risultato: chiavi diverse (`SAP.DE` vs `SAP`) e falsa segnalazione “Call non coperte”.

2) Fix codice (backend + frontend)
- File: `supabase/functions/fetch-underlying-prices/index.ts`
  - Spostare la priorità: prima `SPECIAL_MAPPINGS` (dove SAP=SAP.DE), poi il controllo “input sembra ticker”.
  - Evitare che un simbolo ambiguo (es. SAP) bypassi il mapping europeo.
- File: `src/lib/strategyCache.ts`
  - In `resolveTicker`, usare prima il ticker risolto da `underlyingPrices[underlying]`.
  - Solo in fallback usare il pattern “sembra ticker”.
  - Così “SAP” non viene più forzato a ADR quando il mapping corretto è `SAP.DE`.
- File: `supabase/functions/daily-briefing/index.ts`
  - Per il blocco “Call non coperte”, usare una chiave unificata derivata da mapping (`resolveStockTicker`) anche lato strategie, non solo `s.ticker`.
  - Per il prezzo strategia, privilegiare ticker risolto da mapping prima di `s.ticker` cache.
  - Questo elimina i falsi positivi anche se cache vecchia.

3) Correzione dati esistenti (migrazione)
- Aggiungere una migration SQL che:
  - corregge `underlying_mappings` per SAP (`SAP -> SAP.DE`)
  - riallinea `strategy_cache.ticker` per righe SAP chiaramente europee (portafogli con stock `SAP SE`/opzioni EUREX in EUR), così il briefing torna corretto subito senza attendere rigenerazioni casuali.

4) Verifica finale
- DB check:
  - `underlying_mappings` mostra `SAP -> SAP.DE`
  - `strategy_cache` per AndreaZ mostra ticker `SAP.DE`
- UI check:
  - in Derivatives/Dashboard, SAP usa prezzo EUR (non ADR USD)
  - in riepilogo monitoraggio non compare più “Call non coperte” su SAP quando c’è copertura 100 azioni / 1 call
- Briefing check:
  - al prossimo giro briefing, SAP non deve più apparire come uncovered nel caso di AndreaZ.

Dettagli tecnici (sintesi)
- Root cause 1: ordine di risoluzione ticker sbagliato nel fetch auto (ticker-like prima del mapping statico).
- Root cause 2: mismatch di chiavi tra stock e strategie nel briefing (`SAP.DE` vs `SAP`) dovuto a cache ticker non canonica.
- La soluzione rende coerenti: mapping DB, cache strategie, calcolo briefing.
