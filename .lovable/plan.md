

## Fix allineamento colonne Iron Condor e Double Diagonal

### Problemi identificati

**Double Diagonal** (grid attuale: `[1.25rem_minmax(6rem,1fr)_2rem_3rem_3rem_auto_6rem_6rem_4.5rem_6rem_7rem]`):
1. La colonna PS e solo `4.5rem`, troppo stretta per "PS: 456,..." che viene troncato
2. La colonna PUT spread usa `auto` causando disallineamento tra righe
3. C'e una colonna vuota da `6rem` tra PS e P/L che spreca spazio

**Iron Condor** (grid attuale: `[1.25rem_minmax(6rem,1fr)_2rem_2rem_3rem_3rem_5rem_6rem_6rem_4.5rem_6rem_6.5rem_7rem]`):
1. La colonna 13 (`7rem`) sembra inutilizzata (nessun contenuto dopo ML)
2. PS anche qui e solo `6rem` ma funziona perche ha meno dati nella riga

### Soluzione

**File: `src/pages/Derivatives.tsx`**

#### Double Diagonal (riga 1358)

Nuovo grid a 11 colonne (rimuovere la colonna vuota, allargare PS):
```
Da: [1.25rem_minmax(6rem,1fr)_2rem_3rem_3rem_auto_6rem_6rem_4.5rem_6rem_7rem]
A:  [1.25rem_minmax(6rem,1fr)_2rem_3rem_3rem_5rem_6rem_6rem_7rem_6rem_7rem]
```

Modifiche:
- Col 6 PUT spread: da `auto` a `5rem` (larghezza fissa per allineamento)
- Col 7 CALL spread: `6rem` (invariato)
- Col 8 Contratti: `6rem` (invariato)
- Col 9 PS: da `4.5rem` a `7rem` (piu spazio per mostrare il prezzo completo)
- Col 10: rimane `6rem` ma viene usato - verificare se serve spostare il P/L qui
- Col 11 P/L: `7rem` (invariato)

Oppure, se la colonna 10 e effettivamente vuota, ridurre a 10 colonne:
```
[1.25rem_minmax(6rem,1fr)_2rem_3rem_3rem_5rem_6rem_6rem_7rem_7rem]
```
- Col 6 PUT spread: `5rem`
- Col 7 CALL spread: `6rem`
- Col 8 Contratti: `6rem`
- Col 9 PS: `7rem` (prezzo visibile per intero)
- Col 10 P/L: `7rem`

E rimuovere la cella grid vuota tra PS e P/L.

#### Iron Condor (riga 1120)

Verificare e rimuovere la colonna 13 inutilizzata, oppure assegnarla correttamente:
```
Da: [1.25rem_minmax(6rem,1fr)_2rem_2rem_3rem_3rem_5rem_6rem_6rem_4.5rem_6rem_6.5rem_7rem]
A:  [1.25rem_minmax(6rem,1fr)_2rem_2rem_3rem_3rem_5rem_6rem_7rem_4.5rem_6rem_6.5rem]
```

Modifiche:
- Col 9 PS: da `6rem` a `7rem` (coerente con DD)
- Rimuovere ultima colonna inutilizzata (`7rem`)
- Totale: 12 colonne

### Cosa NON cambia
- Nessuna logica di calcolo
- Tutti i dati, badge, pulsanti e tooltip restano identici
- Il contenuto espanso (CollapsibleContent) resta invariato
