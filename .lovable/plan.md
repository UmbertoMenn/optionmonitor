

## Accesso rapido ai portafogli clienti dal selettore

### Obiettivo

Aggiungere una sezione "Portafogli Clienti" direttamente nel dropdown del selettore portafoglio, visibile solo per gli admin. Questo permette di passare al portafoglio di un cliente con un click, senza navigare al pannello admin.

### Approccio

Utilizzare l'hook `useAdminPortfolios` (gia esistente) nel componente `PortfolioSelector` per ottenere i portafogli degli altri utenti, raggruppati per cliente. Il dropdown mostrera prima i portafogli dell'admin, poi un separatore, e infine i portafogli dei clienti raggruppati per nome/email.

### Modifiche

**File: `src/components/portfolio/PortfolioSelector.tsx`**

1. **Import** di `useAdminPortfolios` e del metodo `setAdminViewPortfolio` dal context
2. **Sezione clienti nel dropdown**: dopo i portafogli dell'admin e il pulsante "Nuovo Portfolio", aggiungere:
   - Un separatore con label "Portafogli Clienti"
   - Per ogni cliente (otherUsers da `useAdminPortfolios`): un sotto-header con nome/email del cliente, seguito dai suoi portafogli come voci selezionabili
   - Ogni voce mostra nome portafoglio e valore totale (se disponibile)
   - Click su un portafoglio cliente chiama `setAdminViewPortfolio(portfolioId, ownerUserId)` per entrare in modalita admin
3. **Scroll**: aggiungere `max-h-[400px] overflow-y-auto` al `DropdownMenuContent` per gestire liste lunghe
4. **Check visivo**: i portafogli dei clienti hanno un'icona utente per distinguerli dai propri

### Layout del dropdown (solo admin)

```text
[v] Aggregato - Tutti gli Utenti
---
[ ] Mio Portfolio 1          €XX.XXX
[v] Mio Portfolio 2          €XX.XXX
---
+ Nuovo Portfolio
---
PORTAFOGLI CLIENTI
  Mario Rossi (mario@...)
    [ ] Portfolio Trading     €XX.XXX
    [ ] Portfolio Long Term   €XX.XXX
  Anna Bianchi (anna@...)
    [ ] Portfolio Principale  €XX.XXX
```

### Dettagli tecnici

- `useAdminPortfolios` viene chiamato solo se `isAdmin` e' true (la query interna ha gia `enabled: isAdmin`)
- `setAdminViewPortfolio` e' gia esposto dal `PortfolioContext` e gestisce l'invalidazione delle query
- I portafogli clienti usano `DropdownMenuLabel` per i nomi utente (non cliccabili) e `DropdownMenuItem` per i singoli portafogli
- Nessuna modifica al database o al context necessaria

### Riepilogo

| File | Modifica |
|---|---|
| `src/components/portfolio/PortfolioSelector.tsx` | Aggiunta sezione "Portafogli Clienti" nel dropdown con dati da `useAdminPortfolios` |

