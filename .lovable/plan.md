

## Aggiungere selettore vista alla card Composizione Portafoglio

### Cosa cambia

La card "Composizione Portafoglio" (quella con la torta e il carousel netting) ricevera un dropdown compatto nell'header, identico a quello gia presente nelle card dei grafici storici. Il dropdown permette di cambiare la vista (Base / Netting ex. CC e NP / Netting Totale) direttamente dalla card, sincronizzato con il viewMode globale.

### Modifiche tecniche

**File: `src/components/dashboard/DynamicPortfolioChart.tsx`**

1. Aggiungere `onViewModeChange` alle props del componente
2. Importare `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` da `@/components/ui/select`
3. Nell'header della Card, affiancare al titolo il dropdown Select (stile identico ai grafici storici: `h-7 w-auto text-xs bg-muted border-0 px-2 gap-1`)
4. Il titolo diventa dinamico come gia e, ma spostato a sinistra con `justify-between`

**File: `src/components/dashboard/Dashboard.tsx`**

1. Passare `onViewModeChange={setViewMode}` come nuova prop a `DynamicPortfolioChart`

### Layout header risultante

```text
[Composizione Portafoglio]                    [Base v]
```

Identico al layout delle card storiche (titolo a sinistra, dropdown a destra).
