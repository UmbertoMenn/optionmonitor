

## Istogramma verticale e valore totale derivati

### Modifiche

1. **Istogramma da orizzontale a verticale**: il `NettingBreakdownChart` passa da `layout="vertical"` (barre orizzontali) al layout standard (barre verticali). Le etichette delle categorie saranno sull'asse X (in basso), i valori sull'asse Y (a sinistra).

2. **Valore BLU = somma delle voci**: il valore evidenziato in blu sotto il grafico mostrera' la somma algebrica di tutte le voci del breakdown (il costo complessivo chiusura derivati), calcolato come `barData.reduce((sum, d) => sum + d.value, 0)`, invece del `finalValue` (che e' il valore nettato del portafoglio).

### Dettaglio tecnico

**File: `src/components/dashboard/DynamicPortfolioChart.tsx`**, componente `NettingBreakdownChart` (righe 86-175)

- Rimuovere `layout="vertical"` dal `BarChart`
- **XAxis**: tipo `category`, `dataKey="name"`, etichette ruotate a -35 gradi per leggibilita', fontSize 9
- **YAxis**: tipo `number`, formattazione abbreviata (k/M), nascondere axis line e tick line
- **Bar**: `radius={[4, 4, 0, 0]}` (arrotondamento in alto invece che a destra)
- Altezza fissa del grafico: 220px
- Margini: bottom aumentato a 60px per le etichette ruotate
- **Valore blu**: calcolare `const totalDerivatives = barData.reduce((s, d) => s + d.value, 0)` e mostrare quello al posto di `finalValue`
- Il prop `finalValue` puo' essere rimosso dal componente (non piu' usato)

