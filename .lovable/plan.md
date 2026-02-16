

## Calcolatrice Gain Potenziale per Iron Condor

### Obiettivo

Aggiungere un pulsante calcolatrice nella riga Iron Condor, posizionato a fianco del pulsante OptionStrat (Col 4). Nessuna colonna "UNIT". La calcolatrice permette di caricare file ordini Excel e calcola il gain potenziale netto (tutte le operazioni eseguite: vendite = positivo, acquisti = negativo).

### Dettaglio tecnico

**1. `src/lib/orderFileParser.ts` -- Nuova funzione di filtraggio**

Aggiungere `filterAndCalculateIronCondorPremiums(orders, ticker)`:
- Filtra per `status === 'eseguito'` e `symbolMatchesTicker(symbol, ticker)`
- Nessun filtro su CALL/PUT (entrambi contribuiscono)
- Nessun filtro buy-only (tutte le operazioni contano, a differenza di Covered Call)
- Vendite: `+orderValue`, Acquisti: `-orderValue`
- Ritorna lo stesso tipo `OrderParseResult`

**2. `src/components/derivatives/CallPremiumCalculatorDialog.tsx` -- Generalizzazione**

Aggiungere prop `strategyType: 'covered_call' | 'iron_condor'` (default `'covered_call'`):
- Nel `onDrop`, scegliere `filterAndCalculateCallPremiums` o `filterAndCalculateIronCondorPremiums` in base a `strategyType`
- Label condizionali:
  - Titolo: "Calcola Premi CALL" diventa "Calcola Gain Potenziale" per Iron Condor
  - "Netto Unitario" diventa "Gain Potenziale"
- Rendimento e annualizzato restano invariati

**3. `src/pages/Derivatives.tsx` -- IronCondorRow**

- Aggiungere stato `showCalculator`
- Allargare la colonna del pulsante OptionStrat da `2rem` a `4rem` per ospitare sia OptionStrat che Calculator affiancati
- Aggiungere il pulsante Calculator con icona e tooltip "Calcola gain potenziale"
- Aggiungere `<CallPremiumCalculatorDialog>` con `strategyType="iron_condor"`
- Risolvere il ticker da `underlyingPrices[underlying]?.ticker`
- Generare `optionSymbol` come `'IC_{expiryDate}'` per unicita' nel DB
- Passare `contracts` come `contractsInPortfolio`
- Aggiornare `min-w` della griglia se necessario

### Layout griglia aggiornato

La colonna 4 (attualmente `2rem` con solo OptionStrat) diventa `4rem` e contiene entrambi i pulsanti affiancati:

```text
[Chevron][Underlying][IC badge][OptionStrat + Calculator][IR/OOR][Scad]...
```

### File da modificare

| File | Modifica |
|---|---|
| `src/lib/orderFileParser.ts` | Nuova funzione `filterAndCalculateIronCondorPremiums` |
| `src/components/derivatives/CallPremiumCalculatorDialog.tsx` | Prop `strategyType`, logica condizionale di filtraggio e label |
| `src/pages/Derivatives.tsx` | Pulsante Calculator affiancato a OptionStrat in IronCondorRow, dialog |

