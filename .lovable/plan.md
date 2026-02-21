

## Revisione Resoconto: Premi, Commissioni e Separazione P/L Sottostante vs Strategia

### Problemi attuali

1. La card riassuntiva mostra solo "Costo totale" generico degli aggiustamenti
2. La tabella Movimenti ha una colonna "Totale" duplicata (bug dal diff precedente)
3. Non c'e distinzione tra P/L del sottostante (buy & hold) e P/L della strategia covered call
4. Mancano i dettagli su premi incassati e commissioni

### Modifiche

#### 1. Engine: tracciare premi lordi, commissioni e P/L sottostante (`src/lib/backtestEngine.ts`)

Aggiungere a `BacktestResult`:
```text
totalGrossPremiums: number;    // somma premi venduti (lordi, senza commissioni)
totalCommissions: number;      // $10 per ogni trade (apertura e chiusura contano separatamente)
totalNetPremiums: number;      // lordi - commissioni
underlyingPL: number;          // P/L puro del sottostante (prezzo finale - prezzo iniziale) * qty
strategyPL: number;            // P/L totale strategia = underlyingPL + netPremiums
tradeCount: number;            // numero totale di trade per calcolo commissioni
```

Nel loop del motore:
- Contare ogni trade iniziale come 1 trade
- Contare ogni leg rimossa (chiusura) + ogni leg aggiunta (apertura) negli aggiustamenti come trade separati
- `totalCommissions = tradeCount * 10`
- `totalGrossPremiums`: somma dei premi delle call vendute (entryPrice * qty * 100, solo SELL di opzioni)
- `underlyingPL`: differenza tra prezzo finale e prezzo iniziale del sottostante * quantita stock
- `strategyPL`: valore totale finale - valore totale iniziale (gia calcolato come `finalPL`, ma ricalcolato includendo commissioni)

Aggiungere anche `stockPL` e `optionsPL` al `BacktestDayResult` per il grafico.

#### 2. Chart: due linee separate per P/L sottostante e P/L strategia (`src/components/simulator/BacktestChart.tsx`)

Aggiungere al `chartData`:
```text
{
  date, price,
  stockPL: number,      // P/L solo sottostante (buy & hold)
  strategyPL: number,   // P/L strategia completa
  adjustmentDesc
}
```

- Linea 1 (tratteggiata, grigia): `stockPL` - "P/L Sottostante"
- Area 2 (colorata, come ora): `strategyPL` - "P/L Strategia"
- Tooltip aggiornato per mostrare entrambi i valori

#### 3. Resoconto: sostituire "Costo totale" con dettaglio premi e commissioni (`src/components/simulator/BacktestResults.tsx`)

**Card riassuntiva** (sostituisce la card attuale riga 135-143):
```text
| Premi lordi incassati | Premio unitario medio | Commissioni | Premi netti |
| $1,234.00             | $2.45                 | $120 (12 op)| $1,114.00   |
```

**Stat cards**: aggiungere/sostituire:
- "P/L Sottostante" (guadagno/perdita puro del titolo)
- "P/L Strategia" (risultato complessivo inclusi premi netti)
- Mantenere Max Drawdown, Sharpe, Win Rate

**Tabella Movimenti**: 
- Rimuovere la colonna "Totale" duplicata (bug)
- Rinominare la colonna rimasta in "Importo"
- Aggiungere colonna "Commissione" ($10 per ogni riga)

#### 4. Dettaglio tecnico per file

| File | Modifica |
|------|----------|
| `src/lib/backtestEngine.ts` | Aggiungere `totalGrossPremiums`, `totalCommissions`, `totalNetPremiums`, `underlyingPL`, `strategyPL`, `tradeCount` a `BacktestResult`; aggiungere `stockPL` a `BacktestDayResult`; calcolare nel loop |
| `src/components/simulator/BacktestChart.tsx` | Due serie: `stockPL` (linea tratteggiata) e `strategyPL` (area colorata); tooltip aggiornato con entrambi |
| `src/components/simulator/BacktestResults.tsx` | Rimuovere colonna Totale duplicata; card premi con lordi/unitario/commissioni/netti; stat cards con P/L Sottostante e P/L Strategia; colonna Commissione in movimenti |

#### 5. Logica commissioni

- Commissione fissa: $10 per trade
- Ogni riga nella tabella Movimenti = 1 trade = $10
- Le commissioni vengono sottratte dal P/L della strategia
- Il P/L del sottostante NON include commissioni (e il puro buy & hold)

#### 6. Calcolo P/L nel motore

```text
underlyingPL = (prezzoFinale - prezzoIniziale) * quantitaStock
totalGrossPremiums = somma(premi vendita call * qty * 100) - somma(premi riacquisto * qty * 100)
totalCommissions = tradeCount * 10
totalNetPremiums = totalGrossPremiums - totalCommissions
strategyPL = underlyingPL + totalNetPremiums
```

