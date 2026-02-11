

## Spostamento bottone OptionStrat accanto al nome opzione/titolo

### Cosa cambia
Il pulsante OptionStrat (icona link esterno) viene spostato subito dopo la descrizione dell'opzione o il nome del sottostante, in una colonna CSS Grid dedicata. Attualmente si trova piu a destra (nella zona menu/calculator). La modifica riguarda tutte le tipologie di riga nella pagina Strategie Derivati.

### Righe interessate

1. **Covered Call** (~riga 715): OptionStrat e attualmente in Col 7 (con Calculator). Va spostato in una nuova colonna dopo Col 3 (descrizione). Il Calculator resta dove si trova.
2. **Long Put / Protection** (~riga 938): OptionStrat e in Col 6 (con MoveOptionMenu). Va spostato dopo Col 3. Il MoveOptionMenu resta da solo.
3. **Iron Condor** (~riga 1130): OptionStrat e gia in Col 3 con il badge IC. Va separato in una colonna propria subito dopo.
4. **Double Diagonal** (~riga 1369): OptionStrat e gia in Col 2 con il nome underlying. Va separato in una colonna propria.
5. **Grouped Strategy** (~riga 1664): come Double Diagonal, va separato in colonna propria.
6. **Naked Put** (~riga 2023): OptionStrat e in Col 6 (con MoveOptionMenu). Va spostato dopo Col 3.
7. **Leap Call** (~riga 2176): OptionStrat e in Col 6 (con MoveOptionMenu). Va spostato dopo Col 3.

### Dettaglio tecnico

**File: `src/pages/Derivatives.tsx`**

Per ogni tipologia di riga:

1. Aggiungere una colonna `auto` nella definizione `grid-cols-[...]` subito dopo la colonna della descrizione/nome
2. Creare un nuovo commento `/* Col N: OptionStrat */` con il bottone `<OptionStratButton ... />`
3. Rimuovere il bottone dalla sua posizione attuale (Col 6/7)
4. Rinumerare i commenti delle colonne successive

Le definizioni grid cambiano cosi (esempio per le righe con opzioni individuali):
- Da: `[auto_auto_minmax(8rem,1fr)_auto_auto_auto_auto_8rem_6rem_4.5rem_5rem_8rem]`
- A: `[auto_auto_minmax(8rem,1fr)_auto_auto_auto_auto_8rem_6rem_4.5rem_5rem_8rem]` (stessa struttura ma il contenuto della colonna `auto` dopo la descrizione contiene ora l'OptionStrat button anziche essere vuoto)

Per Iron Condor, Double Diagonal e Grouped Strategy il bottone viene estratto dal div che contiene il nome/badge e messo in una colonna `auto` dedicata immediatamente successiva.

