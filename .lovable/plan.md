

## Rimozione "Netting ex. Covered Call" dai Dati Storici

### Obiettivo
Eliminare il campo "Netting ex. Covered Call" (`netting_ex_cc`) dal form dei dati storici e dalla visualizzazione dei dati salvati, dato che la vista corrispondente è stata rimossa.

**Nota:** La colonna `netting_ex_cc` nel database resta invariata per retrocompatibilità. Quando si salva un nuovo snapshot, il valore viene impostato automaticamente uguale a `netting_ex_cc_np`.

### Modifiche

#### 1. `src/components/dashboard/HistoricalDataForm.tsx`
- Rimuovere la prop `currentNettingExCC` dall'interfaccia e dalla destrutturazione
- Rimuovere lo stato `formNettingExCC` e il relativo `setFormNettingExCC`
- Rimuovere il campo input "Netting ex. Covered Call" dal form (riga 163-171)
- Nel `handleSave`: impostare `netting_ex_cc` uguale al valore di `netting_ex_cc_np` (così il DB resta coerente)
- In `startEdit`: rimuovere il caricamento di `formNettingExCC`
- In `useCurrent`: rimuovere il set di `formNettingExCC`
- Nella visualizzazione dei dati salvati: rimuovere la riga "Netting ex. CC" (riga 286)
- Riorganizzare il layout: "Netting Totale" e "Netting ex. CC e NP" affiancati nella griglia 2 colonne

#### 2. `src/components/dashboard/Dashboard.tsx`
- Rimuovere la prop `currentNettingExCC={netting.nettingExCoveredCall}` dal componente `HistoricalDataForm`

#### 3. `src/types/historicalData.ts`
- Mantenere `netting_ex_cc` in `HistoricalDataEntry` (viene dal DB, serve per retrocompatibilità)
- Rimuovere `netting_ex_cc` da `HistoricalDataInput` (non più necessario come input utente)

### File modificati

| File | Modifica |
|------|----------|
| `src/components/dashboard/HistoricalDataForm.tsx` | Rimozione campo, stato, prop e riga di visualizzazione |
| `src/components/dashboard/Dashboard.tsx` | Rimozione prop `currentNettingExCC` |
| `src/types/historicalData.ts` | Rimozione `netting_ex_cc` da `HistoricalDataInput` |

### Comportamento atteso
- Il form mostra solo: Data, Patrimonio Totale, Netting Totale, Netting ex. CC e NP, Equity Exposure, USD Exposure
- I dati salvati mostrano le stesse voci (senza "Netting ex. CC")
- Il valore `netting_ex_cc` nel DB viene impostato automaticamente uguale a `netting_ex_cc_np` per coerenza
