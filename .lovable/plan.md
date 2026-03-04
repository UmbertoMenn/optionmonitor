
Capito, hai ragione: dalla diff e dallo screenshot il comportamento è regressivo.

## Cosa è andato storto

Il problema principale è che i pallini (`Scatter`) stanno usando un dataset filtrato (`scatterData`) separato dalla linea (`chartData`) dentro un `ComposedChart` con asse X categoriale.  
Questo può desincronizzare la posizione dei punti rispetto alla timeline completa (quindi grafico “sballato”) e rende anche il tooltip poco affidabile.

In più, l’hit-area usa `fill="transparent"`: in SVG spesso non intercetta bene il puntatore, quindi l’hover resta difficile.

## Fix che implementerò

### 1) Riallineamento totale punti-linea
In `BacktestChart.tsx` farò usare allo `Scatter` **lo stesso dataset della linea** (quello del `ComposedChart`), eliminando `scatterData` come fonte separata.

### 2) Mostrare pallino solo dove c’è operazione
Nel `CustomScatterDot` userò `payload.adjustmentDesc`:
- se non c’è operazione → `return null`
- se c’è operazione → pallino arancione visibile

Così i pallini restano perfettamente allineati alla curva del prezzo.

### 3) Tooltip molto più facile da attivare
Allargerò davvero l’area di aggancio hover:
- cerchio invisibile grande (`r ~ 20-22`)
- `fill="rgba(249,115,22,0.001)"` (non `transparent`)
- `pointerEvents="all"`

Questo rende il trigger “magnetico” anche quando sei vicino al pallino.

### 4) Tooltip robusto sul punto giusto
Nel `CustomTooltip` selezionerò, quando presente, il payload con `adjustmentDesc` (priorità al punto operazione), invece di usare sempre il primo elemento del payload.

## Modifiche file (solo uno)

- `src/components/simulator/BacktestChart.tsx`
  - rimozione logica `scatterData` separata
  - update `CustomScatterDot` (filtro + hit-area reale)
  - update `Scatter` per usare data comune del chart
  - update `CustomTooltip` per scegliere il payload corretto

## Verifica finale (E2E)

1. Eseguire backtest su `/simulator`.
2. Controllare che i pallini arancioni stiano sulla linea prezzo (non “sparsi” altrove).
3. Passare il mouse vicino (non sopra preciso): tooltip deve aprirsi con facilità.
4. Verificare che nel tooltip compaiano data, prezzo e descrizione operazione corretta.
