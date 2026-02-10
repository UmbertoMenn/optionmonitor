

## Fix: prezzo con indicatore stale che va a capo

### Problema

Nell'immagine si vede che il valore "12,53 $" va a capo con il simbolo "$" su una riga separata. Questo accade perche la colonna del prezzo nel CSS Grid e troppo stretta (es. `6rem`) per contenere contemporaneamente il prezzo formattato, l'icona triangolo rosso e la percentuale di variazione.

### Soluzione

Applicare due correzioni minimali:

1. **`whitespace-nowrap`** sul contenitore del prezzo (`div` con `flex items-center gap-1 justify-end`) in tutte le righe delle strategie, cosi che il valore monetario (es. "12,53 $") non vada mai a capo
2. **Allargare la colonna prezzo** da `6rem` a `8rem` nelle definizioni `grid-cols-[...]` di tutte le righe che contengono il prezzo con indicatore stale

### File modificato

**`src/pages/Derivatives.tsx`** - Circa 4 punti di modifica:

- **Riga 688**: `6rem` finale diventa `8rem` nel grid template
- **Riga 831**: aggiunta `whitespace-nowrap` al div del prezzo
- Stesse modifiche replicate nelle altre sezioni (Naked Put riga 908, Leap Call riga 2131, Individual Options riga 1981) per coerenza

### Dettaglio tecnico

Grid template attuale (Covered Call):
```
grid-cols-[auto_auto_minmax(8rem,1fr)_auto_auto_auto_auto_8rem_6rem_4.5rem_5rem_6rem]
```
Diventa:
```
grid-cols-[auto_auto_minmax(8rem,1fr)_auto_auto_auto_auto_8rem_6rem_4.5rem_5rem_8rem]
```

E il div del prezzo:
```html
<div className="flex items-center gap-1 justify-end">
```
Diventa:
```html
<div className="flex items-center gap-1 justify-end whitespace-nowrap">
```

Questo garantisce che prezzo + triangolino + percentuale restino sempre su una riga sola.
