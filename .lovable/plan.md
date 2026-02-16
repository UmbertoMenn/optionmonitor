

## Rinominare "Gain Potenziale" in "Flussi di cassa" per il Double Diagonal

### Contesto
Per il Double Diagonal, i termini "Gain Potenziale" e "Calcola gain potenziale" non sono appropriati: il valore rappresenta i flussi di cassa storici, non un guadagno potenziale. Occorre aggiornare tooltip e titoli.

### Modifiche

**File: `src/pages/Derivatives.tsx`**

1. **Riga 1487** - Tooltip del pulsante calcolatrice nella riga Double Diagonal:
   - Da: `"Calcola gain potenziale"`
   - A: `"Calcola flussi di cassa"`

2. **Riga 1584** - Tooltip del P/L sulla riga Double Diagonal:
   - Da: `"...+ GP calcolatrice"`
   - A: `"...+ flussi di cassa calcolatrice"`

**File: `src/components/derivatives/CallPremiumCalculatorDialog.tsx`**

Il componente riceve gia' `strategyType` come prop, quindi possiamo distinguere il Double Diagonal.

3. **Riga 247** - Titolo del dialog:
   - Da: `isMultiLeg ? 'Calcola Gain Potenziale' : 'Calcola Premi CALL'`
   - A: logica a 3 vie: `strategyType === 'double_diagonal' ? 'Calcola Flussi di cassa' : isMultiLeg ? 'Calcola Gain Potenziale' : 'Calcola Premi CALL'`

4. **Riga 297** - Etichetta del valore principale nel dialog:
   - Da: `isMultiLeg ? 'Gain Potenziale' : 'Netto Unitario'`
   - A: `strategyType === 'double_diagonal' ? 'Flussi di cassa' : isMultiLeg ? 'Gain Potenziale' : 'Netto Unitario'`

### Note
- Iron Condor e Altre Strategie mantengono "Gain Potenziale" invariato
- Nessuna modifica alla logica di calcolo, solo testi e tooltip
