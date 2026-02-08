

## Obiettivo
Aggiungere un selettore rapido per cambiare vista (Base, Netting ex. CC, Netting ex. CC e NP, Netting Totale) direttamente nei grafici "Evoluzione Rendimento" e "Rendimento per Anno", senza dover scorrere fino al selettore globale della dashboard.

## Analisi della situazione attuale

- Il `viewMode` e` gestito centralmente in `Dashboard.tsx` tramite `useState`
- Viene passato a `HistoricalChartsCarousel` che lo distribuisce ai grafici figli
- I grafici mostrano solo un badge statico con la vista corrente (es. "Base")
- L'utente deve usare il selettore globale in cima alla dashboard per cambiare vista

## Soluzione proposta

Aggiungere un menu dropdown compatto al posto del badge statico attuale in entrambe le card dei grafici, permettendo di cambiare la vista direttamente da li.

```text
+------------------------------------------------------+
| [icona] Evoluzione Rendimento    [▼ Base        ]    |
| Rendimento % e P/L nel tempo...                      |
|                                                      |
| [grafico]                                            |
+------------------------------------------------------+
```

## Modifiche tecniche

### 1. HistoricalChartsCarousel.tsx
- Aggiungere una callback `onViewModeChange` alle props
- Sostituire il badge statico con un `Select` (dropdown) compatto
- Applicare la stessa modifica sia alla card del carousel che alla card "Rendimento per Anno"

### 2. Dashboard.tsx
- Passare `onViewModeChange={setViewMode}` al componente `HistoricalChartsCarousel`

## Dettagli implementativi

### Componente Select per la vista
Utilizzera il componente `Select` di shadcn/ui gia presente nel progetto:

```tsx
<Select value={viewMode} onValueChange={onViewModeChange}>
  <SelectTrigger className="h-7 w-auto text-xs bg-muted border-0 px-2">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="base">Base</SelectItem>
    <SelectItem value="netting_ex_cc">Netting ex. CC</SelectItem>
    <SelectItem value="netting_ex_cc_np">Netting ex. CC e NP</SelectItem>
    <SelectItem value="netting_total">Netting Totale</SelectItem>
  </SelectContent>
</Select>
```

### Props aggiornate per HistoricalChartsCarousel

```tsx
interface HistoricalChartsCarouselProps {
  historicalData: HistoricalDataEntry[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;  // NUOVA PROP
  currentValue: number;
  currentDate: string | null;
  deposits: DepositEntry[];
}
```

## File da modificare

| File | Modifica |
|------|----------|
| `src/components/dashboard/HistoricalChartsCarousel.tsx` | Aggiungere prop `onViewModeChange`, sostituire badge con Select in entrambe le card |
| `src/components/dashboard/Dashboard.tsx` | Passare `onViewModeChange={setViewMode}` al carousel |

## Vantaggi

- Cambio vista rapido senza scroll
- UI coerente: stesso dropdown in entrambe le card
- Sincronizzazione automatica: cambiando vista dal dropdown si aggiorna anche il selettore globale (stesso state)
- Nessuna modifica ai grafici interni (PerformanceEvolutionChart, YearlyReturnChart)

