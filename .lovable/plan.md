

## Reconciliazione Strategie Post-Upload con Dialog Automatico

### Concetto

Quando l'utente atterra sulla pagina Strategie Derivati e ci sono configurazioni salvate, il sistema confronta automaticamente le `position_signatures` salvate con le posizioni attuali. Se ci sono discrepanze (opzioni rimosse, opzioni nuove, quantità cambiate), si apre automaticamente un dialog di riconciliazione che mostra per ogni sottostante:
- La configurazione salvata (vecchie gambe)
- Le posizioni attuali (nuove gambe)
- La possibilità di riconfigurarle direttamente nella stessa scheda

### Logica di rilevamento discrepanze

Per ogni `strategy_configuration` salvata:
1. Trovare le posizioni attuali che matchano per `underlying` normalizzato
2. Confrontare le `position_signatures` salvate (strike, expiry, option_type, quantity_sign) con le firme delle posizioni trovate
3. Produrre per sottostante:
   - **Gambe mancanti**: signatures salvate senza posizione corrispondente (opzione chiusa/esercitata)
   - **Gambe nuove**: posizioni attuali non coperte da nessuna signature salvata
   - **Sottostanti invariati**: nessuna discrepanza → non mostrati

### Nuovo componente: `StrategyReconciliationDialog`

Un dialog che si apre automaticamente al mount della pagina Derivati quando vengono rilevate discrepanze. Per ogni sottostante con cambiamenti:

```text
┌─────────────────────────────────────────────────┐
│  ⚠ Configurazioni da aggiornare                │
│                                                  │
│  ┌─ APPLE INC ─────────────────────────────────┐│
│  │ Strategia: Covered Call                      ││
│  │                                              ││
│  │ ❌ Rimossa: V CALL 230 MAR/25               ││
│  │ ✅ Presente: V CALL 240 GIU/25              ││
│  │ 🆕 Nuova: V CALL 250 SET/25                ││
│  │                                              ││
│  │ [Seleziona gambe] [Tipo strategia ▼]        ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  ┌─ BAIDU INC ──────────────────────────────────┐│
│  │ ... (simile)                                  ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│          [Ignora] [Salva aggiornamenti]          │
└─────────────────────────────────────────────────┘
```

Ogni card sottostante ha:
- Le gambe salvate (con badge ❌ se mancanti, ✅ se ancora presenti)
- Le gambe nuove (con badge 🆕)
- Checkbox per selezionare quali gambe includere nella nuova configurazione
- Select per cambiare il tipo di strategia
- Auto-detect del tipo basato sulle gambe selezionate

### Modifiche ai file

**1. Nuovo file `src/lib/strategyReconciliation.ts`**
- `reconcileConfigs(configs, currentPositions)`: per ogni config, confronta le signatures con le posizioni attuali per underlying
- Restituisce una lista di `ReconciliationItem` con `{ config, missingLegs, presentLegs, newLegs, hasChanges }`
- Il matching usa `normalizeForMatching` per confrontare underlying e le signatures per (option_type, strike, expiry, quantity_sign)

**2. Nuovo componente `src/components/derivatives/StrategyReconciliationDialog.tsx`**
- Riceve le discrepanze e le posizioni attuali
- Per ogni sottostante con cambiamenti, mostra una card con:
  - Gambe salvate mancanti (rosse, con ❌)
  - Gambe salvate presenti (verdi, con ✅, pre-selezionate)
  - Gambe nuove non configurate (blu, con 🆕, selezionabili)
  - Select tipo strategia (pre-impostato al tipo salvato, aggiornato con auto-detect)
  - Toggle sintetica
- Pulsanti: "Ignora" (chiude senza salvare), "Salva aggiornamenti" (salva le nuove configs)
- Un flag "Non mostrare più per questa sessione" per evitare di riaprirsi

**3. Modifica `src/pages/Derivatives.tsx`**
- Al mount, se `hasConfigurations` è true, eseguire `reconcileConfigs(strategyConfigs, positions)`
- Se ci sono discrepanze → aprire automaticamente `StrategyReconciliationDialog`
- Usare un `useRef` per aprirlo solo una volta per sessione/mount
- Passare `upsertBatch` come callback di salvataggio

### Flusso utente
1. Upload nuovo Excel → posizioni aggiornate nel DB
2. Visita pagina Strategie Derivati
3. Il sistema confronta configs salvate vs posizioni attuali
4. Se ci sono differenze → dialog si apre automaticamente
5. L'utente vede per ogni sottostante cosa è cambiato
6. Può riselezionare le gambe, cambiare tipo strategia, e salvare
7. Il dialog salva le configs aggiornate e si chiude

