## Problema

Nelle holdings consolidate, il valore di NBIS cambia con il toggle "Protezioni" anche se NBIS non ha alcuna Long PUT.

## Causa

In `src/lib/sectorExposure.ts` (sezione 1, riga 1018) usiamo `stock.riskEUR` come `stockRiskWithProtection`. Ma `stock.riskEUR` arriva da `riskCalculator.ts:360`:

```
riskOriginal = drccRisk + ccCapRisk + protectedRisk + unprotectedRisk
```

Quindi include anche il cap delle Covered Call e delle DR-CC su shares dirette, non solo l'effetto delle Long PUT. Se NBIS ha una CC ma nessuna PUT, `stock.riskEUR < stockValueEUR` e il toggle (che label/tooltip descrivono come riferito alle sole Long PUT) finisce per modificare il valore.

## Fix

In `src/lib/sectorExposure.ts`, sezione 1 (loop `analysis.stockDetails`, righe ~1016‑1035), calcolare `stockRiskWithProtection` in modo isolato dalle sole Long PUT:

- Se `!stock.hasProtection` → `stockRiskWithProtection = stockValueEUR` (identico a `stockRisk`).
- Se `stock.hasProtection` → `putSavingsEUR = min(protectionContracts*100, stockQuantity) * max(0, stockPrice - protectionStrike) / exchangeRate`, e `stockRiskWithProtection = stockValueEUR - putSavingsEUR`.

Aggiornare di conseguenza anche `sources[].exposure` e `stockDetails[].valueWithProtection` per usare il nuovo valore.

## Risultato

- Il toggle "Protezioni" agisce solo sulle Long PUT, coerente con label e tooltip.
- NBIS (e ogni altro titolo senza PUT) mostra lo stesso valore con toggle ON/OFF.
- L'effetto cap di CC/DR-CC resta visibile nelle relative categorie (CC, sintetiche, naked, ecc.), non viene doppio-contato sullo stock diretto.

## File toccati

- `src/lib/sectorExposure.ts` (solo il blocco di sezione 1, ~15 righe). Nessuna modifica a `riskCalculator.ts`, alla UI o ad altre categorie.
