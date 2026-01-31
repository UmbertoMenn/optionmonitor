
## Piano: Aggiornamento della Logica di Calcolo Netting con Gestione Cambio Valuta

### Obiettivo
Modificare il calcolo del netting per convertire correttamente i valori dei derivati dalla valuta di negoziazione all'Euro, utilizzando il tasso di cambio di ogni singola opzione.

---

### Formula Aggiornata

**Netting Totale:**
```
Netting Totale = Valore Assets + Σ [(prezzo × quantità × 100) / cambio]
```

Dove:
- **Opzioni comprate** (quantità > 0): si vende → si aggiunge il valore convertito
- **Opzioni vendute** (quantità < 0): si riacquista → si sottrae il valore convertito
- **Cambio**: `exchange_rate` dell'opzione (default 1 se non disponibile o valuta EUR)

**Netting ex CC:**
```
Netting ex CC = Valore Assets + Σ [(prezzo × quantità × 100) / cambio] - Σ(ITM CC adjustment)
```

Con la seguente logica per le Covered Call:
- **OTM** (strike ≥ prezzo sottostante): completamente escluse dal calcolo
- **ITM** (strike < prezzo sottostante): si sottrae `(contratti × 100 × (prezzo_titolo - strike)) / cambio`

---

### Modifiche Tecniche

**File: `src/hooks/useDerivativeNetting.ts`**

1. **Helper per il cambio**: Creare una funzione che restituisca il tasso di cambio effettivo
   - Se `exchange_rate` è presente e valido → usa quel valore
   - Se la valuta è EUR → usa 1
   - Altrimenti → usa 1 come fallback

2. **Netting Totale**: Dividere ogni valore di netting per il cambio dell'opzione
   ```
   nettingValue = (price × quantity × multiplier) / exchangeRate
   ```

3. **Netting ex CC**: 
   - Per derivati non-covered-call: stessa logica del netting totale
   - Per covered call ITM: `(contracts × 100 × (underlyingPrice - strike)) / exchangeRate`
   - Per covered call OTM: nessun impatto

---

### Considerazioni

- Le opzioni su titoli americani (USD) tipicamente hanno cambio ~1.04-1.05
- Le opzioni su titoli europei (EUR) dovrebbero avere cambio 1 o null
- Se il cambio non è disponibile, si assume 1 (nessuna conversione)
- Il prezzo del titolo sottostante per le covered call ITM potrebbe essere in valuta diversa dall'opzione (stesso cambio presumibile)
