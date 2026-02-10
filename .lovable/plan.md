
## Fix: Permettere all'admin di copiare un portafoglio su se stesso

### Problema
Il pulsante "Copia su Utente" nei portafogli dell'admin e disabilitato quando non ci sono altri utenti (`disabled={otherUsers.length === 0}`). Ma il dropdown del dialog di copia (`allUsersForCopy`) include gia l'admin stesso, quindi basta rimuovere quella condizione.

Per i portafogli degli altri utenti il pulsante "Copia" e gia sempre abilitato (nessuna prop `disabled`), quindi funziona correttamente.

### Soluzione

**File: `src/components/admin/PortfolioManager.tsx`** (1 riga)

Rimuovere la prop `disabled` dal pulsante "Copia su Utente" alla riga 128:

```diff
 <Button
   variant="outline"
   size="sm"
   onClick={() => handleCopyClick(portfolio)}
-  disabled={otherUsers.length === 0}
 >
```

Nessuna altra modifica necessaria: il dialog mostra gia tutti gli utenti (admin incluso) nel dropdown.
