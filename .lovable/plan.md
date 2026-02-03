

# Piano: Rinominare e Stilizzare la Card "Posizioni da monitorare"

## Obiettivo

Modificare la card "Azioni Necessarie" per:
1. Rinominare il titolo in **"Posizioni da monitorare"**
2. Creare un effetto visivo di **card sovrapposta** dove il titolo appare su uno sfondo più scuro in secondo piano

## Soluzione Tecnica

### Struttura Proposta

```text
┌──────────────────────────────────────────────────────────┐
│  CARD ESTERNA (sfondo più scuro, bordo)                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │  🔺 Posizioni da monitorare                        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│     ┌──────────────────────────────────────────────┐     │
│     │  CARD INTERNA (sfondo più chiaro)            │     │
│     │                                               │     │
│     │  • Covered Call ITM                          │     │
│     │  • Double Diagonal OOR                       │     │
│     │  • Iron Condor OOR                          │     │
│     │  • ...                                       │     │
│     │                                               │     │
│     └──────────────────────────────────────────────┘     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Implementazione

1. **Card esterna** con sfondo `bg-background-secondary` (più scuro)
2. **Header** con il titolo "Posizioni da monitorare" sulla card esterna
3. **Card interna** con sfondo `bg-card` (più chiaro) contenente l'elenco delle sezioni

### Codice Modificato (righe 442-451)

**Prima:**
```typescript
return (
  <div className="grid grid-cols-2 gap-4">
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <CardTitle className="text-xl">Azioni Necessarie</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        ...
      </CardContent>
    </Card>
```

**Dopo:**
```typescript
return (
  <div className="grid grid-cols-2 gap-4">
    {/* Card esterna più scura - sfondo principale */}
    <div className="rounded-lg border border-border bg-background-secondary p-4">
      {/* Header sulla card esterna */}
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        <h3 className="text-xl font-semibold text-card-foreground">Posizioni da monitorare</h3>
      </div>
      
      {/* Card interna più chiara - contenuto */}
      <Card className="border-border bg-card">
        <CardContent className="pt-4">
          ...
        </CardContent>
      </Card>
    </div>
```

## Dettagli Stilistici

| Elemento | Classe/Sfondo | Risultato |
|----------|---------------|-----------|
| Card esterna | `bg-background-secondary` | Sfondo più scuro (HSL 220 18% 10%) |
| Card interna | `bg-card` | Sfondo più chiaro (HSL 220 18% 10%) - già presente |
| Bordo esterno | `border-border` | Bordo visibile sulla card principale |
| Padding | `p-4` | Spazio tra card esterna e interna |

## File da Modificare

- `src/components/derivatives/DerivativesSummaryCard.tsx` - Righe 442-520 circa

## Risultato Visivo

L'effetto finale mostrerà:
- Un contenitore più scuro con il titolo "Posizioni da monitorare" e l'icona di warning
- Una card bianca sovrapposta contenente tutte le sezioni espandibili
- L'impressione di profondità e gerarchia visiva

