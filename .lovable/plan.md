

## Ristrutturazione header Dashboard

### Modifiche richieste

1. **Rinominare "Portfolio Monitor" in "Option Tech"** (mobile e desktop)
2. **Sostituire l'icona TrendingUp con IronCondorIcon** (il logo dell'Iron Condor gia usato nel login e favicon)
3. **Su mobile: header minimale** con solo logo, titolo e un pulsante hamburger "Indice" che apre un menu con tutte le voci (Portfolio, Salva Snapshot, Strategie Derivati, Risk Analyzer, Admin, Esci)
4. **Su desktop: nessun cambiamento funzionale**, resta la barra con tutti i pulsanti visibili

### Dettaglio tecnico

**File: `src/components/dashboard/Dashboard.tsx`**

**Imports da aggiungere:**
- `IronCondorIcon` da `@/components/ui/iron-condor-icon`
- `DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator` da `@/components/ui/dropdown-menu`
- `Menu` da `lucide-react` (icona hamburger)

**Imports da rimuovere:**
- `TrendingUp` non piu necessario nell'header (ma resta usato nel pulsante "Strategie Derivati" desktop, quindi va mantenuto)

**Struttura header risultante:**

```
MOBILE (< sm):
[IronCondorIcon] Option Tech    [Indice v]
                                    |
                                    +-- Seleziona Portfolio (apre PortfolioSelector)
                                    +-- Salva Snapshot
                                    +-- Strategie Derivati
                                    +-- Risk Analyzer
                                    +-- Admin (se admin)
                                    +-- ---
                                    +-- Esci

DESKTOP (>= sm):
[IronCondorIcon] Option Tech   [PortfolioSelector] [Salva] [Derivati] [Risk] [Admin] [Esci]
                 Aggiornato...
```

**Modifiche nel JSX dell'header (righe 152-229):**

1. Sostituire `<TrendingUp className="w-6 h-6 text-primary" />` con `<IronCondorIcon size={24} className="text-primary" />`

2. Cambiare il testo da `Portfolio Monitor` a `Option Tech`

3. Wrappare la barra pulsanti desktop con `hidden sm:flex` per nasconderla su mobile

4. Aggiungere un `DropdownMenu` visibile solo su mobile (`sm:hidden`) con:
   - Trigger: pulsante "Indice" con icona `Menu`
   - Voci del menu:
     - `PortfolioSelector` inline (o link per aprirlo)
     - Salva Snapshot (con la stessa logica onClick)
     - Link a Strategie Derivati (`/derivatives`)
     - Link a Risk Analyzer (`/risk-analyzer`)
     - Link a Admin (`/admin`) -- solo se `isAdmin`
     - Separatore
     - Esci (onClick `signOut`)

5. Il `PortfolioSelector` su mobile verra incluso come prima voce del dropdown. Se il componente non si adatta bene dentro un `DropdownMenuItem`, verra messo come elemento separato sopra il menu, oppure il dropdown includera un link/azione che apre il selettore.

### File coinvolti
- `src/components/dashboard/Dashboard.tsx` -- unico file da modificare
