## Obiettivo
Aggiungere nella tab "Avvisi di Prezzo" del dialog "Gestisci avvisi" una sezione per **creare in blocco più avvisi di prezzo** su un ticker, distanziati di una % impostabile, a partire dal prezzo corrente o da un prezzo manuale.

## UX (in `AlertSettingsDialog.tsx`, sotto il form di creazione singola)

Nuova card **"Crea avvisi massivi"** con i seguenti campi:

1. **Ticker** — input + pulsante "Valida" (riutilizza `validateTicker`, mostra prezzo corrente rilevato).
2. **Prezzo di partenza** — radio:
   - "Prezzo attuale" (auto-compilato dopo la validazione, sola lettura)
   - "Prezzo manuale" (input numerico)
3. **Step %** — input numerico (default 5, range 0,1–50, step 0,1).
4. **Numero di avvisi** — slider 1–20 (default 10).
5. **Direzione** — radio:
   - Solo sopra (rialzo)
   - Solo sotto (ribasso)
   - Entrambe (genera N sopra + N sotto)
6. **Cancella dopo trigger** — switch (come per singolo).
7. **Anteprima** — lista compatta dei prezzi target calcolati (es. `+5%: 105.00`, `+10%: 110.25`, …) con badge direzione.
8. **Pulsante "Crea N avvisi"** — disabilitato finché ticker valido e parametri OK.

## Calcolo prezzi
- Base `P0` = prezzo attuale validato o prezzo manuale.
- Per `i = 1..N`: 
  - Sopra → `P0 * (1 + step/100)^i`
  - Sotto → `P0 * (1 - step/100)^i`
- Arrotondamento a 2 decimali per visualizzazione; valore numerico completo inviato al DB.
- Se "Entrambe" → si creano `2*N` avvisi (sopra `above`, sotto `below`).

## Logica creazione
- Nessun cambio schema DB: si usa la tabella `price_alerts` esistente.
- Nuovo hook `useBatchCreatePriceAlerts` in `src/hooks/usePriceAlerts.ts` che fa una singola `insert([...])` con array di righe (più efficiente del loop), restituisce conteggio inseriti.
- Toast riassuntivo: "Creati N avvisi su TICKER". In caso di errori, mostra messaggio.
- Invalida `['price-alerts']` a fine creazione.

## File toccati
- `src/hooks/usePriceAlerts.ts` — aggiunto `useBatchCreatePriceAlerts`.
- `src/components/derivatives/AlertSettingsDialog.tsx` — nuova sub-sezione UI nella tab Avvisi di Prezzo + stato locale per i parametri massivi + handler.

Nessuna modifica al backend, alle edge function o alle policy RLS (le insert massive sono coperte dalle policy esistenti `user_id = auth.uid()`).