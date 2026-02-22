

## Fix: Data Ingresso con input manuale DD/MM/YYYY

### Problema
Il campo Data Ingresso usa solo un calendario cliccabile, senza possibilita di scrivere la data a mano.

### Soluzione
Sostituire il `Popover`+`Calendar` con il componente `DateInput` gia presente nel progetto (`src/components/ui/date-input.tsx`), che offre:
- Campo di testo dove scrivere la data in formato DD/MM/YYYY con auto-inserimento degli slash
- Bottone calendario accanto per chi preferisce selezionare visualmente

### Dettaglio tecnico

**File:** `src/components/simulator/StrategyBuilder.tsx`

1. **Import**: sostituire gli import di `Button`, `Calendar`, `Popover*`, `CalendarIcon`, `cn` con `import { DateInput } from '@/components/ui/date-input'`
2. **Righe 109-139**: sostituire tutto il blocco `Popover` con:
   ```tsx
   <DateInput
     value={entryDateStr ? parseISO(entryDateStr) : undefined}
     onChange={(date) => {
       if (date) setEntryDateStr(format(date, 'yyyy-MM-dd'));
     }}
     disabled={(date) => {
       if (!dateRange.from || !dateRange.to) return false;
       return date < parseISO(dateRange.from) || date > parseISO(dateRange.to);
     }}
   />
   ```
3. Mantenere gli import di `format` e `parseISO` da date-fns (servono per la conversione)
4. Rimuovere import inutilizzati (`Button`, `Calendar`, `Popover*`, `CalendarIcon`, `cn`)

