
# Piano: Correzione Bug Selezione Portfolio Admin

## Problema Identificato

Quando l'admin seleziona il portfolio di un altro utente dalla sezione admin:

1. `setAdminViewPortfolio(portfolioId, ownerUserId)` viene chiamato correttamente
2. Imposta `selectedId` = portfolio dell'altro utente
3. Imposta `adminViewUserId` = ID del proprietario
4. **BUG**: L'useEffect di auto-selezione (righe 92-128) viene eseguito
5. Controlla se `selectedId` esiste in `portfolios` (che contiene SOLO i portfolio dell'admin!)
6. Siccome non lo trova, applica il **fallback** al primo portfolio dell'admin

## Soluzione

Modificare l'useEffect di auto-selezione per **saltare completamente** quando siamo in admin mode (`adminViewUserId !== null`).

### Modifica in `src/contexts/PortfolioContext.tsx`

Aggiungere un check all'inizio dell'useEffect per uscire immediatamente se siamo in admin mode:

```typescript
// Auto-selezione robusta - PRIORITÀ: selectedId attuale > localStorage > fallback
useEffect(() => {
  if (portfoliosQuery.isLoading || portfoliosQuery.isFetching) return;
  if (portfolios.length === 0) return;
  
  // NEW: Skip auto-selection when in admin mode (viewing another user's portfolio)
  if (adminViewUserId !== null && adminViewUserId !== user?.id) {
    if (!hasInitialized) setHasInitialized(true);
    return;
  }
  
  // Se è selezionato AGGREGATED, non resettare
  if (selectedId === AGGREGATED_PORTFOLIO_ID) {
    if (!hasInitialized) setHasInitialized(true);
    return;
  }
  
  // ... resto della logica esistente
}, [portfolios, portfoliosQuery.isLoading, portfoliosQuery.isFetching, selectedId, hasInitialized, adminViewUserId, user?.id]);
```

### Dipendenze

Aggiungere `adminViewUserId` e `user?.id` alle dipendenze dell'useEffect per evitare warning e garantire la corretta ri-esecuzione.

---

## File da Modificare

| File | Modifica |
|------|----------|
| `src/contexts/PortfolioContext.tsx` | Aggiungere check `isAdminMode` nell'useEffect di auto-selezione (riga 93-94) |

---

## Verifica Post-Fix

1. Andare nel pannello Admin → Tab "Portafogli"
2. Espandere un utente e cliccare su un suo portfolio
3. Verificare che la Dashboard mostri quel portfolio (non quello dell'admin)
4. Il selettore dovrebbe mostrare il bordo giallo "admin mode" con il nome del portfolio selezionato
