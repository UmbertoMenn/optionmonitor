/**
 * Riconciliazione AUTOMATICA delle configurazioni strategia dopo un upload.
 *
 * Prende il diff prodotto da reconcileConfigs (gambe present/missing/new) e
 * lo risolve senza intervento manuale dove il matching è deterministico:
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
 *     call / de-risking) sopravvivono anche senza gambe opzionarie: il caso
 *     "stock-only CC" è già supportato dall'app.
 *
 *  3. AGGIUNTA — una gamba "new" senza controparte "missing" viene
 *     accodata automaticamente alla config esistente SOLO se per quel
 *     sottostante esiste una e una sola config (nessuna ambiguità su dove
 *     metterla). Con più config sullo stesso sottostante resta irrisolta.
 *
 *  4. NUOVO SOTTOSTANTE — posizioni su un sottostante senza alcuna config:
 *     se sono ESCLUSIVAMENTE put vendute, viene creata una config
 *     naked_put (caso frequentissimo e privo di ambiguità). Ogni altra
 *     combinazione resta irrisolta: il tipo di strategia è una scelta
 *     dell'utente, non un fatto deducibile dallo snapshot.
 *
 * Ciò che non è risolvibile in modo deterministico resta in
 * `unresolvedItems` e continua a passare dal dialog manuale — che a questo
 * punto si apre solo per i casi genuinamente ambigui.
 */
import { StrategyConfiguration, PositionSignature, UpsertConfigParams } from '@/hooks/useStrategyConfigurations';
import { ReconciliationItem, LegStatus } from '@/lib/strategyReconciliation';
import { normalizeForMatching, getCanonicalKey } from '@/lib/derivativeStrategies';

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

export function autoReconcileStrategies(
  configs: StrategyConfiguration[],
  items: ReconciliationItem[],
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
  const newConfigs: UpsertConfigParams[] = []; // config create ex novo (naked_put su nuovi sottostanti)

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
    if (realItems.length === 0) {
      for (const item of syntheticItems) {
        const newLegs = item.legs.filter(l => l.status === 'new' && l.position);
        const allSoldPuts = newLegs.length > 0 && newLegs.every(
          l => (l.signature.option_type || '').toLowerCase() === 'put' && l.signature.quantity_sign === -1,
        );
        if (allSoldPuts) {
          newConfigs.push({
            underlying: item.underlying,
            strategy_type: 'naked_put',
            position_signatures: newLegs.map(l => ({
              ...l.signature,
              quantity_abs: Math.abs(l.position!.quantity) || 1,
            })),
            is_synthetic: false,
            linked_stock_id: null,
            linked_stock_slot_ids: [],
          });
          changes.push(`${item.underlying}: nuova Naked Put configurata automaticamente (${newLegs.map(l => sigLabel(l.signature)).join(', ')})`);
          anyChange = true;
        } else {
          unresolvedItems.push(item);
        }
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
    const newLegStatusByPosId = new Map<string, LegStatus>();
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
        newLegStatusByPosId.set(leg.position.id, leg);
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

    // ---- Caso 3: AGGIUNTA — new senza controparte, config unica ----
    const leftovers = [...newByPosId.values()].filter(n => n.availableQty > 0);
    if (leftovers.length > 0) {
      const activeConfigs = realItems
        .map(i => i.config)
        .filter(c => !deletedConfigIds.has(c.id));
      // Considera anche config dello stesso sottostante NON presenti negli item
      // (config senza discrepanze non generano item): l'unicità va valutata
      // sull'insieme completo delle config del sottostante.
      const allConfigsForUnderlying = configs.filter(
        c => normalizeUnderlying(c.underlying) === normalizeUnderlying(underlyingLabel) && !deletedConfigIds.has(c.id),
      );
      if (allConfigsForUnderlying.length === 1) {
        const target = allConfigsForUnderlying[0];
        for (const n of leftovers) {
          const sig: PositionSignature = {
            option_type: n.optionType,
            strike: n.strike,
            expiry: n.expiry,
            quantity_sign: n.quantitySign,
            quantity_abs: n.availableQty,
          };
          if (!appendedSigs.has(target.id)) appendedSigs.set(target.id, []);
          appendedSigs.get(target.id)!.push(sig);
          changes.push(`${target.underlying} (${target.strategy_type}): aggiunta gamba ${sigLabel(sig)}`);
          anyChange = true;
        }
      } else {
        // Più config sullo stesso sottostante: destinazione ambigua → dialog
        for (const item of underlyingItems) {
          const hasUnresolvedNew = item.legs.some(
            l => l.status === 'new' && l.position && leftovers.some(n => n.positionId === l.position!.id),
          );
          if (hasUnresolvedNew && !unresolvedItems.includes(item)) unresolvedItems.push(item);
        }
        void activeConfigs;
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
      strategy_type: c.strategy_type,
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
