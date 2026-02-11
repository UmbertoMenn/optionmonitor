

## Aggiunta "Info aggiornamento dati" in Dashboard, Risk Analyzer e Strategie Derivati

### Cosa cambia

1. **Dashboard** (`src/components/dashboard/Dashboard.tsx`): Aggiungere la scritta "Info aggiornamento dati" come etichetta cliccabile/visibile accanto all'icona (i) gia presente, a sinistra del ViewModeSelector.

2. **Risk Analyzer** (`src/pages/RiskAnalyzer.tsx`): Aggiungere lo stesso blocco (scritta + icona (i) + tooltip) nella stessa posizione relativa -- sotto l'header, sopra il RiskViewModeSelector. Import di `Info` da lucide-react e dei componenti Tooltip.

3. **Strategie Derivati** (`src/pages/Derivatives.tsx`): Aggiungere lo stesso blocco sotto l'header, prima del DerivativesSummaryCard (nell'area indicata dal rettangolo rosso nello screenshot). Il testo del tooltip sara adattato per enfatizzare che in questa pagina i prezzi sono live.

### Dettaglio tecnico

**File 1: `src/components/dashboard/Dashboard.tsx`**
- Modificare il blocco `absolute left-0` per includere un layout flex con la scritta "Info aggiornamento dati" seguita dall'icona Info con tooltip (gia presente).
- Layout: `flex items-center gap-1.5` con testo `text-xs text-muted-foreground`.

**File 2: `src/pages/RiskAnalyzer.tsx`**
- Aggiungere import di `Info` da lucide-react e `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` da `@/components/ui/tooltip`.
- Inserire un div con `relative flex items-center justify-center` sopra il `RiskViewModeSelector` (riga ~231), con lo stesso pattern della Dashboard: etichetta + icona + tooltip posizionati a sinistra con `absolute left-0`.
- Stesso testo tooltip della Dashboard.

**File 3: `src/pages/Derivatives.tsx`**
- Inserire subito dopo il tag `<main>` (riga 334) e prima del `DerivativesSummaryCard` un blocco con la scritta "Info aggiornamento dati" + icona Info + tooltip.
- Il tooltip conterra lo stesso messaggio delle altre pagine.
- Layout semplice: `flex items-center gap-1.5` senza posizionamento assoluto (non c'e un selettore da centrare).

### Testo tooltip (uguale su tutte e 3 le pagine)
```
Dashboard e Risk Analyzer: dati aggiornati ai prezzi del file Excel caricato.
Strategie Derivati: prezzi opzioni delayed 15 min, prezzi sottostanti aggiornati ogni 5 min.
```
