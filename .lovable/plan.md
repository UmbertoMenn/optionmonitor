
Obiettivo

- Fermare definitivamente la riclassificazione della PUT BAIDU come Protezione/Long Put.
- Fare in modo che gli slot azionari assegnati a Covered Call / De-Risking Covered Call restino assegnati quando riapro “Riconfigura strategie”.

Root cause reale

1. `src/lib/derivativeStrategies.ts`
   - Il ramo `derisking_covered_call` continua a costruire la strategia in modo euristico su tutti i `remaining` del sottostante.
   - `filterBySignatures(...)` viene usato solo come cleanup finale, non come base della strategia configurata.
   - Finché il path “configurato” non è strict-by-signature, una PUT comprata può restare fuori dalla DRCC e venire reinterpretata dal motore generico.

2. `src/components/derivatives/StrategyConfigWizard.tsx`
   - Al salvataggio viene persistito un solo `linked_stock_id`.
   - In più, gli slot virtuali perdono il suffisso `__slot_n`, quindi il wizard non sa più quali slot erano stati scelti.
   - Se una strategia contiene più slot stock, o se più strategie sullo stesso sottostante/tipo condividono slot diversi, al reopen gli slot tornano nel pool libero.

Implementazione

1. Rendere le strategie configurate 100% deterministiche
   - In `categorizeDerivatives`, per `covered_call` e `derisking_covered_call`, partire da:
     - `matched = filterBySignatures(remaining, config.position_signatures)`
   - Costruire la strategia solo con `matched`, non con tutti i `remaining`.
   - Marcare subito `matched` come usati.
   - Nessuna auto-promozione/auto-downgrade nel path configurato: se il tipo salvato è `derisking_covered_call`, quella PUT deve restare lì.

2. Uniformare il matching del sottostante
   - Usare un helper unico basato su:
     - `getCanonicalKey(...) || normalizeForMatching(...)`
   - Applicarlo in:
     - filtro iniziale dei `remaining`
     - strict guard
     - cleanup/orphans
   - Così elimino qualsiasi fuga dovuta a chiavi di matching incoerenti.

3. Persistire gli slot reali, non un solo stock id
   - Aggiungere una colonna nuova in tabella, ad esempio:
     - `linked_stock_slot_ids jsonb not null default '[]'::jsonb`
   - Backfill dei record esistenti da `linked_stock_id` verso array legacy.
   - Nessuna modifica alle policy: serve solo estendere lo schema.

4. Aggiornare salvataggio e ripristino del wizard
   - `useStrategyConfigurations`: estendere i tipi con `linked_stock_slot_ids`.
   - `StrategyConfigWizard.handleSave`:
     - salvare tutti gli slot stock presenti nella strategia
     - mantenere `linked_stock_id` solo come fallback legacy
   - Dedup:
     - oltre a unire le `position_signatures`, unire in modo univoco anche `linked_stock_slot_ids`
   - `restoreFromConfigs`:
     - ripristinare tutti gli slot salvati
     - se il record è legacy o incompleto, assegnare abbastanza slot in base ai contratti CALL coperti, non solo il primo slot disponibile

5. Allineare anche la riconciliazione
   - `src/components/derivatives/StrategyReconciliationDialog.tsx`
   - Usare `linked_stock_slot_ids` per riagganciare tutti gli slot già assegnati anche nel flusso di riconciliazione.

Verifiche da coprire

- Caso BAIDU:
  - config `derisking_covered_call` con CALL venduta + PUT comprata
  - la PUT deve finire in `deRiskingCoveredCalls`
  - `longPuts` deve restare vuoto per quella PUT
- Reopen wizard:
  - strategia con più stock slots
  - dopo save + reopen gli stessi slot devono risultare già assegnati
  - nessuno di quegli slot deve tornare tra le posizioni disponibili

File coinvolti

- `src/lib/derivativeStrategies.ts`
- `src/components/derivatives/StrategyConfigWizard.tsx`
- `src/components/derivatives/StrategyReconciliationDialog.tsx`
- `src/hooks/useStrategyConfigurations.ts`
- `supabase/migrations/...`
- test di regressione in `src/test/...`

Dettagli tecnici

- Non serve toccare file auto-generati dell’integrazione backend.
- Non servono nuove regole di accesso ai dati.
- Questa correzione attacca la causa strutturale:
  - strategia configurata = matching per firme salvate, non euristiche
  - slot stock = persistenza esatta, non approssimata
