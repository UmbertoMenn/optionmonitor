

## Caricamento CSV + Curva IV Interattiva

### Cosa cambia

Attualmente il simulatore scarica i prezzi da Massive.com API e tenta di scaricare la catena opzioni (che richiede piano a pagamento). Il nuovo approccio:

1. **L'admin carica un file CSV** con i prezzi storici del sottostante (orari, 4h, daily -- qualsiasi timeframe)
2. **L'admin disegna la curva IV** con un editor interattivo (grafico cliccabile/trascinabile)
3. **I prezzi delle opzioni vengono calcolati con Black-Scholes** solo quando servono (nel motore di backtest e nel StrategyBuilder), usando la IV dalla curva manuale

I prezzi delle opzioni non vengono mai scaricati ne pre-calcolati: il motore li calcola on-the-fly giorno per giorno.

---

### File modificati

| File | Azione |
|------|--------|
| `src/components/simulator/TickerSelector.tsx` | **Riscritto**: diventa un uploader CSV con react-dropzone. Parsa il file, estrae colonne data+close, mostra anteprima. Nessuna chiamata API |
| `src/components/simulator/IVSurfaceChart.tsx` | **Riscritto** e rinominato in `IVCurveEditor.tsx`: editor interattivo dove l'admin clicca sul grafico per aggiungere punti IV e li trascina verticalmente |
| `src/lib/ivSurface.ts` | **Aggiunta** funzione `buildManualIVSurface(ivPoints, riskFreeRate)` che crea un `IVSurface` dalla curva manuale (IV flat per strike, interpolata nel tempo) |
| `src/pages/Simulator.tsx` | **Aggiornato**: integra il nuovo flusso (CSV upload -> curva IV -> strategia -> backtest). Risk-free rate editabile. Stato `ivPoints` gestito qui |
| `src/lib/massiveApi.ts` | **Rimosso** `fetchOptionChain`, `fetchOptionContracts`, `fetchOptionBars` (non usati) |
| `supabase/functions/massive-proxy/index.ts` | **Rimossi** handler per `option-chain`, `option-contracts`, `option-bars` |

---

### Dettaglio tecnico

#### 1. TickerSelector (CSV Uploader)

Accetta file `.csv` o `.txt`. Formato atteso (auto-detect delle colonne):
- Cerca colonne con nomi tipo `date`, `time`, `datetime`, `close`, `price`, `last`
- Supporta separatori `,` e `;` e tab
- Se trova colonne `date` + `time` separate, le combina
- Se il timeframe e intraday (orario, 4h), aggrega a daily prendendo l'ultimo close di ogni giorno
- L'admin inserisce il ticker manualmente (campo testo)

Output: `{ ticker: string, priceData: { date: string, close: number }[] }`

L'interfaccia mostra:
- Area drag-and-drop (react-dropzone, pattern gia usato nel progetto)
- Campo ticker
- Dopo il parsing: numero di righe, date range, preview mini-grafico
- Nessun campo date picker (le date vengono dal CSV)

#### 2. IVCurveEditor (nuovo componente)

Grafico Recharts `ComposedChart`:
- **Area** semitrasparente: prezzo sottostante (asse Y destro) per contesto
- **Line + Scatter**: curva IV (asse Y sinistro, in %)
- I punti dello Scatter sono trascinabili verticalmente (drag con mouse)
- Click su area vuota del grafico: aggiunge un nuovo punto IV
- Inizializzazione: 2 punti (prima e ultima data) al 30%

Toolbar sopra il grafico:
- Input numerico per IV del punto selezionato
- Pulsante "IV Piatta" (imposta tutti i punti allo stesso valore)
- Pulsante "Elimina punto" per il punto selezionato
- Pulsante "Reset" (torna a 2 punti al 30%)
- Input risk-free rate (default 4.5%)

Output: `ivPoints: { date: string, iv: number }[]` + `riskFreeRate: number`

#### 3. buildManualIVSurface

```text
function buildManualIVSurface(
  ivPoints: { date: string; iv: number }[],
  riskFreeRate: number
): IVSurface

- getIV(strike, expiry, type):
  - Ignora strike e type (IV uniforme per tutti gli strike)
  - Interpola linearmente tra i punti della curva usando la data
  - Prima del primo punto: usa il primo valore
  - Dopo l'ultimo punto: usa l'ultimo valore
```

Questa funzione mantiene l'interfaccia `IVSurface` identica, quindi `StrategyBuilder`, `backtestEngine` e le azioni di aggiustamento continuano a funzionare senza modifiche.

#### 4. Flusso aggiornato in Simulator.tsx

```text
1. Admin carica CSV -> TickerSelector emette { ticker, priceData }
2. Appare IVCurveEditor con il grafico dei prezzi
3. Admin disegna la curva IV trascinando i punti
4. Admin imposta risk-free rate
5. IVSurface viene costruita con buildManualIVSurface()
6. StrategyBuilder usa questa IVSurface per calcolare i prezzi BS delle gambe
7. Il motore di backtest usa la stessa IVSurface giorno per giorno
```

#### 5. Cosa resta invariato

- `blackScholes.ts` -- pricing engine, Greeks
- `backtestEngine.ts` -- motore backtest (usa `ivSurface.getIV()`, compatibile)
- `StrategyBuilder.tsx` -- costruzione strategia (usa `ivSurface.getIV()`, compatibile)
- `AdjustmentRuleEditor.tsx` -- editor regole
- `BacktestChart.tsx`, `GreeksChart.tsx`, `BacktestResults.tsx` -- visualizzazione risultati
- `adjustmentRules.ts` -- logica regole

