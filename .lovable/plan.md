

## Redesign completo: Wizard Configurazione Strategie Derivati

### Problemi attuali
1. Il wizard raggruppa automaticamente per sottostante — l'utente non può separare/aggregare posizioni diverse (es. LEAP CALL non deve stare con Covered Call)
2. Solo dropdown hardcoded senza suggerimento strategia detected
3. Se nessuna configurazione è salvata, la pagina mostra comunque la categorizzazione automatica invece di essere vuota
4. Non è possibile fare drag & drop per comporre le strategie

### Nuovo comportamento

**Pagina Derivati senza configurazione salvata**: vuota, con invito a configurare le strategie tramite il wizard.

**Wizard ridisegnato**:
- **Colonna sinistra**: pool di tutte le posizioni disponibili (opzioni + azioni), ognuna come chip draggable con info (tipo, strike, scadenza, quantità, V/A)
- **Colonna destra**: strategie create dall'utente — box vuoti dove l'utente trascina le posizioni per comporle
- **Bottone "Aggiungi Strategia"**: crea un nuovo box strategia vuoto con dropdown per il tipo
- **Auto-detect**: quando si trascinano posizioni in un box, il sistema suggerisce automaticamente il tipo di strategia (es. "Sembra un Iron Condor") con badge colorato, ma l'utente può cambiare
- **Suggerimento iniziale**: bottone "Auto-classifica" che pre-popola i box usando la logica di `suggestStrategyType` esistente, ma l'utente può modificare tutto
- Checkbox "Sintetica" disponibile per CC/De-Risking CC

### Implementazione tecnica

**Niente drag & drop nativo** (troppo complesso, problemi mobile). Approccio alternativo più semplice e robusto:

- Ogni posizione nel pool ha un checkbox per selezionarla
- Bottone "Crea Strategia con selezionate" → sposta le posizioni selezionate in un nuovo gruppo strategia
- Dentro ogni gruppo strategia, bottone per rimuovere una posizione (torna nel pool)
- Dropdown tipo strategia per ogni gruppo
- Badge "Suggerito: Iron Condor" calcolato automaticamente dalle posizioni nel gruppo

### Struttura dati nel wizard

```typescript
interface WizardStrategy {
  id: string; // temp ID
  positions: Position[]; // opzioni + eventuali azioni
  strategyType: string;
  isSynthetic: boolean;
  suggestedType: string; // auto-detected
}
```

### Logica pagina Derivati

```text
if (!hasConfigurations && derivatives.length > 0):
  → Mostra messaggio "Configura le strategie derivati" con bottone wizard
  → NON mostrare categorizzazione automatica

if (hasConfigurations):
  → Applica configurazioni salvate (Step 0.5 esistente)
  → Mostra sezioni categorizzate
  → Bottone "Riconfigura" sempre visibile

if (nuove posizioni non coperte da config):
  → Banner "Nuove posizioni trovate" con bottone per aprire wizard parziale
```

### File da modificare

1. **`src/components/derivatives/StrategyConfigWizard.tsx`** — Riscrittura completa:
   - Pool posizioni con multi-select
   - Gruppi strategia creati dall'utente
   - Auto-detect tipo per ogni gruppo
   - Bottone "Auto-classifica tutto"

2. **`src/pages/Derivatives.tsx`** — Aggiungere:
   - Early return se `!hasConfigurations` → mostra solo bottone "Configura Strategie"
   - Logica rilevamento nuove posizioni non coperte
   - Banner per wizard parziale

3. **`src/hooks/useStrategyConfigurations.ts`** — Invariato (già corretto)

4. **`src/lib/derivativeStrategies.ts`** — Invariato (Step 0.5 già implementato)

### UX flow

```text
Primo accesso a Derivati (nessuna config):
  → Pagina quasi vuota: "Configura le strategie derivati per visualizzare i dati"
  → Bottone apre Wizard
  
Wizard:
  → POOL: tutte opzioni + azioni elencate
  → Utente seleziona posizioni → "Crea Strategia"
  → Nuovo box appare con posizioni, auto-detect suggerisce tipo
  → Utente conferma/cambia tipo
  → Ripete fino a esaurire il pool
  → "Salva Configurazione"
  
Upload Excel successivo:
  → Se stesse posizioni → tutto invariato
  → Se nuove posizioni → banner + wizard parziale solo per le nuove
```

