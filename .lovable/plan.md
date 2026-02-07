
# Piano: Fix Tooltip nelle Strategie Derivati

## Problema Identificato

I tooltip all'interno delle righe delle strategie derivati non funzionano. L'analisi del codice ha rivelato due cause principali:

### Causa 1: Pattern `CollapsibleTrigger asChild` in `OtherStrategyRow`

La funzione `OtherStrategyRow` (linee 1777-1830) utilizza:
```tsx
<CollapsibleTrigger asChild>
  <div className="...">
    ...tooltip content...
  </div>
</CollapsibleTrigger>
```

Quando si usa `asChild`, Radix crea un elemento `<button>` che avvolge il contenuto. Questo elemento interattivo intercetta gli eventi hover, impedendo ai tooltip al suo interno di attivarsi.

### Causa 2: Mancanza di `stopPropagation` in `GroupedOptionLegRow`

I tooltip in `GroupedOptionLegRow` (linee 1709-1721) non hanno `onClick={(e) => e.stopPropagation()}` sui loro trigger, causando conflitti con gli elementi padre.

---

## Soluzione

### 1. Modificare `OtherStrategyRow`

Applicare lo stesso pattern usato nelle altre righe (CoveredCallRow, NakedPutRow, GroupedOtherStrategyRow):

**Prima (linee 1776-1830)**:
```tsx
<Collapsible open={isOpen} onOpenChange={setIsOpen}>
  <CollapsibleTrigger asChild>
    <div className="flex items-center...">
      ...
    </div>
  </CollapsibleTrigger>
  ...
</Collapsible>
```

**Dopo**:
```tsx
<Collapsible open={isOpen} onOpenChange={setIsOpen}>
  <div 
    role="button"
    tabIndex={0}
    onClick={() => setIsOpen(!isOpen)}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(!isOpen); }}
    className="flex items-center..."
  >
    ...
  </div>
  ...
</Collapsible>
```

E aggiungere `onClick={(e) => e.stopPropagation()}` sui tooltip trigger.

### 2. Modificare `GroupedOptionLegRow`

Aggiungere `onClick={(e) => e.stopPropagation()}` ai tooltip trigger esistenti (linee 1709-1721 e 1733-1741).

---

## File Coinvolti

| File | Modifica |
|------|----------|
| `src/pages/Derivatives.tsx` | - Sostituire `CollapsibleTrigger asChild` con `div role="button"` in `OtherStrategyRow` |
| | - Aggiungere `onClick={(e) => e.stopPropagation()}` ai tooltip trigger in `OtherStrategyRow` |
| | - Aggiungere `onClick={(e) => e.stopPropagation()}` ai tooltip trigger in `GroupedOptionLegRow` |

---

## Dettagli Tecnici

### Pattern corretto per tooltip in righe interattive

Secondo le best practice del progetto (memoria `tech/ui/tooltip-nesting-pattern`):

1. Evitare `<CollapsibleTrigger asChild>` quando ci sono tooltip all'interno
2. Usare invece `<div role="button">` con gestione manuale del click
3. Aggiungere sempre `onClick={(e) => e.stopPropagation()}` sui `TooltipTrigger` per evitare che il click sul tooltip attivi anche il toggle del collapsible

### Modifiche specifiche

**OtherStrategyRow - Riga 1777-1778**:
```tsx
// PRIMA
<CollapsibleTrigger asChild>
  <div className="flex items-center...">

// DOPO
<div 
  role="button"
  tabIndex={0}
  onClick={() => setIsOpen(!isOpen)}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(!isOpen); }}
  className="flex items-center..."
>
```

**OtherStrategyRow - Tooltip PS (linee 1802-1805)**:
```tsx
// PRIMA
<span className="text-sm text-muted-foreground cursor-help">

// DOPO
<span className="text-sm text-muted-foreground cursor-help" onClick={(e) => e.stopPropagation()}>
```

**OtherStrategyRow - Tooltip PMC (linee 1816-1819)**:
```tsx
// PRIMA
<span className="text-sm text-muted-foreground cursor-help">

// DOPO
<span className="text-sm text-muted-foreground cursor-help" onClick={(e) => e.stopPropagation()}>
```

**GroupedOptionLegRow - Tooltip ITM/OTM (linea 1711)**:
```tsx
// PRIMA
<Badge variant="outline" className="text-xs shrink-0 cursor-help ...">

// DOPO
<Badge variant="outline" className="text-xs shrink-0 cursor-help ..." onClick={(e) => e.stopPropagation()}>
```

**GroupedOptionLegRow - Tooltip PMC (linea 1735)**:
```tsx
// PRIMA
<span className="text-sm text-muted-foreground cursor-help">

// DOPO
<span className="text-sm text-muted-foreground cursor-help" onClick={(e) => e.stopPropagation()}>
```

---

## Risultato Atteso

Dopo le modifiche:
- I tooltip "PS: Prezzo Sottostante" funzioneranno correttamente
- I tooltip "PMC: Prezzo Medio di Carico Opzione" funzioneranno correttamente
- I tooltip "ITM/OTM" sui badge funzioneranno correttamente
- Il toggle del collapsible continuerà a funzionare normalmente cliccando sulla riga
