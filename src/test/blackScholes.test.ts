import { describe, it, expect } from 'vitest';
import { cdf, bsPrice, bsDelta, impliedVolatility } from '@/lib/blackScholes';
import { mertonPrice } from '@/lib/optionEdge';

/**
 * Regressione contro valori noti di letteratura.
 * Nata dal bug della cdf (coefficenti erf con exp(−x²/2) senza riscalare per √2,
 * errore fino a ±0.037): i test precedenti confrontavano la libreria solo con sé
 * stessa e non lo intercettavano.
 */
describe('cdf — valori tabulati della normale standard', () => {
  const known: [number, number][] = [
    [0, 0.5],
    [0.5, 0.691462],
    [1, 0.841345],
    [1.645, 0.950015],
    [1.96, 0.975002],
    [2, 0.977250],
    [-1, 0.158655],
    [-1.96, 0.024998],
    [-3, 0.001350],
  ];
  it('coincide con le tavole entro 1e-4', () => {
    for (const [x, v] of known) expect(cdf(x)).toBeCloseTo(v, 4);
  });
  it('simmetria: N(x) + N(−x) = 1', () => {
    for (const x of [0.3, 1.1, 2.4]) expect(cdf(x) + cdf(-x)).toBeCloseTo(1, 10);
  });
});

describe('bsPrice — benchmark Hull (Options, Futures and Other Derivatives)', () => {
  // Esempio classico: S=42, K=40, r=10%, σ=20%, T=0.5 → C≈4.76, P≈0.81
  it('call europea S42 K40 r10% σ20% T0.5 ≈ 4.76', () => {
    expect(bsPrice(42, 40, 0.5, 0.10, 0.20, 'call')).toBeCloseTo(4.76, 2);
  });
  it('put europea S42 K40 r10% σ20% T0.5 ≈ 0.81', () => {
    expect(bsPrice(42, 40, 0.5, 0.10, 0.20, 'put')).toBeCloseTo(0.81, 2);
  });
  it('put-call parity: C − P = S − K·e^(−rT)', () => {
    const c = bsPrice(100, 95, 0.3, 0.04, 0.45, 'call');
    const p = bsPrice(100, 95, 0.3, 0.04, 0.45, 'put');
    expect(c - p).toBeCloseTo(100 - 95 * Math.exp(-0.04 * 0.3), 8);
  });
  it('delta call ATM vicino a 0.5 (leggermente sopra per il drift)', () => {
    const d = bsDelta(100, 100, 0.25, 0.04, 0.3, 'call');
    expect(d).toBeGreaterThan(0.5);
    expect(d).toBeLessThan(0.6);
  });
  it('IV round-trip sul benchmark Hull', () => {
    const c = bsPrice(42, 40, 0.5, 0.10, 0.20, 'call');
    expect(impliedVolatility(c, 42, 40, 0.5, 0.10, 'call')).toBeCloseTo(0.20, 3);
  });
  it('mertonPrice con dividendi — benchmark Hull cap. 17: S930 K900 r8% q3% σ20% T=2/12 call ≈ 51.83', () => {
    expect(mertonPrice(930, 900, 2 / 12, 0.08, 0.03, 0.20, 'CALL')).toBeCloseTo(51.83, 1);
  });
});
