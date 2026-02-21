

## Fix: Cascata infinita di operazioni sulla stessa barra

### Causa del bug

Nel loop principale (riga 173):
```text
for (const leg of activeLegs) { ... }
```

Le funzioni di aggiustamento (`executeApproachRule`, `executeProfitRule`, `handleExpiryDoNothing`, `sellNewCallAfterExpiry`) fanno `activeLegs.push(newLeg)` -- aggiungendo la nuova leg **allo stesso array** su cui il `for...of` sta iterando.

Risultato: la nuova leg viene elaborata immediatamente nella stessa barra. Se il suo prezzo BS soddisfa una regola (es. profitto >80%), scatta un altro aggiustamento, che aggiunge un'altra leg, che viene elaborata, e cosi via. Decine di operazioni sulla stessa data.

### Soluzione

All'inizio di ogni barra, prendere uno **snapshot** delle leg da elaborare. Le nuove leg aggiunte durante la barra saranno elaborate solo dalla barra successiva.

### Modifica in `src/lib/backtestEngine.ts`

Riga 173, sostituire:
```text
for (const leg of activeLegs) {
```
con:
```text
const legsSnapshot = activeLegs.filter(l => l.active);
for (const leg of legsSnapshot) {
```

Questo e sufficiente perche:
- `legsSnapshot` e un array separato, creato prima del loop
- Le nuove leg aggiunte da `activeLegs.push(newLeg)` non appaiono in `legsSnapshot`
- Dalla barra successiva, il nuovo snapshot includera le leg appena aggiunte

### Perche funziona

- Le leg appena create hanno `entryDate` uguale alla data corrente
- Il loro `T` (tempo a scadenza) e calcolato correttamente solo dalla barra successiva
- Elaborarle immediatamente sulla stessa barra causa prezzi BS incoerenti (il prezzo cambia ad ogni iterazione per via degli aggiustamenti cascata)

### File modificato

| File | Modifica |
|------|----------|
| `src/lib/backtestEngine.ts` | Riga 173: usare `activeLegs.filter(l => l.active)` come snapshot prima del loop |

