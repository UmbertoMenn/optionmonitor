

## Ottimizzazione Backtest AAPL con Grid Search + Gemini 2.5 Pro

### Parametri fissi (come richiesto)
- **IV**: 30% (hardcoded)
- **Strike step**: $5
- **Risk-free rate**: 4.5%

### Parametri da ottimizzare (griglia)
| Parametro | Valori | Note |
|-----------|--------|------|
| `callDistancePct` | 3, 5, 7, 10, 12, 15 | Distanza % dello strike dalla entry |
| `profitPct` | 30, 40, 50, 60, 70 | Soglia di profit-taking |
| `approachRule.activationPct` | 1, 2, 3, 5 | Quando scatta il roll-up difensivo |
| `approachRule.rollUpMinDistancePct` | 3, 5, 7 | Distanza minima del nuovo strike |
| `profitRule.action` | dynamic, static | Tipo di rolling |
| `dynamicAnnualizedPremiumPct` | 5, 10, 15 | Soglia premio annualizzato (solo dynamic) |

Totale combinazioni: ~720

### Fasi di esecuzione

**Fase 1 — Script Node.js (`/tmp/grid_search.mjs`)**
1. Legge il CSV AAPL caricato, aggrega le barre orarie in giornaliere (close = ultimo close del giorno)
2. Per ogni combinazione di parametri:
   - Costruisce legs iniziali (100 stock + 1 sold call) con `buildStaticIVSurface(0.30, 0.045)`
   - Esegue `runBacktest()` importando direttamente il codice del progetto
   - Salva: Sharpe ratio, P&L%, max drawdown, net premiums, trade count
3. Ordina per Sharpe ratio e salva i top 50 in JSON

**Fase 2 — Chiamata Gemini 2.5 Pro**
1. Invia i top 50 risultati a Gemini con prompt che chiede:
   - Quale configurazione offre il miglior rapporto rischio/rendimento
   - Trade-off tra le top 5 strategie
   - Parametri esatti consigliati

**Output**: Report Markdown in `/mnt/documents/aapl_backtest_optimization.md` con tabella risultati e analisi AI.

### Dettagli tecnici
- Lo script usa `tsx` per importare direttamente i moduli TypeScript del progetto (`backtestEngine.ts`, `blackScholes.ts`, `ivSurface.ts`, `adjustmentRules.ts`)
- La chiamata AI usa il gateway Lovable (`https://ai.gateway.lovable.dev/v1/chat/completions`) con `LOVABLE_API_KEY`
- Nessuna modifica al codice dell'app
- Tempo stimato: ~2-4 minuti

