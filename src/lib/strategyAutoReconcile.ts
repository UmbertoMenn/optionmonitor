/**
 * Riconciliazione AUTOMATICA delle configurazioni strategia dopo un upload.
 *
 * Prende il diff prodotto da reconcileConfigs (gambe present/missing/new) e
 * lo risolve SENZA intervento manuale. Il dialog resta solo come paracadute
 * in caso di errore di salvataggio.
 *
 *  1. ROLL — una gamba "missing" viene sostituita dalla gamba "new" più
 *     vicina con stesso underlying, stesso option_type e stesso segno
 *     (short→short, long→long). L'accoppiamento avviene per bucket
 *     (underlying, type, sign) ordinando entrambe le liste per strike e
 *     scadenza e appaiandole in sequenza: deterministico e ottimo per il
 *     caso 1-D. Copre anche la "ristrutturazione completa" (es. Iron Condor
 *     richiuso su 4 strike nuovi = 4 roll simultanei).
 *
 *  2. RIDUZIONE/CHIUSURA — una gamba "missing" senza alcuna candidata viene
 *     rimossa dalla config (la strategia si è ridotta). Se TUTTE le gambe
 *     spariscono e la config non ha azioni collegate, la config viene
 *     eliminata (strategia chiusa). Le config con linked_stock (covered
 *     call / de-risking) sopravvivono anche senza gambe opzionarie.
 *
 *  3. GAMBE NUOVE su sottostante già configurato — decision table per
 *     (tipo, segno), sempre risolta:
 *       - put VENDUTA  → append alla config naked_put esistente, oppure
 *                        NUOVA config naked_put (es. sopra una covered call).
 *       - put COMPRATA → covered_call esistente → append + retype a
 *                        derisking_covered_call; derisking esistente →
 *                        append; naked_put esistente → append + retype a
 *                        put_spread (stessa scadenza) o diagonal_put_spread;
 *                        put_spread/diagonal esistente → append;
 *                        altrimenti config 'other'.
 *       - call VENDUTA → append a covered_call/derisking esistente; oppure
 *                        crea covered_call linkata all'azione se presente in
 *                        portafoglio; altrimenti config 'other'.
 *       - call COMPRATA→ append a leap_call esistente o crea leap_call.
 *
 *  4. NUOVO SOTTOSTANTE — le strategie vengono aperte complete di tutte le
 *     gambe, quindi la struttura È classificabile dal pattern:
 *       - solo put vendute                        → naked_put
 *       - put vendute + comprate (no call)        → put_spread se stessa
 *         scadenza, diagonal_put_spread altrimenti
 *       - put V+C e call V+C                      → iron_condor se stessa
 *         scadenza, double_diagonal altrimenti
 *       - solo call comprate                      → leap_call
 *       - call vendute (+ ev. put comprate) con
 *         azione in portafoglio                   → covered_call /
 *                                                   derisking_covered_call
 *       - qualsiasi altra combinazione            → 'other' (comunque
 *         creata: gambe tracciate, etichetta correggibile dal wizard)
 */
import { StrategyConfiguration, PositionSignature, UpsertConfigParams } from '@/hooks/useStrategyConfigurations';
import { ReconciliationItem } from '@/lib/strategyReconciliation';
import { normalizeForMatching, getCanonicalKey } from '@/lib/derivativeStrategies';
import { Position } from '@/types/portfolio';

export interface AutoReconcileResult {
  /** Set completo di config da salvare (full replace). null = nessuna modifica automatica */
  resolvedConfigs: UpsertConfigParams[] | null;
  /** Log leggibile (italiano) delle modifiche applicate, per toast/console */
  changes: string[];
  /** Item non risolvibili automaticamente: unico caso in cui serve il dialog */
  unresolvedItems: ReconciliationItem[];
  hasAutoChanges: boolean;
}

function normalizeUnderlying(text: string): string {
  return getCanonicalKey(text) || normalizeForMatching(text);
}

function expiryToTime(expiry: string): number {
  const t = new Date(expiry).getTime();
  return Number.isFinite(t) ? t : 0;
}

function sigLabel(sig: PositionSignature): string {
  const side = sig.quantity_sign < 0 ? 'V' : 'A';
  const type = (sig.option_type || '?').toUpperCase();
  const qty = (sig.quantity_abs || 1) > 1 ? ` ×${sig.quantity_abs}` : '';
  return `${side} ${type} ${sig.strike} ${sig.expiry}${qty}`;
}

interface MissingEntry {
  configId: string;
  sigIndex: number; // indice nella lista firme della config
  sig: PositionSignature; // quantity_abs = contratti mancanti
}

interface NewEntry {
  positionId: string;
  optionType: string;
  strike: number;
  expiry: string;
  quantitySign: number;
  availableQty: number; // contratti non ancora consumati
}

/** Chiave bucket per l'accoppiamento roll */
function bucketKey(optionType: string, quantitySign: number): string {
  return `${optionType.toLowerCase()}::${quantitySign}`;
}

/** Trova l'azione/ETF in portafoglio corrispondente a un sottostante (id base, senza slot). */
function findStockForUnderlying(underlying: string, allPositions: Position[]): Position | undefined {
  const key = normalizeUnderlying(underlying);
  return allPositions.find(p => {
    if (p.asset_type !== 'stock' && p.asset_type !== 'etf') return false;
    if (/__slot_\d+$/.test(p.id)) return false; // solo posizioni base
    const stockKey = normalizeUnderlying(p.ticker || p.description || '');
    return stockKey.length > 0 && (stockKey === key || stockKey.includes(key) || key.includes(stockKey));
  });
}

interface LegCounts {
  soldPuts: PositionSignature[];
  boughtPuts: PositionSignature[];
  soldCalls: PositionSignature[];
  boughtCalls: PositionSignature[];
}

function countLegs(sigs: PositionSignature[]): LegCounts {
  const c: LegCounts = { soldPuts: [], boughtPuts: [], soldCalls: [], boughtCalls: [] };
  for (const s of sigs) {
    const isPut = (s.option_type || '').toLowerCase() === 'put';
    if (isPut) (s.quantity_sign < 0 ? c.soldPuts : c.boughtPuts).push(s);
    else (s.quantity_sign < 0 ? c.soldCalls : c.boughtCalls).push(s);
  }
  return c;
}

function allSameExpiry(sigs: PositionSignature[]): boolean {
  return new Set(sigs.map(s => s.expiry)).size <= 1;
}

/**
 * Classifica la struttura completa di un sottostante nuovo.
 * Le strategie vengono aperte con tutte le gambe insieme, quindi il pattern
 * delle gambe identifica la strategia. Ritorna anche l'eventuale azione da
 * collegare (covered call / de-risking).
 */
function classifyNewStructure(
  sigs: PositionSignature[],
  underlying: string,
  allPositions: Position[],
): { strategyType: string; linkedStockId: string | null } {
  const { soldPuts, boughtPuts, soldCalls, boughtCalls } = countLegs(sigs);
  const stock = findStockForUnderlying(underlying, allPositions);

  // Solo put vendute → naked put
  if (soldPuts.length > 0 && boughtPuts.length === 0 && soldCalls.length === 0 && boughtCalls.length === 0) {
    return { strategyType: 'naked_put', linkedStockId: null };
  }
  // Put vendute + comprate, nessuna call → put spread (verticale o diagonale)
  if (soldPuts.length > 0 && boughtPuts.length > 0 && soldCalls.length === 0 && boughtCalls.length === 0) {
    return { strategyType: allSameExpiry(sigs) ? 'put_spread' : 'diagonal_put_spread', linkedStockId: null };
  }
  // Quattro ruoli presenti → iron condor / double diagonal
  if (soldPuts.length > 0 && boughtPuts.length > 0 && soldCalls.length > 0 && boughtCalls.length > 0) {
    return { strategyType: allSameExpiry(sigs) ? 'iron_condor' : 'double_diagonal', linkedStockId: null };
  }
  // Solo call comprate → LEAP call
  if (boughtCalls.length > 0 && soldCalls.length === 0 && soldPuts.length === 0 && boughtPuts.length === 0) {
    return { strategyType: 'leap_call', linkedStockId: null };
  }
  // Call vendute con azione in portafoglio → covered call (o de-risking se c'è put comprata)
  if (soldCalls.length > 0 && boughtCalls.length === 0 && soldPuts.length === 0 && stock) {
    return {
      strategyType: boughtPuts.length > 0 ? 'derisking_covered_call' : 'covered_call',
      linkedStockId: stock.id,
    };
  }
  // Combinazione non riconosciuta → 'other' (gambe comunque tracciate)
  return { strategyType: 'other', linkedStockId: null };
}

export function autoReconcileStrategies(
  configs: StrategyConfiguration[],
  items: ReconciliationItem[],
  allPositions: Position[] = [],
): AutoReconcileResult {
  const changes: string[] = [];
  const unresolvedItems: ReconciliationItem[] = [];

  // Config di lavoro: mappa id -> firme mutabili (deep copy)
  const workingSigs = new Map<string, (PositionSignature | null)[]>();
  const configById = new Map<string, StrategyConfiguration>();
  for (const c of configs) {
    configById.set(c.id, c);
    workingSigs.set(
      c.id,
      ((c.position_signatures as unknown as PositionSignature[]) || []).map(s => ({ ...s })),
    );
  }
  const deletedConfigIds = new Set<string>();
  const appendedSigs = new Map<string, PositionSignature[]>(); // configId -> firme aggiunte
  const retypedConfigs = new Map<string, string>(); // configId -> nuovo strategy_type
  const newConfigs: UpsertConfigParams[] = []; // config create ex novo

  // ------------------------------------------------------------------
  // Raggruppa gli item per sottostante normalizzato
  // ------------------------------------------------------------------
  const itemsByUnderlying = new Map<string, ReconciliationItem[]>();
  for (const item of items) {
    const key = normalizeUnderlying(item.underlying);
    if (!itemsByUnderlying.has(key)) itemsByUnderlying.set(key, []);
    itemsByUnderlying.get(key)!.push(item);
  }

  let anyChange = false;

  for (const [, underlyingItems] of itemsByUnderlying) {
    const realItems = underlyingItems.filter(i => !i.config.id.startsWith('__new__'));
    const syntheticItems = underlyingItems.filter(i => i.config.id.startsWith('__new__'));
    const underlyingLabel = underlyingItems[0].underlying;

    // ---- Caso 4: sottostante completamente nuovo (nessuna config) ----
    // Le strategie vengono aperte complete di tutte le gambe: la struttura
    // identifica il tipo. Sempre risolto, mai al dialog.
    if (realItems.length === 0) {
      for (const item of syntheticItems) {
        const newLegs = item.legs.filter(l => l.status === 'new' && l.position);
        if (newLegs.length === 0) continue;
        const sigs = newLegs.map(l => ({
          ...l.signature,
          quantity_abs: Math.abs(l.position!.quantity) || 1,
        }));
        const { strategyType, linkedStockId } = classifyNewStructure(sigs, item.underlying, allPositions);
        newConfigs.push({
          underlying: item.underlying,
          strategy_type: strategyType,
          position_signatures: sigs,
          is_synthetic: false,
          linked_stock_id: linkedStockId,
          linked_stock_slot_ids: [],
        });
        changes.push(`${item.underlying}: nuova strategia ${strategyType} configurata automaticamente (${sigs.map(sigLabel).join(', ')})`);
        anyChange = true;
      }
      continue;
    }

    // ---- Raccolta gambe missing e new per il sottostante ----
    const missing: MissingEntry[] = [];
    for (const item of realItems) {
      const sigs = workingSigs.get(item.config.id) || [];
      for (const leg of item.legs) {
        if (leg.status !== 'missing') continue;
        // Trova l'indice della firma originale corrispondente
        const idx = sigs.findIndex(
          s => s !== null &&
            (s.option_type || '').toLowerCase() === (leg.signature.option_type || '').toLowerCase() &&
            Math.abs(s.strike - leg.signature.strike) < 0.01 &&
            s.expiry === leg.signature.expiry &&
            s.quantity_sign === leg.signature.quantity_sign,
        );
        if (idx >= 0) {
          missing.push({ configId: item.config.id, sigIndex: idx, sig: { ...leg.signature } });
        }
      }
    }

    // Gambe new dedupe per position id (compaiono in più item dello stesso sottostante)
    const newByPosId = new Map<string, NewEntry>();
    for (const item of underlyingItems) {
      for (const leg of item.legs) {
        if (leg.status !== 'new' || !leg.position) continue;
        if (newByPosId.has(leg.position.id)) continue;
        newByPosId.set(leg.position.id, {
          positionId: leg.position.id,
          optionType: (leg.position.option_type || '').toLowerCase(),
          strike: leg.position.strike_price || 0,
          expiry: leg.position.expiry_date || '',
          quantitySign: leg.position.quantity >= 0 ? 1 : -1,
          availableQty: Math.abs(leg.position.quantity),
        });
      }
    }

    // ---- Caso 1: ROLL — accoppiamento per bucket (type, sign) ----
    const missingByBucket = new Map<string, MissingEntry[]>();
    for (const m of missing) {
      const k = bucketKey(m.sig.option_type, m.sig.quantity_sign);
      if (!missingByBucket.has(k)) missingByBucket.set(k, []);
      missingByBucket.get(k)!.push(m);
    }
    const newByBucket = new Map<string, NewEntry[]>();
    for (const n of newByPosId.values()) {
      const k = bucketKey(n.optionType, n.quantitySign);
      if (!newByBucket.has(k)) newByBucket.set(k, []);
      newByBucket.get(k)!.push(n);
    }

    const consumedNewIds = new Set<string>();

    for (const [bucket, missingList] of missingByBucket) {
      const candidates = (newByBucket.get(bucket) || []);
      // Ordinamento monotono su (strike, expiry): appaiamento 1-D ottimo e deterministico
      missingList.sort((a, b) => a.sig.strike - b.sig.strike || expiryToTime(a.sig.expiry) - expiryToTime(b.sig.expiry));
      candidates.sort((a, b) => a.strike - b.strike || expiryToTime(a.expiry) - expiryToTime(b.expiry));

      let ci = 0;
      for (const m of missingList) {
        const needed = m.sig.quantity_abs || 1;
        // Avanza al primo candidato con quantità residua
        while (ci < candidates.length && candidates[ci].availableQty <= 0) ci++;
        const cand = ci < candidates.length ? candidates[ci] : undefined;

        const sigs = workingSigs.get(m.configId)!;
        const cfg = configById.get(m.configId)!;

        if (cand) {
          const take = Math.min(needed, cand.availableQty);
          cand.availableQty -= take;
          consumedNewIds.add(cand.positionId);
          const oldLabel = sigLabel(m.sig);
          const newSig: PositionSignature = {
            option_type: m.sig.option_type,
            strike: cand.strike,
            expiry: cand.expiry,
            quantity_sign: m.sig.quantity_sign,
            quantity_abs: take,
          };
          // La firma originale copre anche eventuali contratti ancora presenti?
          // reconcileConfigs splitta già present/missing, quindi qui la quota
          // "missing" va interamente sostituita (o ridotta se take < needed).
          const original = sigs[m.sigIndex];
          if (original && (original.quantity_abs || 1) > needed) {
            // Parte della firma è ancora presente: riduci l'originale e aggiungi la nuova
            original.quantity_abs = (original.quantity_abs || 1) - needed;
            sigs.push(newSig);
          } else {
            sigs[m.sigIndex] = newSig;
          }
          changes.push(`${cfg.underlying} (${cfg.strategy_type}): roll ${oldLabel} → ${sigLabel(newSig)}`);
          anyChange = true;
          if (take < needed) {
            // Contratti mancanti senza rimpiazzo: la strategia si è ridotta
            changes.push(`${cfg.underlying} (${cfg.strategy_type}): ridotta di ${needed - take} contratti su ${oldLabel}`);
          }
        } else {
          // ---- Caso 2: nessuna candidata → gamba rimossa ----
          const original = sigs[m.sigIndex];
          if (original) {
            if ((original.quantity_abs || 1) > needed) {
              original.quantity_abs = (original.quantity_abs || 1) - needed;
            } else {
              sigs[m.sigIndex] = null;
            }
          }
          changes.push(`${cfg.underlying} (${cfg.strategy_type}): gamba chiusa ${sigLabel(m.sig)} (rimossa)`);
          anyChange = true;
        }
      }
    }

    // ---- Caso 3: gambe nuove residue — decision table per (tipo, segno) ----
    // Sempre risolto. Le regole seguono l'operatività reale: una put venduta
    // sopra una covered call È una nuova naked put; una put comprata sopra
    // una covered call la trasforma in de-risking; ecc.
    const leftovers = [...newByPosId.values()].filter(n => n.availableQty > 0);
    if (leftovers.length > 0) {
      const activeConfigsForUnderlying = configs.filter(
        c => normalizeUnderlying(c.underlying) === normalizeUnderlying(underlyingLabel) && !deletedConfigIds.has(c.id),
      );
      const currentType = (c: StrategyConfiguration) => retypedConfigs.get(c.id) || c.strategy_type;
      const findConfigOfType = (...types: string[]) =>
        activeConfigsForUnderlying.find(c => types.includes(currentType(c)));

      const appendTo = (target: StrategyConfiguration, sig: PositionSignature, extra?: string) => {
        if (!appendedSigs.has(target.id)) appendedSigs.set(target.id, []);
        appendedSigs.get(target.id)!.push(sig);
        changes.push(`${target.underlying} (${currentType(target)}): aggiunta gamba ${sigLabel(sig)}${extra ? ` — ${extra}` : ''}`);
        anyChange = true;
      };
      const createConfig = (strategyType: string, sig: PositionSignature, linkedStockId: string | null = null) => {
        // Se abbiamo già creato una config dello stesso tipo per questo
        // sottostante in questo run, accoda lì invece di duplicare.
        const existing = newConfigs.find(
          nc => normalizeUnderlying(nc.underlying) === normalizeUnderlying(underlyingLabel) && nc.strategy_type === strategyType,
        );
        if (existing) {
          existing.position_signatures.push(sig);
        } else {
          newConfigs.push({
            underlying: underlyingLabel,
            strategy_type: strategyType,
            position_signatures: [sig],
            is_synthetic: false,
            linked_stock_id: linkedStockId,
            linked_stock_slot_ids: [],
          });
        }
        changes.push(`${underlyingLabel}: nuova strategia ${strategyType} creata automaticamente (${sigLabel(sig)})`);
        anyChange = true;
      };
      const retype = (target: StrategyConfiguration, newType: string) => {
        if (currentType(target) === newType) return;
        changes.push(`${target.underlying}: strategia riclassificata ${currentType(target)} → ${newType}`);
        retypedConfigs.set(target.id, newType);
        anyChange = true;
      };
      /** Firme correnti (originali sopravvissute + accodate) di una config */
      const liveSigsOf = (c: StrategyConfiguration): PositionSignature[] => [
        ...(workingSigs.get(c.id) || []).filter((s): s is PositionSignature => s !== null),
        ...(appendedSigs.get(c.id) || []),
      ];

      for (const n of leftovers) {
        const sig: PositionSignature = {
          option_type: n.optionType,
          strike: n.strike,
          expiry: n.expiry,
          quantity_sign: n.quantitySign,
          quantity_abs: n.availableQty,
        };
        const isPut = n.optionType === 'put';
        const isSold = n.quantitySign === -1;

        if (isPut && isSold) {
          // Put venduta → naked put (esistente o nuova). Mai dentro una CC.
          const np = findConfigOfType('naked_put');
          if (np) appendTo(np, sig);
          else createConfig('naked_put', sig);
        } else if (isPut && !isSold) {
          // Put comprata → protezione o gamba lunga di spread
          const cc = findConfigOfType('covered_call');
          const drcc = findConfigOfType('derisking_covered_call');
          const np = findConfigOfType('naked_put');
          const spread = findConfigOfType('put_spread', 'diagonal_put_spread');
          if (cc) {
            appendTo(cc, sig, 'covered call trasformata in de-risking');
            retype(cc, 'derisking_covered_call');
          } else if (drcc) {
            appendTo(drcc, sig);
          } else if (np) {
            const sameExpiry = liveSigsOf(np).some(s => s.quantity_sign === -1 && s.expiry === sig.expiry);
            appendTo(np, sig, 'naked put trasformata in spread');
            retype(np, sameExpiry ? 'put_spread' : 'diagonal_put_spread');
          } else if (spread) {
            appendTo(spread, sig);
          } else {
            createConfig('other', sig);
          }
        } else if (!isPut && isSold) {
          // Call venduta → covered call se c'è dove appoggiarla
          const ccLike = findConfigOfType('covered_call', 'derisking_covered_call');
          if (ccLike) {
            appendTo(ccLike, sig);
          } else {
            const stock = findStockForUnderlying(underlyingLabel, allPositions);
            if (stock) createConfig('covered_call', sig, stock.id);
            else createConfig('other', sig);
          }
        } else {
          // Call comprata → LEAP call
          const leap = findConfigOfType('leap_call');
          if (leap) appendTo(leap, sig);
          else createConfig('leap_call', sig);
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // Chiusura strategie: config rimaste senza firme e senza azioni collegate
  // ------------------------------------------------------------------
  for (const [configId, sigs] of workingSigs) {
    const cfg = configById.get(configId)!;
    const remaining = sigs.filter((s): s is PositionSignature => s !== null);
    const appended = appendedSigs.get(configId) || [];
    const hasLinkedStock = !!cfg.linked_stock_id || (cfg.linked_stock_slot_ids || []).length > 0;
    if (remaining.length + appended.length === 0 && !hasLinkedStock) {
      deletedConfigIds.add(configId);
      changes.push(`${cfg.underlying} (${cfg.strategy_type}): strategia chiusa, configurazione eliminata`);
      anyChange = true;
    }
  }

  if (!anyChange) {
    return { resolvedConfigs: null, changes: [], unresolvedItems: items.slice(), hasAutoChanges: false };
  }

  // ------------------------------------------------------------------
  // Ricostruzione del set completo (upsertBatch = full replace)
  // ------------------------------------------------------------------
  const resolvedConfigs: UpsertConfigParams[] = [];
  for (const c of configs) {
    if (deletedConfigIds.has(c.id)) continue;
    const sigs = (workingSigs.get(c.id) || []).filter((s): s is PositionSignature => s !== null);
    const appended = appendedSigs.get(c.id) || [];
    resolvedConfigs.push({
      underlying: c.underlying,
      strategy_type: retypedConfigs.get(c.id) || c.strategy_type,
      position_signatures: [...sigs, ...appended],
      is_synthetic: c.is_synthetic,
      linked_stock_id: c.linked_stock_id,
      linked_stock_slot_ids: c.linked_stock_slot_ids || [],
      sort_order: c.sort_order,
    });
  }
  const maxSort = configs.reduce((m, c) => Math.max(m, c.sort_order || 0), 0);
  newConfigs.forEach((nc, i) => {
    resolvedConfigs.push({ ...nc, sort_order: maxSort + 1 + i });
  });

  return { resolvedConfigs, changes, unresolvedItems, hasAutoChanges: true };
}
