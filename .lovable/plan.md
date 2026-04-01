

## Fix: banner "posizioni non configurate" e doppio pulsante

### Problema
1. Il banner appare anche quando l'unica posizione non configurata è archiviata — il matching tra posizione e archivio usa `includes()` che può fallire per differenze di nome (es. "BIO ON SPA" vs "BIO ON").
2. Quando il banner è visibile, ci sono due pulsanti per aprire il wizard: quello nell'header ("Riconfigura strategie") e quello nel banner ("Configura"), creando confusione.

### Correzione

#### File: `src/pages/Derivatives.tsx`

1. **Migliorare il matching archivio nel calcolo `needsWizard`**
   - Usare `normalizeForMatching` / `getCanonicalKey` (già usati altrove nel progetto) invece di semplice `toUpperCase().trim()` + `Set.has()`.
   - Applicare la stessa normalizzazione sia alla chiave della posizione sia alle chiavi archiviate, così "BIO ON SPA" e "BIO ON" matchano correttamente.

2. **Rimuovere il banner duplicato**
   - Eliminare il blocco `Card` del banner (righe 674-688).
   - Il pulsante nell'header ("Riconfigura strategie" / "Configura strategie", riga 648-653) è già sufficiente come unico punto di accesso al wizard.
   - Se `needsWizard` è vero, aggiungere un piccolo badge/dot arancione al pulsante esistente per segnalare visivamente che ci sono posizioni da configurare, senza duplicare CTA.

### Risultato
- Nessun falso positivo: le posizioni archiviate non contano come "da configurare".
- Un solo punto di accesso al wizard, con indicatore visivo discreto se servono azioni.

