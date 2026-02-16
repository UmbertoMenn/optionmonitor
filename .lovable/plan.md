

## Ripristinare la descrizione sotto il grafico a due barre

### Problema
La descrizione testuale e' stata rimossa da entrambe le slide del carousel netting, ma andava eliminata solo dalla seconda slide (istogramma split netting). La prima slide (grafico con le due barre orizzontali "Valore Assets" vs "Valore Nettato") deve mantenere la descrizione che spiega la logica di calcolo della vista corrente.

### Modifiche

**File: `src/components/dashboard/DynamicPortfolioChart.tsx`**

1. Ripristinare l'oggetto `descriptions` con le descrizioni per ciascuna vista netting:
   - `netting_total`: spiega che il valore include tutti i derivati (prezzo mercato x quantita' x 100)
   - `netting_ex_cc_np`: spiega che per le CC e NP ITM viene sottratto il valore intrinseco, e le NP OTM sono escluse

2. Aggiungere il paragrafo descrittivo sotto il valore nel primo `CarouselItem` (slide delle due barre), subito dopo il `<p>` con `formatEUR(finalValue)`:
   ```
   {descriptions[viewMode] && (
     <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
       {descriptions[viewMode]}
     </p>
   )}
   ```

3. La seconda slide (`NettingBreakdownChart`) resta invariata, senza descrizione.

