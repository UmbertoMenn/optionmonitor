
Obiettivo: ripristinare in modo definitivo (e a prova di regressioni) 1) la scomposizione ETF (currency exposure + sector allocation) e 2) l’uso coerente dei mapping settoriali già presenti in ADMIN → SETTORI (es. Applied Digital = Technology) dentro il Risk Analyzer, con un approccio metodico (test, logs, fallback).

---

## 1) Diagnosi (cosa sta succedendo davvero)

### 1.1 ETF “0 analizzati” non è un problema di `isETF`
Dai tuoi screenshot il conteggio “✓ 0 ETF analizzati” appare in verde: questo succede quando:
- `etfCount > 0` (quindi gli ETF vengono riconosciuti e gli ISIN vengono estratti),
- ma `loadedETFCount = 0` (quindi **non arriva nessuna allocation caricata in frontend**).

Questo spiega perché:
- gli ETF restano “non scomposti” (currency/sector),
- finiscono in “Other” lato settore quando non hanno sectorAllocations disponibili in runtime.

### 1.2 Root cause trovata: due backend functions chiave risultano **non disponibili**
Ho testato direttamente le backend functions:
- `fetch-etf-allocation` → **404 NOT_FOUND (Requested function was not found)**
- `update-prices-cron` → **404 NOT_FOUND**

Invece almeno un’altra function (`fetch-underlying-prices`) risponde (400 su payload errato), quindi **il sistema di backend functions è attivo, ma quelle due non sono deployate/registrate**.

Conseguenza diretta:
- `useETFAllocations()` invoca `fetch-etf-allocation` → fallisce → `allocations` resta vuoto → `loadedETFCount` resta 0.
- `useSectorMappings()` quando vede anche solo 1 strumento “da risolvere”, invoca `update-prices-cron` → fallisce; e in più (bug logico) rischia di **non settare nemmeno i mapping già esistenti**, lasciando `sectorMappings` vuoto/non completo.
  - Questo spiega perfettamente il caso “ADMIN dice APLD=Technology ma RiskAnalyzer lo mette in Other”: se il mapping non viene caricato/tenuto, si va in fallback “Other”.

### 1.3 Dati in database ci sono (quindi si può ripartire subito)
- `isin_mappings` contiene le righe corrette per AAPL/GOOGL/APLD ecc. (es. APLD → Technology).
- `etf_allocations` contiene già allocazioni per alcuni ETF del portfolio (es. MSCI World, S&P 500, ecc.).
Quindi il problema principale non è “mancano i dati”: è “il frontend non riesce a caricarli perché le functions non sono disponibili”.

---

## 2) Strategia di risoluzione (precisa, robusta, con test)

### Step A — Ripristino backend functions (fix strutturale)
1) Verificare/aggiungere configurazione in `supabase/config.toml`:
   - aggiungere una sezione per `fetch-etf-allocation` (attualmente manca).
   - ricontrollare che `update-prices-cron` sia correttamente dichiarata (c’è già, ma non risulta deployata).
2) Eseguire **deploy esplicito** delle due functions:
   - `fetch-etf-allocation`
   - `update-prices-cron`
3) Smoke test automatico (prima di guardare la UI):
   - chiamare `fetch-etf-allocation` con un ISIN noto del tuo portfolio (es. `IE00B4L5Y983`) e verificare che ritorni JSON con `currencyAllocations` e `sectorAllocations`.
   - chiamare `update-prices-cron` con un payload “light” (es. una modalità di test/resolve) e verificare che non sia più 404.

Risultato atteso: le chiamate da browser non falliscono più e l’app torna a popolare `allocations` e `sectorMappings` come prima.

---

### Step B — Hardening frontend: fallback + visibilità errori (anti-regressione)
Anche con le functions deployate, vogliamo evitare che un futuro problema “silenzioso” rimetta tutto a 0.

4) `useETFAllocations`:
   - Se `supabase.functions.invoke('fetch-etf-allocation')` fallisce (404 o altro), fare fallback automatico:
     - leggere direttamente da tabella `etf_allocations` con `.in('isin', etfIsins)`,
     - popolare comunque `allocations` con i dati cache,
     - mostrare un toast “Dati ETF caricati da cache (backend function non disponibile)” oppure un warning dedicato.
   - Aggiungere esposta in UI (Currency/Sector cards) una riga “Errori ETF: N” cliccabile (o tooltip) che mostra quali ISIN falliscono.

5) `useSectorMappings`:
   - Correggere la logica: **anche se la risoluzione AI fallisce**, bisogna comunque chiamare `setMappings(newMappings)` con i mapping già presenti in DB.
   - Se `update-prices-cron` fallisce: mostrare toast “Risoluzione AI non disponibile, uso mapping esistenti”.

Risultato atteso: anche se domani una function va giù, il Risk Analyzer non collassa in “Other” e gli ETF continuano a decomporsi almeno da cache.

---

### Step C — Fix specifici “Other” residui (precisione)
6) Migliorare fallback statico (solo come rete di sicurezza):
   - aggiungere mapping `APPLIED DIGITAL` → `APLD` nel dizionario `COMPANY_NAME_TO_TICKER` (e altri nomi ricorrenti che vedi spesso in “Other”).
   - Questo non sostituisce i mapping ADMIN/DB: serve solo se per qualunque motivo i mapping dinamici non arrivano.

---

## 3) Piano di test (metodico, ripetibile)

### Test 1 — Backend function availability
- Verifica che `fetch-etf-allocation` risponda 200 e ritorni sector/currency allocations.
- Verifica che `update-prices-cron` risponda 200 (non 404).

### Test 2 — Risk Analyzer: Currency Exposure
- Apri Currency Exposure:
  - deve mostrare “✓ X ETF analizzati” con X > 0 (idealmente = numero ETF in portfolio),
  - e le valute devono riflettere la decomposizione ETF (non tutto sull’EUR/OTHER).

### Test 3 — Risk Analyzer: Sector Allocation
- Apri Sector Allocation:
  - “✓ X ETF analizzati” deve essere > 0,
  - `AZ.APPLIED DIGITAL CORP` non deve stare in Other se in ADMIN è Technology (via ISIN mapping),
  - gli ETF devono contribuire ai settori secondo `sector_allocations` (non finire “Other” salvo assenza dati).

### Test 4 — Caso regressione: simulazione fallimento function
- Forzare (in dev) un errore di invoke e confermare che:
  - ETF vengono caricati da cache DB,
  - mapping settori esistenti vengono comunque usati,
  - la UI mostra un warning chiaro.

---

## 4) Impatto e criticità (trasparenza)
- Il problema attuale è “grave” perché rompe la catena di dipendenze: senza quelle due functions, l’app perde la decomposizione ETF e la risoluzione/refresh dei mapping.
- La correzione non è solo “aggiustare una regex”: va ripristinata la disponibilità delle functions e reso il frontend robusto agli errori (fallback + error surfacing), così non si ripresenta più “a sorpresa”.

---

## 5) Deliverable (cosa verrà cambiato)
- Config backend functions (aggiunta entry mancante + deploy)
- `useETFAllocations`: fallback DB + error reporting + (opzionale) batch fetch efficiente
- `useSectorMappings`: non perdere i mapping esistenti se la risoluzione fallisce + toast warning
- `sectorExposure`: aggiornamento dizionario fallback per nomi ricorrenti (APLD ecc.)
- Logging diagnostico controllato (attivabile) per tracciare: `etfIsins`, errori invoke, conteggi allocations, conteggi mappings

