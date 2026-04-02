

## Fix: "Posizioni da monitorare" e Alert Settings sempre visibili

### Problema

Il componente `DerivativesSummaryCard` restituisce `null` quando nessuna posizione richiede monitoraggio (`hasContent === false`, riga 542). Questo nasconde **entrambe** le card:
1. **Posizioni da monitorare** — correttamente vuota se non ci sono criticità
2. **Avvisi recenti (24h)** — che contiene anche il pulsante per accedere ad Alert Settings

Risultato: quando tutte le posizioni sono sane, l'utente perde l'accesso agli avvisi recenti e alle impostazioni degli alert.

### Correzione

#### File: `src/components/derivatives/DerivativesSummaryCard.tsx`

1. **Separare la visibilità delle due card**
   - La card "Posizioni da monitorare" può continuare a sparire quando `hasContent === false`
   - La card "Avvisi recenti (24h)" deve essere **sempre visibile** quando ci sono configurazioni attive, indipendentemente dallo stato delle posizioni

2. **Rimuovere il `return null` globale**
   - Invece di fare `if (!hasContent) return null`, rendere condizionale solo la card di sinistra
   - Se `hasContent` è false, mostrare solo la card "Avvisi recenti" a larghezza piena (o con un messaggio "Tutto OK" nella card di sinistra)

3. **Approccio specifico:**
   - Se `hasContent` è `true`: layout a 2 colonne come oggi (monitoring + avvisi)
   - Se `hasContent` è `false`: mostrare la card "Posizioni da monitorare" con messaggio "Nessuna criticità" + la card "Avvisi recenti" normalmente

### Risultato atteso
- La card "Avvisi recenti (24h)" con il pulsante Settings è sempre accessibile
- La card "Posizioni da monitorare" mostra un messaggio rassicurante quando non ci sono criticità
- L'utente può sempre accedere alle impostazioni degli alert

