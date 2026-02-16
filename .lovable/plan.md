

## Rimozione vista "Netting ex. Covered Call" dalla Dashboard

### Cosa cambia

La vista `netting_ex_cc` viene eliminata dal selettore e da tutti i componenti della dashboard. Restano tre viste: **Base**, **Netting ex. Covered Call e Naked Put OTM**, **Netting Totale**.

I dati storici nel database (`netting_ex_cc` column) restano invariati -- non serve alcuna migrazione. Il campo continua a essere salvato nello snapshot per compatibilita', ma non e' piu' navigabile come vista.

### Dettaglio tecnico

**1. `src/components/dashboard/ViewModeSelector.tsx`**
- Rimuovere `netting_ex_cc` dal tipo `ViewMode` (diventa `'base' | 'netting_total' | 'netting_ex_cc_np'`)
- Rimuovere la voce `netting_ex_cc` da `VIEW_LABELS`
- Rimuovere `netting_ex_cc` dall'array `VIEWS`

**2. `src/components/dashboard/StatsCards.tsx`**
- Rimuovere il case `netting_ex_cc` da `VIEW_TITLES`
- Rimuovere i rami `case 'netting_ex_cc'` nei vari switch (patrimonio, P/L, rendimento annuale)
- Nei fallback dove `netting_ex_cc_np` usa `?? netting_ex_cc`, mantenere un fallback ragionevole (es. usare `netting_total` o il valore diretto)

**3. `src/components/dashboard/DynamicPortfolioChart.tsx`**
- Rimuovere `netting_ex_cc` dai titoli del grafico
- Rimuovere `netting_ex_cc` dal tipo nel calcolo breakdown

**4. `src/components/dashboard/charts/PortfolioEvolutionChart.tsx`**
- Rimuovere il `case 'netting_ex_cc'` dallo switch di selezione valore

**5. `src/components/dashboard/charts/PerformanceEvolutionChart.tsx`**
- Rimuovere il `case 'netting_ex_cc'` dallo switch di selezione valore

**6. `src/components/dashboard/HistoricalChartsCarousel.tsx`**
- Rimuovere `netting_ex_cc` dalle label del dropdown
- Rimuovere i `<SelectItem value="netting_ex_cc">` dai due dropdown (evoluzione rendimento e evoluzione patrimonio)

**7. `src/components/dashboard/Dashboard.tsx`**
- Il valore `currentValue` nel carousel usa uno switch su `viewMode`: rimuovere il ramo `netting_ex_cc`

**8. `src/components/dashboard/charts/YearlyReturnChart.tsx`** (se presente riferimento)
- Verificare e rimuovere eventuali riferimenti a `netting_ex_cc`

**Nota**: il campo `netting_ex_cc` continua a essere salvato negli snapshot storici e nel form dati storici per preservare la completezza dei dati. Solo la navigazione della vista viene rimossa.
