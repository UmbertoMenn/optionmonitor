

## Fix header mobile - Layout a due righe

### Problema reale (analisi approfondita)

Il layout flex orizzontale dell'header ha due figli:
1. Logo + titolo "Portfolio Monitor" con `shrink-0` -- occupa circa 200px fissi
2. Container scrollabile con `overflow-x-auto min-w-0 flex-1`

Su mobile (375px), dopo il padding (32px) e il logo (200px), restano solo **143px** per la barra scrollabile. Il `PortfolioSelector` ha `min-w-[180px]` (piu largo dello spazio disponibile), quindi:
- Il container scrollabile e troppo stretto perche il gesto di swipe venga riconosciuto
- Il tap sul DropdownMenuTrigger del PortfolioSelector intercetta il tocco prima dello scroll
- Non c'e indicazione visiva che si possa scorrere

### Soluzione

Cambiare il layout dell'header da una riga a **due righe su mobile**:
- Riga 1: Logo + titolo (come ora)  
- Riga 2: Barra scrollabile a **tutta larghezza** (343px invece di 143px)

Su desktop (sm+), il layout resta su una riga come prima.

### Modifica tecnica

**File: `src/components/dashboard/Dashboard.tsx`**

Cambiare il container dell'header da:
```tsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-3 shrink-0">
    <!-- logo -->
  </div>
  <div className="flex items-center gap-2 overflow-x-auto flex-nowrap min-w-0 flex-1 justify-end">
    <!-- pulsanti -->
  </div>
</div>
```

A:
```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
  <div className="flex items-center gap-3 shrink-0">
    <!-- logo -->
  </div>
  <div className="flex items-center gap-2 overflow-x-auto flex-nowrap min-w-0 sm:flex-1 sm:justify-end">
    <!-- pulsanti -->
  </div>
</div>
```

Differenze chiave:
- `flex-col` su mobile, `sm:flex-row` su desktop: le due sezioni si impilano verticalmente su mobile
- `gap-3` tra le due righe
- La barra scrollabile occupa il 100% della larghezza su mobile
- Su desktop (sm+) il comportamento resta identico a prima con `sm:flex-1 sm:justify-end`

### File coinvolti
- `src/components/dashboard/Dashboard.tsx` -- unico file da modificare, riga 154

