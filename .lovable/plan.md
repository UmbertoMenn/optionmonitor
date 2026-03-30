

## Aggiungere sezioni "Put Spread" e "Diagonal Put Spread" nella pagina Strategie Derivati

### Approccio

Le posizioni classificate come `put_spread` o `diagonal_put_spread` nel wizard attualmente finiscono tutte in `groupedOtherStrategies` con il campo `strategyName`. Invece di creare nuove categorie nel motore `categorizeDerivatives`, filtriamo `groupedOtherStrategies` in base a `strategyName` e `strategy_type` della configurazione per mostrarle in sezioni dedicate.

### File da modificare

**1. `src/hooks/useStrategyConfigurations.ts`**
- Aggiungere a `STRATEGY_TYPE_LABELS`:
  - `put_spread: 'Put Spread'`
  - `diagonal_put_spread: 'Diagonal Put Spread'`

**2. `src/components/derivatives/StrategyConfigWizard.tsx`**
- Aggiungere a `STRATEGY_OPTIONS`:
  - `{ value: 'put_spread', label: 'Put Spread' }`
  - `{ value: 'diagonal_put_spread', label: 'Diagonal Put Spread' }`
- In `detectStrategyType` (riga ~108): quando `hasPutSpread && !soldCalls && !boughtCalls`, distinguere per scadenza:
  - Stessa scadenza tra tutte le put → `'put_spread'`
  - Scadenze diverse → `'diagonal_put_spread'`

**3. `src/pages/Derivatives.tsx`**
- Aggiungere state: `putSpreadOpen`, `diagonalPutSpreadOpen`
- Dal `categories.groupedOtherStrategies`, filtrare in due array separati:
  - `putSpreads`: dove `strategyName` contiene "Put Spread" (non diagonal) OPPURE la configurazione wizard ha `strategy_type === 'put_spread'`
  - `diagonalPutSpreads`: dove `strategyName` contiene "Diagonal Put Spread" OPPURE configurazione con `strategy_type === 'diagonal_put_spread'`
  - `remainingOther`: tutto il resto
- Inserire due nuove sezioni collapsibili tra Leap Call e Protezioni (o tra Naked Put e Leap Call, seguendo l'ordine logico):
  - **Put Spread** — icona `ArrowDownUp` (o simile), colore teal/indigo
  - **Diagonal Put Spread** — stessa icona con variante colore
- Entrambe usano lo stesso componente `GroupedOtherStrategyRow` già esistente
- Aggiornare il conteggio badge di "Altre Strategie" per usare `remainingOther.length`
- Aggiungere i nomi dei sottostanti di put spread / diagonal put spread alla raccolta `underlyingNames` per il fetch prezzi

### Ordine sezioni finale
1. Covered Call
2. De-Risking Covered Call
3. Iron Condor
4. Double Diagonal
5. Naked Put
6. Put Spread ← NUOVO
7. Diagonal Put Spread ← NUOVO
8. Leap Call
9. Protezioni
10. Altre Strategie (solo quelle residue)

