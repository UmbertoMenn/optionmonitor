

## Diagnosi: Auto-Snapshot non crea record

### Il problema

Il cron job pg_cron alle 23:59 **funziona correttamente** — viene eseguito ogni notte con status `succeeded`. Ma la edge function `auto-snapshot` non produce risultati perché i dati di staging in `portfolio_latest_values` sono troppo vecchi.

### Causa root

1. `portfolio_latest_values` viene aggiornata **solo quando un utente apre la Dashboard** (useEffect in Dashboard.tsx, riga 106-122)
2. La edge function ha un controllo di sicurezza: se `updated_at` è più vecchio di 48 ore, salta il portfolio
3. Attualmente, `portfolio_latest_values` ha `updated_at` del **24 febbraio** per tutti i portfoli — oltre 7 giorni fa
4. Quindi il cron gira, ma la funzione risponde `skipped: 7, created: 0` ogni notte

In pratica: se nessun utente apre la Dashboard nel giorno dell'upload, lo staging non viene aggiornato e lo snapshot automatico non viene mai creato.

### Evidenza dai dati

- L'unico snapshot auto-generato dal cron è quello del **25/02 alle 23:59** (portfolio MELD) — perché il 24/02 un utente aveva aperto la Dashboard
- Tutti gli altri snapshot recenti (26/02, 28/02, 04/03) sono stati creati **manualmente** dagli utenti durante il giorno

### Soluzione proposta

Spostare l'aggiornamento di `portfolio_latest_values` dal Dashboard (che richiede interazione utente) al **momento dell'upload Excel** nel FileUploader. Così i valori vengono sempre aggiornati quando c'è un nuovo file, indipendentemente dal fatto che l'utente navighi nella Dashboard.

**Modifiche:**

1. **`src/components/dashboard/FileUploader.tsx`** — Dopo il salvataggio delle posizioni e del portfolio, calcolare e scrivere i valori in `portfolio_latest_values` con i dati appena parsati dall'Excel (totalValue, netting, esposizioni). Questo garantisce che i dati di staging siano sempre freschi al momento dell'upload.

2. **`supabase/functions/auto-snapshot/index.ts`** — Mantenere il controllo 48h come safety net, ma il problema si risolve alla fonte: i dati saranno freschi perché aggiornati all'upload.

3. **Opzionale**: Mantenere anche l'aggiornamento nel Dashboard.tsx come backup (doppia scrittura non crea problemi grazie all'upsert).

### Complessità

Il FileUploader ha già accesso a `summary` (totalValue) e alle posizioni parsate. Servono i calcoli di netting e esposizioni che attualmente avvengono nel Dashboard. Due opzioni:

**Opzione A** (semplice): Salvare solo `total_value` dal FileUploader e calcolare netting/esposizioni a zero — lo snapshot avrà almeno il valore totale corretto. Il Dashboard sovrascriverà con i valori completi quando l'utente lo apre.

**Opzione B** (completa): Replicare i calcoli di netting e esposizione nel FileUploader, utilizzando le stesse funzioni di `riskCalculator.ts` e `currencyExposure.ts`.

Raccomando **Opzione B** per avere snapshot completi e accurati senza dipendere dall'apertura della Dashboard.

