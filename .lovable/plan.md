

## Benchmark visibile solo all'admin

### Obiettivo
La linea del benchmark, la sua legenda, il toggle "Currency Adjusted" e il pulsante di refresh devono essere visibili **solo** all'utente admin, anche quando sta impersonando un altro utente.

### Modifiche

#### 1. `src/components/dashboard/charts/PerformanceEvolutionChart.tsx`

- Importare `useAuth` da `@/contexts/AuthContext`
- Usare `const { isAdmin } = useAuth()` nel componente principale
- Passare `isAdmin` a `CustomLegend` come nuova prop
- In `CustomLegend`: nascondere la legenda "Benchmark" (linea arancione + tooltip + warning + refresh) e il toggle "Currency" quando `isAdmin` e' `false`
- Nel render del grafico principale: renderizzare la `<Line>` del benchmark **solo** se `isAdmin && hasBenchmarkData`
- Nel tooltip custom: mostrare la sezione breakdown benchmark **solo** se `isAdmin`

#### 2. Ottimizzazione: skip fetch dati benchmark per non-admin

- Condizionare il calcolo dell'equity exposure e USD exposure (hooks `useEquityExposurePct` e `useCurrencyExposure`) e il fetch dei benchmark prices (`useBenchmarkData`) in modo che vengano eseguiti **solo** se `isAdmin` e' `true`
- Questo evita query inutili al DB per gli utenti normali

### File modificati

| File | Modifica |
|------|----------|
| `src/components/dashboard/charts/PerformanceEvolutionChart.tsx` | Aggiunta `useAuth`, condizionamento rendering benchmark (legenda, linea, tooltip, currency toggle) e skip hooks per non-admin |

### Comportamento atteso

- **Admin** (anche impersonando): vede benchmark, legenda, toggle currency, tooltip dettagliato
- **Utente normale**: vede solo la linea del portafoglio, la legenda "Portafoglio" e il selettore temporale (1A/2A/3A/MAX)

