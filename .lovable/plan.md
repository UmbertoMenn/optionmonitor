

## Fix: Data Ingresso - date uniche e input manuale

### Problema 1: Date duplicate
Il `Select` mostra `priceData.slice(0, 50)`, ma i dati possono avere piu barre con la stessa data (es. dati orari). Risultato: la stessa data appare ripetuta piu volte nel menu.

### Problema 2: Nessun input manuale
Il campo usa solo un `Select`, senza possibilita di scrivere la data a mano.

### Soluzione

Sostituire il `Select` con un campo `Input` di tipo testo (formato `YYYY-MM-DD`) che permetta di scrivere la data liberamente. Aggiungere un `Popover` con un `Calendar` (datepicker) come alternativa visuale per chi preferisce selezionare.

### Dettaglio tecnico

**File:** `src/components/simulator/StrategyBuilder.tsx`

**Righe 102-111** - Sostituire il blocco `Select` con:

- Un `Popover` contenente un `Calendar` (componente shadcn gia presente nel progetto)
- Il trigger sara un `Button` che mostra la data selezionata con un'icona calendario
- La data selezionata aggiorna `entryDateStr` nel formato `YYYY-MM-DD`
- Il calendario sara limitato alle date disponibili nel range `dateRange.from` / `dateRange.to`

Inoltre, prima di passare `entryDateStr` al resto della logica, la data verra cercata nella barra piu vicina disponibile in `priceData` (gia implementato nel `useMemo` di `entryPrice` alle righe 38-46).

**Imports aggiuntivi:** `Calendar`, `Popover`, `PopoverTrigger`, `PopoverContent` da shadcn, `CalendarIcon` da lucide-react, `format` da date-fns.

**Logica date uniche:** Non piu necessaria perche il Calendar mostra solo giorni unici per natura.

