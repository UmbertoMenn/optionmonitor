

## Piano: Splitting Contratti Opzioni + Fix Persistenza Configurazioni

### Problema 1: Splitting Contratti Opzioni
Attualmente il Wizard suddivide solo le azioni con quantità ≥ 200 in slot da 100. I contratti di opzioni con quantità > 1 (es. -3 CALL) **non vengono suddivisi** e devono essere assegnati in blocco a una sola strategia.

**Soluzione**: Estendere la logica di splitting virtuale anche ai derivati. Se un'opzione ha `|quantity| > 1`, creare N slot virtuali da 1 contratto ciascuno (es. `-3 CALL AAPL 250` → 3 posizioni virtuali `-1 CALL AAPL 250`), permettendo di assegnarli a strategie diverse.

### Problema 2: Configurazioni non persistenti
Il flusso di salvataggio in `useStrategyConfigurations.ts` → `upsertBatchMutation` **cancella tutte le configurazioni del portfolio** prima di reinserire quelle nuove. Questo è corretto quando si usa il wizard completo, ma il problema è che il wizard si **ri-inizializza** ogni volta che `open` cambia, e `restoreFromConfigs` dipende da `existingConfigs` e `allAvailable` — se questi cambiano reattivamente (es. dopo un aggiornamento prezzi o una query invalidata), il wizard potrebbe resettarsi. Inoltre, dopo il salvataggio, la `queryKey` viene invalidata, il che ri-triggera il fetch delle configurazioni aggiornate.

Devo investigare meglio il caso specifico dell'utente: potrebbe essere che il `refreshStrategyCacheForPortfolio` (che gira dopo upload Excel) sovrascriva la strategy_cache (ma non le configurations). Oppure che l'auto-classificazione via reconciliation sovrascriva le configs salvate manualmente.

### Modifiche previste

**File: `src/components/derivatives/StrategyConfigWizard.tsx`**
1. Nella sezione `allAvailable` (riga 364-390), aggiungere splitting dei derivati con `|quantity| > 1` in slot virtuali da 1 contratto, con ID formato `{originalId}__opt_slot_{n}`
2. Aggiornare `positionLabel()` per mostrare `[slot N/M]` anche per le opzioni splittate
3. Aggiornare `buildSignatures()` per gestire correttamente la quantità degli slot virtuali (sign da 1 o -1, quantity sempre ±1)

**File: `src/components/derivatives/StrategyReconciliationDialog.tsx`**
4. Applicare lo stesso splitting dei derivati nel dialog di riconciliazione

**File: `src/hooks/useStrategyConfigurations.ts`**
5. Nella `upsertBatchMutation`, gestire le signatures duplicate: quando un contratto da 3 viene splittato, le firme risultanti saranno identiche (stesso strike/expiry/type) ma associate a strategie diverse. Aggiungere un campo `quantity` alle signatures per distinguere quanti contratti sono assegnati.

**File: `src/hooks/useStrategyConfigurations.ts` — Fix persistenza**
6. Aggiungere log dettagliato nel flusso di salvataggio per diagnosticare il problema
7. Verificare che `restoreFromConfigs` nel wizard usi uno snapshot stabile delle configs (non reattivo)

### Modifica allo schema delle signatures
Le `position_signatures` attualmente salvano solo `quantity_sign` (1 o -1). Per supportare lo splitting, servono anche `quantity_abs` (numero contratti assegnati), così che la riconciliazione possa matchare correttamente:

```typescript
interface PositionSignature {
  option_type: string;
  strike: number;
  expiry: string;
  quantity_sign: number;    // 1 o -1
  quantity_abs?: number;    // nuovo: quanti contratti (default 1)
}
```

Nessuna migrazione DB necessaria: il campo è già JSONB, il nuovo campo è opzionale con default implicito 1.

### Riepilogo file modificati
- `src/components/derivatives/StrategyConfigWizard.tsx` — splitting opzioni + label aggiornate
- `src/components/derivatives/StrategyReconciliationDialog.tsx` — splitting opzioni nel reconciliation
- `src/hooks/useStrategyConfigurations.ts` — `quantity_abs` nelle signatures + fix stabilità
- `src/lib/strategyReconciliation.ts` — matching con `quantity_abs`

