

## Problemi identificati

### 1. Reconciliation si apre subito dopo il salvataggio
**Causa root**: `matchSignatureMulti` in `strategyReconciliation.ts` cerca `quantity_abs` **righe di posizioni separate** nel database. Ma le posizioni reali NON sono splittate (es. una sola riga con quantity=-3). Se la signature dice `quantity_abs=3`, la funzione trova solo 1 riga → match parziale → segnala "missing" → il dialog di riconciliazione si apre automaticamente.

**Fix**: Modificare `matchSignatureMulti` per considerare la quantità della posizione stessa. Se una posizione ha `|quantity| >= needed`, conta come match completo senza cercare altre righe.

### 2. Slot azioni devono poter essere raggruppati
**Stato attuale**: Le azioni con qty ≥ 200 vengono SEMPRE auto-splittate in slot da 100. L'utente vuole lo stesso approccio on-demand usato per le opzioni: raggruppate di default, splittabili con ✂️.

**Fix**: Applicare lo stesso pattern `splitOptionIds` anche alle azioni → rinominare in `splitPositionIds`. Le azioni entrano nel pool con quantità originale. L'utente può splittarle on-demand in slot da 100.

---

### Modifiche

**File: `src/lib/strategyReconciliation.ts`**
- Modificare `matchSignatureMulti`: quando una singola posizione ha `|quantity| >= needed`, consumarla come match completo (contando quante unità "usa") anziché cercare N righe separate. Tenere traccia delle quantità consumate per posizione in una mappa `usedQuantity: Map<string, number>`.

**File: `src/components/derivatives/StrategyConfigWizard.tsx`**
- Rimuovere auto-split azioni (righe 400-415): le azioni entrano nel pool con quantità originale
- Rinominare `splitOptionIds` → `splitPositionIds` (unifica azioni e opzioni)
- `effectivePositions`: se un'azione è in `splitPositionIds`, genera slot da 100; se un'opzione è in `splitPositionIds`, genera slot da 1
- Icona ✂️ anche per azioni con qty ≥ 200
- `restoreFromConfigs`: auto-aggiungere a `splitPositionIds` anche gli stock se la config ha `linked_stock_slot_ids` multipli

**File: `src/components/derivatives/StrategyReconciliationDialog.tsx`**
- Stesso approccio: rimuovere auto-split azioni, unificare in `splitPositionIds`

**File: `src/pages/Derivatives.tsx`**
- Dopo il salvataggio dal wizard, impostare `reconciliationCheckedRef.current = true` per evitare che la riconciliazione si riapra immediatamente. Aggiungere un flag `justSaved` che blocca il ricalcolo della riconciliazione per un ciclo.

### Riepilogo
- 4 file modificati
- Fix critico: reconciliation non si apre più dopo il salvataggio
- Azioni e opzioni raggruppate di default, splittabili on-demand con ✂️
- Stessa UX coerente per tutti i tipi di posizione

