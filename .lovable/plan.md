

## Semplificare la Calcolatrice Iron Condor e Mostrare GP Salvato nella Riga

### Problema

La calcolatrice Iron Condor mostra rendimenti percentuali e valore unitario (per azione) che non hanno senso per questa strategia. Serve solo il **gain potenziale lordo** (grossPremium). Inoltre il valore salvato deve apparire nella riga Iron Condor accanto al GP calcolato dal portafoglio.

### Modifiche

**1. `src/components/derivatives/CallPremiumCalculatorDialog.tsx`**

Per Iron Condor:
- Il valore principale diventa `metrics.grossPremium` (lordo, non unitario) al posto di `metrics.netPerShare`
- Rimuovere la sezione "Rendimento" e "Annualizzato" (nascondere il grid con le percentuali)
- Rimuovere la riga "su N contratti (N azioni)"
- Nel `handleSave`, salvare `net_per_share` = `metrics.grossPremium` (riuso del campo DB per conservare il gain potenziale lordo)

**2. `src/pages/Derivatives.tsx` -- IronCondorRow**

- Passare `getPremiumByTickerAndSymbol` come prop a `IronCondorRow`
- Leggere il valore salvato con `getPremiumByTickerAndSymbol(ticker, optionSymbol)`
- Nella colonna GP esistente (Col 9), se esiste un valore salvato dalla calcolatrice, mostrare quello al posto del GP calcolato dal portafoglio (PMC). Il tooltip indichera' "Gain Potenziale (da calcolatrice ordini)"

### Dettaglio tecnico

| File | Modifica |
|---|---|
| `CallPremiumCalculatorDialog.tsx` | Per `iron_condor`: mostrare `grossPremium` come valore principale, nascondere percentuali e "su N contratti", salvare `grossPremium` nel campo `net_per_share` |
| `Derivatives.tsx` | Passare `getPremiumByTickerAndSymbol` a `IronCondorRow`, leggere il GP salvato e mostrarlo nella colonna GP se presente |

