

## Fix disclaimer + inversione pulsanti

### Problema 1: Disclaimer non riappare dopo logout
Lo stato `disclaimerAccepted` viene inizializzato una sola volta al mount del componente. Quando l'utente fa logout e rientra, il componente `AppRoutes` non viene smontato e rimontato, quindi lo stato resta `true` anche se `sessionStorage` e stato pulito. Serve un `useEffect` che resetti lo stato quando cambia l'utente.

### Problema 2: Ordine pulsanti
Il pulsante "Non accetto" deve apparire prima (sopra) del pulsante "Confermo".

### Modifiche

**1. `src/App.tsx`**
- Aggiungere un `useEffect` che osserva `user`: quando `user` diventa non-null (nuovo login), rileggere `sessionStorage` e resettare `disclaimerAccepted` a `false` se il flag non e presente.

```typescript
useEffect(() => {
  if (user) {
    const accepted = sessionStorage.getItem('disclaimerAccepted') === 'true';
    setDisclaimerAccepted(accepted);
  }
}, [user]);
```

**2. `src/components/auth/DisclaimerDialog.tsx`**
- Invertire l'ordine dei due pulsanti nel footer: prima il pulsante "Non accetto" (discreto), poi il pulsante "Confermo" (principale).

