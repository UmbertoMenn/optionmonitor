
## Carousel Netting + Pie Chart con breakdown e aggregazione strategie

### Cosa cambia

1. **Carousel nella card netting**: la vista netting attuale (waterfall) viene sostituita con un carousel a 2 slide:
   - **Slide 1**: grafico a barre semplice con solo 2 barre orizzontali -- "Valore Assets" (grigio) e "Valore Nettato" (blu), come era prima del waterfall. Sotto, il valore finale formattato in grande e la descrizione testuale.
   - **Slide 2**: grafico a torta (PieChart/Donut) che mostra la composizione del netting: ogni categoria (CC ITM, CC OTM, NP ITM, NP OTM, Protezioni, Leap Call, Altre Strategie) come fetta con colori distinti, con legenda e tooltip. Il centro della torta mostra il valore nettato finale.

2. **Top posizioni piu' costose**: rimane visibile sotto il carousel (su entrambe le slide).

3. **"Altre Strategie" include Iron Condor e Double Diagonal**: nel breakdown, i costi di chiusura di Iron Condor e Double Diagonal confluiscono nella voce "Altre Strategie" della torta.

4. **Aggregazione per sottostante**: quando una strategia ha piu' gambe (es. Iron Condor su KLA Corp), nel dettaglio viene mostrata una sola riga con il costo di chiusura complessivo (somma algebrica di tutte le gambe), non le singole gambe separate.

### Dettaglio tecnico

**File: `src/hooks/useDerivativeNetting.ts`**

- Nella sezione `else` (riga 160-166), dove si accumulano le posizioni multi-leg in `acc.other`, cambiare la logica di `details`:
  - Invece di aggiungere un detail per ogni singola gamba, aggregare per ticker (sottostante). Se esiste gia' un detail con lo stesso ticker, sommare il valore.
  - Rimuovere strike e expiry dal detail aggregato (non hanno senso per strategie multi-leg con strike diversi).

- Dopo il loop, aggiungere esplicitamente Iron Condor e Double Diagonal ad `acc.other`:
  - Per ogni Iron Condor, calcolare il costo complessivo di chiusura (somma dei nettingValue delle 4 gambe) e aggiungere un solo detail con il ticker del sottostante.
  - Stessa cosa per ogni Double Diagonal.
  - Evitare doppio conteggio: le gambe di IC/DD sono gia' nel `multiLegSet`, quindi entrano nel branch `else`. La logica attuale li tratta gia' come "other". Il fix e' solo nell'aggregazione dei details: dopo aver costruito `acc.other.details`, raggrupparli per ticker sommando i valori.

In pratica, aggiungere dopo riga 166 una fase di post-processing:
```typescript
// Aggregate other details by ticker
const otherByTicker = new Map<string, NettingBreakdownDetail>();
for (const d of acc.other.details) {
  const key = d.ticker;
  const existing = otherByTicker.get(key);
  if (existing) {
    existing.value += d.value;
  } else {
    otherByTicker.set(key, { ...d, strike: undefined, expiry: undefined });
  }
}
acc.other.details = [...otherByTicker.values()];
```

Stessa aggregazione per la lista "Top posizioni piu' costose" nel `DynamicPortfolioChart`.

**File: `src/components/dashboard/DynamicPortfolioChart.tsx`**

Riscrivere la sezione netting del `renderChart`:

1. Rimuovere il componente `NettingWaterfallChart` e tutta la logica waterfall (buildWaterfallData, WaterfallBar, ecc.).

2. Aggiungere un carousel Embla con 2 slide:

   **Slide 1 -- Barre semplici**:
   - Un `BarChart` orizzontale con 2 barre: "Valore Assets" (baseValue, grigio) e "Valore Nettato" (finalValue, blu).
   - Sotto le barre, il valore finale in grande (`text-2xl font-bold text-blue-500`).

   **Slide 2 -- Pie Chart breakdown**:
   - Un `PieChart` (donut) con una fetta per ogni `breakdownItem` (filtrato per la vista corrente), piu' una fetta "Valore Nettato" che rappresenta il valore finale.
   - No: le fette rappresentano solo le componenti derivative (CC ITM, NP OTM, ecc.) e il loro impatto. Il totale nettato e' mostrato al centro.
   - Colori: rosso per costi, verde per guadagni, grigio/blu per basi/totali.
   - Tooltip al passaggio del mouse con nome categoria, valore e percentuale sul totale netting.
   - Legenda compatta sotto la torta.

3. Navigazione carousel: dot indicators + frecce, stesso pattern di `HistoricalChartsCarousel`.

4. `TopCostlyPositions` rimane sotto il carousel, invariato.

5. Descrizione testuale rimane in fondo.

**Import necessari**: aggiungere `PieChart, Pie, Cell` da recharts, e i componenti Carousel da `@/components/ui/carousel`.
