
## Modifiche al Disclaimer Dialog

### 1. `src/components/auth/DisclaimerDialog.tsx`
- Cambiare il titolo da "Informativa" a "Disclaimer"
- Aggiungere una prop `onDecline` per gestire il rifiuto
- Aggiungere sotto il pulsante principale un pulsante secondario "Non accetto e non voglio proseguire", stilizzato in modo discreto (testo piccolo, variante ghost/link, colore muted)
- Il pulsante di rifiuto chiamera `onDecline` che effettuera il logout

### 2. `src/App.tsx`
- Passare una nuova prop `onDecline` al `DisclaimerDialog` che chiama `signOut()` dal contesto Auth
- Questo riporta l'utente alla schermata di login

### 3. `src/components/auth/AuthForm.tsx`
- Spostare il toast "Benvenuto!" dal login handler: rimuoverlo da `handleLogin`
- Il toast verra invece mostrato dopo l'accettazione del disclaimer

### 4. `src/App.tsx` (handleAcceptDisclaimer)
- Aggiungere `toast.success('Benvenuto!')` dentro `handleAcceptDisclaimer` cosi che il messaggio appaia solo dopo aver accettato il disclaimer

### Flusso risultante
1. Utente fa login -> nessun toast
2. Appare il Disclaimer (titolo "Disclaimer")
3. Se clicca "Confermo ed accetto quanto sopra" -> toast "Benvenuto!" + accesso all'app
4. Se clicca "Non accetto e non voglio proseguire" -> logout -> torna al login
