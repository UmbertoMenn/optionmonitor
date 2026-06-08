
# Upload di due file Excel con merge intelligente

Permettere il caricamento di 1 o 2 file Excel portfolio nella stessa operazione. Le posizioni (azioni, obbligazioni, ETF, derivati, commodity) vengono unite; la liquidità viene deduplicata per ID conto e contata una sola volta.

## Vincoli funzionali

- I due file devono avere la stessa `snapshot_date`. Date diverse → errore bloccante, nessun salvataggio.
- La deduplicazione cassa avviene per **codice conto** (prima cella della riga sezione "DISPONIBILITA' LIQUIDE" del file Fideuram). Se lo stesso ID compare in entrambi i file, conta solo la prima occorrenza.
- Le posizioni si sommano per concatenazione semplice (no merge per ISIN): se la stessa posizione compare in entrambi i file viene caricata due volte. Si presume che i due file rappresentino sotto-portafogli distinti dello stesso cliente, quindi non devono contenere duplicati di titoli.
- Il GP upload (seconda dropzone esistente) resta invariato e singolo.

## Modifiche file

### 1. `src/lib/excelParser.ts`
- Aggiungere al return di `parsePortfolioExcel` (e `parsePortfolioData`) un campo `cashAccounts: { accountId: string; value: number }[]` che lista i singoli conti di liquidità non esclusi, oltre al `cashValue` aggregato.
- Modificare il ramo `currentSection === 'cash'`: invece di sommare direttamente in `cashValue`, pushare `{ accountId, value }` in `cashAccounts`. Il totale `cashValue` viene calcolato a fine parsing come somma dei `value`. Comportamento single-file invariato.

### 2. `src/components/dashboard/FileUploader.tsx`
- Dropzone Portfolio: `maxFiles: 2`, accetta 1 o 2 file.
- Nuova funzione `mergePortfolioParseResults(results)`:
  - Verifica che tutte le `snapshotDate` siano uguali (ignorando i `null`). Se differiscono → `toast.error` e abort.
  - Concatena `positions[]` di tutti i file.
  - Deduplica `cashAccounts` per `accountId` (Map con prima occorrenza). `cashValue` finale = somma dei value unici. ID vuoti/falsy non vengono deduplicati (trattati come distinti).
  - Restituisce `{ positions, cashValue, snapshotDate }`.
- `onDropPortfolio` itera su tutti gli `acceptedFiles`, parsa ciascuno in parallelo con `Promise.all`, applica `mergePortfolioParseResults`, poi prosegue identico al flusso esistente (update portfolio, `updatePositionsAsync`, snapshot, refresh cache).
- UI della slide Portfolio: aggiungere sottotitolo "Puoi caricare fino a 2 file" e mostrare in `DropzoneContent` il numero di file selezionati durante il drag se >1.
- Messaggio toast finale: "Portfolio caricato! N posizioni da X file."

### 3. Nessuna modifica DB
- I dati continuano a essere salvati come oggi: il portfolio ha un unico `cash_value` e una sola lista di `positions`. Il merge avviene client-side prima del salvataggio.

## Edge cases gestiti

- Solo 1 file → comportamento identico a oggi.
- 2 file con date diverse → errore, nulla viene scritto.
- 2 file con stesso conto liquidità → contato una volta.
- 2 file con conti liquidità diversi → sommati.
- Conto liquidità senza accountId riconoscibile → non deduplicato (sommato), con warning in console.

## Fuori scope

- Persistere quale file ha generato quali posizioni.
- UI per scegliere quale liquidità prevale in caso di conflitto sullo stesso accountId (si tiene la prima).
- Memorizzazione cross-sessione di un flag "cliente multi-file".
