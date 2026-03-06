
Obiettivo approvato: eliminare la logica snapshot EOD via backend function e salvare lo snapshot subito al caricamento Excel.

1) Diagnosi confermata (stato attuale)
- La function `auto-snapshot` è viva ma non crea record: sta saltando i portfolio perché i dati in `portfolio_latest_values` risultano “older than 48h”.
- Il cron `auto-snapshot-daily` è attivo (23:59), ma il meccanismo dipende da staging “fresco”.
- Oggi l’upload Excel aggiorna portfolio/positions, ma non scrive direttamente `historical_data`.

2) Nuovo flusso (quello che implementerò)
```text
Upload Excel -> parse -> update portfolio(snapshot_date/cash)
            -> salva posizioni (await)
            -> calcola metriche snapshot dal DB aggiornato
            -> upsert immediato in historical_data (stessa snapshot_date)
            -> fine
```
Quindi snapshot immediato, senza aspettare il cron notturno.

3) Modifiche previste (concrete)
A. Disattivare vecchia logica EOD
- Disattivo il job cron `auto-snapshot-daily` (unschedule).
- Rimuovo la function `auto-snapshot` dal deploy (delete function).
- Elimino i punti frontend scritti solo per alimentare quel cron:
  - `computeAndUpsertStagingValues(...)` in `FileUploader.tsx`
  - effect in `Dashboard.tsx` che upserta `portfolio_latest_values`.

B. Snapshot immediato all’upload
- In `usePortfolio.ts` espongo anche un flusso `updatePositionsAsync` (mutateAsync), così l’upload aspetta davvero il completamento DB.
- In `FileUploader.tsx`:
  - `await updatePositionsAsync(...)`
  - poi trigger di `upsertHistoricalData` automatico per la `snapshotDate` del file.
- Creo utility dedicata (es. `src/lib/uploadSnapshot.ts`) che:
  - legge posizioni appena salvate + override + cash
  - calcola:
    - `total_value`
    - `netting_total`
    - `netting_ex_cc_np` (+ mapping su `netting_ex_cc`)
    - `equity_exposure_pct`
    - `usd_exposure_pct`
  - fa `upsert` su `historical_data` con chiave `(portfolio_id, snapshot_date)`.

C. Regole operative
- Se `snapshotDate` manca nel file: niente snapshot automatico (warning chiaro in toast/log).
- Se si ricarica lo stesso giorno: upsert aggiorna il record del giorno (niente duplicati).
- Funziona anche in admin mode perché usa `targetPortfolioId`.

4) Sezione tecnica (importante)
- Non toccherò file autogenerati proibiti.
- Mantengo RLS attuale: `historical_data` è già protetta correttamente.
- Evito dipendenza da `portfolio_latest_values` nel nuovo percorso; lo staging non sarà più parte critica.
- Mantengo la refresh `strategy_cache` post-upload, ma la sequenza sarà dopo salvataggio posizioni per evitare race.

5) Verifica finale (end-to-end)
- Test 1: upload Excel su portfolio utente -> compare subito nuovo record in `historical_data` con la data del file.
- Test 2: re-upload stesso file/data -> nessun duplicato, record aggiornato.
- Test 3: controllo cron -> job `auto-snapshot-daily` assente/inattivo.
- Test 4: nessuna chiamata residua alla function `auto-snapshot`.
- Test 5: grafici storici/dashboard leggono subito il nuovo snapshot senza attese notturne.
