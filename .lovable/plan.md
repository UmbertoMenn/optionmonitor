
# Piano: Fix Layout Card e Tooltip Istogramma

## Problemi Identificati

1. **Layout errato**: Entrambe le card occupano 1 colonna ciascuna, quindi la card carousel è troppo piccola
2. **Tooltip illeggibile**: Il `contentStyle.color` in Recharts non si applica ai valori formattati (label e value)

---

## Modifiche

### File: `src/components/dashboard/HistoricalChartsCarousel.tsx`

**Aggiungere `lg:col-span-2`** alla prima card (carousel) per farla occupare 2/3 dello spazio:

```tsx
// Linea 99 - Card Carousel
<Card className="lg:col-span-2 border-border bg-card">
```

La card istogramma resta senza `col-span` (occupa 1 colonna automaticamente).

---

### File: `src/components/dashboard/charts/YearlyReturnChart.tsx`

Il problema del tooltip è che Recharts usa stili separati per:
- `contentStyle` → container del tooltip
- `labelStyle` → stile della label (es. "Anno 2024")
- `itemStyle` → stile dei valori (es. "12.5%")

**Sostituire il Tooltip con questa configurazione completa**:

```tsx
<Tooltip
  contentStyle={{
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    fontSize: '12px',
  }}
  labelStyle={{
    color: 'hsl(var(--foreground))',
    fontWeight: 500,
  }}
  itemStyle={{
    color: 'hsl(var(--foreground))',
  }}
  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Rendimento']}
  labelFormatter={(label) => `Anno ${label}`}
/>
```

---

## Riepilogo Modifiche

| File | Modifica |
|------|----------|
| `HistoricalChartsCarousel.tsx` | Aggiungere `lg:col-span-2` alla card carousel (linea 99) |
| `YearlyReturnChart.tsx` | Aggiungere `labelStyle` e `itemStyle` al Tooltip (linee 148-158) |

---

## Risultato Atteso

1. La card carousel occupa 2/3 della larghezza (come prima)
2. La card istogramma occupa 1/3 alla destra
3. Il tooltip dell'istogramma mostra il testo in bianco, leggibile sul tema scuro
