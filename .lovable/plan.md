

# Analisi Benchmark: Verifica Dati e Calcoli

## Riepilogo dell'Analisi

Ho verificato in dettaglio i dati nel database e i calcoli del benchmark. Ecco i numeri reali:

### 1. Dati Prezzi Benchmark (dal database)

| Data | SPY | QQQ | AGG | EURUSD |
|------|-----|-----|-----|--------|
| 31/12/24 (base) | 579.28 | 508.65 | 92.88 | 1.0406 |
| 31/12/25 | 681.92 | 614.31 | 99.56 | 1.1747 |
| 30/01/26 | 691.97 | 621.87 | 99.81 | 1.1966 |
| 06/02/26 | 690.62 | 609.65 | 100.13 | 1.1820 |

**Nota**: Il benchmark usa i dati del 06/02 per lo snapshot del 07/02 (closest price).

### 2. Calcoli del Benchmark

#### Rendimento Equity (media SPY+QQQ) dal 31/12/2024:

| Data | SPY Return | QQQ Return | Media Equity |
|------|------------|------------|--------------|
| 31/12/25 | +17.72% | +20.78% | +19.25% |
| 30/01/26 | +19.46% | +22.26% | +20.86% |
| 07/02/26 | +19.22% | +19.85% | +19.54% |

#### Rendimento Benchmark Pesato (con equity ~49%, bond ~51%):

| Data | Scaled USD | EURUSD Var | Currency Adj | **Benchmark EUR** |
|------|------------|------------|--------------|-------------------|
| 31/12/25 | +13.07% | +12.88% | -5.64% | **+7.43%** |
| 30/01/26 | +14.11% | +14.99% | -6.57% | **+7.54%** |
| 07/02/26 | +13.58% | +13.58% | -5.95% | **+7.63%** |

### 3. Spiegazione del Benchmark "Piatto"

**Il benchmark appare piatto tra 31/12/25 e 07/02/26 perché:**

```text
Dal 30/01 al 07/02:
├─ Mercati USA: -0.53% (QQQ -2%, SPY -0.2%)
├─ EURUSD: -1.22% (dollaro si è APPREZZATO)
└─ Effetto netto in EUR: +0.09% (quasi zero)
```

**La matematica è corretta**: il calo dei mercati equity (~0.5%) è stato compensato dall'apprezzamento del dollaro (~1.2%), risultando in un rendimento quasi piatto in termini EUR.

### 4. Possibili Cause di Confusione

1. **Currency Adjustment attivo per default**: Se l'utente si aspetta di vedere il rendimento in USD, il benchmark sembra piatto mentre in realtà i mercati sono scesi.

2. **Il toggle "Currency" è attivo**: Verificare se l'utente vuole vedere il benchmark senza currency adjustment.

---

## Proposta di Miglioramento

Per rendere più chiaro il comportamento del benchmark, propongo di aggiungere **logging nel tooltip** che mostri i componenti del calcolo:

### Modifica al Tooltip del Grafico

Quando l'utente passa il mouse su un punto benchmark, mostrare:
```
Benchmark (Adj.): +7.54%
├─ Equity (USD): +20.86%
├─ Bond (USD): +7.46%
├─ Peso Equity: 49.2%
├─ Rendimento USD: +14.11%
├─ Variazione EUR/USD: +14.99%
└─ Rendimento EUR: +7.54%
```

### File da Modificare

| File | Modifica |
|------|----------|
| `src/hooks/useBenchmarkData.ts` | Esporre `equityReturn`, `bondReturn`, `eurusdVariation` nell'output |
| `src/components/dashboard/charts/PerformanceEvolutionChart.tsx` | Mostrare dettagli nel tooltip |

---

## Conclusione

**Non c'è un bug nel calcolo del benchmark.** I numeri sono matematicamente corretti:
- Il benchmark pesato (49% equity, 51% bond) ha reso +7.5% in EUR dal 31/12/24
- La compensazione tra calo equity e apprezzamento USD spiega il movimento piatto recente

Se desideri procedere con l'implementazione del tooltip dettagliato per rendere più trasparenti i calcoli, posso farlo dopo la tua approvazione.

