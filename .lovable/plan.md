
# Piano: Correzione Bug Grafico Evoluzione Rendimento

## Problema Identificato

Dopo l'inserimento di uno snapshot storico con data **precedente** all'ultimo caricato, il grafico mostra date e valori errati sull'asse X.

**Causa principale**: Il formato data `'MMM yy'` (es. "gen 26") è troppo generico e crea confusione quando:
- Ci sono più snapshot nello stesso mese
- Le date sono vicine temporalmente

**Dati attuali nel database** (ordinati correttamente):
```
2024-12-31 → dic 24
2025-07-01 → lug 25
2025-12-31 → dic 25
2026-01-30 → gen 26
2026-02-07 → feb 26
```

Il formato attuale non distingue adeguatamente tra snapshot diversi dello stesso mese o di mesi adiacenti.

---

## Soluzioni Proposte

### 1. Formato Data Più Preciso

Cambiare il formato da `'MMM yy'` a `"dd MMM ''yy"` per includere il giorno:

| Prima | Dopo |
|-------|------|
| gen 26 | 30 gen '26 |
| feb 26 | 07 feb '26 |
| dic 24 | 31 dic '24 |

### 2. Configurazione Asse X Esplicita

Aggiungere parametri a Recharts per garantire visualizzazione corretta:

```typescript
<XAxis
  dataKey="formattedDate"
  interval={0}        // Mostra TUTTI i tick senza saltarne
  type="category"     // Tratta le date come categorie discrete
  tick={{ ... }}
/>
```

### 3. Gestione Dinamica dell'Intervallo

Per evitare sovrapposizione con molti punti dati, calcolare l'intervallo dinamicamente:

```typescript
// Se più di 8 punti, ruota etichette o mostra alternati
const tickInterval = chartData.length > 8 ? Math.floor(chartData.length / 8) : 0;
```

---

## Modifiche Tecniche

### File: `src/components/dashboard/charts/PerformanceEvolutionChart.tsx`

**Linea 368** - Cambio formato data:
```typescript
// PRIMA
formattedDate: format(parseISO(entry.snapshot_date), 'MMM yy', { locale: it }),

// DOPO  
formattedDate: format(parseISO(entry.snapshot_date), "dd MMM ''yy", { locale: it }),
```

**Linea 394** - Stessa modifica per il punto corrente

**Linee 443-448** - Configurazione XAxis:
```typescript
<XAxis
  dataKey="formattedDate"
  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
  tickLine={false}
  axisLine={{ stroke: 'hsl(var(--border))' }}
  interval={0}
  type="category"
/>
```

### File: `src/components/dashboard/charts/PortfolioEvolutionChart.tsx`

**Linea 84** - Cambio formato data:
```typescript
formattedDate: format(parseISO(entry.snapshot_date), "dd MMM ''yy", { locale: it }),
```

**Linea 94** - Stessa modifica per il punto corrente

**Linee 127-131** - Configurazione XAxis:
```typescript
<XAxis
  dataKey="formattedDate"
  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
  tickLine={false}
  axisLine={{ stroke: 'hsl(var(--border))' }}
  interval={0}
  type="category"
/>
```

---

## Comportamento Atteso

### Asse X Prima della Correzione:
```
dic 24 | lug 25 | dic 25 | gen 26 | feb 26
                           ↑        ↑
                     Confusione visiva
```

### Asse X Dopo la Correzione:
```
31 dic '24 | 01 lug '25 | 31 dic '25 | 30 gen '26 | 07 feb '26
                                        ↑            ↑
                              Chiaramente distinti
```

---

## File da Modificare

| File | Modifica |
|------|----------|
| `src/components/dashboard/charts/PerformanceEvolutionChart.tsx` | Formato data + XAxis props |
| `src/components/dashboard/charts/PortfolioEvolutionChart.tsx` | Formato data + XAxis props |

---

## Considerazioni Aggiuntive

1. **Font size ridotto**: Da 11px a 10px per accomodare il formato più lungo
2. **Gestione overflow**: Se le etichette si sovrappongono con molti punti, si può aggiungere `angle={-45}` per ruotarle
3. **Consistenza**: Entrambi i grafici useranno lo stesso formato per coerenza visiva
