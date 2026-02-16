

## Estensione Calcolatrice + OptionStrat + P/L a Double Diagonal e Altre Strategie

### Panoramica

Portare la stessa logica gia' implementata per gli Iron Condor (calcolatrice premi con ordini Excel, link OptionStrat storico, P/L che include operazioni chiuse) anche a **Double Diagonal** e **Altre Strategie (Grouped)**.

### Modifiche necessarie

---

### 1. `CallPremiumCalculatorDialog.tsx` — Supporto nuovi strategy type

Il tipo `CalculatorStrategyType` passa da `'covered_call' | 'iron_condor'` a includere anche `'double_diagonal' | 'other_strategy'`.

- Aggiungere `'double_diagonal' | 'other_strategy'` al tipo
- Double Diagonal e Other Strategy usano la stessa logica di Iron Condor per il filtro ordini (`filterAndCalculateIronCondorPremiums` — filtra tutti gli ordini eseguiti per ticker, CALL+PUT)
- Il dialog per DD e OS mostra "Gain Potenziale" come per IC (non "Netto Unitario")
- In pratica, basta ampliare il check `isIronCondor` a un check piu' generico `isMultiLeg` che si attiva per `iron_condor`, `double_diagonal` e `other_strategy`

---

### 2. `DoubleDiagonalRow` — Aggiungere calcolatrice, link storico, P/L da ordini

Modifiche al componente `DoubleDiagonalRow` in `Derivatives.tsx`:

- **Props**: aggiungere `getPremiumByTickerAndSymbol` (come gia' fatto per `IronCondorRow`)
- **Option Symbol**: generare come `DD_{soldExpiryDate}` (analogo a `IC_{expiryDate}`)
- **Link OptionStrat**: se ci sono ordini salvati, usare `buildOptionStratUrlFromOrders(savedPremium.orders_json, ticker, 'Double Diagonal')`, altrimenti il link attuale da posizioni
- **Pulsante Calcolatrice**: aggiungere il bottone Calculator accanto al pulsante OptionStrat (stessa UI dell'Iron Condor, colonna allargata a 4rem)
- **P/L sulla riga**: se ci sono ordini salvati nella calcolatrice, il P/L deve sommare:
  - Il P/L delle posizioni ancora aperte in portafoglio (come ora)
  - Il guadagno/perdita realizzato dalle operazioni chiuse (ordini nell'orders_json che hanno un match FIFO completo)
  
  Per calcolare il P/L realizzato dagli ordini storici: `savedPremium.net_per_share` rappresenta il GP totale (somma netta di tutte le operazioni). Il P/L combinato sara':
  - Valore attuale mark-to-market delle 4 gambe aperte: `(current_price * qty * 100)` per ogni gamba
  - Piu' il GP salvato dalla calcolatrice (che include i premi incassati/pagati storici)

  Formula semplificata: **P/L = GP calcolatrice + MtM posizioni aperte**

  Dove MtM posizioni aperte = somma di `(current_price - avg_cost) * quantity * 100` per ogni gamba.

  In pratica: P/L portfolio attuale + GP calcolatrice.

- **Grid layout**: allargare la colonna OptionStrat da 2rem a 4rem per ospitare i due pulsanti

---

### 3. `GroupedOtherStrategyRow` — Stesse modifiche

Modifiche al componente `GroupedOtherStrategyRow` in `Derivatives.tsx`:

- **Props**: aggiungere `getPremiumByTickerAndSymbol`
- **Option Symbol**: generare come `OS_{underlying}` (chiave univoca per strategia)
- **Link OptionStrat**: se ordini salvati, usare `buildOptionStratUrlFromOrders`, altrimenti link da posizioni attuali
- **Pulsante Calcolatrice**: aggiungere accanto al pulsante OptionStrat (allargare colonna da 2rem a 4rem)
- **P/L sulla riga**: stessa logica DD — P/L portfolio + GP calcolatrice
- **Breakeven**: ricalcolare includendo il P/L realizzato dagli ordini storici. Attualmente il breakeven usa solo le posizioni attuali e il loro `avg_cost`. Con la calcolatrice, il breakeven deve shiftare in base al guadagno/perdita gia' realizzato:
  - Il sistema attuale calcola il payoff basandosi su `avg_cost` come premio pagato/incassato
  - Con ordini storici, il "premio effettivo netto" per ogni gamba cambia. Il modo piu' semplice: aggiungere il GP realizzato (dalla calcolatrice) come offset al payoff totale. Questo shifta le curve di breakeven correttamente
  - Il calcolo diventa: `payoff_originale + GP_calcolatrice` per ogni punto del grafico

---

### 4. Chiamate dalle sezioni padre

Nelle sezioni che rendono `DoubleDiagonalRow` e `GroupedOtherStrategyRow` (linee ~530-653), passare la prop `getPremiumByTickerAndSymbol` (gia' disponibile dal hook `useCoveredCallPremiums`).

---

### Dettaglio tecnico dei file modificati

| File | Modifica |
|---|---|
| `src/components/derivatives/CallPremiumCalculatorDialog.tsx` | Tipo `CalculatorStrategyType` esteso; logica `isMultiLeg` per DD/OS |
| `src/pages/Derivatives.tsx` (DoubleDiagonalRow) | Props + calcolatrice + link storico + P/L combinato + grid layout |
| `src/pages/Derivatives.tsx` (GroupedOtherStrategyRow) | Props + calcolatrice + link storico + P/L combinato + breakeven con offset + grid layout |
| `src/pages/Derivatives.tsx` (sezioni padre) | Passare `getPremiumByTickerAndSymbol` a DD e OS rows |

### Nessuna modifica a

- `optionStratUrl.ts` — `buildOptionStratUrlFromOrders` gia' supporta qualsiasi strategy name tramite `STRATEGY_SLUG_MAP`
- `orderFileParser.ts` — `filterAndCalculateIronCondorPremiums` gia' filtra per ticker senza distinzione CALL/PUT, perfetto anche per DD e OS
- Database/tabelle — `covered_call_premiums` gia' supporta qualsiasi `option_symbol` come chiave

