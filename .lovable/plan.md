

## Visualizzazione Waterfall del Netting con Breakdown per Categoria e Ticker

### Cosa cambia
Il grafico a barre nelle viste Netting della dashboard verra' sostituito con un **grafico waterfall** che mostra come ogni componente del netting contribuisce (positivamente o negativamente) al valore finale del portafoglio. In fondo, le singole posizioni piu' costose saranno elencate come dettaglio espandibile.

### Struttura del Waterfall

Per ogni vista, le barre del waterfall saranno diverse:

**Netting Totale:**
- Valore Assets (grigio, base)
- Covered Call ITM (rosso, costo intrinseco)
- Covered Call OTM (rosso, costo riacquisto)
- Naked Put ITM (rosso, costo riacquisto)
- Naked Put OTM (rosso, costo riacquisto)
- Protezioni / Long Put (verde, valore di vendita)
- Leap Call (verde, valore di vendita)
- Altre Strategie (rosso/verde, netto)
- **Totale Nettato** (blu, barra finale)

**Netting ex. CC:** come sopra, ma CC OTM escluse e CC ITM valorizzate a intrinseco.

**Netting ex. CC e NP OTM:** come sopra, ma CC OTM e NP OTM escluse; NP ITM valorizzate a intrinseco.

Le barre con valore zero non verranno mostrate.

### Top Costose
Sotto il waterfall, un elenco compatto (massimo 5 righe) mostra le singole posizioni derivative piu' costose da chiudere, ordinate per impatto assoluto decrescente. Ogni riga mostra: ticker, tipo (CC/NP/LP/LC/Altro), strike, scadenza, e costo di chiusura in EUR.

### Dettaglio Tecnico

**File: `src/hooks/useDerivativeNetting.ts`**

1. Estendere `NettingResult` con un nuovo campo `breakdown`:
```typescript
export interface NettingBreakdownItem {
  category: string;        // es. "Covered Call ITM", "Naked Put OTM"
  label: string;           // Label per il grafico
  value: number;           // Valore netto (negativo = costo, positivo = guadagno)
  color: string;           // Colore della barra
  details: {               // Dettaglio per ticker
    ticker: string;
    description: string;
    value: number;
    strike?: number;
    expiry?: string;
  }[];
}

export interface NettingResult {
  nettingExCoveredCall: number;
  nettingTotal: number;
  nettingExCCAndNP: number;
  breakdown: NettingBreakdownItem[];  // NUOVO
}
```

2. Durante il loop sui derivati, accumulare i valori per categoria e per singola posizione, costruendo l'array `breakdown` con i dettagli per ticker.

3. Aggiungere una funzione `getBreakdownForViewMode(breakdown, viewMode)` che filtra le categorie in base alla vista selezionata (es. per `netting_ex_cc` esclude CC OTM).

**File: `src/components/dashboard/DynamicPortfolioChart.tsx`**

4. Sostituire il componente `NettingChart` con un nuovo `NettingWaterfallChart` che:
   - Riceve `baseValue`, `breakdown` filtrato per vista, e `finalValue`
   - Usa un `BarChart` verticale di Recharts con barre colorate per categoria
   - Ogni barra parte dal punto dove finisce la precedente (waterfall)
   - La barra base (Assets) e quella finale (Totale) sono a colori distinti
   - Le barre negative (costi) sono in rosso/arancione, le positive in verde
   - Tooltip ricco che mostra il dettaglio per ticker al passaggio del mouse

5. Sotto il waterfall, aggiungere una sezione "Top posizioni piu' costose" con un elenco compatto delle prime 5 posizioni ordinate per `|value|` decrescente, con ticker, tipo, strike e importo formattato.

6. Le props di `DynamicPortfolioChart` saranno estese per ricevere il `breakdown` (gia' parte di `NettingResult`).

### Aspetto Visivo

Il waterfall partira' dalla barra grigia "Assets" in alto e scendera' con barre rosse (costi di chiusura) e verdi (ricavi di vendita), per terminare con una barra blu "Valore Nettato" in basso. Compatto, leggibile e immediatamente chiaro su cosa costa di piu'.

