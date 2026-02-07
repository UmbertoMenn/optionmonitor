
# Piano: Modifica Benchmark a SPY + QQQ

## Situazione Attuale

| Componente | Ticker Attuali |
|------------|----------------|
| Equity | URTH, SPY, ACWI, EXSA.DE (media) |
| Bond | AGG |
| Cambio | EURUSD=X |

## Nuova Configurazione

| Componente | Ticker Nuovi |
|------------|--------------|
| Equity | **SPY, QQQ** (media) |
| Bond | AGG (invariato) |
| Cambio | EURUSD=X (invariato) |

---

## File da Modificare

### 1. Frontend: `src/hooks/useBenchmarkData.ts`

Modifica le costanti dei ticker:

```typescript
// PRIMA
const EQUITY_BENCHMARKS = ['URTH', 'SPY', 'ACWI', 'EXSA.DE'] as const;

// DOPO
const EQUITY_BENCHMARKS = ['SPY', 'QQQ'] as const;
```

Nessun'altra modifica necessaria - la logica calcola già la media dei benchmark equity disponibili.

### 2. Backend: `supabase/functions/update-benchmark-prices/index.ts`

Modifica la lista dei ticker da scaricare:

```typescript
// PRIMA
const BENCHMARK_TICKERS = [
  "URTH",    // MSCI World ETF
  "SPY",     // S&P 500
  "ACWI",    // MSCI ACWI
  "EXSA.DE", // Stoxx Europe 600 (iShares)
  "AGG",     // iShares Core US Aggregate Bond
  "EURUSD=X", // EUR/USD exchange rate
];

// DOPO
const BENCHMARK_TICKERS = [
  "SPY",     // S&P 500
  "QQQ",     // Nasdaq-100
  "AGG",     // iShares Core US Aggregate Bond
  "EURUSD=X", // EUR/USD exchange rate
];
```

---

## Azioni Post-Implementazione

1. **Deploy edge function** - Automatico
2. **Backfill QQQ** - Necessario chiamare l'edge function con `backfill: true` per scaricare lo storico di QQQ (che non esiste ancora nel database)
3. **I vecchi ticker** (URTH, ACWI, EXSA.DE) rimarranno nel database ma non verranno più usati nei calcoli

---

## Impatto

| Aspetto | Descrizione |
|---------|-------------|
| **Composizione** | Il benchmark equity sarà ora la media di S&P 500 e Nasdaq-100 |
| **Carattere** | Più orientato al mercato USA e tech rispetto al paniere precedente (che era globale) |
| **Storico** | Necessario backfill per QQQ; gli snapshot storici useranno i nuovi ticker |

---

## Note

- Il benchmark bond (AGG) e il cambio EUR/USD rimangono invariati
- La logica di ponderazione dinamica (equity exposure storica) funziona già correttamente
- La correzione valutaria (Currency Adjusted) continua a funzionare
