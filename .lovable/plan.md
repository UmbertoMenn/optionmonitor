

## Fix scroll orizzontale header mobile

### Problema
Il div destro dell'header (che contiene PortfolioSelector + pulsanti) ha `overflow-x-auto` ma non ha un vincolo di larghezza massima. In un layout flex con `justify-between`, il div si espande oltre lo schermo invece di attivare lo scroll interno.

### Soluzione

**`src/components/dashboard/Dashboard.tsx`** - riga 169:

Aggiungere `min-w-0 flex-1` al container scrollabile dei pulsanti. Questo forza il browser a vincolare la larghezza del div allo spazio disponibile (dopo il logo), attivando correttamente `overflow-x-auto`.

Da:
```tsx
<div className="flex items-center gap-2 overflow-x-auto flex-nowrap">
```

A:
```tsx
<div className="flex items-center gap-2 overflow-x-auto flex-nowrap min-w-0 flex-1 justify-end">
```

`min-w-0` sovrascrive il `min-width: auto` di default dei flex items, permettendo al div di restringersi sotto la dimensione del suo contenuto. `flex-1` gli assegna tutto lo spazio rimanente dopo il logo. `justify-end` mantiene i pulsanti allineati a destra su desktop.
