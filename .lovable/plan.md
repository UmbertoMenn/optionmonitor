
## Sostituzione Donut con Istogramma orizzontale e tooltip con dettaglio posizioni

### Problema
Il grafico ad anello (donut) nella slide 2 non funziona bene perche' ci sono valori sia positivi che negativi, rendendo la visualizzazione confusa.

### Soluzione
Sostituire il componente `NettingPieChart` con un istogramma orizzontale (`BarChart` layout vertical) che mostra ogni categoria come barra separata, con colori rosso per i costi e verde per i guadagni. Al passaggio del mouse su ogni barra, un tooltip ricco mostra le top posizioni di quella specifica categoria ordinate per valore assoluto decrescente.

### Dettaglio tecnico

**File: `src/components/dashboard/DynamicPortfolioChart.tsx`**

1. **Rimuovere** il componente `NettingPieChart` e l'import di `PieChart, Pie` da recharts.

2. **Creare** un nuovo componente `NettingBreakdownChart` che:
   - Riceve `items: NettingBreakdownItem[]` e `finalValue: number`
   - Filtra le categorie con valore diverso da zero
   - Costruisce un array di dati per un `BarChart` orizzontale (layout="vertical"), una barra per categoria
   - Ogni barra ha il colore della categoria (`PIE_COLORS[category]`): rosso/arancio per costi, verde per guadagni
   - L'asse Y mostra le etichette delle categorie (troncate se necessario)
   - L'asse X mostra i valori in EUR con formattazione abbreviata
   - **Tooltip personalizzato**: al passaggio del mouse su una barra, mostra:
     - Nome della categoria e valore totale
     - Lista delle top 3 posizioni (ticker + valore) di quella specifica categoria, ordinate per valore assoluto decrescente
   - Il valore nettato finale viene mostrato al centro sotto il grafico in blu (`text-2xl font-bold text-blue-500`)
   - Altezza dinamica in base al numero di categorie visibili (circa 36px per barra)

3. **Aggiornare Slide 2** del carousel: sostituire `<NettingPieChart>` con `<NettingBreakdownChart>`.

4. **Rimuovere** la legenda separata (non serve piu', le etichette sono sull'asse Y).

5. Aggiornare la label dello slide da "Breakdown Netting" (invariata, solo il contenuto cambia).
