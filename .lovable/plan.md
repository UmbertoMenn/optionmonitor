

## Header unificato mobile per tutte le pagine

### Obiettivo
Applicare lo stesso pattern dell'header mobile della Dashboard (logo IronCondor + "Option Tech" + pulsante "Indice") alle pagine Strategie Derivati, Risk Analyzer e Admin Panel.

### Pattern da replicare
Su mobile (sotto `sm`): logo IronCondor, titolo "Option Tech", e un singolo pulsante "Indice" con dropdown contenente: PortfolioSelector, link di navigazione (Dashboard, Derivati, Risk Analyzer, Admin), e Esci.

Su desktop (`sm+`): il layout attuale di ciascuna pagina resta invariato, tranne la sostituzione dell'icona e del titolo con IronCondor + "Option Tech".

### Modifiche per file

**1. `src/pages/Derivatives.tsx` (righe 191-257)**

- Sostituire l'icona `TrendingUp` nell'header con `IronCondorIcon`
- Cambiare titolo da "Strategie Derivati" a "Option Tech"
- Spostare il sottotitolo e info tooltip come testo secondario
- Aggiungere imports: `IronCondorIcon`, `DropdownMenu*`, `Menu`, `useNavigate`
- Mobile (`sm:hidden`): mostrare solo logo + "Option Tech" + pulsante "Indice" con dropdown contenente:
  - PortfolioSelector
  - Dashboard (naviga a `/`)
  - Risk Analyzer (naviga a `/risk-analyzer`)
  - Admin (se `isAdmin`, naviga a `/admin`)
  - Separatore + Esci
- Desktop (`hidden sm:flex`): mantenere la barra pulsanti attuale (Dashboard, Risk Analyzer, Admin, Esci) + PortfolioSelector nel titolo

**2. `src/pages/RiskAnalyzer.tsx` (righe 126-167)**

- Sostituire l'icona `ShieldAlert` nell'header con `IronCondorIcon`
- Cambiare titolo da "Risk Analyzer" a "Option Tech"
- Aggiungere imports: `IronCondorIcon`, `DropdownMenu*`, `Menu`, `Settings`, `useNavigate`
- Mobile (`sm:hidden`): logo + "Option Tech" + "Indice" dropdown con:
  - PortfolioSelector
  - Dashboard (naviga a `/`)
  - Strategie Derivati (naviga a `/derivatives`)
  - Admin (se `isAdmin`, naviga a `/admin`)
  - Separatore + Esci
- Desktop (`hidden sm:flex`): invariato + PortfolioSelector nel titolo

**3. `src/components/admin/AdminPanel.tsx` (righe 192-213)**

- Sostituire l'icona `Shield` nell'header con `IronCondorIcon`
- Cambiare titolo da "Pannello Admin" a "Option Tech"
- Rimuovere il pulsante freccia indietro (sostituito dal menu Indice su mobile)
- Aggiungere imports: `IronCondorIcon`, `DropdownMenu*`, `Menu`, `TrendingUp`, `ShieldAlert`, `LogOut`, `useNavigate`
- Aggiungere `signOut` e `useNavigate` nel componente
- Mobile (`sm:hidden`): logo + "Option Tech" + "Indice" dropdown con:
  - Dashboard (naviga a `/`)
  - Strategie Derivati (naviga a `/derivatives`)
  - Risk Analyzer (naviga a `/risk-analyzer`)
  - Separatore + Esci
- Desktop (`hidden sm:flex`): mantenere il pulsante "Aggiungi Utente" + pulsanti navigazione (Dashboard, Derivati, Risk, Esci)
- Il pulsante "Aggiungi Utente" su mobile viene incluso nel dropdown come prima voce dopo le voci di navigazione

### Struttura mobile comune a tutte le pagine

```
[IronCondorIcon] Option Tech    [Indice v]
                                    |
                                    +-- Portfolio (PortfolioSelector) *
                                    +-- Dashboard / [pagina corrente]
                                    +-- Strategie Derivati / [altre pagine]
                                    +-- Risk Analyzer / [altre pagine]
                                    +-- Admin (se admin) *
                                    +-- Aggiungi Utente (solo Admin page) *
                                    +-- ---
                                    +-- Esci
```

*PortfolioSelector non presente in Admin. La voce della pagina corrente non viene mostrata (es: su Derivatives non si mostra "Strategie Derivati").

