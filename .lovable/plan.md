

# Piano: Ordinamento e Semplificazione Legenda Composizione Portafoglio

## Obiettivo
1. Ordinare il grafico a ciambella e la legenda per importo in ordine decrescente
2. Rimuovere i valori di profitto/perdita dalla legenda, mantenendo solo la percentuale

---

## Modifiche Tecniche

### File 1: `src/components/dashboard/PortfolioDonutChart.tsx`

#### Ordinare i dati per valore decrescente

```typescript
// Da (linea 11-16):
const data = summary.byAssetType.map(item => ({
  name: ASSET_TYPE_LABELS[item.type],
  value: item.value,
  percentage: item.percentage,
  color: ASSET_TYPE_COLORS[item.type],
}));

// A:
const data = [...summary.byAssetType]
  .sort((a, b) => b.value - a.value)
  .map(item => ({
    name: ASSET_TYPE_LABELS[item.type],
    value: item.value,
    percentage: item.percentage,
    color: ASSET_TYPE_COLORS[item.type],
  }));
```

---

### File 2: `src/components/dashboard/AssetAllocationLegend.tsx`

#### 1. Ordinare la lista per valore decrescente

```typescript
// Da (linea 11):
{summary.byAssetType.map((item) => (

// A:
{[...summary.byAssetType].sort((a, b) => b.value - a.value).map((item) => (
```

#### 2. Rimuovere il profitto/perdita dalla legenda

```typescript
// Da (linee 25-31):
<div className="flex items-center gap-2 text-xs text-muted-foreground">
  <span>{item.percentage.toFixed(1)}%</span>
  {item.profitLoss !== 0 && (
    <span className={item.profitLoss >= 0 ? 'text-profit' : 'text-loss'}>
      {formatProfitLoss(item.profitLoss)}
    </span>
  )}
</div>

// A:
<span className="text-xs text-muted-foreground">
  {item.percentage.toFixed(1)}%
</span>
```

#### 3. Rimuovere l'import non più necessario

```typescript
// Da (linea 2):
import { formatCurrency, formatProfitLoss } from '@/lib/formatters';

// A:
import { formatCurrency } from '@/lib/formatters';
```

---

## Riepilogo Modifiche

| File | Modifica |
|------|----------|
| `PortfolioDonutChart.tsx` | Ordinamento dati per valore decrescente |
| `AssetAllocationLegend.tsx` | Ordinamento lista per valore decrescente |
| `AssetAllocationLegend.tsx` | Rimozione profitto/perdita, solo percentuale |
| `AssetAllocationLegend.tsx` | Rimozione import `formatProfitLoss` |

---

## File Modificati

- `src/components/dashboard/PortfolioDonutChart.tsx`
- `src/components/dashboard/AssetAllocationLegend.tsx`

