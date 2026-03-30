

## Fix: errore salvataggio + sottostanti duplicati + auto-classificazione

### Problema 1: Errore nel salvare la configurazione

**Causa**: La tabella `strategy_configurations` ha un vincolo UNIQUE su `(portfolio_id, underlying, strategy_type)`. Se il wizard produce due strategie con lo stesso `underlying` e `strategy_type` (es. due "other" per lo stesso sottostante, o due strategie diverse che risolvono allo stesso underlying), l'insert fallisce dopo il delete.

**Fix in `handleSave`** (`StrategyConfigWizard.tsx`):
- Prima dell'insert, aggregare/deduplicare i configs: se due strategie hanno lo stesso `(underlying, strategy_type)`, unire le loro `position_signatures` in un unico record
- In alternativa (più robusto): aggiungere un suffisso numerico all'underlying quando ci sono duplicati (es. `"DIGITAL CORP"`, `"DIGITAL CORP #2"`)

**Fix alternativo nel batch** (`useStrategyConfigurations.ts`):
- Usare `upsert` con `onConflict` invece di `delete + insert`, oppure deduplicare i rows prima dell'insert

### Problema 2: Sottostanti duplicati (BAIDU, Super Micro)

**Causa**: `getUnderlyingKey` concatena `description + ticker` per gli stock. Token extra (ticker, "AZ.") inquinano il matching `includes` bidirezionale contro il derivato.

**Fix in `getUnderlyingKey`**:
- Provare il matching anche solo sulla `description` (senza ticker)
- Aggiungere fallback con **token overlap**: estrarre token significativi (>2 chars, escluse stopword come INC, LTD, CORP, AZ) e se condividono almeno un token significativo → stesso sottostante

### Problema 3: Posizioni fantasma dopo auto-classifica

**Causa**: `autoClassify` usa ID originali degli stock (`"abc123"`), ma il wizard usa slot virtuali (`"abc123__slot_0"`). L'`assignedIds` non trova match.

**Fix in `handleAutoClassify`**:
- Dopo che `autoClassify` produce le strategie, rimappare ogni posizione stock all'ID slottato corrispondente in `allAvailable`

### Problema 4: Auto-classificazione non rileva De-Risking CC e Put Spread

**Fix in `autoClassify`**:
- Post-merge: se esiste una covered call + long put sullo stesso sottostante → `derisking_covered_call`
- Per grouped other strategies: usare `detectStrategyType` per assegnare `put_spread` / `diagonal_put_spread` invece di `'other'`

### File da modificare

1. **`src/components/derivatives/StrategyConfigWizard.tsx`**:
   - `getUnderlyingKey`: token overlap fallback
   - `handleAutoClassify`: rimappatura ID slottati
   - `autoClassify`: merge CC+put → derisking, detect put spread
   - `handleSave`: deduplicazione configs prima del salvataggio

2. **`src/hooks/useStrategyConfigurations.ts`**:
   - `upsertBatchMutation`: aggiungere deduplicazione rows prima dell'insert come safety net

### Ordine di esecuzione
1. Fix salvataggio (deduplicazione) — risolve l'errore immediato
2. Fix matching sottostanti — risolve BAIDU/Super Micro
3. Fix slot ID remapping — risolve posizioni fantasma
4. Fix auto-classificazione avanzata — rileva derisking CC e put spread

