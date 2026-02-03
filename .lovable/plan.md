
# Piano per Risolvere il Bug dei Tooltip nella Pagina Strategie Derivati

## Problema Identificato

I tooltip non appaiono perché il `TooltipTrigger` è **annidato all'interno di un elemento `<button>`**. Questo causa conflitti tra gli eventi del mouse:

- La libreria Radix UI Tooltip richiede che il trigger riceva gli eventi hover direttamente
- Quando il trigger è dentro un bottone, il bottone "cattura" gli eventi hover/focus prima che raggiungano il tooltip
- Il click sul badge attiva l'espansione/contrazione della sezione invece di mostrare il tooltip

## Impatto

Tutti i badge con tooltip nella card "Azioni Necessarie" (ITM, OOR, G, OOR/OOB) non mostrano i loro tooltip al passaggio del mouse.

## Soluzione Tecnica

### Modifiche in `src/components/derivatives/DerivativesSummaryCard.tsx`

Ristrutturare il componente `CompactSection` per separare il bottone cliccabile dall'area del badge con tooltip:

```text
PRIMA (struttura attuale):
┌─────────────────────────────────────────────────┐
│ <button> (cattura tutti gli eventi)             │
│   ├─ Icona                                      │
│   ├─ Titolo                                     │
│   ├─ <Tooltip>                                  │
│   │     └─ <Badge>  ← tooltip non funziona     │
│   ├─ Conteggio elementi                        │
│   └─ Freccia ▲/▼                               │
└─────────────────────────────────────────────────┘

DOPO (struttura corretta):
┌─────────────────────────────────────────────────┐
│ <div> (contenitore flex)                        │
│   ├─ <button> (area cliccabile)                 │
│   │     ├─ Icona                                │
│   │     ├─ Titolo                               │
│   │     ├─ Conteggio elementi                  │
│   │     └─ Freccia ▲/▼                         │
│   │                                             │
│   └─ <Tooltip>  (fuori dal button)             │
│         └─ <Badge>  ← tooltip funziona!        │
└─────────────────────────────────────────────────┘
```

### Implementazione Dettagliata

1. **Cambiare il wrapper da `<button>` a `<div>`** con classe flex
2. **Creare un `<button>` interno** che contiene solo gli elementi cliccabili (icona, titolo, freccia)
3. **Posizionare il `<Tooltip>` con il badge fuori dal button** ma dentro il div flex
4. **Aggiungere `e.stopPropagation()`** al badge per prevenire che il click sul badge attivi l'espansione

### Codice da Modificare

```typescript
// CompactSection - nuova struttura
function CompactSection({ ... }) {
  // ...
  return (
    <div className="py-2 border-b border-border/50 last:border-b-0">
      {/* Header row - div invece di button */}
      <div className="flex items-center gap-2 w-full hover:bg-muted/30 rounded px-1 -mx-1 transition-colors">
        {/* Bottone cliccabile per espansione (solo icona, titolo, freccia) */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <Icon className={`w-4 h-4 ${iconColor} shrink-0`} />
          <span className="text-sm font-bold text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">
            ({items.length} {items.length === 1 ? 'elemento' : 'elementi'})
          </span>
          <span className="text-xs text-muted-foreground ml-auto">
            {isExpanded ? '▲' : '▼'}
          </span>
        </button>
        
        {/* Badge con tooltip FUORI dal button */}
        {statusBadge && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className={`text-[10px] px-1.5 py-0 h-4 cursor-help ${statusBadge.colorClass}`}
                onClick={(e) => e.stopPropagation()} // Previene espansione
              >
                {statusBadge.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{BADGE_TOOLTIPS[statusBadge.label] || statusBadge.label}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      
      {/* Expandable items - invariato */}
      {isExpanded && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 pl-6">
          {items.map((item, idx) => renderItem(item, idx))}
        </div>
      )}
    </div>
  );
}
```

## Verifica

Dopo la modifica, i seguenti tooltip dovranno funzionare:

| Badge | Tooltip atteso |
|-------|----------------|
| ITM | "In The Money" |
| OOR | "Out of Range: il sottostante è fuori dagli strike venduti" |
| G | "In Gain: la Leap sta guadagnando" |
| OOR/OOB | "Out of Range o Out of Breakeven" |

## File da Modificare

- `src/components/derivatives/DerivativesSummaryCard.tsx` - Ristrutturazione del componente `CompactSection`

## Note

I tooltip nel resto della pagina Derivatives.tsx (nelle righe CoveredCall, LongPut, etc.) **funzionano già correttamente** perché i `TooltipTrigger` sono su elementi che non sono annidati in altri elementi interattivi.
