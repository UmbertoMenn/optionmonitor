

# Piano: Compattare Schede Stocks/ETF Mantenendo Barra Protezione

## Obiettivo

Rendere le schede del dettaglio Stocks ed ETF nel Risk Analyzer più compatte, **mantenendo la barra con le percentuali di protezione** ma riducendo lo spazio verticale generale.

---

## Modifiche di Compattamento

### Riduzioni Proposte

| Elemento | Attuale | Nuovo |
|----------|---------|-------|
| Padding scheda | `p-4` | `p-3` |
| Spaziatura interna | `space-y-3` | `space-y-2` |
| Griglia dettagli | `grid-cols-3 gap-4` | `grid-cols-3 gap-2` |
| Altezza barra protezione | `h-4` | `h-3` |
| Spaziatura tra schede | `space-y-4` | `space-y-2` |

### Layout Visivo Atteso

```
Attuale (~120px per scheda):
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  APPLE  [Protetto]                             Rischio: €45,230     │
│  1,200 azioni @ USD 180.50                  USD 52,100 / 1.1500     │
│                                                                     │
│  Valore Azioni: USD 216,600   PUT Strike: USD 170   Contratti: 12   │
│                                                                     │
│  ╔══════════════════════════╗╔══════════════════════════════════╗   │
│  ║   Protetto 75%           ║║   Rischio 25%                    ║   │
│  ╚══════════════════════════╝╚══════════════════════════════════╝   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Nuovo (~80px per scheda):
┌─────────────────────────────────────────────────────────────────────┐
│  APPLE  [Protetto]                             Rischio: €45,230     │
│  1,200 azioni @ USD 180.50                  USD 52,100 / 1.1500     │
│  Valore: USD 216,600   PUT: USD 170   Ctr: 12                       │
│  ╔═══════════════════════╗╔═══════════════════════════════════════╗ │
│  ║  Protetto 75%         ║║  Rischio 25%                          ║ │
│  ╚═══════════════════════╝╚═══════════════════════════════════════╝ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Modifiche Tecniche

### File: `src/components/risk/EquityExposureView.tsx`

#### 1. Ridurre Spaziatura Lista Schede

```typescript
// Linea 255 (ETF) e 360 (Stocks)
// Prima
<div className="space-y-4">

// Dopo
<div className="space-y-2">
```

#### 2. Ridurre Padding Scheda

```typescript
// Linea 263 (ETF) e 368 (Stocks)
// Prima
<div key={index} className="p-4 rounded-lg bg-muted/50 space-y-3">

// Dopo
<div key={index} className="p-3 rounded-lg bg-muted/50 space-y-2">
```

#### 3. Compattare Griglia Dettagli

```typescript
// Linea 289 (ETF) e 394 (Stocks)
// Prima
<div className="grid grid-cols-3 gap-4 text-sm">

// Dopo
<div className="grid grid-cols-3 gap-2 text-xs">
```

#### 4. Abbreviare Label Dettagli

```typescript
// Prima
<span className="text-muted-foreground">Valore Azioni:</span>
<span className="text-muted-foreground">PUT Strike:</span>
<span className="text-muted-foreground">Contratti:</span>

// Dopo
<span className="text-muted-foreground">Valore:</span>
<span className="text-muted-foreground">PUT:</span>
<span className="text-muted-foreground">Ctr:</span>
```

#### 5. Ridurre Altezza Barra Protezione

```typescript
// Linea 310 (ETF) e 415 (Stocks)
// Prima
<div className="h-4 rounded-full overflow-hidden flex">

// Dopo
<div className="h-3 rounded-full overflow-hidden flex">
```

#### 6. Rimuovere Spaziatura Extra Barra

```typescript
// Linea 309 (ETF) e 414 (Stocks)
// Prima
<div className="space-y-1">
  <div className="h-4 ...">

// Dopo (rimuove wrapper space-y-1)
<div className="h-3 rounded-full overflow-hidden flex">
```

---

## Risparmio Spazio Stimato

| Modifica | Risparmio |
|----------|-----------|
| Padding p-4 → p-3 | ~8px |
| space-y-3 → space-y-2 | ~8px |
| gap-4 → gap-2 | ~8px |
| h-4 → h-3 | ~4px |
| space-y-4 → space-y-2 (tra schede) | ~8px per scheda |
| **Totale per scheda** | **~35-40px** (~30% più compatto) |

---

## File da Modificare

| File | Modifiche |
|------|-----------|
| `src/components/risk/EquityExposureView.tsx` | Righe 255, 263, 289, 309-310 (ETF) e 360, 368, 394, 414-415 (Stocks) |

---

## Elementi NON Modificati

- **Barra protezione**: Mantenuta con percentuali visibili
- **Badge "Protetto"**: Invariato
- **Nome strumento**: Stessa prominenza
- **Valori EUR/Originale**: Stessa posizione a destra
- **Struttura generale**: Layout a due colonne mantenuto

