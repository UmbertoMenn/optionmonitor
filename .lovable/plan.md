
## Fix: la quota parte di azioni deve essere gestibile dentro qualunque strategia

### Diagnosi corretta

Hai ragione: il bug non è “strategia con solo stock”.  
Il bug vero è questo:

```text
lo stock può essere splittato nel pool disponibile
ma non viene trattato bene quando entra / esce / viene ripristinato dentro una strategia
```

Ho verificato il codice e il backend:

- il backend salva già `linked_stock_slot_ids`, quindi il problema non è il database
- nel wizard lo split delle azioni esiste, ma oggi è pensato quasi solo per il pool libero
- la pagina Derivati e il restore non usano in modo coerente gli slot salvati

### Perché oggi si rompe

1. `StrategyConfigWizard` mostra forbici/merge solo sulle **posizioni disponibili**, non sulle azioni già dentro una strategia.  
   Quindi se una strategia contiene lo stock intero da 200, lì non puoi davvero trasformarlo in 2 slot da 100.

2. `restoreFromConfigs` auto-splitta lo stock solo se la config salva già un `__slot_N`.  
   Se una config vecchia o generata male ha solo `linked_stock_id`, si riapre con lo stock intero e resti bloccato.

3. `categorizeDerivatives` non usa davvero `linked_stock_slot_ids` per materializzare la quota stock in pagina: prende `linked_stock_id` o il titolo intero trovato via matching.  
   Quindi anche se hai salvato 100 azioni, la pagina può tornare a ragionare come se fossero 200.

4. Le config con `position_signatures = []` vengono saltate, quindi le strategie stock-only o quasi-stock-only non sono affidabili.

### Cosa implementerò

#### 1) Wizard: split/rejoin anche dentro la strategia
File: `src/components/derivatives/StrategyConfigWizard.tsx`

- aggiungere la stessa logica di split/rejoin anche ai badge dentro `strategy.positions`
- se una strategia contiene uno stock intero da 200:
  - click forbici sul badge della strategia
  - il badge viene sostituito con gli slot `__slot_0`, `__slot_1`
- così puoi:
  - lasciare 1 slot da 100 nella strategia
  - rimuovere l’altro slot e riportarlo nel pool
  - aggiungerlo a un’altra strategia con `+1`

Questo è il fix chiave: la quota parte stock deve essere manipolabile **dentro** la strategia, non solo prima.

#### 2) Unificare la generazione degli slot
File: `src/components/derivatives/StrategyConfigWizard.tsx`

- estrarre una helper condivisa per generare slot stock/opzioni
- usare la stessa helper per:
  - pool disponibile
  - restore da config
  - split dentro strategia
  - rejoin

Così evitiamo che pool e strategia producano ID diversi o comportamenti diversi.

#### 3) Save/restore: gli slot devono restare gli slot
File: `src/components/derivatives/StrategyConfigWizard.tsx`

- salvare sempre `linked_stock_slot_ids` quando nella strategia ci sono slot
- mantenere `linked_stock_id` solo come fallback legacy
- nel restore:
  - priorità assoluta agli `linked_stock_slot_ids`
  - fallback a `linked_stock_id` solo se gli slot non esistono
- se una config legacy si riapre con stock intero, da quel momento il badge dentro strategia sarà splittabile

#### 4) Pagina Derivati: usare davvero gli slot salvati
File: `src/lib/derivativeStrategies.ts`

- nel resolver config-driven, risolvere lo stock da `linked_stock_slot_ids`
- costruire la quota stock reale della strategia con la somma degli slot salvati
- usare `linked_stock_id` solo se non ci sono slot
- permettere anche config con:
  - `position_signatures = []`
  - ma `linked_stock_slot_ids.length > 0`

Questo evita che una strategia da 100 azioni torni a essere mostrata come 200.

#### 5) Riconciliazione: stessa UX del wizard
File: `src/components/derivatives/StrategyReconciliationDialog.tsx`

- portare lo stesso split/rejoin dentro `strategy.positions`
- usare la stessa helper di slot generation
- mantenere save/restore coerenti col wizard principale

### Risultato atteso

```text
200 azioni GOOGLE
→ split in 100 + 100
→ posso metterne 100 in una strategia esistente
→ posso creare una nuova strategia con l’altro 100
→ salvo
→ riapro
→ trovo ancora 100/100, non 200/0
```

### Dettagli tecnici

- Nessuna migrazione database necessaria
- Il backend è già pronto: `linked_stock_slot_ids` esiste e viene salvato
- I file da toccare sono:
  - `src/components/derivatives/StrategyConfigWizard.tsx`
  - `src/lib/derivativeStrategies.ts`
  - `src/components/derivatives/StrategyReconciliationDialog.tsx`

### Verifiche da fare dopo il fix

1. Caso misto:
   - 200 azioni + derivati
   - split dello stock dentro una strategia esistente
   - lasciare 100 nella prima, spostare 100 nella seconda

2. Caso nuova strategia:
   - creare strategia nuova con solo 1 slot da 100

3. Caso restore:
   - salva, chiudi, riapri wizard
   - gli slot restano separati

4. Caso pagina Derivati:
   - la card deve riflettere la quota stock salvata, non lo stock intero

